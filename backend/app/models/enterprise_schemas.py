"""
Enhanced Pydantic schemas for enterprise RAG dashboard features.
Extends the base schemas with multi-tenant and enterprise functionality.
"""
from datetime import datetime, date
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, EmailStr, validator
from enum import Enum

# =============================================================================
# ENUMS AND CONSTANTS
# =============================================================================

class PlanType(str, Enum):
    """Subscription plan types."""
    STARTER = "starter"
    TEAM = "team"
    BUSINESS = "business"
    ENTERPRISE = "enterprise"

class OrganizationStatus(str, Enum):
    """Organization status."""
    ACTIVE = "active"
    SUSPENDED = "suspended"
    TRIAL = "trial"
    CANCELLED = "cancelled"

class MemberRole(str, Enum):
    """Member roles with enterprise RBAC."""
    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"
    DPO = "dpo"  # Data Protection Officer
    BILLING = "billing"

class MemberStatus(str, Enum):
    """Member status."""
    ACTIVE = "active"
    INVITED = "invited"
    SUSPENDED = "suspended"

class SeverityLevel(str, Enum):
    """Severity levels for incidents and alerts."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class SensitivityLevel(str, Enum):
    """Data sensitivity classification."""
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"

# =============================================================================
# ORGANIZATION SCHEMAS
# =============================================================================

class OrganizationSettings(BaseModel):
    """Organization settings and limits."""
    dataResidency: str = Field(default="eu", description="Data residency region")
    hdsCompliant: bool = Field(default=False, description="HDS compliance enabled")
    maxDocuments: int = Field(default=100, description="Maximum documents allowed")
    maxUsers: int = Field(default=5, description="Maximum users allowed")
    maxTokensPerMonth: int = Field(default=50000, description="Monthly token limit")
    maxStorageMB: int = Field(default=1000, description="Storage limit in MB")

class OrganizationBranding(BaseModel):
    """Organization branding customization."""
    logo: Optional[str] = Field(None, description="Logo URL")
    primaryColor: Optional[str] = Field(None, description="Primary brand color")
    secondaryColor: Optional[str] = Field(None, description="Secondary brand color")
    customDomain: Optional[str] = Field(None, description="Custom domain")

class OrganizationCreate(BaseModel):
    """Create organization request."""
    name: str = Field(..., min_length=1, max_length=255, description="Organization name")
    slug: str = Field(..., min_length=3, max_length=50, description="Organization slug")
    description: Optional[str] = Field(None, max_length=1000, description="Description")
    plan: PlanType = Field(PlanType.STARTER, description="Subscription plan")
    
    @validator('slug')
    def validate_slug(cls, v):
        import re
        if not re.match(r'^[a-z0-9][a-z0-9-]*[a-z0-9]$', v):
            raise ValueError('Slug must contain only lowercase letters, numbers, and hyphens')
        return v

class OrganizationInfo(BaseModel):
    """Organization information response."""
    id: str = Field(..., description="Organization ID")
    name: str = Field(..., description="Organization name")
    slug: str = Field(..., description="Organization slug")
    description: Optional[str] = Field(None, description="Description")
    plan: PlanType = Field(..., description="Current plan")
    status: OrganizationStatus = Field(..., description="Organization status")
    settings: OrganizationSettings = Field(..., description="Organization settings")
    branding: OrganizationBranding = Field(default_factory=OrganizationBranding, description="Branding")
    created_at: datetime = Field(..., description="Creation timestamp")
    member_count: int = Field(0, description="Active member count")
    document_count: int = Field(0, description="Total document count")
    trial_ends_at: Optional[datetime] = Field(None, description="Trial end date")

class OrganizationUpdate(BaseModel):
    """Update organization request."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    settings: Optional[OrganizationSettings] = None
    branding: Optional[OrganizationBranding] = None

# =============================================================================
# MEMBER MANAGEMENT SCHEMAS
# =============================================================================

