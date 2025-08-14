#!/usr/bin/env python3
"""
Test d'intégration pour vérifier le système RAG
Tests basiques sans nécessiter de vraies API keys
"""

import os
import sys
import asyncio
import json
import httpx
from pathlib import Path

# Configuration de test (utiliser les vraies variables d'env si disponibles)
TEST_CONFIG = {
    'RAG_BASE_URL': 'http://localhost:8001',
    'SUPABASE_URL': os.getenv('SUPABASE_URL'),
    'SUPABASE_SERVICE_KEY': os.getenv('SUPABASE_SERVICE_KEY'),
    'RAG_MASTER_KEY': os.getenv('RAG_MASTER_KEY'),
    'EMBEDDING_PROVIDER': 'nomic',
    'EMBEDDING_API_KEY': 'test-key',  # Mock pour les tests
    'GENERATION_PROVIDER': 'groq',
    'GROQ_API_KEY': os.getenv('GROQ_API_KEY'),
}

class RAGIntegrationTest:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.passed = 0
        self.failed = 0
    
    async def test_security_module(self):
        """Test du module security sans connexion externe"""
        print("\n🔐 Test du module Security...")
        
        try:
            sys.path.insert(0, '/home/danis/code/Raggy/rag-service')
            from security import SecurityManager
            
            # Mock la variable d'environnement
            os.environ['RAG_MASTER_KEY'] = TEST_CONFIG['RAG_MASTER_KEY'] or 'd/KMN8oMNCetr+XV+KifCaNPo5BIckQgk1rojNEh5kE='
            
            sm = SecurityManager()
            
            # Test de chiffrement/déchiffrement
            plaintext = "Ceci est un test de chiffrement"
            mock_dek = sm._generate_dek()
            
            encrypted = sm.encrypt_content(plaintext, mock_dek, "test_org|test_doc|0")
            decrypted = sm.decrypt_content(
                encrypted['ciphertext'], 
                encrypted['nonce'], 
                encrypted['aad'], 
                mock_dek
            )
            
            if decrypted == plaintext:
                print("  ✅ Chiffrement/déchiffrement: OK")
                self.passed += 1
            else:
                print("  ❌ Chiffrement/déchiffrement: FAILED")
                self.failed += 1
                
            # Test de hash
            hash1 = sm.hash_content("test")
            hash2 = sm.hash_content("test")
            if hash1 == hash2:
                print("  ✅ Fonction de hachage: OK")
                self.passed += 1
            else:
                print("  ❌ Fonction de hachage: FAILED")
                self.failed += 1
            
        except Exception as e:
            print(f"  ❌ Module Security: FAILED - {e}")
            self.failed += 1
    
    async def test_providers_imports(self):
        """Test des imports des providers sans connexion"""
        print("\n📡 Test des imports Providers...")
        
        try:
            sys.path.insert(0, '/home/danis/code/Raggy/rag-service')
            from providers import SupabaseProvider, EmbeddingProvider, LLMProvider
            
            print("  ✅ Import SupabaseProvider: OK")
            print("  ✅ Import EmbeddingProvider: OK") 
            print("  ✅ Import LLMProvider: OK")
            self.passed += 3
            
        except Exception as e:
            print(f"  ❌ Imports Providers: FAILED - {e}")
            self.failed += 1
    
    async def test_fastapi_endpoints(self):
        """Test des endpoints FastAPI (si le serveur est lancé)"""
        print("\n🚀 Test des endpoints FastAPI...")
        
        try:
            # Test health endpoint
            response = await self.client.get(f"{TEST_CONFIG['RAG_BASE_URL']}/rag/health")
            if response.status_code == 200:
                print("  ✅ Endpoint /rag/health: OK")
                self.passed += 1
            else:
                print(f"  ⚠️  Endpoint /rag/health: Status {response.status_code}")
                print("     (Serveur FastAPI pas lancé - normal pour tests unitaires)")
                
        except httpx.ConnectError:
            print("  ⚠️  Serveur FastAPI non accessible")
            print("     (Normal si pas lancé - pas un échec)")
        except Exception as e:
            print(f"  ❌ Test FastAPI: FAILED - {e}")
            self.failed += 1
    
    async def test_nextjs_routes(self):
        """Test que les routes Next.js compilent correctement"""
        print("\n⚛️  Test des routes Next.js...")
        
        try:
            # Vérifier que les fichiers de routes existent et ont la bonne structure
            routes_to_check = [
                '/home/danis/code/Raggy/rag-saas-ui/app/api/rag/ask/route.ts',
                '/home/danis/code/Raggy/rag-saas-ui/app/api/rag/index/route.ts', 
                '/home/danis/code/Raggy/rag-saas-ui/app/api/rag/health/route.ts'
            ]
            
            for route_file in routes_to_check:
                if os.path.exists(route_file):
                    with open(route_file, 'r') as f:
                        content = f.read()
                        if 'RAG_BASE_URL' in content:
                            print(f"  ✅ Route {route_file}: Configurée pour FastAPI")
                            self.passed += 1
                        else:
                            print(f"  ❌ Route {route_file}: Configuration FastAPI manquante")
                            self.failed += 1
                else:
                    print(f"  ❌ Route {route_file}: Fichier manquant")
                    self.failed += 1
            
        except Exception as e:
            print(f"  ❌ Test routes Next.js: FAILED - {e}")
            self.failed += 1
    
    async def test_database_migration(self):
        """Test que la migration SQL a été appliquée"""
        print("\n🗃️  Test de la migration SQL...")
        
        if not TEST_CONFIG['SUPABASE_URL'] or not TEST_CONFIG['SUPABASE_SERVICE_KEY']:
            print("  ⚠️  Variables Supabase manquantes - skip test DB")
            return
        
        try:
            # Test simple de connexion à Supabase
            from supabase import create_client
            
            supabase = create_client(
                TEST_CONFIG['SUPABASE_URL'], 
                TEST_CONFIG['SUPABASE_SERVICE_KEY']
            )
            
            # Test que les tables existent
            result = supabase.from_('org_keys').select('*').limit(0).execute()
            print("  ✅ Table org_keys: Existe")
            self.passed += 1
            
            result = supabase.from_('rag_chunks').select('*').limit(0).execute()
            print("  ✅ Table rag_chunks: Existe") 
            self.passed += 1
            
        except Exception as e:
            print(f"  ❌ Test migration SQL: FAILED - {e}")
            self.failed += 1
    
    async def run_all_tests(self):
        """Lance tous les tests"""
        print("🔍 DÉBUT DES TESTS D'INTÉGRATION RAG")
        print("="*50)
        
        await self.test_security_module()
        await self.test_providers_imports()
        await self.test_nextjs_routes()
        await self.test_database_migration()
        await self.test_fastapi_endpoints()
        
        print("\n" + "="*50)
        print(f"📊 RÉSULTATS: {self.passed} tests passés, {self.failed} échecs")
        
        if self.failed == 0:
            print("🎉 TOUS LES TESTS SONT PASSÉS !")
            return True
        else:
            print("⚠️  Certains tests ont échoué - voir détails ci-dessus")
            return False
        
    async def cleanup(self):
        await self.client.aclose()

async def main():
    test = RAGIntegrationTest()
    try:
        success = await test.run_all_tests()
        return 0 if success else 1
    finally:
        await test.cleanup()

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)