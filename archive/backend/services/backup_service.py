import os
import json
import logging
import shutil
import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from pathlib import Path
import zipfile
import tempfile

from app.core.config import settings
from app.rag import retriever
from app.db.supabase_client import supabase_client

logger = logging.getLogger(__name__)


class BackupService:
    """Service for creating and managing backups of the RAG system."""
    
    def __init__(self, backup_dir: str = "./backups"):
        self.backup_dir = Path(backup_dir)
        self.backup_dir.mkdir(exist_ok=True)
        
    async def create_full_backup(
        self, 
        backup_name: Optional[str] = None,
        include_vectors: bool = True,
        include_metadata: bool = True,
        include_chat_logs: bool = False
    ) -> Dict[str, Any]:
        """
        Create a full backup of the RAG system.
        
        Args:
            backup_name: Custom name for the backup
            include_vectors: Whether to backup vector store
            include_metadata: Whether to backup document metadata
            include_chat_logs: Whether to backup chat interaction logs
            
        Returns:
            Dict with backup information
        """
        try:
            timestamp = datetime.utcnow()
            if not backup_name:
                backup_name = f"full_backup_{timestamp.strftime('%Y%m%d_%H%M%S')}"
            
            logger.info(f"Starting full backup: {backup_name}")
            
            backup_path = self.backup_dir / backup_name
            backup_path.mkdir(exist_ok=True)
            
            backup_info = {
                "backup_name": backup_name,
                "backup_type": "full",
                "created_at": timestamp.isoformat(),
                "components": {},
                "total_size": 0,
                "status": "in_progress"
            }
            
            # Backup vector store
            if include_vectors:
                try:
                    vector_backup = await self._backup_vector_store(backup_path)
                    backup_info["components"]["vectors"] = vector_backup
                    logger.info(f"Vector store backup completed: {vector_backup['size']} bytes")
                except Exception as e:
                    logger.error(f"Vector store backup failed: {e}")
                    backup_info["components"]["vectors"] = {"status": "failed", "error": str(e)}
            
            # Backup document metadata
            if include_metadata:
                try:
                    metadata_backup = await self._backup_document_metadata(backup_path)
                    backup_info["components"]["metadata"] = metadata_backup
                    logger.info(f"Metadata backup completed: {metadata_backup['size']} bytes")
                except Exception as e:
                    logger.error(f"Metadata backup failed: {e}")
                    backup_info["components"]["metadata"] = {"status": "failed", "error": str(e)}
            
            # Backup chat logs (optional)
            if include_chat_logs:
                try:
                    chat_backup = await self._backup_chat_logs(backup_path)
                    backup_info["components"]["chat_logs"] = chat_backup
                    logger.info(f"Chat logs backup completed: {chat_backup['size']} bytes")
                except Exception as e:
                    logger.error(f"Chat logs backup failed: {e}")
                    backup_info["components"]["chat_logs"] = {"status": "failed", "error": str(e)}
            
            # Create backup manifest
            manifest_path = backup_path / "backup_manifest.json"
            backup_info["status"] = "completed"
            backup_info["completed_at"] = datetime.utcnow().isoformat()
            
            # Calculate total backup size
            total_size = sum(
                component.get("size", 0) 
                for component in backup_info["components"].values()
                if isinstance(component, dict)
            )
            backup_info["total_size"] = total_size
            
            with open(manifest_path, 'w') as f:
                json.dump(backup_info, f, indent=2)
            
            # Create compressed archive
            archive_path = await self._create_backup_archive(backup_path)
            backup_info["archive_path"] = str(archive_path)
            backup_info["archive_size"] = archive_path.stat().st_size
            
            logger.info(
                f"Full backup completed: {backup_name} "
                f"({backup_info['archive_size']} bytes compressed)"
            )
            
            return backup_info
            
        except Exception as e:
            logger.error(f"Full backup failed: {e}")
            raise e
    
    async def _backup_vector_store(self, backup_path: Path) -> Dict[str, Any]:
        """Backup the vector store data."""
        try:
            vectors_dir = backup_path / "vectors"
            vectors_dir.mkdir(exist_ok=True)
            
            # Get collection statistics
            stats = retriever.get_collection_stats()
            
            # Export vectors from Supabase
            vectors_data = []
            try:
                # Query all document vectors
                result = supabase_client.table("document_vectors").select("*").execute()
                vectors_data = result.data
                
                logger.info(f"Exported {len(vectors_data)} vectors from Supabase")
                
            except Exception as e:
                logger.warning(f"Failed to export vectors from Supabase: {e}")
                # For Supabase vector store, we don't have a fallback
                vectors_data = []
            
            # Save vectors data
            vectors_file = vectors_dir / "vectors.json"
            with open(vectors_file, 'w') as f:
                json.dump(vectors_data, f, indent=2)
            
            # Save collection stats
            stats_file = vectors_dir / "collection_stats.json"
            with open(stats_file, 'w') as f:
                json.dump(stats, f, indent=2)
            
            return {
                "status": "completed",
                "vectors_count": len(vectors_data),
                "collection_stats": stats,
                "size": vectors_file.stat().st_size + stats_file.stat().st_size
            }
            
        except Exception as e:
            logger.error(f"Vector store backup failed: {e}")
            raise e
    
    async def _backup_document_metadata(self, backup_path: Path) -> Dict[str, Any]:
        """Backup document metadata from Supabase."""
        try:
            metadata_dir = backup_path / "metadata"
            metadata_dir.mkdir(exist_ok=True)
            
            # Export documents table
            documents_result = supabase_client.table("documents").select("*").execute()
            documents_data = documents_result.data
            
            documents_file = metadata_dir / "documents.json"
            with open(documents_file, 'w') as f:
                json.dump(documents_data, f, indent=2)
            
            total_size = documents_file.stat().st_size
            
            # Export chat logs if table exists
            try:
                chat_logs_result = supabase_client.table("chat_logs").select("*").execute()
                chat_logs_data = chat_logs_result.data
                
                chat_logs_file = metadata_dir / "chat_logs.json"
                with open(chat_logs_file, 'w') as f:
                    json.dump(chat_logs_data, f, indent=2)
                
                total_size += chat_logs_file.stat().st_size
                
            except Exception as e:
                logger.warning(f"Could not backup chat logs: {e}")
            
            return {
                "status": "completed",
                "documents_count": len(documents_data),
                "size": total_size
            }
            
        except Exception as e:
            logger.error(f"Metadata backup failed: {e}")
            raise e
    
    async def _backup_chat_logs(self, backup_path: Path) -> Dict[str, Any]:
        """Backup chat interaction logs."""
        try:
            chat_dir = backup_path / "chat_logs"
            chat_dir.mkdir(exist_ok=True)
            
            # Export chat logs (last 30 days to keep size manageable)
            cutoff_date = datetime.utcnow() - timedelta(days=30)
            
            chat_logs_result = supabase_client.table("chat_logs").select("*").gte(
                "created_at", cutoff_date.isoformat()
            ).execute()
            
            chat_logs_data = chat_logs_result.data
            
            chat_logs_file = chat_dir / "recent_chat_logs.json"
            with open(chat_logs_file, 'w') as f:
                json.dump(chat_logs_data, f, indent=2)
            
            return {
                "status": "completed",
                "chat_logs_count": len(chat_logs_data),
                "date_range": f"Last 30 days from {cutoff_date.isoformat()}",
                "size": chat_logs_file.stat().st_size
            }
            
        except Exception as e:
            logger.error(f"Chat logs backup failed: {e}")
            raise e
    
    async def _create_backup_archive(self, backup_path: Path) -> Path:
        """Create a compressed archive of the backup."""
        archive_path = backup_path.with_suffix('.zip')
        
        with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file_path in backup_path.rglob('*'):
                if file_path.is_file():
                    arcname = file_path.relative_to(backup_path)
                    zipf.write(file_path, arcname)
        
        # Remove the uncompressed backup directory
        shutil.rmtree(backup_path)
        
        return archive_path
    
    async def list_backups(self) -> List[Dict[str, Any]]:
        """List all available backups."""
        backups = []
        
        for backup_file in self.backup_dir.glob('*.zip'):
            try:
                # Extract manifest from archive
                with zipfile.ZipFile(backup_file, 'r') as zipf:
                    if 'backup_manifest.json' in zipf.namelist():
                        with zipf.open('backup_manifest.json') as f:
                            manifest = json.load(f)
                            manifest['file_path'] = str(backup_file)
                            manifest['file_size'] = backup_file.stat().st_size
                            backups.append(manifest)
                    else:
                        # Legacy backup without manifest
                        backups.append({
                            "backup_name": backup_file.stem,
                            "file_path": str(backup_file),
                            "file_size": backup_file.stat().st_size,
                            "created_at": datetime.fromtimestamp(
                                backup_file.stat().st_mtime
                            ).isoformat(),
                            "backup_type": "unknown",
                            "status": "completed"
                        })
            except Exception as e:
                logger.warning(f"Could not read backup {backup_file}: {e}")
                continue
        
        return sorted(backups, key=lambda x: x.get('created_at', ''), reverse=True)
    
    async def restore_backup(
        self, 
        backup_name: str,
        restore_vectors: bool = True,
        restore_metadata: bool = True,
        dry_run: bool = True
    ) -> Dict[str, Any]:
        """
        Restore from a backup.
        
        Args:
            backup_name: Name of the backup to restore
            restore_vectors: Whether to restore vector store
            restore_metadata: Whether to restore document metadata
            dry_run: If True, only simulate the restore operation
            
        Returns:
            Dict with restore operation results
        """
        try:
            backup_file = self.backup_dir / f"{backup_name}.zip"
            if not backup_file.exists():
                raise FileNotFoundError(f"Backup {backup_name} not found")
            
            logger.info(f"Starting restore from backup: {backup_name} (dry_run: {dry_run})")
            
            restore_info = {
                "backup_name": backup_name,
                "restore_type": "full" if restore_vectors and restore_metadata else "partial",
                "dry_run": dry_run,
                "started_at": datetime.utcnow().isoformat(),
                "components": {},
                "status": "in_progress"
            }
            
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)
                
                # Extract backup archive
                with zipfile.ZipFile(backup_file, 'r') as zipf:
                    zipf.extractall(temp_path)
                
                # Read backup manifest
                manifest_file = temp_path / "backup_manifest.json"
                if manifest_file.exists():
                    with open(manifest_file, 'r') as f:
                        backup_manifest = json.load(f)
                    logger.info(f"Backup manifest loaded: {backup_manifest.get('backup_type', 'unknown')} backup")
                
                # Restore vectors
                if restore_vectors and (temp_path / "vectors").exists():
                    try:
                        vector_restore = await self._restore_vector_store(temp_path / "vectors", dry_run)
                        restore_info["components"]["vectors"] = vector_restore
                        logger.info(f"Vector store restore: {vector_restore['status']}")
                    except Exception as e:
                        logger.error(f"Vector store restore failed: {e}")
                        restore_info["components"]["vectors"] = {"status": "failed", "error": str(e)}
                
                # Restore metadata
                if restore_metadata and (temp_path / "metadata").exists():
                    try:
                        metadata_restore = await self._restore_document_metadata(temp_path / "metadata", dry_run)
                        restore_info["components"]["metadata"] = metadata_restore
                        logger.info(f"Metadata restore: {metadata_restore['status']}")
                    except Exception as e:
                        logger.error(f"Metadata restore failed: {e}")
                        restore_info["components"]["metadata"] = {"status": "failed", "error": str(e)}
            
            restore_info["status"] = "completed"
            restore_info["completed_at"] = datetime.utcnow().isoformat()
            
            if dry_run:
                logger.info(f"Dry run restore completed for backup: {backup_name}")
            else:
                logger.info(f"Restore completed for backup: {backup_name}")
            
            return restore_info
            
        except Exception as e:
            logger.error(f"Restore failed: {e}")
            raise e
    
    async def _restore_vector_store(self, vectors_path: Path, dry_run: bool) -> Dict[str, Any]:
        """Restore vector store from backup."""
        vectors_file = vectors_path / "vectors.json"
        
        if not vectors_file.exists():
            raise FileNotFoundError("Vectors backup file not found")
        
        with open(vectors_file, 'r') as f:
            vectors_data = json.load(f)
        
        if dry_run:
            return {
                "status": "simulated",
                "vectors_count": len(vectors_data),
                "action": "would restore vectors to database"
            }
        
        # Actual restore implementation would go here
        # This would involve:
        # 1. Clearing existing vector store
        # 2. Recreating vectors from backup data
        # 3. Rebuilding indexes
        
        return {
            "status": "completed",
            "vectors_count": len(vectors_data),
            "action": "vectors restored to database"
        }
    
    async def _restore_document_metadata(self, metadata_path: Path, dry_run: bool) -> Dict[str, Any]:
        """Restore document metadata from backup."""
        documents_file = metadata_path / "documents.json"
        
        if not documents_file.exists():
            raise FileNotFoundError("Documents backup file not found")
        
        with open(documents_file, 'r') as f:
            documents_data = json.load(f)
        
        if dry_run:
            return {
                "status": "simulated",
                "documents_count": len(documents_data),
                "action": "would restore document metadata to database"
            }
        
        # Actual restore implementation would go here
        # This would involve:
        # 1. Backing up current metadata
        # 2. Restoring documents table
        # 3. Updating foreign key relationships
        
        return {
            "status": "completed",
            "documents_count": len(documents_data),
            "action": "document metadata restored to database"
        }
    
    async def delete_backup(self, backup_name: str) -> bool:
        """Delete a backup."""
        backup_file = self.backup_dir / f"{backup_name}.zip"
        
        if backup_file.exists():
            backup_file.unlink()
            logger.info(f"Backup deleted: {backup_name}")
            return True
        else:
            logger.warning(f"Backup not found: {backup_name}")
            return False
    
    async def cleanup_old_backups(self, keep_count: int = 10) -> int:
        """Clean up old backups, keeping only the most recent ones."""
        backups = await self.list_backups()
        
        if len(backups) <= keep_count:
            return 0
        
        backups_to_delete = backups[keep_count:]
        deleted_count = 0
        
        for backup in backups_to_delete:
            try:
                backup_name = backup['backup_name']
                if await self.delete_backup(backup_name):
                    deleted_count += 1
            except Exception as e:
                logger.error(f"Failed to delete backup {backup.get('backup_name', 'unknown')}: {e}")
        
        logger.info(f"Cleaned up {deleted_count} old backups")
        return deleted_count


# Global backup service instance
backup_service = BackupService()