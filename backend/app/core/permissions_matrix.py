"""
Permission matrix and role-based access control system.
Implements the comprehensive permission model per specification.
"""
from typing import Dict, List, Set, Optional
from enum import Enum

# =============================================================================
# ROLES DEFINITION
# =============================================================================

class UserRole(str, Enum):
    """User roles with hierarchical permissions."""
    OWNER = "owner"  # Propriétaire
    ADMIN = "admin"  # Administrateur
    KNOWLEDGE_MANAGER = "knowledge_manager"  # Gestionnaire Contenu
    USER = "user"  # Utilisateur
    OBSERVER = "observer"  # Lecteur
    BILLING_ADMIN = "billing_admin"  # Facturation
    SECURITY_ADMIN = "security_admin"  # Sécurité

# =============================================================================
# PERMISSION CODES
# =============================================================================

class Permission(str, Enum):
    """All available permission codes in the system."""
    # Document permissions
    DOCUMENTS_UPLOAD = "documents:upload"
    DOCUMENTS_DELETE = "documents:delete"
    DOCUMENTS_PURGE = "documents:purge"
    DOCUMENTS_VIEW = "documents:view"
    
    # Assistant permissions
    ASSISTANT_ASK = "assistant:ask"
    
    # Usage and analytics
    USAGE_VIEW = "usage:view"
    
    # Compliance and security
    COMPLIANCE_VIEW = "compliance:view"
    COMPLIANCE_PURGE_PROOF = "compliance:purge_proof"
    AUDIT_LOGS_VIEW = "audit:logs_view"
    
    # Team management
    TEAM_MANAGE = "team:manage"
    
    # Organization settings
    ORG_SETTINGS = "org:settings"
    
    # Billing
    BILLING_VIEW = "billing:view"
    BILLING_MANAGE = "billing:manage"
    
    # API keys
    APIKEYS_MANAGE = "apikeys:manage"
    
    # Connectors
    CONNECTORS_MANAGE = "connectors:manage"
    
    # SSO
    SSO_MANAGE = "sso:manage"

# =============================================================================
# PERMISSION MATRIX
# =============================================================================

# Define which permissions each role has
ROLE_PERMISSIONS: Dict[UserRole, Set[Permission]] = {
    UserRole.OWNER: {
        # All permissions
        Permission.DOCUMENTS_UPLOAD,
        Permission.DOCUMENTS_DELETE,
        Permission.DOCUMENTS_PURGE,
        Permission.DOCUMENTS_VIEW,
        Permission.ASSISTANT_ASK,
        Permission.USAGE_VIEW,
        Permission.COMPLIANCE_VIEW,
        Permission.COMPLIANCE_PURGE_PROOF,
        Permission.AUDIT_LOGS_VIEW,
        Permission.TEAM_MANAGE,
        Permission.ORG_SETTINGS,
        Permission.BILLING_VIEW,
        Permission.BILLING_MANAGE,
        Permission.APIKEYS_MANAGE,
        Permission.CONNECTORS_MANAGE,
        Permission.SSO_MANAGE,
    },
    
    UserRole.ADMIN: {
        Permission.DOCUMENTS_UPLOAD,
        Permission.DOCUMENTS_DELETE,
        Permission.DOCUMENTS_PURGE,
        Permission.DOCUMENTS_VIEW,
        Permission.ASSISTANT_ASK,
        Permission.USAGE_VIEW,
        Permission.COMPLIANCE_VIEW,
        Permission.COMPLIANCE_PURGE_PROOF,
        Permission.AUDIT_LOGS_VIEW,
        Permission.TEAM_MANAGE,
        Permission.ORG_SETTINGS,
        Permission.APIKEYS_MANAGE,
        Permission.CONNECTORS_MANAGE,
        # No billing management or SSO for admin
    },
    
    UserRole.KNOWLEDGE_MANAGER: {
        Permission.DOCUMENTS_UPLOAD,
        Permission.DOCUMENTS_DELETE,
        Permission.DOCUMENTS_PURGE,
        Permission.DOCUMENTS_VIEW,
        Permission.ASSISTANT_ASK,
        Permission.COMPLIANCE_PURGE_PROOF,
        Permission.CONNECTORS_MANAGE,
        # Can manage content and connectors
    },
    
    UserRole.USER: {
        Permission.DOCUMENTS_VIEW,
        Permission.ASSISTANT_ASK,
        # Basic user can view and ask questions
    },
    
    UserRole.OBSERVER: {
        Permission.DOCUMENTS_VIEW,
        # Read-only access
    },
    
    UserRole.BILLING_ADMIN: {
        Permission.BILLING_VIEW,
        Permission.BILLING_MANAGE,
        # Only billing access
    },
    
    UserRole.SECURITY_ADMIN: {
        Permission.COMPLIANCE_VIEW,
        Permission.AUDIT_LOGS_VIEW,
        Permission.SSO_MANAGE,
        Permission.DOCUMENTS_VIEW,
        # Security and compliance focus
    },
}

