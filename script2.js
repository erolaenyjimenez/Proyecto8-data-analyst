// ====================== SCRIPT2.JS - CYBER-GEN V15.2 ======================
// Desarrollado para Erolaeny Jimenez - Núcleo de Inteligencia Cyber-Gen

const MODELS_LIST = [
  // Nivel 1: Modelos Flash Principales (Rápidos, eficientes y recomendados para la mayoría de tareas)
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",

  // Nivel 2: Modelos Pro de Respaldo (Mayor razonamiento, programación y análisis denso)
  "gemini-2.5-pro",
  "gemini-1.5-pro",

  // Nivel 3: Modelos Lite Ultrarrápidos (Respuestas instantáneas y tareas sencillas)
  "gemini-2.5-flash-lite",
  "gemini-1.5-flash-8b",

  // Nivel 4: Último recurso (Alias automático al último Flash activo)
  "gemini-flash-latest"
];

const SYSTEM_PROMPT = `Eres MINI GEMINI AI MASTER V15.2, diseñada para Erolaeny Jimenez.
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
4. ESTILO: Cyberpunk neón vibrante.`;

// --- CONFIGURACIÓN DE API KEY ---
let rawKey = import.meta.env?.VITE_GEMINI_API_KEY || localStorage.getItem("GEMINI_PRO_KEY") || "";
let API_KEY = rawKey.trim();

// --- MEMORIA Y ESTADO ---
let globalHistory = [];
try { globalHistory = JSON.parse(localStorage.getItem('cyberpunk_history_v15')) || []; } catch(e) { globalHistory = []; }
let currentSessionStartIndex = globalHistory.length; 

let uploadedFilesData = [];
let selectedModel = localStorage.getItem("selectedGeminiModel") || MODELS_LIST[0];
let isAudioEnabled = localStorage.getItem("cyberpunk_audio") !== "false"; 

// --- REFERENCIAS AL DOM (Coincidentes exactamente con index.html) ---
const toggleSidebarBtn  = document.getElementById('toggle-sidebar');
const closeSidebarBtn   = document.getElementById('close-sidebar');
const sidebar           = document.getElementById('sidebar');
const chatHistoryList   = document.getElementById('chat-history-list');
const currentModelName  = document.getElementById('current-model-name');
const clearChatBtn      = document.getElementById('clear-chat');
const chatContainer     = document.getElementById('chat-container');
const voiceBtn          = document.getElementById('voice-btn');
const fileInput         = document.getElementById('file-input');
const userInput         = document.getElementById('user-input');
const sendBtn           = document.getElementById('send-btn');

// --- INICIALIZACIÓN ---
function initApp() {
    updateModelStatusUI();
    renderHistorySidebar();
    renderChatHistory();
    setupEventListeners();
    ajustarInput();
}

function updateModelStatusUI() {
    if (currentModelName) {
        currentModelName.innerHTML = `LINK: <strong>${selectedModel}</strong>`;
    }
}

// --- AJUSTE DE ALTURA DEL TEXTAREA ---
function ajustarInput() {
    if (!userInput) return;
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 150) + 'px';
}

