import logging
from typing import Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query
from app.models.schemas import AnalyticsResponse
from app.core.deps import get_current_user, get_current_organization
from app.db.supabase_client import get_analytics_data, supabase_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/", response_model=AnalyticsResponse)
async def get_analytics(
    days: int = Query(default=30, ge=1, le=365, description="Number of days to analyze"),
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """
    Get analytics data for chat interactions.
    """
    try:
        logger.info(f"Fetching analytics for {days} days")
        
        # Get analytics data from Supabase (organization-scoped)
        analytics = await get_analytics_data(days, organization_id=current_org["id"])
        
        # Get time-series data for the specified period
        time_series_data = await get_time_series_analytics(days, current_user, current_org)
        
        # Get popular topics
        popular_topics_result = await get_popular_topics(days, current_user=current_user, current_org=current_org)
        
        return AnalyticsResponse(
            total_queries=analytics.get("total_queries", 0),
            avg_response_time=analytics.get("avg_response_time", 0.0),
            recent_queries=analytics.get("recent_queries", []),
            popular_topics=popular_topics_result.get("topics", [])
        )
        
    except Exception as e:
        logger.error(f"Failed to get analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve analytics data")


@router.get("/time-series")
async def get_time_series_analytics(
    days: int = Query(default=7, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
) -> Dict[str, Any]:
    """
    Get time-series analytics data for charts.
    """
    try:
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Query Supabase for time-series data (organization-scoped)
        result = supabase_client.table("chat_logs").select(
            "created_at, response_time"
        ).gte("created_at", start_date.isoformat()).lte(
            "created_at", end_date.isoformat()
        ).eq("organization_id", current_org["id"]).order("created_at").execute()
        
        # Process data for time-series visualization
        daily_stats = {}
        for log in result.data:
            date_key = log["created_at"][:10]  # Extract date part
            if date_key not in daily_stats:
                daily_stats[date_key] = {
                    "date": date_key,
                    "queries": 0,
                    "total_response_time": 0,
                    "avg_response_time": 0
                }
            
            daily_stats[date_key]["queries"] += 1
            daily_stats[date_key]["total_response_time"] += log.get("response_time", 0)
        
        # Calculate averages
        for stats in daily_stats.values():
            if stats["queries"] > 0:
                stats["avg_response_time"] = stats["total_response_time"] / stats["queries"]
        
        return {
            "time_series": list(daily_stats.values()),
            "total_days": days,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to get time-series analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve time-series data")


@router.get("/popular-topics")
async def get_popular_topics(
    days: int = Query(default=30, ge=1, le=365),
    limit: int = Query(default=10, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
) -> Dict[str, Any]:
    """
    Get popular topics based on question analysis.
    """
    try:
        # Calculate date range
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Query recent questions (organization-scoped)
        result = supabase_client.table("chat_logs").select(
            "question, created_at"
        ).gte("created_at", start_date.isoformat()).lte(
            "created_at", end_date.isoformat()
        ).eq("organization_id", current_org["id"]).limit(1000).execute()
        
        # Simple keyword extraction (in production, use NLP)
        keyword_counts = {}
        common_words = {
            "comment", "que", "est", "une", "un", "le", "la", "les", "de", "du", "des",
            "pour", "avec", "dans", "sur", "par", "à", "au", "aux", "et", "ou", "mais",
            "si", "car", "donc", "puis", "alors", "ainsi", "cependant", "toutefois"
        }
        
        for log in result.data:
            question = log.get("question", "").lower()
            words = question.split()
            
            for word in words:
                word = word.strip(".,!?;:\"'()[]{}").lower()
                if len(word) > 3 and word not in common_words:
                    keyword_counts[word] = keyword_counts.get(word, 0) + 1
        
        # Sort by frequency and take top items
        popular_topics = [
            {"topic": word, "count": count}
            for word, count in sorted(keyword_counts.items(), key=lambda x: x[1], reverse=True)[:limit]
        ]
        
        return {
            "topics": popular_topics,
            "analyzed_questions": len(result.data),
            "date_range": f"{start_date.date()} to {end_date.date()}"
        }
        
    except Exception as e:
        logger.error(f"Failed to get popular topics: {e}")
        return {"topics": [], "analyzed_questions": 0, "date_range": "N/A"}


@router.get("/user-satisfaction")
async def get_user_satisfaction(
    days: int = Query(default=30, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
) -> Dict[str, Any]:
    """
    Get user satisfaction metrics (placeholder for feedback system).
    """
    try:
        # This would integrate with a feedback system in production
        return {
            "satisfaction_score": 4.2,  # Out of 5
            "total_feedback": 125,
            "positive_feedback": 95,
            "negative_feedback": 30,
            "response_rate": 0.68,  # Percentage of users who provided feedback
            "message": "User satisfaction metrics require feedback system implementation"
        }
        
    except Exception as e:
        logger.error(f"Failed to get satisfaction metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve satisfaction data")


@router.get("/export")
async def export_analytics(
    format: str = Query(default="json", regex="^(json|csv)$"),
    days: int = Query(default=30, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
):
    """
    Export analytics data in specified format.
    """
    try:
        # Get all analytics data (organization-scoped)
        analytics = await get_analytics_data(days, organization_id=current_org["id"])
        time_series = await get_time_series_analytics(days, current_user, current_org)
        topics = await get_popular_topics(days, current_user=current_user, current_org=current_org)
        
        export_data = {
            "generated_at": datetime.utcnow().isoformat(),
            "period_days": days,
            "summary": analytics,
            "time_series": time_series,
            "popular_topics": topics
        }
        
        if format == "json":
            from fastapi.responses import JSONResponse
            return JSONResponse(
                content=export_data,
                headers={"Content-Disposition": "attachment; filename=analytics_export.json"}
            )
        
        elif format == "csv":
            # Convert to CSV format (simplified)
            import csv
            import io
            
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write header
            writer.writerow(["Metric", "Value"])
            writer.writerow(["Total Queries", analytics.get("total_queries", 0)])
            writer.writerow(["Avg Response Time", analytics.get("avg_response_time", 0)])
            
            # Write time series data
            writer.writerow([])
            writer.writerow(["Date", "Queries", "Avg Response Time"])
            for item in time_series.get("time_series", []):
                writer.writerow([item["date"], item["queries"], item["avg_response_time"]])
            
            from fastapi.responses import StreamingResponse
            output.seek(0)
            return StreamingResponse(
                io.BytesIO(output.getvalue().encode()),
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=analytics_export.csv"}
            )
        
    except Exception as e:
        logger.error(f"Failed to export analytics: {e}")
        raise HTTPException(status_code=500, detail="Export failed")