"""Advanced Analytics API with detailed metrics and insights."""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Query
from app.core.deps import get_current_user, get_current_organization
from app.db.supabase_client import supabase_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics/advanced", tags=["advanced-analytics"])


@router.get("/dashboard")
async def get_advanced_dashboard(
    days: int = Query(default=30, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
) -> Dict[str, Any]:
    """
    Get comprehensive analytics dashboard data.
    """
    try:
        logger.info(f"Fetching advanced analytics dashboard for {days} days")
        
        # Calculate date ranges
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        previous_start = start_date - timedelta(days=days)
        
        # Get conversation metrics
        conversations_result = supabase_client.table("conversations").select(
            "id, created_at, message_count, total_response_time"
        ).gte("created_at", start_date.isoformat()).eq(
            "organization_id", current_org["id"]
        ).execute()
        
        # Get chat logs for detailed analysis
        chat_logs_result = supabase_client.table("chat_logs").select(
            "question, answer, response_time, sources_count, created_at"
        ).gte("created_at", start_date.isoformat()).eq(
            "organization_id", current_org["id"]
        ).execute()
        
        # Get document usage
        documents_result = supabase_client.table("documents").select(
            "id, filename, content_type, size_bytes, created_at"
        ).eq("organization_id", current_org["id"]).execute()
        
        # Process conversation metrics
        total_conversations = len(conversations_result.data)
        total_messages = sum(conv.get("message_count", 0) for conv in conversations_result.data)
        avg_conversation_length = total_messages / total_conversations if total_conversations > 0 else 0
        
        # Process chat performance
        chat_logs = chat_logs_result.data
        total_queries = len(chat_logs)
        avg_response_time = sum(log.get("response_time", 0) for log in chat_logs) / total_queries if total_queries > 0 else 0
        avg_sources_per_query = sum(log.get("sources_count", 0) for log in chat_logs) / total_queries if total_queries > 0 else 0
        
        # Calculate user engagement metrics
        daily_usage = {}
        for log in chat_logs:
            date_key = log["created_at"][:10]
            daily_usage[date_key] = daily_usage.get(date_key, 0) + 1
        
        peak_usage_day = max(daily_usage.items(), key=lambda x: x[1]) if daily_usage else ("N/A", 0)
        avg_daily_queries = sum(daily_usage.values()) / len(daily_usage) if daily_usage else 0
        
        # Document insights
        documents = documents_result.data
        total_documents = len(documents)
        total_storage_mb = sum(doc.get("size_bytes", 0) for doc in documents) / (1024 * 1024)
        
        # File type distribution
        file_types = {}
        for doc in documents:
            content_type = doc.get("content_type", "unknown")
            file_types[content_type] = file_types.get(content_type, 0) + 1
        
        # Performance metrics
        fast_queries = len([log for log in chat_logs if log.get("response_time", 0) < 2.0])
        slow_queries = len([log for log in chat_logs if log.get("response_time", 0) > 5.0])
        performance_score = (fast_queries / total_queries * 100) if total_queries > 0 else 100
        
        # Query complexity analysis (simplified)
        short_queries = len([log for log in chat_logs if len(log.get("question", "").split()) <= 5])
        long_queries = len([log for log in chat_logs if len(log.get("question", "").split()) > 15])
        
        # Recent activity
        recent_conversations = sorted(
            conversations_result.data,
            key=lambda x: x["created_at"],
            reverse=True
        )[:10]
        
        # Quality metrics (simplified scoring)
        high_source_queries = len([log for log in chat_logs if log.get("sources_count", 0) >= 3])
        quality_score = (high_source_queries / total_queries * 100) if total_queries > 0 else 0
        
        dashboard_data = {
            # Overview metrics
            "overview": {
                "total_conversations": total_conversations,
                "total_queries": total_queries,
                "total_documents": total_documents,
                "avg_response_time": round(avg_response_time, 2),
                "performance_score": round(performance_score, 1),
                "quality_score": round(quality_score, 1)
            },
            
            # Usage patterns
            "usage_patterns": {
                "avg_daily_queries": round(avg_daily_queries, 1),
                "peak_usage_day": peak_usage_day[0],
                "peak_usage_count": peak_usage_day[1],
                "avg_conversation_length": round(avg_conversation_length, 1),
                "daily_breakdown": [
                    {"date": date, "queries": count}
                    for date, count in sorted(daily_usage.items())
                ]
            },
            
            # Performance insights
            "performance": {
                "avg_response_time": round(avg_response_time, 2),
                "fast_queries_percent": round((fast_queries / total_queries * 100) if total_queries > 0 else 0, 1),
                "slow_queries_percent": round((slow_queries / total_queries * 100) if total_queries > 0 else 0, 1),
                "avg_sources_per_query": round(avg_sources_per_query, 1),
                "response_time_distribution": {
                    "fast": fast_queries,
                    "medium": total_queries - fast_queries - slow_queries,
                    "slow": slow_queries
                }
            },
            
            # Content insights
            "content": {
                "total_documents": total_documents,
                "total_storage_mb": round(total_storage_mb, 2),
                "file_type_distribution": [
                    {"type": file_type, "count": count}
                    for file_type, count in sorted(file_types.items(), key=lambda x: x[1], reverse=True)
                ],
                "avg_document_size_mb": round(total_storage_mb / total_documents, 2) if total_documents > 0 else 0
            },
            
            # Query analysis
            "query_analysis": {
                "short_queries": short_queries,
                "medium_queries": total_queries - short_queries - long_queries,
                "long_queries": long_queries,
                "complexity_distribution": {
                    "simple": short_queries,
                    "medium": total_queries - short_queries - long_queries,
                    "complex": long_queries
                }
            },
            
            # Recent activity
            "recent_activity": [
                {
                    "id": conv["id"],
                    "created_at": conv["created_at"],
                    "message_count": conv.get("message_count", 0),
                    "total_response_time": conv.get("total_response_time", 0)
                }
                for conv in recent_conversations
            ],
            
            # Metadata
            "metadata": {
                "generated_at": datetime.utcnow().isoformat(),
                "period_days": days,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "organization_id": current_org["id"]
            }
        }
        
        logger.info(f"Generated advanced analytics dashboard with {total_queries} queries analyzed")
        return dashboard_data
        
    except Exception as e:
        logger.error(f"Failed to get advanced dashboard: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve advanced analytics")


@router.get("/user-engagement")
async def get_user_engagement_metrics(
    days: int = Query(default=30, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
) -> Dict[str, Any]:
    """
    Get detailed user engagement metrics.
    """
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get user activity data
        users_result = supabase_client.table("organization_members").select(
            "user_id, email, role, joined_at"
        ).eq("organization_id", current_org["id"]).eq("status", "active").execute()
        
        # Get chat activity per user
        chat_activity = supabase_client.table("chat_logs").select(
            "user_id, created_at, response_time"
        ).gte("created_at", start_date.isoformat()).eq(
            "organization_id", current_org["id"]
        ).execute()
        
        # Process user engagement
        user_stats = {}
        total_users = len(users_result.data)
        active_users = set()
        
        for log in chat_activity.data:
            user_id = log.get("user_id")
            if user_id:
                active_users.add(user_id)
                if user_id not in user_stats:
                    user_stats[user_id] = {
                        "queries": 0,
                        "total_response_time": 0,
                        "sessions": set(),
                        "first_activity": log["created_at"],
                        "last_activity": log["created_at"]
                    }
                
                user_stats[user_id]["queries"] += 1
                user_stats[user_id]["total_response_time"] += log.get("response_time", 0)
                user_stats[user_id]["sessions"].add(log["created_at"][:10])  # Daily sessions
                user_stats[user_id]["last_activity"] = max(user_stats[user_id]["last_activity"], log["created_at"])
        
        # Calculate engagement metrics
        active_user_count = len(active_users)
        engagement_rate = (active_user_count / total_users * 100) if total_users > 0 else 0
        
        # User segments
        power_users = len([stats for stats in user_stats.values() if stats["queries"] > 50])
        regular_users = len([stats for stats in user_stats.values() if 10 <= stats["queries"] <= 50])
        casual_users = len([stats for stats in user_stats.values() if stats["queries"] < 10])
        
        # Average metrics
        avg_queries_per_user = sum(stats["queries"] for stats in user_stats.values()) / active_user_count if active_user_count > 0 else 0
        avg_sessions_per_user = sum(len(stats["sessions"]) for stats in user_stats.values()) / active_user_count if active_user_count > 0 else 0
        
        return {
            "summary": {
                "total_users": total_users,
                "active_users": active_user_count,
                "engagement_rate": round(engagement_rate, 1),
                "avg_queries_per_user": round(avg_queries_per_user, 1),
                "avg_sessions_per_user": round(avg_sessions_per_user, 1)
            },
            "user_segments": {
                "power_users": power_users,
                "regular_users": regular_users,
                "casual_users": casual_users
            },
            "activity_distribution": [
                {"segment": "Power Users (50+ queries)", "count": power_users},
                {"segment": "Regular Users (10-50 queries)", "count": regular_users},
                {"segment": "Casual Users (<10 queries)", "count": casual_users},
                {"segment": "Inactive Users", "count": total_users - active_user_count}
            ],
            "metadata": {
                "period_days": days,
                "generated_at": datetime.utcnow().isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to get user engagement metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve user engagement data")


@router.get("/document-effectiveness")
async def get_document_effectiveness(
    days: int = Query(default=30, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
) -> Dict[str, Any]:
    """
    Analyze which documents are most effective in answering queries.
    """
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get documents
        documents_result = supabase_client.table("documents").select(
            "id, filename, content_type, size_bytes, created_at"
        ).eq("organization_id", current_org["id"]).execute()
        
        # Get chat logs with source analysis
        chat_logs_result = supabase_client.table("chat_logs").select(
            "question, sources_data, response_time, created_at"
        ).gte("created_at", start_date.isoformat()).eq(
            "organization_id", current_org["id"]
        ).execute()
        
        # Analyze document usage in responses
        document_usage = {}
        total_queries = len(chat_logs_result.data)
        
        for log in chat_logs_result.data:
            sources_data = log.get("sources_data", [])
            if isinstance(sources_data, list):
                for source in sources_data:
                    if isinstance(source, dict):
                        filename = source.get("metadata", {}).get("filename")
                        if filename:
                            if filename not in document_usage:
                                document_usage[filename] = {
                                    "queries_served": 0,
                                    "total_relevance": 0,
                                    "avg_relevance": 0
                                }
                            document_usage[filename]["queries_served"] += 1
                            document_usage[filename]["total_relevance"] += source.get("score", 0)
        
        # Calculate effectiveness metrics
        for filename, stats in document_usage.items():
            if stats["queries_served"] > 0:
                stats["avg_relevance"] = stats["total_relevance"] / stats["queries_served"]
                stats["usage_rate"] = (stats["queries_served"] / total_queries * 100) if total_queries > 0 else 0
        
        # Sort by effectiveness (combination of usage and relevance)
        effective_documents = sorted(
            document_usage.items(),
            key=lambda x: x[1]["queries_served"] * x[1]["avg_relevance"],
            reverse=True
        )[:20]
        
        # Analyze unused documents
        all_filenames = {doc["filename"] for doc in documents_result.data}
        used_filenames = set(document_usage.keys())
        unused_documents = all_filenames - used_filenames
        
        # Document type effectiveness
        type_effectiveness = {}
        for doc in documents_result.data:
            content_type = doc["content_type"]
            filename = doc["filename"]
            
            if content_type not in type_effectiveness:
                type_effectiveness[content_type] = {
                    "total_documents": 0,
                    "used_documents": 0,
                    "total_queries_served": 0,
                    "avg_effectiveness": 0
                }
            
            type_effectiveness[content_type]["total_documents"] += 1
            
            if filename in document_usage:
                type_effectiveness[content_type]["used_documents"] += 1
                type_effectiveness[content_type]["total_queries_served"] += document_usage[filename]["queries_served"]
        
        # Calculate type effectiveness rates
        for type_name, stats in type_effectiveness.items():
            stats["usage_rate"] = (stats["used_documents"] / stats["total_documents"] * 100) if stats["total_documents"] > 0 else 0
            stats["avg_queries_per_doc"] = stats["total_queries_served"] / stats["used_documents"] if stats["used_documents"] > 0 else 0
        
        return {
            "summary": {
                "total_documents": len(documents_result.data),
                "active_documents": len(used_filenames),
                "unused_documents": len(unused_documents),
                "document_usage_rate": round((len(used_filenames) / len(documents_result.data) * 100) if documents_result.data else 0, 1),
                "total_queries_analyzed": total_queries
            },
            "top_performing_documents": [
                {
                    "filename": filename,
                    "queries_served": stats["queries_served"],
                    "avg_relevance": round(stats["avg_relevance"], 3),
                    "usage_rate": round(stats["usage_rate"], 2),
                    "effectiveness_score": round(stats["queries_served"] * stats["avg_relevance"], 2)
                }
                for filename, stats in effective_documents[:10]
            ],
            "document_type_analysis": [
                {
                    "content_type": type_name,
                    "total_documents": stats["total_documents"],
                    "used_documents": stats["used_documents"],
                    "usage_rate": round(stats["usage_rate"], 1),
                    "total_queries_served": stats["total_queries_served"],
                    "avg_queries_per_doc": round(stats["avg_queries_per_doc"], 1)
                }
                for type_name, stats in sorted(type_effectiveness.items(), key=lambda x: x[1]["usage_rate"], reverse=True)
            ],
            "unused_documents": list(unused_documents)[:20],  # Limit for response size
            "recommendations": [
                "Consider reviewing unused documents for relevance" if unused_documents else "All documents are being utilized",
                f"Top performing document type: {max(type_effectiveness.items(), key=lambda x: x[1]['usage_rate'])[0] if type_effectiveness else 'N/A'}",
                "Focus on improving low-performing document types" if type_effectiveness else "Upload more documents for better analysis"
            ],
            "metadata": {
                "period_days": days,
                "generated_at": datetime.utcnow().isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to get document effectiveness: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve document effectiveness data")


@router.get("/system-health")
async def get_system_health_metrics(
    days: int = Query(default=7, ge=1, le=30),
    current_user: dict = Depends(get_current_user),
    current_org: dict = Depends(get_current_organization)
) -> Dict[str, Any]:
    """
    Get system health and performance metrics.
    """
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Get performance data
        chat_logs_result = supabase_client.table("chat_logs").select(
            "response_time, sources_count, created_at, error_message"
        ).gte("created_at", start_date.isoformat()).eq(
            "organization_id", current_org["id"]
        ).execute()
        
        chat_logs = chat_logs_result.data
        total_requests = len(chat_logs)
        
        if total_requests == 0:
            return {
                "summary": {"status": "No data available", "total_requests": 0},
                "metadata": {"period_days": days, "generated_at": datetime.utcnow().isoformat()}
            }
        
        # Performance metrics
        response_times = [log.get("response_time", 0) for log in chat_logs]
        avg_response_time = sum(response_times) / len(response_times)
        median_response_time = sorted(response_times)[len(response_times) // 2]
        p95_response_time = sorted(response_times)[int(len(response_times) * 0.95)]
        
        # Error analysis
        errors = [log for log in chat_logs if log.get("error_message")]
        error_rate = (len(errors) / total_requests * 100) if total_requests > 0 else 0
        
        # Availability calculation (simplified)
        successful_requests = total_requests - len(errors)
        availability = (successful_requests / total_requests * 100) if total_requests > 0 else 100
        
        # Performance scoring
        performance_score = 100
        if avg_response_time > 3:
            performance_score -= 20
        if error_rate > 5:
            performance_score -= 30
        if availability < 99:
            performance_score -= 25
        
        # Daily health metrics
        daily_health = {}
        for log in chat_logs:
            date_key = log["created_at"][:10]
            if date_key not in daily_health:
                daily_health[date_key] = {
                    "date": date_key,
                    "requests": 0,
                    "errors": 0,
                    "total_response_time": 0
                }
            
            daily_health[date_key]["requests"] += 1
            daily_health[date_key]["total_response_time"] += log.get("response_time", 0)
            if log.get("error_message"):
                daily_health[date_key]["errors"] += 1
        
        # Calculate daily metrics
        for day_data in daily_health.values():
            day_data["avg_response_time"] = day_data["total_response_time"] / day_data["requests"] if day_data["requests"] > 0 else 0
            day_data["error_rate"] = (day_data["errors"] / day_data["requests"] * 100) if day_data["requests"] > 0 else 0
            day_data["availability"] = ((day_data["requests"] - day_data["errors"]) / day_data["requests"] * 100) if day_data["requests"] > 0 else 100
        
        return {
            "summary": {
                "overall_health": "Excellent" if performance_score >= 90 else "Good" if performance_score >= 70 else "Needs Attention",
                "performance_score": round(performance_score, 1),
                "availability": round(availability, 2),
                "total_requests": total_requests,
                "error_rate": round(error_rate, 2)
            },
            "performance": {
                "avg_response_time": round(avg_response_time, 3),
                "median_response_time": round(median_response_time, 3),
                "p95_response_time": round(p95_response_time, 3),
                "response_time_distribution": {
                    "fast": len([rt for rt in response_times if rt < 1.0]),
                    "medium": len([rt for rt in response_times if 1.0 <= rt < 3.0]),
                    "slow": len([rt for rt in response_times if rt >= 3.0])
                }
            },
            "reliability": {
                "availability": round(availability, 2),
                "successful_requests": successful_requests,
                "failed_requests": len(errors),
                "error_rate": round(error_rate, 2)
            },
            "daily_metrics": list(daily_health.values()),
            "alerts": [
                "High response times detected" if avg_response_time > 3 else None,
                "Error rate above threshold" if error_rate > 5 else None,
                "Availability below target" if availability < 99 else None
            ],
            "metadata": {
                "period_days": days,
                "generated_at": datetime.utcnow().isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to get system health metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve system health data")