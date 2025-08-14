"""
Security Module - Encryption and Key Management
===============================================
Handles application-level encryption with envelope encryption (KEK/DEK).
AES-256-GCM encryption for all document chunks.
"""

import os
import base64
import secrets
import hashlib
import logging
from typing import Dict, Optional, Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes

logger = logging.getLogger(__name__)

class SecurityManager:
    """
    Manages encryption/decryption and key management for RAG content
    Uses envelope encryption: KEK (from env) encrypts DEK (per org)
    """
    
    def __init__(self):
        self.kek = self._load_master_kek()
        self.dek_cache = {}  # In-memory cache for DEKs
    
    def _load_master_kek(self) -> bytes:
        """Load the master Key Encryption Key from environment"""
        kek_b64 = os.getenv('RAG_MASTER_KEY')
        if not kek_b64:
            raise ValueError("RAG_MASTER_KEY environment variable not set")
        
        try:
            kek = base64.b64decode(kek_b64)
            if len(kek) != 32:  # 256 bits
                raise ValueError("KEK must be 32 bytes (256 bits)")
            return kek
        except Exception as e:
            raise ValueError(f"Invalid RAG_MASTER_KEY format: {e}")
    
    def _generate_dek(self) -> bytes:
        """Generate a new 256-bit Data Encryption Key"""
        return secrets.token_bytes(32)  # 256 bits
    
    def _encrypt_dek(self, dek: bytes) -> str:
        """Encrypt DEK with KEK using AES-256-GCM"""
        try:
            aesgcm = AESGCM(self.kek)
            nonce = secrets.token_bytes(12)  # 96-bit nonce for GCM
            ciphertext = aesgcm.encrypt(nonce, dek, None)
            
            # Return base64 encoded: nonce + ciphertext
            encrypted_dek = base64.b64encode(nonce + ciphertext).decode('utf-8')
            return encrypted_dek
            
        except Exception as e:
            logger.error(f"DEK encryption failed: {e}")
            raise
    
    def _decrypt_dek(self, encrypted_dek: str) -> bytes:
        """Decrypt DEK using KEK"""
        try:
            # Decode from base64
            encrypted_data = base64.b64decode(encrypted_dek)
            
            # Split nonce and ciphertext
            nonce = encrypted_data[:12]
            ciphertext = encrypted_data[12:]
            
            # Decrypt
            aesgcm = AESGCM(self.kek)
            dek = aesgcm.decrypt(nonce, ciphertext, None)
            
            return dek
            
        except Exception as e:
            logger.error(f"DEK decryption failed: {e}")
            raise
    
    async def get_or_create_dek(self, org_id: str) -> bytes:
        """
        Get existing DEK for organization or create a new one
        DEK is cached in memory for performance
        """
        # Check memory cache first
        if org_id in self.dek_cache:
            return self.dek_cache[org_id]
        
        try:
            from providers import SupabaseProvider
            supabase = SupabaseProvider()
            
            # Try to get existing DEK
            existing_dek = await supabase.get_org_dek(org_id)
            
            if existing_dek:
                # Decrypt and cache
                dek = self._decrypt_dek(existing_dek)
                self.dek_cache[org_id] = dek
                logger.info(f"Retrieved existing DEK for org {org_id}")
                return dek
            
            # Create new DEK
            dek = self._generate_dek()
            encrypted_dek = self._encrypt_dek(dek)
            
            # Store in database
            await supabase.store_org_dek(org_id, encrypted_dek)
            
            # Cache
            self.dek_cache[org_id] = dek
            logger.info(f"Created new DEK for org {org_id}")
            
            return dek
            
        except Exception as e:
            logger.error(f"DEK management failed for org {org_id}: {e}")
            raise
    
    async def get_dek(self, org_id: str) -> bytes:
        """Get existing DEK for organization (no creation)"""
        # Check memory cache first
        if org_id in self.dek_cache:
            return self.dek_cache[org_id]
        
        try:
            from providers import SupabaseProvider
            supabase = SupabaseProvider()
            
            encrypted_dek = await supabase.get_org_dek(org_id)
            if not encrypted_dek:
                raise ValueError(f"No DEK found for organization {org_id}")
            
            # Decrypt and cache
            dek = self._decrypt_dek(encrypted_dek)
            self.dek_cache[org_id] = dek
            
            return dek
            
        except Exception as e:
            logger.error(f"DEK retrieval failed for org {org_id}: {e}")
            raise
    
    def encrypt_content(self, plaintext: str, dek: bytes, aad: str) -> Dict[str, bytes]:
        """
        Encrypt content using AES-256-GCM
        
        Args:
            plaintext: Content to encrypt
            dek: Data Encryption Key
            aad: Additional Authenticated Data (org_id|document_id|chunk_index)
        
        Returns:
            Dict with ciphertext, nonce, and aad
        """
        try:
            # Convert plaintext to bytes
            plaintext_bytes = plaintext.encode('utf-8')
            
            # Generate random nonce (12 bytes for GCM)
            nonce = secrets.token_bytes(12)
            
            # Encrypt
            aesgcm = AESGCM(dek)
            ciphertext = aesgcm.encrypt(nonce, plaintext_bytes, aad.encode('utf-8'))
            
            return {
                'ciphertext': ciphertext,
                'nonce': nonce,
                'aad': aad
            }
            
        except Exception as e:
            logger.error(f"Content encryption failed: {e}")
            raise
    
    def decrypt_content(self, ciphertext: bytes, nonce: bytes, aad: str, dek: bytes) -> str:
        """
        Decrypt content using AES-256-GCM
        
        Args:
            ciphertext: Encrypted content
            nonce: 12-byte nonce
            aad: Additional Authenticated Data
            dek: Data Encryption Key
        
        Returns:
            Decrypted plaintext string
        """
        try:
            # Decrypt
            aesgcm = AESGCM(dek)
            plaintext_bytes = aesgcm.decrypt(nonce, ciphertext, aad.encode('utf-8'))
            
            # Convert back to string
            plaintext = plaintext_bytes.decode('utf-8')
            
            return plaintext
            
        except Exception as e:
            logger.error(f"Content decryption failed: {e}")
            raise
    
    def hash_content(self, content: str) -> str:
        """
        Generate SHA-256 hash of content for integrity verification
        """
        try:
            digest = hashes.Hash(hashes.SHA256())
            digest.update(content.encode('utf-8'))
            hash_bytes = digest.finalize()
            
            return hash_bytes.hex()
            
        except Exception as e:
            logger.error(f"Content hashing failed: {e}")
            raise
    
    def hash_prompt(self, prompt: str) -> str:
        """
        Hash prompt for audit logs (never store prompts in plaintext)
        """
        return self.hash_content(prompt)
    
    def clear_dek_cache(self, org_id: Optional[str] = None):
        """
        Clear DEK from memory cache
        Use for security or key rotation
        """
        if org_id:
            self.dek_cache.pop(org_id, None)
        else:
            self.dek_cache.clear()
    
    def validate_encryption_integrity(
        self, 
        plaintext: str, 
        stored_hash: str
    ) -> bool:
        """
        Validate that decrypted content matches stored hash
        """
        try:
            calculated_hash = self.hash_content(plaintext)
            return calculated_hash == stored_hash
        except Exception as e:
            logger.error(f"Integrity validation failed: {e}")
            return False
    
    @classmethod
    def generate_master_key(cls) -> str:
        """
        Generate a new master KEK for initial setup
        Returns base64 encoded key
        """
        kek = secrets.token_bytes(32)  # 256 bits
        return base64.b64encode(kek).decode('utf-8')
    
    def get_encryption_info(self) -> Dict[str, str]:
        """Get encryption algorithm information"""
        return {
            "algorithm": "AES-256-GCM",
            "key_size": "256 bits",
            "nonce_size": "96 bits",
            "envelope_encryption": "KEK/DEK",
            "cached_deks": len(self.dek_cache)
        }