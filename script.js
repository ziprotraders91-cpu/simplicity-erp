/**
 * Farhan Jawed - AI Agent | Part 2: Full AI Integration
 * Features: Multi-key fallback, Markdown rendering, File/Image upload, Chat persistence, PWA
 */

(() => {
  'use strict';

  // ============================================================
  // Configuration - API Providers
  // ============================================================
  const PROVIDERS = [
    {
      id: 'google',
      name: 'Google Gemini',
      model: 'gemini-2.5-flash',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      keyStorage: 'fjai_key_google',
      supportsVision: true,
      formatRequest: (messages, model) => ({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 8192,
      }),
      extractContent: (data) => data.choices?.[0]?.message?.content,
      isError: (response) => response.status === 429 || response.status >= 400,
    },
    {
      id: 'groq',
      name: 'Groq',
      model: 'llama-3.3-70b-versatile',
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      keyStorage: 'fjai_key_groq',
      supportsVision: false,
      formatRequest: (messages, model) => ({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 8192,
      }),
      extractContent: (data) => data.choices?.[0]?.message?.content,
      isError: (response) => response.status === 429 || response.status >= 400,
    },
    {
      id: 'openrouter',
      name: 'OpenRouter',
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      endpoint: 'https://openrouter.ai/api/v1/chat/completions',
      keyStorage: 'fjai_key_openrouter',
      supportsVision: true,
      formatRequest: (messages, model) => ({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 8192,
      }),
      extractContent: (data) => data.choices?.[0]?.message?.content,
      isError: (response) => response.status === 429 || response.status >= 400,
    },
  ];

  // ============================================================
  // DOM Element References
  // ============================================================
  const els = {
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    menuToggle: document.getElementById('menuToggle'),
    sidebarClose: document.getElementById('sidebarClose'),
    newChatBtn: document.getElementById('newChatBtn'),
    chatHistory: document.getElementById('chatHistory'),
    historyEmpty: document.getElementById('historyEmpty'),

    settingsTrigger: document.getElementById('settingsTrigger'),
    themeToggle: document.getElementById('themeToggle'),
    modelIndicator: document.getElementById('modelIndicator'),

    welcomeState: document.getElementById('welcomeState'),
    welcomeSuggestions: document.getElementById('welcomeSuggestions'),
    messagesList: document.getElementById('messagesList'),
    typingIndicator: document.getElementById('typingIndicator'),

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

    settingsModal: document.getElementById('settingsModal'),
    modalBackdrop: document.getElementById('modalBackdrop'),
    modalClose: document.getElementById('modalClose'),
    modalCancel: document.getElementById('modalCancel'),
    saveKeysBtn: document.getElementById('saveKeysBtn'),
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabPanels: document.querySelectorAll('.tab-panel'),

    googleKey: document.getElementById('googleKey'),
    groqKey: document.getElementById('groqKey'),
    openrouterKey: document.getElementById('openrouterKey'),
    toggleGoogleKey: document.getElementById('toggleGoogleKey'),
    toggleGroqKey: document.getElementById('toggleGroqKey'),
    toggleOpenRouterKey: document.getElementById('toggleOpenRouterKey'),

    keyStatus: document.getElementById('keyStatus'),

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
    isStreaming: false,
    abortController: null,
    chats: JSON.parse(localStorage.getItem('fjai_chats') || '[]'),
    theme: localStorage.getItem('fjai_theme') || 'dark',
    currentProvider: null,
  };

  // ============================================================
  // Initialization
  // ============================================================
  function init() {
    loadTheme();
    loadKeys();
    configureMarked();
    renderChatHistory();
    renderWelcomeSuggestions();
    updateKeyStatus();
    updateModelIndicator();
    bindEvents();
    autoResizeTextarea();
    updateCharCount();

    // Restore last chat or show welcome
    if (state.chats.length > 0 && !state.currentChatId) {
      const lastChat = state.chats[0];
      loadChat(lastChat.id);
    }
  }

  // ============================================================
  // Configure Marked.js
  // ============================================================
  function configureMarked() {
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: false,
        mangle: false,
      });
    }
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

    // Close modal/sidebar on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.modalOpen) closeModal();
      if (e.key === 'Escape' && state.sidebarOpen) closeSidebar();
    });

    // Copy code buttons (delegated)
    els.messagesList?.addEventListener('click', (e) => {
      const btn = e.target.closest('.copy-code-btn');
      if (btn) copyCode(btn);
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
  // API Key Management
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
    updateModelIndicator();
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
  // Model Indicator
  // ============================================================
  function updateModelIndicator() {
    if (!els.modelIndicator) return;

    const availableProviders = PROVIDERS.filter(p => localStorage.getItem(p.keyStorage));

    if (availableProviders.length === 0) {
      els.modelIndicator.innerHTML = `
        <span class="model-dot" style="background: var(--error);"></span>
        <span class="model-name">No API Keys</span>
      `;
      return;
    }

    const currentProvider = state.currentProvider || availableProviders[0];
    els.modelIndicator.innerHTML = `
      <span class="model-dot"></span>
      <span class="model-name">${currentProvider.name}</span>
      <svg class="model-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `;
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
  // Chat History Persistence
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
      appendMessage(msg.role, msg.content, false, msg.attachments);
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

  function saveChat() {
    if (!state.currentChatId) return;

    const chat = state.chats.find(c => c.id === state.currentChatId);
    if (!chat) return;

    chat.messages = getCurrentMessages();
    chat.updatedAt = Date.now();
    localStorage.setItem('fjai_chats', JSON.stringify(state.chats));
    renderChatHistory();
  }

  function getCurrentMessages() {
    const messages = [];
    const messageElements = els.messagesList?.querySelectorAll('.message');
    messageElements?.forEach(el => {
      const role = el.classList.contains('user') ? 'user' : 'assistant';
      const bubble = el.querySelector('.message-bubble');
      const content = bubble?.textContent || bubble?.innerText || '';
      if (content.trim()) {
        messages.push({ role, content });
      }
    });
    return messages;
  }

  function createNewChat(title = 'New Chat') {
    const chat = {
      id: generateId(),
      title,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    state.chats.unshift(chat);
    localStorage.setItem('fjai_chats', JSON.stringify(state.chats));
    return chat;
  }

  // ============================================================
  // Message Handling
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

  function appendMessage(role, content, animate = true, attachments = null) {
    if (!els.messagesList) return;

    hideWelcomeState();

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role === 'user' ? 'user' : 'assistant'}`;
    if (animate) messageDiv.style.animation = 'messageIn 0.3s var(--transition-bounce)';

    const avatarIcon = role === 'user'
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M12 14v8M4 21c0-3.5 2.5-6.5 8-6.5s8 3 8 6.5"></path></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>';

    let attachmentsHtml = '';
    if (attachments && attachments.length > 0) {
      attachmentsHtml = '<div class="message-attachments">' + attachments.map(att => {
        if (att.type.startsWith('image/')) {
          return `<img src="${att.data}" alt="${escapeHtml(att.name)}" style="max-width:200px;border-radius:8px;margin-top:8px;">`;
        } else {
          return `<div class="file-attachment"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg> ${escapeHtml(att.name)}</div>`;
        }
      }).join('') + '</div>';
    }

    const renderedContent = role === 'assistant' ? renderMarkdown(content) : escapeHtml(content);

    messageDiv.innerHTML = `
      <div class="message-avatar">${avatarIcon}</div>
      <div class="message-content">
        <div class="message-bubble">${renderedContent}${attachmentsHtml}</div>
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
    if (!text || typeof marked === 'undefined') return escapeHtml(text);

    try {
      let html = marked.parse(text);

      // Add copy buttons to code blocks
      html = html.replace(/<pre><code class="language-(\w*)">([\s\S]*?)<\/code><\/pre>/g, (match, lang, code) => {
        const escapedCode = escapeHtml(code.trim());
        return `
          <pre><code class="language-${lang}">${escapedCode}</code>
          <button class="copy-code-btn" data-code="${escapedCode}" aria-label="Copy code">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy</span>
          </button>
          </pre>
        `;
      });

      return html;
    } catch (e) {
      console.error('Markdown parse error:', e);
      return escapeHtml(text);
    }
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
    btn.disabled = !(hasText || hasFiles) || state.isStreaming;
  }

  function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ta = els.messageInput;
    if (!ta || state.isStreaming) return;

    const text = ta.value.trim();
    const hasFiles = state.attachedFiles.length > 0;

    if (!text && !hasFiles) return;

    // Check if any API key is configured
    const hasAnyKey = PROVIDERS.some(p => localStorage.getItem(p.keyStorage));
    if (!hasAnyKey) {
      showToast('Please configure at least one API key in Settings', 'error');
      openModal();
      return;
    }

    // Prepare attachments for display
    const attachmentsForDisplay = state.attachedFiles.map(f => ({
      name: f.name,
      type: f.type,
      data: f.dataUrl || (f.type.startsWith('image/') ? URL.createObjectURL(f) : null),
    }));

    // Add user message
    appendMessage('user', text || '📎 Attachment(s)', true, attachmentsForDisplay);

    // Create new chat if needed
    if (!state.currentChatId) {
      const firstWords = text.slice(0, 50) || 'Attachment chat';
      const chat = createNewChat(firstWords + (firstWords.length > 50 ? '...' : ''));
      state.currentChatId = chat.id;
    }

    // Clear input
    ta.value = '';
    ta.style.height = 'auto';
    updateCharCount();
    const filesToSend = [...state.attachedFiles];
    removeAttachment();
    updateSendButton();

    // Show typing indicator
    showTypingIndicator();
    setStreamingState(true);

    try {
      const response = await callAPIWithFallback(text, filesToSend);
      hideTypingIndicator();
      appendMessage('assistant', response.content);
      saveChat();
    } catch (error) {
      hideTypingIndicator();
      const errorMsg = error.message || 'Unknown error occurred';
      appendMessage('assistant', `❌ **Error:** ${errorMsg}`);
      showToast(errorMsg, 'error');
    } finally {
      setStreamingState(false);
    }
  }

  function setStreamingState(streaming) {
    state.isStreaming = streaming;
    els.sendBtn?.classList.toggle('loading', streaming);
    updateSendButton();
  }

  // ============================================================
  // File Attachment Handling
  // ============================================================
  function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Process first file (can extend for multiple)
    const file = files[0];
    processFile(file).then(processedFile => {
      state.attachedFiles = [processedFile];
      showAttachmentPreview(processedFile);
      updateSendButton();
    }).catch(err => {
      showToast('Failed to process file: ' + err.message, 'error');
    });

    els.fileInput.value = '';
  }

  function processFile(file) {
    return new Promise((resolve, reject) => {
      const isImage = file.type.startsWith('image/');
      const isText = file.type.startsWith('text/') || ['.txt', '.js', '.ts', '.json', '.md', '.csv', '.py', '.html', '.css'].some(ext => file.name.endsWith(ext));

      if (!isImage && !isText) {
        reject(new Error('Unsupported file type. Only images and text files allowed.'));
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        reject(new Error('File too large. Max size is 10MB.'));
        return;
      }

      const reader = new FileReader();

      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const textContent = isText ? new TextDecoder('utf-8').decode(reader.result) : null;

        resolve({
          file,
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl,
          isImage,
          isText,
          textContent,
        });
      };

      reader.onerror = () => reject(new Error('Failed to read file'));

      if (isImage) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  }

  function showAttachmentPreview(file) {
    const size = formatFileSize(file.size);

    els.previewName.textContent = file.name;
    els.previewSize.textContent = size;

    if (file.isImage) {
      els.previewThumb.style.backgroundImage = `url(${file.dataUrl})`;
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
  // Multi-Key Fallback API Call
  // ============================================================
  async function callAPIWithFallback(userText, attachedFiles) {
    // Build messages array
    const messages = buildMessages(userText, attachedFiles);

    // Get available providers with keys
    const availableProviders = PROVIDERS.filter(p => localStorage.getItem(p.keyStorage));

    if (availableProviders.length === 0) {
      throw new Error('No API keys configured. Please add keys in Settings.');
    }

    let lastError = null;

    // Try each provider in order
    for (const provider of availableProviders) {
      try {
        console.log(`[API] Trying ${provider.name}...`);
        state.currentProvider = provider;
        updateModelIndicator();

        const content = await callProvider(provider, messages);
        console.log(`[API] Success with ${provider.name}`);

        return { content, provider: provider.name };
      } catch (error) {
        lastError = error;
        console.warn(`[API] ${provider.name} failed:`, error.message);

        // If it's a rate limit (429) or network error, try next provider
        if (isRetryableError(error)) {
          showToast(`${provider.name} unavailable, trying next...`, 'warning');
          continue;
        }

        // For other errors (invalid key, etc.), throw immediately
        throw error;
      }
    }

    // All providers failed
    throw new Error(lastError?.message || 'All API providers failed. Check your keys and limits.');
  }

  function buildMessages(userText, attachedFiles) {
    // Get conversation history (last 20 messages for context)
    const historyMessages = [];
    const messageElements = els.messagesList?.querySelectorAll('.message');
    messageElements?.forEach(el => {
      const role = el.classList.contains('user') ? 'user' : 'assistant';
      const bubble = el.querySelector('.message-bubble');
      const content = bubble?.textContent || bubble?.innerText || '';
      if (content.trim()) {
        historyMessages.push({ role, content });
      }
    });

    // Take last 20 messages for context
    const contextMessages = historyMessages.slice(-20);

    // Build user message with attachments
    let userContent = userText;

    if (attachedFiles.length > 0) {
      const file = attachedFiles[0]; // Handle first file for now

      if (file.isImage) {
        // Vision format for image
        userContent = [
          { type: 'text', text: userText || 'Analyze this image' },
          { type: 'image_url', image_url: { url: file.dataUrl } },
        ];
      } else if (file.isText && file.textContent) {
        // Text file - prepend content
        userContent = `${userText || 'Analyze this file'}\n\n--- File: ${file.name} ---\n${file.textContent.slice(0, 50000)}`;
      }
    }

    const messages = [
      { role: 'system', content: 'You are Farhan Jawed AI, a helpful assistant.' },
      ...contextMessages,
      { role: 'user', content: userContent },
    ];

    return messages;
  }

  async function callProvider(provider, messages) {
    const apiKey = localStorage.getItem(provider.keyStorage);
    if (!apiKey) throw new Error(`${provider.name} API key not configured`);

    const requestBody = provider.formatRequest(messages, provider.model);

    const headers = {
      'Content-Type': 'application/json',
    };

    // Add authorization header for Groq and OpenRouter
    if (provider.id === 'groq' || provider.id === 'openrouter') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // For Google, add key as query parameter
    let url = provider.endpoint;
    if (provider.id === 'google') {
      url += `?key=${apiKey}`;
    }

    const controller = new AbortController();
    state.abortController = controller;

    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error?.message || `HTTP ${response.status}`;
        const error = new Error(errorMsg);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      const content = provider.extractContent(data);
      if (!content) throw new Error('Empty response from API');

      return content;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  function isRetryableError(error) {
    // Retry on: 429 (rate limit), 5xx (server errors), network errors, timeout
    if (error.status === 429) return true;
    if (error.status >= 500) return true;
    if (error.name === 'TypeError' && error.message.includes('fetch')) return true;
    if (error.message === 'Request timeout') return true;
    return false;
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
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      els.messageInput?.focus();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      newChat();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === ',') {
      e.preventDefault();
      openModal();
    }
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

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
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
    callAPIWithFallback,
  };
})();
