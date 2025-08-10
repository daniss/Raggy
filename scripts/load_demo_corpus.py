#!/usr/bin/env python3
"""
Demo Corpus Loader for Raggy
============================

Loads demo documents into the RAG system with content hashing for idempotent processing.
Supports multiple file formats and provides detailed progress tracking.

Usage:
    python scripts/load_demo_corpus.py [options]

Examples:
    # Load all documents
    python scripts/load_demo_corpus.py

    # Load specific category
    python scripts/load_demo_corpus.py --category juridique

    # Dry run to see what would be loaded
    python scripts/load_demo_corpus.py --dry-run --verbose

    # Force reload with cleanup
    python scripts/load_demo_corpus.py --cleanup --force-reload
"""

import asyncio
import argparse
import logging
import os
import sys
import hashlib
import mimetypes
from pathlib import Path
from typing import List, Dict, Any, Optional, Set
from datetime import datetime
import time

# Add backend to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.core.config import settings
from app.db.supabase_client import supabase_client
from app.rag.loader import DocumentLoader
from app.rag.splitter import DocumentSplitter
from app.rag.embedder import DocumentEmbedder
from app.services.background_jobs import process_document_pipeline

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('demo_corpus_loading.log')
    ]
)
logger = logging.getLogger(__name__)

class DemoCorpusLoader:
    """Demo corpus loader with idempotent processing and content hashing."""
    
    SUPPORTED_FORMATS = {
        '.pdf': 'application/pdf',
        '.txt': 'text/plain',
        '.md': 'text/markdown',
        '.csv': 'text/csv',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.doc': 'application/msword',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.xls': 'application/vnd.ms-excel'
    }
    
    CATEGORIES = ['juridique', 'rh', 'fiscal', 'technique', 'commercial']
    
    def __init__(self, demo_org_id: str = None, dry_run: bool = False, verbose: bool = False):
        """Initialize the demo corpus loader."""
        self.demo_org_id = demo_org_id or settings.demo_org_id
        self.dry_run = dry_run
        self.verbose = verbose
        
        # Initialize components
        self.document_loader = DocumentLoader()
        self.document_splitter = DocumentSplitter()
        self.document_embedder = DocumentEmbedder()
        
        # Statistics tracking
        self.stats = {
            'files_found': 0,
            'files_processed': 0,
            'files_skipped': 0,
            'files_failed': 0,
            'duplicates_detected': 0,
            'chunks_created': 0,
            'processing_time': 0,
            'errors': []
        }
        
        # Cache for existing content hashes
        self.existing_hashes: Set[str] = set()
        
    async def initialize(self):
        """Initialize the loader and load existing content hashes."""
        logger.info(f"Initializing demo corpus loader for organization: {self.demo_org_id}")
        
        if self.dry_run:
            logger.info("🔍 DRY RUN MODE - No actual changes will be made")
        
        await self._load_existing_hashes()
        
    async def _load_existing_hashes(self):
        """Load existing content hashes to enable duplicate detection."""
        try:
            result = supabase_client.table("documents").select("content_hash").eq(
                "organization_id", self.demo_org_id
            ).execute()
            
            self.existing_hashes = {
                doc['content_hash'] for doc in result.data 
                if doc.get('content_hash')
            }
            
            logger.info(f"Loaded {len(self.existing_hashes)} existing content hashes")
            
        except Exception as e:
            logger.warning(f"Failed to load existing hashes: {e}")
            self.existing_hashes = set()
    
    def _calculate_file_hash(self, file_path: Path) -> str:
        """Calculate SHA256 hash of file content."""
        hash_sha256 = hashlib.sha256()
        try:
            with open(file_path, 'rb') as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_sha256.update(chunk)
            return hash_sha256.hexdigest()
        except Exception as e:
            logger.error(f"Failed to calculate hash for {file_path}: {e}")
            return ""
    
    def _get_content_type(self, file_path: Path) -> str:
        """Get content type for file."""
        extension = file_path.suffix.lower()
        
        # Use our mapping first
        if extension in self.SUPPORTED_FORMATS:
            return self.SUPPORTED_FORMATS[extension]
        
        # Fallback to mimetypes
        content_type, _ = mimetypes.guess_type(str(file_path))
        return content_type or 'application/octet-stream'
    
    def _extract_category_from_path(self, file_path: Path) -> str:
        """Extract category from file path."""
        path_parts = file_path.parts
        
        # Look for category in path
        for part in path_parts:
            if part in self.CATEGORIES:
                return part
        
        # Default to 'general' if no category found
        return 'general'
    
    def _is_duplicate(self, content_hash: str) -> bool:
        """Check if content hash already exists."""
        return content_hash in self.existing_hashes
    
    async def find_documents(self, corpus_dir: Path, category: Optional[str] = None) -> List[Path]:
        """Find all documents in the corpus directory."""
        documents = []
        
        if not corpus_dir.exists():
            logger.error(f"Corpus directory does not exist: {corpus_dir}")
            return documents
        
        # Search patterns
        search_dirs = []
        if category:
            category_dir = corpus_dir / category
            if category_dir.exists():
                search_dirs.append(category_dir)
            else:
                logger.warning(f"Category directory not found: {category_dir}")
                return documents
        else:
            search_dirs.append(corpus_dir)
        
        # Find all supported files
        for search_dir in search_dirs:
            for file_pattern in self.SUPPORTED_FORMATS.keys():
                pattern = f"**/*{file_pattern}"
                found_files = list(search_dir.glob(pattern))
                documents.extend(found_files)
        
        # Remove duplicates and sort
        documents = sorted(list(set(documents)))
        self.stats['files_found'] = len(documents)
        
        logger.info(f"Found {len(documents)} documents in {search_dir}")
        if self.verbose:
            for doc in documents:
                logger.info(f"  📄 {doc.relative_to(corpus_dir)}")
        
        return documents
    
    async def process_document(self, file_path: Path, corpus_dir: Path) -> bool:
        """Process a single document with idempotent handling."""
        try:
            # Calculate content hash
            content_hash = self._calculate_file_hash(file_path)
            if not content_hash:
                self.stats['files_failed'] += 1
                return False
            
            # Check for duplicates
            if self._is_duplicate(content_hash):
                if self.verbose:
                    logger.info(f"⏭️  Skipping duplicate: {file_path.name}")
                self.stats['files_skipped'] += 1
                self.stats['duplicates_detected'] += 1
                return True
            
            # Get file info
            content_type = self._get_content_type(file_path)
            category = self._extract_category_from_path(file_path)
            file_size = file_path.stat().st_size
            
            if self.verbose:
                logger.info(f"📄 Processing: {file_path.name} ({category}, {file_size} bytes)")
            
            if self.dry_run:
                logger.info(f"  🔍 Would load: {file_path.relative_to(corpus_dir)}")
                self.stats['files_processed'] += 1
                return True
            
            # Read file content
            with open(file_path, 'rb') as f:
                file_content = f.read()
            
            # Enhanced metadata
            metadata = {
                'filename': file_path.name,
                'category': category,
                'content_hash': content_hash,
                'file_size': file_size,
                'source': 'demo_corpus',
                'relative_path': str(file_path.relative_to(corpus_dir)),
                'loaded_at': datetime.utcnow().isoformat()
            }
            
            # Load document using existing loader
            documents = self.document_loader.load_from_bytes(
                file_content, content_type, file_path.name, metadata
            )
            
            if not documents:
                logger.warning(f"No content extracted from {file_path.name}")
                self.stats['files_failed'] += 1
                return False
            
            # Process through the full pipeline
            await self._process_through_pipeline(
                documents, file_path.name, content_type, file_size, metadata
            )
            
            self.stats['files_processed'] += 1
            self.stats['chunks_created'] += len(documents)
            
            # Add to existing hashes to prevent processing again in this session
            self.existing_hashes.add(content_hash)
            
            if self.verbose:
                logger.info(f"  ✅ Processed: {len(documents)} chunks created")
            
            return True
            
        except Exception as e:
            error_msg = f"Failed to process {file_path.name}: {e}"
            logger.error(error_msg)
            self.stats['errors'].append(error_msg)
            self.stats['files_failed'] += 1
            return False
    
    async def _process_through_pipeline(
        self, 
        documents: List, 
        filename: str, 
        content_type: str, 
        file_size: int, 
        metadata: Dict[str, Any]
    ):
        """Process documents through the full RAG pipeline."""
        
        # Save document info to database
        document_id = await self._save_document_info(
            filename, content_type, file_size, metadata
        )
        
        # Process each document chunk
        all_chunks = []
        for doc in documents:
            # Split into chunks
            chunks = self.document_splitter.split_document(doc)
            all_chunks.extend(chunks)
        
        if all_chunks:
            # Generate embeddings and save to vector store
            await self._save_document_chunks(document_id, all_chunks, metadata)
            
            # Update document status
            await self._update_document_status(
                document_id, 'completed', len(all_chunks)
            )
        else:
            await self._update_document_status(
                document_id, 'failed', 0, 'No chunks generated'
            )
    
    async def _save_document_info(
        self, 
        filename: str, 
        content_type: str, 
        file_size: int, 
        metadata: Dict[str, Any]
    ) -> str:
        """Save document information to database."""
        try:
            import uuid
            document_id = str(uuid.uuid4())
            
            data = {
                "id": document_id,
                "filename": filename,
                "content_type": content_type,
                "size_bytes": file_size,
                "status": "processing",
                "organization_id": self.demo_org_id,
                "content_hash": metadata.get('content_hash'),
                "extraction_method": metadata.get('extraction_method', 'demo_loader'),
                "document_metadata": {
                    k: v for k, v in metadata.items() 
                    if k not in ['content_hash', 'extraction_method']
                }
            }
            
            result = supabase_client.table("documents").insert(data).execute()
            logger.debug(f"Saved document info: {filename}")
            
            return document_id
            
        except Exception as e:
            logger.error(f"Failed to save document info: {e}")
            raise
    
    async def _save_document_chunks(
        self, 
        document_id: str, 
        chunks: List, 
        metadata: Dict[str, Any]
    ):
        """Save document chunks with embeddings to vector store."""
        try:
            # Generate embeddings for all chunks
            chunk_texts = [chunk.page_content for chunk in chunks]
            embeddings = await self.document_embedder.embed_documents(chunk_texts)
            
            # Prepare vector data
            vector_data = []
            for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                chunk_metadata = chunk.metadata.copy()
                chunk_metadata.update({
                    'document_id': document_id,
                    'chunk_index': i,
                    'content_hash': metadata.get('content_hash')
                })
                
                vector_data.append({
                    'id': str(uuid.uuid4()),
                    'document_id': document_id,
                    'content': chunk.page_content,
                    'embedding': embedding,
                    'metadata': chunk_metadata,
                    'organization_id': self.demo_org_id
                })
            
            # Batch insert to vector store
            if vector_data:
                result = supabase_client.table("document_vectors").insert(vector_data).execute()
                logger.debug(f"Saved {len(vector_data)} chunks for document {document_id}")
            
        except Exception as e:
            logger.error(f"Failed to save document chunks: {e}")
            raise
    
    async def _update_document_status(
        self, 
        document_id: str, 
        status: str, 
        chunks_count: int, 
        error_message: Optional[str] = None
    ):
        """Update document processing status."""
        try:
            update_data = {
                "status": status,
                "chunks_count": chunks_count
            }
            
            if error_message:
                update_data["error_message"] = error_message
            
            result = supabase_client.table("documents").update(update_data).eq(
                "id", document_id
            ).execute()
            
            logger.debug(f"Updated document {document_id} status to {status}")
            
        except Exception as e:
            logger.error(f"Failed to update document status: {e}")
    
    async def cleanup_existing_demo_data(self):
        """Clean up existing demo data before loading new corpus."""
        if self.dry_run:
            logger.info("🔍 DRY RUN: Would cleanup existing demo data")
            return
        
        logger.info("🧹 Cleaning up existing demo data...")
        
        try:
            # Delete document vectors first (foreign key constraint)
            vector_result = supabase_client.table("document_vectors").delete().eq(
                "organization_id", self.demo_org_id
            ).execute()
            vector_count = len(vector_result.data) if vector_result.data else 0
            
            # Delete documents
            doc_result = supabase_client.table("documents").delete().eq(
                "organization_id", self.demo_org_id
            ).execute()
            doc_count = len(doc_result.data) if doc_result.data else 0
            
            logger.info(f"  🗑️  Deleted {doc_count} documents and {vector_count} vectors")
            
            # Clear existing hashes cache
            self.existing_hashes.clear()
            
        except Exception as e:
            logger.error(f"Failed to cleanup existing data: {e}")
            raise
    
    async def load_corpus(
        self, 
        corpus_dir: Path, 
        category: Optional[str] = None, 
        force_reload: bool = False, 
        cleanup: bool = False
    ):
        """Load the demo corpus with specified options."""
        start_time = time.time()
        
        logger.info("🚀 Starting demo corpus loading...")
        logger.info(f"   📁 Corpus directory: {corpus_dir}")
        logger.info(f"   🏢 Organization ID: {self.demo_org_id}")
        if category:
            logger.info(f"   📂 Category filter: {category}")
        
        # Cleanup if requested
        if cleanup:
            await self.cleanup_existing_demo_data()
        
        # Find documents
        documents = await self.find_documents(corpus_dir, category)
        
        if not documents:
            logger.warning("No documents found to process")
            return
        
        # Process documents
        logger.info(f"📊 Processing {len(documents)} documents...")
        
        for i, doc_path in enumerate(documents, 1):
            if self.verbose:
                logger.info(f"[{i}/{len(documents)}] Processing: {doc_path.name}")
            
            await self.process_document(doc_path, corpus_dir)
            
            # Small delay to prevent overwhelming the system
            if not self.dry_run:
                await asyncio.sleep(0.1)
        
        # Calculate final statistics
        self.stats['processing_time'] = time.time() - start_time
        
        # Print summary
        self._print_summary()
    
    def _print_summary(self):
        """Print processing summary."""
        logger.info("\n" + "="*60)
        logger.info("📊 DEMO CORPUS LOADING SUMMARY")
        logger.info("="*60)
        logger.info(f"📁 Files found:      {self.stats['files_found']}")
        logger.info(f"✅ Files processed:  {self.stats['files_processed']}")
        logger.info(f"⏭️  Files skipped:    {self.stats['files_skipped']}")
        logger.info(f"❌ Files failed:     {self.stats['files_failed']}")
        logger.info(f"🔄 Duplicates:       {self.stats['duplicates_detected']}")
        logger.info(f"📝 Chunks created:   {self.stats['chunks_created']}")
        logger.info(f"⏱️  Processing time:  {self.stats['processing_time']:.2f} seconds")
        
        if self.stats['errors']:
            logger.error(f"\n❌ Errors encountered ({len(self.stats['errors'])}):")
            for error in self.stats['errors'][:5]:  # Show first 5 errors
                logger.error(f"   • {error}")
            if len(self.stats['errors']) > 5:
                logger.error(f"   ... and {len(self.stats['errors']) - 5} more errors")
        
        if self.dry_run:
            logger.info("\n🔍 This was a DRY RUN - no actual changes were made")
        else:
            logger.info(f"\n🎉 Demo corpus loading completed successfully!")
            logger.info(f"   Organization {self.demo_org_id} now has {self.stats['files_processed']} demo documents")

