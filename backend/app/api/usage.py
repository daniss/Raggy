"""
Usage analytics and metrics API endpoints.
Provides organization usage statistics, quotas, and analytics.
"""
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from calendar import monthrange

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel

from app.core.deps import (
    require_auth, get_current_organization, require_permission_dep,
    verify_feature_access
)
from app.db.supabase_client import supabase_client
from app.utils.permissions import get_organization_limits

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/usage", tags=["usage"])

# =============================================================================
# SCHEMAS
# =============================================================================

class UsageQuota(BaseModel):
    resource: str
    current: int
    limit: int
    percentage: float
    exceeded: bool

class UsageSummary(BaseModel):
    organization_id: str
    period: str  # YYYY-MM format
    documents: UsageQuota
    tokens: UsageQuota
    storage: UsageQuota
    users: UsageQuota
    updated_at: datetime

class TokenUsageDaily(BaseModel):
    date: str
    tokens_input: int
    tokens_output: int
    total_tokens: int
    cost_estimate_cents: int

class PopularQuery(BaseModel):
    query_text: str
    execution_count: int
    avg_response_time: float
    avg_satisfaction: Optional[float]
    last_executed: datetime

class UsageMetrics(BaseModel):
    total_queries_month: int
    unique_users_month: int
    avg_response_time_month: float
    successful_queries_month: int
    failed_queries_month: int
    documents_processed_month: int

# =============================================================================
# USAGE OVERVIEW
# =============================================================================

@router.get("/summary", response_model=UsageSummary)
async def get_usage_summary(
    month: Optional[str] = Query(None, description="YYYY-MM format, defaults to current month"),
    current_user: dict = Depends(require_auth),
    current_org: dict = Depends(get_current_organization),
    _: None = Depends(require_permission_dep("usage", "view"))
):
    """Get usage summary for the organization."""
    try:
        # Default to current month
        if not month:
            month = datetime.now().strftime("%Y%m")
        else:
            # Convert YYYY-MM to YYYYMM
            month = month.replace("-", "")
        
        # Get organization limits
        limits = await get_organization_limits(current_org["id"])
        
        # Get usage data for the month
        usage_result = supabase_client.table("usage_monthly").select(
            "*"
        ).eq("org_id", current_org["id"]).eq("month_ym", month).single().execute()
        
        usage_data = usage_result.data if usage_result.data else {
            "tokens_input": 0,
            "tokens_output": 0,
            "documents_added": 0,
            "storage_bytes": 0
        }
        
        # Get current document count
        doc_count_result = supabase_client.table("documents").select(
            "id", count="exact"
        ).eq("organization_id", current_org["id"]).execute()
        current_documents = doc_count_result.count or 0
        
        # Get current user count
        user_count_result = supabase_client.table("organization_members").select(
            "id", count="exact"
        ).eq("organization_id", current_org["id"]).eq("status", "active").execute()
        current_users = user_count_result.count or 0
        
        # Calculate quotas
        total_tokens = usage_data.get("tokens_input", 0) + usage_data.get("tokens_output", 0)
        storage_mb = usage_data.get("storage_bytes", 0) / (1024 * 1024)
        
        def create_quota(resource: str, current: int, limit: int) -> UsageQuota:
            percentage = (current / limit * 100) if limit > 0 else 0
            return UsageQuota(
                resource=resource,
                current=current,
                limit=limit,
                percentage=percentage,
                exceeded=current >= limit
            )
        
        summary = UsageSummary(
            organization_id=current_org["id"],
            period=month,
            documents=create_quota("documents", current_documents, limits.get("document_limit", 100)),
            tokens=create_quota("tokens", total_tokens, limits.get("token_limit_month", 200000)),
            storage=create_quota("storage", int(storage_mb), limits.get("max_storage_mb", 1000)),
            users=create_quota("users", current_users, limits.get("max_users", 5)),
            updated_at=datetime.utcnow()
        )
        
        return summary
        
    except Exception as e:
        logger.error(f"Error getting usage summary: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get usage summary"
        )

@router.get("/metrics", response_model=UsageMetrics)
async def get_usage_metrics(
    current_user: dict = Depends(require_auth),
    current_org: dict = Depends(get_current_organization),
    _: None = Depends(require_permission_dep("usage", "view"))
):
    """Get comprehensive usage metrics for the current month."""
    try:
        current_month = datetime.now().strftime("%Y%m")
        
        # Get analytics data
        analytics_result = supabase_client.table("analytics_daily_enhanced").select(
            "*"
        ).eq("organization_id", current_org["id"]).gte(
            "date", datetime.now().replace(day=1).date().isoformat()
        ).execute()
        
        # Aggregate metrics
        total_queries = sum(row.get("total_queries", 0) for row in analytics_result.data)
        unique_users = len(set(row.get("unique_users", 0) for row in analytics_result.data))
        successful_queries = sum(row.get("successful_queries", 0) for row in analytics_result.data)
        failed_queries = sum(row.get("failed_queries", 0) for row in analytics_result.data)
        
        # Calculate average response time
        response_times = [row.get("avg_response_time", 0) for row in analytics_result.data if row.get("avg_response_time")]
        avg_response_time = sum(response_times) / len(response_times) if response_times else 0
        
        # Get documents processed this month
        usage_result = supabase_client.table("usage_monthly").select(
            "documents_added"
        ).eq("org_id", current_org["id"]).eq("month_ym", current_month).single().execute()
        
        documents_processed = usage_result.data.get("documents_added", 0) if usage_result.data else 0
        
        return UsageMetrics(
            total_queries_month=total_queries,
            unique_users_month=unique_users,
            avg_response_time_month=avg_response_time,
            successful_queries_month=successful_queries,
            failed_queries_month=failed_queries,
            documents_processed_month=documents_processed
        )
        
    except Exception as e:
        logger.error(f"Error getting usage metrics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get usage metrics"
        )

