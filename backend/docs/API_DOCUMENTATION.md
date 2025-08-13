# RAG Enterprise Dashboard API Documentation

## Overview

This document provides comprehensive documentation for the RAG Enterprise Dashboard API. The API provides multi-tenant organization management, advanced analytics, security compliance, billing, and prompt template management for enterprise RAG systems.

## Base URL

```
Production: https://api.raggy.com/api/v1
Development: http://localhost:8000/api/v1
```

## Authentication

All API endpoints require JWT authentication via the `Authorization` header:

```http
Authorization: Bearer <jwt_token>
```

## Organization Context

Most endpoints require an organization context. This can be provided via:

1. **Header** (Recommended):
   ```http
   X-Organization-ID: <organization_id>
   ```

2. **Query Parameter**:
   ```
   ?organization_id=<organization_id>
   ```

## Rate Limiting

- **Standard**: 100 requests/minute per user
- **Analytics**: 20 requests/minute per organization
- **Billing**: 10 requests/minute per organization

## Error Handling

### Standard Error Response

```json
{
  "error": "Error message",
  "detail": "Additional error details",
  "timestamp": "2025-01-12T10:30:00Z",
  "code": "ERROR_CODE"
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error

---

# Organizations API

## Get Current Organization

Get information about the current organization.

**Endpoint:** `GET /organizations/current`

**Response:**
```json
{
  "id": "org-123",
  "name": "Acme Corp",
  "slug": "acme-corp",
  "description": "Description of organization",
  "plan": "team",
  "status": "active",
  "settings": {
    "dataResidency": "eu",
    "hdsCompliant": false,
    "maxDocuments": 500,
    "maxUsers": 10,
    "maxTokensPerMonth": 100000,
    "maxStorageMB": 5000
  },
  "branding": {
    "logo": "https://cdn.example.com/logo.png",
    "primaryColor": "#2563eb",
    "secondaryColor": "#64748b"
  },
  "created_at": "2024-01-01T00:00:00Z",
  "member_count": 8,
  "document_count": 127,
  "trial_ends_at": null
}
```

## Update Current Organization

Update organization settings and branding.

**Endpoint:** `PUT /organizations/current`

**Request Body:**
```json
{
  "name": "New Organization Name",
  "description": "Updated description",
  "settings": {
    "dataResidency": "eu",
    "hdsCompliant": true,
    "maxDocuments": 1000,
    "maxUsers": 25,
    "maxTokensPerMonth": 200000,
    "maxStorageMB": 10000
  },
  "branding": {
    "logo": "https://cdn.example.com/new-logo.png",
    "primaryColor": "#059669",
    "secondaryColor": "#6b7280"
  }
}
```

**Permissions Required:** `settings.write`

## Get Organization Quotas

Get current usage and quota information.

**Endpoint:** `GET /organizations/quotas`

**Response:**
```json
{
  "organization_id": "org-123",
  "documents": {
    "resource": "documents",
    "current": 127,
    "limit": 500,
    "percentage": 25.4,
    "warning_threshold": 80.0,
    "exceeded": false
  },
  "users": {
    "resource": "users",
    "current": 8,
    "limit": 10,
    "percentage": 80.0,
    "warning_threshold": 80.0,
    "exceeded": false
  },
  "tokens": {
    "resource": "tokens",
    "current": 45000,
    "limit": 100000,
    "percentage": 45.0,
    "warning_threshold": 80.0,
    "exceeded": false
  },
  "storage": {
    "resource": "storage",
    "current": 2400,
    "limit": 5000,
    "percentage": 48.0,
    "warning_threshold": 80.0,
    "exceeded": false
  },
  "updated_at": "2025-01-12T10:30:00Z"
}
```

---

# Team Management API

## List Organization Members

Get paginated list of organization members.

**Endpoint:** `GET /organizations/members`

**Query Parameters:**
- `page` (int, default: 1) - Page number
- `page_size` (int, default: 20, max: 100) - Items per page
- `role` (enum) - Filter by role: admin, member, viewer, dpo, billing
- `status` (enum) - Filter by status: active, invited, suspended
- `search` (string) - Search by email or name

**Response:**
```json
{
  "items": [
    {
      "id": "member-123",
      "user_id": "user-456",
      "email": "john.doe@example.com",
      "name": "John Doe",
      "role": "admin",
      "status": "active",
      "permissions": {
        "documents": {"read": true, "write": true, "delete": true},
        "conversations": {"read": true, "moderate": true},
        "analytics": {"read": true},
        "settings": {"read": true, "write": true},
        "billing": {"read": true, "write": true},
        "security": {"read": true, "write": true}
      },
      "invited_at": "2024-01-01T00:00:00Z",
      "joined_at": "2024-01-01T00:15:00Z",
      "last_active": "2025-01-12T10:00:00Z",
      "invited_by": "user-789"
    }
  ],
  "total": 8,
  "page": 1,
  "page_size": 20,
  "total_pages": 1,
  "has_next": false,
  "has_prev": false
}
```

## Invite Member

Invite a new member to the organization.

**Endpoint:** `POST /organizations/members/invite`

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "role": "member",
  "custom_permissions": {
    "documents": {"read": true, "write": false, "delete": false},
    "conversations": {"read": true, "moderate": false},
    "analytics": {"read": false}
  },
  "send_email": true
}
```

