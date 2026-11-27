/**
 * ============================================================================
 * Farhan Jawed - AI Agent | script.js
 * Smart Auto-Fallback Queue, Live OpenRouter Free Models, Vision/File & Markdown
 * ============================================================================
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  /* ==========================================================================
     1. CONFIGURATION & ENDPOINTS
     ========================================================================== */
  const STORAGE_KEYS = {
    API_KEYS: 'fj_ai_api_keys',
    MODEL_MODE: 'fj_ai_model_mode',
    CHATS: 'fj_ai_chats',
    ACTIVE_CHAT_ID: 'fj_ai_active_chat_id',
    THEME: 'fj_ai_theme'
  };

  const MAX_CHAR_LIMIT = 4000;
  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB limit per file

  const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

  const ENDPOINTS = {
    openrouter: 'https://openrouter.ai/api/v1/chat/completions',
    google: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    groq: 'https://api.groq.com/openai/v1/chat/completions'
  };

  // Queue ke aakhir mein fallback models (Google aur phir Groq)
  const FALLBACK_TAIL_MODELS = [
    {
      providerId: 'google',
      providerName: 'Google Gemini',
      url: ENDPOINTS.google,
      model: 'gemini-1.5-flash',
      label: 'Google (gemini-1.5-flash)'
    },
    {
      providerId: 'groq',
      providerName: 'Groq',
      url: ENDPOINTS.groq,
      model: 'llama3-8b-8192',
      label: 'Groq (llama3-8b-8192)'
    }
  ];

  const SYSTEM_PROMPT =
    'You are Farhan Jawed AI, a helpful, intelligent, and friendly personal AI assistant. ' +
    'Provide clear, accurate, well-structured responses using Markdown when helpful.';

  const DEFAULT_SUGGESTIONS = [
    {
      title: 'Explain a concept',
      prompt: 'Explain how APIs work in simple everyday language.'
    },
    {
      title: 'Write clean code',
      prompt: 'Write a responsive HTML & CSS card component with hover effects.'
    },
    {
      title: 'Productivity boost',
      prompt: 'Create a focused 2-hour daily study plan for learning web development.'
    },
    {
      title: 'Debug & review',
      prompt: 'What are the most common JavaScript mistakes beginners should avoid?'
    }
  ];

  /* ==========================================================================
     2. DOM ELEMENT REFERENCES (Connected to index.html IDs)
     ========================================================================== */
  const els = {
    // Sidebar & Navigation
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    sidebarClose: document.getElementById('sidebarClose'),
    menuToggle: document.getElementById('menuToggle'),
    newChatBtn: document.getElementById('newChatBtn'),
    chatHistory: document.getElementById('chatHistory'),
    historyEmpty: document.getElementById('historyEmpty'),

    // Top Bar
    modelIndicator: document.getElementById('modelIndicator'),
    themeToggle: document.getElementById('themeToggle'),
    settingsTrigger: document.getElementById('settingsTrigger'),

    // Chat Area
    chatWindow: document.getElementById('chatWindow'),
    messagesContainer: document.getElementById('messagesContainer'),
    welcomeState: document.getElementById('welcomeState'),
    welcomeSuggestions: document.getElementById('welcomeSuggestions'),
    messagesList: document.getElementById('messagesList'),
    typingIndicator: document.getElementById('typingIndicator'),

    // Input & Attachments
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

    // Settings Modal
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
    tabBtns: document.querySelectorAll('.settings-tabs .tab-btn'),
    tabPanels: document.querySelectorAll('.modal-body .tab-panel'),

    // Toast
    toastContainer: document.getElementById('toastContainer')
  };

  // Dynamically injected dropdown inside Settings Modal
  let modelModeSelectEl = null;

  /* ==========================================================================
     3. APPLICATION STATE
     ========================================================================== */
  const state = {
    apiKeys: {
      google: '',
      groq: '',
      openrouter: ''
    },
    modelMode: 'auto',          // 'auto' or 'providerId::modelId'
    openRouterFreeModels: [],   // Fetched from OpenRouter /api/v1/models (price == 0)
    isFetchingModels: false,
    chats: [],
    activeChatId: null,
    pendingAttachments: [],     // Array of { name, size, type, isImage, base64, textContent }
    isGenerating: false,
    theme: 'dark'
  };

  /* ==========================================================================
     4. INITIALIZATION
     ========================================================================== */
  function init() {
    configureMarkdown();
    loadTheme();
    loadApiKeys();
    loadModelMode();
    injectModelSelectorInSettings();
    loadChats();
    renderSuggestions();
    updateModelIndicator();
    updateKeyStatusUI();
    bindEvents();
    updateInputUIState();

    // App load hote hi OpenRouter se free models fetch karke memory mein save karo
    fetchOpenRouterFreeModels();
  }

  function configureMarkdown() {
    if (typeof window.marked !== 'undefined' && typeof window.marked.setOptions === 'function') {
      window.marked.setOptions({
        breaks: true,
        gfm: true
      });
    }
  }

  /* ==========================================================================
     5. OPENROUTER FREE MODELS FETCH & SETTINGS DROPDOWN
     ========================================================================== */
  async function fetchOpenRouterFreeModels() {
    if (state.isFetchingModels) return;
    state.isFetchingModels = true;

    try {
      const response = await fetch(OPENROUTER_MODELS_URL, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        state.isFetchingModels = false;
        return;
      }

      const payload = await response.json();
      const allModels = Array.isArray(payload && payload.data) ? payload.data : [];

      // Sirf wo models filter karo jinka prompt aur completion price "0" ho
      const freeModels = allModels
        .filter((m) => {
          if (!m || !m.id || !m.pricing) return false;
          const promptPrice = m.pricing.prompt;
          const completionPrice = m.pricing.completion;

          const isPromptFree =
            promptPrice !== undefined &&
            promptPrice !== null &&
            parseFloat(promptPrice) === 0;
          const isCompletionFree =
            completionPrice !== undefined &&
            completionPrice !== null &&
            parseFloat(completionPrice) === 0;

          if (!isPromptFree || !isCompletionFree) return false;

          // Ensure model supports text output for chat completions
          const outMods = m.architecture && m.architecture.output_modalities;
          if (Array.isArray(outMods) && !outMods.includes('text')) return false;

          return true;
        })
        .map((m) => {
          const inputMods = (m.architecture && m.architecture.input_modalities) || [];
          return {
            id: m.id,
            name: m.name || m.id,
            contextLength: m.context_length || 0,
            supportsImage: Array.isArray(inputMods) && inputMods.includes('image')
          };
        });

      // Prefer models with ':free' suffix and higher context length first
      freeModels.sort((a, b) => {
        const aIsFreeTag = a.id.endsWith(':free') ? 1 : 0;
        const bIsFreeTag = b.id.endsWith(':free') ? 1 : 0;
        if (aIsFreeTag !== bIsFreeTag) return bIsFreeTag - aIsFreeTag;
        return (b.contextLength || 0) - (a.contextLength || 0);
      });

      state.openRouterFreeModels = freeModels;
      populateModelDropdownOptions();
      updateModelIndicator();
    } catch {
      // Network/CORS error on background fetch handled silently without console spam
    } finally {
      state.isFetchingModels = false;
    }
  }

  function loadModelMode() {
    const saved = safeLocalStorageGet(STORAGE_KEYS.MODEL_MODE);
    state.modelMode = saved && saved.trim() ? saved.trim() : 'auto';
  }

  function injectModelSelectorInSettings() {
    if (!els.settingsModal) return;
    const modalBody = els.settingsModal.querySelector('.modal-body');
    if (!modalBody) return;

    // Avoid duplicate injection
    if (document.getElementById('modelModeSelect')) {
      modelModeSelectEl = document.getElementById('modelModeSelect');
      populateModelDropdownOptions();
      return;
    }

    const group = document.createElement('div');
    group.className = 'form-group';
    group.id = 'modelModeGroup';
    group.style.marginTop = '12px';

    const label = document.createElement('label');
    label.setAttribute('for', 'modelModeSelect');
    label.textContent = 'Model Selection Mode';

    const select = document.createElement('select');
    select.id = 'modelModeSelect';
    select.className = 'settings-input';
    select.style.width = '100%';
    select.style.cursor = 'pointer';

    const help = document.createElement('p');
    help.className = 'form-help';
    help.textContent =
      'Auto mode pehle sabhi OpenRouter free models try karta hai, phir Google (gemini-1.5-flash) aur Groq (llama3-8b-8192).';

    group.appendChild(label);
    group.appendChild(select);
    group.appendChild(help);

    if (els.keyStatus && els.keyStatus.parentNode === modalBody) {
      modalBody.insertBefore(group, els.keyStatus);
    } else {
      modalBody.appendChild(group);
    }

    modelModeSelectEl = select;
    populateModelDropdownOptions();
  }

  function populateModelDropdownOptions() {
    if (!modelModeSelectEl) return;

    modelModeSelectEl.innerHTML = '';

    // 1. Default Auto Option
    const autoOpt = document.createElement('option');
    autoOpt.value = 'auto';
    autoOpt.textContent = 'Auto (Best Available)';
    modelModeSelectEl.appendChild(autoOpt);

    // 2. OpenRouter Free Models Group
    if (state.openRouterFreeModels.length > 0) {
      const orGroup = document.createElement('optgroup');
      orGroup.label = `OpenRouter Free Models (${state.openRouterFreeModels.length})`;

      state.openRouterFreeModels.forEach((m) => {
        const opt = document.createElement('option');
        opt.value = `openrouter::${m.id}`;
        opt.textContent = `${m.name} (${m.id})`;
        orGroup.appendChild(opt);
      });

      modelModeSelectEl.appendChild(orGroup);
    }

    // 3. Direct Fallback Providers
    const directGroup = document.createElement('optgroup');
    directGroup.label = 'Direct Fallback Providers';

    FALLBACK_TAIL_MODELS.forEach((item) => {
      const opt = document.createElement('option');
      opt.value = `${item.providerId}::${item.model}`;
      opt.textContent = item.label;
      directGroup.appendChild(opt);
    });

    modelModeSelectEl.appendChild(directGroup);

    // Restore saved selection (fallback to 'auto' if saved model no longer exists)
    const hasSavedOption = Array.from(modelModeSelectEl.options).some(
      (o) => o.value === state.modelMode
    );
    modelModeSelectEl.value = hasSavedOption ? state.modelMode : 'auto';
  }

  /* ==========================================================================
     6. EVENT LISTENERS
     ========================================================================== */
  function bindEvents() {
    // Sidebar toggles
    if (els.menuToggle) {
      els.menuToggle.addEventListener('click', openSidebar);
    }
    if (els.sidebarClose) {
      els.sidebarClose.addEventListener('click', closeSidebar);
    }
    if (els.sidebarOverlay) {
      els.sidebarOverlay.addEventListener('click', closeSidebar);
    }

    // New Chat
    if (els.newChatBtn) {
      els.newChatBtn.addEventListener('click', () => {
        startNewChat();
        closeSidebar();
      });
    }

    // Theme toggle
    if (els.themeToggle) {
      els.themeToggle.addEventListener('click', toggleTheme);
    }

    // Model indicator opens settings
    if (els.modelIndicator) {
      els.modelIndicator.addEventListener('click', openSettingsModal);
      els.modelIndicator.style.cursor = 'pointer';
    }

    // Settings modal open/close/save
    if (els.settingsTrigger) {
      els.settingsTrigger.addEventListener('click', openSettingsModal);
    }
    if (els.modalClose) {
      els.modalClose.addEventListener('click', closeSettingsModal);
    }
    if (els.modalCancel) {
      els.modalCancel.addEventListener('click', closeSettingsModal);
    }
    if (els.modalBackdrop) {
      els.modalBackdrop.addEventListener('click', closeSettingsModal);
    }
    if (els.saveKeysBtn) {
      els.saveKeysBtn.addEventListener('click', handleSaveKeys);
    }

    // Settings Tabs
    els.tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => switchSettingsTab(btn.dataset.panel));
    });

    // Password visibility toggles
    bindVisibilityToggle(els.toggleGoogleKey, els.googleKey);
    bindVisibilityToggle(els.toggleGroqKey, els.groqKey);
    bindVisibilityToggle(els.toggleOpenRouterKey, els.openrouterKey);

    // Message input & form submit
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

    // File / Image attachments
    if (els.attachBtn && els.fileInput) {
      els.attachBtn.addEventListener('click', () => els.fileInput.click());
      els.fileInput.addEventListener('change', handleFileSelection);
    }

    if (els.previewRemove) {
      els.previewRemove.addEventListener('click', clearAttachments);
    }

    // Global Escape key handler
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (isModalOpen()) {
          closeSettingsModal();
        } else if (els.sidebar && els.sidebar.classList.contains('open')) {
          closeSidebar();
        }
      }
    });
  }

  /* ==========================================================================
     7. THEME MANAGEMENT
     ========================================================================== */
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

    if (els.themeToggle) {
      els.themeToggle.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
    }
  }

  /* ==========================================================================
     8. SIDEBAR & CHAT HISTORY MANAGEMENT
     ========================================================================== */
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
    if (state.activeChatId) {
      safeLocalStorageSet(STORAGE_KEYS.ACTIVE_CHAT_ID, state.activeChatId);
    } else {
      try {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_CHAT_ID);
      } catch {
        // Ignore storage errors
      }
    }
  }

  function getActiveChat() {
    return state.chats.find((c) => c.id === state.activeChatId) || null;
  }

  function createChatSession(firstMessageText) {
    const cleanTitle = (firstMessageText || 'New Conversation')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 38);

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

    els.chatHistory.querySelectorAll('.history-item').forEach((node) => node.remove());

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

      const iconSvg =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;opacity:0.75;" aria-hidden="true">' +
        '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'history-item-title';
      titleSpan.textContent = chat.title || 'New Conversation';
      titleSpan.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

      titleBtn.innerHTML = iconSvg;
      titleBtn.appendChild(titleSpan);
      titleBtn.addEventListener('click', () => selectChat(chat.id));

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'history-delete-btn';
      deleteBtn.setAttribute('aria-label', 'Delete conversation');
      deleteBtn.style.cssText =
        'background:transparent;border:none;color:inherit;opacity:0.6;cursor:pointer;padding:6px 8px;display:flex;align-items:center;justify-content:center;border-radius:6px;';
      deleteBtn.innerHTML =
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
        '<polyline points="3 6 5 6 21 6"></polyline>' +
        '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>' +
        '<path d="M10 11v6M14 11v6"></path></svg>';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteChat(chat.id);
      });

      item.style.cssText =
        'display:flex;align-items:center;justify-content:space-between;border-radius:10px;margin-bottom:4px;';
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
    chat.messages.forEach((msg) => {
      appendMessageToDOM(msg);
    });
    scrollToBottom();
  }

  /* ==========================================================================
     9. SETTINGS MODAL & API KEY MANAGEMENT
     ========================================================================== */
  function loadApiKeys() {
    const raw = safeLocalStorageGet(STORAGE_KEYS.API_KEYS);
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      state.apiKeys = {
        google: typeof parsed.google === 'string' ? parsed.google.trim() : '',
        groq: typeof parsed.groq === 'string' ? parsed.groq.trim() : '',
        openrouter: typeof parsed.openrouter === 'string' ? parsed.openrouter.trim() : ''
      };
    } catch {
      state.apiKeys = { google: '', groq: '', openrouter: '' };
    }
    populateKeyInputs();
  }

  function populateKeyInputs() {
    if (els.googleKey) els.googleKey.value = state.apiKeys.google || '';
    if (els.groqKey) els.groqKey.value = state.apiKeys.groq || '';
    if (els.openrouterKey) els.openrouterKey.value = state.apiKeys.openrouter || '';
  }

  function isModalOpen() {
    if (!els.settingsModal) return false;
    return els.settingsModal.hasAttribute('open') || els.settingsModal.classList.contains('open');
  }

  function openSettingsModal() {
    populateKeyInputs();
    populateModelDropdownOptions();
    updateKeyStatusUI();

    if (state.openRouterFreeModels.length === 0) {
      fetchOpenRouterFreeModels();
    }

    if (!els.settingsModal) return;
    if (typeof els.settingsModal.showModal === 'function') {
      if (!els.settingsModal.open) {
        try {
          els.settingsModal.showModal();
        } catch {
          els.settingsModal.setAttribute('open', '');
        }
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
      try {
        els.settingsModal.close();
      } catch {
        els.settingsModal.removeAttribute('open');
      }
    } else {
      els.settingsModal.removeAttribute('open');
    }

    els.settingsModal.classList.remove('open', 'active');
    if (els.settingsTrigger) els.settingsTrigger.setAttribute('aria-expanded', 'false');
  }

  function switchSettingsTab(panelName) {
    if (!panelName) return;

    els.tabBtns.forEach((btn) => {
      const isSelected = btn.dataset.panel === panelName;
      btn.classList.toggle('active', isSelected);
      btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });

    els.tabPanels.forEach((panel) => {
      const isMatch = panel.id === 'panel-' + panelName;
      panel.classList.toggle('active', isMatch);
      if (isMatch) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    });
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

  function handleSaveKeys() {
    state.apiKeys = {
      google: els.googleKey ? els.googleKey.value.trim() : '',
      groq: els.groqKey ? els.groqKey.value.trim() : '',
      openrouter: els.openrouterKey ? els.openrouterKey.value.trim() : ''
    };

    if (modelModeSelectEl) {
      state.modelMode = modelModeSelectEl.value || 'auto';
      safeLocalStorageSet(STORAGE_KEYS.MODEL_MODE, state.modelMode);
    }

    safeLocalStorageSet(STORAGE_KEYS.API_KEYS, JSON.stringify(state.apiKeys));
    updateKeyStatusUI();
    updateModelIndicator();
    closeSettingsModal();
    showToast('Settings & API keys saved!', 'success');
  }

  function updateKeyStatusUI() {
    if (!els.keyStatus) return;

    const providers = [
      { id: 'openrouter', name: 'OpenRouter', extra: `${state.openRouterFreeModels.length} free models` },
      { id: 'google', name: 'Google Gemini', extra: 'gemini-1.5-flash' },
      { id: 'groq', name: 'Groq', extra: 'llama3-8b-8192' }
    ];

    const statusHtml = providers
      .map((p) => {
        const hasKey = Boolean(state.apiKeys[p.id]);
        const dotColor = hasKey ? '#22c55e' : '#94a3b8';
        const statusText = hasKey ? `Configured (${p.extra})` : 'Not set';
        return (
          `<div class="key-status-item" style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-radius:8px;font-size:0.85rem;">` +
          `<span style="display:flex;align-items:center;gap:8px;">` +
          `<span style="width:8px;height:8px;border-radius:50%;background:${dotColor};display:inline-block;"></span>` +
          `<span>${escapeHtml(p.name)}</span>` +
          `</span>` +
          `<span style="opacity:0.8;color:${hasKey ? '#22c55e' : 'inherit'};">${escapeHtml(statusText)}</span>` +
          `</div>`
        );
      })
      .join('');

    els.keyStatus.innerHTML = statusHtml;
  }

  function updateModelIndicator(activeModelLabel) {
    if (!els.modelIndicator) return;
    const nameEl = els.modelIndicator.querySelector('.model-name');
    const dotEl = els.modelIndicator.querySelector('.model-dot');
    if (!nameEl) return;

    if (activeModelLabel) {
      nameEl.textContent = activeModelLabel;
      if (dotEl) dotEl.style.backgroundColor = '#22c55e';
      return;
    }

    const hasAnyKey = Boolean(
      state.apiKeys.openrouter || state.apiKeys.google || state.apiKeys.groq
    );

    if (!hasAnyKey) {
      nameEl.textContent = 'Add API Key';
      if (dotEl) dotEl.style.backgroundColor = '#f59e0b';
      return;
    }

    if (state.modelMode === 'auto') {
      const freeCount = state.openRouterFreeModels.length;
      nameEl.textContent = freeCount > 0
        ? `Auto (${freeCount} Free + Fallbacks)`
        : 'Auto (Best Available)';
      if (dotEl) dotEl.style.backgroundColor = '#22c55e';
    } else {
      const parts = state.modelMode.split('::');
      nameEl.textContent = parts[1] || state.modelMode;
      if (dotEl) dotEl.style.backgroundColor = '#22c55e';
    }
  }

  /* ==========================================================================
     10. FILE & IMAGE ATTACHMENT HANDLING
     ========================================================================== */
  async function handleFileSelection(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        showToast(`"${file.name}" 5MB se badi hai. Chhoti file select karein.`, 'error');
        continue;
      }

      try {
        if (file.type.startsWith('image/')) {
          const base64 = await readFileAsDataURL(file);
          state.pendingAttachments.push({
            name: file.name,
            size: file.size,
            type: file.type,
            isImage: true,
            base64,
            textContent: ''
          });
        } else {
          const textContent = await readFileAsText(file);
          state.pendingAttachments.push({
            name: file.name,
            size: file.size,
            type: file.type || 'text/plain',
            isImage: false,
            base64: '',
            textContent
          });
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
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read text file'));
      reader.readAsText(file);
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
      if (first.isImage && first.base64) {
        els.previewThumb.innerHTML = `<img src="${first.base64}" alt="${escapeHtml(first.name)}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">`;
      } else {
        els.previewThumb.innerHTML =
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
          '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>' +
          '<polyline points="14 2 14 8 20 8"></polyline>' +
          '<line x1="16" y1="13" x2="8" y2="13"></line>' +
          '<line x1="16" y1="17" x2="8" y2="17"></line></svg>';
      }
    }

    if (els.previewName) {
      els.previewName.textContent =
        state.pendingAttachments.length > 1
          ? `${first.name} (+${state.pendingAttachments.length - 1} more)`
          : first.name;
    }

    if (els.previewSize) {
      els.previewSize.textContent = formatFileSize(totalSize);
    }

    els.attachmentPreview.classList.remove('hidden');
    els.attachmentPreview.setAttribute('aria-hidden', 'false');
  }

  function clearAttachments() {
    state.pendingAttachments = [];
    if (els.fileInput) els.fileInput.value = '';
    renderAttachmentPreview();
    updateInputUIState();
  }

  /* ==========================================================================
     11. SMART AUTO-FALLBACK QUEUE & CHAT MESSAGING ENGINE
     ========================================================================== */
  async function handleSendMessage(overrideText) {
    if (state.isGenerating) return;

    const rawText = typeof overrideText === 'string'
      ? overrideText
      : (els.messageInput ? els.messageInput.value : '');
    const trimmedText = rawText.trim();
    const attachments = [...state.pendingAttachments];

    if (!trimmedText && attachments.length === 0) return;

    // Quick slash commands
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

    // Create chat session if needed
    let chat = getActiveChat();
    if (!chat) {
      const initialTitle = trimmedText || (attachments[0] ? attachments[0].name : 'New Chat');
      chat = createChatSession(initialTitle);
    }

    hideWelcomeState();

    // Build user message object
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

    // Save & render user message
    chat.messages.push(userMessageObj);
    chat.updatedAt = Date.now();
    saveChats();
    appendMessageToDOM(userMessageObj);

    // Clear input & attachments
    if (els.messageInput && typeof overrideText !== 'string') {
      els.messageInput.value = '';
      autoResizeTextarea();
    }
    clearAttachments();

    // Lock UI & create live switching status message in chat
    setGeneratingState(true);
    showTypingIndicator();
    const statusBubbleCtrl = createLiveStatusMessage();
    scrollToBottom();

    // If user chose Auto and free models list isn't loaded yet, try fetching once
    if (state.modelMode === 'auto' && state.openRouterFreeModels.length === 0) {
      statusBubbleCtrl.update('Connecting... (Fetching free OpenRouter models)');
      await fetchOpenRouterFreeModels();
    }

    const hasImageAttachment = attachments.some((a) => a.isImage && a.base64);
    const modelQueue = buildModelQueue(hasImageAttachment);
    const apiMessages = buildApiMessages(chat.messages, attachments);

    // Execute Smart Auto-Fallback while-loop queue
    const result = await executeModelQueue(modelQueue, apiMessages, (statusText) => {
      statusBubbleCtrl.update(statusText);
      scrollToBottom();
    });

    // Remove temporary "Connecting... (Trying model X)" indicator
    statusBubbleCtrl.remove();
    hideTypingIndicator();
    setGeneratingState(false);

    if (result.success) {
      updateModelIndicator(result.candidate.model);

      const assistantMsg = {
        role: 'assistant',
        text: result.content,
        model: result.candidate.label,
        isError: false,
        timestamp: Date.now()
      };

      chat.messages.push(assistantMsg);
      chat.updatedAt = Date.now();
      saveChats();
      appendMessageToDOM(assistantMsg);
    } else {
      updateModelIndicator();

      const errorMsg = {
        role: 'assistant',
        text: 'Sabhi models busy hain, thodi der baad try karein',
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

  /**
   * Builds the Priority Queue:
   * - In 'auto' mode:
   *   1) All fetched OpenRouter Free Models (if image attached, vision-capable first)
   *   2) Google (gemini-1.5-flash)
   *   3) Groq (llama3-8b-8192)
   * - In manual mode:
   *   Tries the user's selected model directly.
   */
  function buildModelQueue(hasImageAttachment) {
    const queue = [];

    if (state.modelMode && state.modelMode !== 'auto' && state.modelMode.includes('::')) {
      const [providerId, ...rest] = state.modelMode.split('::');
      const modelId = rest.join('::');
      if (ENDPOINTS[providerId] && modelId) {
        queue.push({
          providerId,
          providerName: providerId.toUpperCase(),
          url: ENDPOINTS[providerId],
          model: modelId,
          label: `${providerId} (${modelId})`
        });
        return queue;
      }
    }

    // 1. OpenRouter Free Models first
    if (state.openRouterFreeModels.length > 0) {
      const orderedFree = hasImageAttachment
        ? [
            ...state.openRouterFreeModels.filter((m) => m.supportsImage),
            ...state.openRouterFreeModels.filter((m) => !m.supportsImage)
          ]
        : state.openRouterFreeModels;

      orderedFree.forEach((m) => {
        queue.push({
          providerId: 'openrouter',
          providerName: 'OpenRouter',
          url: ENDPOINTS.openrouter,
          model: m.id,
          label: `OpenRouter (${m.id})`
        });
      });
    }

    // 2. Tail Fallbacks: Google (gemini-1.5-flash) -> Groq (llama3-8b-8192)
    FALLBACK_TAIL_MODELS.forEach((tail) => {
      queue.push({ ...tail });
    });

    return queue;
  }

  /**
   * Solid while-loop + try-catch executor across the model queue.
   * Immediately advances to the next model on 429, 404, 500, 400, or network/CORS errors.
   */
  async function executeModelQueue(queue, apiMessages, onStatusUpdate) {
    const errorLog = [];
    let anyKeyConfigured = false;
    let openRouterAuthFailed = false;
    let index = 0;

    while (index < queue.length) {
      const candidate = queue[index];
      index += 1;

      const apiKey = (state.apiKeys[candidate.providerId] || '').trim();
      if (!apiKey) {
        errorLog.push(`${candidate.label}: API key missing`);
        continue;
      }

      // If OpenRouter key itself is invalid (401), skip remaining OpenRouter models
      if (candidate.providerId === 'openrouter' && openRouterAuthFailed) {
        continue;
      }

      anyKeyConfigured = true;

      // Update live UI: "Connecting... (Trying model X)"
      if (typeof onStatusUpdate === 'function') {
        onStatusUpdate(`Connecting... (Trying model ${candidate.model})`);
      }
      updateModelIndicator(`Trying ${candidate.model}...`);

      try {
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        };

        if (candidate.providerId === 'openrouter') {
          headers['HTTP-Referer'] = window.location.origin || 'http://localhost';
          headers['X-Title'] = 'Farhan Jawed AI Agent';
        }

        const response = await fetch(candidate.url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: candidate.model,
            messages: apiMessages,
            temperature: 0.7
          })
        });

        if (!response.ok) {
          let apiErrMessage = '';
          try {
            const errJson = await response.json();
            if (Array.isArray(errJson) && errJson[0]?.error?.message) {
              apiErrMessage = errJson[0].error.message;
            } else if (errJson?.error?.message) {
              apiErrMessage = errJson.error.message;
            } else if (typeof errJson?.message === 'string') {
              apiErrMessage = errJson.message;
            }
          } catch {
            // Non-JSON error body
          }

          if (candidate.providerId === 'openrouter' && response.status === 401) {
            openRouterAuthFailed = true;
          }

          const reason = getHttpErrorReason(response.status, apiErrMessage);
          errorLog.push(`${candidate.label}: ${reason}`);
          continue; // Turant agle model par jao (429, 404, 500, etc.)
        }

        const data = await response.json();
        const choiceContent = extractAssistantText(data);

        if (!choiceContent) {
          errorLog.push(`${candidate.label}: Empty response received`);
          continue;
        }

        // Valid response mila -> loop khatam aur answer return karo
        return {
          success: true,
          candidate,
          content: choiceContent
        };
      } catch (networkOrCorsErr) {
        const errMsg =
          networkOrCorsErr && networkOrCorsErr.message
            ? networkOrCorsErr.message
            : 'Network or CORS error';
        errorLog.push(`${candidate.label}: ${errMsg}`);
        continue; // Error aane par agle model par jao
      }
    }

    return {
      success: false,
      details: anyKeyConfigured
        ? errorLog.slice(0, 8).map((entry) => `• ${entry}`).join('\n') +
          (errorLog.length > 8 ? `\n• ...and ${errorLog.length - 8} more failed attempts` : '')
        : 'Koi bhi API key set nahi hai. Settings icon par click karke apni key daalein.'
    };
  }

  function createLiveStatusMessage() {
    const statusEl = document.createElement('div');
    statusEl.className = 'message message-assistant assistant live-status-message';
    statusEl.setAttribute('aria-live', 'polite');

    const avatarEl = document.createElement('div');
    avatarEl.className = 'message-avatar';
    avatarEl.setAttribute('aria-hidden', 'true');
    avatarEl.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 32 32" fill="none">' +
      '<circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="2"/>' +
      '<path d="M10 16c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content';

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'message-bubble';
    bubbleEl.style.cssText =
      'display:inline-flex;align-items:center;gap:10px;padding:10px 14px;' +
      'font-size:0.88rem;color:#c4b5fd;border-color:rgba(139,92,246,0.4);';

    const pulseDot = document.createElement('span');
    pulseDot.style.cssText =
      'width:8px;height:8px;border-radius:50%;background:#8b5cf6;flex-shrink:0;' +
      'box-shadow:0 0 10px #8b5cf6;';

    const textSpan = document.createElement('span');
    textSpan.textContent = 'Connecting...';

    bubbleEl.appendChild(pulseDot);
    bubbleEl.appendChild(textSpan);
    contentWrapper.appendChild(bubbleEl);
    statusEl.appendChild(avatarEl);
    statusEl.appendChild(contentWrapper);

    if (els.messagesList) {
      els.messagesList.appendChild(statusEl);
    }

    return {
      update(newText) {
        textSpan.textContent = newText;
      },
      remove() {
        if (statusEl.parentNode) {
          statusEl.parentNode.removeChild(statusEl);
        }
      }
    };
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
        text:
          '**Available Commands:**\n' +
          '- `/new` or `/clear` — Start a fresh conversation\n' +
          '- `/settings` or `/keys` — Open API key & model settings\n' +
          '- `/help` — Show this command list',
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

      const isLastUserMessage = index === recentHistory.length - 1 && msg.role === 'user';

      if (msg.role === 'assistant') {
        const safeReply = (msg.text || '').trim();
        if (safeReply) {
          messages.push({ role: 'assistant', content: safeReply });
        }
        return;
      }

      let combinedText = msg.text || '';
      const msgAttachments = isLastUserMessage && currentAttachments.length > 0
        ? currentAttachments
        : (msg.attachments || []);

      const textFiles = msgAttachments.filter((a) => !a.isImage && a.textContent);
      if (textFiles.length > 0) {
        const filesBlock = textFiles
          .map((f) => `\n\n[Attached File: ${f.name}]\n\`\`\`\n${f.textContent}\n\`\`\``)
          .join('');
        combinedText = (combinedText || 'Please analyze the attached file(s):') + filesBlock;
      }

      const imageFiles = msgAttachments.filter((a) => a.isImage && a.base64);

      if (imageFiles.length > 0) {
        const contentParts = [
          {
            type: 'text',
            text: combinedText || 'Please analyze the attached image(s).'
          }
        ];

        imageFiles.forEach((img) => {
          contentParts.push({
            type: 'image_url',
            image_url: {
              url: img.base64
            }
          });
        });

        messages.push({ role: 'user', content: contentParts });
      } else {
        messages.push({ role: 'user', content: combinedText || '[Attached image]' });
      }
    });

    return messages;
  }

  function getHttpErrorReason(status, apiMessage) {
    const statusMap = {
      400: 'Bad Request',
      401: 'Invalid API Key (Unauthorized)',
      403: 'Access Denied (Forbidden)',
      404: 'Model not found',
      429: 'Rate limit exceeded (Busy)',
      500: 'Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable'
    };

    const baseReason = statusMap[status] || `HTTP ${status}`;
    return apiMessage ? `${baseReason} - ${apiMessage}` : baseReason;
  }

  function extractAssistantText(data) {
    if (!data || !Array.isArray(data.choices) || data.choices.length === 0) {
      return '';
    }
    const content = data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '';

    if (typeof content === 'string') {
      return content.trim();
    }
    if (Array.isArray(content)) {
      return content
        .map((part) => (part && typeof part.text === 'string' ? part.text : ''))
        .join('')
        .trim();
    }
    return '';
  }

  /* ==========================================================================
     12. MESSAGE RENDERING, MARKDOWN & CODE BLOCK COPY BUTTONS
     ========================================================================== */
  function appendMessageToDOM(msg) {
    if (!els.messagesList) return;

    const isUser = msg.role === 'user';
    const messageEl = document.createElement('div');
    messageEl.className =
      'message ' +
      (isUser ? 'message-user user' : 'message-assistant assistant') +
      (msg.isError ? ' message-error' : '');

    // Avatar
    const avatarEl = document.createElement('div');
    avatarEl.className = 'message-avatar';
    avatarEl.setAttribute('aria-hidden', 'true');
    avatarEl.innerHTML = isUser
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"></circle><path d="M4 20c0-3.5 3.5-6 8-6s8 2.5 8 6"></path></svg>'
      : '<svg width="18" height="18" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="14" stroke="currentColor" stroke-width="2"/><path d="M10 16c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="14" r="1.5" fill="currentColor"/><circle cx="16" cy="20" r="1.5" fill="currentColor"/></svg>';

    // Content Wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'message-content';

    // Bubble
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
        errDetail.style.cssText =
          'margin: 8px 0 0; font-size: 0.8rem; line-height: 1.5; opacity: 0.95; color: #f87171; white-space: pre-line;';
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
            badge.style.cssText =
              'display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:6px;background:rgba(255,255,255,0.12);font-size:0.8rem;';
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
    let html = '';
    if (typeof window.marked !== 'undefined' && typeof window.marked.parse === 'function') {
      html = window.marked.parse(markdownText);
    } else {
      html = escapeHtml(markdownText).replace(/\n/g, '<br>');
    }

    const temp = document.createElement('div');
    temp.innerHTML = html;

    temp.querySelectorAll('script, iframe, object, embed, link').forEach((node) => node.remove());
    temp.querySelectorAll('*').forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        if (attr.name.toLowerCase().startsWith('on')) {
          el.removeAttribute(attr.name);
        }
        if (
          (attr.name === 'href' || attr.name === 'src') &&
          attr.value.trim().toLowerCase().startsWith('javascript:')
        ) {
          el.removeAttribute(attr.name);
        }
      });
    });

    return temp.innerHTML;
  }

  function enhanceCodeBlocksWithCopy(container) {
    const preBlocks = container.querySelectorAll('pre');
    preBlocks.forEach((pre) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';
      wrapper.style.cssText = 'position:relative;margin:10px 0;';

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'copy-code-btn';
      copyBtn.textContent = 'Copy';
      copyBtn.setAttribute('aria-label', 'Copy code');
      copyBtn.style.cssText =
        'position:absolute;top:8px;right:8px;z-index:2;padding:4px 10px;font-size:0.75rem;font-weight:500;' +
        'background:rgba(139,92,246,0.22);color:#e2e8f0;border:1px solid rgba(139,92,246,0.45);' +
        'border-radius:6px;cursor:pointer;backdrop-filter:blur(4px);transition:all 0.2s ease;';

      copyBtn.addEventListener('click', async () => {
        const codeEl = pre.querySelector('code');
        const codeText = codeEl ? codeEl.innerText : pre.innerText;

        const copied = await copyToClipboard(codeText);
        if (copied) {
          copyBtn.textContent = 'Copied!';
          copyBtn.style.background = 'rgba(34,197,94,0.28)';
          copyBtn.style.borderColor = 'rgba(34,197,94,0.6)';
          setTimeout(() => {
            copyBtn.textContent = 'Copy';
            copyBtn.style.background = 'rgba(139,92,246,0.22)';
            copyBtn.style.borderColor = 'rgba(139,92,246,0.45)';
          }, 1800);
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
    } catch {
      // Fallback below
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }

  /* ==========================================================================
     13. UI HELPERS (Suggestions, Typing Indicator, Toasts, Scrolling)
     ========================================================================== */
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

      btn.addEventListener('click', () => {
        handleSendMessage(item.prompt);
      });

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
    if (els.messagesList) {
      els.messagesList.innerHTML = '';
    }
  }

  function showTypingIndicator() {
    if (!els.typingIndicator) return;
    els.typingIndicator.classList.remove('hidden');
    els.typingIndicator.setAttribute('aria-hidden', 'false');
  }

  function hideTypingIndicator() {
    if (!els.typingIndicator) return;
    els.typingIndicator.classList.add('hidden');
    els.typingIndicator.setAttribute('aria-hidden', 'true');
  }

  function setGeneratingState(isGenerating) {
    state.isGenerating = isGenerating;
    if (els.sendBtn) {
      els.sendBtn.classList.toggle('loading', isGenerating);
      els.sendBtn.disabled = isGenerating;
    }
    if (els.attachBtn) {
      els.attachBtn.disabled = isGenerating;
    }
  }

  function updateInputUIState() {
    const textLength = els.messageInput ? els.messageInput.value.length : 0;
    const hasText = els.messageInput ? els.messageInput.value.trim().length > 0 : false;
    const hasFiles = state.pendingAttachments.length > 0;

    if (els.charCount) {
      els.charCount.textContent = `${textLength}/${MAX_CHAR_LIMIT}`;
    }

    if (els.sendBtn) {
      els.sendBtn.disabled = state.isGenerating || (!hasText && !hasFiles);
    }
  }

  function autoResizeTextarea() {
    if (!els.messageInput) return;
    els.messageInput.style.height = 'auto';
    els.messageInput.style.height = Math.min(els.messageInput.scrollHeight, 180) + 'px';
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (els.messagesContainer) {
        els.messagesContainer.scrollTop = els.messagesContainer.scrollHeight;
      }
      if (els.chatWindow) {
        els.chatWindow.scrollTop = els.chatWindow.scrollHeight;
      }
    });
  }

  function showToast(message, type = 'info') {
    if (!els.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type} toast-${type}`;
    toast.setAttribute('role', 'status');
    toast.textContent = message;

    const borderColor =
      type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6';
    toast.style.cssText =
      `padding:10px 16px;border-radius:10px;background:#1e1b4b;color:#f8fafc;border-left:4px solid ${borderColor};` +
      `box-shadow:0 8px 24px rgba(0,0,0,0.3);margin-top:8px;font-size:0.875rem;`;

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
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeLocalStorageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function safeLocalStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Ignore storage quota or privacy-mode errors
    }
  }

  // Start the app
  init();
});
