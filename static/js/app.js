/* ═══════════════════════════════════════════════════
   NexusAI — Application Logic
   ═══════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  // ── State ──
  let currentMode = 'genai';
  let currentSessionId = null;
  let isLoading = false;

  // ── DOM Elements ──
  const sidebar = document.getElementById('sidebar');
  const sidebarOpenBtn = document.getElementById('sidebarOpenBtn');
  const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
  const newChatBtn = document.getElementById('newChatBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const sessionList = document.getElementById('sessionList');
  const emptyHistory = document.getElementById('emptyHistory');
  const chatArea = document.getElementById('chatArea');
  const welcomeScreen = document.getElementById('welcomeScreen');
  const messagesContainer = document.getElementById('messagesContainer');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const inputWrapper = document.getElementById('inputWrapper');
  const sessionTitle = document.getElementById('sessionTitle');
  const genaiModeBtn = document.getElementById('genaiModeBtn');
  const ragModeBtn = document.getElementById('ragModeBtn');
  const modeSlider = document.getElementById('modeSlider');
  const modeIndicator = document.getElementById('modeIndicator');
  const modeLabel = document.getElementById('modeLabel');
  const fileInput = document.getElementById('fileInput');
  const uploadModal = document.getElementById('uploadModal');
  const uploadStatus = document.getElementById('uploadStatus');
  const documentList = document.getElementById('documentList');
  const emptyDocs = document.getElementById('emptyDocs');
  const toastContainer = document.getElementById('toastContainer');

  // ── CSRF Token ──
  function getCSRFToken() {
    const cookie = document.cookie.split(';').find(c => c.trim().startsWith('csrftoken='));
    return cookie ? cookie.split('=')[1] : '';
  }

  // ── Toast ──
  function showToast(message, type = 'info') {
    const icons = { success: 'check_circle', error: 'error', info: 'info' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="material-icons-round">${icons[type]}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 300); }, 3500);
  }

  // ── Sidebar ──
  sidebarOpenBtn.addEventListener('click', () => sidebar.classList.remove('collapsed'));
  sidebarCloseBtn.addEventListener('click', () => sidebar.classList.add('collapsed'));

  // ── Mode Toggle ──
  function setMode(mode) {
    currentMode = mode;
    genaiModeBtn.classList.toggle('active', mode === 'genai');
    ragModeBtn.classList.toggle('active', mode === 'rag');
    modeSlider.classList.toggle('rag', mode === 'rag');
    modeIndicator.classList.toggle('rag', mode === 'rag');
    modeLabel.textContent = mode === 'genai' ? 'GenAI Mode' : 'RAG Mode';
    inputWrapper.classList.toggle('rag', mode === 'rag');
    sendBtn.classList.toggle('rag', mode === 'rag');
    messageInput.placeholder = mode === 'rag'
      ? 'Ask about your documents...'
      : 'Type your message...';
  }

  genaiModeBtn.addEventListener('click', () => setMode('genai'));
  ragModeBtn.addEventListener('click', () => setMode('rag'));

  // Feature cards switch mode
  document.querySelectorAll('.feature-card').forEach(card => {
    card.addEventListener('click', () => setMode(card.dataset.mode));
  });

  // ── New Chat ──
  function startNewChat() {
    currentSessionId = null;
    sessionTitle.textContent = 'New Chat';
    messagesContainer.innerHTML = '';
    welcomeScreen.classList.remove('hidden');
    document.querySelectorAll('.session-item').forEach(el => el.classList.remove('active'));
  }
  newChatBtn.addEventListener('click', startNewChat);

  // ── Quick Prompts ──
  document.querySelectorAll('.quick-prompt').forEach(btn => {
    btn.addEventListener('click', () => {
      messageInput.value = btn.dataset.prompt;
      sendBtn.disabled = false;
      sendMessage();
    });
  });

  // ── Input Handling ──
  messageInput.addEventListener('input', () => {
    sendBtn.disabled = !messageInput.value.trim();
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
  });

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (messageInput.value.trim() && !isLoading) sendMessage();
    }
  });

  sendBtn.addEventListener('click', () => {
    if (messageInput.value.trim() && !isLoading) sendMessage();
  });

  // ── Send Message ──
  async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || isLoading) return;
    isLoading = true;
    sendBtn.disabled = true;
    messageInput.value = '';
    messageInput.style.height = 'auto';
    welcomeScreen.classList.add('hidden');

    appendMessage('user', text);
    showTypingIndicator();

    try {
      const res = await fetch('/api/chat/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCSRFToken() },
        body: JSON.stringify({ message: text, mode: currentMode, session_id: currentSessionId }),
      });
      const data = await res.json();
      removeTypingIndicator();

      if (res.ok) {
        currentSessionId = data.session_id;
        sessionTitle.textContent = data.session_title || 'Chat';
        appendMessage('assistant', data.message.content);
        loadSessions();
      } else {
        appendMessage('assistant', '❌ ' + (data.error || 'Something went wrong.'));
      }
    } catch (err) {
      removeTypingIndicator();
      appendMessage('assistant', '❌ Network error. Please try again.');
    }
    isLoading = false;
  }

  // ── Message Rendering ──
  function appendMessage(role, content) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    const icon = role === 'user' ? 'person' : 'auto_awesome';
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `
      <div class="message-avatar"><span class="material-icons-round">${icon}</span></div>
      <div class="message-content">
        <div class="message-bubble">${formatContent(content)}</div>
        <div class="message-time">${time}</div>
      </div>`;
    messagesContainer.appendChild(div);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function formatContent(text) {
    // Code blocks
    text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    // Inline code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Line breaks
    text = text.replace(/\n/g, '<br>');
    return text;
  }

  function showTypingIndicator() {
    const div = document.createElement('div');
    div.className = 'typing-indicator';
    div.id = 'typingIndicator';
    div.innerHTML = `
      <div class="message-avatar" style="background:var(--bg-tertiary);border:1px solid var(--border-color)">
        <span class="material-icons-round" style="color:var(--accent)">auto_awesome</span>
      </div>
      <div class="typing-dots"><span></span><span></span><span></span></div>`;
    messagesContainer.appendChild(div);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function removeTypingIndicator() {
    document.getElementById('typingIndicator')?.remove();
  }

  // ── Sessions ──
  async function loadSessions() {
    try {
      const res = await fetch('/api/sessions/');
      const sessions = await res.json();
      renderSessions(sessions);
    } catch (e) { /* silent */ }
  }

  function renderSessions(sessions) {
    const items = sessions.map(s => {
      const active = s.id === currentSessionId ? 'active' : '';
      const modeClass = s.mode || 'genai';
      const icon = modeClass === 'rag' ? 'library_books' : 'psychology';
      const date = new Date(s.updated_at).toLocaleDateString();
      return `
        <div class="session-item ${active}" data-id="${s.id}" onclick="window._loadSession(${s.id})">
          <div class="session-icon ${modeClass}"><span class="material-icons-round">${icon}</span></div>
          <div class="session-info">
            <div class="title">${escapeHtml(s.title)}</div>
            <div class="meta"><span>${s.mode.toUpperCase()}</span>·<span>${date}</span>·<span>${s.message_count} msgs</span></div>
          </div>
          <button class="btn-icon session-delete" onclick="event.stopPropagation();window._deleteSession(${s.id})" title="Delete">
            <span class="material-icons-round" style="font-size:16px">close</span>
          </button>
        </div>`;
    }).join('');
    sessionList.innerHTML = items || '';
    emptyHistory.style.display = sessions.length ? 'none' : 'flex';
    if (!sessions.length) sessionList.appendChild(emptyHistory);
  }

  window._loadSession = async (id) => {
    try {
      const res = await fetch(`/api/sessions/${id}/`);
      const session = await res.json();
      currentSessionId = session.id;
      sessionTitle.textContent = session.title;
      setMode(session.mode);
      welcomeScreen.classList.add('hidden');
      messagesContainer.innerHTML = '';
      session.messages.forEach(m => appendMessage(m.role, m.content));
      document.querySelectorAll('.session-item').forEach(el => {
        el.classList.toggle('active', parseInt(el.dataset.id) === id);
      });
    } catch (e) { showToast('Failed to load session', 'error'); }
  };

  window._deleteSession = async (id) => {
    try {
      await fetch(`/api/sessions/${id}/delete/`, {
        method: 'DELETE', headers: { 'X-CSRFToken': getCSRFToken() }
      });
      if (currentSessionId === id) startNewChat();
      loadSessions();
      showToast('Chat deleted', 'success');
    } catch (e) { showToast('Failed to delete', 'error'); }
  };

  clearAllBtn.addEventListener('click', async () => {
    if (!confirm('Delete all chat history?')) return;
    await fetch('/api/sessions/clear/', {
      method: 'DELETE', headers: { 'X-CSRFToken': getCSRFToken() }
    });
    startNewChat();
    loadSessions();
    showToast('All chats cleared', 'success');
  });

  // ── Documents ──
  async function loadDocuments() {
    try {
      const res = await fetch('/api/documents/');
      const docs = await res.json();
      renderDocuments(docs);
    } catch (e) { /* silent */ }
  }

  function renderDocuments(docs) {
    const items = docs.map(d => `
      <div class="doc-item">
        <span class="material-icons-round">description</span>
        <span class="doc-name" title="${escapeHtml(d.title)}">${escapeHtml(d.title)}</span>
        <button class="doc-delete" onclick="window._deleteDoc(${d.id})" title="Remove">
          <span class="material-icons-round" style="font-size:14px">close</span>
        </button>
      </div>`).join('');
    documentList.innerHTML = items || '';
    emptyDocs.style.display = docs.length ? 'none' : 'flex';
    if (!docs.length) documentList.appendChild(emptyDocs);
  }

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    uploadModal.classList.add('active');
    uploadStatus.textContent = `Processing "${file.name}"...`;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/documents/upload/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCSRFToken() },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`${data.chunks_created} chunks created from "${file.name}"`, 'success');
        loadDocuments();
      } else {
        showToast(data.error || 'Upload failed', 'error');
      }
    } catch (err) {
      showToast('Upload failed — network error', 'error');
    }
    uploadModal.classList.remove('active');
    fileInput.value = '';
  });

  window._deleteDoc = async (id) => {
    await fetch(`/api/documents/${id}/delete/`, {
      method: 'DELETE', headers: { 'X-CSRFToken': getCSRFToken() }
    });
    loadDocuments();
    showToast('Document removed', 'success');
  };

  function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  // ── Init ──
  loadSessions();
  loadDocuments();
});