**Permissions Required:** `settings.write`

**Response:**
```json
{
  "success": true,
  "message": "Invitation sent successfully",
  "timestamp": "2025-01-12T10:30:00Z"
}
```

## Update Member

Update member role, status, or permissions.

**Endpoint:** `PUT /organizations/members/{member_id}`

**Request Body:**
```json
{
  "role": "admin",
  "status": "active",
  "permissions": {
    "documents": {"read": true, "write": true, "delete": true},
    "analytics": {"read": true}
  }
}
```

**Permissions Required:** `settings.write`

## Remove Member

Remove member from organization.

**Endpoint:** `DELETE /organizations/members/{member_id}`

**Permissions Required:** `settings.write`

---

# Analytics API

## Analytics Dashboard

Get comprehensive analytics dashboard data.

**Endpoint:** `GET /analytics/dashboard`

**Query Parameters:**
- `period` (enum, default: "30d") - Analytics period: 7d, 30d, 90d, 1y

**Response:**
```json
{
  "organization_id": "org-123",
  "period": "30d",
  "summary": {
    "total_queries": 2847,
    "unique_users": 156,
    "avg_response_time": 1.34,
    "total_cost_cents": 1245
  },
  "daily_data": [
    {
      "date": "2025-01-01",
      "organization_id": "org-123",
      "usage": {
        "total_queries": 98,
        "unique_users": 23,
        "avg_response_time": 1.2,
        "successful_queries": 96,
        "failed_queries": 2,
        "avg_satisfaction": 4.1
      },
      "costs": {
        "total_cost_cents": 42,
        "token_cost_cents": 35,
        "storage_cost_cents": 5,
        "embedding_cost_cents": 2
      },
      "quality": {
        "avg_relevance_score": 0.87,
        "avg_confidence_score": 0.92,
        "pii_incidents": 0,
        "flagged_conversations": 1
      }
    }
  ],
  "top_queries": [
    {
      "query_text": "Comment calculer le ROI ?",
      "query_category": "finance",
      "execution_count": 45,
      "avg_response_time": 1.1,
      "avg_satisfaction": 4.3
    }
  ],
  "user_satisfaction": {
    "average_rating": 4.2,
    "trend": "improving"
  },
  "cost_breakdown": {
    "total_cents": 1245,
    "breakdown": {
      "tokens": 1050,
      "storage": 125,
      "embeddings": 70
    }
  },
  "generated_at": "2025-01-12T10:30:00Z"
}
```

**Permissions Required:** `analytics.read`

## Usage Analytics

Get detailed usage analytics with flexible granularity.

**Endpoint:** `GET /analytics/usage`

**Query Parameters:**
- `days` (int, default: 30, max: 365) - Number of days
- `granularity` (enum, default: "daily") - Data granularity: hourly, daily, weekly, monthly