class MemberPermissions(BaseModel):
    """Fine-grained member permissions."""
    documents: Dict[str, bool] = Field(default_factory=lambda: {
        "read": True, "write": False, "delete": False
    })
    conversations: Dict[str, bool] = Field(default_factory=lambda: {
        "read": True, "moderate": False
    })
    analytics: Dict[str, bool] = Field(default_factory=lambda: {
        "read": False
    })
    settings: Dict[str, bool] = Field(default_factory=lambda: {
        "read": False, "write": False
    })
    billing: Dict[str, bool] = Field(default_factory=lambda: {
        "read": False, "write": False
    })
    security: Dict[str, bool] = Field(default_factory=lambda: {
        "read": False, "write": False
    })

class MemberInfo(BaseModel):
    """Organization member information."""
    id: str = Field(..., description="Member ID")
    user_id: str = Field(..., description="User ID")
    email: EmailStr = Field(..., description="User email")
    name: Optional[str] = Field(None, description="User display name")
    role: MemberRole = Field(..., description="Member role")
    status: MemberStatus = Field(..., description="Member status")
    permissions: MemberPermissions = Field(..., description="Permissions")
    invited_at: datetime = Field(..., description="Invitation timestamp")
    joined_at: Optional[datetime] = Field(None, description="Join timestamp")
    last_active: Optional[datetime] = Field(None, description="Last activity")
    invited_by: Optional[str] = Field(None, description="Invited by user ID")

class InviteMemberRequest(BaseModel):
    """Invite member request."""
    email: EmailStr = Field(..., description="Email address to invite")
    role: MemberRole = Field(MemberRole.MEMBER, description="Role to assign")
    custom_permissions: Optional[MemberPermissions] = Field(None, description="Custom permissions")
    send_email: bool = Field(True, description="Send invitation email")

class UpdateMemberRequest(BaseModel):
    """Update member request."""
    role: Optional[MemberRole] = Field(None, description="New role")
    status: Optional[MemberStatus] = Field(None, description="New status")
    permissions: Optional[MemberPermissions] = Field(None, description="Updated permissions")

# =============================================================================
# ENHANCED DOCUMENT SCHEMAS
# =============================================================================

class DocumentMetadata(BaseModel):
    """Enhanced document metadata."""
    title: Optional[str] = Field(None, max_length=500, description="Document title")
    summary: Optional[str] = Field(None, description="Document summary")
    language: str = Field(default="fr", description="Document language")
    tags: List[str] = Field(default_factory=list, description="Document tags")
    categories: List[str] = Field(default_factory=list, description="Document categories")
    department: Optional[str] = Field(None, max_length=100, description="Department")
    
    # PII and compliance
    contains_pii: bool = Field(default=False, description="Contains PII")
    pii_types: List[str] = Field(default_factory=list, description="PII types found")
    sensitivity_level: SensitivityLevel = Field(SensitivityLevel.PUBLIC, description="Sensitivity")
    
    # Processing settings
    chunking_strategy: str = Field(default="recursive", description="Chunking strategy")
    chunk_size: int = Field(default=800, description="Chunk size")
    chunk_overlap: int = Field(default=100, description="Chunk overlap")

class DocumentInfo(BaseModel):
    """Enhanced document information."""
    id: str = Field(..., description="Document ID")
    filename: str = Field(..., description="Original filename")
    content_type: str = Field(..., description="MIME content type")
    size: int = Field(..., description="File size in bytes")
    status: str = Field(..., description="Processing status")
    organization_id: str = Field(..., description="Organization ID")
    uploaded_by: str = Field(..., description="User ID who uploaded")
    uploaded_at: datetime = Field(..., description="Upload timestamp")
    metadata: DocumentMetadata = Field(..., description="Document metadata")
    chunks_count: int = Field(0, description="Number of chunks")
    processing_time: Optional[float] = Field(None, description="Processing time in seconds")

