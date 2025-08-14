#!/usr/bin/env python3
"""
RAG Encryption Verification Script
===================================
Tests the complete encryption/decryption pipeline to ensure security implementation.
"""

import os
import sys
import base64
import asyncio
import logging
from security import SecurityManager

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EncryptionVerifier:
    """Comprehensive encryption verification suite"""
    
    def __init__(self):
        self.test_results = []
    
    def test_result(self, test_name: str, passed: bool, details: str = ""):
        """Record test result"""
        status = "✅ PASS" if passed else "❌ FAIL" 
        self.test_results.append((test_name, passed, details))
        logger.info(f"{status}: {test_name}")
        if details:
            logger.info(f"   Details: {details}")
        if not passed:
            logger.error(f"   FAILED: {test_name}")
    
    def test_master_key_generation(self):
        """Test master key generation and loading"""
        try:
            # Generate new master key
            master_key = SecurityManager.generate_master_key()
            self.test_result("Master key generation", True, f"Key length: {len(base64.b64decode(master_key))} bytes")
            
            # Test key format
            decoded = base64.b64decode(master_key)
            self.test_result("Master key format", len(decoded) == 32, f"Expected 32 bytes, got {len(decoded)}")
            
            return master_key
            
        except Exception as e:
            self.test_result("Master key generation", False, str(e))
            return None
    
    def test_security_manager_init(self, master_key: str):
        """Test SecurityManager initialization"""
        try:
            # Set environment variable
            os.environ['RAG_MASTER_KEY'] = master_key
            
            # Initialize SecurityManager
            security = SecurityManager()
            self.test_result("SecurityManager initialization", True, "Initialized with master key")
            
            return security
            
        except Exception as e:
            self.test_result("SecurityManager initialization", False, str(e))
            return None
    
    def test_dek_encryption_cycle(self, security: SecurityManager):
        """Test DEK generation and envelope encryption"""
        try:
            # Generate DEK
            dek = security._generate_dek()
            self.test_result("DEK generation", len(dek) == 32, f"DEK length: {len(dek)} bytes")
            
            # Encrypt DEK
            encrypted_dek = security._encrypt_dek(dek)
            self.test_result("DEK encryption", isinstance(encrypted_dek, str), f"Encrypted DEK type: {type(encrypted_dek)}")
            
            # Decrypt DEK
            decrypted_dek = security._decrypt_dek(encrypted_dek)
            self.test_result("DEK decryption", dek == decrypted_dek, "DEK round-trip successful")
            
            return dek
            
        except Exception as e:
            self.test_result("DEK encryption cycle", False, str(e))
            return None
    
    def test_content_encryption_cycle(self, security: SecurityManager, dek: bytes):
        """Test content encryption with AES-256-GCM"""
        try:
            # Test data
            original_text = "This is a confidential document chunk containing sensitive information. 🔒 Encrypted with AES-256-GCM!"
            org_id = "test-org-123"
            document_id = "test-doc-456"
            chunk_index = 0
            aad = f"{org_id}|{document_id}|{chunk_index}"
            
            # Encrypt content
            encrypted_data = security.encrypt_content(original_text, dek, aad)
            self.test_result("Content encryption", 'ciphertext' in encrypted_data, f"Encrypted data keys: {list(encrypted_data.keys())}")
            
            # Verify encrypted data structure
            has_required_fields = all(key in encrypted_data for key in ['ciphertext', 'nonce', 'aad'])
            self.test_result("Encrypted data structure", has_required_fields, "Contains ciphertext, nonce, and aad")
            
            # Decrypt content
            decrypted_text = security.decrypt_content(
                encrypted_data['ciphertext'],
                encrypted_data['nonce'],
                encrypted_data['aad'],
                dek
            )
            
            # Verify decryption
            self.test_result("Content decryption", original_text == decrypted_text, "Decrypted text matches original")
            
            # Test hash integrity
            content_hash = security.hash_content(original_text)
            integrity_check = security.validate_encryption_integrity(decrypted_text, content_hash)
            self.test_result("Content hash integrity", integrity_check, f"Hash: {content_hash[:16]}...")
            
            return encrypted_data
            
        except Exception as e:
            self.test_result("Content encryption cycle", False, str(e))
            return None
    
    def test_aad_tampering_protection(self, security: SecurityManager, dek: bytes):
        """Test Additional Authenticated Data tampering protection"""
        try:
            # Original data
            original_text = "Sensitive data"
            correct_aad = "org1|doc1|0"
            tampered_aad = "org2|doc1|0"  # Different org - should fail
            
            # Encrypt with correct AAD
            encrypted_data = security.encrypt_content(original_text, dek, correct_aad)
            
            # Try to decrypt with tampered AAD (should fail)
            try:
                security.decrypt_content(
                    encrypted_data['ciphertext'],
                    encrypted_data['nonce'], 
                    tampered_aad,  # Wrong AAD
                    dek
                )
                self.test_result("AAD tampering protection", False, "Decryption should have failed with wrong AAD")
            except Exception:
                self.test_result("AAD tampering protection", True, "Correctly rejected tampered AAD")
            
        except Exception as e:
            self.test_result("AAD tampering protection", False, str(e))
    
    def test_wrong_dek_protection(self, security: SecurityManager):
        """Test that wrong DEK fails decryption"""
        try:
            # Generate two different DEKs
            correct_dek = security._generate_dek()
            wrong_dek = security._generate_dek()
            
            # Encrypt with correct DEK
            original_text = "Secret data"
            aad = "org1|doc1|0"
            encrypted_data = security.encrypt_content(original_text, correct_dek, aad)
            
            # Try to decrypt with wrong DEK (should fail)
            try:
                security.decrypt_content(
                    encrypted_data['ciphertext'],
                    encrypted_data['nonce'],
                    aad,
                    wrong_dek  # Wrong DEK
                )
                self.test_result("Wrong DEK protection", False, "Decryption should have failed with wrong DEK")
            except Exception:
                self.test_result("Wrong DEK protection", True, "Correctly rejected wrong DEK")
            
        except Exception as e:
            self.test_result("Wrong DEK protection", False, str(e))
    
    def test_encryption_info(self, security: SecurityManager):
        """Test encryption information reporting"""
        try:
            info = security.get_encryption_info()
            
            expected_fields = ["algorithm", "key_size", "nonce_size", "envelope_encryption"]
            has_all_fields = all(field in info for field in expected_fields)
            self.test_result("Encryption info structure", has_all_fields, f"Info: {info}")
            
            # Verify algorithm details
            correct_algorithm = info.get("algorithm") == "AES-256-GCM"
            correct_key_size = info.get("key_size") == "256 bits"
            correct_nonce_size = info.get("nonce_size") == "96 bits"
            correct_envelope = info.get("envelope_encryption") == "KEK/DEK"
            
            all_correct = all([correct_algorithm, correct_key_size, correct_nonce_size, correct_envelope])
            self.test_result("Encryption algorithm details", all_correct, "Algorithm: AES-256-GCM, 256-bit keys, 96-bit nonce, KEK/DEK")
            
        except Exception as e:
            self.test_result("Encryption info", False, str(e))
    
    def run_all_tests(self):
        """Run complete encryption verification suite"""
        logger.info("🔐 Starting RAG Encryption Verification Suite")
        logger.info("=" * 60)
        
        # Test 1: Master Key Generation
        master_key = self.test_master_key_generation()
        if not master_key:
            logger.error("❌ Cannot proceed without master key")
            return False
        
        # Test 2: SecurityManager Initialization
        security = self.test_security_manager_init(master_key)
        if not security:
            logger.error("❌ Cannot proceed without SecurityManager")
            return False
        
        # Test 3: DEK Encryption Cycle
        dek = self.test_dek_encryption_cycle(security)
        if not dek:
            logger.error("❌ Cannot proceed without DEK")
            return False
        
        # Test 4: Content Encryption Cycle
        self.test_content_encryption_cycle(security, dek)
        
        # Test 5: Security Tests
        self.test_aad_tampering_protection(security, dek)
        self.test_wrong_dek_protection(security)
        
        # Test 6: Encryption Info
        self.test_encryption_info(security)
        
        # Summary
        logger.info("=" * 60)
        logger.info("📊 ENCRYPTION VERIFICATION SUMMARY")
        
        passed_tests = [result for result in self.test_results if result[1]]
        failed_tests = [result for result in self.test_results if not result[1]]
        
        logger.info(f"✅ Passed: {len(passed_tests)}/{len(self.test_results)} tests")
        if failed_tests:
            logger.error(f"❌ Failed: {len(failed_tests)} tests")
            for test_name, _, details in failed_tests:
                logger.error(f"   - {test_name}: {details}")
        
        overall_success = len(failed_tests) == 0
        if overall_success:
            logger.info("🎉 ALL ENCRYPTION TESTS PASSED - SECURITY IMPLEMENTATION VERIFIED")
        else:
            logger.error("💥 ENCRYPTION VERIFICATION FAILED - SECURITY ISSUES DETECTED")
        
        return overall_success

def main():
    """Main verification function"""
    verifier = EncryptionVerifier()
    
    try:
        success = verifier.run_all_tests()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        logger.info("Verification interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Verification failed with unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()