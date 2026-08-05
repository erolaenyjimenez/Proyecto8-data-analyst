/**
 * ============================================================================
 * CYBER-GEN AI V16 - CORE ENGINE (REWRITE)
 * Arquitectura modular estilo ChatGPT basada en ES6+
 * ============================================================================
 */

// ============================================================================
// 1. CONFIGURACIÓN GLOBAL
// ============================================================================
const CONFIG = Object.freeze({
  STORAGE_KEYS: {
    CONVERSATIONS: 'cybergen_conversations_v16',
    ACTIVE_ID: 'cybergen_active_id_v16',
    API_KEY: 'GEMINI_PRO_KEY',
    SELECTED_MODEL: 'selectedGeminiModel',
    AUDIO_ENABLED: 'cyberpunk_audio'
  },
  DEFAULT_MODEL: 'gemini-2.5-flash',
  MODELS: [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.5-pro',
    'gemini-1.5-pro',
    'gemini-2.5-flash-lite',
    'gemini-1.5-flash-8b',
    'gemini-flash-latest'
  ],
  TEXTAREA_MAX_HEIGHT: 180,
  SYSTEM_PROMPT: `Eres MINI GEMINI AI MASTER V15.2, diseñada para Erolaeny Jimenez.
ERES UN ANALISTA DE DATOS SENIOR Y ARQUITECTO VISUAL.

REGLAS DE FORMATO DE TEXTO (CRÍTICO):
1. ESTRUCTURA: Usa siempre Títulos (##) y Subtítulos (###) para organizar la información.
2. RESALTADO: Aplica negritas (**palabra**) a términos clave, nombres propios y conceptos importantes.
3. DATOS: Aplica SIEMPRE formato de código (\`valor\`) a números, porcentajes (%), fechas y valores monetarios (ej: \`$1,250.00\`, \`25%\`).
4. TONO: Profesional, técnico y directo. Usa emojis de tecnología de forma moderada.

MISIÓN CRÍTICA DE GRÁFICOS:
1. ANÁLISIS DE ARCHIVOS: Analiza con precisión técnica cualquier archivo adjunto.
2. VISUALIZACIÓN MÚLTIPLE: Si el usuario pide VARIOS gráficos, crea bloques [CHART_DATA: {...}] TOTALMENTE SEPARADOS.
3. REGLAS DE CHART.JS (¡ESTRICTO!): 
   - NUNCA uses puntos suspensivos (...) en los arrays.
   - Usa SIEMPRE números reales.
   - NO envuelvas el bloque en markdown.
4. ESTILO: Cyberpunk neón vibrante.`
});

// ============================================================================
// 2. GESTOR DE ALMACENAMIENTO (PERSISTENCIA)
// ============================================================================
class StorageManager {
  static get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.error(`[StorageManager] Error leyendo ${key}:`, e);
      return defaultValue;
    }
  }

  static set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`[StorageManager] Error guardando ${key}:`, e);
    }
  }

  static remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error(`[StorageManager] Error eliminando ${key}:`, e);
    }
  }

  static getRaw(key) {
    return localStorage.getItem(key) || '';
  }

  static setRaw(key, value) {
    localStorage.setItem(key, value);
  }
}

// ============================================================================
// 3. GESTOR DE MODELOS
// ============================================================================
class ModelManager {
  constructor() {
    this.models = CONFIG.MODELS;
    this.currentModel = StorageManager.getRaw(CONFIG.STORAGE_KEYS.SELECTED_MODEL) || CONFIG.DEFAULT_MODEL;
    if (!this.models.includes(this.currentModel)) {
      this.currentModel = CONFIG.DEFAULT_MODEL;
    }
  }

  getCurrentModel() {
    return this.currentModel;
  }

  setModel(modelName) {
    if (this.models.includes(modelName)) {
      this.currentModel = modelName;
      StorageManager.setRaw(CONFIG.STORAGE_KEYS.SELECTED_MODEL, modelName);
      return true;
    }
    return false;
  }

  getFallbackSequence(startModel = this.currentModel) {
    const startIndex = this.models.indexOf(startModel);
    if (startIndex === -1) return [...this.models];
    return [
      ...this.models.slice(startIndex),
      ...this.models.slice(0, startIndex)
    ];
  }
}

