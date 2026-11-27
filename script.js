//!
//! script.js - Farhan Jawed - AI Agent
//! 100% Client-Side PWA with Multi-Key Fallback System
//! Features: Text chat, Photo upload (Gemini Vision), File upload, Settings modal
//! Multi-key fallback: Google Gemini -> Groq -> OpenRouter
//!

/* ==============================================================
   Configuration & Global State
   ============================================================== */

// API Configuration - Endpoints and models
const API_CONFIG = {
  // Google Gemini (first fallback)
  google: {
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.5-flash',
    name: 'Google Gemini',
  },
  // Groq (second fallback)
  groq: {
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    fallbackModel: 'mixtral-8x7b-32768',
    name: 'Groq',
  },
  // OpenRouter (third fallback)
  openrouter: {
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'OpenRouter',
  },
};

// Application state
const STATE = {
  keys: {
    google: localStorage.getItem('farhan-google-key') || '',
    groq: localStorage.getItem('farhan-groq-key') || '',
    openrouter: localStorage.getItem('farhan-openrouter-key') || '',
  },
  currentModel: 'Google Gemini',
  isLoading: false,
  messageHistory: [],
  uploadedFile: null,
  fileReader: new FileReader(),
};

// UI Elements (cached after DOM load)
const ELEMENTS = {
  chatMessages: null,
  messageInput: null,
  sendBtnEl: null,
  settingBtn: null,
  settingsModal: null,
  modalCloseBtn: null,
  saveKeysBtn: null,
  googleKeyInput: null,
  groqKeyInput: null,
  openrouterKeyInput: null,
  welcomeMsg: null,
  loadingSpinner: null,
  dropZone: null,
  fileInput: null,
  attachmentsBtnEl: null,
  uploadArea: null,
  modelIndicator: null,
  statusDot: null,
};

// ==============================================================
// Initialization
// ==============================================================

document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  initUI();
  setupEventListeners();
  checkKeysStatus();

  if (STATE.messageHistory.length === 0) {
    addWelcomeMessage();
  }
});

// Cache all DOM elements
function cacheElements() {
  ELEMENTS.chatMessages = document.getElementById('chatMessages');
  ELEMENTS.messageInput = document.getElementById('messageInput');
  ELEMENTS.sendBtnEl = document.getElementById('sendBtnEl');
  ELEMENTS.settingBtn = document.getElementById('settingBtn');
  ELEMENTS.settingsModal = document.getElementById('settingsModal');
  ELEMENTS.modalCloseBtn = document.getElementById('modalCloseBtn');
  ELEMENTS.saveKeysBtn = document.getElementById('saveKeysBtn');
  ELEMENTS.googleKeyInput = document.getElementById('googleKey');
  ELEMENTS.groqKeyInput = document.getElementById('groqKey');
  ELEMENTS.openrouterKeyInput = document.getElementById('openrouterKey');
  ELEMENTS.welcomeMsg = document.getElementById('welcomeMsg');
  ELEMENTS.loadingSpinner = document.getElementById('loadingSpinner');
  ELEMENTS.dropZone = document.getElementById('dropZone');
  ELEMENTS.fileInput = document.getElementById('fileInput');
  ELEMENTS.attachmentsBtnEl = document.getElementById('attachmentsBtnEl');
  ELEMENTS.uploadArea = document.getElementById('uploadArea');
  ELEMENTS.modelIndicator = document.getElementById('modelIndicator');
  ELEMENTS.statusDot = document.getElementById('statusDot');
}

// Initialize UI state
function initUI() {
  updateModelIndicator();
  updateStatusDot();

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.body.classList.add('reduced-motion');
  }

  ELEMENTS.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

// ==============================================================
// Event Listeners
// ==============================================================

