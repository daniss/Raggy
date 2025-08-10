# Archive - Raggy Multi-Tenant Features

This folder contains all the multi-tenant and enterprise features that were removed during the refactoring to create a streamlined single-client deployment package.

## Archived Components

### Backend

#### API Endpoints (`/backend/api/`)
- `advanced_analytics.py` - Complex analytics dashboards
- `analytics.py` - Organization-scoped analytics and reporting (Phase 1 cleanup)
- `audit.py` - Audit logging endpoints
- `jobs.py` - Background job management
- `metrics.py` - Detailed metrics collection
- `monitoring.py` - System monitoring endpoints
- `organizations.py` - Multi-tenant organization management
- `upload_complex.py` - Complex multi-tenant upload with batch processing (Phase 1 cleanup)
- `usage.py` - Usage tracking and limits

#### Core Modules (`/backend/core/`)
- `audit_middleware.py` - Request/response audit logging
- `org_rate_limiting.py` - Per-organization rate limiting
- `monitoring.py` - Health monitoring system

#### Services (`/backend/services/`)
- `audit_logger.py` - Audit log service
- `backup_service.py` - Automated backup system
- `batch_processor.py` - Batch document processing

#### Migrations (`/backend/migrations/`)
- `001_add_organizations.sql` - Multi-tenant database schema

### Frontend

#### Admin Section (`/frontend/app/admin/`)
- Full admin dashboard with:
  - Analytics views
  - Document management
  - Organization settings
  - User management

#### Analytics Section (`/frontend/app/analytics/`)
- Advanced analytics dashboard
- Usage metrics visualization
- Performance monitoring

## Why These Were Archived

These components were designed for a multi-tenant SaaS platform. The new business model focuses on single-client deployments at €15,000 each, making these features unnecessary complexity for individual client installations.

### Phase 1 Cleanup (Additional Archiving)

During Phase 1 cleanup, additional components were archived to further simplify the codebase:

- **analytics.py**: Complex organization-scoped analytics with time-series data, popular topics analysis, and multi-tenant filtering
- **upload_complex.py**: Original upload endpoint with batch processing, audit logging, organization permissions, and complex validation workflows

### Simplified Replacements

- **analytics.py** → Basic health metrics in system_health.py
- **upload_complex.py** → Streamlined upload.py with direct processing, demo org scoping, and simplified purge functionality

The simplified versions focus on core functionality without multi-tenant complexity, reducing maintenance burden and deployment complexity by ~90%.

## Restoration

If you need to restore any of these features:

1. Copy the required files back to their original locations
2. Re-add the imports in `main.py` for backend routers
3. Update navigation/routing for frontend components
4. Apply the multi-tenant migration if needed

## Original Architecture

The multi-tenant architecture included:
- Organization-based data isolation
- Per-org rate limiting
- Centralized monitoring and analytics
- Admin dashboard for managing multiple organizations
- Usage tracking and billing integration ready

These remain available for reference but are not needed for single-client deployments.