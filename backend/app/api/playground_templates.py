"""
Playground and prompt template management API endpoints.
Handles prompt templates, executions, A/B testing, and chain building.
"""
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
from uuid import uuid4
import json
import re
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks

from app.models.enterprise_schemas import (
    PromptTemplateCreate, PromptTemplateInfo, PromptExecutionRequest, 
    PromptExecutionResult, SuccessResponse, PaginatedResponse, BulkOperationResult
)
from app.core.deps_enterprise import get_current_user, get_current_organization
from app.utils.permissions import check_permission
from app.db.supabase_client import supabase_client
from app.rag.qa import qa_chain
from app.core.config import settings

router = APIRouter(prefix="/playground", tags=["playground"])
logger = logging.getLogger(__name__)

# =============================================================================
# PROMPT TEMPLATE MANAGEMENT
# =============================================================================

@router.get("/templates", response_model=PaginatedResponse)
async def get_prompt_templates(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    category: Optional[str] = Query(None, description="Filter by category"),
    status: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search in name/description"),
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get prompt templates with filtering and pagination."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "documents", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Build query
        query = supabase_client.table("prompt_templates").select(
            "*, creator:created_by(name, email), updater:updated_by(name, email)",
            count="exact"
        ).eq("organization_id", current_org["id"])
        
        # Apply filters
        if category:
            query = query.eq("category", category)
        if status:
            query = query.eq("status", status)
        if search:
            query = query.or_(f"name.ilike.%{search}%,description.ilike.%{search}%")
        
        # Get total count
        count_result = query.execute()
        total = count_result.count or 0
        
        # Apply pagination
        offset = (page - 1) * page_size
        templates_result = query.order("updated_at", desc=True).range(offset, offset + page_size - 1).execute()
        
        # Transform data
        templates = []
        for template in templates_result.data:
            templates.append(PromptTemplateInfo(
                id=template["id"],
                organization_id=template["organization_id"],
                name=template["name"],
                description=template.get("description"),
                category=template["category"],
                system_prompt=template["system_prompt"],
                user_prompt_template=template["user_prompt_template"],
                variables=template.get("variables", []),
                model_config=template.get("model_config", {}),
                status=template["status"],
                version=template["version"],
                usage_count=template.get("usage_count", 0),
                avg_rating=template.get("avg_rating"),
                avg_response_time=template.get("avg_response_time"),
                created_at=datetime.fromisoformat(template["created_at"]),
                created_by=template["created_by"]
            ))
        
        return PaginatedResponse(
            items=templates,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size,
            has_next=offset + page_size < total,
            has_prev=page > 1
        )
        
    except Exception as e:
        logger.error(f"Error getting prompt templates: {e}")
        raise HTTPException(status_code=500, detail="Failed to get prompt templates")

@router.post("/templates", response_model=SuccessResponse)
async def create_prompt_template(
    template_data: PromptTemplateCreate,
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Create a new prompt template."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "documents", "write"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Validate template variables
        variables = _extract_template_variables(template_data.user_prompt_template)
        declared_variables = [var.name for var in template_data.variables]
        
        # Check for undeclared variables
        undeclared = [var for var in variables if var not in declared_variables]
        if undeclared:
            raise HTTPException(
                status_code=400,
                detail=f"Undeclared variables in template: {', '.join(undeclared)}"
            )
        
        # Create template record
        template_record = {
            "organization_id": current_org["id"],
            "name": template_data.name,
            "description": template_data.description,
            "category": template_data.category,
            "system_prompt": template_data.system_prompt,
            "user_prompt_template": template_data.user_prompt_template,
            "variables": [var.dict() for var in template_data.variables],
            "model_config": template_data.model_config.dict(),
            "status": "draft",
            "version": 1,
            "usage_count": 0,
            "created_by": current_user["id"],
            "updated_by": current_user["id"],
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        result = supabase_client.table("prompt_templates").insert(template_record).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create template")
        
        template_id = result.data[0]["id"]
        
        return SuccessResponse(
            message="Prompt template created successfully",
            data={"template_id": template_id}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating prompt template: {e}")
        raise HTTPException(status_code=500, detail="Failed to create prompt template")

@router.get("/templates/{template_id}", response_model=PromptTemplateInfo)
async def get_prompt_template(
    template_id: str,
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get specific prompt template."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "documents", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        result = supabase_client.table("prompt_templates").select(
            "*, creator:created_by(name, email), updater:updated_by(name, email)"
        ).eq("id", template_id).eq("organization_id", current_org["id"]).single().execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Template not found")
        
        template = result.data
        
        return PromptTemplateInfo(
            id=template["id"],
            organization_id=template["organization_id"],
            name=template["name"],
            description=template.get("description"),
            category=template["category"],
            system_prompt=template["system_prompt"],
            user_prompt_template=template["user_prompt_template"],
            variables=template.get("variables", []),
            model_config=template.get("model_config", {}),
            status=template["status"],
            version=template["version"],
            usage_count=template.get("usage_count", 0),
            avg_rating=template.get("avg_rating"),
            avg_response_time=template.get("avg_response_time"),
            created_at=datetime.fromisoformat(template["created_at"]),
            created_by=template["created_by"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting prompt template: {e}")
        raise HTTPException(status_code=500, detail="Failed to get prompt template")

@router.put("/templates/{template_id}", response_model=SuccessResponse)
async def update_prompt_template(
    template_id: str,
    template_data: PromptTemplateCreate,
    create_new_version: bool = Query(False, description="Create new version instead of updating"),
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Update prompt template."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "documents", "write"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Get current template
        current_template = supabase_client.table("prompt_templates").select(
            "*"
        ).eq("id", template_id).eq("organization_id", current_org["id"]).single().execute()
        
        if not current_template.data:
            raise HTTPException(status_code=404, detail="Template not found")
        
        template = current_template.data
        
        # Validate variables
        variables = _extract_template_variables(template_data.user_prompt_template)
        declared_variables = [var.name for var in template_data.variables]
        undeclared = [var for var in variables if var not in declared_variables]
        if undeclared:
            raise HTTPException(
                status_code=400,
                detail=f"Undeclared variables in template: {', '.join(undeclared)}"
            )
        
        if create_new_version:
            # Create new version
            new_version = template["version"] + 1
            new_template_record = {
                "organization_id": current_org["id"],
                "name": template_data.name,
                "description": template_data.description,
                "category": template_data.category,
                "system_prompt": template_data.system_prompt,
                "user_prompt_template": template_data.user_prompt_template,
                "variables": [var.dict() for var in template_data.variables],
                "model_config": template_data.model_config.dict(),
                "status": "draft",
                "version": new_version,
                "usage_count": 0,
                "created_by": template["created_by"],
                "updated_by": current_user["id"],
                "created_at": template["created_at"],
                "updated_at": datetime.utcnow().isoformat()
            }
            
            result = supabase_client.table("prompt_templates").insert(new_template_record).execute()
            message = f"Template version {new_version} created successfully"
            
        else:
            # Update existing template
            update_data = {
                "name": template_data.name,
                "description": template_data.description,
                "category": template_data.category,
                "system_prompt": template_data.system_prompt,
                "user_prompt_template": template_data.user_prompt_template,
                "variables": [var.dict() for var in template_data.variables],
                "model_config": template_data.model_config.dict(),
                "updated_by": current_user["id"],
                "updated_at": datetime.utcnow().isoformat()
            }
            
            result = supabase_client.table("prompt_templates").update(
                update_data
            ).eq("id", template_id).execute()
            message = "Template updated successfully"
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update template")
        
        return SuccessResponse(message=message)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating prompt template: {e}")
        raise HTTPException(status_code=500, detail="Failed to update prompt template")

@router.delete("/templates/{template_id}", response_model=SuccessResponse)
async def delete_prompt_template(
    template_id: str,
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Delete prompt template."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "documents", "delete"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        result = supabase_client.table("prompt_templates").delete().eq(
            "id", template_id
        ).eq("organization_id", current_org["id"]).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Template not found")
        
        return SuccessResponse(message="Template deleted successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting prompt template: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete prompt template")

# =============================================================================
# PROMPT EXECUTION AND TESTING
# =============================================================================

@router.post("/templates/{template_id}/execute", response_model=PromptExecutionResult)
async def execute_prompt_template(
    template_id: str,
    execution_request: PromptExecutionRequest,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Execute prompt template with provided variables."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "documents", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Get template
        template_result = supabase_client.table("prompt_templates").select(
            "*"
        ).eq("id", template_id).eq("organization_id", current_org["id"]).single().execute()
        
        if not template_result.data:
            raise HTTPException(status_code=404, detail="Template not found")
        
        template = template_result.data
        
        # Validate variables
        declared_variables = {var["name"]: var for var in template.get("variables", [])}
        provided_variables = execution_request.variables
        
        # Check required variables
        missing_required = [
            var_name for var_name, var_def in declared_variables.items()
            if var_def.get("required", True) and var_name not in provided_variables
        ]
        if missing_required:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required variables: {', '.join(missing_required)}"
            )
        
        # Render template with variables
        try:
            rendered_prompt = _render_template(template["user_prompt_template"], provided_variables)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Template rendering error: {str(e)}")
        
        # Execute with RAG system
        start_time = datetime.utcnow()
        
        try:
            # Use the existing QA chain with rendered prompt
            response = await qa_chain.process_query(
                query=rendered_prompt,
                organization_id=current_org["id"],
                user_id=current_user["id"],
                **template.get("model_config", {})
            )
            
            output = response.get("answer", "")
            tokens_used = response.get("tokens_used", 0)
            
        except Exception as e:
            logger.error(f"Error executing prompt: {e}")
            output = f"Execution error: {str(e)}"
            tokens_used = 0
        
        end_time = datetime.utcnow()
        response_time = (end_time - start_time).total_seconds()
        
        # Calculate cost (simplified)
        cost_cents = int(tokens_used * 0.002) if tokens_used > 0 else 1  # Example pricing
        
        # Create execution record
        execution_record = {
            "template_id": template_id,
            "organization_id": current_org["id"],
            "input_variables": provided_variables,
            "rendered_prompt": rendered_prompt,
            "output": output,
            "response_time": response_time,
            "cost_cents": cost_cents,
            "tokens_used": tokens_used,
            "executed_at": start_time.isoformat(),
            "executed_by": current_user["id"]
        }
        
        if execution_request.save_execution:
            result = supabase_client.table("prompt_executions").insert(execution_record).execute()
            execution_id = result.data[0]["id"] if result.data else str(uuid4())
        else:
            execution_id = str(uuid4())
        
        # Update template usage stats in background
        if execution_request.save_execution:
            background_tasks.add_task(
                _update_template_usage_stats,
                template_id,
                response_time,
                cost_cents
            )
        
        return PromptExecutionResult(
            id=execution_id,
            template_id=template_id,
            rendered_prompt=rendered_prompt,
            output=output,
            response_time=response_time,
            cost_cents=cost_cents,
            tokens_used=tokens_used,
            executed_at=start_time
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing prompt template: {e}")
        raise HTTPException(status_code=500, detail="Failed to execute prompt template")

@router.get("/templates/{template_id}/executions", response_model=PaginatedResponse)
async def get_template_executions(
    template_id: str,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get execution history for a template."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "documents", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Verify template exists and belongs to organization
        template = supabase_client.table("prompt_templates").select(
            "id"
        ).eq("id", template_id).eq("organization_id", current_org["id"]).single().execute()
        
        if not template.data:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # Get executions
        offset = (page - 1) * page_size
        
        result = supabase_client.table("prompt_executions").select(
            "*, executor:executed_by(name, email)",
            count="exact"
        ).eq("template_id", template_id).eq("organization_id", current_org["id"]).order(
            "executed_at", desc=True
        ).range(offset, offset + page_size - 1).execute()
        
        total = result.count or 0
        
        return PaginatedResponse(
            items=result.data or [],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size,
            has_next=offset + page_size < total,
            has_prev=page > 1
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting template executions: {e}")
        raise HTTPException(status_code=500, detail="Failed to get template executions")

# =============================================================================
# TEMPLATE ANALYTICS AND OPTIMIZATION
# =============================================================================

@router.get("/templates/{template_id}/analytics", response_model=Dict[str, Any])
async def get_template_analytics(
    template_id: str,
    days: int = Query(30, ge=1, le=365, description="Number of days"),
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get analytics for a specific template."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "documents", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Verify template exists
        template = supabase_client.table("prompt_templates").select(
            "*"
        ).eq("id", template_id).eq("organization_id", current_org["id"]).single().execute()
        
        if not template.data:
            raise HTTPException(status_code=404, detail="Template not found")
        
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Get execution statistics
        executions = supabase_client.table("prompt_executions").select(
            "response_time, cost_cents, tokens_used, user_rating, executed_at"
        ).eq("template_id", template_id).eq("organization_id", current_org["id"]).gte(
            "executed_at", start_date.isoformat()
        ).execute()
        
        execution_data = executions.data or []
        
        if execution_data:
            total_executions = len(execution_data)
            avg_response_time = sum(e.get("response_time", 0) for e in execution_data) / total_executions
            total_cost = sum(e.get("cost_cents", 0) for e in execution_data)
            avg_cost = total_cost / total_executions
            total_tokens = sum(e.get("tokens_used", 0) for e in execution_data)
            
            # Calculate ratings
            ratings = [e["user_rating"] for e in execution_data if e.get("user_rating")]
            avg_rating = sum(ratings) / len(ratings) if ratings else None
            
            # Calculate daily usage
            daily_usage = {}
            for execution in execution_data:
                day = execution["executed_at"][:10]  # Extract date
                daily_usage[day] = daily_usage.get(day, 0) + 1
            
            # Performance trends
            sorted_executions = sorted(execution_data, key=lambda x: x["executed_at"])
            if len(sorted_executions) >= 2:
                first_half = sorted_executions[:len(sorted_executions)//2]
                second_half = sorted_executions[len(sorted_executions)//2:]
                
                first_avg_time = sum(e.get("response_time", 0) for e in first_half) / len(first_half)
                second_avg_time = sum(e.get("response_time", 0) for e in second_half) / len(second_half)
                
                performance_trend = "improving" if second_avg_time < first_avg_time else "degrading" if second_avg_time > first_avg_time else "stable"
            else:
                performance_trend = "insufficient_data"
        else:
            total_executions = 0
            avg_response_time = 0
            total_cost = 0
            avg_cost = 0
            total_tokens = 0
            avg_rating = None
            daily_usage = {}
            performance_trend = "no_data"
        
        # Generate optimization recommendations
        recommendations = _generate_template_recommendations(
            template.data,
            avg_response_time,
            avg_cost,
            avg_rating
        )
        
        return {
            "template_id": template_id,
            "template_name": template.data["name"],
            "period": {"days": days, "start_date": start_date.date(), "end_date": datetime.utcnow().date()},
            "summary": {
                "total_executions": total_executions,
                "avg_response_time": round(avg_response_time, 2),
                "total_cost_cents": total_cost,
                "avg_cost_cents": round(avg_cost, 2),
                "total_tokens": total_tokens,
                "avg_rating": round(avg_rating, 2) if avg_rating else None
            },
            "trends": {
                "daily_usage": [{"date": date, "executions": count} for date, count in sorted(daily_usage.items())],
                "performance_trend": performance_trend
            },
            "recommendations": recommendations,
            "generated_at": datetime.utcnow()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting template analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get template analytics")

@router.post("/templates/compare", response_model=Dict[str, Any])
async def compare_templates(
    template_ids: List[str],
    days: int = Query(30, ge=1, le=365, description="Number of days"),
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Compare performance of multiple templates."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "documents", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        if len(template_ids) < 2 or len(template_ids) > 10:
            raise HTTPException(status_code=400, detail="Please select 2-10 templates to compare")
        
        start_date = datetime.utcnow() - timedelta(days=days)
        comparison_data = {}
        
        for template_id in template_ids:
            # Get template info
            template = supabase_client.table("prompt_templates").select(
                "id, name, category"
            ).eq("id", template_id).eq("organization_id", current_org["id"]).single().execute()
            
            if not template.data:
                continue  # Skip missing templates
            
            # Get execution data
            executions = supabase_client.table("prompt_executions").select(
                "response_time, cost_cents, tokens_used, user_rating"
            ).eq("template_id", template_id).eq("organization_id", current_org["id"]).gte(
                "executed_at", start_date.isoformat()
            ).execute()
            
            execution_data = executions.data or []
            
            if execution_data:
                total_executions = len(execution_data)
                avg_response_time = sum(e.get("response_time", 0) for e in execution_data) / total_executions
                avg_cost = sum(e.get("cost_cents", 0) for e in execution_data) / total_executions
                
                ratings = [e["user_rating"] for e in execution_data if e.get("user_rating")]
                avg_rating = sum(ratings) / len(ratings) if ratings else None
                
                comparison_data[template_id] = {
                    "name": template.data["name"],
                    "category": template.data["category"],
                    "executions": total_executions,
                    "avg_response_time": round(avg_response_time, 2),
                    "avg_cost_cents": round(avg_cost, 2),
                    "avg_rating": round(avg_rating, 2) if avg_rating else None
                }
        
        # Find best performing template in each metric
        if comparison_data:
            best_performance = min(comparison_data.items(), key=lambda x: x[1]["avg_response_time"])
            best_cost = min(comparison_data.items(), key=lambda x: x[1]["avg_cost_cents"])
            best_rating = max(
                [(k, v) for k, v in comparison_data.items() if v["avg_rating"] is not None],
                key=lambda x: x[1]["avg_rating"]
            ) if any(v["avg_rating"] for v in comparison_data.values()) else None
            
            winners = {
                "fastest": {"id": best_performance[0], "name": best_performance[1]["name"], "time": best_performance[1]["avg_response_time"]},
                "cheapest": {"id": best_cost[0], "name": best_cost[1]["name"], "cost": best_cost[1]["avg_cost_cents"]},
                "highest_rated": {"id": best_rating[0], "name": best_rating[1]["name"], "rating": best_rating[1]["avg_rating"]} if best_rating else None
            }
        else:
            winners = {}
        
        return {
            "period": {"days": days, "start_date": start_date.date(), "end_date": datetime.utcnow().date()},
            "templates": comparison_data,
            "winners": winners,
            "generated_at": datetime.utcnow()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error comparing templates: {e}")
        raise HTTPException(status_code=500, detail="Failed to compare templates")

# =============================================================================
# TEMPLATE CATEGORIES AND MANAGEMENT
# =============================================================================

@router.get("/categories", response_model=List[Dict[str, Any]])
async def get_template_categories(
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get template categories with usage statistics."""
    try:
        # Get categories with counts
        result = supabase_client.table("prompt_templates").select(
            "category, COUNT(*) as count, status"
        ).eq("organization_id", current_org["id"]).group("category, status").execute()
        
        # Process results
        category_stats = {}
        for row in result.data or []:
            category = row["category"]
            if category not in category_stats:
                category_stats[category] = {"total": 0, "active": 0, "draft": 0}
            
            category_stats[category]["total"] += row["count"]
            if row["status"] == "active":
                category_stats[category]["active"] += row["count"]
            elif row["status"] == "draft":
                category_stats[category]["draft"] += row["count"]
        
        # Format response
        categories = []
        for category, stats in category_stats.items():
            categories.append({
                "name": category,
                "total_templates": stats["total"],
                "active_templates": stats["active"],
                "draft_templates": stats["draft"]
            })
        
        return sorted(categories, key=lambda x: x["total_templates"], reverse=True)
        
    except Exception as e:
        logger.error(f"Error getting template categories: {e}")
        raise HTTPException(status_code=500, detail="Failed to get template categories")

# =============================================================================
# BULK OPERATIONS
# =============================================================================

@router.post("/templates/bulk", response_model=BulkOperationResult)
async def bulk_template_operations(
    operation: str,
    template_ids: List[str],
    parameters: Optional[Dict[str, Any]] = None,
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Perform bulk operations on templates."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "documents", "write"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        results = []
        errors = []
        
        for template_id in template_ids:
            try:
                if operation == "activate":
                    result = supabase_client.table("prompt_templates").update({
                        "status": "active",
                        "updated_by": current_user["id"],
                        "updated_at": datetime.utcnow().isoformat()
                    }).eq("id", template_id).eq("organization_id", current_org["id"]).execute()
                    
                elif operation == "deactivate":
                    result = supabase_client.table("prompt_templates").update({
                        "status": "draft",
                        "updated_by": current_user["id"],
                        "updated_at": datetime.utcnow().isoformat()
                    }).eq("id", template_id).eq("organization_id", current_org["id"]).execute()
                    
                elif operation == "delete":
                    result = supabase_client.table("prompt_templates").delete().eq(
                        "id", template_id
                    ).eq("organization_id", current_org["id"]).execute()
                    
                elif operation == "change_category":
                    if not parameters or "category" not in parameters:
                        raise ValueError("Category parameter required")
                    
                    result = supabase_client.table("prompt_templates").update({
                        "category": parameters["category"],
                        "updated_by": current_user["id"],
                        "updated_at": datetime.utcnow().isoformat()
                    }).eq("id", template_id).eq("organization_id", current_org["id"]).execute()
                    
                else:
                    raise ValueError(f"Unknown operation: {operation}")
                
                if result.data:
                    results.append({"id": template_id, "status": "success"})
                else:
                    errors.append({"id": template_id, "error": "Template not found or access denied"})
                    
            except Exception as e:
                errors.append({"id": template_id, "error": str(e)})
        
        return BulkOperationResult(
            success_count=len(results),
            error_count=len(errors),
            total_count=len(template_ids),
            errors=errors,
            results=results
        )
        
    except Exception as e:
        logger.error(f"Error in bulk template operations: {e}")
        raise HTTPException(status_code=500, detail="Failed to perform bulk operations")

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _extract_template_variables(template_string: str) -> List[str]:
    """Extract variable names from template string."""
    # Look for variables in format {variable_name}
    pattern = r'\{(\w+)\}'
    variables = re.findall(pattern, template_string)
    return list(set(variables))  # Remove duplicates

def _render_template(template_string: str, variables: Dict[str, Any]) -> str:
    """Render template with provided variables."""
    try:
        # Simple string replacement for now
        # In production, consider using Jinja2 or similar
        rendered = template_string
        for var_name, var_value in variables.items():
            rendered = rendered.replace(f"{{{var_name}}}", str(var_value))
        
        # Check for unresolved variables
        unresolved = re.findall(r'\{(\w+)\}', rendered)
        if unresolved:
            raise ValueError(f"Unresolved variables: {', '.join(unresolved)}")
        
        return rendered
        
    except Exception as e:
        raise ValueError(f"Template rendering failed: {str(e)}")

async def _update_template_usage_stats(
    template_id: str,
    response_time: float,
    cost_cents: int
):
    """Update template usage statistics."""
    try:
        # Get current stats
        current = supabase_client.table("prompt_templates").select(
            "usage_count, avg_response_time, avg_cost_cents"
        ).eq("id", template_id).single().execute()
        
        if current.data:
            usage_count = current.data.get("usage_count", 0) + 1
            current_avg_time = current.data.get("avg_response_time", 0)
            current_avg_cost = current.data.get("avg_cost_cents", 0)
            
            # Calculate new averages
            new_avg_time = ((current_avg_time * (usage_count - 1)) + response_time) / usage_count
            new_avg_cost = ((current_avg_cost * (usage_count - 1)) + cost_cents) / usage_count
            
            # Update template
            supabase_client.table("prompt_templates").update({
                "usage_count": usage_count,
                "avg_response_time": new_avg_time,
                "avg_cost_cents": new_avg_cost,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", template_id).execute()
            
    except Exception as e:
        logger.error(f"Error updating template usage stats: {e}")

def _generate_template_recommendations(
    template: Dict[str, Any],
    avg_response_time: float,
    avg_cost: float,
    avg_rating: Optional[float]
) -> List[Dict[str, str]]:
    """Generate optimization recommendations for a template."""
    recommendations = []
    
    # Performance recommendations
    if avg_response_time > 3.0:  # Slow response time
        recommendations.append({
            "type": "performance",
            "priority": "high",
            "title": "Optimize prompt length",
            "description": f"Average response time is {avg_response_time:.1f}s. Consider shortening the prompt or reducing context size."
        })
    
    # Cost recommendations
    if avg_cost > 5.0:  # High cost per execution
        recommendations.append({
            "type": "cost",
            "priority": "medium",
            "title": "Reduce token usage",
            "description": f"Average cost is {avg_cost:.2f}¢ per execution. Consider optimizing the prompt to use fewer tokens."
        })
    
    # Quality recommendations
    if avg_rating and avg_rating < 3.0:  # Low rating
        recommendations.append({
            "type": "quality",
            "priority": "high",
            "title": "Improve prompt quality",
            "description": f"Average rating is {avg_rating:.1f}/5. Consider refining the prompt instructions."
        })
    
    # Usage recommendations
    usage_count = template.get("usage_count", 0)
    if usage_count == 0:
        recommendations.append({
            "type": "usage",
            "priority": "low",
            "title": "Template not used",
            "description": "This template hasn't been executed yet. Consider testing it or removing if not needed."
        })
    elif usage_count < 10:
        recommendations.append({
            "type": "usage",
            "priority": "low",
            "title": "Low usage template",
            "description": "This template has low usage. Consider promoting it or consolidating with similar templates."
        })
    
    # Default recommendation if everything looks good
    if not recommendations and usage_count > 0:
        recommendations.append({
            "type": "general",
            "priority": "low",
            "title": "Template performing well",
            "description": "This template shows good performance metrics. Continue monitoring for optimization opportunities."
        })
    
    return recommendations