async def check_duplicate_hashes(demo_org_id: str):
    """Check for duplicate content hashes in the database."""
    try:
        result = supabase_client.table("documents").select(
            "content_hash, filename, created_at"
        ).eq("organization_id", demo_org_id).execute()
        
        # Group by content hash
        hash_groups = {}
        for doc in result.data:
            hash_val = doc.get('content_hash')
            if hash_val:
                if hash_val not in hash_groups:
                    hash_groups[hash_val] = []
                hash_groups[hash_val].append(doc)
        
        duplicates = {h: docs for h, docs in hash_groups.items() if len(docs) > 1}
        
        if duplicates:
            logger.warning(f"Found {len(duplicates)} duplicate content hashes:")
            for hash_val, docs in duplicates.items():
                logger.warning(f"  Hash {hash_val[:16]}... has {len(docs)} documents:")
                for doc in docs:
                    logger.warning(f"    - {doc['filename']} ({doc['created_at']})")
        else:
            logger.info("✅ No duplicate content hashes found")
        
        return duplicates
        
    except Exception as e:
        logger.error(f"Failed to check duplicates: {e}")
        return {}

async def get_corpus_stats(demo_org_id: str):
    """Get statistics about the loaded corpus."""
    try:
        # Use the enhanced stats function from the migration
        result = supabase_client.rpc(
            'get_enhanced_document_stats', 
            {'org_id': demo_org_id}
        ).execute()
        
        if result.data:
            stats = result.data[0]
            logger.info("\n" + "="*60)
            logger.info("📊 DEMO CORPUS STATISTICS")
            logger.info("="*60)
            logger.info(f"📁 Total documents:        {stats['total_documents']}")
            logger.info(f"💾 Total size:             {stats['total_size_bytes']:,} bytes")
            logger.info(f"🔒 Unique content hashes:  {stats['unique_content_hashes']}")
            logger.info(f"📊 Average file size:      {stats['avg_file_size']:.0f} bytes")
            logger.info(f"📋 Documents with metadata: {stats['documents_with_metadata']}")
            
            if stats['extraction_methods']:
                logger.info(f"\n📊 Extraction methods:")
                for method, count in stats['extraction_methods'].items():
                    logger.info(f"   • {method}: {count} documents")
        
        # Get chunk/vector count
        vector_result = supabase_client.table("document_vectors").select(
            "id", count="exact"
        ).eq("organization_id", demo_org_id).execute()
        
        chunk_count = vector_result.count or 0
        logger.info(f"📝 Total chunks/vectors:   {chunk_count}")
        
    except Exception as e:
        logger.error(f"Failed to get corpus stats: {e}")

