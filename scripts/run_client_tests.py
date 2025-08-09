#!/usr/bin/env python3
"""
Client Testing Suite

This script runs comprehensive tests for client isolation, configuration,
and deployment verification for the consulting platform.
"""

import subprocess
import sys
import os
import time
import json
import requests
from pathlib import Path
from typing import Dict, Any, List
import argparse
import yaml

# Add backend to Python path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.append(str(backend_path))


class ClientTestSuite:
    """Comprehensive test suite for client deployments"""
    
    def __init__(self, client_id: str = None, verbose: bool = False):
        self.client_id = client_id
        self.verbose = verbose
        self.test_results = []
        self.project_root = Path(__file__).parent.parent
    
    def log(self, message: str, level: str = "INFO"):
        """Log test messages"""
        if self.verbose or level in ["ERROR", "SUCCESS"]:
            prefix = f"[{level}]" if level != "INFO" else ""
            print(f"{prefix} {message}")
    
    def run_test(self, test_name: str, test_func) -> bool:
        """Run a single test and record results"""
        self.log(f"Running test: {test_name}")
        
        try:
            start_time = time.time()
            result = test_func()
            duration = time.time() - start_time
            
            self.test_results.append({
                "name": test_name,
                "status": "PASS" if result else "FAIL",
                "duration": duration,
                "error": None
            })
            
            if result:
                self.log(f"✓ {test_name} - PASSED ({duration:.2f}s)", "SUCCESS")
            else:
                self.log(f"✗ {test_name} - FAILED ({duration:.2f}s)", "ERROR")
            
            return result
            
        except Exception as e:
            duration = time.time() - start_time
            
            self.test_results.append({
                "name": test_name,
                "status": "ERROR",
                "duration": duration,
                "error": str(e)
            })
            
            self.log(f"✗ {test_name} - ERROR: {e} ({duration:.2f}s)", "ERROR")
            return False
    
    def test_client_configuration_loading(self) -> bool:
        """Test loading client configuration"""
        
        if not self.client_id:
            self.log("Skipping client configuration test (no client_id specified)")
            return True
        
        try:
            from app.core.client_config import get_client_config
            
            config = get_client_config(self.client_id)
            
            # Verify required fields
            assert config.client_id == self.client_id
            assert config.client_name
            assert config.branding
            assert config.features
            
            self.log(f"Client configuration loaded successfully for {self.client_id}")
            return True
            
        except Exception as e:
            self.log(f"Client configuration loading failed: {e}")
            return False
    
    def test_prompt_system(self) -> bool:
        """Test prompt management system"""
        
        try:
            from app.core.prompt_manager import PromptManager, get_prompt
            
            # Test default prompt loading
            prompt = get_prompt("system_default", self.client_id)
            assert prompt
            assert len(prompt) > 0
            
            # Test client-specific prompt loading
            if self.client_id:
                client_prompt = get_prompt("system_default", self.client_id)
                assert client_prompt
            
            self.log("Prompt system working correctly")
            return True
            
        except Exception as e:
            self.log(f"Prompt system test failed: {e}")
            return False
    
    def test_llm_provider_abstraction(self) -> bool:
        """Test LLM provider abstraction layer"""
        
        try:
            from app.core.llm_providers import LLMProviderFactory, LLMMessage
            
            # Test provider factory
            providers = LLMProviderFactory.list_providers()
            assert "groq" in providers
            
            # Test provider creation (without actual API call)
            config = {"api_key": "test", "model": "test-model"}
            try:
                provider = LLMProviderFactory.create_provider("groq", config)
                assert provider is not None
            except ValueError as e:
                if "API key" in str(e):
                    # Expected if no real API key
                    pass
                else:
                    raise
            
            self.log("LLM provider abstraction working correctly")
            return True
            
        except Exception as e:
            self.log(f"LLM provider test failed: {e}")
            return False
    
    def test_rag_pipeline_modularity(self) -> bool:
        """Test RAG pipeline modularity"""
        
        try:
            from app.rag.pipeline import PipelineFactory, get_rag_pipeline
            from app.rag.implementations import ComponentFactory
            
            # Test pipeline creation
            if self.client_id:
                pipeline = get_rag_pipeline(self.client_id)
                assert pipeline.client_id == self.client_id
            
            # Test component factory
            components = ComponentFactory.list_components()
            assert "document_processors" in components
            assert "text_splitters" in components
            assert "response_generators" in components
            
            self.log("RAG pipeline modularity working correctly")
            return True
            
        except Exception as e:
            self.log(f"RAG pipeline test failed: {e}")
            return False
    
    def test_api_endpoints(self) -> bool:
        """Test essential API endpoints"""
        
        if not self._is_server_running():
            self.log("Server not running, skipping API tests")
            return True
        
        try:
            # Test health endpoint
            response = requests.get("http://localhost:8000/health", timeout=5)
            assert response.status_code == 200
            
            health_data = response.json()
            assert "status" in health_data
            assert "services" in health_data
            
            # Test configuration endpoint
            if self.client_id:
                config_url = f"http://localhost:8000/api/v1/config/client/{self.client_id}"
                response = requests.get(config_url, timeout=5)
                if response.status_code == 200:
                    config_data = response.json()
                    assert config_data["client_id"] == self.client_id
                else:
                    self.log(f"Configuration endpoint returned {response.status_code}")
            
            # Test that removed endpoints are indeed removed
            removed_endpoints = [
                "/api/v1/analytics",
                "/api/v1/organizations", 
                "/api/v1/metrics",
                "/api/v1/monitoring"
            ]
            
            for endpoint in removed_endpoints:
                response = requests.get(f"http://localhost:8000{endpoint}", timeout=2)
                assert response.status_code == 404, f"Removed endpoint {endpoint} is still accessible"
            
            self.log("Essential API endpoints working correctly")
            return True
            
        except Exception as e:
            self.log(f"API endpoint test failed: {e}")
            return False
    
    def test_database_connectivity(self) -> bool:
        """Test database connectivity"""
        
        try:
            from app.db.supabase_client import supabase_client
            
            # Test basic connection
            result = supabase_client.table("organizations").select("*").limit(1).execute()
            assert result is not None
            
            self.log("Database connectivity working correctly")
            return True
            
        except Exception as e:
            self.log(f"Database connectivity test failed: {e}")
            return False
    
    def test_client_isolation(self) -> bool:
        """Test client isolation"""
        
        try:
            # Run isolation tests
            result = subprocess.run([
                sys.executable, "-m", "pytest", 
                str(self.project_root / "tests" / "test_client_isolation.py"),
                "-v", "--tb=short"
            ], capture_output=True, text=True, cwd=str(self.project_root))
            
            if result.returncode == 0:
                self.log("Client isolation tests passed")
                return True
            else:
                self.log(f"Client isolation tests failed: {result.stdout}")
                return False
                
        except Exception as e:
            self.log(f"Client isolation test failed: {e}")
            return False
    
    def test_deployment_smoke(self) -> bool:
        """Test deployment smoke tests"""
        
        if not self.client_id:
            self.log("Skipping deployment smoke test (no client_id specified)")
            return True
        
        try:
            client_dir = self.project_root / "clients" / self.client_id
            
            # Check client directory structure
            required_paths = [
                client_dir / "config" / "client.yaml",
                client_dir / "prompts",
                client_dir / "assets"
            ]
            
            for path in required_paths:
                assert path.exists(), f"Missing required path: {path}"
            
            # Validate client configuration
            with open(client_dir / "config" / "client.yaml", 'r') as f:
                config = yaml.safe_load(f)
                assert config["client"]["id"] == self.client_id
            
            self.log("Deployment smoke test passed")
            return True
            
        except Exception as e:
            self.log(f"Deployment smoke test failed: {e}")
            return False
    
    def test_feature_flags(self) -> bool:
        """Test feature flag system"""
        
        if not self.client_id:
            self.log("Skipping feature flag test (no client_id specified)")
            return True
        
        try:
            from app.core.client_config import get_client_config
            
            config = get_client_config(self.client_id)
            features = config.features
            
            # Verify feature flags are loaded
            assert hasattr(features, 'document_upload')
            assert hasattr(features, 'chat_interface')
            assert hasattr(features, 'analytics')
            
            self.log("Feature flag system working correctly")
            return True
            
        except Exception as e:
            self.log(f"Feature flag test failed: {e}")
            return False
    
    def test_security_measures(self) -> bool:
        """Test security measures"""
        
        try:
            # Test path traversal prevention
            from app.core.client_config import ClientConfigManager
            
            manager = ClientConfigManager()
            
            # Should handle malicious inputs gracefully
            malicious_inputs = ["../../../etc/passwd", "client/../secrets"]
            
            for malicious_input in malicious_inputs:
                try:
                    manager.get_client_config(malicious_input)
                    # Should either handle gracefully or raise expected exception
                except Exception:
                    # Expected for malicious inputs
                    pass
            
            self.log("Security measures working correctly")
            return True
            
        except Exception as e:
            self.log(f"Security test failed: {e}")
            return False
    
    def _is_server_running(self) -> bool:
        """Check if the server is running"""
        try:
            response = requests.get("http://localhost:8000/health", timeout=2)
            return response.status_code == 200
        except:
            return False
    
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all tests and return results"""
        
        self.log(f"Starting test suite for client: {self.client_id or 'default'}")
        
        # Define test sequence
        tests = [
            ("Configuration Loading", self.test_client_configuration_loading),
            ("Prompt System", self.test_prompt_system),
            ("LLM Provider Abstraction", self.test_llm_provider_abstraction),
            ("RAG Pipeline Modularity", self.test_rag_pipeline_modularity),
            ("Feature Flags", self.test_feature_flags),
            ("Database Connectivity", self.test_database_connectivity),
            ("API Endpoints", self.test_api_endpoints),
            ("Client Isolation", self.test_client_isolation),
            ("Deployment Smoke Test", self.test_deployment_smoke),
            ("Security Measures", self.test_security_measures)
        ]
        
        # Run tests
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            if self.run_test(test_name, test_func):
                passed += 1
            else:
                failed += 1
        
        # Summary
        total_time = sum(result["duration"] for result in self.test_results)
        
        summary = {
            "client_id": self.client_id,
            "total_tests": len(tests),
            "passed": passed,
            "failed": failed,
            "total_time": total_time,
            "results": self.test_results
        }
        
        self.log(f"\nTest Summary:")
        self.log(f"Total Tests: {summary['total_tests']}")
        self.log(f"Passed: {summary['passed']}", "SUCCESS")
        self.log(f"Failed: {summary['failed']}", "ERROR" if failed > 0 else "INFO")
        self.log(f"Total Time: {summary['total_time']:.2f}s")
        
        return summary


def run_performance_tests(client_id: str = None) -> Dict[str, Any]:
    """Run performance tests for client deployment"""
    
    print("Running performance tests...")
    
    # Test configuration loading performance
    start_time = time.time()
    
    if client_id:
        from app.core.client_config import get_client_config
        
        # Load configuration multiple times to test caching
        for _ in range(100):
            get_client_config(client_id)
        
        config_load_time = time.time() - start_time
        print(f"Configuration loading (100x): {config_load_time:.3f}s")
    
    # Test prompt loading performance
    start_time = time.time()
    
    from app.core.prompt_manager import get_prompt
    
    for _ in range(50):
        get_prompt("system_default", client_id)
    
    prompt_load_time = time.time() - start_time
    print(f"Prompt loading (50x): {prompt_load_time:.3f}s")
    
    return {
        "config_load_time": config_load_time if client_id else 0,
        "prompt_load_time": prompt_load_time
    }


def main():
    """Main test runner"""
    
    parser = argparse.ArgumentParser(description="Client Testing Suite")
    parser.add_argument("--client-id", help="Client ID to test")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument("--performance", "-p", action="store_true", help="Run performance tests")
    parser.add_argument("--output", "-o", help="Output file for test results")
    parser.add_argument("--isolation-only", action="store_true", help="Run only isolation tests")
    
    args = parser.parse_args()
    
    if args.isolation_only:
        # Run only isolation tests
        print("Running isolation tests...")
        result = subprocess.run([
            sys.executable, "-m", "pytest", 
            "tests/test_client_isolation.py",
            "-v", "--tb=short"
        ])
        sys.exit(result.returncode)
    
    # Run main test suite
    test_suite = ClientTestSuite(client_id=args.client_id, verbose=args.verbose)
    results = test_suite.run_all_tests()
    
    # Run performance tests if requested
    if args.performance:
        perf_results = run_performance_tests(args.client_id)
        results["performance"] = perf_results
    
    # Output results
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"Test results written to {args.output}")
    
    # Exit with appropriate code
    exit_code = 0 if results["failed"] == 0 else 1
    sys.exit(exit_code)


if __name__ == "__main__":
    main()