// --- PROCESAMIENTO DE MARKDOWN Y GRÁFICOS ---
function procesarEstructuraVisual(text) {
    let processedText = text;
    let extractedConfigs = [];
    processedText = processedText.replace(/```(?:json|javascript|html)?\s*(\[CHART_DATA:[\s\S]*?\])\s*```/gi, '$1');
    const TAG = '[CHART_DATA:';

    while (processedText.includes(TAG)) {
        let tagIndex = processedText.indexOf(TAG);
        let jsonStart = processedText.indexOf('{', tagIndex);
        if (jsonStart === -1) { 
            processedText = processedText.replace(TAG, '[CHART_DATA_INVALIDO]'); 
            continue; 
        }

        let depth = 0; let jsonEnd = -1; let found = false;
        for (let i = jsonStart; i < processedText.length; i++) {
            if (processedText[i] === '{') { depth++; found = true; }
            else if (processedText[i] === '}') { depth--; if (found && depth === 0) { jsonEnd = i; break; } }
        }

        if (jsonEnd !== -1) {
            let closingBracket = processedText.indexOf(']', jsonEnd);
            let fullMatch = processedText.substring(tagIndex, closingBracket + 1);
            let jsonStr = processedText.substring(jsonStart, jsonEnd + 1).trim();
            try {
                const config = new Function(`return (${jsonStr})`)();
                const cid = `chart-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                extractedConfigs.push({ id: cid, config });
                processedText = processedText.replace(fullMatch, `\n\n<div class="my-3 p-2 bg-dark rounded border border-info"><canvas id="${cid}"></canvas></div>\n\n`);
            } catch (e) { 
                processedText = processedText.replace(fullMatch, ' *(Error al formatear gráfico)* '); 
            }
        } else {
            break;
        }
    }

    let parsedHtml = (window.marked && typeof window.marked.parse === 'function') 
        ? window.marked.parse(processedText) 
        : processedText.replace(/\n/g, '<br>');

    return { html: parsedHtml, charts: extractedConfigs };
}

function renderCharts(charts) {
    if (!charts || !charts.length || typeof Chart === 'undefined') return;
    setTimeout(() => {
        charts.forEach(({ id, config }) => {
            const canvas = document.getElementById(id);
            if (canvas) {
                const ctx = canvas.getContext('2d');
                new Chart(ctx, config);
            }
        });
    }, 100);
}

// --- RENDERIZADO DE MENSAJES EN CHAT ---
function appendMessage(role, content) {
    if (!chatContainer) return;

    // Remover la pantalla de bienvenida si está presente
    const welcomeScreen = chatContainer.querySelector('.welcome-screen');
    if (welcomeScreen) welcomeScreen.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${role}-message my-3 p-3 rounded`;

    if (role === 'user') {
        msgDiv.style.background = 'rgba(0, 255, 204, 0.08)';
        msgDiv.style.borderLeft = '4px solid #00ffcc';
        msgDiv.innerHTML = `<strong><i class="fas fa-user text-info"></i> Usuario:</strong><div class="mt-2">${content}</div>`;
    } else {
        msgDiv.style.background = 'rgba(255, 0, 127, 0.08)';
        msgDiv.style.borderLeft = '4px solid #ff007f';
        
        const { html, charts } = procesarEstructuraVisual(content);
        msgDiv.innerHTML = `<strong><i class="fas fa-brain text-danger"></i> Cyber-Gen AI:</strong><div class="mt-2 message-body">${html}</div>`;
        
        chatContainer.appendChild(msgDiv);
        renderCharts(charts);
        
        // Re-sintetizar código fuente con PrismJS
        if (window.Prism) window.Prism.highlightAll();

        chatContainer.scrollTop = chatContainer.scrollHeight;
        return;
    }

    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function renderChatHistory() {
    if (!chatContainer) return;
    const sessionItems = globalHistory.slice(currentSessionStartIndex);
    if (sessionItems.length > 0) {
        chatContainer.innerHTML = '';
        sessionItems.forEach(item => appendMessage(item.role, item.text));
    }
}

function renderHistorySidebar() {
    if (!chatHistoryList) return;
    chatHistoryList.innerHTML = '';
    
    globalHistory.forEach((item, index) => {
        if (item.role === 'user') {
            const btn = document.createElement('button');
            btn.className = 'nav-item w-100 text-start text-truncate my-1 btn btn-sm btn-outline-secondary border-0';
            btn.style.color = '#ccc';
            btn.innerHTML = `<i class="fas fa-arrow-right me-2"></i> ${item.text}`;
            chatHistoryList.appendChild(btn);
        }
    });
}

// --- LLAMADA A LA API DE GEMINI ---
async function executeModelFallback(promptText, files = [], index = 0) {
    if (!API_KEY) {
        API_KEY = prompt("Ingresa tu Gemini API Key para continuar:");
        if (API_KEY) {
            localStorage.setItem("GEMINI_PRO_KEY", API_KEY);
        } else {
            throw new Error("Se requiere una API Key para funcionar.");
        }
    }

    const model = MODELS_LIST[index] || MODELS_LIST[0]; 
    let sessionCtx = globalHistory.slice(currentSessionStartIndex).map(h => ({ 
        role: h.role === 'user' ? 'user' : 'model', 
        parts: [{ text: h.text }] 
    })).slice(-8);

    let userParts = [];
    if (files && files.length > 0) {
        files.forEach(file => {
            userParts.push({
                inlineData: {
                    mimeType: file.mimeType,
                    data: file.data
                }
            });
        });
    }
    userParts.push({ text: promptText });

    let userPart = { role: "user", parts: userParts };
    
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ 
                contents: [...sessionCtx, userPart], 
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] } 
            }) 
        });

        if (!res.ok) {

    const errorData = await res.json();

    console.error("ERROR GEMINI:", errorData);

    throw new Error(
        errorData.error?.message || 
        `Error HTTP ${res.status}`
    );
}
        return await res.json();
    } catch (err) {
        if (index < MODELS_LIST.length - 1) {
            return await executeModelFallback(promptText, files, index + 1);
        }
        throw err;
    }
}