def setup_argument_parser():
    """Setup command line argument parser."""
    parser = argparse.ArgumentParser(
        description='Load demo corpus into Raggy RAG system',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    parser.add_argument(
        'corpus_dir',
        nargs='?',
        default='demo_corpus',
        help='Path to demo corpus directory (default: demo_corpus)'
    )
    
    parser.add_argument(
        '--category',
        choices=DemoCorpusLoader.CATEGORIES,
        help='Load only documents from specific category'
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be loaded without making changes'
    )
    
    parser.add_argument(
        '--force-reload',
        action='store_true',
        help='Force reload even if content hash exists'
    )
    
    parser.add_argument(
        '--cleanup',
        action='store_true',
        help='Clean up existing demo data before loading'
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose output'
    )
    
    parser.add_argument(
        '--check-duplicates',
        action='store_true',
        help='Check for duplicate content hashes and exit'
    )
    
    parser.add_argument(
        '--stats',
        action='store_true',
        help='Show corpus statistics and exit'
    )
    
    parser.add_argument(
        '--demo-org-id',
        default=settings.demo_org_id,
        help=f'Demo organization ID (default: {settings.demo_org_id})'
    )
    
    return parser

async def main():
    """Main entry point."""
    parser = setup_argument_parser()
    args = parser.parse_args()
    
    # Setup logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Convert corpus_dir to Path
    corpus_dir = Path(args.corpus_dir)
    
    # Handle special commands
    if args.check_duplicates:
        await check_duplicate_hashes(args.demo_org_id)
        return
    
    if args.stats:
        await get_corpus_stats(args.demo_org_id)
        return
    
    # Initialize loader
    loader = DemoCorpusLoader(
        demo_org_id=args.demo_org_id,
        dry_run=args.dry_run,
        verbose=args.verbose
    )
    
    try:
        await loader.initialize()
        
        await loader.load_corpus(
            corpus_dir=corpus_dir,
            category=args.category,
            force_reload=args.force_reload,
            cleanup=args.cleanup
        )
        
    except KeyboardInterrupt:
        logger.info("\n⚠️  Loading interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"💥 Fatal error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())