# =============================================================================
# PLAN TIER FEATURES
# =============================================================================

class PlanTier(str, Enum):
    """Subscription plan tiers."""
    STARTER = "starter"
    PRO = "pro"
    ENTERPRISE = "enterprise"

# Features available per plan tier
TIER_FEATURES: Dict[PlanTier, Dict[str, any]] = {
    PlanTier.STARTER: {
        "document_limit": 100,
        "token_limit_month": 200000,
        "retention_days": 0,  # Manual purge only
        "max_users": 5,
        "advanced_analytics": False,
        "api_access": False,
        "sso": False,
        "connectors": False,
        "audit_logs": False,
        "custom_branding": False,
    },
    
    PlanTier.PRO: {
        "document_limit": 1000,
        "token_limit_month": 2000000,
        "retention_days": 90,
        "max_users": 25,
        "advanced_analytics": True,
        "api_access": True,
        "sso": False,
        "connectors": True,
        "audit_logs": True,
        "custom_branding": True,
    },
    
    PlanTier.ENTERPRISE: {
        "document_limit": 10000,
        "token_limit_month": 10000000,
        "retention_days": 365,  # Configurable
        "max_users": 100,
        "advanced_analytics": True,
        "api_access": True,
        "sso": True,
        "connectors": True,
        "audit_logs": True,
        "custom_branding": True,
        "dedicated_instance": True,
    },
}

# =============================================================================
# PERMISSION CHECKING FUNCTIONS
# =============================================================================

def get_user_permissions(roles: List[str]) -> Set[Permission]:
    """
    Get all permissions for a user based on their roles.
    Roles are additive - user gets union of all role permissions.
    
    Args:
        roles: List of role strings assigned to the user
        
    Returns:
        Set of Permission enums the user has
    """
    permissions = set()
    
    for role_str in roles:
        try:
            role = UserRole(role_str.lower())
            permissions.update(ROLE_PERMISSIONS.get(role, set()))
        except ValueError:
            # Invalid role, skip
            continue
    
    return permissions

def has_permission(user_roles: List[str], permission: Permission) -> bool:
    """
    Check if user with given roles has a specific permission.
    
    Args:
        user_roles: List of role strings assigned to the user
        permission: Permission to check
        
    Returns:
        True if user has the permission, False otherwise
    """
    user_permissions = get_user_permissions(user_roles)
    return permission in user_permissions

def has_any_permission(user_roles: List[str], permissions: List[Permission]) -> bool:
    """
    Check if user has any of the specified permissions.
    
    Args:
        user_roles: List of role strings assigned to the user
        permissions: List of permissions to check
        
    Returns:
        True if user has at least one of the permissions
    """
    user_permissions = get_user_permissions(user_roles)
    return any(perm in user_permissions for perm in permissions)