**Response:**
```json
{
  "organization_id": "org-123",
  "period": {
    "start": "2024-12-13",
    "end": "2025-01-12",
    "days": 30
  },
  "granularity": "daily",
  "data": [
    {
      "date": "2025-01-01",
      "total_queries": 98,
      "unique_users": 23,
      "avg_response_time": 1.2
    }
  ],
  "trends": {
    "queries": 12.5,
    "users": 8.3,
    "response_time": -5.2
  },
  "generated_at": "2025-01-12T10:30:00Z"
}
```

## Query Analytics

Get detailed query analytics and topic analysis.

**Endpoint:** `GET /analytics/queries`

**Query Parameters:**
- `days` (int, default: 30) - Number of days
- `limit` (int, default: 50, max: 100) - Number of top queries
- `include_failed` (bool, default: false) - Include failed queries

**Response:**
```json
{
  "organization_id": "org-123",
  "period": {
    "start": "2024-12-13",
    "end": "2025-01-12",
    "days": 30
  },
  "top_queries": [
    {
      "query_text": "Comment calculer le ROI ?",
      "query_category": "finance",
      "execution_count": 45,
      "avg_response_time": 1.1,
      "avg_satisfaction": 4.3,
      "last_executed": "2025-01-12T09:15:00Z"
    }
  ],
  "categories": {
    "finance": 156,
    "hr": 89,
    "legal": 67,
    "technical": 134
  },
  "performance_trends": {
    "daily_trends": [
      {
        "date": "2025-01-01",
        "avg_response_time": 1.2,
        "avg_rating": 4.1,
        "query_count": 98
      }
    ]
  },
  "failure_analysis": {
    "total_failures": 23,
    "error_categories": {
      "timeout": 12,
      "rate_limit": 5,
      "auth_error": 2,
      "other": 4
    },
    "recent_failures": []
  },
  "generated_at": "2025-01-12T10:30:00Z"
}
```

---

# Security & Compliance API

## Security Incidents

### List Security Incidents

**Endpoint:** `GET /security/incidents`

**Query Parameters:**
- `page`, `page_size` - Pagination
- `severity` (enum) - Filter by severity: low, medium, high, critical
- `status` (enum) - Filter by status: open, investigating, resolved, closed
- `category` (enum) - Filter by category: data_breach, unauthorized_access, pii_exposure, system_compromise, other

**Permissions Required:** `security.read`

### Create Security Incident

**Endpoint:** `POST /security/incidents`

**Request Body:**
```json
{
  "title": "Unauthorized access attempt detected",
  "description": "Multiple failed login attempts from suspicious IP addresses",
  "severity": "high",
  "category": "unauthorized_access",
  "affected_users": 0,
  "affected_documents": 0,
  "data_types_affected": []
}
```

**Permissions Required:** `security.write`

### Update Security Incident

**Endpoint:** `PUT /security/incidents/{incident_id}`

**Request Body:**
```json
{
  "status": "investigating",
  "assigned_to": "user-123",
  "resolution_notes": "Investigation in progress. IP addresses blocked."
}
```

**Permissions Required:** `security.write`

### Get Incident Statistics

**Endpoint:** `GET /security/incidents/stats`

**Query Parameters:**
- `days` (int, default: 30) - Number of days

**Response:**
```json
{
  "organization_id": "org-123",
  "period": {
    "days": 30,
    "start_date": "2024-12-13",
    "end_date": "2025-01-12"
  },
  "summary": {
    "total_incidents": 17,
    "critical_incidents": 2,
    "open_incidents": 5,
    "avg_resolution_hours": 8.5
  },
  "by_severity": {
    "critical": 2,
    "high": 5,
    "medium": 8,
    "low": 2
  },
  "by_status": {
    "open": 5,
    "investigating": 3,
    "resolved": 8,
    "closed": 1
  },
  "trends": [
    {
      "date": "2025-01-01",
      "count": 2
    }
  ],
  "generated_at": "2025-01-12T10:30:00Z"
}
```

## Compliance Audits

### List Compliance Audits

**Endpoint:** `GET /security/audits`

