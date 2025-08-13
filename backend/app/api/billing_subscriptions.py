"""
Billing and subscription management API endpoints.
Handles subscription plans, invoices, payments, and usage tracking.
"""
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks

from app.models.enterprise_schemas import (
    SubscriptionPlanInfo, OrganizationSubscription, UsageTrackingInfo,
    InvoiceInfo, SuccessResponse, PaginatedResponse
)
from app.core.deps_enterprise import get_current_user, get_current_organization
from app.utils.permissions import check_permission
from app.db.supabase_client import supabase_client
from app.services.email_service import send_notification_email
from app.core.config import settings

router = APIRouter(prefix="/billing", tags=["billing"])
logger = logging.getLogger(__name__)

# =============================================================================
# SUBSCRIPTION PLANS
# =============================================================================

@router.get("/plans", response_model=List[SubscriptionPlanInfo])
async def get_subscription_plans():
    """Get all available subscription plans."""
    try:
        result = supabase_client.table("subscription_plans").select(
            "*"
        ).eq("active", True).order("price_cents").execute()
        
        plans = []
        for plan in result.data or []:
            plans.append(SubscriptionPlanInfo(
                id=plan["id"],
                name=plan["name"],
                description=plan.get("description"),
                price_cents=plan["price_cents"],
                billing_interval=plan["billing_interval"],
                features=plan["features"],
                active=plan["active"]
            ))
        
        return plans
        
    except Exception as e:
        logger.error(f"Error getting subscription plans: {e}")
        raise HTTPException(status_code=500, detail="Failed to get subscription plans")