function setupEventListeners() {
  // Send button
  ELEMENTS.sendBtnEl.addEventListener('click', sendMessage);

  // Settings button
  ELEMENTS.settingBtn.addEventListener('click', toggleSettingsModal);

  // Modal close
  ELEMENTS.modalCloseBtn.addEventListener('click', toggleSettingsModal);

  // Save keys
  ELEMENTS.saveKeysBtn.addEventListener('click', saveApiKeys);

  // Close modal on overlay click
  ELEMENTS.settingsModal.addEventListener('click', (e) => {
    if (e.target === ELEMENTS.settingsModal) {
      toggleSettingsModal();
    }
  });

  // Attachments button
  ELEMENTS.attachmentsBtnEl.addEventListener('click', () => {
    ELEMENTS.fileInput.click();
  });

  // File upload - drag and drop
  ELEMENTS.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    ELEMENTS.dropZone.classList.add('dragover');
  });

  ELEMENTS.dropZone.addEventListener('dragleave', () => {
    ELEMENTS.dropZone.classList.remove('dragover');
  });

  ELEMENTS.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    ELEMENTS.dropZone.classList.remove('dragover');
    handleFileDrop(e.dataTransfer.files);
  });

  ELEMENTS.dropZone.addEventListener('click', () => {
    ELEMENTS.fileInput.click();
  });

  ELEMENTS.fileInput.addEventListener('change', (e) => {
    handleFileDrop(e.target.files);
  });

  // Focus input on load
  setTimeout(() => ELEMENTS.messageInput.focus(), 100);
}

// ==============================================================
// Key Management
// ==============================================================

function checkKeysStatus() {
  const hasGoogle = Boolean(STATE.keys.google);
  const hasGroq = Boolean(STATE.keys.groq);
  const hasOpenRouter = Boolean(STATE.keys.openrouter);

  if (hasGoogle || hasGroq || hasOpenRouter) {
    showChatInterface();
  } else {
    hideChatInterface();
    showWelcomeMessage();
  }
}

function showChatInterface() {
  if (ELEMENTS.welcomeMsg) ELEMENTS.welcomeMsg.style.display = 'none';
  if (ELEMENTS.messageInput) ELEMENTS.messageInput.disabled = false;
  if (ELEMENTS.sendBtnEl) ELEMENTS.sendBtnEl.disabled = false;
  if (ELEMENTS.uploadArea) ELEMENTS.uploadArea.style.display = 'block';
}

function hideChatInterface() {
  if (ELEMENTS.welcomeMsg) ELEMENTS.welcomeMsg.style.display = 'block';
  if (ELEMENTS.messageInput) ELEMENTS.messageInput.disabled = true;
  if (ELEMENTS.sendBtnEl) ELEMENTS.sendBtnEl.disabled = true;
  if (ELEMENTS.uploadArea) ELEMENTS.uploadArea.style.display = 'none';
}

function saveApiKeys() {
  const googleKey = ELEMENTS.googleKeyInput.value.trim();
  const groqKey = ELEMENTS.groqKeyInput.value.trim();
  const openrouterKey = ELEMENTS.openrouterKeyInput.value.trim();

  if (!googleKey && !groqKey && !openrouterKey) {
    showToast('Please enter at least one API key.', 'error');
    return;
  }

  STATE.keys.google = googleKey;
  STATE.keys.groq = groqKey;
  STATE.keys.openrouter = openrouterKey;

  localStorage.setItem('farhan-google-key', googleKey);
  localStorage.setItem('farhan-groq-key', groqKey);
  localStorage.setItem('farhan-openrouter-key', openrouterKey);

  updateModelIndicator();
  updateStatusDot();
  showToast('API keys saved successfully!', 'success');
  toggleSettingsModal();
  showChatInterface();
}

// ==============================================================
// Messaging System
// ==============================================================

async function sendMessage() {
  const text = ELEMENTS.messageInput.value.trim();

  if (!text && !STATE.uploadedFile) {
    showToast('Type a message or upload a file first.', 'error');
    ELEMENTS.messageInput.focus();
    return;
  }

  if (STATE.isLoading) return;

  if (!STATE.keys.google && !STATE.keys.groq && !STATE.keys.openrouter) {
    showToast('No API keys configured. Please set up keys in Settings.', 'error');
    toggleSettingsModal();
    return;
  }

  addUserMessage(text || '');
  ELEMENTS.messageInput.value = '';
  const fileToSend = STATE.uploadedFile;
  STATE.uploadedFile = null;
  hideUploadArea();

  showLoading(true);

  try {
    const aiResponse = await getAiResponse(text || 'Analyze the uploaded file', fileToSend);
    addAiMessage(aiResponse.content, aiResponse.metadata);
  } catch (error) {
    console.error('AI response error:', error);
    addAiMessage({
      type: 'error',
      content: 'Sorry, I encountered an error processing your request. Please try again with different API keys or check your key validity.',
      metadata: { error: error.message },
    });
  } finally {
    showLoading(false);
  }
}