**Query Parameters:**
- Pagination parameters
- `framework` (enum) - Filter by framework: gdpr, hds, iso27001, soc2, custom
- `status` (enum) - Filter by status: planned, in_progress, completed, failed
- `audit_type` (enum) - Filter by type: internal, external, regulatory, certification

### Create Compliance Audit

**Endpoint:** `POST /security/audits`

**Request Body:**
```json
{
  "audit_type": "internal",
  "framework": "gdpr",
  "title": "Q1 2025 GDPR Compliance Review",
  "description": "Quarterly review of data processing activities",
  "scope": "All data processing activities involving personal data",
  "planned_date": "2025-02-01",
  "auditor_name": "Jane Smith, DPO"
}
```

### Update Compliance Audit

**Endpoint:** `PUT /security/audits/{audit_id}`

**Request Body:**
```json
{
  "status": "completed",
  "score": 85,
  "findings": [
    {
      "category": "data_retention",
      "severity": "medium",
      "description": "Some documents lack clear retention policies",
      "recommendation": "Implement automated retention policy enforcement"
    }
  ],
  "recommendations": "Overall compliance is good. Focus on data retention automation."
}
```

## Data Processing Activities (GDPR)

### List Data Processing Activities

**Endpoint:** `GET /security/data-processing`

### Create Data Processing Activity

**Endpoint:** `POST /security/data-processing`

**Request Body:**
```json
{
  "name": "Customer Support Chat Processing",
  "description": "Processing of customer inquiries and support conversations",
  "purpose": "Provide customer support and improve service quality",
  "legal_basis": "legitimate_interest",
  "data_categories": ["contact_data", "conversation_content"],
  "data_subjects": ["customers", "prospects"],
  "automated_processing": true,
  "profiling_involved": false,
  "retention_period_months": 24,
  "third_parties_involved": false,
  "privacy_impact_score": 6,
  "risk_mitigation_measures": "Data encryption, access controls, regular audits"
}
```

## Compliance Reports

### Generate GDPR Register

**Endpoint:** `GET /security/reports/gdpr-register`

**Response:**
```json
{
  "organization_id": "org-123",
  "organization_name": "Acme Corp",
  "generated_at": "2025-01-12T10:30:00Z",
  "summary": {
    "total_activities": 12,
    "high_risk_activities": 3,
    "automated_processing_count": 8,
    "third_party_processing_count": 2
  },
  "activities": [],
  "by_legal_basis": {
    "consent": [],
    "legitimate_interest": [],
    "contract": []
  },
  "high_risk_activities": []
}
```

### Get Security Dashboard

**Endpoint:** `GET /security/reports/security-dashboard`

**Response:**
```json
{
  "organization_id": "org-123",
  "period": {
    "days": 30,
    "start_date": "2024-12-13",
    "end_date": "2025-01-12"
  },
  "security_posture": {
    "risk_level": "medium",
    "incidents_summary": {
      "total_incidents": 17,
      "critical_incidents": 2,
      "open_incidents": 5
    },
    "compliance_score": 85.3,
    "pii_incidents": 1
  },
  "recent_audits": [],
  "recommendations": [
    {
      "priority": "high",
      "category": "incident_response",
      "title": "Improve incident response time",
      "description": "Current average resolution time is above target."
    }
  ],
  "generated_at": "2025-01-12T10:30:00Z"
}
```

---

# Billing & Subscriptions API

## Subscription Plans

### List Available Plans

**Endpoint:** `GET /billing/plans`

**Response:**
```json
[
  {
    "id": "plan-starter",
    "name": "Starter",
    "description": "Perfect for small teams getting started",
    "price_cents": 4900,
    "billing_interval": "monthly",
    "features": {
      "maxDocuments": 100,
      "maxUsers": 3,
      "maxTokensPerMonth": 50000,
      "maxStorageMB": 1000,
      "advancedAnalytics": false,
      "prioritySupport": false,
      "sso": false,
      "apiAccess": false
    },
    "active": true
  }
]
```

## Current Subscription

### Get Current Subscription

