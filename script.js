/**
 * Farhan Jawed - AI Agent | UI Logic Only (Part 1)
 * Handles all frontend interactions: sidebar, modal, tabs, inputs, toasts, etc.
 * No API calls - that comes in Part 2
 */

(() => {
  'use strict';

  // ============================================================
  // DOM Element References
  // ============================================================
  const els = {
    // Sidebar
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    menuToggle: document.getElementById('menuToggle'),
    sidebarClose: document.getElementById('sidebarClose'),
    newChatBtn: document.getElementById('newChatBtn'),
    chatHistory: document.getElementById('chatHistory'),
    historyEmpty: document.getElementById('historyEmpty'),

    // Top Bar
    settingsTrigger: document.getElementById('settingsTrigger'),
    themeToggle: document.getElementById('themeToggle'),
    modelIndicator: document.getElementById('modelIndicator'),

    // Chat Window
    welcomeState: document.getElementById('welcomeState'),
    welcomeSuggestions: document.getElementById('welcomeSuggestions'),
    messagesList: document.getElementById('messagesList'),
    typingIndicator: document.getElementById('typingIndicator'),

    // Input Area
    inputForm: document.getElementById('inputForm'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    attachBtn: document.getElementById('attachBtn'),
    fileInput: document.getElementById('fileInput'),
    attachmentPreview: document.getElementById('attachmentPreview'),
    previewThumb: document.getElementById('previewThumb'),
    previewName: document.getElementById('previewName'),
    previewSize: document.getElementById('previewSize'),
    previewRemove: document.getElementById('previewRemove'),
    charCount: document.getElementById('charCount'),

    // Settings Modal
    settingsModal: document.getElementById('settingsModal'),
    modalBackdrop: document.getElementById('modalBackdrop'),
    modalClose: document.getElementById('modalClose'),
    modalCancel: document.getElementById('modalCancel'),
    saveKeysBtn: document.getElementById('saveKeysBtn'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabPanels: document.querySelectorAll('.tab-panel'),

    // API Key Inputs
    googleKey: document.getElementById('googleKey'),
    groqKey: document.getElementById('groqKey'),
    openrouterKey: document.getElementById('openrouterKey'),
    toggleGoogleKey: document.getElementById('toggleGoogleKey'),
    toggleGroqKey: document.getElementById('toggleGroqKey'),
    toggleOpenRouterKey: document.getElementById('toggleOpenRouterKey'),

    // Key Status
    keyStatus: document.getElementById('keyStatus'),

    // Toast
    toastContainer: document.getElementById('toastContainer'),
  };

  // ============================================================
  // State
  // ============================================================
  const state = {
    sidebarOpen: false,
    modalOpen: false,
    activeTab: 'google',
    attachedFiles: [],
    currentChatId: null,
    chats: JSON.parse(localStorage.getItem('fjai_chats') || '[]'),
    theme: localStorage.getItem('fjai_theme') || 'dark',
  };

  // ============================================================
  // Initialization
  // ============================================================
  function init() {
    loadTheme();
    loadKeys();
    renderChatHistory();
    renderWelcomeSuggestions();
    updateKeyStatus();
    bindEvents();
    autoResizeTextarea();
    updateCharCount();
  }

  // ============================================================
  // Event Binding
  // ============================================================
  function bindEvents() {
    // Sidebar
    els.menuToggle?.addEventListener('click', toggleSidebar);
    els.sidebarClose?.addEventListener('click', closeSidebar);
    els.sidebarOverlay?.addEventListener('click', closeSidebar);
    els.newChatBtn?.addEventListener('click', newChat);

    // Settings Modal
    els.settingsTrigger?.addEventListener('click', openModal);
    els.modalClose?.addEventListener('click', closeModal);
    els.modalCancel?.addEventListener('click', closeModal);
    els.modalBackdrop?.addEventListener('click', closeModal);
    els.saveKeysBtn?.addEventListener('click', saveKeys);

    // Tabs
    els.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.panel));
    });

    // Key Visibility Toggles
    els.toggleGoogleKey?.addEventListener('click', () => toggleVisibility('googleKey', 'toggleGoogleKey'));
    els.toggleGroqKey?.addEventListener('click', () => toggleVisibility('groqKey', 'toggleGroqKey'));
    els.toggleOpenRouterKey?.addEventListener('click', () => toggleVisibility('openrouterKey', 'toggleOpenRouterKey'));

    // Theme Toggle
    els.themeToggle?.addEventListener('click', toggleTheme);

    // Input Area
    els.messageInput?.addEventListener('input', () => {
      autoResizeTextarea();
      updateCharCount();
      updateSendButton();
    });

    els.messageInput?.addEventListener('keydown', handleKeydown);

    els.inputForm?.addEventListener('submit', handleSubmit);

    els.attachBtn?.addEventListener('click', () => els.fileInput?.click());
    els.fileInput?.addEventListener('change', handleFileSelect);
    els.previewRemove?.addEventListener('click', removeAttachment);

    // Welcome Suggestions (delegated)
    els.welcomeSuggestions?.addEventListener('click', (e) => {
      const chip = e.target.closest('.suggestion-chip');
      if (chip) {
        els.messageInput.value = chip.dataset.prompt || chip.textContent.trim();
        autoResizeTextarea();
        updateCharCount();
        updateSendButton();
        els.messageInput.focus();
        hideWelcomeState();
      }
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', handleGlobalKeydown);

    // Close modal on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.modalOpen) closeModal();
      if (e.key === 'Escape' && state.sidebarOpen) closeSidebar();
    });
  }

  // ============================================================
  // Sidebar Functions
  // ============================================================
  function toggleSidebar() {
    state.sidebarOpen = !state.sidebarOpen;
    els.sidebar?.classList.toggle('open', state.sidebarOpen);
    els.sidebarOverlay?.classList.toggle('visible', state.sidebarOpen);
    els.menuToggle?.setAttribute('aria-expanded', state.sidebarOpen);
    document.body.style.overflow = state.sidebarOpen ? 'hidden' : '';
  }

  function closeSidebar() {
    state.sidebarOpen = false;
    els.sidebar?.classList.remove('open');
    els.sidebarOverlay?.classList.remove('visible');
    els.menuToggle?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  // ============================================================
  // Modal Functions
  // ============================================================
  function openModal() {
    state.modalOpen = true;
    els.settingsModal?.showModal();
    els.modalBackdrop?.classList.add('visible');
    document.body.style.overflow = 'hidden';
    els.settingsTrigger?.setAttribute('aria-expanded', 'true');
    // Focus first input
    setTimeout(() => els.googleKey?.focus(), 100);
  }

  function closeModal() {
    state.modalOpen = false;
    els.settingsModal?.close();
    els.modalBackdrop?.classList.remove('visible');
    document.body.style.overflow = state.sidebarOpen ? 'hidden' : '';
    els.settingsTrigger?.setAttribute('aria-expanded', 'false');
  }

  function switchTab(panelId) {
    state.activeTab = panelId;

    els.tabBtns.forEach(btn => {
      const isActive = btn.dataset.panel === panelId;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive);
    });

    els.tabPanels.forEach(panel => {
      const isActive = panel.id === `panel-${panelId}`;
      panel.classList.toggle('active', isActive);
      panel.hidden = !isActive;
    });
  }

  // ============================================================
  // API Key Management (localStorage only)
  // ============================================================
  function loadKeys() {
    const keys = {
      google: localStorage.getItem('fjai_key_google') || '',
      groq: localStorage.getItem('fjai_key_groq') || '',
      openrouter: localStorage.getItem('fjai_key_openrouter') || '',
    };

    els.googleKey.value = keys.google;
    els.groqKey.value = keys.groq;
    els.openrouterKey.value = keys.openrouter;
  }

  function saveKeys() {
    const keys = {
      google: els.googleKey.value.trim(),
      groq: els.groqKey.value.trim(),
      openrouter: els.openrouterKey.value.trim(),
    };

    let savedCount = 0;
    Object.entries(keys).forEach(([provider, key]) => {
      const storageKey = `fjai_key_${provider}`;
      if (key) {
        localStorage.setItem(storageKey, key);
        savedCount++;
      } else {
        localStorage.removeItem(storageKey);
      }
    });

    updateKeyStatus();
    showToast(savedCount > 0 ? `${savedCount} key(s) saved successfully` : 'All keys cleared', 'success');
    closeModal();
  }

  function toggleVisibility(inputId, toggleId) {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(toggleId);
    if (!input || !toggle) return;

    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', isPassword);
  }

  function updateKeyStatus() {
    const providers = [
      { id: 'google', name: 'Google Gemini', key: localStorage.getItem('fjai_key_google') },
      { id: 'groq', name: 'Groq', key: localStorage.getItem('fjai_key_groq') },
      { id: 'openrouter', name: 'OpenRouter', key: localStorage.getItem('fjai_key_openrouter') },
    ];

    els.keyStatus.innerHTML = providers.map(p => `
      <div class="key-status-item">
        <div class="key-status-icon ${p.key ? 'connected' : 'disconnected'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            ${p.key
              ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
              : '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'}
          </svg>
        </div>
        <div class="key-status-info">
          <div class="key-status-name">${p.name}</div>
          <div class="key-status-detail">${p.key ? 'Connected' : 'Not configured'}</div>
        </div>
      </div>
    `).join('');
  }

  // ============================================================
  // Theme
  // ============================================================
  function loadTheme() {
    state.theme = localStorage.getItem('fjai_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
  }

  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem('fjai_theme', state.theme);
  }

  // ============================================================
  // Chat History (UI Only)
  // ============================================================
  function renderChatHistory() {
    if (!els.chatHistory) return;

    if (state.chats.length === 0) {
      els.chatHistory.innerHTML = `
        <div class="history-empty" id="historyEmpty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <p>No conversations yet</p>
          <span>Start a new chat to begin</span>
        </div>
      `;
      return;
    }

    els.chatHistory.innerHTML = `
      <div class="history-list" role="list">
        ${state.chats.map(chat => `
          <button class="history-item ${chat.id === state.currentChatId ? 'active' : ''}"
                  data-chat-id="${chat.id}"
                  role="listitem"
                  aria-current="${chat.id === state.currentChatId ? 'true' : 'false'}">
            <div class="history-item-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <div class="history-item-content">
              <div class="history-item-title">${escapeHtml(chat.title)}</div>
              <div class="history-item-time">${formatTime(chat.updatedAt)}</div>
            </div>
            <div class="history-item-actions">
              <button class="history-action-btn delete-chat" data-chat-id="${chat.id}" aria-label="Delete chat">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </button>
        `).join('')}
      </div>
    `;

    // Bind click events
    els.chatHistory.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.delete-chat')) return;
        const chatId = item.dataset.chatId;
        loadChat(chatId);
      });
    });

    els.chatHistory.querySelectorAll('.delete-chat').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const chatId = btn.dataset.chatId;
        deleteChat(chatId);
      });
    });
  }

  function newChat() {
    state.currentChatId = null;
    clearMessages();
    showWelcomeState();
    updateActiveHistoryItem();
    closeSidebar();
    els.messageInput?.focus();
  }

  function loadChat(chatId) {
    const chat = state.chats.find(c => c.id === chatId);
    if (!chat) return;

    state.currentChatId = chatId;
    clearMessages();
    hideWelcomeState();

    chat.messages.forEach(msg => {
      appendMessage(msg.role, msg.content, false);
    });

    scrollToBottom();
    updateActiveHistoryItem();
    closeSidebar();
    els.messageInput?.focus();
  }

  function deleteChat(chatId) {
    state.chats = state.chats.filter(c => c.id !== chatId);
    localStorage.setItem('fjai_chats', JSON.stringify(state.chats));

    if (state.currentChatId === chatId) {
      newChat();
    }
    renderChatHistory();
    showToast('Chat deleted', 'info');
  }

  function updateActiveHistoryItem() {
    els.chatHistory?.querySelectorAll('.history-item').forEach(item => {
      item.classList.toggle('active', item.dataset.chatId === state.currentChatId);
      item.setAttribute('aria-current', item.dataset.chatId === state.currentChatId);
    });
  }

  // ============================================================
  // Message Handling (UI Only)
  // ============================================================
  function clearMessages() {
    if (els.messagesList) els.messagesList.innerHTML = '';
  }

  function showWelcomeState() {
    els.welcomeState?.classList.remove('hidden');
    els.messagesList?.classList.add('hidden');
  }

  function hideWelcomeState() {
    els.welcomeState?.classList.add('hidden');
    els.messagesList?.classList.remove('hidden');
  }

  function appendMessage(role, content, animate = true) {
    if (!els.messagesList) return;

    hideWelcomeState();

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role === 'user' ? 'user' : 'assistant'}`;
    if (animate) messageDiv.style.animation = 'messageIn 0.3s var(--transition-bounce)';

    const avatarIcon = role === 'user'
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M12 14v8M4 21c0-3.5 2.5-6.5 8-6.5s8 3 8 6.5"></path></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>';

    messageDiv.innerHTML = `
      <div class="message-avatar">${avatarIcon}</div>
      <div class="message-content">
        <div class="message-bubble">${renderMarkdown(content)}</div>
        <div class="message-time">${formatTime(Date.now())}</div>
      </div>
    `;

    els.messagesList.appendChild(messageDiv);
    scrollToBottom();

    // Add copy code button listeners
    messageDiv.querySelectorAll('.copy-code-btn').forEach(btn => {
      btn.addEventListener('click', () => copyCode(btn));
    });
  }

  function renderMarkdown(text) {
    if (!text) return '';

    return text
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      // Code blocks
      .replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => `
        <pre><code class="language-${lang || ''}">${escapeHtml(code.trim())}</code>
        <button class="copy-code-btn" data-code="${escapeHtml(code.trim())}" aria-label="Copy code">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy</span>
        </button>
        </pre>
      `)
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Bold
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      // Line breaks
      .replace(/\n/g, '<br>');
  }

  function copyCode(btn) {
    const code = btn.dataset.code;
    navigator.clipboard.writeText(code).then(() => {
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Copied!</span>
      `;
      btn.style.background = 'var(--success)';
      btn.style.borderColor = 'var(--success)';
      setTimeout(() => {
        btn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy</span>
        `;
        btn.style.background = '';
        btn.style.borderColor = '';
      }, 2000);
    });
  }

  function showTypingIndicator() {
    els.typingIndicator?.classList.remove('hidden');
    scrollToBottom();
  }

  function hideTypingIndicator() {
    els.typingIndicator?.classList.add('hidden');
  }

  function scrollToBottom() {
    const container = document.querySelector('.messages-container');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  // ============================================================
  // Input Area
  // ============================================================
  function autoResizeTextarea() {
    const ta = els.messageInput;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }

  function updateCharCount() {
    const ta = els.messageInput;
    if (!ta || !els.charCount) return;
    const len = ta.value.length;
    els.charCount.textContent = `${len}/4000`;
    els.charCount.style.color = len > 3800 ? 'var(--warning)' : len > 4000 ? 'var(--error)' : 'var(--text-muted)';
  }

  function updateSendButton() {
    const ta = els.messageInput;
    const btn = els.sendBtn;
    if (!ta || !btn) return;
    const hasText = ta.value.trim().length > 0;
    const hasFiles = state.attachedFiles.length > 0;
    btn.disabled = !(hasText || hasFiles);
  }

  function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const ta = els.messageInput;
    if (!ta) return;

    const text = ta.value.trim();
    const hasFiles = state.attachedFiles.length > 0;

    if (!text && !hasFiles) return;

    // Add user message
    appendMessage('user', text || '📎 Attachment(s)');

    // Clear input
    ta.value = '';
    ta.style.height = 'auto';
    updateCharCount();
    updateSendButton();
    removeAttachment();

    // Show typing indicator (simulated)
    showTypingIndicator();

    // Simulate AI response after delay (placeholder for Part 2)
    setTimeout(() => {
      hideTypingIndicator();
      appendMessage('assistant', 'This is a simulated response. API integration coming in Part 2! 🚀');
    }, 1500);
  }

  // ============================================================
  // File Attachment
  // ============================================================
  function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // For UI demo, just take first file
    const file = files[0];
    state.attachedFiles = [file];

    showAttachmentPreview(file);
    updateSendButton();
    els.fileInput.value = ''; // Reset for re-selection
  }

  function showAttachmentPreview(file) {
    const isImage = file.type.startsWith('image/');
    const size = formatFileSize(file.size);

    els.previewName.textContent = file.name;
    els.previewSize.textContent = size;

    if (isImage) {
      const url = URL.createObjectURL(file);
      els.previewThumb.style.backgroundImage = `url(${url})`;
      els.previewThumb.innerHTML = '';
    } else {
      els.previewThumb.style.backgroundImage = '';
      els.previewThumb.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      `;
    }

    els.attachmentPreview?.classList.remove('hidden');
  }

  function removeAttachment() {
    state.attachedFiles = [];
    els.attachmentPreview?.classList.add('hidden');
    els.previewThumb.style.backgroundImage = '';
    els.previewThumb.innerHTML = '';
    updateSendButton();
  }

  // ============================================================
  // Welcome Suggestions
  // ============================================================
  function renderWelcomeSuggestions() {
    if (!els.welcomeSuggestions) return;

    const suggestions = [
      { prompt: 'Explain quantum computing in simple terms', icon: '🔬' },
      { prompt: 'Write a Python function for binary search', icon: '🐍' },
      { prompt: 'Help me plan a 3-day trip to Tokyo', icon: '✈️' },
      { prompt: 'Summarize the key points of Atomic Habits', icon: '📚' },
      { prompt: 'Debug this JavaScript code: [paste code]', icon: '🐛' },
      { prompt: 'Create a workout plan for beginners', icon: '💪' },
    ];

    els.welcomeSuggestions.innerHTML = suggestions.map(s => `
      <button class="suggestion-chip" data-prompt="${escapeHtml(s.prompt)}" type="button">
        ${s.icon} ${escapeHtml(s.prompt)}
      </button>
    `).join('');
  }

  // ============================================================
  // Toast Notifications
  // ============================================================
  function showToast(message, type = 'info', duration = 4000) {
    if (!els.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon">
        ${getToastIcon(type)}
      </div>
      <span>${escapeHtml(message)}</span>
    `;

    els.toastContainer.appendChild(toast);

    // Auto remove
    setTimeout(() => {
      toast.classList.add('removing');
      toast.addEventListener('animationend', () => toast.remove());
    }, duration);
  }

  function getToastIcon(type) {
    switch (type) {
      case 'success':
        return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
      case 'error':
        return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
      case 'warning':
        return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
      default:
        return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }
  }

  // ============================================================
  // Keyboard Shortcuts
  // ============================================================
  function handleGlobalKeydown(e) {
    // Cmd/Ctrl + K: Focus input
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      els.messageInput?.focus();
    }

    // Cmd/Ctrl + N: New chat
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      newChat();
    }

    // Cmd/Ctrl + ,: Open settings
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      openModal();
    }

    // Slash command (when input not focused)
    if (e.key === '/' && document.activeElement !== els.messageInput) {
      e.preventDefault();
      els.messageInput?.focus();
      els.messageInput.value = '/';
      updateCharCount();
      updateSendButton();
    }
  }

  // ============================================================
  // Utility Functions
  // ============================================================
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  // ============================================================
  // Start App
  // ============================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for debugging
  window.FJAI = {
    state,
    els,
    showToast,
    appendMessage,
    newChat,
    openModal,
    closeModal,
  };
})();