@router.get("/subscription", response_model=OrganizationSubscription)
async def get_current_subscription(
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get current organization subscription."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "billing", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Get subscription with plan details
        result = supabase_client.table("organization_subscriptions").select(
            "*, plan:plan_id(*)"
        ).eq("organization_id", current_org["id"]).single().execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="No active subscription found")
        
        subscription = result.data
        plan_data = subscription["plan"]
        
        return OrganizationSubscription(
            id=subscription["id"],
            organization_id=subscription["organization_id"],
            plan=SubscriptionPlanInfo(
                id=plan_data["id"],
                name=plan_data["name"],
                description=plan_data.get("description"),
                price_cents=plan_data["price_cents"],
                billing_interval=plan_data["billing_interval"],
                features=plan_data["features"],
                active=plan_data["active"]
            ),
            status=subscription["status"],
            current_period_start=datetime.fromisoformat(subscription["current_period_start"]),
            current_period_end=datetime.fromisoformat(subscription["current_period_end"]),
            trial_end=datetime.fromisoformat(subscription["trial_end"]) if subscription.get("trial_end") else None,
            next_invoice_date=datetime.fromisoformat(subscription["next_invoice_date"]) if subscription.get("next_invoice_date") else None,
            created_at=datetime.fromisoformat(subscription["created_at"])
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting subscription: {e}")
        raise HTTPException(status_code=500, detail="Failed to get subscription")

@router.post("/subscription/change-plan", response_model=SuccessResponse)
async def change_subscription_plan(
    new_plan_id: str,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Change organization subscription plan."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "billing", "write"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Validate new plan exists
        new_plan = supabase_client.table("subscription_plans").select(
            "*"
        ).eq("id", new_plan_id).eq("active", True).single().execute()
        
        if not new_plan.data:
            raise HTTPException(status_code=404, detail="Subscription plan not found")
        
        # Get current subscription
        current_subscription = supabase_client.table("organization_subscriptions").select(
            "*, plan:plan_id(*)"
        ).eq("organization_id", current_org["id"]).single().execute()
        
        if not current_subscription.data:
            raise HTTPException(status_code=404, detail="No active subscription found")
        
        # Calculate prorated amount if changing mid-cycle
        subscription = current_subscription.data
        current_plan = subscription["plan"]
        
        # Simple proration logic (can be enhanced)
        current_period_start = datetime.fromisoformat(subscription["current_period_start"])
        current_period_end = datetime.fromisoformat(subscription["current_period_end"])
        now = datetime.utcnow()
        
        days_total = (current_period_end - current_period_start).days
        days_remaining = (current_period_end - now).days
        
        if days_remaining > 0:
            # Calculate proration
            old_daily_rate = current_plan["price_cents"] / days_total
            new_daily_rate = new_plan.data["price_cents"] / days_total
            proration_amount = (new_daily_rate - old_daily_rate) * days_remaining
        else:
            proration_amount = 0
        
        # Update subscription
        update_data = {
            "plan_id": new_plan_id,
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # If immediate change, update period end
        if days_remaining <= 0:
            if new_plan.data["billing_interval"] == "monthly":
                new_period_end = now + timedelta(days=30)
            else:  # yearly
                new_period_end = now + timedelta(days=365)
            
            update_data.update({
                "current_period_start": now.isoformat(),
                "current_period_end": new_period_end.isoformat(),
                "next_invoice_date": new_period_end.isoformat()
            })
        
        result = supabase_client.table("organization_subscriptions").update(
            update_data
        ).eq("organization_id", current_org["id"]).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update subscription")
        
        # Create invoice for proration if needed
        if proration_amount != 0:
            background_tasks.add_task(
                _create_proration_invoice,
                current_org["id"],
                subscription["id"],
                proration_amount,
                f"Plan change: {current_plan['name']} → {new_plan.data['name']}"
            )
        
        # Send notification
        background_tasks.add_task(
            _send_subscription_change_notification,
            current_org,
            current_plan["name"],
            new_plan.data["name"],
            current_user["email"] if "email" in current_user else None
        )
        
        return SuccessResponse(
            message="Subscription plan changed successfully",
            data={
                "old_plan": current_plan["name"],
                "new_plan": new_plan.data["name"],
                "proration_amount_cents": int(proration_amount)
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error changing subscription plan: {e}")
        raise HTTPException(status_code=500, detail="Failed to change subscription plan")

# =============================================================================
# USAGE TRACKING
# =============================================================================

@router.get("/usage", response_model=List[UsageTrackingInfo])
async def get_usage_tracking(
    months: int = Query(3, ge=1, le=12, description="Number of months"),
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get organization usage tracking data."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "billing", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Calculate date range
        end_date = date.today().replace(day=1)  # First day of current month
        start_date = end_date - timedelta(days=months * 31)  # Approximate months back
        
        result = supabase_client.table("usage_tracking").select(
            "*"
        ).eq("organization_id", current_org["id"]).gte("period_start", start_date).order("period_start", desc=True).execute()
        
        usage_data = []
        for usage in result.data or []:
            usage_data.append(UsageTrackingInfo(
                organization_id=usage["organization_id"],
                period_start=date.fromisoformat(usage["period_start"]),
                period_end=date.fromisoformat(usage["period_end"]),
                documents_processed=usage.get("documents_processed", 0),
                tokens_used=usage.get("tokens_used", 0),
                storage_used_mb=usage.get("storage_used_mb", 0),
                api_calls=usage.get("api_calls", 0),
                total_cost_cents=usage.get("total_cost_cents", 0),
                token_cost_cents=usage.get("token_cost_cents", 0),
                storage_cost_cents=usage.get("storage_cost_cents", 0)
            ))
        
        return usage_data
        
    except Exception as e:
        logger.error(f"Error getting usage tracking: {e}")
        raise HTTPException(status_code=500, detail="Failed to get usage data")

@router.get("/usage/current", response_model=Dict[str, Any])
async def get_current_month_usage(
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get current month usage statistics."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "billing", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Get current month period
        today = date.today()
        month_start = today.replace(day=1)
        
        # Get usage record for current month
        usage_result = supabase_client.table("usage_tracking").select(
            "*"
        ).eq("organization_id", current_org["id"]).eq("period_start", month_start).single().execute()
        
        usage_data = usage_result.data if usage_result.data else {}
        
        # Get subscription limits
        subscription = await get_current_subscription(current_user, current_org)
        limits = subscription.plan.features
        
        # Calculate usage percentages
        usage_summary = {
            "current_period": {"start": month_start, "end": today},
            "usage": {
                "documents": {
                    "used": usage_data.get("documents_processed", 0),
                    "limit": limits.get("maxDocuments", 100),
                    "percentage": _calculate_percentage(usage_data.get("documents_processed", 0), limits.get("maxDocuments", 100))
                },
                "tokens": {
                    "used": usage_data.get("tokens_used", 0),
                    "limit": limits.get("maxTokensPerMonth", 50000),
                    "percentage": _calculate_percentage(usage_data.get("tokens_used", 0), limits.get("maxTokensPerMonth", 50000))
                },
                "storage": {
                    "used_mb": usage_data.get("storage_used_mb", 0),
                    "limit_mb": limits.get("maxStorageMB", 1000),
                    "percentage": _calculate_percentage(usage_data.get("storage_used_mb", 0), limits.get("maxStorageMB", 1000))
                },
                "api_calls": {
                    "used": usage_data.get("api_calls", 0),
                    "limit": limits.get("maxApiCalls", 10000) if limits.get("maxApiCalls") else None
                }
            },
            "costs": {
                "total_cents": usage_data.get("total_cost_cents", 0),
                "breakdown": {
                    "tokens": usage_data.get("token_cost_cents", 0),
                    "storage": usage_data.get("storage_cost_cents", 0),
                    "other": usage_data.get("total_cost_cents", 0) - usage_data.get("token_cost_cents", 0) - usage_data.get("storage_cost_cents", 0)
                }
            },
            "projected_costs": _calculate_projected_costs(usage_data, today.day),
            "warnings": _generate_usage_warnings(usage_data, limits)
        }
        
        return usage_summary
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting current usage: {e}")
        raise HTTPException(status_code=500, detail="Failed to get current usage")

# =============================================================================
# INVOICE MANAGEMENT
# =============================================================================

@router.get("/invoices", response_model=PaginatedResponse)
async def get_invoices(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    status: Optional[str] = Query(None, description="Filter by status"),
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get organization invoices with pagination."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "billing", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Build query
        query = supabase_client.table("invoices").select(
            "*",
            count="exact"
        ).eq("organization_id", current_org["id"])
        
        # Apply filters
        if status:
            query = query.eq("status", status)
        
        # Get total count
        count_result = query.execute()
        total = count_result.count or 0
        
        # Apply pagination
        offset = (page - 1) * page_size
        invoices_result = query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()
        
        # Transform data
        invoices = []
        for invoice in invoices_result.data:
            invoices.append(InvoiceInfo(
                id=invoice["id"],
                organization_id=invoice["organization_id"],
                invoice_number=invoice["invoice_number"],
                amount_cents=invoice["amount_cents"],
                currency=invoice["currency"],
                status=invoice["status"],
                due_date=date.fromisoformat(invoice["due_date"]),
                paid_at=datetime.fromisoformat(invoice["paid_at"]) if invoice.get("paid_at") else None,
                line_items=invoice["line_items"],
                pdf_url=invoice.get("pdf_url"),
                created_at=datetime.fromisoformat(invoice["created_at"])
            ))
        
        return PaginatedResponse(
            items=invoices,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size,
            has_next=offset + page_size < total,
            has_prev=page > 1
        )
        
    except Exception as e:
        logger.error(f"Error getting invoices: {e}")
        raise HTTPException(status_code=500, detail="Failed to get invoices")

@router.get("/invoices/{invoice_id}", response_model=InvoiceInfo)
async def get_invoice(
    invoice_id: str,
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get specific invoice details."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "billing", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        result = supabase_client.table("invoices").select(
            "*"
        ).eq("id", invoice_id).eq("organization_id", current_org["id"]).single().execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        invoice = result.data
        
        return InvoiceInfo(
            id=invoice["id"],
            organization_id=invoice["organization_id"],
            invoice_number=invoice["invoice_number"],
            amount_cents=invoice["amount_cents"],
            currency=invoice["currency"],
            status=invoice["status"],
            due_date=date.fromisoformat(invoice["due_date"]),
            paid_at=datetime.fromisoformat(invoice["paid_at"]) if invoice.get("paid_at") else None,
            line_items=invoice["line_items"],
            pdf_url=invoice.get("pdf_url"),
            created_at=datetime.fromisoformat(invoice["created_at"])
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting invoice: {e}")
        raise HTTPException(status_code=500, detail="Failed to get invoice")

@router.post("/invoices/{invoice_id}/pay", response_model=SuccessResponse)
async def pay_invoice(
    invoice_id: str,
    payment_method_id: Optional[str] = None,
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Mark invoice as paid (simulation - integrate with real payment processor)."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "billing", "write"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Get invoice
        invoice = supabase_client.table("invoices").select(
            "*"
        ).eq("id", invoice_id).eq("organization_id", current_org["id"]).single().execute()
        
        if not invoice.data:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        if invoice.data["status"] == "paid":
            raise HTTPException(status_code=400, detail="Invoice already paid")
        
        # Update invoice status (in real implementation, integrate with Stripe/other payment processor)
        update_data = {
            "status": "paid",
            "paid_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        if payment_method_id:
            update_data["payment_method_id"] = payment_method_id
        
        result = supabase_client.table("invoices").update(
            update_data
        ).eq("id", invoice_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update invoice")
        
        return SuccessResponse(
            message="Invoice paid successfully",
            data={"invoice_id": invoice_id, "amount_cents": invoice.data["amount_cents"]}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error paying invoice: {e}")
        raise HTTPException(status_code=500, detail="Failed to pay invoice")

# =============================================================================
# PAYMENT METHODS
# =============================================================================

@router.get("/payment-methods", response_model=List[Dict[str, Any]])
async def get_payment_methods(
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get organization payment methods."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "billing", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # In real implementation, fetch from payment processor (Stripe, etc.)
        # For now, return mock data
        
        subscription = await get_current_subscription(current_user, current_org)
        
        payment_methods = []
        if subscription.payment_method_id:
            payment_methods.append({
                "id": subscription.payment_method_id,
                "type": "card",
                "brand": "visa",  # Would come from payment processor
                "last4": "4242",  # Would come from payment processor
                "exp_month": 12,
                "exp_year": 2025,
                "is_default": True
            })
        
        return payment_methods
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting payment methods: {e}")
        raise HTTPException(status_code=500, detail="Failed to get payment methods")

# =============================================================================
# BILLING ANALYTICS
# =============================================================================

@router.get("/analytics", response_model=Dict[str, Any])
async def get_billing_analytics(
    months: int = Query(12, ge=1, le=36, description="Number of months"),
    current_user=Depends(get_current_user),
    current_org=Depends(get_current_organization)
):
    """Get billing analytics and trends."""
    # Check permissions
    if not await check_permission(current_user["id"], current_org["id"], "billing", "read"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        # Get usage tracking data
        end_date = date.today()
        start_date = end_date - timedelta(days=months * 31)
        
        usage_data = supabase_client.table("usage_tracking").select(
            "*"
        ).eq("organization_id", current_org["id"]).gte("period_start", start_date).order("period_start").execute()
        
        # Get invoice data
        invoices_data = supabase_client.table("invoices").select(
            "amount_cents, status, created_at, due_date"
        ).eq("organization_id", current_org["id"]).gte("created_at", start_date.isoformat()).execute()
        
        # Calculate analytics
        total_spent = sum(usage.get("total_cost_cents", 0) for usage in usage_data.data or [])
        total_tokens = sum(usage.get("tokens_used", 0) for usage in usage_data.data or [])
        total_storage = sum(usage.get("storage_used_mb", 0) for usage in usage_data.data or [])
        
        # Calculate trends
        monthly_costs = {}
        for usage in usage_data.data or []:
            month_key = usage["period_start"][:7]  # YYYY-MM
            monthly_costs[month_key] = usage.get("total_cost_cents", 0)
        
        # Calculate cost per token and storage
        cost_per_token = total_spent / total_tokens if total_tokens > 0 else 0
        cost_per_mb = total_spent / total_storage if total_storage > 0 else 0
        
        # Invoice analytics
        paid_invoices = [inv for inv in invoices_data.data or [] if inv["status"] == "paid"]
        overdue_invoices = [
            inv for inv in invoices_data.data or []
            if inv["status"] != "paid" and date.fromisoformat(inv["due_date"][:10]) < date.today()
        ]
        
        return {
            "organization_id": current_org["id"],
            "period": {"start": start_date, "end": end_date, "months": months},
            "summary": {
                "total_spent_cents": total_spent,
                "avg_monthly_cents": total_spent // months if months > 0 else 0,
                "cost_per_token_cents": round(cost_per_token, 4),
                "cost_per_mb_cents": round(cost_per_mb, 2)
            },
            "usage_trends": {
                "tokens": [{"month": usage["period_start"][:7], "value": usage.get("tokens_used", 0)} for usage in usage_data.data or []],
                "storage": [{"month": usage["period_start"][:7], "value": usage.get("storage_used_mb", 0)} for usage in usage_data.data or []],
                "costs": [{"month": month, "value": cost} for month, cost in monthly_costs.items()]
            },
            "invoices": {
                "total_count": len(invoices_data.data or []),
                "paid_count": len(paid_invoices),
                "overdue_count": len(overdue_invoices),
                "total_amount_cents": sum(inv["amount_cents"] for inv in invoices_data.data or [])
            },
            "forecasting": _calculate_cost_forecast(usage_data.data or []),
            "generated_at": datetime.utcnow()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting billing analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get billing analytics")

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _calculate_percentage(used: int, limit: int) -> float:
    """Calculate usage percentage."""
    return round((used / limit * 100) if limit > 0 else 0, 1)

def _calculate_projected_costs(usage_data: Dict[str, Any], current_day: int) -> Dict[str, int]:
    """Calculate projected monthly costs based on current usage."""
    if current_day <= 0:
        return {"total_cents": 0, "token_cents": 0, "storage_cents": 0}
    
    days_in_month = 30  # Simplified
    projection_factor = days_in_month / current_day
    
    current_total = usage_data.get("total_cost_cents", 0)
    current_tokens = usage_data.get("token_cost_cents", 0)
    current_storage = usage_data.get("storage_cost_cents", 0)
    
    return {
        "total_cents": int(current_total * projection_factor),
        "token_cents": int(current_tokens * projection_factor),
        "storage_cents": int(current_storage * projection_factor)
    }

def _generate_usage_warnings(usage_data: Dict[str, Any], limits: Dict[str, Any]) -> List[Dict[str, str]]:
    """Generate usage warnings based on current consumption."""
    warnings = []
    
    # Check token usage
    tokens_used = usage_data.get("tokens_used", 0)
    token_limit = limits.get("maxTokensPerMonth", 50000)
    if tokens_used > token_limit * 0.8:
        warnings.append({
            "type": "usage",
            "resource": "tokens",
            "severity": "high" if tokens_used > token_limit * 0.95 else "medium",
            "message": f"Token usage is at {_calculate_percentage(tokens_used, token_limit)}% of monthly limit"
        })
    
    # Check storage usage
    storage_used = usage_data.get("storage_used_mb", 0)
    storage_limit = limits.get("maxStorageMB", 1000)
    if storage_used > storage_limit * 0.8:
        warnings.append({
            "type": "usage",
            "resource": "storage",
            "severity": "high" if storage_used > storage_limit * 0.95 else "medium",
            "message": f"Storage usage is at {_calculate_percentage(storage_used, storage_limit)}% of limit"
        })
    
    return warnings

def _calculate_cost_forecast(usage_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate cost forecasting based on historical data."""
    if len(usage_data) < 3:
        return {"next_month_cents": 0, "trend": "insufficient_data"}
    
    # Simple linear trend calculation
    recent_costs = [usage.get("total_cost_cents", 0) for usage in usage_data[-3:]]
    
    if len(recent_costs) >= 2:
        trend = (recent_costs[-1] - recent_costs[0]) / (len(recent_costs) - 1)
        next_month_forecast = recent_costs[-1] + trend
        
        trend_direction = "increasing" if trend > 0 else "decreasing" if trend < 0 else "stable"
        
        return {
            "next_month_cents": max(0, int(next_month_forecast)),
            "trend": trend_direction,
            "trend_amount_cents": int(abs(trend))
        }
    
    return {
        "next_month_cents": recent_costs[-1] if recent_costs else 0,
        "trend": "stable",
        "trend_amount_cents": 0
    }

async def _create_proration_invoice(
    org_id: str,
    subscription_id: str,
    amount_cents: int,
    description: str
):
    """Create a proration invoice for plan changes."""
    try:
        # Generate invoice number
        invoice_number = f"PRO-{datetime.utcnow().strftime('%Y%m%d')}-{org_id[:8].upper()}"
        
        invoice_data = {
            "organization_id": org_id,
            "subscription_id": subscription_id,
            "invoice_number": invoice_number,
            "amount_cents": int(amount_cents),
            "currency": "EUR",
            "status": "pending",
            "due_date": (date.today() + timedelta(days=7)).isoformat(),
            "line_items": [
                {
                    "description": description,
                    "amount_cents": int(amount_cents),
                    "quantity": 1,
                    "type": "proration"
                }
            ],
            "created_at": datetime.utcnow().isoformat()
        }
        
        supabase_client.table("invoices").insert(invoice_data).execute()
        
    except Exception as e:
        logger.error(f"Error creating proration invoice: {e}")

async def _send_subscription_change_notification(
    organization: Dict[str, Any],
    old_plan: str,
    new_plan: str,
    admin_email: Optional[str]
):
    """Send notification for subscription changes."""
    try:
        if admin_email:
            content = f"""
            <p>Your subscription plan has been changed successfully.</p>
            <p><strong>Previous Plan:</strong> {old_plan}</p>
            <p><strong>New Plan:</strong> {new_plan}</p>
            <p>The change is effective immediately. You will be billed according to the new plan on your next billing cycle.</p>
            """
            
            await send_notification_email(
                emails=[admin_email],
                subject=f"Subscription Changed - {organization['name']}",
                content=content,
                organization_name=organization["name"]
            )
    except Exception as e:
        logger.error(f"Error sending subscription change notification: {e}")