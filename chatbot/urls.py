from django.urls import path
from . import views

urlpatterns = [
    # Frontend
    path('', views.index, name='index'),

    # Chat API
    path('api/chat/', views.chat, name='chat'),

    # Session API
    path('api/sessions/', views.session_list, name='session-list'),
    path('api/sessions/<int:pk>/', views.session_detail, name='session-detail'),
    path('api/sessions/<int:pk>/delete/', views.session_delete, name='session-delete'),
    path('api/sessions/clear/', views.session_clear_all, name='session-clear-all'),

    # Document API (RAG)
    path('api/documents/', views.document_list, name='document-list'),
    path('api/documents/upload/', views.document_upload, name='document-upload'),
    path('api/documents/<int:pk>/delete/', views.document_delete, name='document-delete'),
]