**Endpoint:** `GET /billing/subscription`

**Response:**
```json
{
  "id": "sub-123",
  "organization_id": "org-123",
  "plan": {
    "id": "plan-team",
    "name": "Team",
    "description": "Great for growing teams",
    "price_cents": 14900,
    "billing_interval": "monthly",
    "features": {
      "maxDocuments": 500,
      "maxUsers": 10,
      "maxTokensPerMonth": 200000,
      "maxStorageMB": 5000,
      "advancedAnalytics": true,
      "prioritySupport": false,
      "sso": false,
      "apiAccess": true
    },
    "active": true
  },
  "status": "active",
  "current_period_start": "2025-01-01T00:00:00Z",
  "current_period_end": "2025-01-31T23:59:59Z",
  "trial_end": null,
  "next_invoice_date": "2025-01-31T23:59:59Z",
  "created_at": "2024-12-01T00:00:00Z"
}
```

**Permissions Required:** `billing.read`

### Change Subscription Plan

**Endpoint:** `POST /billing/subscription/change-plan`

**Request Body:**
```json
{
  "new_plan_id": "plan-business"
}
```

**Permissions Required:** `billing.write`

**Response:**
```json
{
  "success": true,
  "message": "Subscription plan changed successfully",
  "data": {
    "old_plan": "Team",
    "new_plan": "Business",
    "proration_amount_cents": 1250
  },
  "timestamp": "2025-01-12T10:30:00Z"
}
```

## Usage Tracking

### Get Usage History

**Endpoint:** `GET /billing/usage`

**Query Parameters:**
- `months` (int, default: 3, max: 12) - Number of months

**Response:**
```json
[
  {
    "organization_id": "org-123",
    "period_start": "2025-01-01",
    "period_end": "2025-01-31",
    "documents_processed": 127,
    "tokens_used": 45000,
    "storage_used_mb": 2400,
    "api_calls": 1250,
    "total_cost_cents": 425,
    "token_cost_cents": 350,
    "storage_cost_cents": 75
  }
]
```

### Get Current Month Usage

**Endpoint:** `GET /billing/usage/current`

**Response:**
```json
{
  "current_period": {
    "start": "2025-01-01",
    "end": "2025-01-12"
  },
  "usage": {
    "documents": {
      "used": 127,
      "limit": 500,
      "percentage": 25.4
    },
    "tokens": {
      "used": 45000,
      "limit": 200000,
      "percentage": 22.5
    },
    "storage": {
      "used_mb": 2400,
      "limit_mb": 5000,
      "percentage": 48.0
    }
  },
  "costs": {
    "total_cents": 425,
    "breakdown": {
      "tokens": 350,
      "storage": 75,
      "other": 0
    }
  },
  "projected_costs": {
    "total_cents": 1050,
    "token_cents": 865,
    "storage_cents": 185
  },
  "warnings": [
    {
      "type": "usage",
      "resource": "storage",
      "severity": "medium",
      "message": "Storage usage is at 48.0% of limit"
    }
  ]
}
```

## Invoice Management

### List Invoices

**Endpoint:** `GET /billing/invoices`

**Query Parameters:**
- Pagination parameters
- `status` (enum) - Filter by status: pending, paid, overdue, void

### Get Specific Invoice

**Endpoint:** `GET /billing/invoices/{invoice_id}`

**Response:**
```json
{
  "id": "inv-123",
  "organization_id": "org-123",
  "invoice_number": "INV-2025-001",
  "amount_cents": 14900,
  "currency": "EUR",
  "status": "paid",
  "due_date": "2025-01-31",
  "paid_at": "2025-01-15T10:00:00Z",
  "line_items": [
    {
      "description": "Team Plan - January 2025",
      "amount_cents": 14900,
      "quantity": 1,
      "type": "subscription"
    }
  ],
  "pdf_url": "https://cdn.example.com/invoices/inv-123.pdf",
  "created_at": "2025-01-01T00:00:00Z"
}
```

### Pay Invoice (Simulation)

**Endpoint:** `POST /billing/invoices/{invoice_id}/pay`