class BulkDocumentOperation(BaseModel):
    """Bulk document operation request."""
    document_ids: List[str] = Field(..., min_items=1, description="Document IDs")
    operation: str = Field(..., description="Operation type")
    parameters: Optional[Dict[str, Any]] = Field(None, description="Operation parameters")

# =============================================================================
# CONVERSATION AND ANALYTICS SCHEMAS
# =============================================================================

class ConversationMetadata(BaseModel):
    """Enhanced conversation metadata."""
    topic: Optional[str] = Field(None, max_length=200, description="Conversation topic")
    intent: Optional[str] = Field(None, max_length=100, description="User intent")
    language: str = Field(default="fr", description="Conversation language")
    satisfaction_rating: Optional[int] = Field(None, ge=1, le=5, description="Satisfaction rating")
    feedback: Optional[str] = Field(None, description="User feedback")
    feedback_tags: List[str] = Field(default_factory=list, description="Feedback tags")
    requires_review: bool = Field(default=False, description="Requires moderation")
    flagged_content: bool = Field(default=False, description="Contains flagged content")

class MessageAnalytics(BaseModel):
    """Message-level analytics."""
    processing_time: Optional[float] = Field(None, description="Processing time")
    embedding_time: Optional[float] = Field(None, description="Embedding time")
    retrieval_time: Optional[float] = Field(None, description="Retrieval time")
    generation_time: Optional[float] = Field(None, description="Generation time")
    relevance_score: Optional[float] = Field(None, ge=0, le=1, description="Relevance score")
    confidence_score: Optional[float] = Field(None, ge=0, le=1, description="Confidence score")
    tokens_used: Optional[int] = Field(None, description="Tokens consumed")
    cost_cents: Optional[int] = Field(None, description="Cost in cents")

class ConversationInfo(BaseModel):
    """Enhanced conversation information."""
    id: str = Field(..., description="Conversation ID")
    user_id: Optional[str] = Field(None, description="User ID")
    organization_id: str = Field(..., description="Organization ID")
    title: Optional[str] = Field(None, description="Conversation title")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update")
    metadata: ConversationMetadata = Field(..., description="Conversation metadata")
    message_count: int = Field(0, description="Number of messages")
    avg_response_time: Optional[float] = Field(None, description="Average response time")

# =============================================================================
# PROMPT TEMPLATE SCHEMAS
# =============================================================================

class PromptVariable(BaseModel):
    """Prompt template variable definition."""
    name: str = Field(..., description="Variable name")
    type: str = Field(default="string", description="Variable type")
    description: Optional[str] = Field(None, description="Variable description")
    required: bool = Field(True, description="Is variable required")
    default_value: Optional[str] = Field(None, description="Default value")

class ModelConfig(BaseModel):
    """LLM model configuration."""
    temperature: float = Field(default=0.1, ge=0, le=2, description="Model temperature")
    max_tokens: int = Field(default=2000, gt=0, description="Max tokens")
    top_p: float = Field(default=1.0, ge=0, le=1, description="Top-p sampling")
    frequency_penalty: float = Field(default=0, ge=-2, le=2, description="Frequency penalty")
    presence_penalty: float = Field(default=0, ge=-2, le=2, description="Presence penalty")

class PromptTemplateCreate(BaseModel):
    """Create prompt template request."""
    name: str = Field(..., min_length=1, max_length=200, description="Template name")
    description: Optional[str] = Field(None, description="Template description")
    category: str = Field(default="general", description="Template category")
    system_prompt: str = Field(..., min_length=1, description="System prompt")
    user_prompt_template: str = Field(..., min_length=1, description="User prompt template")
    variables: List[PromptVariable] = Field(default_factory=list, description="Template variables")
    llm_config: ModelConfig = Field(default_factory=ModelConfig, description="Model configuration")

