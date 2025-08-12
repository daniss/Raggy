#!/usr/bin/env python3
"""
Script to set up the demo environment with professional documents.
Registers a demo account and uploads all the generated professional documents.
"""

import requests
import json
import time
import sys
from pathlib import Path
from typing import Dict, List, Optional
import mimetypes

class DemoEnvironmentSetup:
    """Handle demo registration and document upload."""
    
    def __init__(self, backend_url: str = "http://localhost:8000"):
        self.backend_url = backend_url
        self.session_token = None
        self.uploaded_documents = []
        
    def register_demo_account(self, email: str = None, company_name: str = None) -> Dict:
        """Register a new demo account and get session token."""
        
        # Use default values if not provided
        if not email:
            email = f"demo-{int(time.time())}@demo-company.fr"
        if not company_name:
            company_name = f"Demo Enterprise {int(time.time())}"
            
        register_data = {
            "email": email,
            "company_name": company_name,
            "source": "script_setup",
            "utm_source": "internal",
            "utm_medium": "setup",
            "utm_campaign": "demo_transformation"
        }
        
        try:
            print(f"Registering demo account for: {email}")
            response = requests.post(
                f"{self.backend_url}/api/v1/demo/register",
                json=register_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.session_token = data["session_token"]
                print(f"Demo registration successful!")
                print(f"Session token: {self.session_token}")
                print(f"Expires at: {data['expires_at']}")
                return data
            else:
                print(f"Registration failed: {response.status_code}")
                print(f"Response: {response.text}")
                return None
                
        except requests.exceptions.ConnectionError:
            print(f"Error: Cannot connect to backend at {self.backend_url}")
            print("Make sure the backend is running with 'docker-compose up' or 'make dev'")
            return None
        except Exception as e:
            print(f"Registration error: {e}")
            return None
            
    def upload_document(self, file_path: Path) -> Dict:
        """Upload a single document to the demo session."""
        
        if not self.session_token:
            print("Error: No session token available. Register demo account first.")
            return None
            
        if not file_path.exists():
            print(f"Error: File not found: {file_path}")
            return None
            
        # Determine content type
        content_type, _ = mimetypes.guess_type(str(file_path))
        if not content_type:
            # Default content types for our files
            if file_path.suffix.lower() == '.pdf':
                content_type = 'application/pdf'
            elif file_path.suffix.lower() == '.docx':
                content_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            elif file_path.suffix.lower() == '.xlsx':
                content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            else:
                content_type = 'application/octet-stream'
        
        try:
            print(f"Uploading: {file_path.name}")
            
            with open(file_path, 'rb') as f:
                files = {
                    'file': (file_path.name, f, content_type)
                }
                
                headers = {
                    'X-Demo-Session': self.session_token
                }
                
                response = requests.post(
                    f"{self.backend_url}/api/v1/demo/upload",
                    files=files,
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    print(f"✓ Upload successful: {file_path.name}")
                    print(f"  Document ID: {data.get('document_id')}")
                    print(f"  Chunks created: {data.get('chunks_created')}")
                    self.uploaded_documents.append(data)
                    return data
                else:
                    print(f"✗ Upload failed: {response.status_code}")
                    print(f"  Response: {response.text}")
                    return None
                    
        except Exception as e:
            print(f"Upload error for {file_path.name}: {e}")
            return None
            
    def upload_all_documents(self, docs_dir: Path) -> List[Dict]:
        """Upload all professional documents from directory."""
        
        if not docs_dir.exists():
            print(f"Error: Documents directory not found: {docs_dir}")
            return []
            
        # Files to upload in order
        target_files = [
            "Guide_Conformite_RGPD.pdf",
            "Manuel_Procedures_RH_2024.pdf", 
            "Contrat_Type_Client.docx",
            "Analyse_Fiscale_2024.xlsx",
            "Documentation_Technique_Produit.pdf"
        ]
        
        uploaded = []
        
        for filename in target_files:
            file_path = docs_dir / filename
            if file_path.exists():
                result = self.upload_document(file_path)
                if result:
                    uploaded.append(result)
                # Small delay between uploads to avoid overwhelming the server
                time.sleep(2)
            else:
                print(f"Warning: File not found: {filename}")
        
        print(f"\nUpload summary: {len(uploaded)}/{len(target_files)} documents uploaded successfully")
        return uploaded
        
    def test_demo_session(self) -> bool:
        """Test that the demo session is working by asking a question."""
        
        if not self.session_token:
            print("Error: No session token available")
            return False
            
        test_question = "Quelles sont les principales obligations RGPD pour une entreprise française ?"
        
        try:
            print(f"Testing demo with question: {test_question}")
            
            headers = {
                'X-Demo-Session': self.session_token,
                'Content-Type': 'application/json'
            }
            
            data = {
                "question": test_question,
                "conversation_id": "test_conversation"
            }
            
            response = requests.post(
                f"{self.backend_url}/api/v1/demo/chat/stream",
                json=data,
                headers=headers,
                stream=True
            )
            
            if response.status_code == 200:
                print("✓ Demo chat test successful!")
                print("First few response chunks:")
                
                chunk_count = 0
                for line in response.iter_lines():
                    if line and chunk_count < 5:  # Show first 5 chunks
                        line_text = line.decode('utf-8')
                        if line_text.startswith('data: '):
                            try:
                                data = json.loads(line_text[6:])  # Remove 'data: '
                                if data.get('type') == 'token' and data.get('content'):
                                    print(f"  Token: {data['content']}")
                                    chunk_count += 1
                                elif data.get('type') == 'status':
                                    print(f"  Status: {data['message']}")
                            except json.JSONDecodeError:
                                pass
                    elif chunk_count >= 5:
                        break
                        
                return True
            else:
                print(f"✗ Demo chat test failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"Demo test error: {e}")
            return False
            
    def get_session_info(self) -> Dict:
        """Get current session information."""
        
        if not self.session_token:
            return None
            
        try:
            response = requests.get(
                f"{self.backend_url}/api/v1/demo/session/{self.session_token}"
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"Failed to get session info: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"Session info error: {e}")
            return None


def main():
    """Main function to set up demo environment."""
    
    print("=== Demo Environment Setup ===\n")
    
    # Initialize setup
    setup = DemoEnvironmentSetup()
    
    # Step 1: Register demo account
    print("Step 1: Registering demo account...")
    registration = setup.register_demo_account(
        email="demo-raggy-pro@enterprise-demo.fr",
        company_name="Enterprise Demo Solutions"
    )
    
    if not registration:
        print("Failed to register demo account. Exiting.")
        return False
        
    # Step 2: Upload documents
    print("\nStep 2: Uploading professional documents...")
    docs_dir = Path("/tmp/professional_docs")
    uploaded = setup.upload_all_documents(docs_dir)
    
    if len(uploaded) == 0:
        print("No documents were uploaded. Exiting.")
        return False
        
    # Step 3: Test the demo
    print("\nStep 3: Testing demo functionality...")
    test_success = setup.test_demo_session()
    
    # Step 4: Show summary
    print("\n=== Setup Summary ===")
    print(f"Demo email: demo-raggy-pro@enterprise-demo.fr")
    print(f"Company: Enterprise Demo Solutions")
    print(f"Session token: {setup.session_token}")
    print(f"Documents uploaded: {len(uploaded)}")
    
    for doc in uploaded:
        print(f"  - {doc.get('filename')} ({doc.get('chunks_created')} chunks)")
        
    print(f"Demo test: {'✓ PASSED' if test_success else '✗ FAILED'}")
    
    if test_success:
        print("\n✅ Demo environment setup completed successfully!")
        print("The demo is ready with professional documents.")
        print(f"Session token for database update: {setup.session_token}")
        return True
    else:
        print("\n❌ Demo environment setup completed with issues.")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)