import os
from django.shortcuts import render
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import ChatSession, ChatMessage, RAGDocument, DocumentChunk
from .serializers import (
    ChatSessionSerializer,
    ChatSessionListSerializer,
    ChatMessageSerializer,
    RAGDocumentSerializer,
    ChatRequestSerializer,
)
from .ai_service import generate_genai_response, generate_rag_response
from .document_processor import extract_text_from_file, chunk_text


def index(request):
    """Serve the main chat interface."""
    return render(request, 'chatbot/index.html')


# ─── Chat API ───────────────────────────────────────────────

@api_view(['POST'])
def chat(request):
    """Handle a chat message — routes to GenAI or RAG based on mode."""
    serializer = ChatRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    user_message = serializer.validated_data['message']
    mode = serializer.validated_data.get('mode', 'genai')
    session_id = serializer.validated_data.get('session_id')

    # Get or create session
    if session_id:
        try:
            session = ChatSession.objects.get(id=session_id)
            # Update mode if changed
            if session.mode != mode:
                session.mode = mode
                session.save()
        except ChatSession.DoesNotExist:
            session = ChatSession.objects.create(
                title=user_message[:50],
                mode=mode,
            )
    else:
        session = ChatSession.objects.create(
            title=user_message[:50],
            mode=mode,
        )

    # Save user message
    ChatMessage.objects.create(session=session, role='user', content=user_message)

    # Build chat history for context
    history = list(
        session.messages.order_by('-created_at')[:10]
        .values('role', 'content')
    )
    history.reverse()

    # Generate AI response
    if mode == 'rag':
        ai_response = generate_rag_response(user_message, history)
    else:
        ai_response = generate_genai_response(user_message, history)

    # Save assistant message
    assistant_msg = ChatMessage.objects.create(
        session=session, role='assistant', content=ai_response
    )

    # Update session title from first message
    if session.messages.count() <= 2:
        session.title = user_message[:50]
        session.save()

    return Response({
        'session_id': session.id,
        'message': ChatMessageSerializer(assistant_msg).data,
        'session_title': session.title,
    })


# ─── Session API ────────────────────────────────────────────

@api_view(['GET'])
def session_list(request):
    """List all chat sessions for the sidebar."""
    sessions = ChatSession.objects.all()
    serializer = ChatSessionListSerializer(sessions, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def session_detail(request, pk):
    """Get a specific chat session with all messages."""
    try:
        session = ChatSession.objects.get(pk=pk)
    except ChatSession.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

    serializer = ChatSessionSerializer(session)
    return Response(serializer.data)


@api_view(['DELETE'])
def session_delete(request, pk):
    """Delete a chat session."""
    try:
        session = ChatSession.objects.get(pk=pk)
        session.delete()
        return Response({'message': 'Session deleted'}, status=status.HTTP_204_NO_CONTENT)
    except ChatSession.DoesNotExist:
        return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['DELETE'])
def session_clear_all(request):
    """Delete all chat sessions."""
    ChatSession.objects.all().delete()
    return Response({'message': 'All sessions cleared'}, status=status.HTTP_204_NO_CONTENT)


# ─── Document API (RAG) ────────────────────────────────────

@api_view(['GET'])
def document_list(request):
    """List all uploaded RAG documents."""
    documents = RAGDocument.objects.all()
    serializer = RAGDocumentSerializer(documents, many=True)
    return Response(serializer.data)


@api_view(['POST'])
def document_upload(request):
    """Upload a document for RAG knowledge base."""
    file = request.FILES.get('file')
    if not file:
        return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

    # Validate file type
    ext = os.path.splitext(file.name)[1].lower()
    if ext not in ('.pdf', '.txt', '.md', '.csv'):
        return Response(
            {'error': 'Unsupported file type. Supported: .pdf, .txt, .md, .csv'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Create document record
    doc = RAGDocument.objects.create(title=file.name, file=file)

    try:
        # Extract text
        file_path = os.path.join(settings.MEDIA_ROOT, str(doc.file))
        text = extract_text_from_file(file_path)
        doc.content = text
        doc.save()

        # Chunk the text
        chunks = chunk_text(text)
        for i, chunk_content in enumerate(chunks):
            DocumentChunk.objects.create(
                document=doc,
                content=chunk_content,
                chunk_index=i,
            )

        return Response({
            'message': f'Document "{file.name}" uploaded and processed successfully.',
            'document': RAGDocumentSerializer(doc).data,
            'chunks_created': len(chunks),
        }, status=status.HTTP_201_CREATED)

    except ValueError as e:
        doc.delete()
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
def document_delete(request, pk):
    """Delete a RAG document and its chunks."""
    try:
        doc = RAGDocument.objects.get(pk=pk)
        # Delete the file from disk
        if doc.file and os.path.exists(doc.file.path):
            os.remove(doc.file.path)
        doc.delete()
        return Response({'message': 'Document deleted'}, status=status.HTTP_204_NO_CONTENT)
    except RAGDocument.DoesNotExist:
        return Response({'error': 'Document not found'}, status=status.HTTP_404_NOT_FOUND)