class PromptTemplateInfo(BaseModel):
    """Prompt template information."""
    id: str = Field(..., description="Template ID")
    organization_id: str = Field(..., description="Organization ID")
    name: str = Field(..., description="Template name")
    description: Optional[str] = Field(None, description="Template description")
    category: str = Field(..., description="Template category")
    system_prompt: str = Field(..., description="System prompt")
    user_prompt_template: str = Field(..., description="User prompt template")
    variables: List[PromptVariable] = Field(..., description="Template variables")
    llm_config: ModelConfig = Field(..., description="Model configuration")
    status: str = Field(..., description="Template status")
    version: int = Field(..., description="Template version")
    usage_count: int = Field(0, description="Usage count")
    avg_rating: Optional[float] = Field(None, description="Average rating")
    avg_response_time: Optional[float] = Field(None, description="Average response time")
    created_at: datetime = Field(..., description="Creation timestamp")
    created_by: str = Field(..., description="Creator user ID")

class PromptExecutionRequest(BaseModel):
    """Execute prompt template request."""
    template_id: str = Field(..., description="Template ID")
    variables: Dict[str, Any] = Field(..., description="Variable values")
    save_execution: bool = Field(True, description="Save execution results")

class PromptExecutionResult(BaseModel):
    """Prompt execution result."""
    id: str = Field(..., description="Execution ID")
    template_id: str = Field(..., description="Template ID")
    rendered_prompt: str = Field(..., description="Rendered prompt")
    output: str = Field(..., description="Generated output")
    response_time: float = Field(..., description="Response time")
    cost_cents: int = Field(..., description="Cost in cents")
    tokens_used: int = Field(..., description="Tokens used")
    executed_at: datetime = Field(..., description="Execution timestamp")

# =============================================================================
# SECURITY AND COMPLIANCE SCHEMAS
# =============================================================================

class SecurityIncidentCreate(BaseModel):
    """Create security incident request."""
    title: str = Field(..., min_length=1, max_length=300, description="Incident title")
    description: Optional[str] = Field(None, description="Incident description")
    severity: SeverityLevel = Field(SeverityLevel.MEDIUM, description="Incident severity")
    category: str = Field(..., description="Incident category")
    affected_users: int = Field(default=0, description="Number of affected users")
    affected_documents: int = Field(default=0, description="Number of affected documents")
    data_types_affected: List[str] = Field(default_factory=list, description="Affected data types")

class SecurityIncidentInfo(BaseModel):
    """Security incident information."""
    id: str = Field(..., description="Incident ID")
    organization_id: str = Field(..., description="Organization ID")
    title: str = Field(..., description="Incident title")
    description: Optional[str] = Field(None, description="Incident description")
    severity: SeverityLevel = Field(..., description="Incident severity")
    category: str = Field(..., description="Incident category")
    status: str = Field(..., description="Incident status")
    affected_users: int = Field(..., description="Number of affected users")
    affected_documents: int = Field(..., description="Number of affected documents")
    data_types_affected: List[str] = Field(..., description="Affected data types")
    detected_at: datetime = Field(..., description="Detection timestamp")
    resolved_at: Optional[datetime] = Field(None, description="Resolution timestamp")
    assigned_to: Optional[str] = Field(None, description="Assigned user ID")
    reported_by: Optional[str] = Field(None, description="Reporter user ID")

class ComplianceAuditCreate(BaseModel):
    """Create compliance audit request."""
    audit_type: str = Field(..., description="Audit type")
    framework: str = Field(..., description="Compliance framework")
    title: str = Field(..., min_length=1, max_length=200, description="Audit title")
    description: Optional[str] = Field(None, description="Audit description")
    scope: Optional[str] = Field(None, description="Audit scope")
    planned_date: Optional[date] = Field(None, description="Planned audit date")
    auditor_name: Optional[str] = Field(None, max_length=100, description="Auditor name")