**Request Body:**
```json
{
  "payment_method_id": "pm_123"
}
```

---

# Playground & Templates API

## Prompt Templates

### List Prompt Templates

**Endpoint:** `GET /playground/templates`

**Query Parameters:**
- Pagination parameters
- `category` (string) - Filter by category
- `status` (enum) - Filter by status: draft, active, archived
- `search` (string) - Search in name/description

### Create Prompt Template

**Endpoint:** `POST /playground/templates`

**Request Body:**
```json
{
  "name": "FAQ Response Template",
  "description": "Template for generating FAQ responses",
  "category": "faq",
  "system_prompt": "You are a helpful customer service assistant. Answer questions clearly and concisely based on the provided context.",
  "user_prompt_template": "Question: {question}\n\nContext: {context}\n\nPlease provide a helpful answer based on the context provided.",
  "variables": [
    {
      "name": "question",
      "type": "string",
      "description": "The customer's question",
      "required": true
    },
    {
      "name": "context", 
      "type": "string",
      "description": "Relevant context from knowledge base",
      "required": true
    }
  ],
  "model_config": {
    "temperature": 0.1,
    "max_tokens": 1000,
    "top_p": 1.0,
    "frequency_penalty": 0.0,
    "presence_penalty": 0.0
  }
}
```

**Permissions Required:** `documents.write`

### Get Prompt Template

**Endpoint:** `GET /playground/templates/{template_id}`

### Update Prompt Template

**Endpoint:** `PUT /playground/templates/{template_id}`

**Query Parameters:**
- `create_new_version` (bool, default: false) - Create new version instead of updating

### Delete Prompt Template

**Endpoint:** `DELETE /playground/templates/{template_id}`

**Permissions Required:** `documents.delete`

## Template Execution

### Execute Prompt Template

**Endpoint:** `POST /playground/templates/{template_id}/execute`

**Request Body:**
```json
{
  "template_id": "template-123",
  "variables": {
    "question": "What is your return policy?",
    "context": "Our company offers 30-day returns on all products..."
  },
  "save_execution": true
}
```

**Response:**
```json
{
  "id": "exec-123",
  "template_id": "template-123",
  "rendered_prompt": "Question: What is your return policy?\n\nContext: Our company offers 30-day returns...\n\nPlease provide a helpful answer...",
  "output": "Our return policy allows you to return any product within 30 days of purchase...",
  "response_time": 1.234,
  "cost_cents": 3,
  "tokens_used": 150,
  "executed_at": "2025-01-12T10:30:00Z"
}
```

### Get Template Execution History

**Endpoint:** `GET /playground/templates/{template_id}/executions`

**Query Parameters:**
- Pagination parameters

## Template Analytics

### Get Template Analytics

**Endpoint:** `GET /playground/templates/{template_id}/analytics`

**Query Parameters:**
- `days` (int, default: 30) - Number of days

**Response:**
```json
{
  "template_id": "template-123",
  "template_name": "FAQ Response Template",
  "period": {
    "days": 30,
    "start_date": "2024-12-13",
    "end_date": "2025-01-12"
  },
  "summary": {
    "total_executions": 145,
    "avg_response_time": 1.23,
    "total_cost_cents": 435,
    "avg_cost_cents": 3.0,
    "total_tokens": 21750,
    "avg_rating": 4.2
  },
  "trends": {
    "daily_usage": [
      {
        "date": "2025-01-01",
        "executions": 12
      }
    ],
    "performance_trend": "improving"
  },
  "recommendations": [
    {
      "type": "performance",
      "priority": "low",
      "title": "Template performing well",
      "description": "This template shows good performance metrics."
    }
  ],
  "generated_at": "2025-01-12T10:30:00Z"
}
```

### Compare Templates

**Endpoint:** `POST /playground/templates/compare`

**Request Body:**
```json
{
  "template_ids": ["template-123", "template-456", "template-789"],
  "days": 30
}
```

