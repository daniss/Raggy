"""
Pydantic schemas for request/response models.
"""
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class UserRole(str, Enum):
    """User roles within an organization."""
    ADMIN = "admin"
    MEMBER = "member"


class MemberStatus(str, Enum):
    """Member status within an organization."""
    ACTIVE = "active"
    INVITED = "invited"
    SUSPENDED = "suspended"


# Health check schemas
class HealthResponse(BaseModel):
    """Health check response."""
    status: str = Field(..., description="Service status")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    services: Optional[Dict[str, Any]] = Field(None, description="Service-specific health info")


class ErrorResponse(BaseModel):
    """Standard error response."""
    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Additional error details")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# Chat schemas
class ChatRequest(BaseModel):
    """Chat request schema."""
    question: str = Field(..., min_length=1, max_length=2000, description="User question")
    conversation_id: Optional[str] = Field(None, description="Conversation ID for context")


class Source(BaseModel):
    """Document source for chat response."""
    content: str = Field(..., description="Source document content")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Document metadata")
    score: float = Field(0.0, description="Relevance score")


class ChatResponse(BaseModel):
    """Chat response schema."""
    answer: str = Field(..., description="AI-generated answer")
    sources: List[Source] = Field(default_factory=list, description="Source documents")
    conversation_id: str = Field(..., description="Conversation ID")
    response_time: float = Field(..., description="Response time in seconds")
    from_cache: bool = Field(False, description="Whether response came from cache")


# Upload schemas
class DocumentInfo(BaseModel):
    """Document information."""
    id: str = Field(..., description="Document ID")
    filename: str = Field(..., description="Original filename")
    content_type: str = Field(..., description="MIME content type")
    size: int = Field(..., description="File size in bytes")
    status: str = Field(..., description="Processing status")
    uploaded_by: str = Field(..., description="User ID who uploaded")
    uploaded_at: datetime = Field(..., description="Upload timestamp")
    organization_id: str = Field(..., description="Organization ID")


class UploadResponse(BaseModel):
    """File upload response."""
    success: bool = Field(..., description="Upload success status")
    message: str = Field(..., description="Status message")
    document_id: Optional[str] = Field(None, description="Document or batch ID")
    chunks_created: Optional[int] = Field(None, description="Number of chunks created")
    job_id: Optional[str] = Field(None, description="Background processing job ID")


# Organization schemas
class OrganizationCreate(BaseModel):
    """Organization creation request."""
    name: str = Field(..., min_length=1, max_length=255, description="Organization name")
    slug: str = Field(..., min_length=3, max_length=50, description="Organization slug")
    description: Optional[str] = Field(None, max_length=1000, description="Organization description")


class OrganizationInfo(BaseModel):
    """Organization information."""
    id: str = Field(..., description="Organization ID")
    name: str = Field(..., description="Organization name")
    slug: str = Field(..., description="Organization slug")
    description: Optional[str] = Field(None, description="Organization description")
    plan: str = Field(..., description="Subscription plan")
    created_at: datetime = Field(..., description="Creation timestamp")
    member_count: int = Field(0, description="Number of active members")
    document_count: int = Field(0, description="Number of documents")


class MemberInfo(BaseModel):
    """Organization member information."""
    id: str = Field(..., description="Member ID")
    user_id: str = Field(..., description="User ID")
    email: str = Field(..., description="User email")
    role: UserRole = Field(..., description="Member role")
    status: MemberStatus = Field(..., description="Member status")
    joined_at: Optional[datetime] = Field(None, description="Join timestamp")
    invited_at: Optional[datetime] = Field(None, description="Invitation timestamp")


class InviteMemberRequest(BaseModel):
    """Invite member request."""
    email: str = Field(..., description="Email address to invite")
    role: UserRole = Field(UserRole.MEMBER, description="Role to assign")


class UpdateMemberRequest(BaseModel):
    """Update member request."""
    role: Optional[UserRole] = Field(None, description="New role")
    status: Optional[MemberStatus] = Field(None, description="New status")


# Analytics schemas
class AnalyticsResponse(BaseModel):
    """Analytics response."""
    organization_id: str = Field(..., description="Organization ID")
    period: str = Field(..., description="Analytics period")
    metrics: Dict[str, Any] = Field(..., description="Analytics metrics")
    generated_at: datetime = Field(default_factory=datetime.utcnow)