class ComplianceAuditInfo(BaseModel):
    """Compliance audit information."""
    id: str = Field(..., description="Audit ID")
    organization_id: str = Field(..., description="Organization ID")
    audit_type: str = Field(..., description="Audit type")
    framework: str = Field(..., description="Compliance framework")
    title: str = Field(..., description="Audit title")
    description: Optional[str] = Field(None, description="Audit description")
    scope: Optional[str] = Field(None, description="Audit scope")
    status: str = Field(..., description="Audit status")
    planned_date: Optional[date] = Field(None, description="Planned date")
    started_at: Optional[datetime] = Field(None, description="Start timestamp")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")
    score: Optional[int] = Field(None, ge=0, le=100, description="Audit score")
    auditor_name: Optional[str] = Field(None, description="Auditor name")
    created_at: datetime = Field(..., description="Creation timestamp")

# =============================================================================
# BILLING SCHEMAS
# =============================================================================

class SubscriptionPlanInfo(BaseModel):
    """Subscription plan information."""
    id: str = Field(..., description="Plan ID")
    name: str = Field(..., description="Plan name")
    description: Optional[str] = Field(None, description="Plan description")
    price_cents: int = Field(..., description="Monthly price in cents")
    billing_interval: str = Field(..., description="Billing interval")
    features: Dict[str, Any] = Field(..., description="Plan features and limits")
    active: bool = Field(..., description="Plan active status")

class OrganizationSubscription(BaseModel):
    """Organization subscription information."""
    id: str = Field(..., description="Subscription ID")
    organization_id: str = Field(..., description="Organization ID")
    plan: SubscriptionPlanInfo = Field(..., description="Current plan")
    status: str = Field(..., description="Subscription status")
    current_period_start: datetime = Field(..., description="Period start")
    current_period_end: datetime = Field(..., description="Period end")
    trial_end: Optional[datetime] = Field(None, description="Trial end")
    next_invoice_date: Optional[datetime] = Field(None, description="Next invoice date")
    created_at: datetime = Field(..., description="Creation timestamp")

class UsageTrackingInfo(BaseModel):
    """Usage tracking information."""
    organization_id: str = Field(..., description="Organization ID")
    period_start: date = Field(..., description="Period start")
    period_end: date = Field(..., description="Period end")
    documents_processed: int = Field(0, description="Documents processed")
    tokens_used: int = Field(0, description="Tokens used")
    storage_used_mb: int = Field(0, description="Storage used in MB")
    api_calls: int = Field(0, description="API calls made")
    total_cost_cents: int = Field(0, description="Total cost in cents")
    token_cost_cents: int = Field(0, description="Token cost in cents")
    storage_cost_cents: int = Field(0, description="Storage cost in cents")

class InvoiceInfo(BaseModel):
    """Invoice information."""
    id: str = Field(..., description="Invoice ID")
    organization_id: str = Field(..., description="Organization ID")
    invoice_number: str = Field(..., description="Invoice number")
    amount_cents: int = Field(..., description="Amount in cents")
    currency: str = Field(..., description="Currency code")
    status: str = Field(..., description="Invoice status")
    due_date: date = Field(..., description="Due date")
    paid_at: Optional[datetime] = Field(None, description="Payment timestamp")
    line_items: List[Dict[str, Any]] = Field(..., description="Invoice line items")
    pdf_url: Optional[str] = Field(None, description="PDF download URL")
    created_at: datetime = Field(..., description="Creation timestamp")

# =============================================================================
# ANALYTICS SCHEMAS
# =============================================================================

class AnalyticsPeriod(str, Enum):
    """Analytics time periods."""
    LAST_7_DAYS = "7d"
    LAST_30_DAYS = "30d"
    LAST_90_DAYS = "90d"
    LAST_YEAR = "1y"

class UsageMetrics(BaseModel):
    """Usage metrics."""
    total_queries: int = Field(0, description="Total queries")
    unique_users: int = Field(0, description="Unique users")
    avg_response_time: float = Field(0, description="Average response time")
    successful_queries: int = Field(0, description="Successful queries")
    failed_queries: int = Field(0, description="Failed queries")
    avg_satisfaction: Optional[float] = Field(None, description="Average satisfaction")