**Response:**
```json
{
  "period": {
    "days": 30,
    "start_date": "2024-12-13",
    "end_date": "2025-01-12"
  },
  "templates": {
    "template-123": {
      "name": "FAQ Response Template",
      "category": "faq",
      "executions": 145,
      "avg_response_time": 1.23,
      "avg_cost_cents": 3.0,
      "avg_rating": 4.2
    }
  },
  "winners": {
    "fastest": {
      "id": "template-123",
      "name": "FAQ Response Template",
      "time": 1.23
    },
    "cheapest": {
      "id": "template-456",
      "name": "Simple Query Template",
      "cost": 2.1
    },
    "highest_rated": {
      "id": "template-789",
      "name": "Expert Analysis Template",
      "rating": 4.8
    }
  },
  "generated_at": "2025-01-12T10:30:00Z"
}
```

## Template Categories

### Get Template Categories

**Endpoint:** `GET /playground/categories`

**Response:**
```json
[
  {
    "name": "faq",
    "total_templates": 12,
    "active_templates": 8,
    "draft_templates": 4
  },
  {
    "name": "summary",
    "total_templates": 6,
    "active_templates": 5,
    "draft_templates": 1
  }
]
```

## Bulk Operations

### Bulk Template Operations

**Endpoint:** `POST /playground/templates/bulk`

**Request Body:**
```json
{
  "operation": "activate",
  "template_ids": ["template-123", "template-456"],
  "parameters": {
    "category": "production"
  }
}
```

**Operations:**
- `activate` - Set templates to active status
- `deactivate` - Set templates to draft status  
- `delete` - Delete templates
- `change_category` - Change template category (requires `category` in parameters)

**Response:**
```json
{
  "success_count": 2,
  "error_count": 0,
  "total_count": 2,
  "errors": [],
  "results": [
    {"id": "template-123", "status": "success"},
    {"id": "template-456", "status": "success"}
  ]
}
```

---

# Webhooks

## Webhook Events

The API supports webhooks for real-time notifications of important events.

### Supported Events

- `security.incident.created` - New security incident
- `security.incident.resolved` - Security incident resolved
- `billing.invoice.created` - New invoice generated
- `billing.payment.succeeded` - Payment processed successfully
- `billing.payment.failed` - Payment failed
- `organization.member.invited` - Member invited
- `organization.member.joined` - Member joined organization
- `compliance.audit.completed` - Compliance audit completed

### Webhook Payload

```json
{
  "id": "evt_123",
  "type": "security.incident.created",
  "created_at": "2025-01-12T10:30:00Z",
  "organization_id": "org-123",
  "data": {
    "incident_id": "incident-123",
    "severity": "high",
    "category": "unauthorized_access"
  }
}
```

### Webhook Verification

All webhook payloads include a signature header for verification:

```http
X-Webhook-Signature: sha256=<signature>
```

---

# SDKs and Integration

## Official SDKs

- **JavaScript/TypeScript**: `@raggy/api-client`
- **Python**: `raggy-api-client`
- **PHP**: `raggy/api-client`

## Example Integration (JavaScript)

```javascript
import { RaggyAPIClient } from '@raggy/api-client';

const client = new RaggyAPIClient({
  apiKey: 'your-jwt-token',
  organizationId: 'org-123',
  baseURL: 'https://api.raggy.com/api/v1'
});

// Get analytics dashboard
const dashboard = await client.analytics.getDashboard({
  period: '30d'
});

// Create security incident
const incident = await client.security.createIncident({
  title: 'Suspicious activity detected',
  severity: 'medium',
  category: 'unauthorized_access'
});

// Execute prompt template
const result = await client.playground.executeTemplate('template-123', {
  question: 'What is AI?',
  context: 'Artificial Intelligence is...'
});
```

---

# Changelog

## v1.0.0 (2025-01-12)
- Initial enterprise API release
- Multi-tenant organization management
- Advanced analytics and reporting
- Security and compliance features
- Billing and subscription management
- Prompt template management and playground
- Comprehensive permission system

---

# Support

For API support and questions:

- **Documentation**: https://docs.raggy.com/api
- **Email**: support@raggy.com  
- **Status Page**: https://status.raggy.com
- **GitHub**: https://github.com/raggy/api-issues