// Get AI response with multi-key fallback
async function getAiResponse(message, file = null) {
  const keys = STATE.keys;
  const keyOrder = ['google', 'groq', 'openrouter'];

  for (let attempt = 0; attempt < keyOrder.length; attempt++) {
    const keyName = keyOrder[attempt];
    const apiKey = keys[keyName];

    if (!apiKey) continue;

    try {
      const response = await callApiWithKey(keyName, apiKey, message, file);

      if (response && response.choices && response.choices.length > 0) {
        STATE.currentModel = API_CONFIG[keyName].name;
        updateModelIndicator();
        return {
          content: response.choices[0].message.content,
          metadata: {
            model: keyName,
            service: keyName,
            finishReason: response.choices[0].finish_reason,
          },
        };
      }
    } catch (error) {
      console.log(`${keyName} failed, trying next...`, error.message);
      continue;
    }
  }

  throw new Error('All API keys failed. Please check your keys and try again.');
}

// Call API with a specific key
async function callApiWithKey(keyName, apiKey, message, file = null) {
  const payload = {
    model: API_CONFIG[keyName].model,
    messages: [{ role: 'user', content: message }],
    temperature: 0.7,
  };

  if (file) {
    if (keyName === 'google') {
      // Gemini Vision - use base64 image
      payload.messages = [{
        role: 'user',
        content: [
          { type: 'text', text: message || 'Analyze this image' },
          { type: 'image_url', image_url: { url: `data:${file.mime_type};base64,${file.base64}` } },
        ],
      }];
    } else {
      // Groq and OpenRouter - convert file to text
      const fileText = await fileToText(file);
      payload.messages = [{ role: 'user', content: `${message || 'Analyze this file'}\n\n${fileText}` }];
    }
  }

  let url;
  const headers = { 'Content-Type': 'application/json' };

  switch (keyName) {
    case 'google':
      url = `${API_CONFIG.google.endpoint}?key=${apiKey}`;
      break;
    case 'groq':
      url = API_CONFIG.groq.endpoint;
      headers['Authorization'] = `Bearer ${apiKey}`;
      break;
    case 'openrouter':
      url = API_CONFIG.openrouter.endpoint;
      headers['Authorization'] = `Bearer ${apiKey}`;
      break;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (response.status === 429) {
    const errorText = await response.text();
    throw new Error(`${keyName} rate limit exceeded (429): ${errorText.substring(0, 100)}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${keyName} error ${response.status}: ${errorText.substring(0, 100)}`);
  }

  return response.json();
}

// Convert file to text content
async function fileToText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target.result;
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith('.txt')) {
        resolve(text);
      } else if (fileName.endsWith('.json')) {
        try {
          const parsed = JSON.parse(text);
          resolve(JSON.stringify(parsed, null, 2));
        } catch (e) {
          resolve('Invalid JSON file.');
        }
      } else if (fileName.endsWith('.csv')) {
        try {
          const lines = text.split('\n');
          const headers = lines[0].split(',');
          const rows = lines.slice(1).map(line => {
            const values = line.split(',');
            const row = {};
            headers.forEach((header, i) => {
              row[header.trim()] = values[i] || '';
            });
            return row;
          });
          resolve(JSON.stringify({ headers, rows }, null, 2));
        } catch (e) {
          resolve('Error parsing CSV file.');
        }
      } else if (fileName.endsWith('.js')) {
        const lines = text.split('\n');
        const summary = [
          `File: ${file.name}`,
          `Size: ${text.length} characters`,
          `---`,
          `First 50 lines:`,
          ...lines.slice(0, 50),
          text.length > 50 ? `... (${text.length - 50} more chars)` : '',
        ].join('\n');
        resolve(summary);
      } else {
        resolve(`File: ${file.name}\nType: ${file.mime_type}\nSize: ${text.length} characters\n\nContent:\n${text.substring(0, 2000)}`);
      }
    };

    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

