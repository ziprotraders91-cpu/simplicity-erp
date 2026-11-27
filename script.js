/**
 * Farhan Jawed - AI Agent | script.js
 * Smart Task-Based Auto-Router (auto:smart for Coding / auto:fast for Chat)
 * Live SSE Streaming + Cloudflare Proxy + Vision/File Upload + Markdown
 */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEYS = {
    UNIFIED_KEY: 'fj_ai_unified_api_key',
    LEGACY_API_KEYS: 'fj_ai_api_keys',
    CHATS: 'fj_ai_chats',
    ACTIVE_CHAT_ID: 'fj_ai_active_chat_id',
    THEME: 'fj_ai_theme'
  };

  const MAX_CHAR_LIMIT = 4000;
  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
  const UNIFIED_API_URL = 'https://freellmapi-proxy.ziprotraders91.workers.dev/v1/chat/completions';

  const SYSTEM_PROMPT =
    'You are Farhan Jawed - AI Agent, created by Farhan Jawed. You are a highly intelligent, helpful, and professional AI assistant. Always answer accurately and in the same language the user speaks. Do not roleplay or act like any other AI.';

  const CONNECTION_ERROR_MESSAGE =
    'Error: Server se connect nahi ho paya. Kripya check karein ki FreeLLMAPI server ON hai.';

  const CODING_OR_COMPLEX_REGEX =
    /\b(code|coding|program|programming|script|html|css|js|javascript|typescript|ts|python|py|react|next|node|express|api|json|sql|database|db|bug|error|fix|debug|function|class|loop|array|object|async|await|fetch|cors|regex|git|github|deploy|host|worker|manifest|sw\.js|php|java|cpp|c\+\+|flutter|android|component|website|webpage|backend|frontend|server|algorithm|build|create app|bana|banado|likho)\b|```|<\/?[a-z]+[^>]*>|[{};=>]/i;

  const DEFAULT_SUGGESTIONS = [
    { title: 'Build a component', prompt: 'Create a responsive HTML, CSS & JS login form with validation.' },
    { title: 'Debug & fix code', prompt: 'What are the most common JavaScript async/await mistakes and how to fix them?' },
    { title: 'Explain a concept', prompt: 'Explain how REST APIs and JSON work with a simple JavaScript example.' },
    { title: 'Python automation', prompt: 'Write a clean Python script to rename multiple files in a folder.' }
  ];

  const els = {
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    sidebarClose: document.getElementById('sidebarClose'),
    menuToggle: document.getElementById('menuToggle'),
    newChatBtn: document.getElementById('newChatBtn'),
    chatHistory: document.getElementById('chatHistory'),
    historyEmpty: document.getElementById('historyEmpty'),
    modelIndicator: document.getElementById('modelIndicator'),
    themeToggle: document.getElementById('themeToggle'),
    settingsTrigger: document.getElementById('settingsTrigger'),
    chatWindow: document.getElementById('chatWindow'),
    messagesContainer: document.getElementById('messagesContainer'),
    welcomeState: document.getElementById('welcomeState'),
    welcomeSuggestions: document.getElementById('welcomeSuggestions'),
    messagesList: document.getElementById('messagesList'),
    typingIndicator: document.getElementById('typingIndicator'),
    inputForm: document.getElementById('inputForm'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    charCount: document.getElementById('charCount'),
    attachBtn: document.getElementById('attachBtn'),
    fileInput: document.getElementById('fileInput'),
    attachmentPreview: document.getElementById('attachmentPreview'),
    previewThumb: document.getElementById('previewThumb'),
    previewName: document.getElementById('previewName'),
    previewSize: document.getElementById('previewSize'),
    previewRemove: document.getElementById('previewRemove'),
    settingsModal: document.getElementById('settingsModal'),
    modalBackdrop: document.getElementById('modalBackdrop'),
    modalClose: document.getElementById('modalClose'),
    modalCancel: document.getElementById('modalCancel'),
    saveKeysBtn: document.getElementById('saveKeysBtn'),
    keyStatus: document.getElementById('keyStatus'),
    googleKey: document.getElementById('googleKey'),
    groqKey: document.getElementById('groqKey'),
    openrouterKey: document.getElementById('openrouterKey'),
    toggleGoogleKey: document.getElementById('toggleGoogleKey'),
    toggleGroqKey: document.getElementById('toggleGroqKey'),
    toggleOpenRouterKey: document.getElementById('toggleOpenRouterKey'),
    settingsTabs: document.querySelector('.settings-tabs'),
    panelGoogle: document.getElementById('panel-google'),
    panelGroq: document.getElementById('panel-groq'),
    panelOpenRouter: document.getElementById('panel-openrouter'),
    toastContainer: document.getElementById('toastContainer')
  };

  const state = {
    apiKey: '',
    chats: [],
    activeChatId: null,
    pendingAttachments: [],
    isGenerating: false,
    theme: 'dark'
  };

  function init() {
    if (typeof window.marked !== 'undefined' && typeof window.marked.setOptions === 'function') {
      window.marked.setOptions({ breaks: true, gfm: true });
    }
    setupUnifiedSettingsUI();
    loadTheme();
    loadApiKey();
    loadChats();
    renderSuggestions();
    updateModelIndicator();
    updateKeyStatusUI();
    bindEvents();
    updateInputUIState();
  }

  function setupUnifiedSettingsUI() {
    if (els.settingsTabs) els.settingsTabs.style.display = 'none';
    if (els.panelGroq) {
      els.panelGroq.setAttribute('hidden', '');
      els.panelGroq.classList.remove('active');
    }
    if (els.panelOpenRouter) {
      els.panelOpenRouter.setAttribute('hidden', '');
      els.panelOpenRouter.classList.remove('active');
    }
    if (els.panelGoogle) {
      els.panelGoogle.removeAttribute('hidden');
      els.panelGoogle.classList.add('active');
      const label = els.panelGoogle.querySelector('label[for="googleKey"]');
      if (label) label.textContent = 'FreeLLMAPI Unified API Key';
      const help = document.getElementById('googleKeyHelp');
      if (help) {
        help.textContent =
          'Apni FreeLLMAPI Unified Key daalein. Coding/files ke liye app khud auto:smart aur normal chat ke liye auto:fast chunti hai.';
      }
    }
    if (els.googleKey) els.googleKey.placeholder = 'freellmapi-...';
  }

  function bindEvents() {
    if (els.menuToggle) els.menuToggle.addEventListener('click', openSidebar);
    if (els.sidebarClose) els.sidebarClose.addEventListener('click', closeSidebar);
    if (els.sidebarOverlay) els.sidebarOverlay.addEventListener('click', closeSidebar);
    if (els.newChatBtn) {
      els.newChatBtn.addEventListener('click', () => {
        startNewChat();
        closeSidebar();
      });
    }
    if (els.themeToggle) els.themeToggle.addEventListener('click', toggleTheme);
    if (els.modelIndicator) {
      els.modelIndicator.addEventListener('click', openSettingsModal);
      els.modelIndicator.style.cursor = 'pointer';
    }
    if (els.settingsTrigger) els.settingsTrigger.addEventListener('click', openSettingsModal);
    if (els.modalClose) els.modalClose.addEventListener('click', closeSettingsModal);
    if (els.modalCancel) els.modalCancel.addEventListener('click', closeSettingsModal);
    if (els.modalBackdrop) els.modalBackdrop.addEventListener('click', closeSettingsModal);
    if (els.saveKeysBtn) els.saveKeysBtn.addEventListener('click', handleSaveKey);

    bindVisibilityToggle(els.toggleGoogleKey, els.googleKey);
    bindVisibilityToggle(els.toggleGroqKey, els.groqKey);
    bindVisibilityToggle(els.toggleOpenRouterKey, els.openrouterKey);

    if (els.inputForm) {
      els.inputForm.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSendMessage();
      });
    }

    if (els.messageInput) {
      els.messageInput.addEventListener('input', () => {
        if (els.messageInput.value.length > MAX_CHAR_LIMIT) {
          els.messageInput.value = els.messageInput.value.slice(0, MAX_CHAR_LIMIT);
        }
        autoResizeTextarea();
        updateInputUIState();
      });
      els.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
          e.preventDefault();
          if (!state.isGenerating && els.sendBtn && !els.sendBtn.disabled) {
            handleSendMessage();
          }
        }
      });
    }

    if (els.attachBtn && els.fileInput) {
      els.attachBtn.addEventListener('click', () => els.fileInput.click());
      els.fileInput.addEventListener('change', handleFileSelection);
    }
    if (els.previewRemove) els.previewRemove.addEventListener('click', clearAttachments);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (isModalOpen()) closeSettingsModal();
        else if (els.sidebar && els.sidebar.classList.contains('open')) closeSidebar();
      }
    });
  }

  /* ---- Theme ---- */
  function loadTheme() {
    const saved = safeLocalStorageGet(STORAGE_KEYS.THEME);
    state.theme = saved === 'light' ? 'light' : 'dark';
    applyTheme(state.theme);
  }
  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(state.theme);
    safeLocalStorageSet(STORAGE_KEYS.THEME, state.theme);
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.classList.toggle('light-theme', theme === 'light');
    document.body.classList.toggle('dark-theme', theme === 'dark');
    if (els.themeToggle) els.themeToggle.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
  }

  /* ---- Sidebar & History ---- */
  function openSidebar() {
    if (els.sidebar) els.sidebar.classList.add('open');
    if (els.sidebarOverlay) {
      els.sidebarOverlay.classList.add('visible', 'active', 'open');
      els.sidebarOverlay.setAttribute('aria-hidden', 'false');
    }
    if (els.menuToggle) els.menuToggle.setAttribute('aria-expanded', 'true');
    if (els.sidebarClose) els.sidebarClose.setAttribute('aria-expanded', 'true');
  }
  function closeSidebar() {
    if (els.sidebar) els.sidebar.classList.remove('open');
    if (els.sidebarOverlay) {
      els.sidebarOverlay.classList.remove('visible', 'active', 'open');
      els.sidebarOverlay.setAttribute('aria-hidden', 'true');
    }
    if (els.menuToggle) els.menuToggle.setAttribute('aria-expanded', 'false');
    if (els.sidebarClose) els.sidebarClose.setAttribute('aria-expanded', 'false');
  }

  function loadChats() {
    const raw = safeLocalStorageGet(STORAGE_KEYS.CHATS);
    try {
      state.chats = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(state.chats)) state.chats = [];
    } catch {
      state.chats = [];
    }
    const savedActiveId = safeLocalStorageGet(STORAGE_KEYS.ACTIVE_CHAT_ID);
    const foundActive = state.chats.find((c) => c.id === savedActiveId);
    if (foundActive) {
      state.activeChatId = foundActive.id;
      renderActiveChat();
    } else {
      state.activeChatId = null;
      showWelcomeState();
    }
    renderChatHistorySidebar();
  }

  function saveChats() {
    safeLocalStorageSet(STORAGE_KEYS.CHATS, JSON.stringify(state.chats));
    if (state.activeChatId) safeLocalStorageSet(STORAGE_KEYS.ACTIVE_CHAT_ID, state.activeChatId);
    else {
      try { localStorage.removeItem(STORAGE_KEYS.ACTIVE_CHAT_ID); } catch {}
    }
  }

  function getActiveChat() {
    return state.chats.find((c) => c.id === state.activeChatId) || null;
  }

  function createChatSession(firstMessageText) {
    const cleanTitle = (firstMessageText || 'New Conversation').replace(/\s+/g, ' ').trim().slice(0, 38);
    const newChat = {
      id: 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      title: cleanTitle || 'New Conversation',
      updatedAt: Date.now(),
      messages: []
    };
    state.chats.unshift(newChat);
    state.activeChatId = newChat.id;
    saveChats();
    renderChatHistorySidebar();
    return newChat;
  }

  function startNewChat() {
    if (state.isGenerating) return;
    state.activeChatId = null;
    saveChats();
    clearMessagesUI();
    showWelcomeState();
    renderChatHistorySidebar();
    clearAttachments();
    if (els.messageInput) els.messageInput.focus();
  }

  function selectChat(chatId) {
    if (state.isGenerating) return;
    const chat = state.chats.find((c) => c.id === chatId);
    if (!chat) return;
    state.activeChatId = chat.id;
    saveChats();
    renderActiveChat();
    renderChatHistorySidebar();
    closeSidebar();
  }

  function deleteChat(chatId) {
    state.chats = state.chats.filter((c) => c.id !== chatId);
    if (state.activeChatId === chatId) {
      state.activeChatId = null;
      clearMessagesUI();
      showWelcomeState();
    }
    saveChats();
    renderChatHistorySidebar();
    showToast('Conversation deleted', 'info');
  }

  function renderChatHistorySidebar() {
    if (!els.chatHistory) return;
    els.chatHistory.querySelectorAll('.history-item').forEach((n) => n.remove());
    if (state.chats.length === 0) {
      if (els.historyEmpty) {
        els.historyEmpty.classList.remove('hidden');
        els.historyEmpty.style.display = '';
      }
      return;
    }
    if (els.historyEmpty) {
      els.historyEmpty.classList.add('hidden');
      els.historyEmpty.style.display = 'none';
    }

    const sortedChats = [...state.chats].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    sortedChats.forEach((chat) => {
      const item = document.createElement('div');
      item.className = 'history-item' + (chat.id === state.activeChatId ? ' active' : '');
      item.setAttribute('role', 'listitem');
      item.setAttribute('tabindex', '0');

      const titleBtn = document.createElement('button');
      titleBtn.type = 'button';
      titleBtn.className = 'history-item-btn';
      titleBtn.style.cssText =
        'display:flex;align-items:center;gap:8px;flex:1;min-width:0;background:transparent;border:none;color:inherit;text-align:left;cursor:pointer;padding:8px 10px;font:inherit;';
      const titleSpan = document.createElement('span');
      titleSpan.className = 'history-item-title';
      titleSpan.textContent = chat.title || 'New Conversation';
      titleSpan.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      titleBtn.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;opacity:0.75;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
      titleBtn.appendChild(titleSpan);
      titleBtn.addEventListener('click', () => selectChat(chat.id));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'history-delete-btn';
      deleteBtn.setAttribute('aria-label', 'Delete conversation');
      deleteBtn.style.cssText =
        'background:transparent;border:none;color:inherit;opacity:0.6;cursor:pointer;padding:6px 8px;display:flex;align-items:center;justify-content:center;border-radius:6px;';
      deleteBtn.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6M14 11v6"></path></svg>';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteChat(chat.id);
      });

      item.style.cssText = 'display:flex;align-items:center;justify-content:space-between;border-radius:10px;margin-bottom:4px;';
      item.appendChild(titleBtn);
      item.appendChild(deleteBtn);
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectChat(chat.id);
        }
      });
      els.chatHistory.appendChild(item);
    });
  }

  function renderActiveChat() {
    clearMessagesUI();
    const chat = getActiveChat();
    if (!chat || !chat.messages || chat.messages.length === 0) {
      showWelcomeState();
      return;
    }
    hideWelcomeState();
    chat.messages.forEach((msg) => appendMessageToDOM(msg));
    scrollToBottom();
  }

  /* ---- Settings & Keys ---- */
  function loadApiKey() {
    const unified = safeLocalStorageGet(STORAGE_KEYS.UNIFIED_KEY);
    if (unified && unified.trim()) {
      state.apiKey = unified.trim();
    } else {
      const legacyRaw = safeLocalStorageGet(STORAGE_KEYS.LEGACY_API_KEYS);
      try {
        const parsed = legacyRaw ? JSON.parse(legacyRaw) : {};
        state.apiKey = String(parsed.google || parsed.groq || parsed.openrouter || '').trim();
      } catch {
        state.apiKey = '';
      }
    }
    if (els.googleKey) els.googleKey.value = state.apiKey || '';
  }

  function isModalOpen() {
    return els.settingsModal && (els.settingsModal.hasAttribute('open') || els.settingsModal.classList.contains('open'));
  }

  function openSettingsModal() {
    if (els.googleKey) els.googleKey.value = state.apiKey || '';
    updateKeyStatusUI();
    if (!els.settingsModal) return;
    if (typeof els.settingsModal.showModal === 'function') {
      if (!els.settingsModal.open) {
        try { els.settingsModal.showModal(); } catch { els.settingsModal.setAttribute('open', ''); }
      }
    } else {
      els.settingsModal.setAttribute('open', '');
    }
    els.settingsModal.classList.add('open', 'active');
    if (els.settingsTrigger) els.settingsTrigger.setAttribute('aria-expanded', 'true');
  }

  function closeSettingsModal() {
    if (!els.settingsModal) return;
    if (typeof els.settingsModal.close === 'function' && els.settingsModal.open) {
      try { els.settingsModal.close(); } catch { els.settingsModal.removeAttribute('open'); }
    } else {
      els.settingsModal.removeAttribute('open');
    }
    els.settingsModal.classList.remove('open', 'active');
    if (els.settingsTrigger) els.settingsTrigger.setAttribute('aria-expanded', 'false');
  }

  function bindVisibilityToggle(buttonEl, inputEl) {
    if (!buttonEl || !inputEl) return;
    buttonEl.addEventListener('click', () => {
      const isPassword = inputEl.type === 'password';
      inputEl.type = isPassword ? 'text' : 'password';
      buttonEl.setAttribute('aria-pressed', isPassword ? 'true' : 'false');
      buttonEl.classList.toggle('active', isPassword);
    });
  }

  function handleSaveKey() {
    const enteredKey =
      (els.googleKey && els.googleKey.value.trim()) ||
      (els.groqKey && els.groqKey.value.trim()) ||
      (els.openrouterKey && els.openrouterKey.value.trim()) ||
      '';
    state.apiKey = enteredKey;
    safeLocalStorageSet(STORAGE_KEYS.UNIFIED_KEY, state.apiKey);
    updateKeyStatusUI();
    updateModelIndicator();
    closeSettingsModal();
    showToast('FreeLLMAPI key saved successfully!', 'success');
  }

  function updateKeyStatusUI() {
    if (!els.keyStatus) return;
    const hasKey = Boolean(state.apiKey);
    const dotColor = hasKey ? '#22c55e' : '#f59e0b';
    const statusText = hasKey ? 'Configured (Smart Auto Router)' : 'Not set';
    els.keyStatus.innerHTML =
      `<div class="key-status-item" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:8px;font-size:0.85rem;">` +
      `<span style="display:flex;align-items:center;gap:8px;"><span style="width:8px;height:8px;border-radius:50%;background:${dotColor};display:inline-block;"></span><span>FreeLLMAPI Server</span></span>` +
      `<span style="opacity:0.85;color:${dotColor};">${escapeHtml(statusText)}</span></div>`;
  }

  function updateModelIndicator(customLabel) {
    if (!els.modelIndicator) return;
    const nameEl = els.modelIndicator.querySelector('.model-name');
    const dotEl = els.modelIndicator.querySelector('.model-dot');
    if (!nameEl) return;
    if (customLabel) {
      nameEl.textContent = customLabel;
      if (dotEl) dotEl.style.backgroundColor = '#22c55e';
      return;
    }
    nameEl.textContent = state.apiKey ? 'Smart Auto (70+ Models)' : 'Add API Key';
    if (dotEl) dotEl.style.backgroundColor = state.apiKey ? '#22c55e' : '#f59e0b';
  }

  /* ---- Attachments ---- */
  async function handleFileSelection(e) {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        showToast(`"${file.name}" 5MB se badi hai.`, 'error');
        continue;
      }
      try {
        if (file.type.startsWith('image/')) {
          const base64 = await readFileAsDataURL(file);
          state.pendingAttachments.push({ name: file.name, size: file.size, isImage: true, base64, textContent: '' });
        } else {
          const textContent = await readFileAsText(file);
          state.pendingAttachments.push({ name: file.name, size: file.size, isImage: false, base64: '', textContent });
        }
      } catch {
        showToast(`File "${file.name}" read karne mein error aaya.`, 'error');
      }
    }
    if (els.fileInput) els.fileInput.value = '';
    renderAttachmentPreview();
    updateInputUIState();
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(new Error('Image read failed'));
      r.readAsDataURL(file);
    });
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(new Error('Text read failed'));
      r.readAsText(file);
    });
  }

  function renderAttachmentPreview() {
    if (!els.attachmentPreview) return;
    if (state.pendingAttachments.length === 0) {
      els.attachmentPreview.classList.add('hidden');
      els.attachmentPreview.setAttribute('aria-hidden', 'true');
      if (els.previewThumb) els.previewThumb.innerHTML = '';
      if (els.previewName) els.previewName.textContent = '';
      if (els.previewSize) els.previewSize.textContent = '';
      return;
    }
    const first = state.pendingAttachments[0];
    const totalSize = state.pendingAttachments.reduce((acc, f) => acc + f.size, 0);
    if (els.previewThumb) {
      els.previewThumb.innerHTML = first.isImage && first.base64
        ? `<img src="${first.base64}" alt="${escapeHtml(first.name)}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">`
        : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
    }
    if (els.previewName) {
      els.previewName.textContent = state.pendingAttachments.length > 1
        ? `${first.name} (+${state.pendingAttachments.length - 1} more)`
        : first.name;
    }
    if (els.previewSize) els.previewSize.textContent = formatFileSize(totalSize);
    els.attachmentPreview.classList.remove('hidden');
    els.attachmentPreview.setAttribute('aria-hidden', 'false');
  }

  function clearAttachments() {
    state.pendingAttachments = [];
    if (els.fileInput) els.fileInput.value = '';
    renderAttachmentPreview();
    updateInputUIState();
  }

  /* ---- Task-Based Smart Auto-Router + Live Streaming ---- */
  function selectBestRoutingProfile(text, attachments) {
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
    const isLongPrompt = String(text || '').length >= 120;
    const isCodingOrComplex = CODING_OR_COMPLEX_REGEX.test(String(text || ''));
    return hasAttachments || isLongPrompt || isCodingOrComplex ? 'auto:smart' : 'auto:fast';
  }

  async function handleSendMessage(overrideText) {
    if (state.isGenerating) return;

    const rawText = typeof overrideText === 'string'
      ? overrideText
      : (els.messageInput ? els.messageInput.value : '');
    const trimmedText = rawText.trim();
    const attachments = [...state.pendingAttachments];

    if (!trimmedText && attachments.length === 0) return;

    if (trimmedText.startsWith('/') && attachments.length === 0) {
      if (handleSlashCommand(trimmedText)) {
        if (els.messageInput) {
          els.messageInput.value = '';
          autoResizeTextarea();
          updateInputUIState();
        }
        return;
      }
    }

    let chat = getActiveChat();
    if (!chat) {
      chat = createChatSession(trimmedText || (attachments[0] ? attachments[0].name : 'New Chat'));
    }

    hideWelcomeState();

    const userMessageObj = {
      role: 'user',
      text: trimmedText,
      attachments: attachments.map((att) => ({
        name: att.name,
        size: att.size,
        isImage: att.isImage,
        base64: att.isImage && att.base64.length < 300000 ? att.base64 : '',
        textContent: !att.isImage ? att.textContent : ''
      })),
      timestamp: Date.now()
    };

    chat.messages.push(userMessageObj);
    chat.updatedAt = Date.now();
    saveChats();
    appendMessageToDOM(userMessageObj);

    if (els.messageInput && typeof overrideText !== 'string') {
      els.messageInput.value = '';
      autoResizeTextarea();
    }
    clearAttachments();

    const chosenProfile = selectBestRoutingProfile(trimmedText, attachments);
    updateModelIndicator(chosenProfile === 'auto:smart' ? 'Smart Coding Mode...' : 'Fast Chat Mode...');

    setGeneratingState(true);
    showTypingIndicator();
    scrollToBottom();

    const apiMessages = buildApiMessages(chat.messages, attachments);
    const streamBubble = createStreamingAssistantController();

    const result = await callUnifiedApiStream(
      apiMessages,
      chosenProfile,
      (_piece, fullTextSoFar) => {
        hideTypingIndicator();
        streamBubble.update(fullTextSoFar);
      },
      (detectedModel) => updateModelIndicator(detectedModel)
    );

    hideTypingIndicator();
    setGeneratingState(false);

    if (result.success) {
      const usedModel = result.model || chosenProfile;
      updateModelIndicator(usedModel);
      streamBubble.finalize(result.content, usedModel);

      chat.messages.push({
        role: 'assistant',
        text: result.content,
        model: usedModel,
        isError: false,
        timestamp: Date.now()
      });
      chat.updatedAt = Date.now();
      saveChats();
    } else {
      streamBubble.remove();
      const errorMsg = {
        role: 'assistant',
        text: CONNECTION_ERROR_MESSAGE,
        errorDetails: result.details,
        isError: true,
        timestamp: Date.now()
      };
      chat.messages.push(errorMsg);
      chat.updatedAt = Date.now();
      saveChats();
      appendMessageToDOM(errorMsg);
    }

    scrollToBottom();
    renderChatHistorySidebar();
    updateInputUIState();
  }

  function createStreamingAssistantController() {
    let messageEl = null;
    let markdownDiv = null;
    let contentWrapper = null;
    let renderTimer = null;
    let latestText = '';

    function ensureCreated() {
      if (messageEl || !els.messagesList) return;
      messageEl = document.createElement('div');
      messageEl.className = 'message message-assistant assistant';
      const avatarEl = document.createElement('div');
      avatarEl.className = 'message-avatar';
      avatarEl.setAttribute('aria-hidden', 'true');
      avatarEl.innerHTML =
        '<svg width="18" height="18" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="2"/><path d="M10 16c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="14" r="1.5" fill="currentColor"/><circle cx="16" cy="20" r="1.5" fill="currentColor"/></svg>';
      contentWrapper = document.createElement('div');
      contentWrapper.className = 'message-content';
      const bubbleEl = document.createElement('div');
      bubbleEl.className = 'message-bubble';
      markdownDiv = document.createElement('div');
      markdownDiv.className = 'message-markdown';
      bubbleEl.appendChild(markdownDiv);
      contentWrapper.appendChild(bubbleEl);
      messageEl.appendChild(avatarEl);
      messageEl.appendChild(contentWrapper);
      els.messagesList.appendChild(messageEl);
    }

    return {
      update(fullText) {
        ensureCreated();
        latestText = fullText;
        if (renderTimer) return;
        renderTimer = setTimeout(() => {
          renderTimer = null;
          if (markdownDiv) {
            markdownDiv.innerHTML = renderMarkdownSafe(latestText);
            scrollToBottom();
          }
        }, 60);
      },
      finalize(finalText, modelLabel) {
        if (renderTimer) {
          clearTimeout(renderTimer);
          renderTimer = null;
        }
        ensureCreated();
        if (markdownDiv) {
          markdownDiv.innerHTML = renderMarkdownSafe(finalText);
          enhanceCodeBlocksWithCopy(markdownDiv);
        }
        if (contentWrapper && modelLabel && !contentWrapper.querySelector('.message-meta')) {
          const metaEl = document.createElement('div');
          metaEl.className = 'message-meta';
          metaEl.style.cssText = 'font-size:0.75rem;opacity:0.65;margin-top:4px;';
          metaEl.textContent = modelLabel;
          contentWrapper.appendChild(metaEl);
        }
        scrollToBottom();
      },
      remove() {
        if (renderTimer) {
          clearTimeout(renderTimer);
          renderTimer = null;
        }
        if (messageEl && messageEl.parentNode) messageEl.parentNode.removeChild(messageEl);
        messageEl = null;
      }
    };
  }

  async function callUnifiedApiStream(apiMessages, primaryProfile, onToken, onModelDetected) {
    const apiKey = (state.apiKey || '').trim();
    if (!apiKey) {
      return { success: false, details: 'Details: Settings mein FreeLLMAPI Unified Key set nahi hai.' };
    }

    // Try selected profile (auto:smart or auto:fast), fallback to "auto" if unsupported
    const modelsToTry = primaryProfile === 'auto' ? ['auto'] : [primaryProfile, 'auto'];
    let lastErrorDetails = '';

    for (let attempt = 0; attempt < modelsToTry.length; attempt++) {
      const modelToUse = modelsToTry[attempt];
      try {
        const response = await fetch(UNIFIED_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream, application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: modelToUse,
            messages: apiMessages,
            temperature: 0.7,
            stream: true
          })
        });

        if (!response.ok) {
          let serverMessage = '';
          try {
            const rawText = await response.text();
            try {
              const errJson = JSON.parse(rawText);
              serverMessage = errJson?.error?.message || errJson?.message || errJson?.detail || rawText;
            } catch {
              serverMessage = rawText;
            }
          } catch {}
          const cleanMsg = String(serverMessage || '').replace(/<[^>]*>/g, '').trim().slice(0, 220);
          lastErrorDetails = `Details: HTTP ${response.status}${cleanMsg ? ' - ' + cleanMsg : ''}`;
          if (attempt === 0 && (response.status === 400 || response.status === 404)) continue;
          return { success: false, details: lastErrorDetails };
        }

        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('application/json') || !response.body || typeof response.body.getReader !== 'function') {
          const data = await response.json();
          const content = extractAssistantText(data);
          if (!content) return { success: false, details: 'Details: Server ne empty response bheja.' };
          const modelName = data?.model || modelToUse;
          if (onModelDetected) onModelDetected(modelName);
          if (onToken) onToken(content, content);
          return { success: true, content, model: modelName };
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let rawFallbackBuffer = '';
        let fullContent = '';
        let detectedModel = '';
        let sawSseDataLine = false;
        let streamErrorMsg = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunkText = decoder.decode(value, { stream: true });
          buffer += chunkText;
          rawFallbackBuffer += chunkText;

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const rawLine of lines) {
            const line = rawLine.replace(/\r$/, '').trim();
            if (!line || line.startsWith(':') || !line.startsWith('data:')) continue;
            sawSseDataLine = true;
            const dataStr = line.slice(5).trim();
            if (!dataStr || dataStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed?.error?.message) {
                streamErrorMsg = parsed.error.message;
                continue;
              }
              if (parsed?.model && !detectedModel) {
                detectedModel = parsed.model;
                if (onModelDetected) onModelDetected(detectedModel);
              }
              const piece = parsed?.choices?.[0]?.delta?.content || parsed?.choices?.[0]?.message?.content || '';
              if (piece) {
                fullContent += piece;
                if (onToken) onToken(piece, fullContent);
              }
            } catch {}
          }
        }

        const tail = decoder.decode();
        if (tail) buffer += tail;
        if (buffer.trim().startsWith('data:')) {
          sawSseDataLine = true;
          const dataStr = buffer.trim().slice(5).trim();
          if (dataStr && dataStr !== '[DONE]') {
            try {
              const parsed = JSON.parse(dataStr);
              const piece = parsed?.choices?.[0]?.delta?.content || parsed?.choices?.[0]?.message?.content || '';
              if (piece) {
                fullContent += piece;
                if (onToken) onToken(piece, fullContent);
              }
            } catch {}
          }
        }

        if (!sawSseDataLine && !fullContent && rawFallbackBuffer.trim().startsWith('{')) {
          try {
            const jsonFallback = JSON.parse(rawFallbackBuffer.trim());
            const text = extractAssistantText(jsonFallback);
            if (text) {
              fullContent = text;
              detectedModel = jsonFallback.model || detectedModel;
              if (onModelDetected && detectedModel) onModelDetected(detectedModel);
              if (onToken) onToken(text, text);
            } else if (jsonFallback?.error?.message) {
              streamErrorMsg = jsonFallback.error.message;
            }
          } catch {}
        }

        if (!fullContent) {
          return {
            success: false,
            details: streamErrorMsg ? `Details: ${streamErrorMsg}` : 'Details: Server ne empty response bheja.'
          };
        }

        return { success: true, content: fullContent, model: detectedModel || modelToUse };
      } catch (err) {
        return { success: false, details: `Details: ${err?.message || 'Network error'}` };
      }
    }

    return { success: false, details: lastErrorDetails || 'Details: Unknown error' };
  }

  function handleSlashCommand(cmd) {
    const command = cmd.toLowerCase();
    if (command === '/new' || command === '/clear') {
      startNewChat();
      showToast('Started a new chat', 'info');
      return true;
    }
    if (command === '/settings' || command === '/keys') {
      openSettingsModal();
      return true;
    }
    if (command === '/help') {
      hideWelcomeState();
      appendMessageToDOM({
        role: 'assistant',
        text: '**Available Commands:**\n- `/new` or `/clear` — Start fresh\n- `/settings` or `/keys` — API key settings\n- `/help` — Command list',
        model: 'System',
        isError: false,
        timestamp: Date.now()
      });
      scrollToBottom();
      return true;
    }
    return false;
  }

  function buildApiMessages(chatMessages, currentAttachments) {
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    const recentHistory = chatMessages.slice(-20);

    recentHistory.forEach((msg, index) => {
      if (msg.isError) return;
      const isLastUser = index === recentHistory.length - 1 && msg.role === 'user';

      if (msg.role === 'assistant') {
        const safeReply = (msg.text || '').trim();
        if (safeReply) messages.push({ role: 'assistant', content: safeReply });
        return;
      }

      let combinedText = msg.text || '';
      const msgAttachments = isLastUser && currentAttachments.length > 0 ? currentAttachments : (msg.attachments || []);
      const textFiles = msgAttachments.filter((a) => !a.isImage && a.textContent);
      if (textFiles.length > 0) {
        combinedText =
          (combinedText || 'Please analyze the attached file(s):') +
          textFiles.map((f) => `\n\n[Attached File: ${f.name}]\n\`\`\`\n${f.textContent}\n\`\`\``).join('');
      }

      const imageFiles = msgAttachments.filter((a) => a.isImage && a.base64);
      if (imageFiles.length > 0) {
        const contentParts = [{ type: 'text', text: combinedText || 'Please analyze the attached image(s).' }];
        imageFiles.forEach((img) => contentParts.push({ type: 'image_url', image_url: { url: img.base64 } }));
        messages.push({ role: 'user', content: contentParts });
      } else {
        messages.push({ role: 'user', content: combinedText || '[Attached image]' });
      }
    });

    return messages;
  }

  function extractAssistantText(data) {
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string') return content.trim();
    if (Array.isArray(content)) {
      return content.map((p) => (p && typeof p.text === 'string' ? p.text : '')).join('').trim();
    }
    return '';
  }

  /* ---- DOM Rendering & Markdown ---- */
  function appendMessageToDOM(msg) {
    if (!els.messagesList) return;
    const isUser = msg.role === 'user';
    const messageEl = document.createElement('div');
    messageEl.className = 'message ' + (isUser ? 'message-user user' : 'message-assistant assistant') + (msg.isError ? ' message-error' : '');

    const avatarEl = document.createElement('div');
    avatarEl.className = 'message-avatar';
    avatarEl.setAttribute('aria-hidden', 'true');
    avatarEl.innerHTML = isUser
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"></circle><path d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6"></path></svg>'
      : '<svg width="18" height="18" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="2"/><path d="M10 16c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="14" r="1.5" fill="currentColor"/><circle cx="16" cy="20" r="1.5" fill="currentColor"/></svg>';

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content';
    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'message-bubble';

    if (msg.isError) {
      bubbleEl.style.cssText =
        'color: #ef4444; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 12px; padding: 12px 16px;';
      const errTitle = document.createElement('p');
      errTitle.style.cssText = 'margin: 0; font-weight: 600; color: #ef4444;';
      errTitle.textContent = msg.text;
      bubbleEl.appendChild(errTitle);
      if (msg.errorDetails) {
        const errDetail = document.createElement('p');
        errDetail.style.cssText = 'margin: 8px 0 0; font-size: 0.8rem; line-height: 1.45; color: #dc2626; word-break: break-word;';
        errDetail.textContent = msg.errorDetails;
        bubbleEl.appendChild(errDetail);
      }
    } else if (isUser) {
      if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
        const attContainer = document.createElement('div');
        attContainer.className = 'message-attachments';
        attContainer.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;';
        msg.attachments.forEach((att) => {
          if (att.isImage && att.base64) {
            const img = document.createElement('img');
            img.src = att.base64;
            img.alt = att.name;
            img.style.cssText = 'max-width:220px;max-height:180px;border-radius:8px;object-fit:cover;display:block;';
            attContainer.appendChild(img);
          } else {
            const badge = document.createElement('span');
            badge.className = 'attachment-chip';
            badge.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:6px;background:rgba(255,255,255,0.12);font-size:0.8rem;';
            badge.textContent = `📎 ${att.name}`;
            attContainer.appendChild(badge);
          }
        });
        bubbleEl.appendChild(attContainer);
      }
      if (msg.text) {
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.style.whiteSpace = 'pre-wrap';
        textDiv.textContent = msg.text;
        bubbleEl.appendChild(textDiv);
      }
    } else {
      const markdownDiv = document.createElement('div');
      markdownDiv.className = 'message-markdown';
      markdownDiv.innerHTML = renderMarkdownSafe(msg.text || '');
      enhanceCodeBlocksWithCopy(markdownDiv);
      bubbleEl.appendChild(markdownDiv);
    }

    contentWrapper.appendChild(bubbleEl);
    if (!isUser && msg.model && !msg.isError) {
      const metaEl = document.createElement('div');
      metaEl.className = 'message-meta';
      metaEl.style.cssText = 'font-size:0.75rem;opacity:0.65;margin-top:4px;';
      metaEl.textContent = msg.model;
      contentWrapper.appendChild(metaEl);
    }
    messageEl.appendChild(avatarEl);
    messageEl.appendChild(contentWrapper);
    els.messagesList.appendChild(messageEl);
  }

  function renderMarkdownSafe(markdownText) {
    const html = (typeof window.marked !== 'undefined' && typeof window.marked.parse === 'function')
      ? window.marked.parse(markdownText)
      : escapeHtml(markdownText).replace(/\n/g, '<br>');
    const temp = document.createElement('div');
    temp.innerHTML = html;
    temp.querySelectorAll('script, iframe, object, embed, link').forEach((n) => n.remove());
    temp.querySelectorAll('*').forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        if (attr.name.toLowerCase().startsWith('on')) el.removeAttribute(attr.name);
        if ((attr.name === 'href' || attr.name === 'src') && attr.value.trim().toLowerCase().startsWith('javascript:')) {
          el.removeAttribute(attr.name);
        }
      });
    });
    return temp.innerHTML;
  }

  function enhanceCodeBlocksWithCopy(container) {
    container.querySelectorAll('pre').forEach((pre) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';
      wrapper.style.cssText = 'position:relative;margin:10px 0;';
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'copy-code-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.setAttribute('aria-label', 'Copy code');
      copyBtn.style.cssText =
        'position:absolute;top:8px;right:8px;z-index:2;padding:4px 10px;font-size:0.75rem;font-weight:500;background:rgba(139,92,246,0.22);color:#e2e8f0;border:1px solid rgba(139,92,246,0.45);border-radius:6px;cursor:pointer;';
      copyBtn.addEventListener('click', async () => {
        const codeEl = pre.querySelector('code');
        const copied = await copyToClipboard(codeEl ? codeEl.innerText : pre.innerText);
        if (copied) {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1800);
        } else {
          showToast('Copy failed', 'error');
        }
      });
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(copyBtn);
      wrapper.appendChild(pre);
    });
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  /* ---- UI Helpers ---- */
  function renderSuggestions() {
    if (!els.welcomeSuggestions) return;
    els.welcomeSuggestions.innerHTML = '';
    DEFAULT_SUGGESTIONS.forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'suggestion-card';
      btn.setAttribute('role', 'listitem');
      btn.innerHTML =
        `<span class="suggestion-title" style="display:block;font-weight:600;margin-bottom:4px;">${escapeHtml(item.title)}</span>` +
        `<span class="suggestion-prompt" style="display:block;font-size:0.85rem;opacity:0.75;">${escapeHtml(item.prompt)}</span>`;
      btn.addEventListener('click', () => handleSendMessage(item.prompt));
      els.welcomeSuggestions.appendChild(btn);
    });
  }

  function showWelcomeState() {
    if (els.welcomeState) {
      els.welcomeState.classList.remove('hidden');
      els.welcomeState.style.display = '';
    }
  }
  function hideWelcomeState() {
    if (els.welcomeState) {
      els.welcomeState.classList.add('hidden');
      els.welcomeState.style.display = 'none';
    }
  }
  function clearMessagesUI() {
    if (els.messagesList) els.messagesList.innerHTML = '';
  }
  function showTypingIndicator() {
    if (els.typingIndicator) {
      els.typingIndicator.classList.remove('hidden');
      els.typingIndicator.setAttribute('aria-hidden', 'false');
    }
  }
  function hideTypingIndicator() {
    if (els.typingIndicator) {
      els.typingIndicator.classList.add('hidden');
      els.typingIndicator.setAttribute('aria-hidden', 'true');
    }
  }
  function setGeneratingState(isGen) {
    state.isGenerating = isGen;
    if (els.sendBtn) {
      els.sendBtn.classList.toggle('loading', isGen);
      els.sendBtn.disabled = isGen;
    }
    if (els.attachBtn) els.attachBtn.disabled = isGen;
  }
  function updateInputUIState() {
    const len = els.messageInput ? els.messageInput.value.length : 0;
    const hasText = els.messageInput ? els.messageInput.value.trim().length > 0 : false;
    if (els.charCount) els.charCount.textContent = `${len}/${MAX_CHAR_LIMIT}`;
    if (els.sendBtn) els.sendBtn.disabled = state.isGenerating || (!hasText && state.pendingAttachments.length === 0);
  }
  function autoResizeTextarea() {
    if (!els.messageInput) return;
    els.messageInput.style.height = 'auto';
    els.messageInput.style.height = Math.min(els.messageInput.scrollHeight, 180) + 'px';
  }
  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (els.messagesContainer) els.messagesContainer.scrollTop = els.messagesContainer.scrollHeight;
      if (els.chatWindow) els.chatWindow.scrollTop = els.chatWindow.scrollHeight;
    });
  }
  function showToast(message, type = 'info') {
    if (!els.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type} toast-${type}`;
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    const color = type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6';
    toast.style.cssText =
      `padding:10px 16px;border-radius:10px;background:#1e1b4b;color:#f8fafc;border-left:4px solid ${color};box-shadow:0 8px 24px rgba(0,0,0,0.3);margin-top:8px;font-size:0.875rem;`;
    els.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3000);
  }
  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function safeLocalStorageGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function safeLocalStorageSet(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  }

  init();
});
