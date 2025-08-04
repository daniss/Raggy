"""Input validation utilities for the API."""

import re
from typing import List, Optional
from fastapi import HTTPException
from pydantic import BaseModel, validator


class FileValidationError(Exception):
    """Custom exception for file validation errors."""
    pass


def validate_file_type(content_type: str, allowed_types: List[str]) -> bool:
    """Validate if file content type is allowed."""
    return content_type in allowed_types


def validate_file_size(size_bytes: int, max_size_mb: int = 10) -> bool:
    """Validate if file size is within limits."""
    max_size_bytes = max_size_mb * 1024 * 1024
    return size_bytes <= max_size_bytes


def validate_filename(filename: str) -> bool:
    """Validate filename for security."""
    if not filename:
        return False
    
    # Check for dangerous patterns
    dangerous_patterns = [
        r'\.\./',  # Directory traversal
        r'[<>:"/\\|?*]',  # Invalid filename characters
        r'^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)',  # Windows reserved names
    ]
    
    for pattern in dangerous_patterns:
        if re.search(pattern, filename, re.IGNORECASE):
            return False
    
    return len(filename) <= 255  # Maximum filename length


def sanitize_filename(filename: str) -> str:
    """Sanitize filename by removing dangerous characters."""
    # Remove path separators and other dangerous characters
    sanitized = re.sub(r'[<>:"/\\|?*]', '_', filename)
    
    # Remove directory traversal patterns
    sanitized = re.sub(r'\.\.', '_', sanitized)
    
    # Ensure it's not a Windows reserved name
    name_part = sanitized.split('.')[0].upper()
    if name_part in ['CON', 'PRN', 'AUX', 'NUL'] or \
       name_part.startswith(('COM', 'LPT')):
        sanitized = f"file_{sanitized}"
    
    # Truncate if too long
    if len(sanitized) > 255:
        name, ext = sanitized.rsplit('.', 1) if '.' in sanitized else (sanitized, '')
        max_name_length = 255 - len(ext) - 1 if ext else 255
        sanitized = f"{name[:max_name_length]}.{ext}" if ext else name[:255]
    
    return sanitized


def validate_search_query(query: str) -> bool:
    """Validate search query for safety."""
    if not query:
        return True
    
    # Check length
    if len(query) > 100:
        return False
    
    # Check for SQL injection patterns (basic)
    dangerous_patterns = [
        r'(union|select|insert|update|delete|drop|create|alter)\s',
        r'[;\'"]',
        r'--',
        r'/\*.*\*/',
    ]
    
    for pattern in dangerous_patterns:
        if re.search(pattern, query, re.IGNORECASE):
            return False
    
    return True


def validate_pagination_params(page: int, page_size: int) -> tuple[int, int]:
    """Validate and normalize pagination parameters."""
    # Ensure page is at least 1
    page = max(1, page)
    
    # Ensure page_size is within reasonable bounds
    page_size = max(1, min(100, page_size))
    
    return page, page_size


class DocumentUploadRequest(BaseModel):
    """Model for document upload validation."""
    max_file_size_mb: int = 10
    allowed_content_types: List[str] = [
        "application/pdf",
        "text/plain",
        "text/markdown",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]

    @validator('max_file_size_mb')
    def validate_max_file_size(cls, v):
        if v <= 0 or v > 100:  # Max 100MB
            raise ValueError('File size must be between 1MB and 100MB')
        return v