// Handle file drop
function handleFileDrop(files) {
  if (!files || files.length === 0) return;

  const file = files[0];
  const fileName = file.name.toLowerCase();
  const isImage = file.type.startsWith('image/');
  const isText = ['.txt', '.js', '.json', '.csv'].some(ext => fileName.endsWith(ext));

  if (isImage || isText) {
    STATE.uploadedFile = file;

    showUploadArea();

    if (isImage) {
      const reader = new FileReader();
      reader.onload = (e) => {
        STATE.uploadedFile.base64 = e.target.result.split(',')[1];
        STATE.uploadedFile.mime_type = file.type;
        showToast('Image uploaded successfully!', 'success');
      };
      reader.readAsDataURL(file);
    } else {
      showToast('File uploaded successfully!', 'success');
    }
  } else {
    showToast('Unsupported file type. Please upload images, .txt, .js, .json, or .csv files.', 'error');
    ELEMENTS.fileInput.value = '';
  }
}

function showUploadArea() {
  if (ELEMENTS.uploadArea) ELEMENTS.uploadArea.style.display = 'block';
}

function hideUploadArea() {
  if (ELEMENTS.uploadArea) ELEMENTS.uploadArea.style.display = 'none';
}

// ==============================================================
// UI Rendering - Messages
// ==============================================================

function addUserMessage(content) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message user-message';
  messageDiv.innerHTML = `
    <div class="avatar user-avatar">U</div>
    <div>${escapeHtml(content)}</div>
  `;

  messageDiv.style.animation = 'message-in 0.3s ease forwards';
  messageDiv.style.opacity = '0';

  ELEMENTS.chatMessages.appendChild(messageDiv);
  scrollToBottom();

  STATE.messageHistory.push({
    role: 'user',
    content: content,
    timestamp: Date.now(),
  });
}

function addAiMessage(response, metadata = {}) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message ai-message';

  const contentHtml = renderAiResponse(response, metadata);

  messageDiv.innerHTML = `
    <div class="avatar ai-avatar">AI</div>
    <div>${contentHtml}</div>
  `;

  messageDiv.style.animation = 'message-in 0.3s ease forwards';
  messageDiv.style.opacity = '0';

  ELEMENTS.chatMessages.appendChild(messageDiv);
  scrollToBottom();

  STATE.messageHistory.push({
    role: 'assistant',
    content: response,
    metadata: metadata,
    timestamp: Date.now(),
  });
}

function renderAiResponse(response, metadata) {
  if (!response) return '<p>No response.</p>';

  if (response.type === 'error') {
    return `<p style="color: var(--error);">${escapeHtml(response.content)}</p>`;
  }

  const html = markdownToHtml(response);
  const processedHtml = html.replace(/<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g, (match, language, code) => {
    return `
      <div class="code-block" data-language="${language}">
        <pre><code class="language-${language}">${escapeHtml(code)}</code></pre>
        <button class="copy-btn" data-code="${escapeHtml(code)}" aria-label="Copy code">Copy</button>
      </div>
    `;
  });

  // Add copy button event listeners after DOM insertion
  setTimeout(() => {
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.dataset.code);
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Copy', 2000);
      });
    });
  }, 0);

  return processedHtml;
}

function markdownToHtml(markdown) {
  if (!markdown) return '';

  let html = markdown
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>')
    .split('\n')
    .map(line => {
      if (line.startsWith('<') || line.startsWith('>') || line.startsWith('<') || line.startsWith('<!') || line.startsWith('</')) {
        return line;
      }
      return `<p>${line}</p>`;
    })
    .join('');

  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<h[1-3]>.*<\/h[1-3]>|<pre>.*<\/pre>|<div class="code-block">.*<\/div>)<\/p>/gs, '$1');

  return html;
}