class CostMetrics(BaseModel):
    """Cost tracking metrics."""
    total_cost_cents: int = Field(0, description="Total cost in cents")
    token_cost_cents: int = Field(0, description="Token cost in cents")
    storage_cost_cents: int = Field(0, description="Storage cost in cents")
    embedding_cost_cents: int = Field(0, description="Embedding cost in cents")

class QualityMetrics(BaseModel):
    """Quality metrics."""
    avg_relevance_score: Optional[float] = Field(None, description="Average relevance")
    avg_confidence_score: Optional[float] = Field(None, description="Average confidence")
    pii_incidents: int = Field(0, description="PII incidents")
    flagged_conversations: int = Field(0, description="Flagged conversations")

class DailyAnalytics(BaseModel):
    """Daily analytics summary."""
    analytics_date: date = Field(..., description="Analytics date")
    organization_id: str = Field(..., description="Organization ID")
    usage: UsageMetrics = Field(..., description="Usage metrics")
    costs: CostMetrics = Field(..., description="Cost metrics")
    quality: QualityMetrics = Field(..., description="Quality metrics")

class AnalyticsDashboard(BaseModel):
    """Complete analytics dashboard data."""
    organization_id: str = Field(..., description="Organization ID")
    period: AnalyticsPeriod = Field(..., description="Analytics period")
    summary: Dict[str, Any] = Field(..., description="Summary metrics")
    daily_data: List[DailyAnalytics] = Field(..., description="Daily breakdown")
    top_queries: List[Dict[str, Any]] = Field(..., description="Top queries")
    user_satisfaction: Dict[str, Any] = Field(..., description="Satisfaction breakdown")
    cost_breakdown: Dict[str, Any] = Field(..., description="Cost analysis")
    generated_at: datetime = Field(..., description="Generation timestamp")

# =============================================================================
# QUOTA AND USAGE SCHEMAS
# =============================================================================

class QuotaInfo(BaseModel):
    """Organization quota information."""
    resource: str = Field(..., description="Resource name")
    current: int = Field(..., description="Current usage")
    limit: int = Field(..., description="Resource limit")
    percentage: float = Field(..., ge=0, le=100, description="Usage percentage")
    warning_threshold: float = Field(80.0, description="Warning threshold")
    exceeded: bool = Field(False, description="Quota exceeded")

class OrganizationQuotas(BaseModel):
    """Complete organization quota status."""
    organization_id: str = Field(..., description="Organization ID")
    documents: QuotaInfo = Field(..., description="Document quota")
    users: QuotaInfo = Field(..., description="User quota")
    tokens: QuotaInfo = Field(..., description="Token quota")
    storage: QuotaInfo = Field(..., description="Storage quota")
    api_calls: Optional[QuotaInfo] = Field(None, description="API calls quota")
    updated_at: datetime = Field(..., description="Last update timestamp")

# =============================================================================
# API RESPONSE SCHEMAS
# =============================================================================

class PaginatedResponse(BaseModel):
    """Paginated API response."""
    items: List[Any] = Field(..., description="Response items")
    total: int = Field(..., description="Total item count")
    page: int = Field(..., description="Current page")
    page_size: int = Field(..., description="Items per page")
    total_pages: int = Field(..., description="Total pages")
    has_next: bool = Field(..., description="Has next page")
    has_prev: bool = Field(..., description="Has previous page")

class SuccessResponse(BaseModel):
    """Standard success response."""
    success: bool = Field(True, description="Operation success")
    message: str = Field(..., description="Success message")
    data: Optional[Any] = Field(None, description="Response data")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Response timestamp")

class BulkOperationResult(BaseModel):
    """Bulk operation result."""
    success_count: int = Field(..., description="Successful operations")
    error_count: int = Field(..., description="Failed operations")
    total_count: int = Field(..., description="Total operations")
    errors: List[Dict[str, Any]] = Field(default_factory=list, description="Error details")
    results: List[Any] = Field(default_factory=list, description="Operation results")