# =============================================================================
# TOKEN USAGE ANALYTICS
# =============================================================================

@router.get("/tokens/daily", response_model=List[TokenUsageDaily])
async def get_daily_token_usage(
    days: int = Query(30, ge=1, le=90, description="Number of days to fetch"),
    current_user: dict = Depends(require_auth),
    current_org: dict = Depends(get_current_organization),
    _: None = Depends(require_permission_dep("usage", "view"))
):
    """Get daily token usage for the specified period."""
    try:
        # Calculate date range
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=days-1)
        
        # Get daily analytics
        analytics_result = supabase_client.table("analytics_daily_enhanced").select(
            "date, token_cost_cents"
        ).eq("organization_id", current_org["id"]).gte(
            "date", start_date.isoformat()
        ).lte("date", end_date.isoformat()).order("date").execute()
        
        # For now, we'll estimate token usage from cost
        # In a real implementation, you'd track actual token usage
        daily_usage = []
        for row in analytics_result.data:
            # Rough estimation: 1 cent = ~100 tokens (varies by model)
            cost_cents = row.get("token_cost_cents", 0)
            estimated_tokens = cost_cents * 100
            
            daily_usage.append(TokenUsageDaily(
                date=row["date"],
                tokens_input=int(estimated_tokens * 0.6),  # Estimate 60% input
                tokens_output=int(estimated_tokens * 0.4),  # Estimate 40% output
                total_tokens=estimated_tokens,
                cost_estimate_cents=cost_cents
            ))
        
        return daily_usage
        
    except Exception as e:
        logger.error(f"Error getting daily token usage: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get token usage data"
        )

# =============================================================================
# QUERY ANALYTICS
# =============================================================================

@router.get("/queries/popular", response_model=List[PopularQuery])
async def get_popular_queries(
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(require_auth),
    current_org: dict = Depends(get_current_organization),
    _: None = Depends(require_permission_dep("usage", "view"))
):
    """Get most popular queries for the organization."""
    try:
        # Get query analytics if table exists
        try:
            result = supabase_client.table("query_analytics").select(
                "*"
            ).eq("organization_id", current_org["id"]).order(
                "execution_count", desc=True
            ).limit(limit).execute()
            
            popular_queries = []
            for row in result.data:
                popular_queries.append(PopularQuery(
                    query_text=row["query_text"][:100] + "..." if len(row["query_text"]) > 100 else row["query_text"],
                    execution_count=row["execution_count"],
                    avg_response_time=row.get("avg_response_time", 0),
                    avg_satisfaction=row.get("avg_satisfaction"),
                    last_executed=datetime.fromisoformat(row["last_executed"])
                ))
            
            return popular_queries
            
        except Exception:
            # Table might not exist yet, return empty list
            return []
        
    except Exception as e:
        logger.error(f"Error getting popular queries: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get query analytics"
        )

@router.get("/queries/unanswered", response_model=List[dict])
async def get_unanswered_queries(
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(require_auth),
    current_org: dict = Depends(get_current_organization),
    _: None = Depends(require_permission_dep("usage", "view"))
):
    """Get queries that failed or had low satisfaction scores."""
    try:
        # Get failed queries from analytics
        result = supabase_client.table("analytics_daily_enhanced").select(
            "*"
        ).eq("organization_id", current_org["id"]).gt(
            "failed_queries", 0
        ).order("date", desc=True).limit(limit).execute()
        
        # This is a simplified implementation
        # In practice, you'd want to track individual failed queries
        unanswered = []
        for row in result.data:
            if row.get("failed_queries", 0) > 0:
                unanswered.append({
                    "date": row["date"],
                    "failed_count": row["failed_queries"],
                    "success_rate": (row.get("successful_queries", 0) / 
                                   (row.get("total_queries", 1))) * 100
                })
        
        return unanswered
        
    except Exception as e:
        logger.error(f"Error getting unanswered queries: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get unanswered queries"
        )

# =============================================================================
# EXPORT FUNCTIONALITY
# =============================================================================

@router.get("/export/csv")
async def export_usage_csv(
    start_date: str = Query(..., description="Start date YYYY-MM-DD"),
    end_date: str = Query(..., description="End date YYYY-MM-DD"),
    current_user: dict = Depends(require_auth),
    current_org: dict = Depends(get_current_organization),
    _: None = Depends(require_permission_dep("usage", "view"))
):
    """Export usage data as CSV (admin only)."""
    from app.utils.permissions import is_admin
    
    # Check admin permission
    if not await is_admin(current_user["id"], current_org["id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required for data export"
        )
    
    try:
        # Get analytics data for the period
        result = supabase_client.table("analytics_daily_enhanced").select(
            "*"
        ).eq("organization_id", current_org["id"]).gte(
            "date", start_date
        ).lte("date", end_date).order("date").execute()
        
        # Generate CSV content
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            "Date", "Total Queries", "Unique Users", "Successful Queries",
            "Failed Queries", "Avg Response Time", "Avg Satisfaction",
            "Total Cost Cents"
        ])
        
        # Write data
        for row in result.data:
            writer.writerow([
                row.get("date", ""),
                row.get("total_queries", 0),
                row.get("unique_users", 0),
                row.get("successful_queries", 0),
                row.get("failed_queries", 0),
                row.get("avg_response_time", 0),
                row.get("avg_satisfaction", 0),
                row.get("total_cost_cents", 0)
            ])
        
        csv_content = output.getvalue()
        output.close()
        
        from fastapi.responses import Response
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=usage_export_{start_date}_{end_date}.csv"
            }
        )
        
    except Exception as e:
        logger.error(f"Error exporting usage CSV: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to export usage data"
        )