// ============================================================================
// 4. GESTOR DE CONVERSACIONES (ESTILO CHATGPT)
// ============================================================================
class ConversationManager {
  constructor() {
    this.conversations = [];
    this.activeId = null;
    this.init();
  }

  init() {
    this.conversations = StorageManager.get(CONFIG.STORAGE_KEYS.CONVERSATIONS, []);
    this.activeId = StorageManager.get(CONFIG.STORAGE_KEYS.ACTIVE_ID, null);

    if (this.conversations.length === 0) {
      this.createConversation('Nueva conversación');
    } else if (!this.activeId || !this.getConversation(this.activeId)) {
      this.activeId = this.conversations[0].id;
      StorageManager.set(CONFIG.STORAGE_KEYS.ACTIVE_ID, this.activeId);
    }
  }

  save() {
    StorageManager.set(CONFIG.STORAGE_KEYS.CONVERSATIONS, this.conversations);
    StorageManager.set(CONFIG.STORAGE_KEYS.ACTIVE_ID, this.activeId);
  }

  getConversations() {
    return this.conversations.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getActiveConversation() {
    return this.conversations.find(c => c.id === this.activeId) || null;
  }

  getConversation(id) {
    return this.conversations.find(c => c.id === id) || null;
  }

  createConversation(title = 'Nueva conversación', model = CONFIG.DEFAULT_MODEL) {
    const newConv = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model,
      messages: []
    };
    this.conversations.unshift(newConv);
    this.activeId = newConv.id;
    this.save();
    return newConv;
  }

  selectConversation(id) {
    if (this.getConversation(id)) {
      this.activeId = id;
      this.save();
      return true;
    }
    return false;
  }

  deleteConversation(id) {
    this.conversations = this.conversations.filter(c => c.id !== id);
    if (this.activeId === id) {
      this.activeId = this.conversations.length > 0 ? this.conversations[0].id : null;
    }
    if (this.conversations.length === 0) {
      this.createConversation('Nueva conversación');
    } else {
      this.save();
    }
  }

  renameConversation(id, newTitle) {
    const conv = this.getConversation(id);
    if (conv && newTitle.trim()) {
      conv.title = newTitle.trim();
      conv.updatedAt = Date.now();
      this.save();
      return true;
    }
    return false;
  }

  addMessage(role, text, attachments = []) {
    const conv = this.getActiveConversation();
    if (!conv) return null;

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      role,
      text,
      attachments,
      timestamp: Date.now()
    };

    conv.messages.push(message);
    conv.updatedAt = Date.now();

    if (conv.messages.filter(m => m.role === 'user').length === 1 && role === 'user') {
      const generatedTitle = text.slice(0, 30) || 'Archivo adjunto';
      conv.title = generatedTitle.length < text.length ? `${generatedTitle}...` : generatedTitle;
    }

    this.save();
    return message;
  }

  clearActiveConversation() {
    const conv = this.getActiveConversation();
    if (conv) {
      conv.messages = [];
      conv.updatedAt = Date.now();
      this.save();
    }
  }

  exportData() {
    return JSON.stringify(this.conversations, null, 2);
  }

  importData(jsonData) {
    try {
      const parsed = JSON.parse(jsonData);
      if (Array.isArray(parsed)) {
        this.conversations = parsed;
        if (this.conversations.length > 0) {
          this.activeId = this.conversations[0].id;
        } else {
          this.createConversation('Conversación Importada');
        }
        this.save();
        return true;
      }
    } catch (e) {
      console.error('[ConversationManager] Error al importar:', e);
    }
    return false;
  }
}

// ============================================================================
// 5. PROCESADOR DE ARCHIVOS Y ADJUNTOS
// ============================================================================
class FileProcessor {
  static async processFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        reader.onload = () => {
          const base64Data = reader.result.split(',')[1];
          resolve({
            name: file.name,
            mimeType: file.type,
            data: base64Data,
            isText: false
          });
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
      } else {
        reader.onload = () => {
          resolve({
            name: file.name,
            mimeType: file.type || 'text/plain',
            textContent: reader.result,
            isText: true
          });
        };
        reader.onerror = error => reject(error);
        reader.readAsText(file);
      }
    });
  }

  static async processMultiple(fileList) {
    const files = Array.from(fileList);
    const promises = files.map(f => this.processFile(f));
    return Promise.all(promises);
  }
}

