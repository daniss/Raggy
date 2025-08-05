"""
File processing constants and configuration.
"""

# Supported file types for upload
ALLOWED_FILE_TYPES = [
    "application/pdf",
    "text/plain", 
    "text/markdown",
    "text/csv",
    "application/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]

# File size limits
DEFAULT_MAX_FILE_SIZE_MB = 10
BATCH_MAX_FILES = 50

# File type descriptions for user-facing messages
FILE_TYPE_MAP = {
    "application/pdf": "PDF",
    "text/plain": "Text",
    "text/markdown": "Markdown", 
    "text/csv": "CSV",
    "application/csv": "CSV",
    "application/msword": "Word Document",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word Document"
}

def get_supported_formats_list() -> list:
    """Get a list of supported file formats for display."""
    return list(set(FILE_TYPE_MAP.values()))