// --- MANEJO DE EVENTOS DE USUARIO ---
function handleSendMessage() {
    const text = userInput.value.trim();
    if (!text && uploadedFilesData.length === 0) return;

    appendMessage('user', text || "(Archivo adjunto sin texto)");
    globalHistory.push({ role: 'user', text: text || "(Archivo adjunto)" });
    
    userInput.value = '';
    ajustarInput();

    executeModelFallback(text, uploadedFilesData)
        .then(rawResponse => {
            const aiText = rawResponse?.candidates?.[0]?.content?.parts?.[0]?.text || "No se recibió respuesta válida.";
            appendMessage('model', aiText);
            globalHistory.push({ role: 'model', text: aiText });
            localStorage.setItem('cyberpunk_history_v15', JSON.stringify(globalHistory));
            renderHistorySidebar();
        })
        .catch(err => {
            appendMessage('model', `⚠️ **Error:** ${err.message}`);
        })
        .finally(() => {
            uploadedFilesData = [];
            if (fileInput) fileInput.value = '';
        });
}

function setupEventListeners() {
    // Sidebar Toggles
    toggleSidebarBtn?.addEventListener('click', () => sidebar?.classList.toggle('collapsed'));
    closeSidebarBtn?.addEventListener('click', () => sidebar?.classList.add('collapsed'));

    // Textarea & Botón Enviar
    userInput?.addEventListener('input', ajustarInput);
    userInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    sendBtn?.addEventListener('click', handleSendMessage);

    // Carga de Archivos
    fileInput?.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        uploadedFilesData = [];
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64Data = reader.result.split(',')[1];
                uploadedFilesData.push({ mimeType: file.type, data: base64Data });
                alert(`Archivo adjunto cargado: ${file.name}`);
            };
            reader.readAsDataURL(file);
        });
    });

    // Reconocimiento de Voz
    voiceBtn?.addEventListener('click', () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Navegador no compatible con dictado de voz.");
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = 'es-ES';
        recognition.start();

        voiceBtn.style.color = '#ff007f';
        recognition.onresult = (event) => {
            userInput.value += (userInput.value ? ' ' : '') + event.results[0][0].transcript;
            ajustarInput();
        };
        recognition.onend = () => {
            voiceBtn.style.color = '';
        };
    });

    // Limpiar Chat
    clearChatBtn?.addEventListener('click', () => {
        if (confirm("¿Deseas reiniciar la sesión de chat actual?")) {
            globalHistory = [];
            currentSessionStartIndex = 0;
            localStorage.removeItem('cyberpunk_history_v15');
            chatContainer.innerHTML = `
              <div class="welcome-screen">
                <div class="cyber-logo-anim"><i class="fas fa-brain"></i></div>
                <h1>Bienvenido al Futuro</h1>
                <p>Conexión neuronal establecida con Eroleany</p>
              </div>`;
            renderHistorySidebar();
        }
    });
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

/* ============================================================
   CYBER-GEN V16 - PARCHE DE MEMORIA
   Pegar al FINAL del script.js
============================================================ */

// ---------- Guardar memoria ----------
function saveMemory() {
    localStorage.setItem(
        "cyberpunk_history_v15",
        JSON.stringify(globalHistory)
    );
}

// ---------- Cargar memoria ----------
try {
    globalHistory = JSON.parse(
        localStorage.getItem("cyberpunk_history_v15")
    ) || [];
} catch {
    globalHistory = [];
}

// Cargar todo el historial
currentSessionStartIndex = 0;

// ---------- Reemplaza el render del sidebar ----------
renderHistorySidebar = function () {

    if (!chatHistoryList) return;

    chatHistoryList.innerHTML = "";

    let contador = 1;

    globalHistory.forEach((item, index) => {

        if (item.role !== "user") return;

        const btn = document.createElement("button");

        btn.className =
            "nav-item w-100 text-start text-truncate";

        btn.innerHTML = `
            <i class="fas fa-comment-dots me-2"></i>
            Conversación ${contador++}
        `;

        btn.onclick = () => {

            chatContainer.innerHTML = "";

            for (let i = 0; i <= index + 1; i++) {

                const mensaje = globalHistory[i];

                appendMessage(
                    mensaje.role,
                    mensaje.text
                );

            }

        };

        chatHistoryList.appendChild(btn);

    });

};

// ---------- Guardado automático ----------
const originalPush = globalHistory.push.bind(globalHistory);

globalHistory.push = function (...args) {

    const resultado = originalPush(...args);

    saveMemory();

    return resultado;

};

// ---------- Restaurar historial al abrir ----------
window.addEventListener("load", () => {

    if (
        globalHistory.length === 0 ||
        !chatContainer
    ) return;

    chatContainer.innerHTML = "";

    globalHistory.forEach(msg => {

        appendMessage(
            msg.role,
            msg.text
        );

    });

});

// ---------- Limpiar memoria ----------
function clearNeuronMemory() {

    localStorage.removeItem(
        "cyberpunk_history_v15"
    );

    globalHistory = [];

    chatContainer.innerHTML = "";

    renderHistorySidebar();

}

console.log(
    "🧠 Memoria neuronal V16 cargada correctamente."
);