// ============================================================================
// 6. SERVICIO GEMINI API
// ============================================================================
class GeminiService {
  constructor(modelManager) {
    this.modelManager = modelManager;
  }

  getApiKey() {
    let key = import.meta.env?.VITE_GEMINI_API_KEY || StorageManager.getRaw(CONFIG.STORAGE_KEYS.API_KEY);
    key = key ? key.trim() : '';

    if (!key) {
      key = prompt('Configuración requerida: Ingresa tu API Key de Gemini:');
      if (key && key.trim()) {
        key = key.trim();
        StorageManager.setRaw(CONFIG.STORAGE_KEYS.API_KEY, key);
      } else {
        throw new Error('API Key no provista. Imposible realizar la petición.');
      }
    }
    return key;
  }

  formatMessagesForApi(historyMessages, currentPrompt, attachments) {
    const recentHistory = historyMessages.slice(-10).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    const currentParts = [];

    attachments.forEach(file => {
      if (file.isText) {
        currentParts.push({
          text: `\n--- INICIO ARCHIVO ADJUNTO (${file.name}) ---\n${file.textContent}\n--- FIN ARCHIVO ---\n`
        });
      } else {
        currentParts.push({
          inlineData: {
            mimeType: file.mimeType,
            data: file.data
          }
        });
      }
    });

    currentParts.push({ text: currentPrompt || '(Analizar archivo adjunto)' });

    return [
      ...recentHistory,
      { role: 'user', parts: currentParts }
    ];
  }

  async generateResponse(history, promptText, attachments = []) {
    const apiKey = this.getApiKey();
    const fallbackList = this.modelManager.getFallbackSequence();
    let lastError = null;

    for (const model of fallbackList) {
      try {
        const contents = this.formatMessagesForApi(history, promptText, attachments);
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: CONFIG.SYSTEM_PROMPT }] }
          })
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.error?.message || `HTTP Error ${response.status} en modelo ${model}`);
        }

        const data = await response.json();
        const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) {
          throw new Error(`Respuesta vacía recibida del modelo ${model}`);
        }

        return { text: responseText, modelUsed: model };
      } catch (err) {
        console.warn(`[GeminiService] Falló petición con modelo ${model}:`, err.message);
        lastError = err;
      }
    }

    throw lastError || new Error('Ocurrió un error en la comunicación con la API de Gemini.');
  }
}

