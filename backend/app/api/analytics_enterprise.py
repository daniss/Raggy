"""
Enhanced analytics and reporting API endpoints.
Provides comprehensive analytics, insights, and reporting for enterprise dashboard.
"""
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import text

from app.models.enterprise_schemas import (
    AnalyticsDashboard, AnalyticsPeriod, DailyAnalytics,
    UsageMetrics, CostMetrics, QualityMetrics,
    SuccessResponse, PaginatedResponse
)
from app.core.deps_enterprise import get_current_user, get_current_organization
from app.utils.permissions import check_permission
from app.db.supabase_client import supabase_client
from app.core.config import settings

router = APIRouter(prefix="/analytics", tags=["analytics"])
logger = logging.getLogger(__name__)

# =============================================================================
# DASHBOARD OVERVIEW
# =============================================================================

@router.get("/dashboard", response_model=AnalyticsDashboard)
async def get_analytics_dashboard(
    period: AnalyticsPeriod = Query(AnalyticsPeriod.LAST_30_DAYS, description="Analytics period"),
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get comprehensive analytics dashboard data."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "analytics", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Calculate date range
        end_date = date.today()
        days = {
            AnalyticsPeriod.LAST_7_DAYS: 7,
            AnalyticsPeriod.LAST_30_DAYS: 30,
            AnalyticsPeriod.LAST_90_DAYS: 90,
            AnalyticsPeriod.LAST_YEAR: 365
        }[period]
        start_date = end_date - timedelta(days=days)
        
        # Get daily analytics data
        daily_analytics = await _get_daily_analytics(current_org["id"], start_date, end_date)
        
        # Calculate summary metrics
        summary = await _calculate_summary_metrics(current_org["id"], start_date, end_date)
        
        # Get top queries
        top_queries = await _get_top_queries(current_org["id"], start_date, end_date, limit=10)
        
        # Get user satisfaction data
        satisfaction = await _get_satisfaction_metrics(current_org["id"], start_date, end_date)
        
        # Get cost breakdown
        cost_breakdown = await _get_cost_breakdown(current_org["id"], start_date, end_date)
        
        return AnalyticsDashboard(
            organization_id=current_org["id"],
            period=period,
            summary=summary,
            daily_data=daily_analytics,
            top_queries=top_queries,
            user_satisfaction=satisfaction,
            cost_breakdown=cost_breakdown,
            generated_at=datetime.utcnow()
        )
        
    except Exception as e:
        logger.error(f"Error getting analytics dashboard: {e}")
        raise HTTPException(status_code=500, detail="Failed to get analytics data")

@router.get("/usage", response_model=Dict[str, Any])
async def get_usage_analytics(
    days: int = Query(30, ge=1, le=365, description="Number of days"),
    granularity: str = Query("daily", description="Data granularity"),
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get usage analytics with different granularities."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "analytics", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        
        if granularity == "hourly" and days > 7:
            raise HTTPException(status_code=400, detail="Hourly granularity limited to 7 days")
        
        # Get usage data based on granularity
        if granularity == "hourly":
            usage_data = await _get_hourly_usage(current_org["id"], start_date, end_date)
        elif granularity == "weekly":
            usage_data = await _get_weekly_usage(current_org["id"], start_date, end_date)
        elif granularity == "monthly":
            usage_data = await _get_monthly_usage(current_org["id"], start_date, end_date)
        else:  # daily
            usage_data = await _get_daily_usage(current_org["id"], start_date, end_date)
        
        # Calculate trends
        trends = await _calculate_usage_trends(usage_data)
        
        return {
            "organization_id": current_org["id"],
            "period": {"start": start_date, "end": end_date, "days": days},
            "granularity": granularity,
            "data": usage_data,
            "trends": trends,
            "generated_at": datetime.utcnow()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting usage analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get usage analytics")

# =============================================================================
# QUERY ANALYTICS
# =============================================================================

@router.get("/queries", response_model=Dict[str, Any])
async def get_query_analytics(
    days: int = Query(30, ge=1, le=365, description="Number of days"),
    limit: int = Query(50, ge=1, le=100, description="Number of top queries"),
    include_failed: bool = Query(False, description="Include failed queries"),
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get detailed query analytics."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "analytics", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        
        # Get query analytics from database
        query_result = supabase_client.table("query_analytics").select(
            "query_text, query_category, execution_count, avg_response_time, avg_satisfaction, last_executed"
        ).eq("organization_id", current_org["id"]).gte("last_executed", start_date.isoformat()).order(
            "execution_count", desc=True
        ).limit(limit).execute()
        
        # Get query performance over time
        performance_result = supabase_client.table("chat_logs").select(
            "question, response_time, satisfaction_rating, created_at"
        ).eq("organization_id", current_org["id"]).gte(
            "created_at", start_date.isoformat()
        ).order("created_at", desc=True).execute()
        
        # Process and categorize queries
        top_queries = query_result.data or []
        
        # Calculate query categories distribution
        categories = {}
        for query in top_queries:
            category = query.get("query_category", "uncategorized")
            categories[category] = categories.get(category, 0) + query["execution_count"]
        
        # Calculate performance trends
        performance_trends = await _calculate_query_performance_trends(performance_result.data or [])
        
        # Get failure analysis if requested
        failure_analysis = {}
        if include_failed:
            failure_analysis = await _get_query_failure_analysis(current_org["id"], start_date, end_date)
        
        return {
            "organization_id": current_org["id"],
            "period": {"start": start_date, "end": end_date, "days": days},
            "top_queries": top_queries,
            "categories": categories,
            "performance_trends": performance_trends,
            "failure_analysis": failure_analysis,
            "total_queries": sum(q["execution_count"] for q in top_queries),
            "generated_at": datetime.utcnow()
        }
        
    except Exception as e:
        logger.error(f"Error getting query analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get query analytics")

@router.get("/queries/topics", response_model=Dict[str, Any])
async def get_topic_analysis(
    days: int = Query(30, ge=1, le=365, description="Number of days"),
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get topic analysis and clustering of queries."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "analytics", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        
        # Get conversation metadata with topics
        topics_result = supabase_client.table("conversation_metadata").select(
            "topic, COUNT(*) as count"
        ).eq("organization_id", current_org["id"]).gte(
            "updated_at", start_date.isoformat()
        ).not_.is_("topic", "null").group("topic").order("count", desc=True).execute()
        
        # Get intent analysis
        intents_result = supabase_client.table("conversation_metadata").select(
            "intent, COUNT(*) as count"
        ).eq("organization_id", current_org["id"]).gte(
            "updated_at", start_date.isoformat()
        ).not_.is_("intent", "null").group("intent").order("count", desc=True).execute()
        
        # Simple keyword extraction from recent queries
        keywords = await _extract_query_keywords(current_org["id"], start_date, end_date)
        
        return {
            "organization_id": current_org["id"],
            "period": {"start": start_date, "end": end_date, "days": days},
            "topics": topics_result.data or [],
            "intents": intents_result.data or [],
            "keywords": keywords,
            "generated_at": datetime.utcnow()
        }
        
    except Exception as e:
        logger.error(f"Error getting topic analysis: {e}")
        raise HTTPException(status_code=500, detail="Failed to get topic analysis")

# =============================================================================
# USER AND SATISFACTION ANALYTICS
# =============================================================================

@router.get("/satisfaction", response_model=Dict[str, Any])
async def get_satisfaction_analytics(
    days: int = Query(30, ge=1, le=365, description="Number of days"),
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get user satisfaction analytics."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "analytics", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        
        # Get satisfaction ratings distribution
        ratings_result = supabase_client.table("chat_logs").select(
            "satisfaction_rating, COUNT(*) as count"
        ).eq("organization_id", current_org["id"]).gte(
            "created_at", start_date.isoformat()
        ).not_.is_("satisfaction_rating", "null").group("satisfaction_rating").execute()
        
        # Get satisfaction trends over time
        trends_result = supabase_client.table("analytics_daily_enhanced").select(
            "date, avg_satisfaction"
        ).eq("organization_id", current_org["id"]).gte("date", start_date).order("date").execute()
        
        # Get feedback analysis
        feedback_result = supabase_client.table("conversation_metadata").select(
            "feedback, feedback_tags"
        ).eq("organization_id", current_org["id"]).not_.is_("feedback", "null").gte(
            "updated_at", start_date.isoformat()
        ).execute()
        
        # Process feedback tags
        tag_counts = {}
        for feedback in feedback_result.data or []:
            for tag in feedback.get("feedback_tags", []):
                tag_counts[tag] = tag_counts.get(tag, 0) + 1
        
        # Calculate satisfaction metrics
        ratings_data = ratings_result.data or []
        total_ratings = sum(item["count"] for item in ratings_data)
        avg_rating = sum(item["satisfaction_rating"] * item["count"] for item in ratings_data) / total_ratings if total_ratings > 0 else 0
        
        return {
            "organization_id": current_org["id"],
            "period": {"start": start_date, "end": end_date, "days": days},
            "summary": {
                "average_rating": round(avg_rating, 2),
                "total_ratings": total_ratings,
                "positive_percentage": sum(item["count"] for item in ratings_data if item["satisfaction_rating"] >= 4) / total_ratings * 100 if total_ratings > 0 else 0
            },
            "ratings_distribution": ratings_data,
            "satisfaction_trends": trends_result.data or [],
            "feedback_tags": dict(sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:20]),
            "generated_at": datetime.utcnow()
        }
        
    except Exception as e:
        logger.error(f"Error getting satisfaction analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get satisfaction analytics")

# =============================================================================
# COST AND PERFORMANCE ANALYTICS
# =============================================================================

@router.get("/costs", response_model=Dict[str, Any])
async def get_cost_analytics(
    days: int = Query(30, ge=1, le=365, description="Number of days"),
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get cost analytics and optimization insights."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "billing", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        
        # Get usage tracking data
        usage_result = supabase_client.table("usage_tracking").select(
            "*"
        ).eq("organization_id", current_org["id"]).gte("period_start", start_date).execute()
        
        # Get message-level cost data
        message_costs = supabase_client.table("message_analytics").select(
            "cost_cents, tokens_used, created_at"
        ).eq("organization_id", current_org["id"]).gte("created_at", start_date.isoformat()).execute()
        
        # Calculate cost breakdown
        total_cost = sum(usage["total_cost_cents"] for usage in usage_result.data or [])
        token_cost = sum(usage["token_cost_cents"] for usage in usage_result.data or [])
        storage_cost = sum(usage["storage_cost_cents"] for usage in usage_result.data or [])
        embedding_cost = sum(usage.get("embedding_cost_cents", 0) for usage in usage_result.data or [])
        
        # Calculate cost per query
        total_queries = len(message_costs.data or [])
        cost_per_query = total_cost / total_queries if total_queries > 0 else 0
        
        # Get cost trends
        cost_trends = []
        for usage in usage_result.data or []:
            cost_trends.append({
                "date": usage["period_start"],
                "total_cost_cents": usage["total_cost_cents"],
                "token_cost_cents": usage["token_cost_cents"],
                "storage_cost_cents": usage["storage_cost_cents"]
            })
        
        # Calculate optimization recommendations
        recommendations = await _get_cost_optimization_recommendations(current_org["id"], usage_result.data or [])
        
        return {
            "organization_id": current_org["id"],
            "period": {"start": start_date, "end": end_date, "days": days},
            "summary": {
                "total_cost_cents": total_cost,
                "cost_per_query_cents": round(cost_per_query, 2),
                "total_queries": total_queries
            },
            "breakdown": {
                "tokens": token_cost,
                "storage": storage_cost,
                "embeddings": embedding_cost,
                "other": total_cost - token_cost - storage_cost - embedding_cost
            },
            "trends": sorted(cost_trends, key=lambda x: x["date"]),
            "recommendations": recommendations,
            "generated_at": datetime.utcnow()
        }
        
    except Exception as e:
        logger.error(f"Error getting cost analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get cost analytics")

@router.get("/performance", response_model=Dict[str, Any])
async def get_performance_analytics(
    days: int = Query(30, ge=1, le=365, description="Number of days"),
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get performance analytics and system health metrics."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "analytics", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        
        # Get message analytics for performance data
        performance_result = supabase_client.table("message_analytics").select(
            "processing_time, embedding_time, retrieval_time, generation_time, relevance_score, confidence_score, created_at"
        ).eq("organization_id", current_org["id"]).gte("created_at", start_date.isoformat()).execute()
        
        # Get daily performance trends
        daily_performance = supabase_client.table("analytics_daily_enhanced").select(
            "date, avg_response_time"
        ).eq("organization_id", current_org["id"]).gte("date", start_date).order("date").execute()
        
        performance_data = performance_result.data or []
        
        # Calculate performance metrics
        if performance_data:
            avg_processing_time = sum(p.get("processing_time", 0) for p in performance_data) / len(performance_data)
            avg_embedding_time = sum(p.get("embedding_time", 0) for p in performance_data if p.get("embedding_time")) / len([p for p in performance_data if p.get("embedding_time")]) if any(p.get("embedding_time") for p in performance_data) else 0
            avg_retrieval_time = sum(p.get("retrieval_time", 0) for p in performance_data if p.get("retrieval_time")) / len([p for p in performance_data if p.get("retrieval_time")]) if any(p.get("retrieval_time") for p in performance_data) else 0
            avg_generation_time = sum(p.get("generation_time", 0) for p in performance_data if p.get("generation_time")) / len([p for p in performance_data if p.get("generation_time")]) if any(p.get("generation_time") for p in performance_data) else 0
            
            avg_relevance = sum(p.get("relevance_score", 0) for p in performance_data if p.get("relevance_score")) / len([p for p in performance_data if p.get("relevance_score")]) if any(p.get("relevance_score") for p in performance_data) else 0
            avg_confidence = sum(p.get("confidence_score", 0) for p in performance_data if p.get("confidence_score")) / len([p for p in performance_data if p.get("confidence_score")]) if any(p.get("confidence_score") for p in performance_data) else 0
        else:
            avg_processing_time = avg_embedding_time = avg_retrieval_time = avg_generation_time = 0
            avg_relevance = avg_confidence = 0
        
        # Identify bottlenecks
        bottlenecks = []
        if avg_embedding_time > avg_processing_time * 0.3:
            bottlenecks.append("Embedding generation is slow")
        if avg_retrieval_time > avg_processing_time * 0.4:
            bottlenecks.append("Document retrieval is slow")
        if avg_generation_time > avg_processing_time * 0.5:
            bottlenecks.append("Text generation is slow")
        
        return {
            "organization_id": current_org["id"],
            "period": {"start": start_date, "end": end_date, "days": days},
            "summary": {
                "avg_processing_time": round(avg_processing_time, 3),
                "avg_relevance_score": round(avg_relevance, 3),
                "avg_confidence_score": round(avg_confidence, 3),
                "total_requests": len(performance_data)
            },
            "breakdown": {
                "embedding_time": round(avg_embedding_time, 3),
                "retrieval_time": round(avg_retrieval_time, 3),
                "generation_time": round(avg_generation_time, 3)
            },
            "trends": daily_performance.data or [],
            "bottlenecks": bottlenecks,
            "generated_at": datetime.utcnow()
        }
        
    except Exception as e:
        logger.error(f"Error getting performance analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get performance analytics")

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

async def _get_daily_analytics(org_id: str, start_date: date, end_date: date) -> List[DailyAnalytics]:
    """Get daily analytics data."""
    try:
        result = supabase_client.table("analytics_daily_enhanced").select(
            "*"
        ).eq("organization_id", org_id).gte("date", start_date).lte("date", end_date).order("date").execute()
        
        daily_data = []
        for row in result.data or []:
            daily_data.append(DailyAnalytics(
                date=datetime.strptime(row["date"], "%Y-%m-%d").date(),
                organization_id=row["organization_id"],
                usage=UsageMetrics(
                    total_queries=row.get("total_queries", 0),
                    unique_users=row.get("unique_users", 0),
                    avg_response_time=row.get("avg_response_time", 0),
                    successful_queries=row.get("successful_queries", 0),
                    failed_queries=row.get("failed_queries", 0),
                    avg_satisfaction=row.get("avg_satisfaction")
                ),
                costs=CostMetrics(
                    total_cost_cents=row.get("total_cost_cents", 0),
                    token_cost_cents=row.get("token_cost_cents", 0),
                    storage_cost_cents=row.get("storage_cost_cents", 0),
                    embedding_cost_cents=row.get("embedding_cost_cents", 0)
                ),
                quality=QualityMetrics(
                    avg_relevance_score=row.get("avg_relevance_score"),
                    avg_confidence_score=row.get("avg_confidence_score"),
                    pii_incidents=row.get("pii_incidents", 0),
                    flagged_conversations=row.get("flagged_conversations", 0)
                )
            ))
        
        return daily_data
        
    except Exception as e:
        logger.error(f"Error getting daily analytics: {e}")
        return []

async def _calculate_summary_metrics(org_id: str, start_date: date, end_date: date) -> Dict[str, Any]:
    """Calculate summary metrics for the dashboard."""
    try:
        # Get aggregated data
        result = supabase_client.table("analytics_daily_enhanced").select(
            "SUM(total_queries) as total_queries, SUM(unique_users) as total_users, AVG(avg_response_time) as avg_response_time, SUM(total_cost_cents) as total_cost"
        ).eq("organization_id", org_id).gte("date", start_date).lte("date", end_date).execute()
        
        if result.data and result.data[0]:
            data = result.data[0]
            return {
                "total_queries": data.get("total_queries", 0),
                "unique_users": data.get("total_users", 0),
                "avg_response_time": round(data.get("avg_response_time", 0), 2),
                "total_cost_cents": data.get("total_cost", 0)
            }
        
        return {
            "total_queries": 0,
            "unique_users": 0,
            "avg_response_time": 0,
            "total_cost_cents": 0
        }
        
    except Exception as e:
        logger.error(f"Error calculating summary metrics: {e}")
        return {}

async def _get_top_queries(org_id: str, start_date: date, end_date: date, limit: int = 10) -> List[Dict[str, Any]]:
    """Get top queries for the period."""
    try:
        result = supabase_client.table("query_analytics").select(
            "*"
        ).eq("organization_id", org_id).gte("last_executed", start_date.isoformat()).order(
            "execution_count", desc=True
        ).limit(limit).execute()
        
        return result.data or []
        
    except Exception as e:
        logger.error(f"Error getting top queries: {e}")
        return []

async def _get_satisfaction_metrics(org_id: str, start_date: date, end_date: date) -> Dict[str, Any]:
    """Get user satisfaction metrics."""
    try:
        result = supabase_client.table("analytics_daily_enhanced").select(
            "AVG(avg_satisfaction) as overall_satisfaction"
        ).eq("organization_id", org_id).gte("date", start_date).lte("date", end_date).execute()
        
        satisfaction_data = result.data[0] if result.data else {}
        
        return {
            "average_rating": round(satisfaction_data.get("overall_satisfaction", 0), 2),
            "trend": "stable"  # Could be calculated from daily trends
        }
        
    except Exception as e:
        logger.error(f"Error getting satisfaction metrics: {e}")
        return {}

async def _get_cost_breakdown(org_id: str, start_date: date, end_date: date) -> Dict[str, Any]:
    """Get cost breakdown for the period."""
    try:
        result = supabase_client.table("usage_tracking").select(
            "SUM(total_cost_cents) as total, SUM(token_cost_cents) as tokens, SUM(storage_cost_cents) as storage"
        ).eq("organization_id", org_id).gte("period_start", start_date).execute()
        
        cost_data = result.data[0] if result.data else {}
        
        return {
            "total_cents": cost_data.get("total", 0),
            "breakdown": {
                "tokens": cost_data.get("tokens", 0),
                "storage": cost_data.get("storage", 0)
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting cost breakdown: {e}")
        return {}

async def _get_daily_usage(org_id: str, start_date: date, end_date: date) -> List[Dict[str, Any]]:
    """Get daily usage data."""
    try:
        result = supabase_client.table("analytics_daily_enhanced").select(
            "date, total_queries, unique_users, avg_response_time"
        ).eq("organization_id", org_id).gte("date", start_date).lte("date", end_date).order("date").execute()
        
        return result.data or []
        
    except Exception as e:
        logger.error(f"Error getting daily usage: {e}")
        return []

async def _calculate_usage_trends(usage_data: List[Dict[str, Any]]) -> Dict[str, float]:
    """Calculate usage trends from data."""
    if len(usage_data) < 2:
        return {"queries": 0, "users": 0, "response_time": 0}
    
    # Simple trend calculation (percentage change from first to last period)
    first_period = usage_data[0]
    last_period = usage_data[-1]
    
    trends = {}
    for metric in ["total_queries", "unique_users", "avg_response_time"]:
        first_val = first_period.get(metric, 0)
        last_val = last_period.get(metric, 0)
        
        if first_val > 0:
            trends[metric.replace("total_", "").replace("avg_", "")] = ((last_val - first_val) / first_val) * 100
        else:
            trends[metric.replace("total_", "").replace("avg_", "")] = 0
    
    return trends

async def _get_cost_optimization_recommendations(org_id: str, usage_data: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    """Generate cost optimization recommendations."""
    recommendations = []
    
    if not usage_data:
        return recommendations
    
    # Calculate averages
    total_cost = sum(u.get("total_cost_cents", 0) for u in usage_data)
    total_tokens = sum(u.get("tokens_used", 0) for u in usage_data)
    
    if total_tokens > 0:
        cost_per_token = total_cost / total_tokens
        
        # High cost per token
        if cost_per_token > 0.01:  # Example threshold
            recommendations.append({
                "type": "cost_optimization",
                "priority": "high",
                "title": "Optimize prompt templates",
                "description": "Your cost per token is high. Consider optimizing prompt templates and reducing context size."
            })
    
    # High storage usage
    storage_cost = sum(u.get("storage_cost_cents", 0) for u in usage_data)
    if storage_cost > total_cost * 0.3:
        recommendations.append({
            "type": "storage_optimization",
            "priority": "medium", 
            "title": "Review document retention",
            "description": "Storage costs are significant. Consider implementing document lifecycle policies."
        })
    
    return recommendations

async def _calculate_query_performance_trends(performance_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate query performance trends."""
    if not performance_data:
        return {}
    
    # Group by day and calculate averages
    daily_performance = {}
    for record in performance_data:
        date_key = record["created_at"][:10]  # Extract date part
        if date_key not in daily_performance:
            daily_performance[date_key] = {"response_times": [], "ratings": []}
        
        if record.get("response_time"):
            daily_performance[date_key]["response_times"].append(record["response_time"])
        if record.get("satisfaction_rating"):
            daily_performance[date_key]["ratings"].append(record["satisfaction_rating"])
    
    # Calculate daily averages
    trends = []
    for date_key, data in sorted(daily_performance.items()):
        avg_response_time = sum(data["response_times"]) / len(data["response_times"]) if data["response_times"] else 0
        avg_rating = sum(data["ratings"]) / len(data["ratings"]) if data["ratings"] else 0
        
        trends.append({
            "date": date_key,
            "avg_response_time": round(avg_response_time, 2),
            "avg_rating": round(avg_rating, 2),
            "query_count": len(data["response_times"])
        })
    
    return {"daily_trends": trends}

async def _get_query_failure_analysis(org_id: str, start_date: date, end_date: date) -> Dict[str, Any]:
    """Get query failure analysis."""
    try:
        # Get failed queries (where response_time is null or very high)
        failed_result = supabase_client.table("chat_logs").select(
            "question, error_message, created_at"
        ).eq("organization_id", org_id).is_("response_time", "null").gte(
            "created_at", start_date.isoformat()
        ).execute()
        
        failures = failed_result.data or []
        
        # Categorize failures
        error_categories = {}
        for failure in failures:
            error_msg = failure.get("error_message", "Unknown error")
            # Simple categorization - could be more sophisticated
            if "timeout" in error_msg.lower():
                category = "timeout"
            elif "rate limit" in error_msg.lower():
                category = "rate_limit"
            elif "authentication" in error_msg.lower():
                category = "auth_error"
            else:
                category = "other"
            
            error_categories[category] = error_categories.get(category, 0) + 1
        
        return {
            "total_failures": len(failures),
            "error_categories": error_categories,
            "recent_failures": failures[-10:]  # Last 10 failures
        }
        
    except Exception as e:
        logger.error(f"Error getting failure analysis: {e}")
        return {}

async def _extract_query_keywords(org_id: str, start_date: date, end_date: date) -> List[Dict[str, Any]]:
    """Extract and count keywords from recent queries."""
    try:
        # Get recent queries
        queries_result = supabase_client.table("chat_logs").select(
            "question"
        ).eq("organization_id", org_id).gte("created_at", start_date.isoformat()).execute()
        
        # Simple keyword extraction (could use NLP libraries for better results)
        word_counts = {}
        stopwords = {"le", "la", "les", "un", "une", "de", "du", "des", "et", "ou", "est", "dans", "pour", "avec", "sur", "par", "ce", "cette", "ces", "que", "qui", "quoi", "comment", "pourquoi", "où", "quand"}
        
        for query in queries_result.data or []:
            words = query["question"].lower().split()
            for word in words:
                # Clean word
                word = ''.join(c for c in word if c.isalnum())
                if len(word) > 2 and word not in stopwords:
                    word_counts[word] = word_counts.get(word, 0) + 1
        
        # Return top keywords
        top_keywords = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)[:20]
        return [{"word": word, "count": count} for word, count in top_keywords]
        
    except Exception as e:
        logger.error(f"Error extracting keywords: {e}")
        return []