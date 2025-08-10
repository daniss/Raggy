#!/usr/bin/env python3
"""
Purge Proof Verification CLI Script

This script can:
1. Call the purge API endpoint and save the proof
2. Verify the cryptographic proof of an existing purge operation
3. Generate independent verification of purge state

Usage:
    python purge_proof.py --purge --api-url http://localhost:8000 --token <auth_token>
    python purge_proof.py --verify --proof-file proof.json
    python purge_proof.py --check-state --api-url http://localhost:8000
"""

import argparse
import json
import hashlib
import sys
import requests
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional


class PurgeProofManager:
    """Manager for purge proof operations."""
    
    def __init__(self, api_url: str = None, auth_token: str = None):
        self.api_url = api_url.rstrip('/') if api_url else None
        self.auth_token = auth_token
        
    def _make_request(self, endpoint: str, method: str = "GET", data: Dict = None) -> Dict[str, Any]:
        """Make HTTP request to API."""
        if not self.api_url:
            raise ValueError("API URL required for API operations")
        
        url = f"{self.api_url}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        
        try:
            if method == "POST":
                response = requests.post(url, headers=headers, json=data or {}, timeout=60)
            else:
                response = requests.get(url, headers=headers, timeout=30)
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            print(f"❌ API request failed: {e}")
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_detail = e.response.json()
                    print(f"   Error detail: {error_detail}")
                except:
                    print(f"   HTTP {e.response.status_code}: {e.response.text}")
            sys.exit(1)
    
    def execute_purge(self, output_file: str = None) -> Dict[str, Any]:
        """Execute purge operation and return proof."""
        print("🔥 Executing purge operation...")
        
        result = self._make_request("/api/v1/upload/purge", "POST")
        
        # Save proof to file
        proof_file = output_file or f"purge_proof_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        with open(proof_file, 'w') as f:
            json.dump(result, f, indent=2)
        
        success = result.get('success', False)
        verification_hash = result.get('verification_hash', 'N/A')
        
        if success:
            print(f"✅ Purge completed successfully!")
            print(f"   Verification hash: {verification_hash}")
            print(f"   Proof saved to: {proof_file}")
        else:
            print(f"⚠️  Purge completed with warnings!")
            print(f"   Verification hash: {verification_hash}")
            print(f"   Message: {result.get('message', 'Unknown error')}")
            print(f"   Proof saved to: {proof_file}")
        
        return result
    
    def verify_proof(self, proof_file: str) -> bool:
        """Verify cryptographic proof from file."""
        print(f"🔍 Verifying proof from {proof_file}...")
        
        try:
            with open(proof_file, 'r') as f:
                data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            print(f"❌ Failed to load proof file: {e}")
            return False
        
        # Extract proof data
        proof = data.get('proof', {})
        if not proof:
            print("❌ No proof data found in file")
            return False
        
        # Verify proof structure
        required_fields = [
            'version', 'purge_id', 'timestamp', 'organization_id',
            'cryptographic_verification', 'verification_details'
        ]
        
        missing_fields = [field for field in required_fields if field not in proof]
        if missing_fields:
            print(f"❌ Missing required fields: {missing_fields}")
            return False
        
        # Extract verification data
        crypto_verify = proof['cryptographic_verification']
        verify_details = proof['verification_details']
        
        pre_state_hash = crypto_verify.get('pre_state_hash')
        post_state_hash = crypto_verify.get('post_state_hash')
        verification_hash = crypto_verify.get('verification_hash')
        
        if not all([pre_state_hash, post_state_hash, verification_hash]):
            print("❌ Missing cryptographic verification hashes")
            return False
        
        # Recalculate hashes to verify integrity
        print("   Verifying pre-state hash...")
        pre_state = verify_details['pre_state']
        calculated_pre_hash = self._calculate_hash(pre_state)
        
        if calculated_pre_hash != pre_state_hash:
            print(f"❌ Pre-state hash mismatch!")
            print(f"   Expected: {pre_state_hash}")
            print(f"   Calculated: {calculated_pre_hash}")
            return False
        
        print("   Verifying post-state hash...")
        post_state = verify_details['post_state']
        calculated_post_hash = self._calculate_hash(post_state)
        
        if calculated_post_hash != post_state_hash:
            print(f"❌ Post-state hash mismatch!")
            print(f"   Expected: {post_state_hash}")
            print(f"   Calculated: {calculated_post_hash}")
            return False
        
        print("   Verifying verification hash...")
        verification_data = verify_details['verification_data']
        calculated_verify_hash = self._calculate_hash(verification_data)
        
        if calculated_verify_hash != verification_hash:
            print(f"❌ Verification hash mismatch!")
            print(f"   Expected: {verification_hash}")
            print(f"   Calculated: {calculated_verify_hash}")
            return False
        
        # Verify logical consistency
        operation_summary = proof['operation_summary']
        docs_before = operation_summary['documents_before']
        docs_after = operation_summary['documents_after']
        docs_deleted = operation_summary['documents_deleted']
        
        vectors_before = operation_summary['vectors_before']
        vectors_after = operation_summary['vectors_after']
        vectors_deleted = operation_summary['vectors_deleted']
        
        # Check deletion consistency
        if docs_deleted != (docs_before - docs_after):
            print(f"❌ Document deletion inconsistency: deleted={docs_deleted}, but before={docs_before}, after={docs_after}")
            return False
        
        if vectors_deleted != (vectors_before - vectors_after):
            print(f"❌ Vector deletion inconsistency: deleted={vectors_deleted}, but before={vectors_before}, after={vectors_after}")
            return False
        
        # Check if purge was successful
        purge_successful = proof.get('success', False)
        expected_empty = docs_after == 0 and vectors_after == 0
        
        print(f"✅ Cryptographic verification passed!")
        print(f"   Version: {proof['version']}")
        print(f"   Purge ID: {proof['purge_id']}")
        print(f"   Timestamp: {proof['timestamp']}")
        print(f"   Organization: {proof['organization_id']}")
        print(f"   Documents: {docs_before} → {docs_after} (deleted: {docs_deleted})")
        print(f"   Vectors: {vectors_before} → {vectors_after} (deleted: {vectors_deleted})")
        print(f"   Purge successful: {purge_successful}")
        print(f"   Data fully purged: {expected_empty}")
        print(f"   Verification hash: {verification_hash}")
        
        return True
    
    def check_current_state(self) -> Dict[str, Any]:
        """Check current state of the system."""
        print("📊 Checking current system state...")
        
        try:
            # Try to get upload stats which includes document counts
            stats = self._make_request("/api/v1/upload/stats")
            
            collection_stats = stats.get('collection_stats', {})
            total_vectors = collection_stats.get('total_vectors', 0)
            total_documents = collection_stats.get('total_documents', 0)
            
            print(f"   Current documents: {total_documents}")
            print(f"   Current vectors: {total_vectors}")
            print(f"   Demo org ID: {stats.get('demo_org_id', 'N/A')}")
            
            if total_documents == 0 and total_vectors == 0:
                print("✅ System appears to be in purged state")
            else:
                print("⚠️  System contains data - not fully purged")
            
            return stats
            
        except Exception as e:
            print(f"❌ Failed to check system state: {e}")
            return {}
    
    def _calculate_hash(self, data: Dict[str, Any]) -> str:
        """Calculate SHA256 hash of data (same as server-side)."""
        json_str = json.dumps(data, sort_keys=True)
        return hashlib.sha256(json_str.encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description="Purge Proof Management CLI")
    parser.add_argument('--api-url', help='API base URL (e.g., http://localhost:8000)')
    parser.add_argument('--token', help='Authentication token')
    
    # Operation modes
    parser.add_argument('--purge', action='store_true', help='Execute purge operation')
    parser.add_argument('--verify', action='store_true', help='Verify existing proof')
    parser.add_argument('--check-state', action='store_true', help='Check current system state')
    
    # File operations
    parser.add_argument('--proof-file', help='Path to proof file (for --verify)')
    parser.add_argument('--output-file', help='Output file for purge proof (for --purge)')
    
    args = parser.parse_args()
    
    # Validate arguments
    if not any([args.purge, args.verify, args.check_state]):
        print("❌ Must specify one operation: --purge, --verify, or --check-state")
        sys.exit(1)
    
    if args.verify and not args.proof_file:
        print("❌ --verify requires --proof-file")
        sys.exit(1)
    
    if (args.purge or args.check_state) and not args.api_url:
        print("❌ --purge and --check-state require --api-url")
        sys.exit(1)
    
    # Initialize manager
    manager = PurgeProofManager(args.api_url, args.token)
    
    try:
        if args.purge:
            result = manager.execute_purge(args.output_file)
            sys.exit(0 if result.get('success', False) else 1)
        
        elif args.verify:
            success = manager.verify_proof(args.proof_file)
            sys.exit(0 if success else 1)
        
        elif args.check_state:
            manager.check_current_state()
            sys.exit(0)
    
    except KeyboardInterrupt:
        print("\n⏹️  Operation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"💥 Unexpected error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()