function escapeHtml(text) {
  if (typeof text !== 'string') return String(text);
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function scrollToBottom() {
  ELEMENTS.chatMessages.scrollTo({
    top: ELEMENTS.chatMessages.scrollHeight,
    behavior: 'smooth',
  });
}

// ==============================================================
// Loading State
// ==============================================================

function showLoading(show) {
  STATE.isLoading = show;

  if (ELEMENTS.loadingSpinner) {
    if (show) ELEMENTS.loadingSpinner.classList.add('visible');
    else ELEMENTS.loadingSpinner.classList.remove('visible');
  }

  if (ELEMENTS.messageInput) ELEMENTS.messageInput.disabled = show;
  if (ELEMENTS.sendBtnEl) ELEMENTS.sendBtnEl.disabled = show;
}

// ==============================================================
// Toast Notifications
// ==============================================================

function showToast(message, type = 'info') {
  const existingToast = document.querySelector('.toast-notification');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');

  const colors = {
    success: { bg: 'var(--success)', border: 'var(--success)' },
    error: { bg: 'var(--error)', border: 'var(--error)' },
    info: { bg: 'var(--accent)', border: 'var(--accent-glow)' },
  };

  const color = colors[type] || colors.info;

  toast.innerHTML = `
    <div style="
      background: ${color.bg};
      color: white;
      padding: 12px 16px;
      border-radius: 10px;
      border: 1px solid ${color.border};
      margin: 16px 0;
      animation: slideIn 0.3s ease;
      min-width: 200px;
    ">
      ${message}
    </div>
  `;

  if (ELEMENTS.chatMessages) {
    ELEMENTS.chatMessages.insertBefore(toast, ELEMENTS.chatMessages.firstChild);
  }

  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.animation = 'slideOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }
  }, 5000);
}

// ==============================================================
// Settings Modal
// ==============================================================

function toggleSettingsModal() {
  const isActive = ELEMENTS.settingsModal.classList.contains('active');

  if (isActive) {
    ELEMENTS.settingsModal.classList.remove('active');
    ELEMENTS.settingsModal.setAttribute('aria-hidden', 'true');
  } else {
    ELEMENTS.googleKeyInput.value = STATE.keys.google;
    ELEMENTS.groqKeyInput.value = STATE.keys.groq;
    ELEMENTS.openrouterKeyInput.value = STATE.keys.openrouter;

    ELEMENTS.settingsModal.classList.add('active');
    ELEMENTS.settingsModal.setAttribute('aria-hidden', 'false');

    setTimeout(() => ELEMENTS.googleKeyInput.focus(), 100);
  }
}

// ==============================================================
// Model Indicator & Status
// ==============================================================

function updateModelIndicator() {
  if (ELEMENTS.modelIndicator) {
    const availableKeys = Object.entries(STATE.keys).filter(([k, v]) => v);
    if (availableKeys.length > 0) {
      ELEMENTS.modelIndicator.textContent = availableKeys[0][0].charAt(0).toUpperCase() + availableKeys[0][0].slice(1);
      ELEMENTS.modelIndicator.classList.remove('hidden');
    } else {
      ELEMENTS.modelIndicator.classList.add('hidden');
    }
  }
}

function updateStatusDot() {
  if (ELEMENTS.statusDot) {
    const hasKeys = Object.values(STATE.keys).some(k => k);
    ELEMENTS.statusDot.style.background = hasKeys ? 'var(--success)' : 'var(--error)';
  }
}

function showWelcomeMessage() {
  if (ELEMENTS.welcomeMsg) {
    ELEMENTS.welcomeMsg.style.display = 'block';
  }
}

// ==============================================================
// PWA Support
// ==============================================================

function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('SW registered:', reg))
      .catch(err => console.log('SW registration failed:', err));
  }
}

initPWA();

// ==============================================================
// Console welcome
console.log('%cFarhan Jawed - AI Agent%c ✨', 'color: #3b82f6; font-size: 16px; font-weight: 700;', 'color: var(--fg); font-size: 14px;');
console.log('%c100% Client-Side PWA | Multi-Key Fallback System%c', 'color: var(--muted);', 'color: var(--fg);');
console.log('%cAPI Fallback Order: Google Gemini → Groq → OpenRouter%c', 'color: var(--muted);', 'color: var(--fg);');
