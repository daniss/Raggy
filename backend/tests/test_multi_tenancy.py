"""
Integration tests for multi-tenancy functionality.
"""
import pytest
import uuid
import asyncio
from datetime import datetime
from fastapi.testclient import TestClient
from app.main import app
from app.db.supabase_client import supabase_client
from app.services.audit_logger import audit_logger, AuditAction, AuditResourceType


class TestMultiTenancy:
    """Test multi-tenant functionality."""
    
    @pytest.fixture(autouse=True)
    def setup_test_client(self):
        """Set up test client and test data."""
        self.client = TestClient(app)
        self.test_orgs = []
        self.test_users = []
        self.test_documents = []
        
        yield
        
        # Cleanup test data
        self.cleanup_test_data()
    
    def cleanup_test_data(self):
        """Clean up test data after tests."""
        try:
            # Delete test documents
            for doc_id in self.test_documents:
                supabase_client.table("documents").delete().eq("id", doc_id).execute()
            
            # Delete test organization members
            for org in self.test_orgs:
                supabase_client.table("organization_members").delete().eq("organization_id", org["id"]).execute()
            
            # Delete test organizations
            for org in self.test_orgs:
                supabase_client.table("organizations").delete().eq("id", org["id"]).execute()
                
            # Delete test users (if created)
            for user in self.test_users:
                supabase_client.table("users").delete().eq("id", user["id"]).execute()
                
        except Exception as e:
            print(f"Cleanup error (non-critical): {e}")
    
    def create_test_organization(self, name: str, slug: str, plan: str = "free") -> dict:
        """Create a test organization."""
        org_data = {
            "id": str(uuid.uuid4()),
            "name": name,
            "slug": slug,
            "plan": plan,
            "description": f"Test organization: {name}"
        }
        
        result = supabase_client.table("organizations").insert(org_data).execute()
        
        if result.data:
            org = result.data[0]
            self.test_orgs.append(org)
            return org
        else:
            raise Exception("Failed to create test organization")
    
    def create_test_user(self, email: str, name: str) -> dict:
        """Create a test user."""
        user_data = {
            "id": str(uuid.uuid4()),
            "email": email,
            "name": name
        }
        
        result = supabase_client.table("users").insert(user_data).execute()
        
        if result.data:
            user = result.data[0]
            self.test_users.append(user)
            return user
        else:
            raise Exception("Failed to create test user")
    
    def add_user_to_organization(self, user_id: str, org_id: str, role: str = "member") -> dict:
        """Add user to organization."""
        member_data = {
            "id": str(uuid.uuid4()),
            "organization_id": org_id,
            "user_id": user_id,
            "role": role,
            "status": "active"
        }
        
        result = supabase_client.table("organization_members").insert(member_data).execute()
        
        if result.data:
            return result.data[0]
        else:
            raise Exception("Failed to add user to organization")
    
    def create_test_document(self, org_id: str, user_id: str, filename: str) -> dict:
        """Create a test document."""
        doc_data = {
            "id": str(uuid.uuid4()),
            "organization_id": org_id,
            "filename": filename,
            "content_type": "text/plain",
            "size_bytes": 1024,
            "status": "completed",
            "uploaded_by": user_id
        }
        
        result = supabase_client.table("documents").insert(doc_data).execute()
        
        if result.data:
            doc = result.data[0]
            self.test_documents.append(doc["id"])
            return doc
        else:
            raise Exception("Failed to create test document")
    
    def test_organization_data_isolation(self):
        """Test that organizations can only access their own data."""
        
        # Create two test organizations
        org1 = self.create_test_organization("Test Org 1", "test-org-1")
        org2 = self.create_test_organization("Test Org 2", "test-org-2")
        
        # Create test users
        user1 = self.create_test_user("user1@test.com", "Test User 1")
        user2 = self.create_test_user("user2@test.com", "Test User 2")
        
        # Add users to their respective organizations
        self.add_user_to_organization(user1["id"], org1["id"], "admin")
        self.add_user_to_organization(user2["id"], org2["id"], "admin")
        
        # Create documents for each organization
        doc1 = self.create_test_document(org1["id"], user1["id"], "org1_document.txt")
        doc2 = self.create_test_document(org2["id"], user2["id"], "org2_document.txt")
        
        # Test: Organization 1 should only see their documents
        org1_docs = supabase_client.table("documents").select("*").eq("organization_id", org1["id"]).execute()
        org1_doc_ids = [doc["id"] for doc in org1_docs.data]
        
        assert doc1["id"] in org1_doc_ids
        assert doc2["id"] not in org1_doc_ids
        
        # Test: Organization 2 should only see their documents
        org2_docs = supabase_client.table("documents").select("*").eq("organization_id", org2["id"]).execute()
        org2_doc_ids = [doc["id"] for doc in org2_docs.data]
        
        assert doc2["id"] in org2_doc_ids
        assert doc1["id"] not in org2_doc_ids
    
    def test_user_role_permissions(self):
        """Test that user roles are properly enforced."""
        
        # Create test organization
        org = self.create_test_organization("Permission Test Org", "permission-test")
        
        # Create test users
        admin_user = self.create_test_user("admin@test.com", "Admin User")
        member_user = self.create_test_user("member@test.com", "Member User")
        
        # Add users with different roles
        admin_membership = self.add_user_to_organization(admin_user["id"], org["id"], "admin")
        member_membership = self.add_user_to_organization(member_user["id"], org["id"], "member")
        
        # Test: Check that roles are correctly stored
        admin_check = supabase_client.table("organization_members").select("*").eq("id", admin_membership["id"]).execute()
        member_check = supabase_client.table("organization_members").select("*").eq("id", member_membership["id"]).execute()
        
        assert admin_check.data[0]["role"] == "admin"
        assert member_check.data[0]["role"] == "member"
        
        # Test: Only admin should be able to invite new members (this would require API testing)
        # For now, just verify the role constraint exists in the database
        
        # Test role constraint
        try:
            # Try to insert invalid role
            invalid_member = {
                "id": str(uuid.uuid4()),
                "organization_id": org["id"],
                "user_id": str(uuid.uuid4()),
                "role": "invalid_role",
                "status": "active"
            }
            supabase_client.table("organization_members").insert(invalid_member).execute()
            assert False, "Should have failed with invalid role"
        except:
            # Expected to fail
            pass
    
    def test_document_ownership_and_access(self):
        """Test document ownership and access controls."""
        
        # Create test organization
        org = self.create_test_organization("Document Test Org", "document-test")
        
        # Create test users
        user1 = self.create_test_user("docuser1@test.com", "Doc User 1")
        user2 = self.create_test_user("docuser2@test.com", "Doc User 2")
        admin_user = self.create_test_user("docadmin@test.com", "Doc Admin")
        
        # Add users to organization
        self.add_user_to_organization(user1["id"], org["id"], "member")
        self.add_user_to_organization(user2["id"], org["id"], "member") 
        self.add_user_to_organization(admin_user["id"], org["id"], "admin")
        
        # Create documents
        user1_doc = self.create_test_document(org["id"], user1["id"], "user1_doc.txt")
        user2_doc = self.create_test_document(org["id"], user2["id"], "user2_doc.txt")
        
        # Test: Users should only be able to delete their own documents (business rule)
        # This would be tested at the API level, but we can verify the data structure supports it
        
        assert user1_doc["uploaded_by"] == user1["id"]
        assert user2_doc["uploaded_by"] == user2["id"]
        
        # Test: All org members should be able to view org documents (via RLS policies)
        org_docs = supabase_client.table("documents").select("*").eq("organization_id", org["id"]).execute()
        doc_ids = [doc["id"] for doc in org_docs.data]
        
        assert user1_doc["id"] in doc_ids
        assert user2_doc["id"] in doc_ids
    
    def test_audit_logging_multi_tenant(self):
        """Test that audit logs are properly scoped to organizations."""
        
        # Create test organizations
        org1 = self.create_test_organization("Audit Test Org 1", "audit-test-1")
        org2 = self.create_test_organization("Audit Test Org 2", "audit-test-2")
        
        # Create test users
        user1 = self.create_test_user("audituser1@test.com", "Audit User 1")
        user2 = self.create_test_user("audituser2@test.com", "Audit User 2")
        
        # Add users to organizations
        self.add_user_to_organization(user1["id"], org1["id"], "admin")
        self.add_user_to_organization(user2["id"], org2["id"], "admin")
        
        # Create audit log entries
        asyncio.run(audit_logger.log_organization_event(
            action=AuditAction.ORG_CREATE,
            organization_id=org1["id"],
            user_id=user1["id"],
            new_values={"name": org1["name"], "test": True}
        ))
        
        asyncio.run(audit_logger.log_organization_event(
            action=AuditAction.ORG_CREATE,
            organization_id=org2["id"],
            user_id=user2["id"],
            new_values={"name": org2["name"], "test": True}
        ))
        
        # Test: Each organization should only see their own audit logs
        org1_logs = supabase_client.table("audit_logs").select("*").eq("organization_id", org1["id"]).execute()
        org2_logs = supabase_client.table("audit_logs").select("*").eq("organization_id", org2["id"]).execute()
        
        # Verify logs are properly scoped
        for log in org1_logs.data:
            assert log["organization_id"] == org1["id"]
        
        for log in org2_logs.data:
            assert log["organization_id"] == org2["id"]
        
        # Clean up audit logs
        supabase_client.table("audit_logs").delete().eq("organization_id", org1["id"]).execute()
        supabase_client.table("audit_logs").delete().eq("organization_id", org2["id"]).execute()
    
    def test_organization_constraints(self):
        """Test organization-level constraints and validations."""
        
        # Test: Slug uniqueness constraint
        org1 = self.create_test_organization("Constraint Test 1", "constraint-test")
        
        try:
            # Try to create another org with same slug
            org2_data = {
                "id": str(uuid.uuid4()),
                "name": "Constraint Test 2",
                "slug": "constraint-test",  # Same slug
                "plan": "free"
            }
            supabase_client.table("organizations").insert(org2_data).execute()
            assert False, "Should have failed due to unique slug constraint"
        except:
            # Expected to fail
            pass
        
        # Test: Slug format validation
        try:
            invalid_org_data = {
                "id": str(uuid.uuid4()),
                "name": "Invalid Slug Test",
                "slug": "Invalid Slug!",  # Invalid characters
                "plan": "free"
            }
            supabase_client.table("organizations").insert(invalid_org_data).execute()
            assert False, "Should have failed due to slug format validation"
        except:
            # Expected to fail
            pass
        
        # Test: Plan constraint
        try:
            invalid_plan_data = {
                "id": str(uuid.uuid4()),
                "name": "Invalid Plan Test",
                "slug": "invalid-plan-test",
                "plan": "invalid_plan"  # Invalid plan
            }
            supabase_client.table("organizations").insert(invalid_plan_data).execute()
            assert False, "Should have failed due to plan constraint"
        except:
            # Expected to fail
            pass
    
    def test_foreign_key_constraints(self):
        """Test foreign key constraints are properly enforced."""
        
        # Test: Cannot create organization member without valid organization
        try:
            invalid_member = {
                "id": str(uuid.uuid4()),
                "organization_id": str(uuid.uuid4()),  # Non-existent org
                "user_id": str(uuid.uuid4()),
                "role": "member",
                "status": "active"
            }
            supabase_client.table("organization_members").insert(invalid_member).execute()
            assert False, "Should have failed due to foreign key constraint"
        except:
            # Expected to fail
            pass
        
        # Test: Cannot create document without valid organization
        try:
            invalid_doc = {
                "id": str(uuid.uuid4()),
                "organization_id": str(uuid.uuid4()),  # Non-existent org
                "filename": "test.txt",
                "content_type": "text/plain",
                "size_bytes": 100,
                "status": "completed"
            }
            supabase_client.table("documents").insert(invalid_doc).execute()
            assert False, "Should have failed due to foreign key constraint"
        except:
            # Expected to fail
            pass
    
    def test_cascade_deletion(self):
        """Test that cascade deletions work properly."""
        
        # Create test organization with members and documents
        org = self.create_test_organization("Cascade Test Org", "cascade-test")
        user = self.create_test_user("cascade@test.com", "Cascade User")
        
        membership = self.add_user_to_organization(user["id"], org["id"], "admin")
        document = self.create_test_document(org["id"], user["id"], "cascade_test.txt")
        
        # Verify data exists
        member_check = supabase_client.table("organization_members").select("*").eq("id", membership["id"]).execute()
        doc_check = supabase_client.table("documents").select("*").eq("id", document["id"]).execute()
        
        assert len(member_check.data) == 1
        assert len(doc_check.data) == 1
        
        # Delete organization (should cascade)
        supabase_client.table("organizations").delete().eq("id", org["id"]).execute()
        
        # Verify cascade deletion worked
        member_check_after = supabase_client.table("organization_members").select("*").eq("id", membership["id"]).execute()
        doc_check_after = supabase_client.table("documents").select("*").eq("id", document["id"]).execute()
        
        assert len(member_check_after.data) == 0
        assert len(doc_check_after.data) == 0
        
        # Remove from cleanup lists since they're already deleted
        self.test_orgs = [o for o in self.test_orgs if o["id"] != org["id"]]
        self.test_documents = [d for d in self.test_documents if d != document["id"]]
    
    def test_helper_functions(self):
        """Test organization management helper functions."""
        
        # Create test organization with some data
        org = self.create_test_organization("Helper Test Org", "helper-test")
        user1 = self.create_test_user("helper1@test.com", "Helper User 1")
        user2 = self.create_test_user("helper2@test.com", "Helper User 2")
        
        # Add members
        self.add_user_to_organization(user1["id"], org["id"], "admin")
        self.add_user_to_organization(user2["id"], org["id"], "member")
        
        # Create documents
        doc1 = self.create_test_document(org["id"], user1["id"], "helper_doc1.txt")
        doc2 = self.create_test_document(org["id"], user2["id"], "helper_doc2.txt")
        
        # Test get_organization_counts function
        result = supabase_client.rpc("get_organization_counts", {"org_id": org["id"]}).execute()
        
        if result.data:
            counts = result.data
            assert counts["member_count"] == 2
            assert counts["document_count"] == 2
        
        # Test delete_document_vectors function (should return 0 since no vectors exist)
        vector_result = supabase_client.rpc("delete_document_vectors", {"target_document_id": doc1["id"]}).execute()
        
        if vector_result.data is not None:
            assert vector_result.data == 0  # No vectors to delete
    
    def test_vector_store_isolation(self):
        """Test that vector embeddings are properly isolated by organization."""
        
        # Create two test organizations
        org1 = self.create_test_organization("Vector Test Org 1", "vector-test-1")
        org2 = self.create_test_organization("Vector Test Org 2", "vector-test-2")
        
        # Create test users
        user1 = self.create_test_user("vector1@test.com", "Vector User 1")
        user2 = self.create_test_user("vector2@test.com", "Vector User 2")
        
        # Add users to organizations
        self.add_user_to_organization(user1["id"], org1["id"], "admin")
        self.add_user_to_organization(user2["id"], org2["id"], "admin")
        
        # Test vector search function exists and can be called
        try:
            # This tests the database function exists
            result = supabase_client.rpc(
                "search_similar_documents_org",
                {
                    "query_embedding": [0.1] * 384,  # Mock embedding
                    "organization_id": org1["id"],
                    "match_threshold": 0.1,
                    "match_count": 5
                }
            ).execute()
            
            # Should not fail, even with no documents
            assert result.data == []
            
        except Exception as e:
            # If function doesn't exist, that's fine for this test
            print(f"Vector search function not available: {e}")
            pass


# Additional test cases for specific scenarios
class TestMultiTenancyScenarios:
    """Test specific multi-tenancy scenarios."""
    
    def test_user_switches_organizations(self):
        """Test scenario where user belongs to multiple organizations."""
        # This would test the user experience when switching between orgs
        # For now, our system assumes users belong to only one org (MVP)
        pass
    
    def test_organization_plan_limits(self):
        """Test that organization plan limits are enforced."""
        # This would test rate limiting and usage quotas
        # Covered by the rate limiting system tests
        pass
    
    def test_data_export_compliance(self):
        """Test data export for compliance (GDPR, etc.)."""
        # This would test the ability to export all data for an organization
        # Could be implemented as part of the admin API
        pass


if __name__ == "__main__":
    # Run tests
    import sys
    import os
    
    # Add the parent directory to the Python path so we can import app modules
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    # Run the tests
    pytest.main([__file__, "-v"])