from rest_framework import serializers
from .models import ChatSession, ChatMessage, RAGDocument


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'role', 'content', 'created_at']


class ChatSessionSerializer(serializers.ModelSerializer):
    messages = ChatMessageSerializer(many=True, read_only=True)
    message_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatSession
        fields = ['id', 'title', 'mode', 'created_at', 'updated_at', 'messages', 'message_count']

    def get_message_count(self, obj):
        return obj.messages.count()


class ChatSessionListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for sidebar listing."""
    message_count = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = ChatSession
        fields = ['id', 'title', 'mode', 'created_at', 'updated_at', 'message_count', 'last_message']

    def get_message_count(self, obj):
        return obj.messages.count()

    def get_last_message(self, obj):
        last = obj.messages.last()
        if last:
            return last.content[:80]
        return None


class RAGDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = RAGDocument
        fields = ['id', 'title', 'file', 'uploaded_at']


class ChatRequestSerializer(serializers.Serializer):
    message = serializers.CharField()
    session_id = serializers.IntegerField(required=False, allow_null=True)
    mode = serializers.ChoiceField(choices=['genai', 'rag'], default='genai')