def has_all_permissions(user_roles: List[str], permissions: List[Permission]) -> bool:
    """
    Check if user has all of the specified permissions.
    
    Args:
        user_roles: List of role strings assigned to the user
        permissions: List of permissions to check
        
    Returns:
        True if user has all the permissions
    """
    user_permissions = get_user_permissions(user_roles)
    return all(perm in user_permissions for perm in permissions)

def get_tier_limits(tier: str) -> Dict[str, any]:
    """
    Get the limits and features for a plan tier.
    
    Args:
        tier: Plan tier string
        
    Returns:
        Dictionary of limits and features
    """
    try:
        plan_tier = PlanTier(tier.lower())
        return TIER_FEATURES.get(plan_tier, TIER_FEATURES[PlanTier.STARTER])
    except ValueError:
        # Invalid tier, return starter limits
        return TIER_FEATURES[PlanTier.STARTER]

def can_access_feature(tier: str, feature: str) -> bool:
    """
    Check if a plan tier has access to a specific feature.
    
    Args:
        tier: Plan tier string
        feature: Feature name to check
        
    Returns:
        True if tier has access to the feature
    """
    limits = get_tier_limits(tier)
    return limits.get(feature, False)

# =============================================================================
# ROLE HELPERS
# =============================================================================

def get_role_display_name(role: str) -> str:
    """Get the French display name for a role."""
    role_names = {
        UserRole.OWNER: "Propriétaire",
        UserRole.ADMIN: "Administrateur",
        UserRole.KNOWLEDGE_MANAGER: "Gestionnaire Contenu",
        UserRole.USER: "Utilisateur",
        UserRole.OBSERVER: "Lecteur",
        UserRole.BILLING_ADMIN: "Facturation",
        UserRole.SECURITY_ADMIN: "Sécurité",
    }
    
    try:
        role_enum = UserRole(role.lower())
        return role_names.get(role_enum, role)
    except ValueError:
        return role

def is_admin_role(role: str) -> bool:
    """Check if a role has administrative privileges."""
    admin_roles = {UserRole.OWNER, UserRole.ADMIN}
    try:
        role_enum = UserRole(role.lower())
        return role_enum in admin_roles
    except ValueError:
        return False

def can_manage_users(roles: List[str]) -> bool:
    """Check if user can manage other users."""
    return has_permission(roles, Permission.TEAM_MANAGE)

def can_view_billing(roles: List[str]) -> bool:
    """Check if user can view billing information."""
    return has_any_permission(roles, [Permission.BILLING_VIEW, Permission.BILLING_MANAGE])

# =============================================================================
# NAVIGATION VISIBILITY
# =============================================================================

def get_visible_navigation(roles: List[str], tier: str) -> List[str]:
    """
    Get list of navigation items visible to user based on roles and tier.
    
    Returns list of navigation item IDs that should be visible.
    """
    visible = ["dashboard", "documents", "assistant"]  # Always visible
    
    permissions = get_user_permissions(roles)
    tier_limits = get_tier_limits(tier)
    
    # Add items based on permissions and tier
    if tier in [PlanTier.PRO, PlanTier.ENTERPRISE]:
        visible.append("conversations")
        
        if Permission.USAGE_VIEW in permissions:
            visible.append("usage")
        
        if Permission.COMPLIANCE_VIEW in permissions:
            visible.append("compliance")
    
    if Permission.TEAM_MANAGE in permissions:
        visible.append("team")
    
    if Permission.ORG_SETTINGS in permissions:
        visible.append("settings")
    
    if Permission.APIKEYS_MANAGE in permissions and tier_limits.get("api_access"):
        visible.append("api_keys")
    
    if Permission.BILLING_VIEW in permissions or Permission.BILLING_MANAGE in permissions:
        visible.append("billing")
    
    if tier == PlanTier.ENTERPRISE:
        if Permission.CONNECTORS_MANAGE in permissions:
            visible.append("connectors")
        
        visible.append("environment")
        
        if Permission.SSO_MANAGE in permissions:
            visible.append("sso")
    
    visible.append("support")  # Always visible
    
    return visible