from django.db import models


class ChatSession(models.Model):
    """A chat session/conversation thread."""
    title = models.CharField(max_length=255, default='New Chat')
    mode = models.CharField(max_length=10, choices=[('genai', 'GenAI'), ('rag', 'RAG')], default='genai')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.title} ({self.mode})"


class ChatMessage(models.Model):
    """Individual message within a chat session."""
    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=10, choices=[('user', 'User'), ('assistant', 'Assistant')])
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.role}: {self.content[:50]}"


class RAGDocument(models.Model):
    """Uploaded document for RAG knowledge base."""
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to='rag_documents/')
    content = models.TextField(blank=True, help_text='Extracted text content')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return self.title


class DocumentChunk(models.Model):
    """Chunked text from a RAG document for retrieval."""
    document = models.ForeignKey(RAGDocument, on_delete=models.CASCADE, related_name='chunks')
    content = models.TextField()
    chunk_index = models.IntegerField()

    class Meta:
        ordering = ['document', 'chunk_index']

    def __str__(self):
        return f"{self.document.title} - Chunk {self.chunk_index}"
