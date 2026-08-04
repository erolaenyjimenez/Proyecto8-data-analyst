// ====================== MAIN.JS - MASTER OMEGA V15.2 ======================
// Desarrollado por: Ing. Juancito Peña
// Núcleo de Inteligencia Cyber-Gen

const MODELS_LIST = [
  // Nivel 1: Modelos insignia actuales (Máxima velocidad y razonamiento)
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  
  // Nivel 2: Modelos Pro de respaldo (Si requieres razonamiento denso, sujetos a cuota estricta/429)
  "gemini-3.1-pro-preview",
  "gemini-3-pro-preview",
  
  // Nivel 3: Modelos Lite ultrarrápidos (Ideales para tareas sencillas si los principales fallan)
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  
  // Nivel 4: Último recurso (Modelos heredados pero aún activos)
  "gemini-flash-latest",
  "gemini-2.0-flash"
];

const SYSTEM_PROMPT = `Eres MINI GEMINI AI MASTER V15.2, diseñada por Erolaeny.
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

// --- CONFIGURACIÓN DE API KEY (.env Priority) ---
let rawKey = import.meta.env?.VITE_GEMINI_API_KEY || localStorage.getItem("GEMINI_PRO_KEY") || "";
let API_KEY = rawKey.trim();

// --- MEMORIA Y ESTADO ---
let globalHistory = [];
try { globalHistory = JSON.parse(localStorage.getItem('cyberpunk_history_v15')) || []; } catch(e) { globalHistory = []; }
let currentSessionStartIndex = globalHistory.length; 

let uploadedFilesData = [];
let selectedModel = localStorage.getItem("selectedGeminiModel") || MODELS_LIST[0];
let isAudioEnabled = localStorage.getItem("cyberpunk_audio") !== "false"; 
let voiceTimer = null;
let globalUtterance = null; 

// --- REFERENCIAS AL DOM ---
const chatBox           = document.getElementById('chat-box');
const promptInput       = document.getElementById('prompt-input');
const chatForm          = document.getElementById('chat-form');
const sidebar           = document.getElementById('sidebar');
const modelStatus       = document.getElementById('model-status');
const historyList       = document.getElementById('history-list');
const sttBtn            = document.getElementById('stt-btn');
const fileUpload        = document.getElementById('file-upload');
const toggleAudioBtn    = document.getElementById('toggle-audio-global');
const newChatBtn        = document.getElementById('new-chat-btn');
const btnDownloadSession= document.getElementById('btn-download-session');
const clearMemoryBtn    = document.getElementById('clear-btn');

function initApp() {
    renderHistorySidebar();
    modelStatus.innerHTML = `<i class='fa-solid fa-microchip'></i> LINK: ${selectedModel}`;
    updateAudioBtnStyle();
    createModelSelector();
    ajustarInput();
}

// ====================== SISTEMA DE VOZ CORREGIDO ======================
function speak(text) {
    if (!isAudioEnabled || !text) return;

    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();

    let clean = text
        .replace(/\[CHART_DATA[\s\S]*?\]/gs, ' Gráfico generado en pantalla. ')
        .replace(/```[\s\S]*?```/gs, ' Bloque de código omitido. ')
        .replace(/<[^>]*>?/gm, '')
        .replace(/[#*`_~→←↑↓↔︎\-]/g, ' ')
        .replace(/([.?!:;])\s*/g, '$1|') 
        .replace(/\s+/g, ' ')
        .trim();

    if (!clean) return;

    let chunks = clean.split('|').filter(c => c.trim().length > 0);
    let chunkIndex = 0;

    function playNextChunk() {
        if (chunkIndex >= chunks.length) return;
        globalUtterance = new SpeechSynthesisUtterance(chunks[chunkIndex].trim()); 
        globalUtterance.lang = 'es-ES'; 
        globalUtterance.rate = 1.05;
        globalUtterance.onend = () => { chunkIndex++; playNextChunk(); };
        window.speechSynthesis.speak(globalUtterance);
        if (window.speechSynthesis.speaking) window.speechSynthesis.resume();
    }
    setTimeout(() => { playNextChunk(); }, 80);
}

// ====================== VISUALIZACIÓN DE DATOS (CHART.JS) ======================
function procesarEstructuraVisual(text) {
    let processedText = text;
    let extractedConfigs = [];
    processedText = processedText.replace(/```(?:json|javascript|html)?\s*(\[CHART_DATA:[\s\S]*?\])\s*```/gi, '$1');
    const TAG = '[CHART_DATA:';

    while (processedText.includes(TAG)) {
        let tagIndex = processedText.indexOf(TAG);
        let jsonStart = processedText.indexOf('{', tagIndex);
        if (jsonStart === -1) { processedText = processedText.replace(TAG, '[CHART_DATA_INVALIDO]'); continue; }

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
                const cid = `chart-${Date.now()}-${extractedConfigs.length}`;
                extractedConfigs.push({ id: cid, config });
                processedText = processedText.replace(fullMatch, `\n\n%%%CHART_${extractedConfigs.length-1}%%%\n\n`);
            } catch (e) { processedText = processedText.replace(fullMatch, ' [Error en Gráfico] '); }
        }
    }
    return { html: marked.parse(processedText), charts: extractedConfigs };
}

async function executeModelFallback(promptText, files, index = 0) {
    const model = MODELS_LIST[index] || MODELS_LIST[0]; 
    let sessionCtx = globalHistory.slice(currentSessionStartIndex).map(h => ({ role: h.role, parts: [{ text: h.text }] })).slice(-8);
    let userPart = { role: "user", parts: [{ text: promptText }] };
    
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ contents: [...sessionCtx, userPart], systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] } }) 
    });

    if (!res.ok) { 
        if (index < MODELS_LIST.length - 1) return executeModelFallback(promptText, files, index + 1); 
        throw new Error(res.status); 
    }
    return await res.json();
}

initApp();
