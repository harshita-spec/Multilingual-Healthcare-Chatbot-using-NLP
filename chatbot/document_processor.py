"""
Document processing utilities for RAG.
Handles PDF and text file parsing + chunking.
"""

import os
import logging
from PyPDF2 import PdfReader

logger = logging.getLogger(__name__)


def extract_text_from_file(file_path: str) -> str:
    """Extract text content from uploaded files (PDF or TXT)."""
    ext = os.path.splitext(file_path)[1].lower()

    if ext == '.pdf':
        return _extract_from_pdf(file_path)
    elif ext in ('.txt', '.md', '.csv'):
        return _extract_from_text(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}. Supported: .pdf, .txt, .md, .csv")


def _extract_from_pdf(file_path: str) -> str:
    """Extract text from a PDF file."""
    try:
        reader = PdfReader(file_path)
        text_parts = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text)
        return "\n\n".join(text_parts)
    except Exception as e:
        logger.error(f"Error extracting PDF: {e}")
        raise ValueError(f"Failed to extract text from PDF: {e}")


def _extract_from_text(file_path: str) -> str:
    """Extract text from a plain text file."""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()
    except Exception as e:
        logger.error(f"Error reading text file: {e}")
        raise ValueError(f"Failed to read text file: {e}")


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list:
    """
    Split text into overlapping chunks for better retrieval.
    
    Args:
        text: The full text to chunk
        chunk_size: Max words per chunk
        overlap: Number of overlapping words between chunks
    
    Returns:
        List of text chunks
    """
    words = text.split()

    if len(words) <= chunk_size:
        return [text.strip()] if text.strip() else []

    chunks = []
    start = 0

    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        if chunk.strip():
            chunks.append(chunk.strip())
        start += chunk_size - overlap

    return chunks