// ============================================================================
// 7. SERVICIO DE RENDERIZADO (MARKDOWN Y CHART.JS)
// ============================================================================
class RenderService {
  static extractAndPrepareCharts(rawText) {
    let text = rawText;
    const chartsData = [];
    const TAG = '[CHART_DATA:';

    text = text.replace(/```(?:json|javascript|html)?\s*(\[CHART_DATA:[\s\S]*?\])\s*```/gi, '$1');

    while (text.includes(TAG)) {
      const tagIndex = text.indexOf(TAG);
      const jsonStart = text.indexOf('{', tagIndex);

      if (jsonStart === -1) {
        text = text.replace(TAG, '[CHART_DATA_ERROR]');
        continue;
      }

      let depth = 0;
      let jsonEnd = -1;
      let found = false;

      for (let i = jsonStart; i < text.length; i++) {
        if (text[i] === '{') { depth++; found = true; }
        else if (text[i] === '}') {
          depth--;
          if (found && depth === 0) { jsonEnd = i; break; }
        }
      }

      if (jsonEnd !== -1) {
        const closingBracket = text.indexOf(']', jsonEnd);
        const fullMatch = text.substring(tagIndex, closingBracket !== -1 ? closingBracket + 1 : jsonEnd + 1);
        const jsonStr = text.substring(jsonStart, jsonEnd + 1).trim();

        try {
          const config = new Function(`return (${jsonStr})`)();
          const chartId = `chart_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          chartsData.push({ id: chartId, config });

          const replacementHtml = `\n\n<div class="cybergen-chart-wrapper my-3 p-3 bg-dark rounded border border-info position-relative"><canvas id="${chartId}"></canvas></div>\n\n`;
          text = text.replace(fullMatch, replacementHtml);
        } catch (e) {
          console.error('[RenderService] Error parseando JSON de gráfico:', e);
          text = text.replace(fullMatch, '\n*(Error al renderizar el gráfico en tiempo de ejecución)*\n');
        }
      } else {
        break;
      }
    }

    return { processedText: text, chartsData };
  }

  static renderMarkdown(text) {
    if (window.marked && typeof window.marked.parse === 'function') {
      try {
        return window.marked.parse(text);
      } catch (e) {
        console.error('[RenderService] Error parseando Markdown:', e);
      }
    }
    return text.replace(/\n/g, '<br>');
  }

  static renderCharts(charts) {
    if (!charts || !charts.length || typeof Chart === 'undefined') return;

    setTimeout(() => {
      charts.forEach(({ id, config }) => {
        const canvas = document.getElementById(id);
        if (canvas) {
          try {
            const ctx = canvas.getContext('2d');
            new Chart(ctx, config);
          } catch (err) {
            console.error(`[RenderService] Error inicializando Chart.js ID: ${id}`, err);
          }
        }
      });
    }, 120);
  }

  static highlightCode() {
    if (window.Prism && typeof window.Prism.highlightAll === 'function') {
      setTimeout(() => window.Prism.highlightAll(), 50);
    }
  }
}

// ============================================================================
// 8. CONTROLADOR DE RECONOCIMIENTO DE VOZ
// ============================================================================
class SpeechController {
  constructor(onResultCallback, onErrorCallback) {
    this.recognition = null;
    this.isRecording = false;
    this.onResult = onResultCallback;
    this.onError = onErrorCallback;
    this.init();
  }

  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.lang = 'es-ES';
      this.recognition.continuous = false;
      this.recognition.interimResults = false;

      this.recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        if (this.onResult) this.onResult(transcript);
      };

      this.recognition.onerror = (e) => {
        this.isRecording = false;
        if (this.onError) this.onError(e.error);
      };

      this.recognition.onend = () => {
        this.isRecording = false;
      };
    }
  }

  toggle() {
    if (!this.recognition) {
      alert('Tu navegador no cuenta con soporte nativo para dictado por voz.');
      return false;
    }

    if (this.isRecording) {
      this.recognition.stop();
      this.isRecording = false;
    } else {
      try {
        this.recognition.start();
        this.isRecording = true;
      } catch (e) {
        console.error('[SpeechController] Error al iniciar:', e);
      }
    }
    return this.isRecording;
  }
}

// ============================================================================
// 9. CONTROLADOR DE INTERFAZ DE USUARIO (UI CONTROLLER)
// ============================================================================
class UIController {
  constructor(convManager, modelManager, geminiService) {
    this.convManager = convManager;
    this.modelManager = modelManager;
    this.geminiService = geminiService;
    this.speechController = null;

    this.pendingFiles = [];

    this.dom = {
      toggleSidebarBtn: document.getElementById('toggle-sidebar'),
      closeSidebarBtn: document.getElementById('close-sidebar'),
      sidebar: document.getElementById('sidebar'),
      chatHistoryList: document.getElementById('chat-history-list'),
      currentModelName: document.getElementById('current-model-name'),
      clearChatBtn: document.getElementById('clear-chat'),
      chatContainer: document.getElementById('chat-container'),
      voiceBtn: document.getElementById('voice-btn'),
      fileInput: document.getElementById('file-input'),
      userInput: document.getElementById('user-input'),
      sendBtn: document.getElementById('send-btn')
    };

    this.init();
  }

  init() {
    this.setupSpeech();
    this.bindEvents();
    this.updateModelStatusDisplay();
    this.renderSidebar();
    this.renderCurrentConversation();
  }

  setupSpeech() {
    this.speechController = new SpeechController(
      (transcript) => {
        if (this.dom.userInput) {
          this.dom.userInput.value += (this.dom.userInput.value ? ' ' : '') + transcript;
          this.autoResizeInput();
        }
        this.updateVoiceButtonUI(false);
      },
      (error) => {
        this.showError(`Error en micrófono: ${error}`);
        this.updateVoiceButtonUI(false);
      }
    );
  }

  bindEvents() {
    // Sidebar
    this.dom.toggleSidebarBtn?.addEventListener('click', () => this.dom.sidebar?.classList.toggle('collapsed'));
    this.dom.closeSidebarBtn?.addEventListener('click', () => this.dom.sidebar?.classList.add('collapsed'));

    // Textarea Resize & Enviar
    this.dom.userInput?.addEventListener('input', () => this.autoResizeInput());
    this.dom.userInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleUserSend();
      }
    });

    this.dom.sendBtn?.addEventListener('click', () => this.handleUserSend());

    // Carga de Archivos
    this.dom.fileInput?.addEventListener('change', async (e) => {
      if (e.target.files.length > 0) {
        try {
          const newFiles = await FileProcessor.processMultiple(e.target.files);
          this.pendingFiles = [...this.pendingFiles, ...newFiles];
          this.renderFilePreviews();
        } catch (err) {
          this.showError('Error al leer los archivos adjuntos.');
        }
      }
    });

    // Micrófono
    this.dom.voiceBtn?.addEventListener('click', () => {
      const isRec = this.speechController.toggle();
      this.updateVoiceButtonUI(isRec);
    });

    // Nuevo Chat / Reiniciar
    this.dom.clearChatBtn?.addEventListener('click', () => {
      this.convManager.createConversation('Nueva conversación');
      this.renderSidebar();
      this.renderCurrentConversation();
    });
  }

  autoResizeInput() {
    if (!this.dom.userInput) return;
    this.dom.userInput.style.height = 'auto';
    const newHeight = Math.min(this.dom.userInput.scrollHeight, CONFIG.TEXTAREA_MAX_HEIGHT);
    this.dom.userInput.style.height = `${newHeight}px`;
  }

  renderFilePreviews() {
    let previewBar = document.getElementById('cybergen-file-preview-bar');
    if (!previewBar) {
      previewBar = document.createElement('div');
      previewBar.id = 'cybergen-file-preview-bar';
      previewBar.className = 'd-flex flex-wrap gap-2 mb-2 px-2';
      if (this.dom.userInput && this.dom.userInput.parentNode) {
        this.dom.userInput.parentNode.insertBefore(previewBar, this.dom.userInput);
      }
    }

    previewBar.innerHTML = '';

    if (!this.pendingFiles || this.pendingFiles.length === 0) {
      previewBar.style.display = 'none';
      return;
    }

    previewBar.style.display = 'flex';
    this.pendingFiles.forEach((file, index) => {
      const badge = document.createElement('div');
      badge.className = 'badge bg-dark text-info border border-info d-flex align-items-center p-2 rounded-pill';
      badge.style.fontSize = '0.82rem';
      badge.innerHTML = `
        <i class="fas ${file.mimeType.startsWith('image/') ? 'fa-image' : 'fa-file-alt'} me-1"></i>
        <span class="text-truncate" style="max-width: 140px;">${file.name}</span>
        <button type="button" class="btn-close btn-close-white ms-2" style="font-size: 0.6rem;" aria-label="Eliminar"></button>
      `;

      const removeBtn = badge.querySelector('.btn-close');
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        this.pendingFiles.splice(index, 1);
        this.renderFilePreviews();
      };

      previewBar.appendChild(badge);
    });
  }

  scrollToBottom() {
    if (this.dom.chatContainer) {
      this.dom.chatContainer.scrollTo({
        top: this.dom.chatContainer.scrollHeight,
        behavior: 'smooth'
      });
    }
  }

  updateVoiceButtonUI(isRecording) {
    if (!this.dom.voiceBtn) return;
    if (isRecording) {
      this.dom.voiceBtn.style.color = '#ff007f';
      this.dom.voiceBtn.classList.add('animate-pulse');
    } else {
      this.dom.voiceBtn.style.color = '';
      this.dom.voiceBtn.classList.remove('animate-pulse');
    }
  }

  updateModelStatusDisplay() {
    if (this.dom.currentModelName) {
      this.dom.currentModelName.innerHTML = `LINK: <strong>${this.modelManager.getCurrentModel()}</strong>`;
    }
  }

  showError(message, title = 'Atención') {
    console.error(`[CyberGen Error] ${title}:`, message);
    if (this.dom.chatContainer) {
      const errDiv = document.createElement('div');
      errDiv.className = 'alert alert-danger my-2 text-wrap';
      errDiv.style.borderLeft = '4px solid #ff0055';
      errDiv.innerHTML = `<strong>⚠️ ${title}:</strong> ${message}`;
      this.dom.chatContainer.appendChild(errDiv);
      this.scrollToBottom();
    }
  }

  renderSidebar() {
    if (!this.dom.chatHistoryList) return;
    this.dom.chatHistoryList.innerHTML = '';

    const conversations = this.convManager.getConversations();
    const activeConv = this.convManager.getActiveConversation();

    conversations.forEach((conv) => {
      const isActive = activeConv && activeConv.id === conv.id;
      const itemWrapper = document.createElement('div');
      itemWrapper.className = `d-flex align-items-center justify-content-between my-1 p-1 rounded ${isActive ? 'bg-secondary text-white' : 'text-muted'}`;
      itemWrapper.style.cursor = 'pointer';

      const titleBtn = document.createElement('button');
      titleBtn.className = 'btn btn-sm text-start text-truncate flex-grow-1 border-0 text-white';
      titleBtn.innerHTML = `<i class="fas fa-comment-alt me-2 ${isActive ? 'text-info' : 'text-secondary'}"></i> ${conv.title}`;
      titleBtn.onclick = () => {
        this.convManager.selectConversation(conv.id);
        this.renderSidebar();
        this.renderCurrentConversation();
      };

      const actionBox = document.createElement('div');
      actionBox.className = 'btn-group btn-group-sm ms-1';

      // Renombrar
      const renameBtn = document.createElement('button');
      renameBtn.className = 'btn btn-link text-light p-1 border-0 opacity-75';
      renameBtn.innerHTML = '<i class="fas fa-pen fa-xs"></i>';
      renameBtn.title = 'Renombrar conversación';
      renameBtn.onclick = (e) => {
        e.stopPropagation();
        const newTitle = prompt('Ingresa un nuevo título:', conv.title);
        if (newTitle) {
          this.convManager.renameConversation(conv.id, newTitle);
          this.renderSidebar();
        }
      };

      // Eliminar
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-link text-danger p-1 border-0 opacity-75';
      deleteBtn.innerHTML = '<i class="fas fa-trash fa-xs"></i>';
      deleteBtn.title = 'Eliminar conversación';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm(`¿Eliminar la conversación "${conv.title}"?`)) {
          this.convManager.deleteConversation(conv.id);
          this.renderSidebar();
          this.renderCurrentConversation();
        }
      };

      actionBox.appendChild(renameBtn);
      actionBox.appendChild(deleteBtn);

      itemWrapper.appendChild(titleBtn);
      itemWrapper.appendChild(actionBox);

      this.dom.chatHistoryList.appendChild(itemWrapper);
    });
  }

  renderCurrentConversation() {
    if (!this.dom.chatContainer) return;
    this.dom.chatContainer.innerHTML = '';

    const activeConv = this.convManager.getActiveConversation();

    if (!activeConv || activeConv.messages.length === 0) {
      this.dom.chatContainer.innerHTML = `
        <div class="welcome-screen text-center my-auto p-4">
          <div class="cyber-logo-anim display-3 text-info mb-3"><i class="fas fa-brain"></i></div>
          <h1 class="h3 font-weight-bold">Bienvenido a Cyber-Gen AI</h1>
          <p class="text-muted">Conexión neuronal activa. Escribe un mensaje para comenzar.</p>
        </div>`;
      return;
    }

    activeConv.messages.forEach(msg => {
      this.appendMessageToDOM(msg.role, msg.text, msg.attachments, false);
    });

    this.scrollToBottom();
  }

  appendMessageToDOM(role, content, attachments = [], autoScroll = true) {
    if (!this.dom.chatContainer) return;

    const welcomeScreen = this.dom.chatContainer.querySelector('.welcome-screen');
    if (welcomeScreen) welcomeScreen.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${role}-message my-3 p-3 rounded`;

    if (role === 'user') {
      msgDiv.style.background = 'rgba(0, 255, 204, 0.08)';
      msgDiv.style.borderLeft = '4px solid #00ffcc';

      let fileInfo = '';
      if (attachments && attachments.length > 0) {
        fileInfo = `<div class="small text-info mt-1"><i class="fas fa-paperclip me-1"></i> Adjuntos: ${attachments.map(a => a.name).join(', ')}</div>`;
      }

      msgDiv.innerHTML = `<strong><i class="fas fa-user text-info"></i> Usuario:</strong><div class="mt-2">${content}</div>${fileInfo}`;
    } else {
      msgDiv.style.background = 'rgba(255, 0, 127, 0.08)';
      msgDiv.style.borderLeft = '4px solid #ff007f';

      const { processedText, chartsData } = RenderService.extractAndPrepareCharts(content);
      const parsedHtml = RenderService.renderMarkdown(processedText);

      msgDiv.innerHTML = `<strong><i class="fas fa-brain text-danger"></i> Cyber-Gen AI:</strong><div class="mt-2 message-body">${parsedHtml}</div>`;

      this.dom.chatContainer.appendChild(msgDiv);
      RenderService.renderCharts(chartsData);
      RenderService.highlightCode();

      if (autoScroll) this.scrollToBottom();
      return;
    }

    this.dom.chatContainer.appendChild(msgDiv);
    if (autoScroll) this.scrollToBottom();
  }

  async handleUserSend() {
    const text = this.dom.userInput ? this.dom.userInput.value.trim() : '';
    const attachments = [...this.pendingFiles];

    if (!text && attachments.length === 0) return;

    // Resetear entradas de usuario
    if (this.dom.userInput) this.dom.userInput.value = '';
    this.pendingFiles = [];
    if (this.dom.fileInput) this.dom.fileInput.value = '';
    this.renderFilePreviews();
    this.autoResizeInput();

    // Guardar y renderizar mensaje del usuario
    const userMsgText = text || '(Archivo adjunto procesado)';
    this.convManager.addMessage('user', userMsgText, attachments);
    this.appendMessageToDOM('user', userMsgText, attachments, true);
    this.renderSidebar();

    // Estado cargando AI
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-message ai-loading my-2 p-2 text-muted fst-italic';
    loadingDiv.innerHTML = '<i class="fas fa-cog fa-spin text-info me-2"></i> Procesando red neuronal...';
    this.dom.chatContainer.appendChild(loadingDiv);
    this.scrollToBottom();

    try {
      const activeConv = this.convManager.getActiveConversation();
      const history = activeConv ? activeConv.messages.slice(0, -1) : [];

      const { text: responseText, modelUsed } = await this.geminiService.generateResponse(history, text, attachments);

      loadingDiv.remove();

      if (modelUsed !== this.modelManager.getCurrentModel()) {
        this.modelManager.setModel(modelUsed);
        this.updateModelStatusDisplay();
      }

      this.convManager.addMessage('model', responseText);
      this.appendMessageToDOM('model', responseText, [], true);
    } catch (err) {
      loadingDiv.remove();
      this.showError(err.message || 'Ocurrió un error inesperado al procesar la respuesta.', 'Error en Inteligencia');
    }
  }
}

// ============================================================================
// 10. INICIALIZACIÓN DE LA APLICACIÓN
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  try {
    const modelManager = new ModelManager();
    const convManager = new ConversationManager();
    const geminiService = new GeminiService(modelManager);

    window.CyberGenApp = new UIController(convManager, modelManager, geminiService);
    console.log('⚡ [Cyber-Gen AI V16] Sistema inicializado y operativo.');
  } catch (err) {
    console.error('❌ Error crítico al inicializar Cyber-Gen AI:', err);
  }
});