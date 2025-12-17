import { gerarConteudoEmJSONComImagemStream } from "./gemini.js";

let alertTimeout;
window.__ultimaQuestaoExtraida = null;
window.__recortesAcumulados = [];
window.__isProcessing = false;
let questaoAtual = {};

// --- HELPER: Detecta o container correto de scroll (Mobile vs Desktop) ---
window.getScrollContainer = function () {
    const sidebar = document.getElementById('viewerSidebar');
    if (!sidebar) return null;

    // Mobile: O scroll fica no wrapper explícito
    if (window.innerWidth <= 900) {
        const wrapper = document.getElementById('maia-scroll-wrapper');
        if (wrapper) return wrapper;
        // Fallback para selector caso o ID não esteja lá
        const contentDiv = sidebar.querySelector('div:not(#header-mobile-toggle)');
        if (contentDiv) return contentDiv;
    }

    // Desktop: O scroll é no próprio sidebar
    return sidebar;
};

window.__targetSlotContext = null; // 'questao' ou 'gabarito'

// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-analytics.js";

import { getDatabase, ref, push, set, serverTimestamp, get, child } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

// Configuração do Firebase
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    // storageBucket: REMOVIDO (Não vamos usar)
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Inicializa o Realtime Database
const db = getDatabase(app);

// Configuração do ImgBB (Substitua pela sua chave)
const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY;

// ======================================================
// FUNÇÕES GLOBAIS DE CONTROLE DO PAINEL
// ======================================================

function criarBackdropSeNecessario() {
    let backdrop = document.getElementById('sidebarBackdrop');
    const viewerBody = document.getElementById('viewerBody');
    if (!backdrop && viewerBody) {
        backdrop = document.createElement('div');
        backdrop.id = 'sidebarBackdrop';
        viewerBody.appendChild(backdrop);
        backdrop.onclick = () => window.esconderPainel();
    }
    return backdrop;
}

window.esconderPainel = function () {
    const viewerBody = document.getElementById('viewerBody');
    // 1. Esconde o Painel (CSS)
    if (viewerBody) viewerBody.classList.add("sidebar-collapsed");

    // 2. Esconde o Backdrop
    const bd = document.getElementById('sidebarBackdrop');
    if (bd) {
        bd.style.opacity = '0';
        bd.style.pointerEvents = 'none';
    }

    // 3. Destrava scroll do site
    document.body.style.overflow = '';

    // 4. MOSTRA O BOTÃO DE REABRIR
    if (window.innerWidth > 900 && typeof window.mostrarBotaoReabrirPainel === 'function') {
        window.mostrarBotaoReabrirPainel();
    }
};

window.mostrarPainel = function () {
    const viewerBody = document.getElementById('viewerBody');
    // 1. Mostra o Painel
    if (viewerBody) viewerBody.classList.remove("sidebar-collapsed");

    // Remove Glow Effects
    document.getElementById('header-mobile-toggle')?.classList.remove('glow-effect');
    document.getElementById('reopenSidebarBtn')?.classList.remove('glow-effect');

    // 2. Lógica Mobile (Backdrop e Scroll)
    if (window.innerWidth <= 900) {
        // Garante que o backdrop existe
        const bd = criarBackdropSeNecessario();
        if (bd) {
            // Forçar reflow se necessário, mas geralmente não precisa
            requestAnimationFrame(() => {
                bd.style.opacity = '1';
                bd.style.pointerEvents = 'auto';
            });
        }
        document.body.style.overflow = 'hidden';
    }

    // 3. REMOVE O BOTÃO DE REABRIR
    const btnReabrir = document.getElementById("reopenSidebarBtn");
    if (btnReabrir) {
        btnReabrir.remove();
    }
};

/**
 * Inicia o modo de recorte especificamente para preencher um slot vazio na estrutura.
 */
window.iniciarCapturaParaSlot = function (index, contexto) {
    console.log(`Iniciando captura para slot ${index} do contexto ${contexto}`);

    // Define o alvo globalmente
    window.__targetSlotIndex = index;
    window.__targetSlotContext = contexto; // 'questao' ou 'gabarito'

    // Muda visualmente o botão flutuante para o usuário entender o que está fazendo
    window.ativarModoRecorte();

    const btnConfirm = document.querySelector('#floatingActionParams .btn--success');
    if (btnConfirm) {
        btnConfirm.innerText = "📍 Preencher Espaço";
        btnConfirm.classList.remove('btn--success');
        btnConfirm.classList.add('btn--primary');
    }
};

function customAlert(message, duration = 5000) {
    let alertDiv = document.getElementById("customAlert");
    let messageDiv;

    if (!alertDiv) {
        alertDiv = document.createElement("div");
        alertDiv.id = "customAlert";

        messageDiv = document.createElement("div");
        messageDiv.id = "alertMessage";
        alertDiv.appendChild(messageDiv);

        document.body.appendChild(alertDiv);
    } else {
        messageDiv = document.getElementById("alertMessage");
    }

    messageDiv.innerText = message;

    void alertDiv.offsetWidth;

    alertDiv.classList.add("visible");

    if (alertTimeout) clearTimeout(alertTimeout);

    const removeAlert = () => {
        alertDiv.classList.remove("visible");
        setTimeout(() => {
            if (alertDiv && !alertDiv.classList.contains("visible")) {
                alertDiv.remove();
            }
        }, 500);
    };

    if (duration > 0) {
        alertTimeout = setTimeout(removeAlert, duration);
    }

    return {
        close: removeAlert,
        update: (newMsg) => customAlert(newMsg, duration)
    };
}

/**
 * Gera a interface de upload.
 * Aceita um objeto 'initialData' para repreencher o formulário ao voltar.
 */
window.generatePDFUploadInterface = function (initialData = null) {
    // 1. LIMPEZA TOTAL DA TELA
    document.body.innerHTML = '';

    const viewer = document.getElementById("pdfViewerContainer");
    if (viewer) viewer.remove();

    // 2. HTML do Formulário
    document.body.innerHTML = `
    <button onclick="gerarTelaInicial()" class="btn btn--sm btn--outline" style="position:fixed; top:20px; left:20px; z-index:100; border-radius:20px; background:var(--color-surface);">
        ← Voltar
    </button>

    <div id="pdfUploadContainer" class="fade-in-centralized">
        <div id="brandHeader">
            <img src="logo.png" alt="Logo Maia" id="brandLogo">
            <span id="brandName">Maia<strong>.api</strong></span>
        </div>
        <h1 id="promptTitle">Extraia questões e faça da educação <strong>acessível</strong></h1>
        
        <form id="pdfUploadForm">
            <div class="form-group">
                <label for="pdfTitleInput" class="form-label">Título do material</label>
                <div class="input-wrapper">
                    <input type="text" id="pdfTitleInput" class="form-control" placeholder="Ex: FUVEST 2023" required>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Arquivo da Prova</label>
                <label id="dropZoneProva" for="pdfFileInput" class="btn btn--primary btn--full-width file-upload-btn">
                    Selecionar ou Soltar Prova (PDF)
                </label>
                <input type="file" id="pdfFileInput" accept=".pdf" style="display: none;" required>
                <span id="fileName" class="file-name-display">Nenhum arquivo selecionado</span>
            </div>

            <div class="form-group" id="gabaritoInputGroup">
                <label class="form-label">Arquivo do Gabarito</label>
                <label id="dropZoneGabarito" for="gabaritoFileInput" class="btn btn--primary btn--full-width file-upload-btn">
                    Selecionar ou Soltar Gabarito (PDF)
                </label>
                <input type="file" id="gabaritoFileInput" accept=".pdf" style="display: none;">
                <span id="gabaritoFileName" class="file-name-display">Nenhum arquivo selecionado</span>
            </div>

            <div class="form-group checkbox-group">
                <input type="checkbox" id="gabaritoNaProvaCheck">
                <label for="gabaritoNaProvaCheck" class="checkbox-label">O gabarito está no mesmo arquivo</label>
            </div>

            <div class="modal-footer">
                <button type="submit" id="submitPdfBtn" class="btn btn--primary btn--full-width">Visualizar e Extrair</button>
            </div>
        </form>
    </div>
    `;

    // 3. Referências aos elementos
    const titleInput = document.getElementById('pdfTitleInput');
    const gabaritoCheck = document.getElementById('gabaritoNaProvaCheck');
    const gabaritoGroup = document.getElementById('gabaritoInputGroup');
    const gabaritoInput = document.getElementById('gabaritoFileInput');
    const pdfInput = document.getElementById('pdfFileInput');

    // Displays
    const fileNameDisplay = document.getElementById('fileName');
    const gabaritoFileNameDisplay = document.getElementById('gabaritoFileName');

    // Drop Zones (As labels que agem como botões)
    const dropZoneProva = document.getElementById('dropZoneProva');
    const dropZoneGabarito = document.getElementById('dropZoneGabarito');

    // 4. Lógica de Repreenchimento
    if (initialData) {
        titleInput.value = initialData.rawTitle || "";
        gabaritoCheck.checked = initialData.gabaritoNaProva;

        if (initialData.gabaritoNaProva) {
            gabaritoGroup.style.display = 'none';
            gabaritoInput.required = false;
        }
        fileNameDisplay.textContent = "⚠️ Por favor, selecione o arquivo novamente.";
        fileNameDisplay.style.color = "var(--color-warning)";
    }

    // --- FUNÇÃO AUXILIAR DE DRAG & DROP ---
    function setupDragAndDrop(dropZone, inputElement, displayElement) {
        // Prevenir comportamento padrão (abrir o arquivo no navegador)
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        // Adicionar efeito visual ao arrastar por cima
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('drag-over');
            }, false);
        });

        // Remover efeito visual ao sair ou soltar
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drag-over');
            }, false);
        });

        // Lidar com o arquivo solto
        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;

            if (files.length > 0) {
                // Validação simples de PDF
                if (files[0].type !== "application/pdf") {
                    alert("Por favor, solte apenas arquivos PDF.");
                    return;
                }

                // ATENÇÃO: Atribuir os arquivos ao input manualmente
                inputElement.files = files;

                // Atualizar texto (dispara o evento change manualmente se necessário, ou atualiza direto)
                displayElement.textContent = files[0].name;
                displayElement.style.color = "var(--color-text-secondary)";
            }
        });
    }

    // 5. Configurar Listeners e Drag & Drop

    // Listeners normais de clique
    pdfInput.addEventListener('change', (e) => {
        fileNameDisplay.textContent = e.target.files[0]?.name || 'Nenhum arquivo selecionado';
        fileNameDisplay.style.color = "var(--color-text-secondary)";
    });

    gabaritoInput.addEventListener('change', (e) => {
        gabaritoFileNameDisplay.textContent = e.target.files[0]?.name || 'Nenhum arquivo selecionado';
    });

    // ATIVAR O DRAG AND DROP
    setupDragAndDrop(dropZoneProva, pdfInput, fileNameDisplay);
    setupDragAndDrop(dropZoneGabarito, gabaritoInput, gabaritoFileNameDisplay);

    // Lógica do Checkbox
    gabaritoCheck.addEventListener('change', () => {
        if (gabaritoCheck.checked) {
            gabaritoGroup.style.display = 'none';
            gabaritoInput.value = '';
            gabaritoInput.required = false;
        } else {
            gabaritoGroup.style.display = 'block';
            gabaritoInput.required = true;
        }
    });

    // 6. Submit
    document.getElementById('pdfUploadForm').addEventListener('submit', (event) => {
        event.preventDefault();
        const fileProva = pdfInput.files[0];
        const fileGabarito = gabaritoInput.files[0];

        if (!fileProva) { alert("Selecione a prova."); return; }

        gerarVisualizadorPDF({
            title: `(${titleInput.value})`,
            rawTitle: titleInput.value,
            fileProva,
            fileGabarito: gabaritoCheck.checked ? null : fileGabarito,
            gabaritoNaProva: gabaritoCheck.checked
        });
    });
};

// Variáveis de escopo global para o visualizador
let pdfDoc = null;
let pageNum = 1;
let pdfScale = 1.0; // Zoom inicial
let cropper = null;
let isRendering = false; // Prevines renderizações simultâneas
window.__viewerArgs = null;           // guarda os arquivos e title
window.__modo = "prova";              // "prova" | "gabarito"
window.__pdfUrls = { prova: null, gabarito: null };
window.__preferirPdfGabarito = true; // por padrão, quando existir PDF do gabarito, troca


// No início do arquivo ou dentro de gerarTelaInicial/fecharVisualizador
window.__imagensLimpas = window.__imagensLimpas || {
    questao_original: [],
    questao_suporte: [],
    gabarito_original: [],
    gabarito_suporte: [],
    // ADICIONE ISSO AQUI:
    gabarito_passos: {}, // Estrutura: { 0: [img, img], 1: [img] } (chave é o index do passo)
    alternativas: {
        questao: {},
        gabarito: {}
    }
};

window.__target_alt_letra = null;
window.__target_alt_index = null;

window.iniciar_captura_para_slot_alternativa = function (letra, index) {
    window.__target_alt_letra = String(letra || "").trim().toUpperCase();
    window.__target_alt_index = Number(index);

    // Reaproveita teu fluxo existente de recorte/UI
    window.ativarModoRecorte?.(); // já existe e liga o cropper + botões flutuantes [file:2]
};

// --- NOVO SISTEMA DE ZOOM DE IMAGEM (MODAL) ---
window.expandirImagem = function (src) {
    // Remove modal anterior se existir
    const oldModal = document.getElementById('imgZoomModal');
    if (oldModal) oldModal.remove();

    const modalHtml = `
    <div id="imgZoomModal" class="final-modal-overlay visible" style="z-index: 999999; background: rgba(0,0,0,0.9); cursor: zoom-out;" onclick="this.remove()">
        <div style="display:flex; justify-content:center; align-items:center; width:100%; height:100%;">
            <img src="${src}" style="max-width:95%; max-height:95%; border-radius:4px; box-shadow: 0 0 20px rgba(0,0,0,0.5); object-fit: contain;">
            <button style="position:absolute; top:20px; right:20px; background:white; border:none; border-radius:50%; width:40px; height:40px; font-weight:bold; cursor:pointer;">✕</button>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

// --- NOVO MODAL DE AVISO (Visual Personalizado) ---
function mostrarModalAvisoImagens(esperados, preenchidos, onConfirm, onCancel) {
    const faltam = esperados - preenchidos;
    const idModal = 'missingImagesModal';

    // Remove anterior se existir
    document.getElementById(idModal)?.remove();

    const overlay = document.createElement('div');
    overlay.id = idModal;
    overlay.className = 'modal-overlay'; // Usa a mesma classe do seu CSS existente
    overlay.innerHTML = `
    <div class="modal-content" style="max-width: 450px; border-top: 4px solid var(--color-warning);">
      <div class="modal-header">
        <h2 style="color: var(--color-warning); display:flex; align-items:center; gap:10px;">
           ⚠️ Faltam Imagens
        </h2>
      </div>

      <div class="modal-body">
        <p style="font-size: 1.1em; color: var(--color-text);">
            A estrutura da questão pede <strong>${esperados}</strong> imagens, mas você recortou apenas <strong>${preenchidos}</strong>.
        </p>
        <div style="background: rgba(255, 165, 0, 0.1); padding: 15px; border-radius: 8px; margin: 15px 0; text-align: center;">
            <strong style="color: var(--color-warning); font-size: 1.2em;">Faltam ${faltam} imagem(ns)</strong>
        </div>
        <p style="font-size: 0.9em; color: var(--color-text-secondary);">
            Se avançar agora, o gabarito pode ficar incompleto ou a IA pode alucinar sobre imagens que não viu.
        </p>
      </div>

      <div class="modal-footer" style="display:flex; gap:10px; justify-content:flex-end;">
        <button type="button" class="btn btn--secondary" id="btnCancelImg">Voltar e Recortar</button>
        <button type="button" class="btn btn--primary" id="btnConfirmImg" style="background: var(--color-warning); border-color: var(--color-warning); color: #000;">Continuar mesmo assim</button>
      </div>
    </div>
  `;

    document.body.appendChild(overlay);

    // Lógica dos botões
    const btnCancel = document.getElementById('btnCancelImg');
    const btnConfirm = document.getElementById('btnConfirmImg');

    const close = () => overlay.remove();

    btnCancel.onclick = () => {
        close();
        onCancel();
    };

    btnConfirm.onclick = () => {
        close();
        onConfirm();
    };
}

window.validarProgressoImagens = function (contexto = 'questao') {
    return new Promise((resolve) => {
        let slotsEsperados = 0;
        let imagensPreenchidas = 0;

        if (contexto === 'questao') {
            // --- LÓGICA EXISTENTE (QUESTÃO) ---
            const q = window.__ultimaQuestaoExtraida;
            if (!q) { resolve(true); return; }

            if (Array.isArray(q.estrutura)) {
                slotsEsperados += q.estrutura.filter(b => b.tipo === 'imagem').length;
            }
            if (Array.isArray(q.alternativas)) {
                q.alternativas.forEach(alt => {
                    if (Array.isArray(alt.estrutura)) {
                        slotsEsperados += alt.estrutura.filter(b => b.tipo === 'imagem').length;
                    }
                });
            }

            imagensPreenchidas += (window.__imagensLimpas?.questao_original || []).filter(Boolean).length;
            const altsMap = window.__imagensLimpas?.alternativas?.questao || {};
            Object.values(altsMap).forEach(lista => {
                if (Array.isArray(lista)) imagensPreenchidas += lista.filter(Boolean).length;
            });

        } else if (contexto === 'gabarito') {
            // --- NOVA LÓGICA (GABARITO) ---
            const g = window.__ultimoGabaritoExtraido;
            if (!g) { resolve(true); return; }

            // Verifica imagens na Explicação (Passo a Passo)
            if (Array.isArray(g.explicacao)) {
                g.explicacao.forEach((passo, idx) => {
                    // Conta quantos blocos {tipo: 'imagem'} existem neste passo
                    if (Array.isArray(passo.estrutura)) {
                        slotsEsperados += passo.estrutura.filter(b => b.tipo === 'imagem').length;
                    }

                    // Conta quantas imagens temos salvas na memória para este passo
                    const imgsSalvasPasso = window.__imagensLimpas?.gabarito_passos?.[idx] || [];
                    imagensPreenchidas += imgsSalvasPasso.filter(Boolean).length;
                });
            }
        }

        // --- VALIDAÇÃO FINAL (COMUM A AMBOS) ---
        if (slotsEsperados > imagensPreenchidas) {
            // Usa o seu modal visual já existente
            mostrarModalAvisoImagens(
                slotsEsperados,
                imagensPreenchidas,
                () => resolve(true),  // Usuário clicou em "Continuar mesmo assim"
                () => resolve(false)  // Usuário clicou em "Voltar"
            );
        } else {
            resolve(true);
        }
    });
};

/**
 * Renderiza a interface de visualização de PDF.
 */
function gerarVisualizadorPDF(args) {
    // 1. Configuração do Worker
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    // 2. Limpeza (mantém igual)
    const uploadContainer = document.getElementById("pdfUploadContainer");
    if (uploadContainer) uploadContainer.remove();

    // 2.1 Estado (ADICIONAR)
    window.__viewerArgs = args;
    window.__modo = "prova";

    // 3. URLs (SUBSTITUIR)
    if (window.__pdfUrls.prova) URL.revokeObjectURL(window.__pdfUrls.prova);
    if (window.__pdfUrls.gabarito) URL.revokeObjectURL(window.__pdfUrls.gabarito);

    window.__pdfUrls.prova = URL.createObjectURL(args.fileProva);
    window.__pdfUrls.gabarito = args.fileGabarito ? URL.createObjectURL(args.fileGabarito) : null;

    // começa sempre na prova
    const urlProva = window.__pdfUrls.prova;

    const viewerHTML = `
    <div id="pdfViewerContainer" class="fade-in">
        <!-- HEADER -->
        <header id="viewerHeader">
            <div class="header-left">
                <img src="logo.png" class="header-logo" alt="Logo">
                <span class="header-title">Maia.api - ${args.rawTitle}</span>
            </div>

            <div class="header-actions">
                <button class="btn btn--sm btn--secondary" onclick="fecharVisualizador()">✕ Fechar</button>
            </div>
        </header>

        <div id="viewerBody">
            <!-- SIDEBAR FOI REMOVIDA DAQUI INICIALMENTE -->

            <!-- CONTEÚDO PRINCIPAL -->
            <main id="viewerMain">
                <section class="pdf-panel" id="panelProva">
                    <!-- ... (Mantenha o conteúdo interno do panelProva igual) ... -->
                     <div class="panel-label">
                        <div id="modeToggle" class="mode-toggle" role="tablist" aria-label="Alternar PDF">
                            <!-- Botão Prova: começa ativo -->
                            <button type="button" id="btnModoProva" class="mode-toggle__btn is-active" onclick="window.trocarModo('prova')">Prova</button>
                            
                            <!-- Botão Gabarito: começa inativo -->
                            <button type="button" id="btnModoGabarito" class="mode-toggle__btn" onclick="window.trocarModo('gabarito')">Gabarito</button>
                        </div>

                        <div class="pdf-controls-box">
                            <label class="control-label">Navegação</label>
                            <div class="control-row">
                                <button class="btn-icon" onclick="mudarPagina(-1)">◀</button>
                                <span id="page_num">Pag 1</span>
                                <button class="btn-icon" onclick="mudarPagina(1)">▶</button>
                            </div>
                        </div>
                        <div class="pdf-controls-box">
                            <label class="control-label">Zoom</label>
                            <div class="control-row">
                                <button class="btn-icon" onclick="mudarZoom(-0.2)">-</button>
                                <span id="zoom_level">100%</span>
                                <button class="btn-icon" onclick="mudarZoom(0.2)">+</button>
                            </div>
                        </div>
                        <button id="btnRecortarHeader" onclick="ativarModoRecorte()">
                            <img src="capture.png">
                        </button>
                    </div>
                    <div id="canvasContainer" class="canvas-wrapper">
                        <canvas id="the-canvas"></canvas>
                    </div>
                </section>
            </main>
        </div>

        <!-- CONTROLES FLUTUANTES (Invisíveis inicialmente) -->
        <div id="floatingActionParams" class="hidden">
            <button class="flyingBtn btn--success" onclick="salvarQuestao()">✅ Confirmar Seleção</button>
            <button class="flyingBtn btn--danger" onclick="cancelarRecorte()">✕ Cancelar</button>
        </div>

        <!-- MODAL DE CONFIRMAÇÃO (Substitui a nova aba) -->
        <div id="cropConfirmModal" class="custom-modal-overlay">
            <div class="custom-modal-content">
                <h3 style="margin:0; color: #fff;">Imagens Selecionadas (<span id="countImagens">0</span>)</h3>
                <p style="color: #ccc; font-size: 0.9em;">Revise os recortes antes de enviar.</p>
                
                <div id="cropPreviewGallery" class="crop-preview-gallery">
                    </div>

                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <button class="btn btn--secondary" style="flex: 1;" onclick="adicionarMaisRecortes()">➕ Recortar Outra Parte</button>
                    <button class="btn btn--primary" style="flex: 1;" onclick="confirmarEnvioIA()">🚀 Processar Tudo</button>
                </div>
                <button class="btn btn--sm btn--outline" style="margin-top:10px; border:none; color:#aaa" onclick="fecharModalConfirmacao()">Cancelar tudo</button>
            </div>
        </div>
    </div>
    `;

    document.body.innerHTML += viewerHTML;

    window.atualizarUIViewerModo = function () {
        const isGabaritoMode = window.__modo === 'gabarito';

        // 1. Botões do Topo (Abas do PDF)
        document.getElementById('btnModoProva')?.classList.toggle('is-active', !isGabaritoMode);
        document.getElementById('btnModoGabarito')?.classList.toggle('is-active', isGabaritoMode);

        // 2. Controle dos Botões de Imagem (Lógica Cruzada)
        // Se estou no modo 'prova', libero o botão da Questão e bloqueio o do Gabarito
        // Se estou no modo 'gabarito', libero o botão do Gabarito e bloqueio o da Questão

        const btnQuestao = document.getElementById('btnImgQuestao');
        const msgQuestao = document.getElementById('msgAvisoModo_quest');

        if (btnQuestao) {
            btnQuestao.disabled = isGabaritoMode; // Desabilita se estiver vendo Gabarito
            btnQuestao.style.opacity = isGabaritoMode ? '0.5' : '1';
            btnQuestao.style.cursor = isGabaritoMode ? 'not-allowed' : 'pointer';
            if (msgQuestao) msgQuestao.style.display = isGabaritoMode ? 'block' : 'none';
        }

        const btnGabarito = document.getElementById('btnImgGabarito');
        const msgGabarito = document.getElementById('msgAvisoModo_gab');

        if (btnGabarito) {
            btnGabarito.disabled = !isGabaritoMode; // Desabilita se estiver vendo Prova
            btnGabarito.style.opacity = !isGabaritoMode ? '0.5' : '1';
            btnGabarito.style.cursor = !isGabaritoMode ? 'not-allowed' : 'pointer';
            if (msgGabarito) msgGabarito.style.display = !isGabaritoMode ? 'block' : 'none';
        }

        // 3. Botão de Confirmar e Extrair (Só aparece na Prova)
        const btnConfirmar = document.getElementById('btnConfirmarQuestao');
        if (btnConfirmar) {
            btnConfirmar.style.display = isGabaritoMode ? 'none' : 'block';
        }
    };

    // --- LÓGICA DO RESIZER (Redimensionamento) ---
    const sidebar = document.getElementById('viewerSidebar');
    const resizer = document.getElementById('sidebarResizer');

    // Configurações de limites
    const MIN_WIDTH = 200;
    const MAX_WIDTH = 600;

    if (resizer) {
        let isResizing = false;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            resizer.classList.add('resizing');
            document.body.style.cursor = 'col-resize'; // Força cursor na tela toda
            document.body.style.userSelect = 'none';   // Evita selecionar texto enquanto arrasta
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            // A largura é baseada na posição X do mouse
            let newWidth = e.clientX;

            // Aplica os limites
            if (newWidth < MIN_WIDTH) newWidth = MIN_WIDTH;
            if (newWidth > MAX_WIDTH) newWidth = MAX_WIDTH;

            sidebar.style.width = `${newWidth}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                resizer.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    }

    window.atualizarUIViewerModo?.();

    // 5. Inicialização PDF
    const loadingTask = pdfjsLib.getDocument(urlProva);
    loadingTask.promise.then(function (pdf) {
        pdfDoc = pdf;
        pageNum = 1;
        renderPage(pageNum);
    });

    // --- FUNÇÕES ---

    // --- FUNÇÃO RENDER PAGE CORRIGIDA (AGORA RETORNA A PROMESSA) ---
    window.renderPage = (num) => {
        if (!pdfDoc || isRendering) return Promise.resolve(); // Retorna promessa vazia se estiver ocupado
        isRendering = true;

        return pdfDoc.getPage(num).then(function (page) { // Adicionado return aqui
            const canvas = document.getElementById('the-canvas');
            if (!canvas) return; // Segurança extra

            const ctx = canvas.getContext('2d');
            const viewport = page.getViewport({ scale: pdfScale });
            const outputScale = window.devicePixelRatio || 1;

            canvas.width = Math.floor(viewport.width * outputScale);
            canvas.height = Math.floor(viewport.height * outputScale);
            canvas.style.width = Math.floor(viewport.width) + "px";
            canvas.style.height = Math.floor(viewport.height) + "px";

            const transform = outputScale !== 1
                ? [outputScale, 0, 0, outputScale, 0, 0]
                : null;

            const renderContext = {
                canvasContext: ctx,
                viewport: viewport,
                transform: transform
            };

            if (cropper) {
                cropper.destroy();
                cropper = null;
            }

            const renderTask = page.render(renderContext);

            // Retorna a promessa da renderização para quem chamar renderPage
            return renderTask.promise.then(function () {
                isRendering = false;
                document.getElementById('page_num').textContent = `Pag ${num} / ${pdfDoc.numPages}`;
                document.getElementById('zoom_level').textContent = `${Math.round(pdfScale * 100)}%`;

                const manager = document.getElementById('questionManager');
                const actions = document.querySelector('.sidebar-actions');

                if (manager && !manager.classList.contains('hidden') && actions.classList.contains('hidden')) {
                    iniciarCropper();
                }
            });
        });
    };

    window.ensurePdfUrls = function ensurePdfUrls() {
        // CORREÇÃO: Usar window.__pdfUrls (com duplo underscore)
        if (!window.__pdfUrls) window.__pdfUrls = { prova: null, gabarito: null };

        // CORREÇÃO: Usar window.__viewerArgs (com duplo underscore)
        const args = window.__viewerArgs;

        const fileProva = args?.fileProva;
        const fileGabarito = args?.fileGabarito;

        // se perdeu a URL da prova, recria
        if (!window.__pdfUrls.prova && fileProva) {
            window.__pdfUrls.prova = URL.createObjectURL(fileProva);
        }

        // se perdeu a URL do gabarito, recria (se existir)
        if (!window.__pdfUrls.gabarito && fileGabarito) {
            window.__pdfUrls.gabarito = URL.createObjectURL(fileGabarito);
        }

        return !!window.__pdfUrls.prova;
    };

    window.trocarModo = async function (novoModo) {
        console.log(`[TrocarModo] Tentando ir para: ${novoModo}`);

        if (!window.ensurePdfUrls?.()) {
            console.warn("[TrocarModo] Abortado: sem PDF da prova para reconstruir URL");
            return;
        }
        if (!document.getElementById("pdfViewerContainer")) {
            console.warn("[TrocarModo] Abortado: Viewer não está montado no DOM");
            return;
        }

        // --- VALIDAÇÃO DE SEGURANÇA (ATUALIZADA) ---
        if (window.__modo === 'prova' && novoModo === 'gabarito') {
            // ADICIONADO: 'await' aqui
            const podeIr = await window.validarProgressoImagens();

            if (!podeIr) {
                return; // O usuário clicou em "Voltar e Recortar" no modal
            }
        }
        // -------------------------------------------

        // --- BLOQUEIO DE SEGURANÇA ---
        if (novoModo === 'gabarito') {
            // 1. Se estiver processando, avisa para esperar
            if (window.__isProcessing) {
                console.warn("[TrocarModo] Bloqueado: Processamento em andamento.");
                customAlert('⏳ Aguarde Maia terminar de analisar a questão...', 3000);
                return; // ABORTA
            }

            // 2. Se terminou de processar mas não tem questão (deu erro ou não fez nada)
            if (!window.__ultimaQuestaoExtraida) {
                console.warn("[TrocarModo] Bloqueado: Nenhuma questão extraída ainda.");
                customAlert('⚠️ Capture e processe a Questão (Prova) primeiro!', 3000);
                return; // ABORTA
            }
        }

        if (novoModo !== 'prova' && novoModo !== 'gabarito') return;

        // CORREÇÃO: Usar window.__modo
        window.__modo = novoModo;
        // Compatibilidade caso algum lugar use sem underscore
        window.modo = novoModo;

        // Atualiza a UI dos botões (Classes CSS)
        window.atualizarUIViewerModo?.();

        // Lógica de carregar o PDF correto
        // CORREÇÃO: Usar window.__pdfUrls
        let url = window.__pdfUrls.prova; // Default

        if (novoModo === 'gabarito') {
            const temPdfGabarito = !!window.__pdfUrls.gabarito;
            if (temPdfGabarito) {
                window.__preferirPdfGabarito = true;
                url = window.__pdfUrls.gabarito;
            } else {
                // Gabarito está no mesmo arquivo da prova
                url = window.__pdfUrls.prova;
            }
        }

        // Renderiza o PDF
        try {
            const loadingTask = pdfjsLib.getDocument(url);
            const pdf = await loadingTask.promise;
            pdfDoc = pdf; // Atualiza global
            pageNum = 1;  // Reseta para pág 1 ao trocar de arquivo
            await renderPage(pageNum);
        } catch (err) {
            console.error("Erro ao carregar PDF do modo " + novoModo, err);
            customAlert("Erro ao carregar o PDF.", 2000);
        }
    };

    let scrollPos = { top: 0, left: 0 };

    function iniciarCropper() {
        const container = document.getElementById('canvasContainer');
        const sourceCanvas = document.getElementById('the-canvas');

        if (!sourceCanvas) return;

        // 1. Captura estado do scroll
        scrollPos.top = container.scrollTop;
        scrollPos.left = container.scrollLeft;

        const currentWidth = sourceCanvas.style.width || sourceCanvas.width + 'px';
        const currentHeight = sourceCanvas.style.height || sourceCanvas.height + 'px';

        // 2. Cria a imagem temporária
        const imageForCropper = document.createElement('img');
        imageForCropper.id = 'temp-cropper-img';
        imageForCropper.src = sourceCanvas.toDataURL('image/png');

        // Estilos Críticos para Alinhamento
        imageForCropper.style.width = currentWidth;
        imageForCropper.style.height = currentHeight;
        imageForCropper.style.maxWidth = 'none';
        imageForCropper.style.display = 'block';

        // 3. Limpa o container
        container.innerHTML = '';

        // 4. Wrapper com Position Relative
        const wrapper = document.createElement('div');
        wrapper.style.width = currentWidth;
        wrapper.style.height = currentHeight;
        wrapper.style.position = 'relative';
        wrapper.style.margin = "0 auto";

        wrapper.appendChild(imageForCropper);
        container.appendChild(wrapper);

        // 5. Restaura Scroll
        container.scrollTop = scrollPos.top;
        container.scrollLeft = scrollPos.left;

        // 6. Configura Cropper
        const cropperOptions = {
            viewMode: 0,
            dragMode: 'crop',
            initialAspectRatio: NaN,
            restore: false,
            modal: true,
            guides: true,
            highlight: true,
            background: false,
            autoCrop: false,
            movable: false,
            zoomable: false,
            rotatable: false,
            scalable: false,
            ready: function () {
                console.log("Cropper pronto.");
                container.scrollTop = scrollPos.top;
                container.scrollLeft = scrollPos.left;
            }
        };

        setTimeout(() => {
            cropper = new Cropper(imageForCropper, cropperOptions);
        }, 50);

        // REMOVIDO: Linhas que manipulavam 'questionManager' e 'sidebar-actions'
        // pois eles não existem mais nessa etapa.
    }

    // --- ATIVAR MODO RECORTE (CONTROLA A UI NOVA) ---
    window.ativarModoRecorte = () => {
        if (cropper) return;

        // Auto-hide do painel ao iniciar recorte (Pedido do usuário)
        if (window.innerWidth < 900) window.esconderPainel?.();

        iniciarCropper();

        // Mostra botões flutuantes
        const floatParams = document.getElementById('floatingActionParams');
        if (floatParams) floatParams.classList.remove('hidden');

        // Desativa botão do header para feedback visual
        const btnHeader = document.getElementById('btnRecortarHeader');
        if (btnHeader) {
            btnHeader.style.opacity = '0.5';
            btnHeader.style.pointerEvents = 'none';
        }
    };
    window.cancelarRecorte = function () {
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }

        const container = document.getElementById('canvasContainer');
        if (container) {
            container.innerHTML = '<canvas id="the-canvas"></canvas>';
        }

        renderPage(pageNum).then(() => {
            const container = document.getElementById('canvasContainer');
            if (container) {
                container.scrollTop = scrollPos.top;
                container.scrollLeft = scrollPos.left;
            }
        });

        // Esconde botões flutuantes
        const floatParams = document.getElementById('floatingActionParams');
        if (floatParams) floatParams.classList.add('hidden');

        // --- ADICIONADO: Reseta o estado do botão caso estivesse editando ---
        window.__capturandoImagemFinal = false;
        const btnConfirm = document.querySelector('#floatingActionParams .btn--warning'); // Se mudamos a classe
        const btnSuccess = document.querySelector('#floatingActionParams .flyingBtn:first-child');

        if (btnConfirm || btnSuccess) {
            const btn = btnConfirm || btnSuccess;
            btn.innerText = "✅ Confirmar Seleção";
            btn.classList.remove('btn--warning');
            btn.classList.add('btn--success');
        }
        // -------------------------------------------------------------------

        const btnHeader = document.getElementById('btnRecortarHeader');
        if (btnHeader) {
            btnHeader.style.opacity = '1';
            btnHeader.style.pointerEvents = 'auto';
        }
    };


    window.mudarPagina = (dir) => {
        if (!pdfDoc) return;
        const newPage = pageNum + dir;
        if (newPage >= 1 && newPage <= pdfDoc.numPages) {
            pageNum = newPage;
            renderPage(pageNum);
        }
    };

    window.mudarZoom = (delta) => {
        const newScale = pdfScale + delta;
        if (newScale >= 0.5 && newScale <= 3.0) { // Limites de zoom
            pdfScale = newScale;
            renderPage(pageNum);
        }
    };

    window.salvarQuestao = () => {
        if (!cropper) return;
        const canvas = cropper.getCroppedCanvas();
        if (!canvas) return;

        // 1. Obtém a imagem LIMPA (Original)
        const base64Image = canvas.toDataURL('image/png', 1.0);

        // --- CENÁRIO 0: IMAGEM EM ALTERNATIVA (questão) ---
        if (window.__target_alt_letra !== null && window.__target_alt_index !== null) {
            const letra = window.__target_alt_letra;
            const idx = window.__target_alt_index;

            if (!window.__imagensLimpas.alternativas) {
                window.__imagensLimpas.alternativas = { questao: {}, gabarito: {} };
            }
            if (!window.__imagensLimpas.alternativas.questao[letra]) {
                window.__imagensLimpas.alternativas.questao[letra] = [];
            }

            window.__imagensLimpas.alternativas.questao[letra][idx] = base64Image;

            // CORREÇÃO AQUI: Usar __ultimaQuestaoExtraida (com duplo underscore)
            const questaoAtiva = window.__ultimaQuestaoExtraida || window.ultimaQuestaoExtraida;

            if (questaoAtiva) {
                renderizarQuestaoFinal(questaoAtiva);
            }

            customAlert("Imagem inserida na alternativa " + letra + "!", 2000);

            window.__target_alt_letra = null;
            window.__target_alt_index = null;
            cancelarRecorte();
            return;
        }

        // --- CENÁRIO: ESTRUTURA DINÂMICA (GABARITO PASSOS) ---
        if (window.__targetSlotContext && window.__targetSlotContext.startsWith('gabarito_passo_')) {
            const parts = window.__targetSlotContext.split('_');
            const passoIdx = parseInt(parts[2]); // pega o número após gabarito_passo_
            const imgIdx = window.__targetSlotIndex; // índice da imagem DENTRO do passo

            // Inicia array se não existir
            if (!window.__imagensLimpas.gabarito_passos) window.__imagensLimpas.gabarito_passos = {};
            if (!window.__imagensLimpas.gabarito_passos[passoIdx]) window.__imagensLimpas.gabarito_passos[passoIdx] = [];

            // Salva Base64
            window.__imagensLimpas.gabarito_passos[passoIdx][imgIdx] = base64Image;

            // Renderiza
            if (window.__ultimoGabaritoExtraido) {
                renderizarQuestaoFinal(window.__ultimoGabaritoExtraido);
            }

            customAlert(`Imagem inserida no Passo ${passoIdx + 1}!`, 2000);
            window.__targetSlotIndex = null;
            window.__targetSlotContext = null;
            cancelarRecorte();
            return;
        }

        // --- CENÁRIO 1: PREENCHIMENTO DE SLOT DE ESTRUTURA (NOVO) ---
        if (window.__targetSlotIndex !== null && window.__targetSlotContext !== null) {
            const ctx = window.__targetSlotContext;
            const idx = window.__targetSlotIndex;

            // 1. Atualiza o array de imagens limpas
            if (ctx === 'gabarito') {
                window.__imagensLimpas.gabarito_original[idx] = base64Image;
                // Atualiza objeto do gabarito para persistir
                if (window.__ultimoGabaritoExtraido) {
                    // Se não existir o array, cria
                    if (!window.__ultimoGabaritoExtraido.imagens_urls && !window.__ultimoGabaritoExtraido.imagens_base64) {
                        // Lógica de fallback se necessário, mas o render usa o __imagensLimpas
                    }
                    renderizarQuestaoFinal(window.__ultimoGabaritoExtraido);
                }
            } else {
                // Questão
                window.__imagensLimpas.questao_original[idx] = base64Image;
                if (window.__ultimaQuestaoExtraida) {
                    renderizarQuestaoFinal(window.__ultimaQuestaoExtraida);
                }
            }

            customAlert("✅ Imagem inserida no espaço selecionado!", 2000);

            // Limpa estado
            window.__targetSlotIndex = null;
            window.__targetSlotContext = null;
            cancelarRecorte();
            return;
        }

        // --- CENÁRIO 2: MODO SUPORTE (MANUAL) ---
        if (window.__capturandoImagemFinal === true) {
            if (window.modo === 'gabarito') {
                if (!window.__ultimoGabaritoExtraido) window.__ultimoGabaritoExtraido = {};
                if (!window.__ultimoGabaritoExtraido.imagens_suporte) window.__ultimoGabaritoExtraido.imagens_suporte = [];

                window.__ultimoGabaritoExtraido.imagens_suporte.push(base64Image);
                window.__imagensLimpas.gabarito_suporte.push(base64Image);
                customAlert("📸 Imagem de suporte adicionada ao GABARITO!", 2000);
                renderizarQuestaoFinal(window.__ultimoGabaritoExtraido);

            } else {
                if (!window.__ultimaQuestaoExtraida) window.__ultimaQuestaoExtraida = {};
                if (!window.__ultimaQuestaoExtraida.imagens_suporte) window.__ultimaQuestaoExtraida.imagens_suporte = [];

                window.__ultimaQuestaoExtraida.imagens_suporte.push(base64Image);
                window.__imagensLimpas.questao_suporte.push(base64Image);
                customAlert("📸 Imagem de suporte adicionada à QUESTÃO!", 2000);
                renderizarQuestaoFinal(window.__ultimaQuestaoExtraida);
            }

            // Auto-reopening panel after extraction (Pedido do usuário)
            window.mostrarPainel?.();

            window.__capturandoImagemFinal = false;
            cancelarRecorte();
            return;
        }

        // --- CENÁRIO 3: FLUXO IA (NORMAL) ---
        window.__recortesAcumulados.push(base64Image);
        cancelarRecorte();
        renderizarGaleriaModal();
        document.getElementById('cropConfirmModal').classList.add('visible');
    };

    // Nova função auxiliar para desenhar as imagens no modal
    window.renderizarGaleriaModal = () => {
        const gallery = document.getElementById('cropPreviewGallery');
        const counter = document.getElementById('countImagens');

        gallery.innerHTML = ''; // Limpa anterior
        counter.textContent = window.__recortesAcumulados.length;

        window.__recortesAcumulados.forEach((imgSrc, index) => {
            const wrap = document.createElement('div');
            wrap.className = 'gallery-item';
            wrap.innerHTML = `
                <img src="${imgSrc}" />
                <button onclick="removerRecorte(${index})" title="Remover">✕</button>
            `;
            gallery.appendChild(wrap);
        });
    };

    // Função para remover uma imagem específica da lista
    window.removerRecorte = (index) => {
        window.__recortesAcumulados.splice(index, 1);
        renderizarGaleriaModal();
        if (window.__recortesAcumulados.length === 0) {
            fecharModalConfirmacao(); // Se apagar tudo, fecha
        }
    };

    // Função para fechar o modal e voltar a recortar sem perder o que já tem
    window.adicionarMaisRecortes = () => {
        document.getElementById('cropConfirmModal').classList.remove('visible');
    };

    // Função auxiliar para fechar o modal e tentar de novo se quiser
    window.fecharModalConfirmacao = () => {
        document.getElementById('cropConfirmModal').classList.remove('visible');
    };

    window.recapturarQuestao = () => {
        // Apenas reativa o modo de recorte para adicionar mais ou refazer
        ativarModoRecorte();
    };

    async function carimbarBase64(base64, label) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const c = document.createElement("canvas");
                c.width = img.width;
                c.height = img.height;

                const ctx = c.getContext("2d");
                ctx.drawImage(img, 0, 0);

                // Faixa no topo
                const h = Math.max(40, Math.round(c.height * 0.08));
                ctx.fillStyle = "rgba(0,0,0,0.65)";
                ctx.fillRect(0, 0, c.width, h);

                // Texto
                ctx.fillStyle = "#fff";
                ctx.font = `${Math.round(h * 0.45)}px sans-serif`;
                ctx.textBaseline = "middle";
                ctx.fillText(label, 12, Math.round(h / 2));

                resolve(c.toDataURL("image/png", 1.0));
            };
            img.onerror = reject;
            img.src = base64;
        });
    }

    window.confirmarEnvioIA = async () => {
        if (window.__isProcessing) return;
        window.__isProcessing = true;
        window.__userInterruptedScroll = false; // Reset smart scroll flag

        // --- PEGAR RECORTES (QUESTÃO) do jeito mais simples e robusto ---
        // (mantém compatibilidade caso exista window.__recortesAcumulados em alguma versão)
        const recortesRef =
            (Array.isArray(window.recortesAcumulados) && window.recortesAcumulados) ||
            (Array.isArray(window.__recortesAcumulados) && window.__recortesAcumulados) ||
            [];

        let imagensAtuais = [...recortesRef];

        // Fallback: se por algum motivo o array zerou mas o modal tem imagem, reconstrói do DOM
        // (isso evita "Nenhuma imagem selecionada" quando a miniatura está visível)
        if (imagensAtuais.length === 0) {
            const imgsNoModal = Array.from(document.querySelectorAll("#cropPreviewGallery img"))
                .map((img) => img?.src)
                .filter((src) => typeof src === "string" && src.startsWith("data:image"));

            if (imgsNoModal.length > 0) {
                imagensAtuais = imgsNoModal;
                // ressincroniza os dois nomes (caso teu código use um ou outro em pontos diferentes)
                window.recortesAcumulados = [...imgsNoModal];
                window.__recortesAcumulados = [...imgsNoModal];
            }
        }

        // Imagens de suporte da questão (Recortar/Adicionar Figura) — só interessa no modo gabarito
        const questaoRef = window.ultimaQuestaoExtraida ?? window.__ultimaQuestaoExtraida ?? null;
        const imagensSuporteQuestao = Array.isArray(questaoRef?.imagensextraidas)
            ? questaoRef.imagensextraidas
            : [];

        // --- NOVO: SALVA AS IMAGENS LIMPAS (SEM CARIMBO) NO ESTADO GLOBAL ---
        if (window.modo === 'gabarito') {
            window.__imagensLimpas.gabarito_original = [...imagensAtuais];

            // MUDANÇA: Salva o array todo como backup
            if (imagensAtuais.length > 0 && (!window.__BACKUP_IMGS_G || window.__BACKUP_IMGS_G.length === 0)) {
                window.__BACKUP_IMGS_G = [...imagensAtuais];
            }

            // Garante que o objeto existe
            if (!window.__ultimoGabaritoExtraido) window.__ultimoGabaritoExtraido = {};
        } else {
            window.__imagensLimpas.questao_original = [...imagensAtuais];

            if (imagensAtuais.length > 0 && (!window.__BACKUP_IMGS_Q || window.__BACKUP_IMGS_Q.length === 0)) {
                window.__BACKUP_IMGS_Q = [...imagensAtuais];
            }

            if (!window.__ultimaQuestaoExtraida) window.__ultimaQuestaoExtraida = {};
        }

        // MONTA a lista final que vai pra IA
        let listaImagens = [];

        if (window.modo === "gabarito") {
            // ======== MODO GABARITO (aqui sim entra o "caralho todo") ========

            // No gabarito: manda (SUPORTE + ATUAL) e carimba para não confundir
            if (imagensSuporteQuestao.length === 0 && imagensAtuais.length === 0) {
                customAlert("Nenhuma imagem selecionada!", 2000);
                return;
            }

            const suporteCarimbado = await Promise.all(
                imagensSuporteQuestao.map((b64, i) =>
                    carimbarBase64(b64, `SUPORTE ${i + 1}/${imagensSuporteQuestao.length}`)
                )
            );

            const atuaisCarimbado = await Promise.all(
                imagensAtuais.map((b64, i) =>
                    carimbarBase64(b64, `ATUAL ${i + 1}/${imagensAtuais.length}`)
                )
            );

            // Junta tudo (suporte primeiro, tarefa atual por último) — já carimbado
            listaImagens = [...suporteCarimbado, ...atuaisCarimbado];
        } else {
            // ======== MODO QUESTÃO/PROVA (volta pro simples e eficiente) ========

            // Só manda o que o modal selecionou (recortes atuais), sem suporte e sem carimbo
            listaImagens = imagensAtuais;

            if (!listaImagens || listaImagens.length === 0) {
                customAlert("Nenhuma imagem selecionada!", 2000);
                return;
            }
        }

        // CORREÇÃO: Pegamos a primeira imagem da lista para usar no efeito visual (Skeleton)
        const base64Image = listaImagens[0];

        // 1. Controle de UI do Modal (Feedback de Carregamento)
        const btnProcessar = document.querySelector('#cropConfirmModal .btn--primary');
        const btnVoltar = document.querySelector('#cropConfirmModal .btn--secondary');

        // Segurança caso o botão não seja encontrado imediatamente
        if (!btnProcessar) return;

        const originalText = btnProcessar.innerText;

        btnProcessar.innerText = "Iniciando...";
        btnProcessar.disabled = true;
        if (btnVoltar) btnVoltar.disabled = true;

        // ======================================================
        // 1. SIDEBAR E BACKDROP
        // ======================================================
        let sidebar = document.getElementById('viewerSidebar');
        const viewerBody = document.getElementById('viewerBody');
        var main = document.getElementById('viewerMain');

        if (!sidebar) {
            sidebar = document.createElement('aside');
            sidebar.id = 'viewerSidebar';
        }

        // Verifica se já existe o backdrop
        let backdrop = document.getElementById('sidebarBackdrop');
        if (!backdrop && viewerBody) {
            backdrop = document.createElement('div');
            backdrop.id = 'sidebarBackdrop';
            // Insere dentro do viewerBody
            viewerBody.appendChild(backdrop);
            // Click no backdrop fecha
            backdrop.onclick = () => window.esconderPainel();
        }

        // ======================================================
        // 2. FUNÇÕES DE CONTROLE (Exclusividade Botão vs Painel)
        // ======================================================



        // ======================================================
        // 3. HEADER MOBILE (Handle / Slider)
        // ======================================================

        // Só cria se não existir
        if (!sidebar.querySelector('#header-mobile-toggle')) {
            const headerSidebar = document.createElement('div');
            headerSidebar.id = 'header-mobile-toggle';

            // HTML Limpo usando as classes do CSS novo
            headerSidebar.innerHTML = `
        <div class="drag-handle"></div>
    `;
            // Inserir no TOPO da sidebar
            sidebar.prepend(headerSidebar);

            // --- LÓGICA HÍBRIDA (CLIQUE + ARRASTE) ---

            // --- LÓGICA DE ARRASTE (REAL-TIME DRAG) ---
            const sidebarEl = sidebar; // Referência local
            let startY = 0;
            let currentTranslate = 0;
            let isDragging = false;
            const PEEK_HEIGHT = 50;

            const getSheetHeight = () => sidebarEl.offsetHeight;

            // Função de Toggle Helper
            const toggleSheet = () => {
                const isCollapsed = viewerBody.classList.contains('sidebar-collapsed');
                if (isCollapsed) {
                    window.mostrarPainel();
                } else {
                    window.esconderPainel();
                }
            };

            // 1. Clique: Alternar (se não houver arraste)
            headerSidebar.onclick = (e) => {
                if (isDragging) return;
                e.preventDefault();
                e.stopPropagation();
                toggleSheet();
            };

            // 2. Touch Events
            headerSidebar.addEventListener('touchstart', (e) => {
                const touch = e.touches[0];
                startY = touch.clientY;
                isDragging = false;

                // Determina posição inicial baseada na classe atual
                const isCollapsed = viewerBody.classList.contains('sidebar-collapsed');
                // Se fechado, o transform atual é (H - 50). Se aberto, é 0.
                currentTranslate = isCollapsed ? (getSheetHeight() - PEEK_HEIGHT) : 0;

                // Remove transição para arraste suave
                sidebarEl.style.transition = 'none';
            }, { passive: true });

            headerSidebar.addEventListener('touchmove', (e) => {
                const touch = e.touches[0];
                const deltaY = touch.clientY - startY;
                const newTranslate = currentTranslate + deltaY;
                const maxTranslate = getSheetHeight() - PEEK_HEIGHT;

                // Só move se estiver dentro dos limites (com resistência elástica)
                if (newTranslate >= -20 && newTranslate <= maxTranslate + 20) {
                    sidebarEl.style.transform = `translateY(${newTranslate}px)`;
                    if (Math.abs(deltaY) > 5) isDragging = true; // Considera arraste
                }
            }, { passive: true });

            headerSidebar.addEventListener('touchend', (e) => {
                sidebarEl.style.transition = ''; // Restaura transição CSS
                sidebarEl.style.transform = '';  // Remove inline para o CSS assumir

                const touch = e.changedTouches[0];
                const deltaY = touch.clientY - startY;

                // Lógica de Magnetismo
                if (Math.abs(deltaY) > 60) {
                    // Movimento significativo
                    if (deltaY > 0) {
                        window.esconderPainel(); // Para baixo -> Fechar
                    } else {
                        window.mostrarPainel(); // Para cima -> Abrir
                    }
                } else {
                    // Movimento curto -> Mantém estado ou inverte se foi muito rápido (flick)?
                    // Por segurança, mantemos o estado baseado na posição final se passou da metade? 
                    // Melhor simplificar: volta pro estado original se movimento curto
                }

                setTimeout(() => isDragging = false, 50); // Delay para não triggar click
            }, { passive: true });
        }

        // ======================================================
        // 4. INSERÇÃO NA DOM
        // ======================================================
        if (viewerBody && main && !document.getElementById('viewerSidebar')) {
            viewerBody.insertBefore(sidebar, main);
        }

        main = document.getElementById('viewerMain');
        let resizer;

        if (viewerBody && main) {
            resizer = document.getElementById('sidebarResizer');
            if (!resizer) {
                resizer = document.createElement('div');
                resizer.id = 'sidebarResizer';
            }
            viewerBody.insertBefore(resizer, main);
        }

        window.mostrarPainel();

        // Listeners do resizer
        if (resizer && !resizer.dataset.bound) {
            resizer.dataset.bound = "1";
            const MIN_WIDTH = 260;
            const MAX_WIDTH = 700;
            let isResizing = false;

            resizer.addEventListener('mousedown', (e) => {
                isResizing = true;
                resizer.classList.add('resizing');
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;
                let newWidth = e.clientX;
                if (newWidth < MIN_WIDTH) newWidth = MIN_WIDTH;
                if (newWidth > MAX_WIDTH) newWidth = MAX_WIDTH;
                const sb = document.getElementById('viewerSidebar');
                if (sb) sb.style.width = `${newWidth}px`;
            });

            document.addEventListener('mouseup', () => {
                if (!isResizing) return;
                isResizing = false;
                resizer.classList.remove('resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            });
        }

        const skeletonHTML = `
        <div id="ai-skeleton-loader" class="skeleton-wrapper" style="margin-top: 20px; border-top: 1px dashed #ccc; padding-top: 20px;">
            <div class="loading-status-area">
            <div class="spinner"></div>
            <div id="loading-text">Maia está pensando...</div>
            </div>

            <div id="maiaThoughts" class="maia-thoughts">
            <div class="maia-thought-card maia-thought-card--skeleton">
                <div class="maia-thought-logo-wrap">
                <img src="logo.png" class="maia-thought-logo" alt="Maia" />
                </div>
                <div class="maia-thought-content">
                <div class="skeleton-pulse maia-thought-title-skel"></div>
                <div class="skeleton-pulse maia-thought-line-skel"></div>
                <div class="skeleton-pulse maia-thought-line-skel short"></div>
                </div>
            </div>
            </div>
        </div>
        `;

        const loadingContainer = document.createElement('div');
        loadingContainer.id = "maia-scroll-wrapper"; // Explicit ID for mobile scrolling
        loadingContainer.innerHTML = skeletonHTML;

        const oldResult = sidebar.querySelector('.extraction-result');
        if (oldResult) oldResult.remove();

        const oldLoader = sidebar.querySelector('.skeleton-wrapper');
        if (oldLoader) oldLoader.parentElement.remove();

        sidebar.appendChild(loadingContainer);

        const thoughtListEl = document.getElementById("maiaThoughts");

        const textElement = document.getElementById("loading-text");
        function setStatus(_s) {
            if (textElement) textElement.innerText = "Maia está pensando...";
        }
        setStatus();

        function sanitizeInlineMarkdown(s) {
            return String(s || "")
                .replace(/```[\s\S]*?```/g, "")
                .replace(/\*\*/g, "")
                .replace(/__/g, "")
                .trim();
        }

        function splitThought(t) {
            const raw = String(t || "").trim();

            // 1) Caso "**TITULO** resto"
            const mBold = raw.match(/^\s*\*\*(.+?)\*\*\s*(.*)$/s);
            if (mBold) {
                return {
                    title: sanitizeInlineMarkdown(mBold[1]),
                    body: sanitizeInlineMarkdown(mBold[2]),
                };
            }

            // 2) Caso com quebra de linha: 1ª linha = título, resto = corpo
            const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            if (lines.length >= 2) {
                return {
                    title: sanitizeInlineMarkdown(lines[0]),
                    body: sanitizeInlineMarkdown(lines.slice(1).join("\n")),
                };
            }

            // 3) Caso "TITULO: corpo"
            const mColon = raw.match(/^(.{4,70}?):\s+(.+)$/s);
            if (mColon) {
                return {
                    title: sanitizeInlineMarkdown(mColon[1]),
                    body: sanitizeInlineMarkdown(mColon[2]),
                };
            }

            // 4) Caso "TITULO — corpo" ou "TITULO - corpo"
            const mDash = raw.match(/^(.{4,70}?)\s[—-]\s(.+)$/s);
            if (mDash) {
                return {
                    title: sanitizeInlineMarkdown(mDash[1]),
                    body: sanitizeInlineMarkdown(mDash[2]),
                };
            }

            // 5) Heurística do seu print: título = trecho inicial até ~60 chars
            // Ex: "Addressing the Image's Nature I've determined that..."
            // Divide no primeiro " I've / I’m / I'm / Now / ..." (inglês comum dos thoughts).
            const mHeu = raw.match(/^(.{8,60}?)(?:\s+(I['’]m|I am|I've|I have|Now|Next|Then)\b)(.*)$/s);
            if (mHeu) {
                return {
                    title: sanitizeInlineMarkdown(mHeu[1]),
                    body: sanitizeInlineMarkdown((mHeu[2] + (mHeu[3] || "")).trim()),
                };
            }

            // fallback
            return { title: "Pensamento", body: sanitizeInlineMarkdown(raw) };
        }


        let lastThoughtSig = "";
        let thoughtsBootstrapped = false;

        function pushThought(t) {
            if (!thoughtListEl) return;

            const { title, body } = splitThought(t);
            const sig = `${title}||${body}`;

            if (!body || sig === lastThoughtSig) return;
            lastThoughtSig = sig;

            // NÃO apaga os skeletons. Só marca que já começou a receber thoughts reais.
            if (!thoughtsBootstrapped) {
                thoughtsBootstrapped = true;
            }

            const card = document.createElement("div");
            card.className = "maia-thought-card";

            const logoWrap = document.createElement("div");
            logoWrap.className = "maia-thought-logo-wrap";

            const logo = document.createElement("img");
            logo.className = "maia-thought-logo";
            logo.src = "logo.png";
            logo.alt = "Maia";
            logoWrap.appendChild(logo);

            const contentEl = document.createElement("div");
            contentEl.className = "maia-thought-content";

            const titleEl = document.createElement("div");
            titleEl.className = "maia-thought-title";
            titleEl.textContent = title || "Pensamento";

            const bodyEl = document.createElement("div");
            bodyEl.className = "maia-thought-body";
            bodyEl.textContent = body || "";

            contentEl.appendChild(titleEl);
            contentEl.appendChild(bodyEl);

            card.appendChild(logoWrap);
            card.appendChild(contentEl);

            // Insere o card real ANTES do primeiro skeleton
            const firstSkeleton = thoughtListEl.querySelector(".maia-thought-card--skeleton");
            if (firstSkeleton) {
                thoughtListEl.insertBefore(card, firstSkeleton);
            } else {
                thoughtListEl.appendChild(card);
            }

            // --- SMART AUTO-SCROLL LOGIC ---
            // Usa o helper para pegar o elemento correto
            const scrollEl = window.getScrollContainer();

            // Backup: Tenta scrollar o próprio container de pensamentos se ele tiver scroll
            if (thoughtListEl && thoughtListEl.scrollHeight > thoughtListEl.clientHeight) {
                thoughtListEl.scrollTop = thoughtListEl.scrollHeight;
            }

            // Se o usuário NÃO interrompeu o scroll, rola o container correto
            if (scrollEl && !window.__userInterruptedScroll) {
                // Pequeno delay para garantir reflow no mobile
                setTimeout(() => {
                    // No mobile, evitar smooth scroll durante auto-scroll ajuda a não brigar com o browser
                    scrollEl.scrollTo({
                        top: scrollEl.scrollHeight,
                        behavior: window.innerWidth <= 900 ? 'auto' : 'auto'
                    });
                }, 10);
            } else if (window.__userInterruptedScroll) {
                // Se interrompeu, garante que o botão de "voltar" está visível
                const btnResume = document.getElementById('resumeScrollBtn');
                if (btnResume) btnResume.classList.add('visible');
            }
        }

        // --- ADD SCROLL LISTENER TO CORRECT CONTAINER (ONCE) ---
        // sidebar ainda é usado para ANEXAR o botão, mas o listener vai no scrollEl
        const scrollTarget = window.getScrollContainer();

        if (scrollTarget && !scrollTarget.dataset.scrollListenerAdded) {
            scrollTarget.dataset.scrollListenerAdded = "true";

            // Create "Resume Scroll" button (sempre anexado ao sidebar principal para posicionamento)
            const sidebarMain = document.getElementById('viewerSidebar');
            let btnResume = document.getElementById('resumeScrollBtn');

            if (sidebarMain && !btnResume) {
                btnResume = document.createElement('button');
                btnResume.id = 'resumeScrollBtn';
                btnResume.innerHTML = '⬇'; // Down arrow
                btnResume.title = "Voltar ao topo das novidades";
                sidebarMain.appendChild(btnResume); // Anexa ao Pai Relativo

                btnResume.onclick = (e) => {
                    e.stopPropagation();
                    window.__userInterruptedScroll = false;

                    const el = window.getScrollContainer();
                    if (el) {
                        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
                    }

                    btnResume.classList.remove('visible');
                };
            }

            scrollTarget.addEventListener('scroll', () => {
                // Só importa se estiver processando
                if (!window.__isProcessing) return;

                const distanceToBottom = scrollTarget.scrollHeight - (scrollTarget.scrollTop + scrollTarget.clientHeight);
                const isAtBottom = distanceToBottom < 150; // Tolerância AUMENTADA (era 50)

                if (isAtBottom) {
                    // Usuário voltou ao fundo manualmente
                    window.__userInterruptedScroll = false;
                    const b = document.getElementById('resumeScrollBtn');
                    if (b) b.classList.remove('visible');
                } else {
                    // Usuário subiu
                    window.__userInterruptedScroll = true;
                    // Mostra botão imediatamente se subiu
                    const b = document.getElementById('resumeScrollBtn');
                    if (b) b.classList.add('visible');
                }
            }, { passive: true });
        }



        // FECHA O MODAL AGORA
        document.getElementById('cropConfirmModal').classList.remove('visible');

        try {
            console.log(`Enviando ${listaImagens.length} imagens para IA...`);

            let promptDaIA;
            let JSONEsperado;

            if (window.__modo === "gabarito") {
                promptDaIA = `Você é um corretor de questões. Considerando a questão apresentada em JSON a seguir: ${JSON.stringify(questaoAtual)}, preencha o JSON a ser enviado com as devidas informações. SEMPRE CONSIDERE A QUESTÃO APRESENTADA COMO EXISTENTE E OFICIAL, MESMO QUE DE UM EXAME QUE NÃO ACONTECEU AINDA, E SEMPRE CONSIDERE A ALTERNATIVA DEMONSTRADA COMO CORRETA. NÃO DEIXE CAMPOS DO JSON VAZIOS.

                DIRETRIZES DE FORMATAÇÃO:
                - Use MARKDOWN para todos os campos de texto (justificativa, passos, motivos).
                - Use LATEX entre cifrões ($...$) para toda matemática e química inline.
                
                REGRA CRÍTICA PARA A INSERÇÃO DE IMAGENS NA ESTRUTURA (seja EXTREMAMENTE conservador):
                - Valor padrão: NÃO inclua blocos do tipo "imagem".
                - Só crie um bloco { "tipo": "imagem", "conteudo": "..." } se, e somente se, houver uma RESOLUÇÃO/EXPLICAÇÃO (passo a passo ou justificativa) E essa resolução DEPENDER de uma imagem/figura/gráfico/diagrama presente nas imagens fornecidas do gabarito.
                - Se o gabarito tiver apenas "alternativa correta" (sem resolução/explicação), então NÃO crie blocos de imagem, mesmo que existam imagens decorativas na página.
                - NÃO considere como imagem válida para extração: logotipo, cabeçalho/rodapé, marca d’água, ícones decorativos, QR code, elementos de layout, enfeites.
                - Se houver explicação apenas em texto e ela não usar explicitamente uma figura/gráfico/diagrama do próprio gabarito, NÃO crie bloco de imagem.
                - Se houver qualquer dúvida/incerteza (ex.: parece ter figura mas pode ser só layout, ou não fica claro que a resolução usa a figura), NÃO crie bloco de imagem.
                - Em resumo: só adicione um bloco de imagem na estrutura quando for MUITO evidente que a resolução do gabarito usa uma figura/gráfico/diagrama que está realmente presente nas imagens enviadas.

                “Considere somente imagens com carimbo ATUAL como evidência principal para alternativa correta e resolução.”
                “Use SUPORTE apenas para contexto/consistência; nunca para decidir a letra correta se ATUAL já contém isso. NUNCA utilize imagens de SUPORTE para dizer que há imagens na resolução.”

                ESTRUTURAÇÃO DOS PASSOS ("explicacao"):
                - cada passo da resolução é composto por uma lista de blocos ("estrutura").
                - Se um passo envolve: "Texto explicando -> Equação -> Gráfico", crie 3 blocos dentro da estrutura desse passo.
                - NÃO use OCR em imagens. Se houver uma imagem na resolução, crie um bloco {tipo: "imagem", conteudo: "descrição visual..."}.
                - CREDITE CADA PASSO, dado como gerado por IA ou como do material scaneado.

                IMPORTANTE SOBRE ESTILO E ORDEM DOS PASSOS:
                1. NÃO NUMERE OS PASSOS NO CONTEÚDO: O sistema já exibe "Passo 1", "Passo 2" automaticamente.
                - ERRADO: {tipo: "texto", conteudo: "1. Primeiramente calculamos..."}
                - CERTO: {tipo: "texto", conteudo: "Primeiramente calculamos..."}
                2. TÍTULOS DOS PASSOS: Se o passo tiver um título lógico (ex: "Cálculo da Massa"), use um bloco do tipo "titulo" como o PRIMEIRO item da estrutura desse passo.
                - Exemplo: estrutura: [ {tipo: "titulo", conteudo: "Cálculo da Massa"}, {tipo: "texto", conteudo: "..."} ]
                3. SEM PREFIXOS REDUNDANTES: Não inicie o texto com "Resolução:", "Explicação:" ou "Passo:". Vá direto ao assunto.
                4. No primeiro passo, NÃO UTILIZE UM TÍTULO como "Resolução", "Explicação", ou parecidos, pois o sistema também já realiza essa estrutura.

                REGRA PARA "analise_complexidade":
                - Seja criterioso. Marque 'true' apenas se o fator for realmente determinante para a dificuldade.
                - Na justificativa, explique qual o maior gargalo para o aluno (ex: "A dificuldade vem da união de vocabulário arcaico com a necessidade de cálculo estequiométrico").
                `;

                JSONEsperado = {
                    type: "object",
                    properties: {
                        alternativa_correta: {
                            type: "string",
                            description: "A alternativa correta, indicada no gabarito (ex.: 'A')."
                        },

                        justificativa_curta: {
                            type: "string",
                            description: "Resumo curto do porquê a alternativa correta está correta (1-2 frases)."
                        },

                        // --- NOVA SEÇÃO: MATRIZ DE COMPLEXIDADE ---
                        analise_complexidade: {
                            type: "object",
                            description: "Análise técnica da dificuldade da questão.",
                            additionalProperties: false,
                            properties: {
                                fatores: {
                                    type: "object",
                                    additionalProperties: false,
                                    properties: {
                                        // Suporte e Leitura
                                        texto_extenso: { type: "boolean", description: "Enunciado muito longo ou cansativo." },
                                        vocabulario_complexo: { type: "boolean", description: "Termos arcaicos, técnicos densos ou outra língua." },
                                        multiplas_fontes_leitura: { type: "boolean", description: "Exige cruzar dados de Texto 1 x Texto 2 ou Texto x Gráfico." },
                                        interpretacao_visual: { type: "boolean", description: "A resolução depende crucialmente de ler um gráfico, mapa ou figura." },

                                        // Conhecimento Prévio
                                        dependencia_conteudo_externo: { type: "boolean", description: "A resposta NÃO está no texto. Exige memória de fórmulas, datas ou regras." },
                                        interdisciplinaridade: { type: "boolean", description: "Envolve conceitos de duas disciplinas distintas." },
                                        contexto_abstrato: { type: "boolean", description: "Exige imaginar cenários hipotéticos ou contextos históricos não explicados." },

                                        // Raciocínio
                                        raciocinio_contra_intuitivo: { type: "boolean", description: "A resposta desafia o senso comum ou parece 'errada' à primeira vista." },
                                        abstracao_teorica: { type: "boolean", description: "Conceitos puramente teóricos sem representação física direta." },
                                        deducao_logica: { type: "boolean", description: "A resposta é construída por silogismo ou eliminação lógica complexa." },

                                        // Operacional (Universal)
                                        resolucao_multiplas_etapas: { type: "boolean", description: "Passo A leva a Passo B que leva a Passo C (cálculo ou lógica)." },
                                        transformacao_informacao: { type: "boolean", description: "Converter unidades, traduzir metáforas ou passar de gráfico para função." },
                                        distratores_semanticos: { type: "boolean", description: "Alternativas erradas muito parecidas com a correta (pegadinhas)." },
                                        analise_nuance_julgamento: { type: "boolean", description: "Exige escolher a 'mais correta' dentre opções plausíveis." }
                                    },
                                    required: [
                                        "texto_extenso",
                                        "vocabulario_complexo",
                                        "multiplas_fontes_leitura",
                                        "interpretacao_visual",
                                        "dependencia_conteudo_externo",
                                        "interdisciplinaridade",
                                        "contexto_abstrato",
                                        "raciocinio_contra_intuitivo",
                                        "abstracao_teorica",
                                        "deducao_logica",
                                        "resolucao_multiplas_etapas",
                                        "transformacao_informacao",
                                        "distratores_semanticos",
                                        "analise_nuance_julgamento"
                                    ]
                                },
                                justificativa_dificuldade: { type: "string", description: "Explicação curta do nível de dificuldade." }
                            },
                            required: ["fatores", "justificativa_dificuldade"]
                        },
                        // ------------------------------------------

                        confianca: {
                            type: "number",
                            description: "Confiança do corretor na alternativa correta (0 a 1).",
                            minimum: 0,
                            maximum: 1
                        },

                        creditos: {
                            type: "object",
                            description: "Tentativa de identificar o material/fonte do gabarito/resolução. Se não for possível, sinaliza necessidade de crédito genérico.",
                            additionalProperties: false,
                            properties: {
                                origem_resolucao: {
                                    type: "string",
                                    description: "Origem geral da resolução apresentada.",
                                    enum: ["extraido_do_material", "gerado_pela_ia"]
                                },
                                material_identificado: {
                                    type: "boolean",
                                    description: "True se foi possível identificar algum material/fonte com confiança mínima; false caso contrário."
                                },
                                confianca_identificacao: {
                                    type: "number",
                                    description: "Confiança na identificação do material/fonte (0 a 1).",
                                    minimum: 0,
                                    maximum: 1
                                },
                                material: {
                                    type: "string",
                                    description: "Nome do material/fonte identificado (ex.: 'Apostila Anglo 2022', 'FUVEST 2023', 'Coleção X - Capítulo Y')."
                                },
                                autor_ou_instituicao: {
                                    type: "string",
                                    description: "Autor/instituição editora, se reconhecível."
                                },
                                ano: {
                                    type: "string",
                                    description: "Ano associado ao material, se houver (string para aceitar '2023/2024', 's/d', etc.)."
                                },
                                como_identificou: {
                                    type: "string",
                                    description: "Breve justificativa de como o material foi identificado (ex.: cabeçalho, rodapé, padrão de diagramação, nome da banca)."
                                },
                                precisa_credito_generico: {
                                    type: "boolean",
                                    description: "True quando não há como identificar a fonte e deve-se exibir um alerta/pedido de crédito genérico."
                                },
                                texto_credito_sugerido: {
                                    type: "string",
                                    description: "Texto curto sugerido para dar crédito quando a fonte não for identificável."
                                }
                            },
                            required: ["origem_resolucao", "material_identificado", "precisa_credito_generico"]
                        },

                        alertas_credito: {
                            type: "array",
                            description: "Alertas de crédito/fonte quando o material não puder ser identificado com segurança.",
                            items: { type: "string" }
                        },

                        explicacao: {
                            type: "array",
                            description: "Lista de passos da resolução. Se não houver resolução no conteúdo enviado, gere a sua própria e sinalize isso em cada passo.",
                            items: {
                                type: "object",
                                additionalProperties: false,
                                properties: {
                                    estrutura: {
                                        type: "array",
                                        description: "Conteúdo rico deste passo (texto, equações, imagens).",
                                        items: { $ref: "#/$defs/blocoConteudo" }
                                    },
                                    origem: {
                                        type: "string",
                                        enum: ["extraido_do_material", "gerado_pela_ia"],
                                        description: "Defina se, na maioria da estrutura, há conteúdos gerados com IA ou retirados e adaptados do material."
                                    },
                                    fonte_material: {
                                        type: "string",
                                        description: "Se reconhecível, identifica material/fonte relacionada a este passo (pode repetir o 'creditos.material'). Caso não reconhecível, diga que foi tua, e coloque sua identificação aqui."
                                    },
                                    evidencia: {
                                        type: "string",
                                        description: "Sinal curto do porquê a fonte foi atribuída (ex.: 'cabeçalho', 'padrão de numeração', 'nome da instituição'). Caso tenha sido gerado por inteligência artificial, coloque aqui que não há evidências."
                                    }
                                },
                                required: ["estrutura", "origem", "fonte_material", "evidencia"]
                            }
                        },

                        alternativas_analisadas: {
                            type: "array",
                            description: "Análise curta de cada alternativa (por que está correta/errada).",
                            items: {
                                type: "object",
                                additionalProperties: false,
                                properties: {
                                    letra: { type: "string" },
                                    correta: { type: "boolean" },
                                    motivo: { type: "string" }
                                },
                                required: ["letra", "correta", "motivo"]
                            }
                        },

                        coerencia: {
                            type: "object",
                            description: "Checagens internas de consistência baseadas na questão fornecida (ajuda a detectar mismatch de gabarito).",
                            additionalProperties: false,
                            properties: {
                                alternativa_correta_existe: {
                                    type: "boolean",
                                    description: "True se a letra retornada existe nas alternativas da questão."
                                },
                                tem_analise_para_todas: {
                                    type: "boolean",
                                    description: "True se alternativas_analisadas cobre todas as alternativas fornecidas na questão."
                                },
                                observacoes: {
                                    type: "array",
                                    description: "Observações curtas de consistência (ex.: 'gabarito parece de outra questão').",
                                    items: { type: "string" }
                                }
                            },
                            required: ["alternativa_correta_existe"]
                        }
                    },
                    required: ["alternativa_correta", "analise_complexidade", "explicacao", "creditos", "coerencia", "alternativas_analisadas", "confianca", "justificativa_curta"],
                    "additionalProperties": false,
                    $defs: {
                        blocoConteudo: {
                            type: "object",
                            additionalProperties: false,
                            properties: {
                                tipo: {
                                    type: "string",
                                    enum: ["texto", "imagem", "citacao", "lista", "equacao", "codigo", "destaque", "separador", "titulo", "subtitulo", "fonte"]
                                },
                                conteudo: {
                                    type: "string",
                                    description: "Conteúdo do bloco conforme o tipo: (texto/citacao/destaque) texto literal em parágrafos; (titulo/subtitulo) cabeçalho interno do conteúdo, nunca a identificação da questão; (lista) itens em linhas separadas; (equacao) somente expressão em LaTeX; (codigo) somente o código; (imagem) descrição visual curta (alt-text) sem OCR; (separador) pode ser vazio; (fonte) créditos/referência exibível (ex: 'Fonte: ...', 'Adaptado de ...', autor/obra/URL), quando o material indicar."
                                },
                            },
                            required: ["tipo", "conteudo"]
                        }
                    }
                };

            } else {
                promptDaIA = `Você é um extrator de questões. Seu único objetivo é identificar e organizar os dados fielmente ao layout original no JSON. NÃO DEIXE CAMPOS DO JSON VAZIOS.

                REGRAS DE ESTRUTURAÇÃO ("estrutura"):
                1. NÃO jogue todo o texto em um único campo. Fatie o conteúdo em blocos sequenciais dentro do array "estrutura".
                2. Se a questão apresentar: Texto Introdutório -> Imagem -> Pergunta, seu array deve ter 3 itens: { texto }, { imagem }, { texto }.
                3. Para blocos do tipo "imagem": O campo "conteudo" deve ser uma breve descrição visual (Alt-Text) para acessibilidade. NÃO extraia o texto de dentro da imagem (OCR), apenas descreva o elemento visual.
                4. Para blocos do tipo "texto": Mantenha a formatação original tanto quanto possível.
                5. Se houver "Texto 1" e "Texto 2" separados, crie blocos de texto separados.

                Analise as imagens fornecidas (que compõem uma única questão) e gere o JSON. As imagens enviadas contém partes da mesma questão (enunciado, figuras, alternativas). Junte as informações de todas as imagens. NÃO DESCREVA O TEXTO CONTIDO EM IMAGENS (OCR). Se identificar algo que não se encaixa claramente em nenhum tipo das estruturas solicitadas, use imagem (com descrição visual curta; sem OCR).
                
                DIRETRIZES DE FORMATAÇÃO (RIGOROSAS):
                1. **MARKDOWN OBRIGATÓRIO:** Todo o conteúdo textual (exceto JSON chaves) deve ser formatado em Markdown. Use **negrito**, *itálico* onde aparecer no original.
                
                2. **MATEMÁTICA E QUÍMICA (LATEX):** - TODA fórmula matemática, símbolo, variável (como 'x', 'y') ou equação química DEVE ser escrita exclusivamente em LaTeX.
                   - **INLINE (No meio do texto):** Se a fórmula faz parte da frase, use o bloco do tipo 'texto' e envolva o LaTeX entre cifrões unitários. Exemplo: "A massa de $H_2O$ é..." ou "Sendo $x = 2$, calcule...".
                   - **DISPLAY (Isolada):** Se a fórmula aparece centralizada, sozinha em uma linha ou é muito complexa, use um bloco do tipo 'equacao' contendo APENAS o código LaTeX cru (sem cifrões).

                3. **ESTRUTURA:**
                   - Se houver Texto -> Equação Isolada -> Texto, gere 3 blocos: {tipo: 'texto'}, {tipo: 'equacao'}, {tipo: 'texto'}.
                   - Se houver Texto com equação pequena no meio, gere 1 bloco: {tipo: 'texto', conteudo: 'O valor de $x$ é...'}.
                   - JAMAIS use ASCII para matemática (nada de x^2 ou H2O normal). Use $x^2$ e $H_2O$.

                Analise as imagens fornecidas. Junte as informações de todas as imagens.`;

                JSONEsperado = {
                    "type": "object",
                    "properties": {
                        "identificacao": { "type": "string", "description": "Identificação da questão (ex: 'ENEM 2023 - Q45')." },
                        "materias_possiveis": { "type": "array", "items": { "type": "string" } },
                        "estrutura": {
                            "type": "array",
                            "description": "Lista ordenada que representa o fluxo visual da questão, mantendo a ordem exata de textos e imagens. IMPORTANTÍSSIMO: não inclua a identificação da questão (ex: 'Questão 12', 'ENEM 2023 - Q45', 'FUVEST 2022') em nenhum item desta lista; isso deve ficar exclusivamente no campo 'identificacao'. Use 'titulo' e 'subtitulo' apenas para cabeçalhos internos do conteúdo (ex: 'Texto I', 'Considere o gráfico', 'Fragmento', 'Leia o texto a seguir').",
                            "items": {
                                "type": "object",
                                "additionalProperties": false,
                                "properties": {
                                    "tipo": {
                                        "type": "string",
                                        "enum": [
                                            "texto",
                                            "imagem",
                                            "citacao",
                                            "titulo",
                                            "subtitulo",
                                            "lista",
                                            "equacao",
                                            "codigo",
                                            "destaque",
                                            "separador",
                                            "fonte"
                                        ],
                                        "description": "O tipo de conteúdo deste bloco."
                                    },
                                    "conteudo": {
                                        "type": "string",
                                        "description": "Conteúdo do bloco conforme o tipo: (texto/citacao/destaque) texto literal em parágrafos; (titulo/subtitulo) cabeçalho interno do conteúdo, nunca a identificação da questão; (lista) itens em linhas separadas; (equacao) somente expressão em LaTeX; (codigo) somente o código; (imagem) descrição visual curta (alt-text) sem OCR; (separador) pode ser vazio; (fonte) créditos/referência exibível (ex: 'Fonte: ...', 'Adaptado de ...', autor/obra/URL), quando o material indicar."
                                    }
                                },
                                "required": ["tipo", "conteudo"]
                            }
                        },
                        "palavras_chave": { "type": "array", "description": "Principais termos chave.", "items": { "type": "string" } },
                        alternativas: {
                            type: "array",
                            items: { $ref: "#/$defs/alternativa" }
                        }
                    },
                    "required": ["identificacao", "materias_possiveis", "palavras_chave", "alternativas", "estrutura"],
                    $defs: {
                        alternativa: {
                            type: "object",
                            additionalProperties: false,
                            properties: {
                                letra: { type: "string" },
                                estrutura: {
                                    type: "array",
                                    description: "Lista ordenada que representa o fluxo visual das alternativas, mantendo a ordem exata de textos e imagens.",
                                    items: { $ref: "#/$defs/blocoAlternativa" }
                                }
                            },
                            required: ["letra", "estrutura"]
                        },
                        blocoAlternativa: {
                            type: "object",
                            additionalProperties: false,
                            properties: {
                                tipo: { type: "string", enum: ["texto", "equacao", "imagem"] },
                                conteudo: {
                                    type: "string",
                                    description: "Conteúdo do bloco conforme o tipo: (texto) texto literal; (equacao) somente LaTeX; (imagem) alt-text curto sem OCR."
                                }
                            },
                            required: ["tipo", "conteudo"]
                        },
                        "additionalProperties": false
                    }
                }
            }

            setStatus(`Analisando ${listaImagens.length} imagem(ns)...`);

            const resposta = await gerarConteudoEmJSONComImagemStream(promptDaIA, JSONEsperado, listaImagens, "image/jpeg", {
                onStatus: (s) => setStatus(s),
                onThought: (t) => pushThought(t),
                onAnswerDelta: () => setStatus("Gerando JSON..."),
            });

            console.log("Resposta recebida:", resposta);

            window.__isProcessing = false;

            // --- UI/UX: GLOW EFFECT ON COMPLETION IF CLOSED ---
            const viewerBody = document.getElementById('viewerBody');
            if (viewerBody && viewerBody.classList.contains('sidebar-collapsed')) {
                if (window.innerWidth <= 900) {
                    // Mobile: Glow no handle
                    const handle = document.getElementById('header-mobile-toggle');
                    if (handle) handle.classList.add('glow-effect');
                } else {
                    // Desktop: Glow no botão de reabrir
                    const btnReopen = document.getElementById('reopenSidebarBtn');
                    if (btnReopen) btnReopen.classList.add('glow-effect');
                }
            }

            // --- NOVO: REINJETA AS IMAGENS DE SUPORTE NA RESPOSTA ---
            // A IA devolve o JSON de texto, mas precisamos anexar os base64 das imagens de suporte locais

            if (window.__modo === "gabarito") {
                // Recupera as imagens de suporte do gabarito salvas na memória
                resposta.imagens_suporte = window.__imagensLimpas.gabarito_suporte || [];

                // Salva no global
                window.__ultimoGabaritoExtraido = resposta;

                customAlert("✅ Gabarito identificado e anexado!", 3000);
                renderizarQuestaoFinal(resposta);
            } else {
                resposta.imagens_suporte = window.__imagensLimpas.questao_suporte || [];

                // 1. Verifica se existe o scan inicial (a imagem grandona)
                if (window.__imagensLimpas.questao_original && window.__imagensLimpas.questao_original.length > 0) {
                    // Salva ela dentro do objeto da resposta numa propriedade exclusiva
                    resposta.scan_original = window.__imagensLimpas.questao_original[0];
                }

                // 2. AGORA SIM, limpa a lista de "recortes de slots"
                // Isso faz com que os slots da estrutura (Fig 1, Fig 2) nasçam vazios
                window.__imagensLimpas.questao_original = [];

                // -------------------------------------------

                // Salva no global
                window.__ultimaQuestaoExtraida = resposta;
                questaoAtual = resposta;

                customAlert("✅ Questão processada com sucesso!", 3000);
                renderizarQuestaoFinal(resposta);
            }

            // Limpa a lista após o sucesso
            window.__recortesAcumulados = [];

            btnProcessar.innerText = originalText;
            btnProcessar.disabled = false;
            if (btnVoltar) btnVoltar.disabled = false;

        } catch (error) {
            window.__isProcessing = false;
            if (loadingContainer) loadingContainer.remove();

            console.error(error);
            customAlert("❌ Erro ao processar. Tente novamente.");

            document.getElementById('cropConfirmModal').classList.add('visible');

            btnProcessar.innerText = originalText;
            btnProcessar.disabled = false;
            if (btnVoltar) btnVoltar.disabled = false;
        }
    };

    window.fecharVisualizador = function () {
        // 1. PERGUNTA DE SEGURANÇA (Adicionado conforme pedido)
        // Se o usuário clicar em "Cancelar", a função para aqui e nada é perdido.
        if (!confirm("Tem certeza que deseja fechar e voltar ao início? \n\nTodo o progresso não salvo desta questão será perdido.")) {
            return;
        }

        // --- DAQUI PRA BAIXO É O RESET TOTAL (HARD RESET) ---

        // 2. Encerra cropper com segurança
        try {
            if (typeof cropper !== "undefined" && cropper) {
                cropper.destroy();
                cropper = null;
            }
        } catch (_) { }

        // 3. Remove toda a UI do viewer e modais
        const container = document.getElementById("pdfViewerContainer");
        if (container) container.remove();

        // Remove elementos "órfãos" que podem ter ficado no body
        document.getElementById("sidebarResizer")?.remove();
        document.getElementById("viewerSidebar")?.remove();
        document.getElementById("reopenSidebarBtn")?.remove();
        document.getElementById("cropConfirmModal")?.classList.remove('visible');
        document.getElementById("finalModal")?.remove();
        document.getElementById("floatingActionParams")?.classList.add("hidden"); // Esconde botões flutuantes

        // 4. Revoke das ObjectURLs para liberar memória do navegador (evita lentidão)
        try {
            if (window.__pdfUrls?.prova) URL.revokeObjectURL(window.__pdfUrls.prova);
            if (window.__pdfUrls?.gabarito) URL.revokeObjectURL(window.__pdfUrls.gabarito);
        } catch (_) { }

        // 5. ZERA TODAS AS VARIÁVEIS GLOBAIS
        window.__pdfUrls = { prova: null, gabarito: null };
        window.__viewerArgs = null;
        window.__modo = "prova";
        window.modo = "prova";
        window.__isProcessing = false;
        window.__capturandoImagemFinal = false; // Importante resetar isso

        // Limpa dados da questão e gabarito
        window.__ultimaQuestaoExtraida = null;
        window.__ultimoGabaritoExtraido = null;
        window.questaoAtual = {};

        // Limpa todas as listas de imagens e recortes
        window.__recortesAcumulados = [];
        window.recortesAcumulados = [];
        window.__imagensLimpas = {
            questao_original: [],
            questao_suporte: [],
            gabarito_original: [],
            gabarito_suporte: []
        };

        // 6. Volta para a tela inicial (Upload) LIMPA
        if (typeof generatePDFUploadInterface === "function") {
            // Passa null para garantir que o formulário venha vazio
            generatePDFUploadInterface(null);
        }
    };
}

// --- CARREGADORES DE LIB ---

window.ensureLibsLoaded = async function () {
    if (window.__libsLoaded) return;
    window.__libsLoaded = true;

    const addScript = (src) => new Promise((resolve, reject) => {
        if ([...document.querySelectorAll('script')].some(s => s.src.includes(src))) return resolve();
        const s = document.createElement('script');
        s.src = src;
        s.defer = true;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });

    const addCss = (href) => {
        if ([...document.querySelectorAll('link')].some(l => l.href.includes(href))) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    };

    // Carrega KaTeX (Matemática)
    addCss('https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.css');
    await addScript('https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/katex.min.js');
    await addScript('https://cdn.jsdelivr.net/npm/katex@0.16.25/dist/contrib/auto-render.min.js');

    // Carrega Marked (Markdown)
    await addScript('https://cdn.jsdelivr.net/npm/marked/marked.min.js');
};

window.renderLatexIn = async function (rootEl) {
    await window.ensureLibsLoaded();

    // Renderiza Markdown nos elementos que pedem (classe .markdown-content)
    if (window.marked && rootEl) {
        rootEl.querySelectorAll('.markdown-content').forEach(el => {
            // Pega o texto cru (raw markdown) e converte pra HTML
            // O renderer do marked as vezes escapa o LaTeX, vamos proteger o cifrão
            const raw = el.getAttribute('data-raw') || el.innerHTML;
            el.innerHTML = window.marked.parse(raw);
        });
    }

    // Renderiza LaTeX (Matemática)
    if (window.renderMathInElement && rootEl) {
        window.renderMathInElement(rootEl, {
            delimiters: [
                { left: "\\[", right: "\\]", display: true }, // Bloco isolado
                { left: "$$", right: "$$", display: true },   // Bloco isolado (alternativo)
                { left: "\\(", right: "\\)", display: false },// Inline padrão
                { left: "$", right: "$", display: false }     // Inline prático (Preferido da IA)
            ],
            throwOnError: false
        });
    }
};


window.mostrarBotaoReabrirPainel = () => {
    // [ALTERAÇÃO]: Bloqueio explícito para mobile (não deve aparecer botão flutuante)
    if (window.innerWidth <= 900) return;

    // Se já existe, não duplica
    if (document.getElementById('reopenSidebarBtn')) return;

    const panel = document.getElementById('canvasContainer'); // << novo alvo
    if (!panel) return;

    // garante que o botão pos absolute funcione dentro do main
    panel.style.position = 'relative';

    const btn = document.createElement('button');
    btn.id = 'reopenSidebarBtn';
    btn.className = 'flyingBtn';
    btn.type = 'button';
    btn.title = 'Reabrir painel da questão';
    btn.innerHTML = '💬';

    // “copia o estilo” do flyingBtn + deixa circular + fixa no topo esquerdo do preview
    btn.style.position = 'absolute';
    btn.style.top = '12px';
    btn.style.left = '12px';
    btn.style.width = '44px';
    btn.style.height = '44px';
    btn.style.padding = '0';
    btn.style.borderRadius = '999px';
    btn.style.zIndex = '99999';

    btn.onclick = () => {
        window.mostrarPainel?.();
    };

    console.log("Criando botão reabrir:", panel, btn);
    panel.appendChild(btn);
};

// --- FUNÇÕES PARA CAPTURA DE IMAGEM FINAL (DENTRO DO JSON) ---

window.iniciarCapturaImagemQuestao = () => {
    window.__capturandoImagemFinal = true;
    ativarModoRecorte();

    // Feedback visual no botão flutuante
    const btnConfirm = document.querySelector('#floatingActionParams .btn--success');
    if (btnConfirm) {
        const destino = window.modo === 'gabarito' ? 'Gabarito' : 'Questão';
        btnConfirm.innerText = `💾 Salvar Figura (${destino})`;
        btnConfirm.classList.remove('btn--success');
        btnConfirm.classList.add('btn--warning');
    }
};

// Atualiza a função de clique para funcionar em ambos os modos
window.onClickImagemFinal = function () {
    // Agora permitimos nos dois modos!
    window.iniciarCapturaImagemQuestao();
};

// Permite reativar/desativar sem re-renderizar tudo
window.sincronizarEstadoImagemFinal = function () {
    const btn = document.getElementById('btnImagemFinal');
    if (!btn) return;

    const g = window.modo === 'gabarito';
    btn.disabled = g;
    btn.textContent = g ? '⚠️ Recortar só na Prova' : '📷 Recortar/Adicionar Figura';
    btn.classList.toggle('btn--disabled', g);
};

window.removerImagemFinal = (index, tipo) => {
    // Tipo: 'questao' ou 'gabarito'
    if (tipo === 'gabarito') {
        if (window.__ultimoGabaritoExtraido?.imagens_suporte) {
            window.__ultimoGabaritoExtraido.imagens_suporte.splice(index, 1);
            window.__imagensLimpas.gabarito_suporte.splice(index, 1); // Mantém sincronia
            renderizarQuestaoFinal(window.__ultimoGabaritoExtraido);
        }
    } else {
        if (window.__ultimaQuestaoExtraida?.imagens_suporte) {
            window.__ultimaQuestaoExtraida.imagens_suporte.splice(index, 1);
            window.__imagensLimpas.questao_suporte.splice(index, 1);
            renderizarQuestaoFinal(window.__ultimaQuestaoExtraida);
        }
    }
};

window.criarHtmlBlocoEditor = function (tipo, conteudo) {
    const safeContent = String(conteudo ?? "").replace(/"/g, "&quot;");
    const t = String(tipo ?? "texto").toLowerCase().trim();

    const CFG = {
        texto: { label: "TEXTO", kind: "textarea", rows: 4, placeholder: "Parágrafo de texto..." },
        titulo: { label: "TÍTULO", kind: "input", placeholder: "Título (curto)..." },
        subtitulo: { label: "SUBTÍTULO", kind: "input", placeholder: "Subtítulo..." },
        citacao: { label: "CITAÇÃO", kind: "textarea", rows: 3, placeholder: "Texto da citação..." },
        lista: { label: "LISTA", kind: "textarea", rows: 4, placeholder: "Um item por linha..." },
        equacao: { label: "EQUAÇÃO", kind: "textarea", rows: 2, placeholder: "LaTeX (ex: \\frac{a}{b})" },
        codigo: { label: "CÓDIGO", kind: "textarea", rows: 6, placeholder: "Cole o código aqui..." },
        destaque: { label: "DESTAQUE", kind: "textarea", rows: 3, placeholder: "Trecho para destacar..." },
        fonte: { label: "FONTE", kind: "textarea", rows: 2, placeholder: "Créditos / referência (ex: Fonte: ..., Adaptado de ...)" },
        imagem: { label: "IMAGEM", kind: "input", placeholder: "Legenda/Alt-text (ex: Mapa, gráfico...)" },
        separador: { label: "SEPARADOR", kind: "separador" }
    };

    const cfg = CFG[t] ?? CFG.texto;

    let inputHtml = "";
    if (cfg.kind === "input") {
        inputHtml = `<input type="text" class="form-control item-content" value="${safeContent}" placeholder="${cfg.placeholder}">`;
    } else if (cfg.kind === "textarea") {
        inputHtml = `<textarea class="form-control item-content" rows="${cfg.rows}" placeholder="${cfg.placeholder}">${safeContent}</textarea>`;
    } else if (cfg.kind === "separador") {
        // mantém item-content para o salvamento ser consistente
        inputHtml = `
      <input type="hidden" class="item-content" value="">
      <div style="font-size:11px;color:var(--color-text-secondary);font-family:var(--font-family-mono);">
        (Sem conteúdo — este bloco só cria uma linha separadora)
      </div>
    `;
    }

    const label = cfg.label;

    return `
    <div class="structure-item" draggable="true" data-type="${t}">
      <div class="drag-handle">⋮⋮</div>
      <div class="structure-item-content">
        <div class="structure-item-header">
          <span class="structure-type-badge ${t}">${label}</span>
          <button type="button" class="btn-delete-block" title="Remover bloco">×</button>
        </div>
        ${inputHtml}
      </div>
    </div>
  `;
};


function ensureDeleteConfirmModal() {
    if (document.getElementById('deleteConfirmModal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'deleteConfirmModal';
    overlay.className = 'modal-overlay hidden';
    overlay.innerHTML = `
    <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="delTitle">
      <div class="modal-header">
        <h2 id="delTitle">Remover bloco?</h2>
      </div>

      <div class="modal-body">
        <p>Tem certeza que deseja remover este bloco? Você poderá desfazer logo em seguida.</p>
      </div>

      <div class="modal-footer" style="display:flex; gap:10px; justify-content:flex-end;">
        <button type="button" class="btn btn--secondary" id="delCancelBtn">Cancelar</button>
        <button type="button" class="btn btn--primary" id="delOkBtn">Remover</button>
      </div>
    </div>
  `;

    document.body.appendChild(overlay);

    // Fecha ao clicar fora
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.add('hidden');
    });
}

function openDeleteConfirmModal(onConfirm) {
    ensureDeleteConfirmModal();

    const overlay = document.getElementById('deleteConfirmModal');
    const btnCancel = document.getElementById('delCancelBtn');
    const btnOk = document.getElementById('delOkBtn');

    const close = () => overlay.classList.add('hidden');

    btnCancel.onclick = close;
    btnOk.onclick = () => { close(); onConfirm?.(); };

    overlay.classList.remove('hidden');
}

let undoToastTimer = null;

function showUndoToast(message, onUndo, duration = 6000) {
    // Remove toast anterior (se houver)
    document.getElementById('undoToast')?.remove();
    if (undoToastTimer) clearTimeout(undoToastTimer);

    const toast = document.createElement('div');
    toast.id = 'undoToast';
    toast.className = 'undo-toast';
    toast.innerHTML = `
    <span class="undo-msg">${message}</span>
    <button type="button" class="btn btn--sm btn--outline" id="undoBtn">Desfazer</button>
  `;

    document.body.appendChild(toast);

    toast.querySelector('#undoBtn').onclick = () => {
        onUndo?.();
        toast.remove();
        if (undoToastTimer) clearTimeout(undoToastTimer);
    };

    undoToastTimer = setTimeout(() => toast.remove(), duration);
}


/**
 * Inicializa os eventos de Drag & Drop e Botões de Deletar.
 * Agora aceita um parâmetro 'targetContainer'. Se não passar nada, usa o padrão.
 */
window.iniciarEditorEstrutura = function (targetContainer) {
    // 1. DEFINE O ALVO: Se passou um elemento específico, usa ele. Se não, tenta achar o container principal da questão.
    const container = targetContainer || document.getElementById('editor-drag-container');

    // Se não achou nenhum container, para por aqui.
    if (!container) return;

    // --- PARTE 1: DELETAR BLOCOS (Com prevenção de cliques duplos) ---

    // Define a função de clique para deletar
    const deleteHandler = (e) => {
        const btn = e.target.closest('.btn-delete-block');
        if (!btn) return;

        const item = btn.closest('.structure-item');
        if (!item) return;

        // Chama seu modal global de confirmação
        openDeleteConfirmModal(() => {
            const parent = item.parentNode;
            const next = item.nextSibling; // guarda quem estava depois para poder desfazer

            item.remove();

            // Mostra o toast para desfazer a ação
            showUndoToast('Bloco removido.', () => {
                if (next && next.parentNode === parent) {
                    parent.insertBefore(item, next);
                } else {
                    parent.appendChild(item);
                }
            });
        });
    };

    // TRUQUE IMPORTANTE: Remove o listener anterior antes de adicionar um novo.
    // Isso evita que, se você chamar essa função 2 vezes, o botão de deletar funcione 2 vezes.
    container.removeEventListener('click', container._deleteHandlerRef);
    container._deleteHandlerRef = deleteHandler; // Salva a referência no próprio elemento DOM
    container.addEventListener('click', container._deleteHandlerRef);


    // --- PARTE 2: LÓGICA DRAG & DROP (Arrastar e Soltar) ---

    let draggedItem = null;

    // Quando começa a arrastar
    const dragStartHandler = (e) => {
        if (!e.target.classList.contains('structure-item')) return;
        draggedItem = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        // Hack para o drag image não atrapalhar visualmente
        if (e.dataTransfer.setDragImage) {
            // Opcional: ajustar imagem de drag se quiser
        }
    };

    // Quando termina de arrastar
    const dragEndHandler = (e) => {
        if (!e.target.classList.contains('structure-item')) return;
        e.target.classList.remove('dragging');
        draggedItem = null;
    };

    // Enquanto está passando por cima (calcula onde soltar)
    const dragOverHandler = (e) => {
        e.preventDefault(); // Necessário para permitir o drop
        const afterElement = getDragAfterElement(container, e.clientY);

        if (draggedItem) {
            if (afterElement == null) {
                container.appendChild(draggedItem);
            } else {
                container.insertBefore(draggedItem, afterElement);
            }
        }
    };

    // Remove listeners antigos de Drag (para evitar duplicação)
    container.removeEventListener('dragstart', container._dragStartRef);
    container.removeEventListener('dragend', container._dragEndRef);
    container.removeEventListener('dragover', container._dragOverRef);

    // Salva referências e adiciona novos
    container._dragStartRef = dragStartHandler;
    container._dragEndRef = dragEndHandler;
    container._dragOverRef = dragOverHandler;

    container.addEventListener('dragstart', container._dragStartRef);
    container.addEventListener('dragend', container._dragEndRef);
    container.addEventListener('dragover', container._dragOverRef);


    // --- HELPER: Calcula a posição do mouse em relação aos itens ---
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.structure-item:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;

            // Se o offset é negativo (estamos acima do centro do elemento) e maior que o anterior...
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }


    // --- PARTE 3: BOTÕES ADICIONAR (APENAS PARA O EDITOR PRINCIPAL) ---
    // Esta parte só roda se NÃO passarmos um container específico, ou se o container for o principal.
    // Os passos do gabarito têm seus próprios botões configurados em outro lugar.

    if (!targetContainer || container.id === 'editor-drag-container') {
        const addBtnContainer = document.getElementById('editor-add-buttons');

        if (addBtnContainer) {
            // Limpa eventos antigos para não duplicar se renderizar a tela de novo
            const novoContainerBtn = addBtnContainer.cloneNode(true);
            addBtnContainer.parentNode.replaceChild(novoContainerBtn, addBtnContainer);

            // Re-seleciona o elemento novo limpo
            const toolbar = document.getElementById('editor-add-buttons');
            const menu = toolbar.querySelector("#editorAddMenu");
            const toggleBtn = toolbar.querySelector("#btnToggleAddMenu");

            // Configura cliques dos botões de adicionar bloco
            toolbar.querySelectorAll('.btn-add-block').forEach(btn => {
                btn.onclick = () => {
                    const tipo = btn.dataset.addType;
                    const html = window.criarHtmlBlocoEditor(tipo, "");

                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = html.trim();
                    const novoEl = tempDiv.firstChild;

                    container.appendChild(novoEl);
                    novoEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    if (menu) menu.classList.add("hidden");
                };
            });

            // Configura o Menu Dropdown (se existir)
            if (toggleBtn && menu) {
                toggleBtn.onclick = (e) => {
                    e.preventDefault();
                    menu.classList.toggle("hidden");
                };

                // Fecha ao clicar fora
                document.addEventListener("click", (e) => {
                    if (!toolbar.contains(e.target)) menu.classList.add("hidden");
                });
            }
        }
    }
};

window.renderizarEstruturaHTML = function (estrutura, imagensExternas = [], contexto = 'questao') {
    if (!estrutura || !Array.isArray(estrutura) || estrutura.length === 0) { return ""; }

    let imgIndex = 0;
    let html = `<div class="structure-container">`;

    // Define se é modo somente leitura (Banco)
    const isReadOnly = (contexto === 'banco');

    estrutura.forEach((bloco) => {
        const tipo = (bloco?.tipo || 'imagem').toLowerCase();
        const conteudoRaw = bloco?.conteudo ? String(bloco.conteudo) : '';
        const conteudoSafe = conteudoRaw.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        const criarBlocoMarkdown = (classeExtra) => {
            return `<div class="structure-block ${classeExtra} markdown-content" data-raw="${conteudoSafe}">${conteudoRaw}</div>`;
        };

        // --- BLOCOS DE TEXTO/CÓDIGO (Iguais) ---
        if (tipo === 'texto') { html += criarBlocoMarkdown('structure-text'); return; }
        if (tipo === 'citacao') { html += criarBlocoMarkdown('structure-citacao'); return; }
        if (tipo === 'destaque') { html += criarBlocoMarkdown('structure-destaque'); return; }
        if (tipo === 'titulo') { html += criarBlocoMarkdown('structure-titulo'); return; }
        if (tipo === 'subtitulo') { html += criarBlocoMarkdown('structure-subtitulo'); return; }
        if (tipo === 'fonte') { html += criarBlocoMarkdown('structure-fonte'); return; }

        if (tipo === 'lista') {
            // Quebra o texto em linhas e limpa espaços vazios
            const itens = conteudoRaw.split('\n').map(s => s.trim()).filter(Boolean);

            // Removemos a <ul> manual e deixamos o marked cuidar da lista inteira
            // ou garantimos que o marked não trate cada linha como uma nova lista.
            html += `<div class="structure-block structure-lista markdown-content" data-raw="${conteudoSafe}">${conteudoRaw}</div>`;
            return;
        }
        if (tipo === 'equacao') { html += `<div class="structure-block structure-equacao">\\[${conteudoRaw}\\]</div>`; return; }
        if (tipo === 'codigo') { html += `<pre class="structure-block structure-codigo"><code>${conteudoRaw}</code></pre>`; return; }
        if (tipo === 'separador') { html += `<hr class="structure-block structure-separador" />`; return; }

        // --- CORREÇÃO DA LÓGICA DE IMAGEM ---

        // 1. Tenta achar a URL dentro do próprio bloco (Padrão do Firebase após upload)
        // 2. Se não achar, tenta no array externo (Padrão do Editor local)
        let src = bloco.imagem_base64 || bloco.imagem_url || bloco.url || imagensExternas?.[imgIndex];

        const currentIndex = imgIndex;
        imgIndex++; // Incrementa sempre que passa por um bloco tipo imagem

        if (src) {
            // IMAGEM EXISTE
            if (isReadOnly) {
                // MODO BANCO: Apenas a imagem, sem botões, com zoom
                html += `
                <div class="structure-block structure-image-wrapper">
                    <img src="${src}" class="structure-img" onclick="window.expandirImagem(this.src)" title="Clique para ampliar" style="cursor:zoom-in;">
                    ${conteudoRaw ? `<div class="structure-caption markdown-content" data-raw="${conteudoSafe}">${conteudoRaw}</div>` : ''}
                </div>`;
            } else {
                // MODO EDITOR: Com botões de trocar
                html += `
                <div class="structure-block structure-image-wrapper">
                    <img src="${src}" class="structure-img" onclick="window.expandirImagem(this.src)">
                    ${conteudoRaw ? `<div class="structure-caption markdown-content" data-raw="${conteudoSafe}">IA: ${conteudoRaw}</div>` : ''}
                    <button class="btn-trocar-img" onclick="window.iniciarCapturaParaSlot(${currentIndex}, '${contexto}')">
                        <span class="btn-ico">🔄</span><span>Trocar Imagem</span>
                    </button>
                </div>`;
            }
        } else {
            // IMAGEM FALTANDO (Placeholder)
            if (isReadOnly) {
                // MODO BANCO: Não mostra placeholder de "adicionar", mostra aviso discreto ou nada
                html += `<div class="structure-block" style="padding:10px; border:1px dashed #ccc; color:gray; font-size:11px; text-align:center;">(Imagem não disponível)</div>`;
            } else {
                // MODO EDITOR: Placeholder clicável
                html += `
                <div class="structure-block structure-image-placeholder" onclick="window.iniciarCapturaParaSlot(${currentIndex}, '${contexto}')">
                    <div class="icon">📷</div><strong>Adicionar Imagem Aqui</strong>
                    <div class="markdown-content" data-raw="${conteudoSafe}" style="font-size:11px;color:var(--color-text-secondary);margin-top:4px;">IA: ${conteudoRaw}</div>
                </div>`;
            }
        }
    });

    html += `</div>`;
    return html;
};

window.renderizar_estrutura_alternativa = function (estrutura, letra, imagensExternas = [], contexto = 'questao') {
    if (!Array.isArray(estrutura) || estrutura.length === 0) return "";

    let imgIndex = 0;
    const isReadOnly = (contexto === 'banco');

    // Fallback para imagens externas se não estiverem no bloco
    const imgsFallback = (imagensExternas && imagensExternas.length > 0)
        ? imagensExternas
        : (window.__imagensLimpas?.alternativas?.questao?.[letra] || []);

    let html = `<div class="alt-estrutura">`;

    estrutura.forEach((bloco) => {
        const tipo = String(bloco?.tipo || "texto").toLowerCase();
        // Prepara o conteúdo para exibição (HTML Safe) e para atributo (Quote Safe)
        const conteudo = String(bloco?.conteudo || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const conteudoRawAttr = String(bloco?.conteudo || "").replace(/"/g, "&quot;");
        const temConteudo = bloco?.conteudo && String(bloco.conteudo).trim().length > 0;

        if (tipo === "texto") {
            html += `<div class="structure-block structure-text markdown-content" data-raw="${conteudoRawAttr}">${conteudo}</div>`;
            return;
        }
        if (tipo === "equacao") {
            html += `<div class="structure-block structure-equacao">\\[${conteudo}\\]</div>`;
            return;
        }

        // --- IMAGEM ---
        // Prioridade: URL no bloco > Array externo
        const src = bloco.imagem_base64 || bloco.imagem_url || imgsFallback[imgIndex];
        const current = imgIndex;
        imgIndex++; // Incrementa contador de imagens

        if (src) {
            if (isReadOnly) {
                // MODO BANCO: Imagem + Legenda (sem botão)
                html += `
                <div class="structure-block structure-image-wrapper">
                  <img src="${src}" class="structure-img" onclick="window.expandirImagem(this.src)" style="cursor:zoom-in" />
                  ${temConteudo ? `<div class="structure-caption markdown-content" data-raw="${conteudoRawAttr}" style="font-size:0.9em; margin-top:5px; color:#555;">${conteudo}</div>` : ''}
                </div>`;
            } else {
                // MODO EDITOR: Imagem + Legenda (IA) + Botão
                html += `
                <div class="structure-block structure-image-wrapper">
                  <img src="${src}" class="structure-img" onclick="window.expandirImagem(this.src)" />
                  ${temConteudo ? `<div class="structure-caption markdown-content" data-raw="${conteudoRawAttr}" style="font-size:11px; margin-top:4px; color:var(--color-text-secondary);">IA: ${conteudo}</div>` : ''}
                  <button class="btn-trocar-img" onclick="window.iniciar_captura_para_slot_alternativa('${letra}', ${current})">
                    <span class="btn-ico">🔄</span>
                  </button>
                </div>`;
            }
        } else if (!isReadOnly) {
            // Placeholder só no editor + Legenda (IA)
            html += `
            <div class="structure-block structure-image-placeholder" onclick="window.iniciar_captura_para_slot_alternativa('${letra}', ${current})">
              <div class="icon">📷</div>
              ${temConteudo ? `<div class="markdown-content" data-raw="${conteudoRawAttr}" style="font-size:10px; color:gray; margin-top:4px; max-width:100%; overflow:hidden; text-overflow:ellipsis;">IA: ${conteudo}</div>` : ''}
            </div>`;
        }
    });

    html += `</div>`;
    return html;
};

// Listener único para fechar menus de passos ao clicar fora
if (!window._stepMenuGlobalListener) {
    document.addEventListener('click', (e) => {
        // Se o clique NÃO foi num botão de abrir menu, fecha todos os menus de passos
        if (!e.target.closest('.btn-toggle-step-add') && !e.target.closest('.step-menu-content')) {
            document.querySelectorAll('.step-menu-content').forEach(m => m.classList.add('hidden'));
        }
    });
    window._stepMenuGlobalListener = true;
}

/**
 * Renderiza os dados finais da Questão na Sidebar.
 */
window.renderizarQuestaoFinal = function (dados, elementoAlvo = null) {
    // --- 1. NORMALIZAÇÃO DOS DADOS ---f
    const joinLines = (arr) => Array.isArray(arr) ? arr.join('\n') : (arr || "");

    // --- ADICIONE ESTA LINHA AQUI ---
    const safe = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    // --------------------------------

    // pick: pega o primeiro valor realmente "útil" (não undefined/null/"")
    const pick = (...values) => {
        for (const v of values) {
            if (v === undefined || v === null) continue;
            if (typeof v === "string" && v.trim() === "") continue;
            return v;
        }
        return undefined;
    };

    // helper: sempre devolve array (ou [])
    const asArray = (v) => (Array.isArray(v) ? v : (v == null ? [] : [v]));

    // helper: converte string/array/objeto em array de strings (para alertas/observações etc.)
    const asStringArray = (v) => {
        if (v == null) return [];
        if (Array.isArray(v)) return v.map((x) => String(x));
        if (typeof v === "string") return v.split("\n").map((s) => s.trim()).filter(Boolean);
        if (typeof v === "object") return Object.values(v).map((x) => String(x));
        return [String(v)];
    };

    // helper: alternativas analisadas pode vir como array de objetos, array de strings, ou objeto {A: "...", B: "..."}
    const normalizeAlternativasAnalisadas = (v, respostaLetra) => {
        if (v == null) return [];

        // Caso 1: veio como objeto mapa {A: "...", B: "..."}
        if (!Array.isArray(v) && typeof v === "object") {
            return Object.entries(v).map(([letra, motivo]) => {
                const letraStr = String(letra);
                return {
                    letra: letraStr,
                    correta: respostaLetra ? (letraStr.toUpperCase() === String(respostaLetra).toUpperCase()) : false,
                    motivo: String(motivo ?? "")
                };
            });
        }

        // Caso 2: veio como array
        if (Array.isArray(v)) {
            // array de strings
            if (v.length > 0 && typeof v[0] === "string") {
                return v.map((motivo) => ({
                    letra: "?",
                    correta: false,
                    motivo: String(motivo ?? "")
                }));
            }

            // array de objetos (formato esperado)
            return v.map((a) => {
                const letra = pick(a?.letra, a?.option, a?.alternativa, a?.key, "?");
                const correta = !!pick(a?.correta, a?.isCorrect, a?.certa, false);
                const motivo = pick(a?.motivo, a?.explain, a?.explicacao, a?.justificativa, a?.reason, "");

                return {
                    letra: String(letra ?? "?"),
                    correta,
                    motivo: String(motivo ?? "")
                };
            });
        }

        // Caso 3: veio como "qualquer coisa" (string/número)
        return [{
            letra: "?",
            correta: false,
            motivo: String(v ?? "")
        }];
    };

    // helper: explicacao agora retorna OBJETOS com ESTRUTURA
    const normalizeExplicacao = (v) => {
        if (v == null) return [];

        const createStep = (estruturaArr, meta = {}) => ({
            estrutura: estruturaArr, // Array de blocos
            origem: String(meta.origem ?? "geradopelaia"),
            fontematerial: String(meta.fontematerial ?? meta.fonteMaterial ?? ""),
            evidencia: String(meta.evidencia ?? "")
        });

        // Caso 1: String simples (formato legado) -> Converte para bloco texto
        if (typeof v === "string") {
            const linhas = v.split("\n").map(s => s.trim()).filter(Boolean);
            return linhas.map(linha => createStep([{ tipo: 'texto', conteudo: linha }]));
        }

        // Caso 2: Array
        if (Array.isArray(v)) {
            if (v.length === 0) return [];

            // Array de strings
            if (typeof v[0] === "string") {
                return v.map(s => createStep([{ tipo: 'texto', conteudo: String(s).trim() }]));
            }

            // Array de objetos
            return v.map(p => {
                // SE JÁ TEM ESTRUTURA (Novo formato da IA)
                if (Array.isArray(p.estrutura)) {
                    return createStep(p.estrutura, p);
                }

                // SE TEM PASSO (Formato antigo ou misto)
                if (p.passo) {
                    return createStep([{ tipo: 'texto', conteudo: String(p.passo) }], p);
                }

                return null;
            }).filter(Boolean);
        }

        return [];
    };

    // FIX: aceita snake_case e camelCase + aliases comuns
    const normCreditos = (c) => {
        if (!c) return null;

        const origemresolucao = pick(c.origemresolucao, c.origem_resolucao, c.origemResolucao, "");
        const materialidentificado = !!pick(
            c.materialidentificado,
            c.material_identificado,
            c.materialIdentificado,
            false
        );
        const confiancaidentificacao = pick(
            c.confiancaidentificacao,
            c.confianca_identificacao,
            c.confiancaIdentificacao,
            null
        );
        const material = pick(c.material, c.nomeMaterial, c.nome_material, "");
        const autorouinstituicao = pick(
            c.autorouinstituicao,
            c.autor_ou_instituicao,
            c.autorOuInstituicao,
            ""
        );
        const ano = pick(c.ano, c.year, "");
        const comoidentificou = pick(c.comoidentificou, c.como_identificou, c.comoIdentificou, "");
        const precisacreditogenerico = !!pick(
            c.precisacreditogenerico,
            c.precisa_credito_generico,
            c.precisaCreditoGenerico,
            false
        );
        const textocreditosugerido = pick(
            c.textocreditosugerido,
            c.texto_credito_sugerido,
            c.textoCreditoSugerido,
            ""
        );

        return {
            origemresolucao: String(origemresolucao ?? ""),
            materialidentificado,
            confiancaidentificacao,
            material: String(material ?? ""),
            autorouinstituicao: String(autorouinstituicao ?? ""),
            ano: String(ano ?? ""),
            comoidentificou: String(comoidentificou ?? ""),
            precisacreditogenerico,
            textocreditosugerido: String(textocreditosugerido ?? "")
        };
    };

    // A IA às vezes manda o payload embrulhado (resultado/data/etc.)
    const root = pick(dados?.resultado, dados?.data, dados?.payload, dados) ?? {};
    const creditosRaw = pick(root?.creditos, root?.creditos_fonte, root?.creditosFonte, null);

    // Detecta se é Gabarito
    const isGabaritoData = (dados === window.__ultimoGabaritoExtraido) ||
        (window.__modo === 'gabarito' && !window.__ultimaQuestaoExtraida) ||
        (root?.alternativa_correta || root?.resposta);

    const rawAlternativa = pick(root?.alternativa_correta, root?.alternativacorreta, root?.alternativaCorreta, root?.resposta, "");
    const respostaLetra = String(rawAlternativa ?? "").trim().toUpperCase();

    // Base inicial limpa
    let dadosNorm = {};

    if (isGabaritoData) {
        // --- GABARITO (COM INJEÇÃO DE IMAGENS NOS PASSOS) ---

        // 1. Prepara a base da explicação (Texto/Estrutura)
        const explicacaoBasica = normalizeExplicacao(pick(root?.explicacao, root?.resolucao, []));

        // 2. LÓGICA DE INJEÇÃO (Igual à da Questão)
        const explicacaoComImagens = explicacaoBasica.map((passo, idxPasso) => {
            // Busca imagens recém-recortadas para ESTE passo específico
            // (Lembrando que gabarito_passos é um objeto { 0:[], 1:[] ... })
            const imgsDestePasso = window.__imagensLimpas?.gabarito_passos?.[idxPasso] || [];
            let cursorImg = 0;

            // Percorre a estrutura do passo e injeta o base64 onde for tipo 'imagem'
            const novaEstrutura = (passo.estrutura || []).map(bloco => {
                const tipo = String(bloco.tipo || "texto").toLowerCase();

                if (tipo === 'imagem') {
                    // Pega da memória local OU mantém o que já estava salvo (segurança para edição)
                    const imgBase64 = imgsDestePasso[cursorImg] || bloco.imagem_base64 || null;
                    cursorImg++;

                    return {
                        ...bloco,
                        imagem_base64: imgBase64
                    };
                }
                return bloco;
            });

            return {
                ...passo,
                estrutura: novaEstrutura
            };
        });

        dadosNorm = {
            // Campos básicos
            alternativa_correta: String(pick(root?.alternativa_correta, root?.resposta, root?.alternativacorreta, "") ?? ""),
            justificativa_curta: String(pick(root?.justificativa_curta, root?.justificativacurta, "") ?? ""),
            confianca: pick(root?.confianca, null),

            // Objetos complexos
            analise_complexidade: root?.analise_complexidade ?? {},

            // AQUI ESTÁ A DIFERENÇA: Usamos a explicação já com as imagens injetadas
            explicacao: explicacaoComImagens,

            creditos: normCreditos(root?.creditos),
            alertas_credito: asStringArray(pick(root?.alertas_credito, [])),
            observacoes: asStringArray(pick(root?.observacoes, [])),

            alternativas_analisadas: normalizeAlternativasAnalisadas(
                pick(root?.alternativas_analisadas, []),
                String(pick(root?.alternativa_correta, root?.resposta, ""))
            ),
            coerencia: root?.coerencia ?? {}
        };
    } else {
        // --- QUESTÃO LIMPA (COM IMAGENS INJETADAS E SEM REDUNDÂNCIA) ---

        const imgsEnunciado = window.__imagensLimpas?.questao_original || [];
        const imgsAlternativasMap = window.__imagensLimpas?.alternativas?.questao || {};
        let cursorImgEnunciado = 0;

        dadosNorm = {
            identificacao: String(pick(root?.identificacao, root?.id, root?.codigo, "") ?? ""),

            // Injeta o Scan Original
            foto_original: root?.scan_original || imgsEnunciado[0] || null,

            // Injeta Base64 na Estrutura do Enunciado
            estrutura: (Array.isArray(root?.estrutura) ? root.estrutura : [
                { tipo: 'texto', conteudo: String(pick(root?.enunciado, root?.texto, root?.statement, "") ?? "") }
            ]).map(bloco => {
                const tipo = String(bloco?.tipo ?? "texto").toLowerCase().trim();
                const conteudo = String(bloco?.conteudo ?? "");

                if (tipo === 'imagem') {
                    const imagemBase64 = imgsEnunciado[cursorImgEnunciado] || null;
                    cursorImgEnunciado++;

                    return {
                        tipo: "imagem",
                        conteudo: conteudo,
                        imagem_base64: imagemBase64
                    };
                }

                return { tipo, conteudo };
            }),

            materias_possiveis: asArray(pick(root?.materias_possiveis, root?.materiaspossiveis, [])).map(String),
            palavras_chave: asArray(pick(root?.palavras_chave, root?.palavraschave, [])).map(String),

            // Injeta Base64 nas Alternativas e REMOVE O TEXTO PLANO
            alternativas: asArray(pick(root?.alternativas, root?.alternatives, []))
                .map(a => {
                    const letra = String(pick(a?.letra, a?.letter, "") ?? "").trim().toUpperCase();

                    const imgsDestaLetra = imgsAlternativasMap[letra] || [];
                    let cursorImgAlt = 0;

                    const estruturaBruta = Array.isArray(a?.estrutura)
                        ? a.estrutura
                        : [{ tipo: "texto", conteudo: String(pick(a?.texto, a?.text, "") ?? "") }];

                    const estrutura = estruturaBruta.map(b => {
                        const tipo = String(b?.tipo ?? "texto").toLowerCase().trim();
                        const conteudo = String(b?.conteudo ?? "");

                        if (tipo === 'imagem') {
                            const imgBase64 = imgsDestaLetra[cursorImgAlt] || null;
                            cursorImgAlt++;
                            return {
                                tipo: "imagem",
                                conteudo: conteudo,
                                imagem_base64: imgBase64
                            };
                        }

                        return { tipo, conteudo };
                    }).filter(b => ["texto", "equacao", "imagem"].includes(b.tipo));

                    // REMOVIDO: A geração de textoPlano e a propriedade 'texto'
                    return { letra, estrutura };
                })
        };
    }

    // --- 2. GERENCIAMENTO DE ESTADO (CORRIGIDO PARA EDIÇÃO) ---
    const safeClone = (obj) => {
        try {
            return structuredClone(obj);
        } catch (e) {
            return JSON.parse(JSON.stringify(obj));
        }
    };

    // Verifica se 'dados' é o próprio objeto que já está na memória (Edição)
    const isEdicaoQuestao = (dados === window.__ultimaQuestaoExtraida);
    const isEdicaoGabarito = (dados === window.__ultimoGabaritoExtraido);

    if (isEdicaoGabarito) {
        // Se estamos salvando uma edição do Gabarito, atualiza apenas ele
        window.__ultimoGabaritoExtraido = safeClone(dadosNorm);
    }
    else if (isEdicaoQuestao) {
        // Se estamos salvando uma edição da Questão:
        // Atualiza a questão mas PROÍBE tocar no gabarito, não importa o modo.
        window.__ultimaQuestaoExtraida = safeClone(dadosNorm);
    }
    else {
        // Se não é edição, é DADO NOVO vindo da IA.
        // Aqui sim usamos o __modo para saber onde guardar.

        if (window.__modo === "gabarito") {
            window.__ultimoGabaritoExtraido = safeClone(dadosNorm);
        } else {
            // Se for dado novo de Prova/Questão:
            // Verifica se mudou a questão (ID diferente) para limpar o gabarito antigo
            const idAtual = window.__ultimaQuestaoExtraida ? window.__ultimaQuestaoExtraida.identificacao : null;
            const idNovo = dadosNorm.identificacao;

            if (idAtual && idAtual !== idNovo) {
                window.__ultimoGabaritoExtraido = null;
            }

            window.__ultimaQuestaoExtraida = safeClone(dadosNorm);
        }
    }

    const questao = window.__ultimaQuestaoExtraida;
    const gabarito = window.__ultimoGabaritoExtraido;

    // Fallback de segurança
    if (!questao) window.__ultimaQuestaoExtraida = dadosNorm;

    // --- 3. PREPARAÇÃO DA UI (Limpeza padrão) ---
    document.getElementById('reopenSidebarBtn')?.remove();

    const skeletonLoader = document.getElementById("ai-skeleton-loader");
    if (skeletonLoader && skeletonLoader.parentElement) {
        skeletonLoader.parentElement.remove();
    }
    // ---------------------

    const viewerBody = document.getElementById('viewerBody');
    const main = document.getElementById('viewerMain');
    let sidebar = document.getElementById('viewerSidebar');
    let resizer = document.getElementById('sidebarResizer');

    // Remove overlays de recorte antigos ou skeletons
    document.querySelector('.selection-box')?.remove();
    document.getElementById('crop-overlay')?.remove();
    const skeleton = sidebar?.querySelector('.skeleton-loader');
    if (skeleton) skeleton.remove();

    if (!sidebar) {
        sidebar = document.createElement('aside');
        sidebar.id = 'viewerSidebar';
        viewerBody.insertBefore(sidebar, main);
        // ... (Header do sidebar igual) ...
        const headerSidebar = document.createElement('div');
        headerSidebar.style.cssText = 'padding:10px; text-align:right; border-bottom:1px solid #ddd; margin-bottom:10px;';
        headerSidebar.innerHTML = '<small style="cursor:pointer; color:gray; font-weight:bold; text-transform:uppercase; font-size: 10px;">✕ Fechar Painel</small>';
        headerSidebar.onclick = () => {
            e.preventDefault?.();
            e.stopPropagation?.();
            window.esconderPainel?.();
        };
        sidebar.appendChild(headerSidebar);
    }
    // ... (Resizer igual) ...
    if (!resizer) {
        resizer = document.createElement('div');
        resizer.id = 'sidebarResizer';
        viewerBody.insertBefore(resizer, main);
        // ... (Listeners do resizer iguais) ...
        if (!resizer.dataset.bound) {
            resizer.dataset.bound = "1";
            const MIN_W = 260, MAX_W = 700;
            let isResizing = false;
            resizer.addEventListener('mousedown', (e) => { isResizing = true; resizer.classList.add('resizing'); document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; e.preventDefault(); });
            document.addEventListener('mousemove', (e) => { if (!isResizing) return; let w = e.clientX; if (w < MIN_W) w = MIN_W; if (w > MAX_W) w = MAX_W; sidebar.style.width = `${w}px`; });
            document.addEventListener('mouseup', () => { if (!isResizing) return; isResizing = false; resizer.classList.remove('resizing'); document.body.style.cursor = ''; document.body.style.userSelect = ''; });
        }
    }

    // --- LÓGICA DE COMPLEXIDADE (PESOS, HTML E DETALHES) ---
    const renderComplexidade = (complexidadeObj) => {
        // Configuração Centralizada (Usada no Render e no Edit)
        const CFG = {
            leitura: { label: "Suporte e Leitura", color: "var(--color-info)" },
            conhecimento: { label: "Conhecimento Prévio", color: "var(--color-primary)" },
            raciocinio: { label: "Raciocínio", color: "#9333ea" }, // Purple
            operacional: { label: "Operacional", color: "var(--color-warning)" }
        };

        const FATORES_DEF = [
            { key: "texto_extenso", label: "Texto Extenso", cat: "leitura", peso: 1 },
            { key: "vocabulario_complexo", label: "Vocabulário Denso", cat: "leitura", peso: 2 },
            { key: "multiplas_fontes_leitura", label: "Múltiplas Fontes", cat: "leitura", peso: 2 },
            { key: "interpretacao_visual", label: "Visual Crítico", cat: "leitura", peso: 2 },

            { key: "dependencia_conteudo_externo", label: "Conteúdo Prévio", cat: "conhecimento", peso: 3 },
            { key: "interdisciplinaridade", label: "Interdisciplinar", cat: "conhecimento", peso: 4 },
            { key: "contexto_abstrato", label: "Abstração Contextual", cat: "conhecimento", peso: 3 },

            { key: "raciocinio_contra_intuitivo", label: "Contra-Intuitivo", cat: "raciocinio", peso: 5 },
            { key: "abstracao_teorica", label: "Teoria Pura", cat: "raciocinio", peso: 3 },
            { key: "deducao_logica", label: "Dedução Lógica", cat: "raciocinio", peso: 3 },

            { key: "resolucao_multiplas_etapas", label: "Multi-etapas", cat: "operacional", peso: 4 },
            { key: "transformacao_informacao", label: "Transformação Info", cat: "operacional", peso: 3 },
            { key: "distratores_semanticos", label: "Distratores Fortes", cat: "operacional", peso: 3 },
            { key: "analise_nuance_julgamento", label: "Julgamento/Nuance", cat: "operacional", peso: 3 }
        ];

        // Se não tiver dados, retorna vazio
        if (!complexidadeObj || !complexidadeObj.fatores) return "";

        const f = complexidadeObj.fatores;
        let somaPesos = 0;
        let itensAtivos = [];

        // Calcula Score
        FATORES_DEF.forEach(item => {
            // Tenta pegar o valor (suporta snake_case e camelCase)
            const val = !!pick(f[item.key], f[item.key.replace(/_([a-z])/g, (g) => g[1].toUpperCase())], false);
            if (val) {
                somaPesos += item.peso;
                itensAtivos.push(item);
            }
        });

        // Normalização (Base 30 pontos)
        const DENOMINADOR = 30;
        const score = Math.min(1, somaPesos / DENOMINADOR);
        const pct = Math.round(score * 100);

        // Nível
        let nivel = { texto: "FÁCIL", cor: "var(--color-success)" };
        if (score > 0.30) nivel = { texto: "MÉDIA", cor: "var(--color-warning)" };
        if (score > 0.60) nivel = { texto: "DIFÍCIL", cor: "var(--color-orange-500)" };
        if (score > 0.80) nivel = { texto: "DESAFIO", cor: "var(--color-error)" };

        // --- GERAÇÃO DA LISTA DETALHADA (GROUP BY CATEGORY) ---
        // Agrupa os fatores para exibir no <details>
        const grupos = { leitura: [], conhecimento: [], raciocinio: [], operacional: [] };

        FATORES_DEF.forEach(item => {
            const val = !!pick(f[item.key], f[item.key.replace(/_([a-z])/g, (g) => g[1].toUpperCase())], false);
            grupos[item.cat].push({ ...item, ativo: val });
        });

        const renderGrupoDetalhado = (catKey) => {
            const itens = grupos[catKey];
            const cfg = CFG[catKey];
            return `
                <div style="margin-bottom:8px;">
                    <div style="font-size:10px; font-weight:bold; color:${cfg.color}; text-transform:uppercase; margin-bottom:4px;">${cfg.label}</div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:4px;">
                        ${itens.map(i => `
                            <div style="font-size:11px; color: ${i.ativo ? 'var(--color-text)' : 'var(--color-text-secondary)'}; opacity:${i.ativo ? 1 : 0.6}; display:flex; align-items:center; gap:5px;">
                                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${i.ativo ? cfg.color : '#ddd'};"></span>
                                ${i.label}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        };

        return `
        <div class="complexity-card" style="margin-top:15px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-lg); padding:15px; box-shadow:var(--shadow-sm);">
            
            <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:10px;">
                <span class="field-label" style="font-size:11px; opacity:0.8;">NÍVEL DE DIFICULDADE</span>
                <span style="font-weight:900; font-size:14px; color:${nivel.cor};">${nivel.texto} (${pct}%)</span>
            </div>

            <div style="height:8px; width:100%; background:rgba(0,0,0,0.05); border-radius:99px; overflow:hidden; margin-bottom:15px;">
                <div style="height:100%; width:${pct}%; background:${nivel.cor}; border-radius:99px; transition:width 1s ease;"></div>
            </div>

            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;">
                ${itensAtivos.length === 0 ? '<span style="font-size:11px; color:gray;">—</span>' :
                itensAtivos.map(item => {
                    const c = CFG[item.cat].color;
                    // Converte cor hex/var para fundo transparente
                    return `<span style="font-size:10px; padding:3px 8px; border-radius:4px; font-weight:700; border:1px solid ${c}; color:${c}; background:var(--color-surface);">${item.label}</span>`;
                }).join('')
            }
            </div>

            ${complexidadeObj.justificativa_dificuldade ? `
                <div class="markdown-content" data-raw="${escapeHTML(complexidadeObj.justificativa_dificuldade)}" style="font-size:12px; color:var(--color-text-secondary); background:var(--color-bg-1); padding:10px; border-radius:var(--radius-base); font-style:italic; line-height:1.4; margin-bottom:10px;">
                    ${escapeHTML(complexidadeObj.justificativa_dificuldade)}
                </div>
            ` : ''}

            <details style="font-size:12px; border-top:1px solid var(--color-border); padding-top:8px;">
                <summary style="cursor:pointer; color:var(--color-primary); font-weight:600; font-size:11px; outline:none;">VER ANÁLISE DETALHADA</summary>
                <div style="margin-top:10px; padding-left:4px;">
                    ${renderGrupoDetalhado('leitura')}
                    ${renderGrupoDetalhado('conhecimento')}
                    ${renderGrupoDetalhado('raciocinio')}
                    ${renderGrupoDetalhado('operacional')}
                </div>
            </details>
        </div>
        `;
    };

    // --- 4. GERAÃ‡ÃƒO DO HTML ---

    // CORREÇÃO: Usa let em vez de const para permitir atribuição
    let container = elementoAlvo || document.getElementById('renderContainer');

    // CORREÇÃO CRÍTICA: Se o container não existir (foi removido pelo loading), cria um novo!
    if (!container) {
        container = document.createElement('div');
        container.id = 'renderContainer';
        // Não precisamos dar append aqui ainda, pois a função já faz o append no final (linha ~2270)
    }

    // --- NOVO CÓDIGO: SALVAR BACKUP DOS ORIGINAIS ---
    // Isso garante que pegamos a primeira imagem carregada e não a substituímos por recortes futuros
    if (!window.__BACKUP_IMG_Q) {
        const imgsQ = window.__imagensLimpas?.questao_original || [];
        if (imgsQ.length > 0) window.__BACKUP_IMG_Q = imgsQ[0];
    }

    // Se estivermos renderizando o gabarito e tivermos uma imagem original dele
    if (window.__modo === 'gabarito' || (dados && dados.alternativa_correta)) {
        if (!window.__BACKUP_IMG_G) {
            const imgsG = window.__imagensLimpas?.gabarito_original || [];
            if (imgsG.length > 0) window.__BACKUP_IMG_G = imgsG[0];
        }
    }
    // ------------------------------------------------

    container.id = 'extractionResult';
    container.className = 'extraction-result';

    // Helpers
    const escapeHTML = (s) => String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    const renderTags = (l, c) => (!l || l.length === 0) ? '<span style="font-size:11px; color:gray;">N/A</span>' : l.map(i => `<span class="data-tag ${c}">${i}</span>`).join('');
    const renderAlternativas = (alts) => {
        if (!alts || alts.length === 0) return `<div class="data-box">Sem alternativas</div>`;

        return alts.map(a => {
            const letra = String(a?.letra ?? "").trim().toUpperCase();
            const estrutura = Array.isArray(a?.estrutura) ? a.estrutura : [{ tipo: "texto", conteudo: String(a?.texto ?? "") }];

            // CORREÇÃO: Usar a função específica 'renderizar_estrutura_alternativa'
            // Ela sabe buscar as imagens salvas em window.__imagensLimpas.alternativas.questao[letra]
            // e gera os botões com o onclick correto (iniciar_captura_para_slot_alternativa)
            const htmlEstr = window.renderizar_estrutura_alternativa(
                estrutura,
                letra
            );

            return `<div class="alt-row">
      <span class="alt-letter">${letra}</span>
      <div class="alt-content">${htmlEstr}</div>
    </div>`;
        }).join("");
    };


    let displayQuestao = (window.__modo === "gabarito" && gabarito) ? 'none' : 'block';
    let displayGabarito = (window.__modo === "gabarito" && gabarito) ? 'block' : 'none';

    // HTML ABAS
    let htmlAbas = '';
    if (gabarito) {
        htmlAbas = `
        <div class="tabs-header" style="display:flex; gap:5px; margin-bottom:15px; border-bottom:1px solid #ddd; padding-bottom:5px;">
            <button type="button" id="btnTabQuestao" class="btn btn--sm ${displayQuestao === 'block' ? 'btn--primary' : 'btn--secondary'}" style="flex:1;">Questão</button>
            <button type="button" id="btnTabGabarito" class="btn btn--sm ${displayGabarito === 'block' ? 'btn--primary' : 'btn--secondary'}" style="flex:1;">Gabarito</button>
        </div>`;
    }

    // ... (logo após o bloco if (gabarito) { htmlAbas = ... } ) ...

    // --- NOVA LÓGICA DE IMAGENS (GENÉRICA PARA QUESTÃO E GABARITO) ---
    const isGabaritoObj = (dados === window.__ultimoGabaritoExtraido);

    // Usa a chave padronizada 'imagens_suporte' que criamos na atualização anterior
    const imagensSalvas = isGabaritoObj
        ? (window.__imagensLimpas?.gabarito_suporte || [])
        : (window.__imagensLimpas?.questao_suporte || []);

    // Define ID único baseado se é gabarito ou questão para controle via JS
    const btnRecortarId = isGabaritoObj ? 'btnImgGabarito' : 'btnImgQuestao';

    // ID dinâmico para o container da galeria para podermos ocultar/mostrar via JS
    const containerGaleriaId = isGabaritoObj ? 'containerGaleriaGabarito' : 'containerGaleriaQuestao';
    // CORREÇÃO: Força 'block' para aparecer sempre, permitindo adicionar imagem manualmente
    const displayGaleria = 'block';

    const htmlGaleriaImagens = `
    <div id="${containerGaleriaId}" class="field-group warning-box" style="display: ${displayGaleria}; border: 1px solid #f59e0b; background: rgba(245, 158, 11, 0.1); padding: 10px; border-radius: 8px; margin-top: 10px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span class="field-label" style="color: #b45309;">📷 Figuras de Apoio (${isGabaritoObj ? 'Gabarito' : 'Questão'})</span>
        <span style="font-size:10px; color:#b45309;">${imagensSalvas.length} salva(s)</span>
      </div>

      <div class="img-final-gallery" style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:10px;">
        ${imagensSalvas.length > 0 ? imagensSalvas.map((img, idx) => `
          <div style="position:relative; width:60px; height:60px; border:1px solid #ccc; border-radius:4px; overflow:hidden;">
            <img src="${img}" style="width:100%; height:100%; object-fit:cover;">
            <button onclick="removerImagemFinal(${idx}, '${isGabaritoObj ? 'gabarito' : 'questao'}')" style="position:absolute; top:0; right:0; background:red; color:white; border:none; width:15px; height:15px; font-size:10px; cursor:pointer;">X</button>
          </div>
        `).join('') : '<span style="font-size:11px; color:#b45309; font-style:italic;">Nenhuma figura adicionada.</span>'}
      </div>

      <button
        id="${btnRecortarId}"
        type="button"
        class="btn btn--sm btn--outline"
        style="width:100%; border-style:dashed; border-color:#b45309; color:#b45309;"
        onclick="onClickImagemFinal()"
      >
        + Recortar/Adicionar Figura
      </button>
      
      <div id="msgAvisoModo_${isGabaritoObj ? 'gab' : 'quest'}" style="margin-top:6px; font-size:11px; color:#b45309; display:none;">
        ⚠️ Troque para o modo <b>${isGabaritoObj ? 'Gabarito' : 'Prova'}</b> para capturar.
      </div>
    </div>
    `;

    // ... [código anterior da função permanece igual] ...

    // --- GERAÇÃO DA ESTRUTURA VISUAL (QUESTÃO) ---
    // Recupera as imagens que VOCÊ recortou manualmente para os slots
    const imagensLocaisQuestao = window.__imagensLimpas?.questao_original || [];

    // Gera o HTML Visual usando a função auxiliar
    // Passamos 'questao' como contexto para o botão saber onde salvar
    const htmlEstruturaVisual = window.renderizarEstruturaHTML(questao.estrutura, imagensLocaisQuestao, 'questao');

    // --- GERA O HTML DO EDITOR NOVO ---
    const estruturaAtual = questao.estrutura || [];

    // 1. Gera os blocos existentes
    const blocosHtml = estruturaAtual.map(bloco =>
        window.criarHtmlBlocoEditor(bloco.tipo, bloco.conteudo)
    ).join('');

    const htmlEstruturaEdit = `
    <div class="structure-editor-wrapper">
        <div id="editor-drag-container" class="structure-editor-container">
        ${blocosHtml}
        </div>

        <div id="editor-add-buttons" class="structure-toolbar structure-toolbar--addmenu">
        <button type="button" id="btnToggleAddMenu" class="btn btn--primary btn--full-width btn-add-main">
            + Adicionar bloco
        </button>

        <div id="editorAddMenu" class="add-menu hidden">
            <button type="button" class="btn-add-block" data-add-type="texto">Texto</button>
            <button type="button" class="btn-add-block" data-add-type="titulo">Título</button>
            <button type="button" class="btn-add-block" data-add-type="subtitulo">Subtítulo</button>
            <button type="button" class="btn-add-block" data-add-type="citacao">Citação</button>
            <button type="button" class="btn-add-block" data-add-type="lista">Lista</button>
            <button type="button" class="btn-add-block" data-add-type="equacao">Equação</button>
            <button type="button" class="btn-add-block" data-add-type="codigo">Código</button>
            <button type="button" class="btn-add-block" data-add-type="destaque">Destaque</button>
            <button type="button" class="btn-add-block" data-add-type="separador">Separador</button>
            <button type="button" class="btn-add-block" data-add-type="fonte">Fonte</button>
            <button type="button" class="btn-add-block" data-add-type="imagem">Imagem</button>
        </div>
        </div>
    </div>
    `;

    const htmlQuestao = `
    <div id="tabContentQuestao" style="display: ${displayQuestao};">
        <div class="result-header">
            <h3>Questão Extraída</h3>
            <span class="badge-success">Sucesso</span>
        </div>

        <div id="questaoView">
            <div class="field-group"><span class="field-label">Identificação</span><div class="data-box">${escapeHTML(questao.identificacao)}</div></div>
            
            <div class="field-group">
                <span class="field-label">Conteúdo da Questão</span>
                <div class="data-box scrollable" style="padding:15px;">
                    ${htmlEstruturaVisual}
                </div>
            </div>
            
            <div style="display:flex; gap:10px; margin-top:10px;">
                <div class="field-group" style="flex:1;"><span class="field-label">Matéria</span><div class="data-box">${renderTags(questao.materias_possiveis, 'tag-subject')}</div></div>
            </div>
            <div class="field-group"><span class="field-label">Palavras-Chave</span><div class="tags-wrapper">${renderTags(questao.palavras_chave, 'tag-keyword')}</div></div>
            <div class="field-group"><span class="field-label">Alternativas (${questao.alternativas ? questao.alternativas.length : 0})</span><div class="alts-list">${renderAlternativas(questao.alternativas)}</div></div>
        </div>

        <form id="questaoEdit" class="hidden">
            <div class="field-group"><span class="field-label">Identificação</span><input id="edit_identificacao" class="form-control" type="text" value="${escapeHTML(questao.identificacao)}"></div>
            
            <div class="field-group">
                <span class="field-label">Estrutura (Edição de Texto)</span>
                <div id="edit_estrutura_container">
                    ${htmlEstruturaEdit}
                </div>
                <small style="color:gray; font-size:10px;">* Para alterar imagens, clique no botão "Trocar Imagem" na visualização acima.</small>
            </div>

            <div class="field-group"><span class="field-label">Matérias (1/linha)</span><textarea id="edit_materias" class="form-control" rows="2">${escapeHTML(joinLines(questao.materias_possiveis))}</textarea></div>
            <div class="field-group"><span class="field-label">Palavras-chave (1/linha)</span><textarea id="edit_palavras" class="form-control" rows="2">${escapeHTML(joinLines(questao.palavras_chave))}</textarea></div>
            
            <div class="field-group">
                <span class="field-label">Alternativas</span>
                <div id="edit_alts" class="alts-list">
                ${(questao.alternativas || []).map((alt, i) => {
        const letraSafe = escapeHTML(alt.letra ?? "");
        const estruturaAlt = Array.isArray(alt.estrutura)
            ? alt.estrutura
            : [{ tipo: "texto", conteudo: String(alt.texto ?? "") }];

        const blocosAltHtml = estruturaAlt
            .map(b => window.criarHtmlBlocoEditor(b.tipo, b.conteudo))
            .join("");

        return '' +
            '<div class="alt-row alt-edit-row" data-alt-index="' + i + '" ' +
            '     style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px;">' +

            '<div style="display:flex;gap:5px;align-items:center;">' +
            '<input class="form-control alt-letter" ' +
            '       style="width:60px;text-align:center;" ' +
            '       value="' + letraSafe + '" placeholder="Letra">' +
            '<button type="button" class="btn btn--sm btn--outline btn-remove-alt" ' +
            '        style="color:var(--color-error);border-color:var(--color-error);min-width:30px;" ' +
            '        title="Remover alternativa">✕</button>' +
            '</div>' +

            '<div class="alt-editor">' +
            '<div class="structure-editor-wrapper">' +
            '<div class="structure-editor-container alt-drag-container">' +
            blocosAltHtml +
            '</div>' +

            '<div class="structure-toolbar alt-add-buttons" ' +
            '     style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">' +
            '<button type="button" class="btn btn--sm btn--secondary btn-alt-add" data-add-type="texto">Texto</button>' +
            '<button type="button" class="btn btn--sm btn--secondary btn-alt-add" data-add-type="equacao">Equação</button>' +
            '<button type="button" class="btn btn--sm btn--secondary btn-alt-add" data-add-type="imagem">Imagem</button>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>';
    }).join('')}
                </div>
                <button type="button" class="btn btn--secondary btn--full-width" id="btnAddAlt" style="margin-top:5px;">+ Adicionar Alternativa</button>
            </div>
            
            <button type="button" class="btn btn--primary btn--full-width" id="btnSalvarEdicao" style="margin-top:15px;">💾 Salvar Alterações</button>
        </form>

        <form id="questaoEditActions" class="hidden">
            <div style="padding:10px; background:#eee; text-align:center; margin:10px 0;">Modo Edição</div>
            <button type="button" class="btn btn--secondary btn--full-width" id="btnCancelarEdicao">Cancelar</button>
        </form>

        <div class="result-actions" id="actionsLeitura" style="margin-top:15px;">
            <button type="button" class="btn btn--secondary btn--full-width" id="btnEditar">✏️ Editar Conteúdo</button>
            ${!gabarito ? `<button type="button" class="btn btn--primary btn--full-width" id="btnConfirmarQuestao" style="margin-top:5px;">Confirmar e Extrair Gabarito ➡️</button>` : ''}
        </div>
    </div>`;

    const TIPOS_ESTRUTURA_VALIDOS = new Set([
        "texto", "imagem", "citacao", "titulo", "subtitulo",
        "lista", "equacao", "codigo", "destaque", "separador",
        "fonte"
    ]);

    function normalizarBlocoEstrutura(bloco) {
        const rawTipo = (bloco?.tipo ?? 'imagem');
        let tipo = String(rawTipo).toLowerCase().trim();

        if (!TIPOS_ESTRUTURA_VALIDOS.has(tipo)) {
            tipo = 'imagem'; // regra: desconhecido => imagem
        }

        let conteudo = bloco?.conteudo ?? '';
        conteudo = String(conteudo);

        // opcional: se for separador, pode ignorar conteudo
        if (tipo === 'separador') conteudo = conteudo.trim();

        // opcional: se veio vazio e não é separador, mantém string vazia mesmo
        return { tipo, conteudo };
    }

    function normalizarEstrutura(estruturaLike) {
        if (!Array.isArray(estruturaLike)) return [];
        return estruturaLike.map(normalizarBlocoEstrutura);
    }

    let htmlGabarito = "";
    if (gabarito) {
        // --- 1. LIMPEZA DE DADOS (CORRIGIDA) ---
        // Usamos os helpers globais definidos no início da função (pick, normCreditos, etc)
        // Isso garante que a 'estrutura' seja lida corretamente.

        const respostaLetra = String(pick(gabarito.alternativa_correta, gabarito.resposta, "")).trim().toUpperCase();
        const justificativaCurta = pick(gabarito.justificativa_curta, gabarito.justificativa, "");
        const possuiImagem = !!pick(gabarito.possui_imagem, gabarito.possuiimagem, false);
        const confianca = pick(gabarito.confianca, null);
        const coerencia = pick(gabarito.coerencia, {});
        const observacoes = asStringArray(pick(gabarito.observacoes, []));

        const creditosRaw = pick(gabarito.creditos, {});
        const creditos = normCreditos(creditosRaw); // Usa o helper global

        const alertasCredito = asStringArray(pick(gabarito.alertas_credito, []));

        // AQUI ESTÁ A MÁGICA: O normalizeExplicacao global lê o campo 'estrutura' corretamente
        const explicacaoArray = normalizeExplicacao(pick(gabarito.explicacao, gabarito.resolucao, []));

        const alternativasAnalisadas = normalizeAlternativasAnalisadas(
            pick(gabarito.alternativas_analisadas, []),
            respostaLetra
        );

        // --- META DO GABARITO (Confiança, imagem, origem etc.) ---
        const clamp01 = (n) => Math.max(0, Math.min(1, Number(n)));
        const fmtPct = (n) => `${Math.round(clamp01(n) * 100)}%`;

        const renderMetaGabarito = () => {
            const chips = [];

            // Confiança
            if (confianca !== null && confianca !== undefined && !Number.isNaN(Number(confianca))) {
                chips.push(`
      <div class="gabarito-chip gabarito-chip--info">
        <span class="gabarito-chip__k">Confiança</span>
        <span class="gabarito-chip__v">${safe(fmtPct(confianca))}</span>
      </div>
    `);
            }

            // Origem / créditos (curto)
            if (creditos?.origemresolucao) {
                chips.push(`
      <div class="gabarito-chip gabarito-chip--muted">
        <span class="gabarito-chip__k">Origem</span>
        <span class="gabarito-chip__v">${safe(creditos.origemresolucao)}</span>
      </div>
    `);
            }

            if (!chips.length) return "";

            const showBar = (confianca !== null && confianca !== undefined && !Number.isNaN(Number(confianca)));
            const fill = showBar ? fmtPct(confianca) : "0%";

            return `
    <div class="gabarito-meta">
      <div class="gabarito-meta__row">
        ${chips.join("")}
      </div>

      ${showBar ? `
        <div class="gabarito-confbar" style="--fill-width:${safe(fill)}">
          <div class="gabarito-confbar__label">Confiança visual</div>
          <div class="gabarito-confbar__track">
            <div class="gabarito-confbar__fill"></div>
          </div>
        </div>
      ` : ""}
    </div>
  `;
        };


        // helper: normaliza letra
        const normLetra = (v) => String(v ?? "").trim().toUpperCase();

        // helper: opções no estilo antigo (reaproveita .answerOption/.correct)
        const renderOpcoesGabarito = () => {
            const alts = Array.isArray(questao?.alternativas) ? questao.alternativas : [];
            if (!alts.length) return "";

            const correta = normLetra(respostaLetra);
            return `
    <div class="answerOptions gabarito-options">
      ${alts.map(alt => {
                const letra = normLetra(alt?.letra);
                const isCorrect = letra && correta && letra === correta;

                // se quiser mostrar a análise junto da alternativa:
                const analise = (alternativasAnalisadas || []).find(a => normLetra(a?.letra) === letra);

                return `
          <div class="answerOption ${isCorrect ? "correct" : ""}">
            <span class="option-letter">${safe(letra)}</span>
            <div class="option-text">
              ${safe(alt?.texto)}
              ${analise?.motivo ? `<div class="option-reason">${safe(analise.motivo)}</div>` : ""}
            </div>
          </div>
        `;
            }).join("")}
    </div>
  `;
        };

        const complexidadeRaw = pick(gabarito.analise_complexidade, gabarito.analiseComplexidade, null);
        htmlGabarito = `
        <div id="tabContentGabarito" style="display:${displayGabarito}">
            <div id="gabaritoView">
                <div class="question gabarito-card">
                    <div class="result-header">
                        <h3>Gabarito</h3>
                        <span class="badge-success">Ok</span>
                    </div>

                    <div class="questionText gabarito-head">
                        <p><strong>Alternativa correta:</strong> ${safe(respostaLetra)}</p>
                        ${justificativaCurta ? `<p class="gabarito-just markdown-content">${safe(justificativaCurta)}</p>` : ""}
                    </div>
                    
                    ${renderComplexidade(complexidadeRaw)}
                    ${renderMetaGabarito()}
                    ${renderOpcoesGabarito()}
                </div>

    ${explicacaoArray.length ? `
      <div class="passo gabarito-steps">
        <div class="passoText"><p><strong>Explicação (passo a passo)</strong></p></div>
        <div class="explicacao">
          <ol class="steps-list">
            ${explicacaoArray.map((p, idx) => {
            // 1. Prepara as imagens deste passo
            if (!window.__imagensLimpas.gabarito_passos) window.__imagensLimpas.gabarito_passos = {};
            const imagensDestePasso = window.__imagensLimpas.gabarito_passos[idx] || [];

            // 2. Renderiza os blocos (Texto, Equação, Imagem)
            const htmlConteudo = window.renderizarEstruturaHTML(
                p.estrutura,
                imagensDestePasso,
                `gabarito_passo_${idx}`
            );

            // --- MELHORIA DE VISUALIZAÇÃO DOS METADADOS ---
            const origemRaw = String(p?.origem || "").toLowerCase().replace(/_/g, "");
            const isExtraido = origemRaw.includes("extraido");

            // Badge de Origem com Estilo
            const badgeOrigem = isExtraido
                ? `<span class="step-chip" style="background:var(--color-bg-2); color:var(--color-success); border:1px solid var(--color-success); font-weight:600;">📄 Extraído</span>`
                : `<span class="step-chip" style="background:rgba(59, 130, 246, 0.08); color:#2563eb; border:1px solid rgba(59, 130, 246, 0.3); font-weight:600;">🤖 IA</span>`;

            return `
                  <li class="step-card">
                    <div class="step-index">${idx + 1}</div>
                    <div class="step-body">
                      <div class="step-content">${htmlConteudo}</div>
                      
                      <div class="step-meta" style="margin-top:10px; padding-top:8px; border-top:1px dashed var(--color-border); display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                        
                        ${badgeOrigem}

                        ${p?.fontematerial ? `
                            <span class="step-chip step-chip--muted" title="Fonte/Material: ${safe(p.fontematerial)}">
                                📚 ${safe(p.fontematerial)}
                            </span>` : ""
                }

                        ${p?.evidencia ? `
                            <span class="step-chip step-chip--muted" title="Evidência Visual encontrada na imagem: ${safe(p.evidencia)}" style="border-style:dashed;">
                                👁️ ${safe(p.evidencia)}
                            </span>` : ""
                }
                      </div>
                    </div>
                  </li>
                `;
        }).join("")}
          </ol>
        </div>
      </div>
    ` : ""}

    ${(creditos || alertasCredito.length || observacoes.length || coerencia) ? `
      <details class="gabarito-extra">
        <summary>Detalhes técnicos</summary>

        ${coerencia ? (() => {
                    // aceita snake_case e camelCase
                    const altOk = (coerencia.alternativa_correta_existe ?? coerencia.alternativaCorretaExiste);
                    const todasOk = (coerencia.tem_analise_para_todas ?? coerencia.temAnaliseParaTodas);
                    const obs = Array.isArray(coerencia.observacoes) ? coerencia.observacoes : [];

                    const chip = (label, ok, okTxt = "OK", badTxt = "Atenção") => `
    <div class="coerencia-chip ${ok ? "coerencia-chip--ok" : "coerencia-chip--bad"}">
      <span class="coerencia-chip-k">${safe(label)}</span>
      <span class="coerencia-chip-v">${safe(ok ? okTxt : badTxt)}</span>
    </div>
  `;

                    const htmlObs = obs.length
                        ? `<div class="coerencia-obs">
         <div class="coerencia-obs-title">Observações</div>
         <ul>${obs.map(o => `<li>${safe(o)}</li>`).join("")}</ul>
       </div>`
                        : `<div class="coerencia-obs coerencia-obs--empty">Sem observações.</div>`;

                    return `
    <div class="field-group">
      <span class="field-label">Coerência (checagens)</span>

      <div class="coerencia-grid">
        ${chip("Alternativa correta existe", !!altOk)}
        ${chip("Análise para todas", !!todasOk)}
        ${chip("Observações", obs.length === 0, "Nenhuma", "Há itens")}
      </div>

      ${htmlObs}
    </div>
  `;
                })() : ""}


        ${observacoes.length ? `
          <div class="field-group">
            <span class="field-label">Observações</span>
            <div class="data-box scrollable">
              <ul>${observacoes.map(o => `<li>${safe(o)}</li>`).join("")}</ul>
            </div>
          </div>
        ` : ""}

        ${creditos ? (() => {
                    const chipKV = (k, v, cls = "") => `
    <div class="coerencia-chip ${cls}">
      <span class="coerencia-chip-k">${safe(k)}</span>
      <span class="coerencia-chip-v">${safe(v ?? "—")}</span>
    </div>
  `;

                    const toPct = (n) => {
                        const x = Number(n);
                        if (Number.isNaN(x)) return null;
                        return `${Math.round(Math.max(0, Math.min(1, x)) * 100)}%`;
                    };

                    const confId = creditos.confiancaidentificacao != null ? toPct(creditos.confiancaidentificacao) : null;

                    const blocoEvidencia = creditos.comoidentificou
                        ? `<div class="coerencia-obs">
         <div class="coerencia-obs-title">Evidência</div>
         <div>${safe(creditos.comoidentificou)}</div>
       </div>`
                        : `<div class="coerencia-obs coerencia-obs--empty">Sem evidência registrada.</div>`;

                    const blocoCreditoSugerido = creditos.textocreditosugerido
                        ? `<div class="coerencia-obs" style="margin-top:8px;">
         <div class="coerencia-obs-title">Crédito sugerido</div>
         <div>${safe(creditos.textocreditosugerido)}</div>
       </div>`
                        : "";

                    return `
    <div class="field-group">
      <span class="field-label">Créditos / Fonte</span>

      <div class="coerencia-grid">
        ${chipKV("Origem", creditos.origemresolucao || "—")}
        ${chipKV("Material identificado", creditos.materialidentificado ? "Sim" : "Não",
                        creditos.materialidentificado ? "coerencia-chip--ok" : "coerencia-chip--bad")}
        ${confId ? chipKV("Confiança ident.", confId) : ""}
        ${creditos.material ? chipKV("Material", creditos.material) : ""}
        ${creditos.autorouinstituicao ? chipKV("Autor/Instituição", creditos.autorouinstituicao) : ""}
        ${creditos.ano ? chipKV("Ano", creditos.ano) : ""}
        ${chipKV("Precisa crédito genérico", creditos.precisacreditogenerico ? "Sim" : "Não",
                            creditos.precisacreditogenerico ? "coerencia-chip--bad" : "coerencia-chip--ok")}
      </div>

      ${blocoEvidencia}
      ${blocoCreditoSugerido}
    </div>
  `;
                })() : ""}


        ${alertasCredito.length ? `
          <div class="field-group">
            <span class="field-label">Alertas de crédito</span>
            <div class="data-box scrollable">
              <ul>${alertasCredito.map(a => `<li>${safe(a)}</li>`).join("")}</ul>
            </div>
          </div>
        ` : ""}
      </details>
    ` : ""}
   <div class="result-actions" id="actionsLeituraGabarito" style="margin-top:15px;">
      <button type="button" class="btn btn--secondary btn--full-width" id="btnEditarGabarito">
        Editar gabarito
      </button>
      
      <button type="button" class="btn btn--success btn--full-width" id="btnFinalizarTudo" style="margin-top:10px; font-weight:bold; border:1px solid rgba(0,0,0,0.1);">
        ✨ Finalizar Questão
      </button>
      </div>
    </div>
    <form id="gabaritoEdit" class="hidden">
  <!-- META BÁSICA -->
  <div class="field-group">
    <span class="field-label">Alternativa correta</span>
    <input id="editGabaritoResposta" class="form-control" type="text"
           value="${safe(respostaLetra)}" placeholder="Ex.: A" />
  </div>

  <div class="field-group">
    <span class="field-label">Justificativa curta</span>
    <textarea id="editGabaritoJust" class="form-control" rows="3"
      placeholder="1–2 frases">${safe(justificativaCurta || "")}</textarea>
  </div>

  <div class="field-group">
      <span class="field-label">Confiança (0–1)</span>
      <input id="editGabaritoConfianca" class="form-control" type="number"
             min="0" max="1" step="0.01"
             value="${confianca ?? ""}" placeholder="0.85" />
    </div>

  <div class="field-group">
      <span class="field-label">Explicação (passos)</span>
      <div id="editGabaritoPassos">
      ${(explicacaoArray || []).map((p, idx) => {
                    // 1. Gera HTML dos blocos existentes neste passo
                    const blocosHtml = (p.estrutura || []).map(b =>
                        window.criarHtmlBlocoEditor(b.tipo, b.conteudo)
                    ).join('');

                    // 2. Lógica de Seleção Robusta (resolve o bug do select resetando)
                    const origemRaw = String(p.origem || "").toLowerCase().replace(/_/g, "");
                    const isExtraido = origemRaw.includes("extraido"); // Pega "extraidodomaterial" ou "extraido_do_material"
                    const isIA = !isExtraido;

                    return `
          <div class="step-edit-row" data-step-index="${idx}" style="border:1px solid var(--color-border); padding:15px; border-radius:8px; margin-bottom:15px; background:var(--color-bg-1);">
              
              <div style="display:flex; justify-content:space-between; margin-bottom:10px; align-items:center;">
                  <strong style="color:var(--color-primary);">Passo ${idx + 1}</strong>
                  <button type="button" class="btn btn--sm btn--outline btn-remove-step" style="color:var(--color-error); border-color:var(--color-error); font-size:11px;">✕ Remover Passo</button>
              </div>

              <div class="structure-editor-wrapper">
                  <div class="structure-editor-container step-drag-container" style="min-height: 50px; background: var(--color-background);">
                      ${blocosHtml}
                  </div>
                  
                  <div class="structure-toolbar step-add-toolbar" style="margin-top:8px; padding-top:8px; border-top:1px dashed var(--color-border); position:relative;">
                      <button type="button" class="btn btn--sm btn--secondary btn--full-width btn-toggle-step-add" style="display:flex; justify-content:center; align-items:center; gap:5px; background:var(--color-bg-2);">
                          <span>+ Adicionar Bloco de Conteúdo</span>
                          <span style="font-size:10px; opacity:0.7;">▼</span>
                      </button>
                      
                      <div class="step-menu-content hidden" style="position:absolute; top:100%; left:0; width:100%; z-index:100; display:grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap:5px; padding:10px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.15); margin-top:5px;">
                          <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="texto" title="Parágrafo de texto">Texto</button>
                          <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="imagem" title="Figura/Gráfico">Imagem</button>
                          <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="equacao" title="Fórmula LaTeX">Equação</button>
                          <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="lista" title="Lista de itens">Lista</button>
                          <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="destaque" title="Box de destaque">Destaque</button>
                          <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="citacao" title="Citação em bloco">Citação</button>
                          <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="codigo" title="Bloco de código">Código</button>
                          <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="titulo" title="Título de seção">Título</button>
                          <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="subtitulo" title="Subtítulo">Subtítulo</button>
                          <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="fonte" title="Referência/Fonte">Fonte</button>
                          <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="separador" title="Linha divisória">Separador</button>
                      </div>
                  </div>
              </div>

              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:15px; background:rgba(0,0,0,0.03); padding:10px; border-radius:6px;">
                  <div style="flex:1;">
                      <span class="field-label" style="font-size:10px; margin-bottom:2px; display:block; color:var(--color-text-secondary);">Origem do Conteúdo</span>
                      <select class="form-control passo-origem" style="width:100%;">
                          <option value="extraido_do_material" ${isExtraido ? "selected" : ""}>📄 Extraído do Material</option>
                          <option value="gerado_pela_ia" ${isIA ? "selected" : ""}>🤖 Gerado pela IA</option>
                      </select>
                  </div>
                  <div style="flex:1;">
                      <span class="field-label" style="font-size:10px; margin-bottom:2px; display:block; color:var(--color-text-secondary);">Fonte / Material</span>
                      <input class="form-control passo-fonte" placeholder="Ex: Página 32..." value="${safe(p.fontematerial || "")}" style="width:100%;" />
                  </div>
                  <div style="grid-column: 1 / -1;">
                      <span class="field-label" style="font-size:10px; margin-bottom:2px; display:block; color:var(--color-text-secondary);">Evidência Visual (se houver)</span>
                      <input class="form-control passo-evidencia" placeholder="Ex: Gráfico azul, segundo parágrafo..." value="${safe(p.evidencia || "")}" style="width:100%;" />
                  </div>
              </div>

          </div>`;
                }).join("")}
  </div>
      <button type="button" class="btn btn--secondary btn--full-width" id="btnAddPassoGabarito" style="margin-top:6px;">
        + Adicionar Novo Passo
      </button>
  </div>

  <!-- ANÁLISE POR ALTERNATIVA -->
  <div class="field-group">
    <span class="field-label">Análise por alternativa</span>
    <div id="editGabaritoAnalises" class="alts-list">
      ${(Array.isArray(questao?.alternativas) ? questao.alternativas : [])
                .map(alt => {
                    const letra = String(alt?.letra || "").trim().toUpperCase();
                    const analise = (alternativasAnalisadas || [])
                        .find(a => String(a?.letra || "").trim().toUpperCase() === letra);

                    return `
              <div class="alt-row alt-edit-row"
                   style="display:flex; gap:6px; align-items:flex-start; margin-bottom:6px;">
                <input class="form-control"
                       style="width:60px; text-align:center;"
                       value="${safe(letra)}" disabled />
                <textarea class="form-control gabarito-motivo"
                          data-letra="${safe(letra)}"
                          rows="2"
                          placeholder="Motivo (correta/errada)">${safe(analise?.motivo || "")
                        }</textarea>
              </div>
            `;
                })
                .join("")
            }
    </div>
  </div>

  <!-- COERÊNCIA (checagens) -->
  <div class="field-group">
    <span class="field-label">Coerência (checagens internas)</span>
    <div style="display:flex; gap:10px; flex-wrap:wrap;">
      <label style="display:flex; gap:6px; align-items:center;">
        <input id="editCoerenciaAltExiste" type="checkbox"
          ${(coerencia?.alternativa_correta_existe ?? coerencia?.alternativaCorretaExiste)
                ? "checked" : ""} />
        <span style="font-size:12px;">Alternativa correta existe</span>
      </label>

      <label style="display:flex; gap:6px; align-items:center;">
        <input id="editCoerenciaTodasAnalise" type="checkbox"
          ${(coerencia?.tem_analise_para_todas ?? coerencia?.temAnaliseParaTodas)
                ? "checked" : ""} />
        <span style="font-size:12px;">Tem análise para todas</span>
      </label>
    </div>

    <textarea id="editCoerenciaObs" class="form-control" rows="3"
      placeholder="Observações de consistência (1 por linha)">${safe(
                    (Array.isArray(coerencia?.observacoes)
                        ? coerencia.observacoes
                        : []
                    ).join("\n")
                )
            }</textarea>
  </div>

  <div class="field-group" style="border:1px solid var(--color-border); padding:10px; border-radius:8px; background:rgba(0,0,0,0.02);">
    <span class="field-label" style="color:var(--color-primary); margin-bottom:8px; display:block;">Matriz de Complexidade</span>
    
    <div style="font-size:11px; color:gray; margin-bottom:10px;">Marque os fatores determinantes para a dificuldade.</div>

    ${(() => {
                // Recupera dados atuais
                const cFatores = complexidadeRaw?.fatores || {};

                // Helper para gerar checkbox
                const chk = (key, label) => {
                    // Suporta camelCase e snake_case
                    const val = !!pick(cFatores[key], cFatores[key.replace(/_([a-z])/g, (_, x) => x.toUpperCase())], false);
                    return `
            <label style="display:flex; gap:6px; align-items:center; margin-bottom:4px; cursor:pointer;">
                <input type="checkbox" class="chk-complexidade" data-key="${key}" ${val ? "checked" : ""}>
                <span style="font-size:12px;">${label}</span>
            </label>`;
                };

                return `
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
            <div>
                <strong style="font-size:10px; text-transform:uppercase; color:gray; display:block; margin-bottom:4px;">Leitura</strong>
                ${chk("texto_extenso", "Texto Extenso")}
                ${chk("vocabulario_complexo", "Vocabulário Denso")}
                ${chk("multiplas_fontes_leitura", "Múltiplas Fontes")}
                ${chk("interpretacao_visual", "Interp. Visual")}

                <strong style="font-size:10px; text-transform:uppercase; color:gray; display:block; margin-bottom:4px; margin-top:8px;">Conhecimento</strong>
                ${chk("dependencia_conteudo_externo", "Conteúdo Prévio")}
                ${chk("interdisciplinaridade", "Interdisciplinar")}
                ${chk("contexto_abstrato", "Contexto Abstrato")}
            </div>

            <div>
                <strong style="font-size:10px; text-transform:uppercase; color:gray; display:block; margin-bottom:4px;">Raciocínio</strong>
                ${chk("raciocinio_contra_intuitivo", "Contra-Intuitivo")}
                ${chk("abstracao_teorica", "Teoria Pura")}
                ${chk("deducao_logica", "Dedução Lógica")}

                <strong style="font-size:10px; text-transform:uppercase; color:gray; display:block; margin-bottom:4px; margin-top:8px;">Operacional</strong>
                ${chk("resolucao_multiplas_etapas", "Multi-etapas")}
                ${chk("transformacao_informacao", "Transformação Info")}
                ${chk("distratores_semanticos", "Distratores Fortes")}
                ${chk("analise_nuance_julgamento", "Julgamento")}
            </div>
        </div>
        `;
            })()}

    <div style="margin-top:10px;">
        <span class="field-label">Justificativa da Dificuldade</span>
        <textarea id="editComplexidadeJust" class="form-control" rows="2" placeholder="Explique por que é difícil...">${safe(complexidadeRaw?.justificativa_dificuldade || "")}</textarea>
    </div>
  </div>

  <!-- CRÉDITOS / FONTE -->
  <div class="field-group">
    <span class="field-label">Créditos / Fonte</span>

    <div style="display:flex; flex-wrap:wrap; gap:10px;">
      <div style="flex:1; min-width:160px;">
        <span class="field-label">Origem da resolução</span>
        <input id="editCredOrigem" class="form-control" type="text"
               value="${safe(creditos?.origemresolucao || "")}"
               placeholder="extraidodomaterial / geradopelaia" />
      </div>

      <div style="flex:1; min-width:160px;">
        <span class="field-label">Material</span>
        <input id="editCredMaterial" class="form-control" type="text"
               value="${safe(creditos?.material || "")}"
               placeholder="Ex.: FUVEST 2023" />
      </div>

      <div style="flex:1; min-width:160px;">
        <span class="field-label">Autor/Instituição</span>
        <input id="editCredAutor" class="form-control" type="text"
               value="${safe(creditos?.autorouinstituicao || "")}"
               placeholder="Banca, escola, editora..." />
      </div>

      <div style="flex:0 0 100px;">
        <span class="field-label">Ano</span>
        <input id="editCredAno" class="form-control" type="text"
               value="${safe(creditos?.ano || "")}" placeholder="2024" />
      </div>
    </div>

    <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:8px;">
      <div style="flex:0 0 140px;">
        <span class="field-label">Mat. identificado?</span>
        <label style="display:flex; gap:6px; align-items:center; margin-top:4px;">
          <input id="editCredMatIdentificado" type="checkbox"
            ${creditos?.materialidentificado ? "checked" : ""} />
          <span style="font-size:12px;">Sim</span>
        </label>
      </div>

      <div style="flex:0 0 170px;">
        <span class="field-label">Precisa crédito genérico?</span>
        <label style="display:flex; gap:6px; align-items:center; margin-top:4px;">
          <input id="editCredPrecisaGenerico" type="checkbox"
            ${creditos?.precisacreditogenerico ? "checked" : ""} />
          <span style="font-size:12px;">Sim</span>
        </label>
      </div>

      <div style="flex:1; min-width:160px;">
        <span class="field-label">Confiança identificação (0–1)</span>
        <input id="editCredConfId" class="form-control" type="number"
               min="0" max="1" step="0.01"
               value="${creditos?.confiancaidentificacao ?? ""}" />
      </div>
    </div>

    <div style="margin-top:8px;">
      <span class="field-label">Como identificou</span>
      <textarea id="editCredComo" class="form-control" rows="2"
        placeholder="Cabeçalho, rodapé, diagramação...">${safe(creditos?.comoidentificou || "")
            }</textarea>
    </div>

    <div style="margin-top:8px;">
      <span class="field-label">Crédito sugerido (texto)</span>
      <textarea id="editCredTextoSugerido" class="form-control" rows="2"
        placeholder="Texto pronto para mostrar como crédito.">${safe(creditos?.textocreditosugerido || "")
            }</textarea>
    </div>
  </div>

  <!-- ALERTAS & OBSERVAÇÕES GERAIS -->
  <div class="field-group">
    <span class="field-label">Alertas de crédito (1 por linha)</span>
    <textarea id="editGabaritoAlertas" class="form-control" rows="3">${safe(alertasCredito.join("\n"))
            }</textarea>
  </div>

  <div class="field-group">
    <span class="field-label">Observações gerais (1 por linha)</span>
    <textarea id="editGabaritoObs" class="form-control" rows="3">${safe(observacoes.join("\n"))
            }</textarea>
  </div>

  <!-- BOTÕES -->
  <button type="button" class="btn btn--primary btn--full-width"
          id="btnSalvarEdicaoGabarito" style="margin-top:12px;">
    Salvar alterações (gabarito)
  </button>
  <button type="button" class="btn btn--secondary btn--full-width"
          id="btnCancelarEdicaoGabarito" style="margin-top:8px;">
    Cancelar
  </button>
</form>
  </div>
`;

    }

    container.innerHTML = htmlAbas + htmlQuestao + htmlGabarito;

    // *** NOVO: Renderiza Markdown e LaTeX dentro do container criado ***
    if (window.renderLatexIn) {
        // Pequeno delay para garantir que o DOM renderizou
        setTimeout(() => {
            window.renderLatexIn(container);
        }, 0);
    }

    // --- LÓGICA DO EDITOR DE PASSOS DO GABARITO ---
    const initStepEditors = () => {
        const containerPassos = container.querySelector('#editGabaritoPassos');
        if (!containerPassos) return;

        containerPassos.querySelectorAll('.step-edit-row').forEach(row => {
            const dragContainer = row.querySelector('.step-drag-container');

            // 1. Ativa Drag & Drop
            if (dragContainer) {
                window.iniciarEditorEstrutura(dragContainer);
            }

            // 2. Configura o botão de abrir/fechar menu
            const toggleBtn = row.querySelector('.btn-toggle-step-add');
            const menu = row.querySelector('.step-menu-content');

            if (toggleBtn && menu) {
                toggleBtn.onclick = (e) => {
                    e.stopPropagation(); // Impede que o clique feche imediatamente
                    const wasHidden = menu.classList.contains('hidden');

                    // Fecha todos os outros menus abertos antes
                    document.querySelectorAll('.step-menu-content').forEach(m => m.classList.add('hidden'));

                    if (wasHidden) menu.classList.remove('hidden');
                };
            }

            // 3. Configura os botões de itens dentro do menu
            row.querySelectorAll('.btn-add-step-item').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const tipo = btn.dataset.type;
                    const html = window.criarHtmlBlocoEditor(tipo, "");

                    const temp = document.createElement("div");
                    temp.innerHTML = html.trim();
                    const novoBloco = temp.firstChild;

                    if (dragContainer) {
                        dragContainer.appendChild(novoBloco);
                        novoBloco.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }

                    // Fecha o menu após adicionar
                    if (menu) menu.classList.add('hidden');
                };
            });

            // 4. Botão remover passo (mantido)
            const btnRem = row.querySelector('.btn-remove-step');
            if (btnRem) {
                btnRem.onclick = () => {
                    if (confirm("Remover este passo inteiro?")) row.remove();
                };
            }
        });
    };

    // --- IMPORTANTE: Só chamamos initStepEditors DEPOIS de inserir na tela (ver abaixo) ---

    // Lógica do Botão "Adicionar Novo Passo" (Geral)
    // CORREÇÃO: Usa container.querySelector
    const btnAddPasso = container.querySelector('#btnAddPassoGabarito');
    if (btnAddPasso) {
        btnAddPasso.onclick = () => {
            const containerPassos = container.querySelector('#editGabaritoPassos');
            const novoIndex = containerPassos.children.length;

            const div = document.createElement('div');
            div.className = "step-edit-row";
            div.dataset.stepIndex = novoIndex;
            div.style.cssText = "border:1px solid var(--color-border); padding:15px; border-radius:8px; margin-bottom:15px; background:var(--color-bg-1);";

            // Cria um passo novo já com 1 bloco de texto vazio pra facilitar
            const blocoTextoInicial = window.criarHtmlBlocoEditor("texto", "");

            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:10px; align-items:center;">
                    <strong style="color:var(--color-primary);">Passo (Novo)</strong>
                    <button type="button" class="btn btn--sm btn--outline btn-remove-step" style="color:var(--color-error); border-color:var(--color-error); font-size:11px;">✕ Remover Passo</button>
                </div>

                <div class="structure-editor-wrapper">
                    <div class="structure-editor-container step-drag-container" style="min-height: 50px; background: var(--color-background);">
                        ${blocoTextoInicial}
                    </div>
                    
                    <div class="structure-toolbar step-add-toolbar" style="margin-top:8px; padding-top:8px; border-top:1px dashed var(--color-border); position:relative;">
                        <button type="button" class="btn btn--sm btn--secondary btn--full-width btn-toggle-step-add" style="display:flex; justify-content:center; align-items:center; gap:5px; background:var(--color-bg-2);">
                            <span>+ Adicionar Bloco de Conteúdo</span>
                            <span style="font-size:10px; opacity:0.7;">▼</span>
                        </button>
                        <div class="step-menu-content hidden" style="position:absolute; top:100%; left:0; width:100%; z-index:100; display:grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap:5px; padding:10px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.15); margin-top:5px;">
                            <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="texto">Texto</button>
                            <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="imagem">Imagem</button>
                            <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="equacao">Equação</button>
                            <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="lista">Lista</button>
                            <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="destaque">Destaque</button>
                            <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="citacao">Citação</button>
                            <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="codigo">Código</button>
                            <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="titulo">Título</button>
                            <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="subtitulo">Subtítulo</button>
                            <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="fonte">Fonte</button>
                            <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="separador">Separador</button>
                        </div>
                    </div>
                </div>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:15px; background:rgba(0,0,0,0.03); padding:10px; border-radius:6px;">
                    <div style="flex:1;">
                        <span class="field-label" style="font-size:10px;">Origem</span>
                        <select class="form-control passo-origem" style="width:100%;"><option value="gerado_pela_ia">🤖 IA</option><option value="extraido_do_material">📄 Material</option></select>
                    </div>
                    <div style="flex:1;">
                        <span class="field-label" style="font-size:10px;">Fonte</span>
                        <input class="form-control passo-fonte" value="" style="width:100%;" />
                    </div>
                    <div style="grid-column:1/-1;">
                        <span class="field-label" style="font-size:10px;">Evidência</span>
                        <input class="form-control passo-evidencia" value="" style="width:100%;" />
                    </div>
                </div>
            `;

            containerPassos.appendChild(div);

            // Re-executa a inicialização para pegar esse novo elemento criado
            initStepEditors();

            div.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };
    }

    // Limpa anterior e insere novo NA DOM (Agora sim os elementos existem na tela)
    const oldResult = sidebar.querySelector('.extraction-result');
    if (oldResult) oldResult.remove();
    sidebar.appendChild(container); // <--- INSERÇÃO NA TELA AQUI

    // --- AGORA CHAMAMOS A INICIALIZAÇÃO DOS BOTÕES ---
    initStepEditors();
    window.iniciarEditorEstrutura(); // Inicializa o editor principal (Questão)

    // Botões "Adicionar bloco" das alternativas
    container.querySelectorAll(".alt-edit-row").forEach(row => {
        const drag = row.querySelector(".alt-drag-container");
        if (!drag) return;

        row.querySelectorAll(".btn-alt-add").forEach(btn => {
            btn.onclick = () => {
                const tipo = btn.dataset.addType;
                const html = window.criarHtmlBlocoEditor(tipo, "");
                const temp = document.createElement("div");
                temp.innerHTML = html.trim();
                drag.appendChild(temp.firstChild);
            };
        });

        // Remover alternativa
        row.querySelector(".btn-remove-alt")?.addEventListener("click", () => row.remove());
    });

    // --- LÓGICA DE REATIVIDADE ROBUSTA ---
    const setupImageToggle = (checkboxId, containerId, targetObj) => {
        const chk = document.getElementById(checkboxId);
        const cont = document.getElementById(containerId);

        if (!chk || !cont) return;

        // Função que aplica o estado
        const applyState = () => {
            cont.style.display = chk.checked ? 'block' : 'none';
            // Persiste no objeto global
            if (targetObj) targetObj.possui_imagem = chk.checked;
        };

        // Estado inicial
        applyState();

        // Listener
        chk.addEventListener('change', applyState);
    };

    // Container Gabarito ID: 'containerGaleriaGabarito' | Checkbox Gabarito ID: 'editGabaritoPossuiImagem'
    // Pequeno timeout para garantir que o navegador renderizou os IDs
    setTimeout(() => {
        setupImageToggle('editGabaritoPossuiImagem', 'containerGaleriaGabarito', window.__ultimoGabaritoExtraido);
    }, 0);

    // --- EVENT LISTENERS ---

    // Botão "Editar Questão" (Entra no modo edição)
    const btnEditar = container.querySelector('#btnEditar');
    if (btnEditar) {
        btnEditar.onclick = () => {
            const view = container.querySelector('#questaoView');
            const edit = container.querySelector('#questaoEdit');
            const actions = container.querySelector('#actionsLeitura');

            if (view) view.classList.add('hidden');
            if (actions) actions.classList.add('hidden');
            if (edit) edit.classList.remove('hidden');
        };
    }

    const btnFinalizarTudo = container.querySelector("#btnFinalizarTudo");
    if (btnFinalizarTudo) {
        btnFinalizarTudo.onclick = async () => {
            // AQUI ESTÁ A MUDANÇA:
            // Chama a validação passando o contexto 'gabarito'
            const tudoCerto = await window.validarProgressoImagens('gabarito');

            // Só abre a tela final se estiver tudo preenchido ou se o usuário confirmar no modal
            if (tudoCerto) {
                window.renderizarTelaFinal();
            }
        };
    }

    // --- LÓGICA DE REMOVER ALTERNATIVA (Para as que já existem) ---
    container.querySelectorAll('.btn-remove-alt').forEach(btn => {
        btn.onclick = function () {
            this.parentElement.remove();
        };
    });

    // --- LÓGICA DO BOTÃO ADICIONAR ALTERNATIVA NA EDIÇÃO ---
    const btnAddAltEdit = container.querySelector('#btnAddAlt'); // ID corrigido conforme HTML gerado anteriormente
    if (btnAddAltEdit) {
        btnAddAltEdit.onclick = () => {
            const divAlts = container.querySelector('#edit_alts');
            const novaLinha = document.createElement('div');
            novaLinha.className = 'alt-row alt-edit-row';
            novaLinha.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-bottom:10px;';

            // Cria um passo novo já com 1 bloco de texto vazio
            const blocoTextoInicial = window.criarHtmlBlocoEditor("texto", "");

            novaLinha.innerHTML = `
                <div style="display:flex;gap:5px;align-items:center;">
                    <input class="form-control alt-letter" style="width:60px;text-align:center;" value="" placeholder="Letra">
                    <button type="button" class="btn btn--sm btn--outline btn-remove-alt" style="color:var(--color-error);border-color:var(--color-error);min-width:30px;" title="Remover alternativa">✕</button>
                </div>
                <div class="alt-editor">
                    <div class="structure-editor-wrapper">
                        <div class="structure-editor-container alt-drag-container">
                            ${blocoTextoInicial}
                        </div>
                        <div class="structure-toolbar alt-add-buttons" style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">
                            <button type="button" class="btn btn--sm btn--secondary btn-alt-add" data-add-type="texto">Texto</button>
                            <button type="button" class="btn btn--sm btn--secondary btn-alt-add" data-add-type="equacao">Equação</button>
                            <button type="button" class="btn btn--sm btn--secondary btn-alt-add" data-add-type="imagem">Imagem</button>
                        </div>
                    </div>
                </div>
            `;

            // Reativa a lógica de botões para essa nova linha
            novaLinha.querySelectorAll(".btn-alt-add").forEach(btn => {
                btn.onclick = () => {
                    const tipo = btn.dataset.addType;
                    const html = window.criarHtmlBlocoEditor(tipo, "");
                    const temp = document.createElement("div");
                    temp.innerHTML = html.trim();
                    novaLinha.querySelector(".alt-drag-container").appendChild(temp.firstChild);
                };
            });

            novaLinha.querySelector('.btn-remove-alt').onclick = function () { novaLinha.remove(); };
            divAlts.appendChild(novaLinha);
        };
    }

    // Listener do Cancelar
    const btnCancelarEdicao = container.querySelector('#btnCancelarEdicao');
    if (btnCancelarEdicao) {
        btnCancelarEdicao.onclick = () => {
            container.querySelector('#questaoEdit').classList.add('hidden');
            container.querySelector('#questaoView').classList.remove('hidden');
            container.querySelector('#actionsLeitura').classList.remove('hidden');
        };
    }

    // --- EDITAR GABARITO ---
    const btnEditarGabarito = container.querySelector("#btnEditarGabarito");
    if (btnEditarGabarito) btnEditarGabarito.onclick = () => {
        const view = container.querySelector("#gabaritoView");
        const edit = container.querySelector("#gabaritoEdit");
        const actions = container.querySelector("#actionsLeituraGabarito");
        if (view) view.classList.add("hidden");
        if (actions) actions.classList.add("hidden");
        if (edit) edit.classList.remove("hidden");
    };

    const btnCancelarEdicaoGabarito = container.querySelector("#btnCancelarEdicaoGabarito");
    if (btnCancelarEdicaoGabarito) btnCancelarEdicaoGabarito.onclick = () => {
        renderizarQuestaoFinal(window.ultimoGabaritoExtraido || gabarito);
    };

    const btnSalvarEdicaoGabarito = container.querySelector("#btnSalvarEdicaoGabarito");
    if (btnSalvarEdicaoGabarito) btnSalvarEdicaoGabarito.onclick = () => {
        const normLetra = (v) => String(v || "").trim().toUpperCase();
        const getLines = (sel) =>
            (container.querySelector(sel)?.value || "")
                .split("\n").map(s => s.trim()).filter(Boolean);

        const respostaNova = normLetra(container.querySelector("#editGabaritoResposta")?.value);
        const justNova = container.querySelector("#editGabaritoJust")?.value || "";

        const confRaw = container.querySelector("#editGabaritoConfianca")?.value;
        const confNova = confRaw === "" ? null : Number(confRaw);

        // --- NOVA LEITURA DE PASSOS ---
        const passos = [];
        container.querySelectorAll("#editGabaritoPassos .step-edit-row").forEach(row => {
            const origem = row.querySelector(".passo-origem")?.value || "gerado_pela_ia";
            const fontematerial = row.querySelector(".passo-fonte")?.value || "";
            const evidencia = row.querySelector(".passo-evidencia")?.value || "";

            const estruturaPasso = [];
            row.querySelectorAll(".step-drag-container .structure-item").forEach(item => {
                const tipo = item.dataset.type;
                const conteudo = item.querySelector(".item-content")?.value || "";
                estruturaPasso.push({ tipo, conteudo });
            });

            if (estruturaPasso.length > 0) {
                // Cria texto simples para compatibilidade
                const passoTextoSimples = estruturaPasso.map(b => b.conteudo).join(" ");
                passos.push({
                    passo: passoTextoSimples,
                    estrutura: estruturaPasso,
                    origem,
                    fontematerial,
                    evidencia
                });
            }
        });

        const motivos = {};
        container.querySelectorAll(".gabarito-motivo").forEach(t => {
            const letra = normLetra(t.dataset.letra);
            motivos[letra] = t.value || "";
        });

        const alts = Array.isArray(questao?.alternativas) ? questao.alternativas : [];
        const alternativasAnalisadasNovas = alts.map(a => {
            const letra = normLetra(a?.letra);
            return {
                letra,
                correta: letra && respostaNova && letra === respostaNova,
                motivo: motivos[letra] || ""
            };
        });

        const fatoresNovos = {};
        container.querySelectorAll(".chk-complexidade").forEach(chk => {
            const k = chk.dataset.key;
            fatoresNovos[k] = chk.checked;
        });
        const justComplexidade = container.querySelector("#editComplexidadeJust")?.value || "";

        const coerAltExiste = !!container.querySelector("#editCoerenciaAltExiste")?.checked;
        const coerTodas = !!container.querySelector("#editCoerenciaTodasAnalise")?.checked;
        const coerObs = getLines("#editCoerenciaObs");

        const creditosNovos = {
            origemresolucao: container.querySelector("#editCredOrigem")?.value || "",
            materialidentificado: !!container.querySelector("#editCredMatIdentificado")?.checked,
            confiancaidentificacao: (() => {
                const v = container.querySelector("#editCredConfId")?.value;
                return v === "" ? null : Number(v);
            })(),
            material: container.querySelector("#editCredMaterial")?.value || "",
            autorouinstituicao: container.querySelector("#editCredAutor")?.value || "",
            ano: container.querySelector("#editCredAno")?.value || "",
            comoidentificou: container.querySelector("#editCredComo")?.value || "",
            precisacreditogenerico: !!container.querySelector("#editCredPrecisaGenerico")?.checked,
            textocreditosugerido: container.querySelector("#editCredTextoSugerido")?.value || ""
        };

        const alertasNovos = getLines("#editGabaritoAlertas");
        const observacoesNovas = getLines("#editGabaritoObs");

        const base = window.ultimoGabaritoExtraido || gabarito || {};
        const novo = structuredClone ? structuredClone(base) : JSON.parse(JSON.stringify(base));

        novo.alternativa_correta = respostaNova;
        novo.resposta = respostaNova;
        novo.justificativa_curta = justNova;
        novo.confianca = confNova;
        novo.explicacao = passos;
        novo.alternativas_analisadas = alternativasAnalisadasNovas;
        novo.coerencia = {
            alternativa_correta_existe: coerAltExiste,
            tem_analise_para_todas: coerTodas,
            observacoes: coerObs
        };
        novo.creditos = creditosNovos;
        novo.alertas_credito = alertasNovos;
        novo.observacoes = observacoesNovas;
        novo.analise_complexidade = {
            fatores: fatoresNovos,
            justificativa_dificuldade: justComplexidade
        };

        window.__ultimoGabaritoExtraido = novo;
        customAlert("✅ Gabarito atualizado!", 2000);
        renderizarQuestaoFinal(novo);
    };


    const btnConfirmar = container.querySelector('#btnConfirmarQuestao');
    if (btnConfirmar) {
        btnConfirmar.onclick = async () => {
            const urls = window.__pdfUrls || window.pdfUrls;
            if (urls?.gabarito) window.__preferirPdfGabarito = true;
            await window.trocarModo("gabarito");
            if (window.modo == "gabarito") window.esconderPainel?.();
        };
    }

    // --- LÓGICA DO BOTÃO ADICIONAR ALTERNATIVA ---
    const btnAddAlt = container.querySelector('#btnAddAlt');
    if (btnAddAlt) {
        btnAddAlt.onclick = () => {
            const divAlts = container.querySelector("#editalts");
            const nova = document.createElement("div");
            nova.className = "alt-row alt-edit-row";
            nova.style.cssText = "display:flex;flex-direction:column;gap:8px;margin-bottom:10px";

            const blocoInicial = window.criarHtmlBlocoEditor("texto", "");

            nova.innerHTML = `
    <div style="display:flex;gap:5px;align-items:center">
      <input class="form-control alt-letter" style="width:60px;text-align:center" value="" placeholder="Letra">
      <button type="button" class="btn btn--sm btn--outline btn-remove-alt"
        style="color:var(--color-error);border-color:var(--color-error);min-width:30px" title="Remover alternativa">-</button>
    </div>

    <div class="alt-editor">
      <div class="structure-editor-wrapper">
        <div class="structure-editor-container alt-drag-container">${blocoInicial}</div>
        <div class="structure-toolbar alt-add-buttons" style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="btn btn--sm btn--secondary btn-alt-add" data-add-type="texto">Texto</button>
          <button type="button" class="btn btn--sm btn--secondary btn-alt-add" data-add-type="equacao">Equação</button>
          <button type="button" class="btn btn--sm btn--secondary btn-alt-add" data-add-type="imagem">Imagem</button>
        </div>
      </div>
    </div>
  `;

            nova.querySelector(".btn-remove-alt").onclick = () => nova.remove();
            divAlts.appendChild(nova);
        };

    }

    // --- LÓGICA DO BOTÃO SALVAR QUESTÃO ---
    const btnSalvar = container.querySelector('#btnSalvarEdicao');
    if (btnSalvar) {
        btnSalvar.onclick = () => {
            const idVal = container.querySelector('#edit_identificacao')?.value || "";
            const containerEditor = container.querySelector('#editor-drag-container');

            const novaEstrutura = [];
            if (containerEditor) {
                containerEditor.querySelectorAll('.structure-item').forEach(item => {
                    const tipo = item.dataset.type;
                    const inputEl = item.querySelector('.item-content');
                    const conteudo = inputEl ? inputEl.value : "";
                    novaEstrutura.push({ tipo, conteudo });
                });
            }
            const estruturaNormalizada = normalizarEstrutura(novaEstrutura);

            const novoEnunciado = estruturaNormalizada
                .filter(b => b.tipo === 'texto' || b.tipo === 'citacao' || b.tipo === 'titulo' || b.tipo === 'subtitulo')
                .map(b => b.conteudo)
                .join('\n');

            const novasAlternativas = [];
            container.querySelectorAll(".alt-edit-row").forEach(row => {
                const letra = String(row.querySelector(".alt-letter")?.value ?? "").trim().toUpperCase();
                if (!letra) return;

                const estrutura = [];
                row.querySelectorAll(".alt-drag-container .structure-item").forEach(item => {
                    const tipo = String(item.dataset.type ?? "texto").toLowerCase().trim();
                    const conteudo = String(item.querySelector(".item-content")?.value ?? "");
                    if (["texto", "equacao", "imagem"].includes(tipo)) {
                        estrutura.push({ tipo, conteudo });
                    }
                });
                novasAlternativas.push({ letra, estrutura });
            });

            const getLines = (sel) => (container.querySelector(sel)?.value || "").split('\n').map(s => s.trim()).filter(Boolean);

            if (window.__ultimaQuestaoExtraida) {
                window.__ultimaQuestaoExtraida.identificacao = idVal;
                window.__ultimaQuestaoExtraida.estrutura = estruturaNormalizada;
                window.__ultimaQuestaoExtraida.enunciado = novoEnunciado;
                window.__ultimaQuestaoExtraida.materias_possiveis = getLines('#edit_materias');
                window.__ultimaQuestaoExtraida.palavras_chave = getLines('#edit_palavras');
                window.__ultimaQuestaoExtraida.alternativas = novasAlternativas;

                customAlert("✅ Conteúdo estruturado salvo!", 2000);
                renderizarQuestaoFinal(window.__ultimaQuestaoExtraida);
            }
        };
    }

    // --- Tabs ---
    if (gabarito) {
        const btnQ = container.querySelector("#btnTabQuestao");
        const btnG = container.querySelector("#btnTabGabarito");
        const qView = container.querySelector("#tabContentQuestao");
        const gView = container.querySelector("#tabContentGabarito");

        const setActive = (active) => {
            const showQ = active === "questao";
            if (qView) qView.style.display = showQ ? "block" : "none";
            if (gView) gView.style.display = showQ ? "none" : "block";

            if (btnQ && btnG) {
                btnQ.classList.toggle("btn--primary", showQ);
                btnQ.classList.toggle("btn--secondary", !showQ);
                btnG.classList.toggle("btn--primary", !showQ);
                btnG.classList.toggle("btn--secondary", showQ);
            }
        };

        if (btnQ) btnQ.onclick = () => setActive("questao");
        if (btnG) btnG.onclick = () => setActive("gabarito");
    }
}

window.verImagensOriginais = function () {
    // 1. Recuperação das imagens (Lógica original mantida)
    const imgsQ = (window.__BACKUP_IMGS_Q && window.__BACKUP_IMGS_Q.length > 0)
        ? window.__BACKUP_IMGS_Q
        : (window.__imagensLimpas?.questao_original || []);

    const imgsG = (window.__BACKUP_IMGS_G && window.__BACKUP_IMGS_G.length > 0)
        ? window.__BACKUP_IMGS_G
        : (window.__imagensLimpas?.gabarito_original || []);

    // 3. Função auxiliar de renderização
    const renderLista = (lista) => {
        if (lista.length === 0) return `<div style="color:gray; padding:10px;">Sem imagens</div>`;
        return lista.map(src => `
            <img src="${src}" class="img-content">
        `).join('');
    };

    // 4. Criação do HTML usando as classes definidas acima
    const overlay = document.createElement('div');
    overlay.className = 'img-overlay';

    overlay.innerHTML = `
        <div class="img-close-container">
            <button class="img-close-btn" onclick="this.closest('.img-overlay').remove()">✕ Fechar</button>
        </div>
        
        <div class="img-modal-body">
            <div class="img-col">
                <div class="img-title" style="color:#00bfff;">
                    Questão Original (${imgsQ.length})
                </div>
                ${renderLista(imgsQ)}
            </div>

            <div class="img-divider"></div>

            <div class="img-col">
                <div class="img-title" style="color:#ffaa00;">
                    Gabarito Original (${imgsG.length})
                </div>
                ${renderLista(imgsG)}
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
};

window.renderizarTelaFinal = function () {
    const q = window.__ultimaQuestaoExtraida;
    const g = window.__ultimoGabaritoExtraido;

    if (!q || !g) {
        customAlert("⚠️ Extração incompleta. Certifique-se de processar Questão e Gabarito.");
        return;
    }

    const tituloMaterial = window.__viewerArgs?.rawTitle || "Material Não Identificado";
    const safe = (s) => String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    const renderTags = (l, c) => (!l || l.length === 0) ? '<span style="font-size:11px; color:gray; opacity:0.7;">—</span>' : l.map(i => `<span class="data-tag ${c}">${safe(i)}</span>`).join('');

    const explicacaoArray = Array.isArray(g.explicacao) ? g.explicacao : [];

    const styleNoEdit = `
    <style>
        #finalModal .btn-trocar-img, 
        #finalModal .btn-delete-block, 
        #finalModal .structure-image-placeholder strong,
        #finalModal .structure-image-placeholder .icon { display: none !important; }
        #finalModal .structure-image-placeholder { pointer-events: none; border: none; background: transparent; padding: 0; }
        #finalModal .structure-img { cursor: default !important; }
        #finalModal .q-opt-btn { pointer-events: none; }
    </style>
    `;

    // Helpers de renderização (mantidos iguais)
    const renderImgsLimpas = (lista, titulo) => {
        if (!lista || lista.length === 0) return '';
        return `
        <div class="field-group" style="margin-bottom:15px; border:1px solid var(--color-border); padding:10px; border-radius:8px;">
            <span class="field-label" style="display:block; margin-bottom:5px;">${titulo} (${lista.length})</span>
            <div class="img-final-gallery" style="display:flex; flex-wrap:wrap; gap:8px;">
                ${lista.map(src => `
                    <div style="width:60px; height:60px; border:1px solid var(--color-border); border-radius:4px; overflow:hidden; background:var(--color-surface);">
                        <img src="${src}" style="width:100%; height:100%; object-fit:cover;">
                    </div>
                `).join('')}
            </div>
        </div>`;
    };

    const renderComplexidadeVisual = (comp) => {
        if (!comp || !comp.fatores) return '';
        const labels = {
            texto_extenso: "Texto Extenso", vocabulario_complexo: "Vocabulário Denso", multiplas_fontes_leitura: "Múltiplas Fontes",
            interpretacao_visual: "Interp. Visual", dependencia_conteudo_externo: "Conteúdo Prévio", interdisciplinaridade: "Interdisciplinar",
            contexto_abstrato: "Abstrato", raciocinio_contra_intuitivo: "Contra-Intuitivo", abstracao_teorica: "Teoria Pura",
            deducao_logica: "Dedução Lógica", resolucao_multiplas_etapas: "Multi-etapas", transformacao_informacao: "Transformação Info",
            distratores_semanticos: "Distratores Fortes", analise_nuance_julgamento: "Julgamento Sutil"
        };
        let htmlItems = '';
        Object.entries(comp.fatores).forEach(([k, v]) => {
            const key = k.replace(/([A-Z])/g, "_$1").toLowerCase();
            if (v === true && labels[key]) {
                htmlItems += `<span class="badge" style="background:var(--color-secondary); color:var(--color-text); font-size:10px; border:1px solid var(--color-border);">${labels[key]}</span>`;
            }
        });
        return `
        <div class="field-group" style="margin-top:15px; background:rgba(0,0,0,0.02); padding:10px; border-radius:8px;">
            <span class="field-label" style="color:var(--color-primary);">⚡ Análise de Complexidade</span>
            <div style="display:flex; flex-wrap:wrap; gap:5px; margin-top:5px; margin-bottom:8px;">
                ${htmlItems || '<span style="font-size:11px; color:gray;">Nenhum fator crítico marcado.</span>'}
            </div>
            ${comp.justificativa_dificuldade ? `<div class="markdown-content" data-raw="${safe(comp.justificativa_dificuldade)}" style="font-size:12px; font-style:italic; color:var(--color-text-secondary); margin-top:8px;">${safe(comp.justificativa_dificuldade)}</div>` : ''}
        </div>`;
    };

    const renderCreditosTable = (c) => {
        if (!c) return '';
        return `
        <div class="field-group" style="margin-top:15px;">
            <span class="field-label">Créditos & Fonte</span>
            <table style="width:100%; font-size:12px; border-collapse:collapse; margin-top:5px;">
                <tr style="border-bottom:1px solid var(--color-border);"><td style="color:var(--color-text-secondary); padding:4px;">Instituição</td><td style="padding:4px;">${safe(c.autor_ou_instituicao || "—")}</td></tr>
                <tr style="border-bottom:1px solid var(--color-border);"><td style="color:var(--color-text-secondary); padding:4px;">Material</td><td style="padding:4px;">${safe(c.material || "—")}</td></tr>
                <tr style="border-bottom:1px solid var(--color-border);"><td style="color:var(--color-text-secondary); padding:4px;">Ano</td><td style="padding:4px;">${safe(c.ano || "—")}</td></tr>
                <tr><td style="color:var(--color-text-secondary); padding:4px;">Origem</td><td style="padding:4px;">${c.origem_resolucao === 'extraido_do_material' ? '📄 Extraído' : '🤖 IA'}</td></tr>
            </table>
        </div>`;
    };

    const imagensFinais = {
        q_original: window.__imagensLimpas?.questao_original || [],
        q_suporte: window.__imagensLimpas?.questao_suporte || [],
        g_original: window.__imagensLimpas?.gabarito_original || [],
        g_suporte: window.__imagensLimpas?.gabarito_suporte || []
    };

    // Montagem Questão
    const htmlEstruturaQuestao = window.renderizarEstruturaHTML(q.estrutura, imagensFinais.q_original, 'final_view_q');
    const htmlQuestaoSide = `
        <div class="extraction-result" style="border:none; padding:0; background:transparent;">
            <div class="result-header" style="background:var(--color-bg-1); padding:10px; border-radius:8px; margin-bottom:15px; border:1px solid var(--color-primary);">
                <div>
                    <h3 style="color:var(--color-primary); margin:0; font-size:16px;">QUESTÃO</h3>
                    <div style="font-size:11px; color:var(--color-text-secondary); margin-top:2px;">Material: <strong>${safe(tituloMaterial)}</strong></div>
                </div>
                <span class="badge-success" style="font-size:12px;">ID: ${safe(q.identificacao)}</span>
            </div>
            ${renderImgsLimpas(imagensFinais.q_suporte, "Imagens de Suporte (Questão)")}
            <div class="field-group">
                <span class="field-label">Enunciado</span>
                <div class="data-box scrollable" style="background:var(--color-background); border-color:var(--color-border); padding:15px;">${htmlEstruturaQuestao}</div>
            </div>
            <div style="gap:10px; margin-top:10px;">
                <div class="field-group"><span class="field-label">Matérias</span><div class="data-box">${renderTags(q.materias_possiveis, 'tag-subject')}</div></div>
            </div>
            <div class="field-group" style="margin-top:10px;"><span class="field-label">Palavras-Chave</span><div class="tags-wrapper">${renderTags(q.palavras_chave, 'tag-keyword')}</div></div>
            <div class="field-group" style="margin-top:15px;">
                <span class="field-label">Alternativas</span>
                <div class="alts-list">
                    ${(q.alternativas || []).map(alt => {
        const htmlAlt = window.renderizar_estrutura_alternativa(Array.isArray(alt.estrutura) ? alt.estrutura : [{ tipo: 'texto', conteudo: alt.texto || '' }], alt.letra);
        return `<div class="alt-row" style="background:var(--color-background);"><span class="alt-letter">${safe(alt.letra)}</span><div class="alt-content">${htmlAlt}</div></div>`;
    }).join('')}
                </div>
            </div>
        </div>
    `;

    // Montagem Gabarito
    const htmlGabaritoSide = `
        <div class="extraction-result" style="border:none; padding:0; background:transparent;">
            <div class="result-header" style="background:var(--color-bg-2); padding:10px; border-radius:8px; margin-bottom:15px; border:1px solid var(--color-warning);">
                <div>
                    <h3 style="color:var(--color-warning); margin:0; font-size:16px;">GABARITO</h3>
                    <div style="font-size:11px; color:var(--color-text-secondary); margin-top:2px;">Confiança IA: <strong>${Math.round((g.confianca || 0) * 100)}%</strong></div>
                </div>
                <span class="badge" style="background:var(--color-success); color:white; font-size:14px; padding:4px 10px;">LETRA ${safe(g.alternativa_correta)}</span>
            </div>
            ${renderImgsLimpas(imagensFinais.g_suporte, "Imagens de Suporte (Gabarito)")}
            <div class="field-group">
                <span class="field-label">Resumo / Justificativa</span>
                <div class="data-box markdown-content" style="background:var(--color-background); font-size:13px;">${safe(g.justificativa_curta)}</div>
            </div>
            ${renderComplexidadeVisual(g.analise_complexidade)}
            ${explicacaoArray.length ? `
            <div class="field-group" style="margin-top:15px;">
                <span class="field-label">Resolução Detalhada</span>
                <div class="gabarito-steps" style="overflow-y:auto; padding-right:5px;">
                    <ol class="steps-list">
                        ${explicacaoArray.map((p, idx) => {
        const imgsPasso = window.__imagensLimpas?.gabarito_passos?.[idx] || [];
        const htmlPasso = window.renderizarEstruturaHTML(p.estrutura, imgsPasso, `final_view_gab_${idx}`);
        const isExtraido = String(p.origem || "").includes("extraido");
        const badge = isExtraido ? `<span class="step-chip" style="border-color:var(--color-success); color:var(--color-success);">📄 Extraído</span>` : `<span class="step-chip" style="border-color:var(--color-primary); color:var(--color-primary);">🤖 IA</span>`;
        return `<li class="step-card"><div class="step-index">${idx + 1}</div><div class="step-body"><div class="step-content">${htmlPasso}</div><div class="step-meta" style="margin-top:8px; padding-top:6px; border-top:1px dashed var(--color-border);">${badge}${p.fontematerial ? `<span class="step-chip step-chip--muted">📚 ${safe(p.fontematerial)}</span>` : ""}</div></div></li>`;
    }).join("")}
                    </ol>
                </div>
            </div>` : ''}
            ${renderCreditosTable(g.creditos)}
        </div>
    `;

    // --- MONTAGEM DO JSON FINAL ---
    const gabaritoLimpo = JSON.parse(JSON.stringify(g));
    delete gabaritoLimpo.alertas_credito;
    if (gabaritoLimpo.creditos) {
        delete gabaritoLimpo.creditos.como_identificou;
        delete gabaritoLimpo.creditos.precisa_credito_generico;
        delete gabaritoLimpo.creditos.texto_credito_sugerido;
    }

    // 1. GABARITO: Pega todas as imagens de backup ou atuais
    const imgsGabaritoReais = (window.__BACKUP_IMGS_G && window.__BACKUP_IMGS_G.length > 0)
        ? window.__BACKUP_IMGS_G
        : (window.__imagensLimpas?.gabarito_original || []);


    if (imgsGabaritoReais.length > 0) {
        // Salva array completo
        gabaritoLimpo.fotos_originais = imgsGabaritoReais;
        // REMOVE explicitamente a chave antiga se ela existir
        delete gabaritoLimpo.foto_original;
    }

    const questaoFinal = JSON.parse(JSON.stringify(q));

    // 2. QUESTÃO: Pega todas as imagens de backup ou atuais
    const imgsQuestaoReais = (window.__BACKUP_IMGS_Q && window.__BACKUP_IMGS_Q.length > 0)
        ? window.__BACKUP_IMGS_Q
        : (window.__imagensLimpas?.questao_original || []);

    if (imgsQuestaoReais.length > 0) {
        // Salva array completo
        questaoFinal.fotos_originais = imgsQuestaoReais;
        // REMOVE explicitamente a chave antiga
        delete questaoFinal.foto_original;
    }

    // --- CORREÇÃO SOLICITADA: REMOVER IDENTIFICAÇÃO REDUNDANTE ---
    // Como a identificação já será a CHAVE do objeto, removemos ela do conteúdo interno
    delete questaoFinal.identificacao;

    // Garante chaves seguras (caso venham vazias)
    const chaveProva = tituloMaterial || "MATERIAL_SEM_TITULO";
    const chaveQuestao = q.identificacao || "QUESTAO_SEM_ID";

    const payloadFinal = {
        [chaveProva]: {
            [chaveQuestao]: { // AQUI JÁ ESTÁ A IDENTIFICAÇÃO COMO CHAVE
                meta: {
                    timestamp: new Date().toISOString(),
                },
                dados_questao: questaoFinal,
                dados_gabarito: gabaritoLimpo
            }
        }
    };

    const jsonString = JSON.stringify(payloadFinal, null, 2);

    const modalHTML = `
    ${styleNoEdit}
    <div class="final-modal-overlay visible" id="finalModal" style="background: rgba(0,0,0,0.9); backdrop-filter: blur(5px);">
        <div class="final-modal-content" style="background: var(--color-background); border: 1px solid var(--color-border); max-width: 1500px; width:95%; height: 95vh; display:flex; flex-direction:column; box-shadow:0 0 40px rgba(0,0,0,0.5);">
            
            <div class="final-modal-header" style="background: var(--color-surface); border-bottom: 1px solid var(--color-border); padding: 15px 25px; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:15px;">
                    <img src="logo.png" style="height:32px;">
                    <div>
                        <h2 style="margin:0; font-size:1.4rem; font-weight:700; color:var(--color-text); line-height:1.2;">Revisão Final & Exportação</h2>
                        <div style="font-size:0.85rem; color:var(--color-text-secondary);">Material base: <strong style="color:var(--color-primary);">${safe(tituloMaterial)}</strong></div>
                    </div>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="btn btn--sm btn--outline" onclick="window.verImagensOriginais()" title="Ver prints originais">
                        👁️ Originais
                    </button>
                    <button class="btn btn--sm btn--secondary" onclick="document.getElementById('finalModal').remove()" style="border-color:var(--color-border); color:var(--color-text);">
                        ✕ Voltar para Edição
                    </button>
                </div>
            </div>

            <div class="modal-body" style="background: var(--color-background); padding: 25px; overflow-y: auto; flex:1;">
                <div class="review-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; height:100%;">
                    <div class="review-col" style="background: var(--color-surface); padding: 20px; border-radius: var(--radius-lg); border: 1px solid var(--color-border); overflow-y:auto; max-height:100%;">
                        ${htmlQuestaoSide}
                    </div>
                    <div class="review-col" style="background: var(--color-surface); padding: 20px; border-radius: var(--radius-lg); border: 1px solid var(--color-border); overflow-y:auto; max-height:100%;">
                        ${htmlGabaritoSide}
                    </div>
                </div>
                <div class="json-debug-area" style="margin-top: 30px; background: #0f172a; border-radius: 8px; overflow: hidden; border: 1px solid var(--color-border);">
                    <details>
                        <summary class="json-debug-header" style="padding: 15px; background: rgba(0,0,0,0.3); color: var(--color-primary); cursor: pointer; font-family: monospace; font-weight: bold; display:flex; justify-content:space-between;">
                            <span>📦 JSON Payload Final (Clique para expandir)</span>
                            <span>📋</span>
                        </summary>
                        <div style="position:relative;">
                             <button class="btn btn--sm btn--primary" style="position:absolute; top:10px; right:10px;" onclick="navigator.clipboard.writeText(document.getElementById('finalJsonOutput').innerText); this.innerText='Copiado!'; setTimeout(()=>this.innerText='Copiar JSON', 1500);">Copiar JSON</button>
                             <pre class="json-dump" id="finalJsonOutput" style="padding: 20px; color: #a5b4fc; margin: 0; max-height: 300px; overflow: auto; font-size: 11px; line-height: 1.4;">${jsonString}</pre>
                        </div>
                    </details>
                </div>
            </div>

           <div class="modal-footer" style="background: var(--color-surface); border-top: 1px solid var(--color-border); padding: 20px; display:flex; justify-content:flex-end; gap:15px;">
                <button class="btn btn--secondary" onclick="document.getElementById('finalModal').remove()">Cancelar</button>
                <button id="btnConfirmarEnvioFinal" class="btn btn--primary" onclick="window.enviarDadosParaFirebase()">🚀 Confirmar e Enviar</button>
            </div>
        </div>
    </div>`;

    const oldModal = document.getElementById('finalModal');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    setTimeout(() => {
        const modalEl = document.getElementById('finalModal');
        if (window.renderLatexIn && modalEl) {
            window.renderLatexIn(modalEl);
        }
    }, 50);
};

window.enviarDadosParaFirebase = async function () {
    const btnEnviar = document.getElementById('btnConfirmarEnvioFinal');

    // 1. VALIDAÇÕES BÁSICAS
    if (IMGBB_API_KEY === "SUA_CHAVE_API_DO_IMGBB_AQUI") {
        customAlert("❌ Configure a API Key do ImgBB no código!");
        return;
    }

    const q = window.__ultimaQuestaoExtraida;
    const g = window.__ultimoGabaritoExtraido;

    if (!q || !g) {
        customAlert("❌ Erro: Dados incompletos. Processe a questão e o gabarito.");
        return;
    }

    // Travamento de UI
    if (btnEnviar) {
        btnEnviar.disabled = true;
        btnEnviar.innerText = "⏳ Preparando JSON...";
    }

    try {
        // --- 2. CONSTRUÇÃO DO PAYLOAD (CÓPIA EXATA DA LÓGICA DO MODAL) ---
        // Queremos salvar EXATAMENTE o que o usuário viu no JSON de revisão

        const rawTitle = window.__viewerArgs?.rawTitle || "Material_Geral";
        // Sanitiza título para ser chave do Firebase (sem ., #, $, [, ])
        const tituloMaterial = rawTitle.replace(/[.#$/[\]]/g, "_");

        // Clones limpos para manipulação
        const questaoFinal = JSON.parse(JSON.stringify(q));
        const gabaritoLimpo = JSON.parse(JSON.stringify(g));

        // --- 1. GABARITO: INJEÇÃO DE IMAGENS ORIGINAIS ---
        const imgsGabaritoReais = (window.__BACKUP_IMGS_G && window.__BACKUP_IMGS_G.length > 0)
            ? window.__BACKUP_IMGS_G
            : (window.__imagensLimpas?.gabarito_original || []);

        if (imgsGabaritoReais.length > 0) {
            // Define o novo padrão (Array)
            gabaritoLimpo.fotos_originais = imgsGabaritoReais;
            // REMOVE O ANTIGO PARA NÃO SUJAR O BANCO
            delete gabaritoLimpo.foto_original;
        }

        // --- 2. QUESTÃO: INJEÇÃO DE IMAGENS ORIGINAIS ---
        const imgsQuestaoReais = (window.__BACKUP_IMGS_Q && window.__BACKUP_IMGS_Q.length > 0)
            ? window.__BACKUP_IMGS_Q
            : (window.__imagensLimpas?.questao_original || []);

        if (imgsQuestaoReais.length > 0) {
            // Define o novo padrão (Array)
            questaoFinal.fotos_originais = imgsQuestaoReais;
            // REMOVE O ANTIGO PARA NÃO SUJAR O BANCO
            delete questaoFinal.foto_original;
        }

        // Limpezas de campos desnecessários do Gabarito
        delete gabaritoLimpo.alertas_credito;
        if (gabaritoLimpo.creditos) {
            delete gabaritoLimpo.creditos.como_identificou;
            delete gabaritoLimpo.creditos.precisa_credito_generico;
            delete gabaritoLimpo.creditos.texto_credito_sugerido;
            delete gabaritoLimpo.creditos.comoidentificou;           // garante snake/camel
            delete gabaritoLimpo.creditos.precisacreditogenerico;
            delete gabaritoLimpo.creditos.textocreditosugerido;
        }

        // Limpeza da Questão (Remove identificação interna pois será a chave)
        delete questaoFinal.identificacao;

        // Define as chaves para o caminho do banco
        const chaveProva = tituloMaterial || "MATERIAL_SEM_TITULO";
        const chaveQuestao = (q.identificacao || "QUESTAO_SEM_ID_" + Date.now()).replace(/[.#$/[\]]/g, "-");

        // Monta o objeto final
        const payloadParaSalvar = {
            meta: {
                timestamp: new Date().toISOString(),
            },
            dados_questao: questaoFinal,
            dados_gabarito: gabaritoLimpo
        };

        // --- 3. SISTEMA RECURSIVO DE UPLOAD DE IMAGENS ---

        // Função auxiliar de upload
        const uploadToImgBB = async (base64String) => {
            const formData = new FormData();
            formData.append("image", base64String.replace(/^data:image\/\w+;base64,/, ""));

            const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: "POST",
                body: formData
            });
            const result = await response.json();
            return result.success ? result.data.url : null;
        };

        // Função recursiva que varre o JSON procurando Base64
        let imagensConvertidas = 0;

        const processarObjetoRecursivo = async (obj) => {
            if (!obj || typeof obj !== 'object') return;

            // Se for array, itera
            if (Array.isArray(obj)) {
                for (let i = 0; i < obj.length; i++) {
                    const val = obj[i];
                    if (typeof val === 'string' && val.startsWith('data:image')) {
                        if (btnEnviar) btnEnviar.innerText = `⏳ Subindo img ${++imagensConvertidas}...`;
                        const url = await uploadToImgBB(val);
                        if (url) obj[i] = url; // Substitui Base64 por URL
                    } else if (typeof val === 'object') {
                        await processarObjetoRecursivo(val);
                    }
                }
                return;
            }

            // Se for objeto, itera chaves
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    const val = obj[key];

                    if (typeof val === 'string' && val.startsWith('data:image')) {
                        // ACHOU BASE64 -> UPLOAD
                        if (btnEnviar) btnEnviar.innerText = `⏳ Subindo img ${++imagensConvertidas}...`;
                        const url = await uploadToImgBB(val);
                        if (url) obj[key] = url; // Substitui Base64 por URL
                    } else if (typeof val === 'object') {
                        // É um sub-objeto ou array -> MERGULHA NELE
                        await processarObjetoRecursivo(val);
                    }
                }
            }
        };

        // DISPARA O PROCESSAMENTO RECURSIVO NO PAYLOAD INTEIRO
        if (btnEnviar) btnEnviar.innerText = "⏳ Analisando imagens...";
        await processarObjetoRecursivo(payloadParaSalvar);

        // --- 4. ENVIO PARA O FIREBASE ---
        if (btnEnviar) btnEnviar.innerText = "💾 Salvando no Banco...";

        // Caminho: questoes / NOME_DA_PROVA / ID_DA_QUESTAO
        const caminhoFinal = `questoes/${chaveProva}/${chaveQuestao}`;
        const novaQuestaoRef = ref(db, caminhoFinal);

        await set(novaQuestaoRef, payloadParaSalvar);

        console.log("Sucesso! Salvo em:", caminhoFinal);
        console.log("Payload Final:", payloadParaSalvar);

        window.resetarParaProximaQuestao();

    } catch (error) {
        console.error("Erro fatal no envio:", error);
        customAlert("❌ Falha no envio: " + error.message);
        if (btnEnviar) {
            btnEnviar.disabled = false;
            btnEnviar.innerText = "Tentar Novamente";
        }
    }
};

/**
 * Limpa os dados da questão atual para permitir processar a próxima
 * SEM fechar o PDF e SEM recarregar a página.
 */
window.resetarParaProximaQuestao = function () {
    // 1. Remove o Modal Final
    const finalModal = document.getElementById('finalModal');
    if (finalModal) finalModal.remove();

    // 2. Limpa variáveis de dados da questão (Memória)
    window.__ultimaQuestaoExtraida = null;
    window.__ultimoGabaritoExtraido = null;
    window.questaoAtual = {};
    window.__isProcessing = false;
    window.__capturandoImagemFinal = false;
    // LIMPEZA DOS NOVOS BACKUPS
    window.__BACKUP_IMGS_Q = null;
    window.__BACKUP_IMGS_G = null;
    window.__BACKUP_IMG_Q = null; // Limpa legado por segurança
    window.__BACKUP_IMG_G = null; // Limpa legado por segurança

    // 3. Limpa listas de imagens (Memória)
    window.__recortesAcumulados = [];
    window.__imagensLimpas = {
        questao_original: [],
        questao_suporte: [],
        gabarito_original: [],
        gabarito_suporte: []
    };

    // 4. Limpa a UI da Sidebar (Onde ficava o texto extraído)
    const resultContainer = document.getElementById('extractionResult');
    if (resultContainer) resultContainer.remove();

    // Opcional: Recolhe a sidebar para limpar a visão ou deixa aberta vazia
    window.esconderPainel?.(); // Descomente se preferir que a sidebar feche

    // 5. Garante que qualquer recorte pendente seja cancelado
    if (typeof window.cancelarRecorte === 'function') {
        window.cancelarRecorte();
    }

    // 6. Feedback para o usuário
    customAlert("✅ Salvo! Pronto para a próxima questão.", 3000);

    // Opcional: Voltar para a visualização da Prova automaticamente se estiver no Gabarito
    if (window.__modo === 'gabarito') {
        window.trocarModo('prova');
    }
};

// ============================================================================
// MODO BANCO DE QUESTÕES (V4.0 - ESTILO TÉCNICO)
// ============================================================================

// Variáveis de controle
let ultimoKeyCarregada = null;
let observadorScroll = null;
let carregandoMais = false;
let todasQuestoesCache = []; // Cache local para filtros rápidos
const TAMANHO_PAGINA = 20;

// Import functions do Firebase
import { query, orderByKey, limitToLast, endBefore } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

/**
 * 1. TELA INICIAL
 */
window.gerarTelaInicial = function () {
    document.body.innerHTML = '';
    document.getElementById("pdfViewerContainer")?.remove();
    ultimoKeyCarregada = null;
    todasQuestoesCache = [];

    const html = `
    <div class="container fade-in" style="max-width: 900px; margin-top: 10vh; text-align: center;">
        <div id="brandHeader" style="justify-content: center; margin-bottom: 40px;">
            <img src="logo.png" alt="Logo Maia" id="brandLogo" style="width: 80px;">
            <span id="brandName" style="font-size: 4rem;">Maia<strong style="color:var(--color-primary)">.edu</strong></span>
        </div>

        <h1 style="margin-bottom: 40px;">O que vamos fazer hoje?</h1>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px;">
            <div class="card card-hover" onclick="iniciarModoEstudante()" style="cursor: pointer; padding: 40px; transition: transform 0.2s; border: 1px solid var(--color-border);">
                <div style="font-size: 50px; margin-bottom: 20px;">📚</div>
                <h2 style="color: var(--color-primary); margin-bottom: 15px;">Banco de Questões</h2>
                <p style="color: var(--color-text-secondary);">
                    Acesse o repertório completo com filtros por banca, matéria e assunto.
                </p>
                <button class="btn btn--primary btn--full-width" style="margin-top: 20px;">Acessar Banco</button>
            </div>

            <div class="card card-hover" onclick="iniciarFluxoExtracao()" style="cursor: pointer; padding: 40px; transition: transform 0.2s; border: 1px solid var(--color-border);">
                <div style="font-size: 50px; margin-bottom: 20px;">🛠️</div>
                <h2 style="color: var(--color-warning); margin-bottom: 15px;">Extrair do PDF</h2>
                <p style="color: var(--color-text-secondary);">
                    Painel administrativo para extrair questões de PDFs e alimentar o banco.
                </p>
                <button class="btn btn--secondary btn--full-width" style="margin-top: 20px;">Abrir Extrator</button>
            </div>
        </div>
    </div>
    `;
    document.body.innerHTML = html;
};

/**
 * Função intermediária que abre o PopUp de API Key
 * e só inicia o Extrator depois que o usuário confirma.
 */
window.iniciarFluxoExtracao = function () {
    generatePDFUploadInterface();
    generateAPIKeyPopUp();
};

window.iniciarModoEstudante = async function () {
    document.body.innerHTML = '';

    const html = `
    <div class="bank-layout">
        
        <div class="filters-panel">
            <div class="filters-header">
                <span style="font-size:1.2em;">🌪️</span> Filtros Avançados
                <div style="margin-left:auto; display:flex; gap:10px;">
                    <button class="btn btn--sm btn--outline" onclick="limparFiltros()">Limpar</button>
                    <button class="btn btn--sm btn--outline" onclick="gerarTelaInicial()">← Voltar</button>
                </div>
            </div>
            
            <div class="filters-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div class="filter-group">
                    <label class="filter-label">Disciplina</label>
                    <select id="filtroMateria" class="filter-control"><option value="">Todas</option></select>
                </div>

                <div class="filter-group">
                    <label class="filter-label">Instituição / Banca</label>
                    <select id="filtroInstituicao" class="filter-control"><option value="">Todas</option></select>
                </div>

                <div class="filter-group">
                    <label class="filter-label">Material / Prova</label>
                    <select id="filtroMaterial" class="filter-control"><option value="">Todos</option></select>
                </div>

                <div class="filter-group">
                    <label class="filter-label">Ano</label>
                    <select id="filtroAno" class="filter-control"><option value="">Todos</option></select>
                </div>

                <div class="filter-group">
                    <label class="filter-label">Características (Complexidade)</label>
                    <select id="filtroFator" class="filter-control"><option value="">Qualquer</option></select>
                </div>

                <div class="filter-group">
                    <label class="filter-label">Imagens</label>
                    <select id="filtroImagemPresence" class="filter-control">
                        <option value="">Indiferente</option>
                        <option value="com_imagem_enunciado">Com Imagem (Enunciado)</option>
                        <option value="sem_imagem_enunciado">Apenas Texto</option>
                        <option value="com_imagem_gabarito">Com Imagem (Resolução)</option>
                    </select>
                </div>

                <div class="filter-group">
                    <label class="filter-label">Origem da Resolução</label>
                    <select id="filtroOrigemRes" class="filter-control">
                        <option value="">Todas</option>
                        <option value="extraido_do_material">Oficial / Extraído</option>
                        <option value="gerado_pela_ia">Gerado por IA</option>
                    </select>
                </div>

                <div class="filter-group">
                    <label class="filter-label">Palavra-chave / Assunto</label>
                    <select id="filtroAssunto" class="filter-control"><option value="">Todos</option></select>
                </div>

                <div class="filter-group" style="grid-column: 1 / -1;">
                    <label class="filter-label">Busca no Texto (Enunciado ou ID)</label>
                    <input type="text" id="filtroTexto" class="filter-control" placeholder="Digite termos, ID ou trechos do enunciado...">
                </div>

                <button class="filter-search-btn" style="grid-column: 1 / -1;" onclick="aplicarFiltrosBanco()">🔎 Filtrar Questões</button>
            </div>
        </div>

        <div id="bankStream" class="bank-stream"></div>

        <div id="sentinelaScroll" style="padding: 40px; text-align:center;">
            <div class="spinner" style="margin: 0 auto;"></div>
            <p style="color:var(--color-text-secondary); font-size:12px; margin-top:10px;">Carregando banco de dados...</p>
        </div>

    </div>
    
    <div id="modalScanOriginal" class="final-modal-overlay" style="display:none; z-index:99999;" onclick="this.style.display='none'">
        <div class="final-modal-content" style="max-width:900px; height:90vh; padding:0; background:transparent; border:none; box-shadow:none; display:flex; justify-content:center; align-items:center;" onclick="event.stopPropagation()">
             <div style="background:var(--color-surface); padding:20px; border-radius:8px; max-height:100%; width:100%; display:flex; flex-direction:column; box-shadow:0 10px 50px rgba(0,0,0,0.8);">
                <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px solid var(--color-border); padding-bottom:10px;">
                    <h3 style="margin:0; color:var(--color-text);">Scan Original</h3>
                    <button onclick="document.getElementById('modalScanOriginal').style.display='none'" style="border:none; background:transparent; font-size:16px; cursor:pointer; color:var(--color-text);">✕</button>
                </div>
                <div id="modalScanContent" style="overflow-y:auto; flex:1; text-align:center; padding:10px; background:#000;"></div>
             </div>
        </div>
    </div>
    `;

    document.body.innerHTML = html;

    await carregarBancoDados();

    // Observer scroll
    const sentinela = document.getElementById('sentinelaScroll');
    observadorScroll = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) carregarBancoDados();
    }, { rootMargin: '300px' });

    if (sentinela) observadorScroll.observe(sentinela);
};

window.limparFiltros = function () {
    document.querySelectorAll('.filter-control').forEach(el => el.value = "");
    window.aplicarFiltrosBanco();
};

window.aplicarFiltrosBanco = function () {
    // 1. Captura valores
    const fMateria = document.getElementById('filtroMateria').value.toLowerCase();
    const fInst = document.getElementById('filtroInstituicao').value.toLowerCase();
    const fMaterial = document.getElementById('filtroMaterial').value.toLowerCase();
    const fAno = document.getElementById('filtroAno').value.toLowerCase();
    const fFator = document.getElementById('filtroFator').value; // key crua (ex: texto_extenso)
    const fImagem = document.getElementById('filtroImagemPresence').value;
    const fOrigem = document.getElementById('filtroOrigemRes').value;
    const fAssunto = document.getElementById('filtroAssunto').value.toLowerCase();
    const fTexto = document.getElementById('filtroTexto').value.toLowerCase();

    let visiveis = 0;

    // 2. Itera sobre o cache de dados para decidir quem aparece
    todasQuestoesCache.forEach(item => {
        const key = item.key;
        const q = item.dados_questao || {};
        const g = item.dados_gabarito || {};
        const cred = g.creditos || {};
        const meta = item.meta || {};

        // --- LOGICA DE FILTRO ---
        let show = true;

        // Texto (Enunciado ou ID)
        if (fTexto) {
            const blob = (q.enunciado + " " + q.identificacao).toLowerCase();
            if (!blob.includes(fTexto)) show = false;
        }

        // Matéria (Array)
        if (show && fMateria) {
            const mats = (q.materias_possiveis || []).map(m => m.toLowerCase());
            if (!mats.some(m => m.includes(fMateria))) show = false;
        }

        // Instituição
        if (show && fInst) {
            const inst = (cred.autorouinstituicao || cred.autor_ou_instituicao || "").toLowerCase();
            if (!inst.includes(fInst)) show = false;
        }

        // Material Específico
        if (show && fMaterial) {
            const mat = (cred.material || meta.material_origem || "").toLowerCase();
            if (!mat.includes(fMaterial)) show = false;
        }

        // Ano
        if (show && fAno) {
            const ano = (cred.ano || cred.year || "").toString().toLowerCase();
            if (!ano.includes(fAno)) show = false;
        }

        // Fator de Complexidade
        if (show && fFator) {
            const fatores = g.analise_complexidade?.fatores || {};
            // Verifica camelCase ou snake_case
            const val = fatores[fFator] || fatores[fFator.replace(/_([a-z])/g, (_, x) => x.toUpperCase())];
            if (val !== true) show = false;
        }

        // Origem da Resolução
        if (show && fOrigem) {
            let origem = (cred.origemresolucao || cred.origem_resolucao || "").toLowerCase().replace(/_/g, "");
            let filtro = fOrigem.toLowerCase().replace(/_/g, "");
            if (!origem.includes(filtro)) show = false;
        }

        // Assunto
        if (show && fAssunto) {
            const tags = (q.palavras_chave || []).map(t => t.toLowerCase());
            if (!tags.some(t => t.includes(fAssunto))) show = false;
        }

        // Imagens (LÓGICA ATUALIZADA)
        if (show && fImagem) {
            // Verifica na questão: flag antiga OU estrutura com imagem OU array de urls
            const temImgEnunciado = !!q.possui_imagem ||
                (q.estrutura && q.estrutura.some(b => b.tipo === 'imagem')) ||
                (q.imagens_urls && q.imagens_urls.length > 0);

            // Verifica no gabarito: verifica se tem suporte OU se algum passo tem imagem na estrutura
            const temImgGabarito = (g.imagens_suporte && g.imagens_suporte.length > 0) ||
                (g.imagens_gabarito_original && g.imagens_gabarito_original.length > 0) ||
                (g.explicacao && g.explicacao.some(p => p.estrutura && p.estrutura.some(b => b.tipo === 'imagem')));

            if (fImagem === 'com_imagem_enunciado' && !temImgEnunciado) show = false;
            if (fImagem === 'sem_imagem_enunciado' && temImgEnunciado) show = false;
            if (fImagem === 'com_imagem_gabarito' && !temImgGabarito) show = false;
        }

        // --- APLICA VISIBILIDADE NO DOM ---
        const cardEl = document.getElementById(`card_${key}`);
        if (cardEl) {
            cardEl.style.display = show ? 'block' : 'none';
            if (show) visiveis++;
        }
    });

    // Feedback visual
    const s = document.getElementById('sentinelaScroll');
    if (s) {
        if (visiveis === 0) {
            s.innerHTML = `<p style="color:var(--color-warning);">Nenhuma questão encontrada com esses filtros.</p>`;
        } else {
            s.innerHTML = `<p style="color:var(--color-primary);">${visiveis} questões visíveis (carregue mais rolando para baixo).</p>`;
        }
    }
};

/**
 * Carrega dados do Firebase e popula a interface (CORRIGIDO PARA JSON NOVO)
 */
async function carregarBancoDados() {
    if (carregandoMais) return;
    carregandoMais = true;

    try {
        // --- CORREÇÃO: Garante que as libs de renderização estejam prontas ANTES de tudo ---
        if (window.ensureLibsLoaded) {
            await window.ensureLibsLoaded();
        }

        const dbRef = ref(db, 'questoes');
        let consulta;

        // Paginação por Prova (limitToLast pega as últimas X provas adicionadas)
        if (!ultimoKeyCarregada) {
            consulta = query(dbRef, orderByKey(), limitToLast(TAMANHO_PAGINA));
        } else {
            consulta = query(dbRef, orderByKey(), endBefore(ultimoKeyCarregada), limitToLast(TAMANHO_PAGINA));
        }

        const snapshot = await get(consulta);

        if (snapshot.exists()) {
            const data = snapshot.val();
            // Firebase retorna objeto { "ProvaA": {...}, "ProvaB": {...} }
            // Invertemos para mostrar as mais recentes primeiro
            const listaProvas = Object.entries(data).reverse();

            // Atualiza cursor para paginação
            ultimoKeyCarregada = listaProvas[listaProvas.length - 1][0];

            const container = document.getElementById('bankStream');

            // --- LOOP CORRIGIDO: Prova -> Questão -> Render ---
            listaProvas.forEach(([nomeProva, mapQuestoes]) => {

                if (mapQuestoes && typeof mapQuestoes === 'object') {
                    // mapQuestoes = { "Q1": {dados...}, "Q2": {dados...} }
                    Object.entries(mapQuestoes).forEach(([idQuestao, fullData]) => {

                        // Garante que fullData tenha os objetos internos
                        if (!fullData.dados_questao) return;

                        // Injeta o nome da prova no meta para exibição
                        if (!fullData.meta) fullData.meta = {};
                        if (!fullData.meta.material_origem) {
                            fullData.meta.material_origem = nomeProva.replace(/_/g, " ");
                        }

                        // Adiciona ao cache local
                        todasQuestoesCache.push({ key: idQuestao, ...fullData });

                        // Renderiza o card passando o ID e o objeto COMPLETO (que tem dados_questao e dados_gabarito)
                        const card = criarCardTecnico(idQuestao, fullData);
                        container.appendChild(card);

                        // Renderiza LaTeX
                        if (window.renderLatexIn) window.renderLatexIn(card);
                    });
                }
            });
            // --------------------------------------------------

            popularFiltrosDinamicos();

        } else {
            const s = document.getElementById('sentinelaScroll');
            if (s) s.innerHTML = '<p style="color:var(--color-text-secondary);">Fim do banco de questões.</p>';
            if (observadorScroll) observadorScroll.disconnect();
        }
    } catch (e) {
        console.error("Erro ao carregar banco:", e);
        const s = document.getElementById('sentinelaScroll');
        if (s) s.innerHTML = `<p style="color:var(--color-error);">Erro: ${e.message}</p>`;
    } finally {
        carregandoMais = false;
    }
}

function popularFiltrosDinamicos() {
    const sets = {
        materias: new Set(),
        instituicoes: new Set(),
        materiais: new Set(),
        anos: new Set(),
        assuntos: new Set(),
        fatores: new Set()
    };

    todasQuestoesCache.forEach(item => {
        const q = item.dados_questao || {};
        const g = item.dados_gabarito || {};
        const cred = g.creditos || {};
        const meta = item.meta || {};

        // Matérias
        if (q.materias_possiveis) q.materias_possiveis.forEach(m => sets.materias.add(m));

        // Assuntos
        if (q.palavras_chave) q.palavras_chave.forEach(p => sets.assuntos.add(p));

        // Instituição (Banca/Autor)
        const inst = cred.autorouinstituicao || cred.autor_ou_instituicao;
        if (inst) sets.instituicoes.add(inst);

        // Material Específico (Prova)
        // Tenta pegar dos créditos, senão vai no meta
        const mat = cred.material || meta.material_origem;
        if (mat) sets.materiais.add(mat);

        // Ano
        const ano = cred.ano || cred.year;
        if (ano) sets.anos.add(ano);

        // Fatores de Complexidade (extrai as keys que são true)
        const fatoresObj = g.analise_complexidade?.fatores || {};
        Object.entries(fatoresObj).forEach(([key, val]) => {
            if (val === true) {
                // Formata "texto_extenso" para "Texto Extenso"
                const label = key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
                sets.fatores.add(JSON.stringify({ key, label })); // Guarda obj stringificado para usar key e label
            }
        });
    });

    const preencher = (id, set, isObj = false) => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const valorAtual = sel.value;
        const placeholder = sel.options[0].text;
        sel.innerHTML = `<option value="">${placeholder}</option>`;

        // Ordena e cria options
        const arrayOrdenado = Array.from(set).sort();

        arrayOrdenado.forEach(val => {
            let value, label;
            if (isObj) {
                const o = JSON.parse(val);
                value = o.key;
                label = o.label;
            } else {
                value = val;
                label = val;
            }
            const opt = document.createElement('option');
            opt.value = value;
            opt.innerText = label;
            sel.appendChild(opt);
        });
        sel.value = valorAtual;
    };

    preencher('filtroMateria', sets.materias);
    preencher('filtroInstituicao', sets.instituicoes);
    preencher('filtroMaterial', sets.materiais);
    preencher('filtroAno', sets.anos);
    preencher('filtroAssunto', sets.assuntos);
    preencher('filtroFator', sets.fatores, true);
}

// Filtra visualmente os cards já carregados
window.aplicarFiltrosBanco = function () {
    const materia = document.getElementById('filtroMateria').value.toLowerCase();
    const inst = document.getElementById('filtroInstituicao').value.toLowerCase();
    const assunto = document.getElementById('filtroAssunto').value.toLowerCase();
    const texto = document.getElementById('filtroTexto').value.toLowerCase();

    const cards = document.querySelectorAll('.q-card');
    let count = 0;

    cards.forEach(card => {
        // Pega os dados que armazenamos nos datasets do card
        const dMateria = (card.dataset.materia || "").toLowerCase();
        const dOrigem = (card.dataset.origem || "").toLowerCase();
        const dTags = (card.dataset.tags || "").toLowerCase();
        const dTexto = (card.dataset.texto || "").toLowerCase();

        let show = true;

        if (materia && !dMateria.includes(materia)) show = false;
        if (inst && !dOrigem.includes(inst)) show = false;
        if (assunto && !dTags.includes(assunto)) show = false;
        if (texto && !dTexto.includes(texto)) show = false;

        card.style.display = show ? 'block' : 'none';
        if (show) count++;
    });

    // Feedback
    const s = document.getElementById('sentinelaScroll');
    if (s) s.innerHTML = `<p style="color:var(--color-primary);">${count} questões encontradas neste lote.</p>`;
};

function criarCardTecnico(idFirebase, fullData) {
    const q = fullData.dados_questao || {};
    const g = fullData.dados_gabarito || {};
    const meta = fullData.meta || {};

    // --- 1. RECUPERAÇÃO DAS IMAGENS ORIGINAIS (SCAN) ---
    // Tenta pegar o array novo (fotos_originais). Se não tiver, tenta o antigo (foto_original) e converte pra array.

    let imgsOriginalQ = [];
    if (q.fotos_originais && Array.isArray(q.fotos_originais)) {
        imgsOriginalQ = q.fotos_originais;
    } else if (q.foto_original) {
        imgsOriginalQ = [q.foto_original];
    }
    // Serializa para o botão ver scan
    const jsonImgsQ = JSON.stringify(imgsOriginalQ).replace(/"/g, '&quot;');

    let imgsOriginalG = [];
    if (g.fotos_originais && Array.isArray(g.fotos_originais)) {
        imgsOriginalG = g.fotos_originais;
    } else if (g.foto_original) {
        imgsOriginalG = [g.foto_original];
    }
    const jsonImgsG = JSON.stringify(imgsOriginalG).replace(/"/g, '&quot;');

    // Imagens de Suporte
    const imgsSuporte = [...(fullData.imagens_agrupadas?.questao_suporte || q.imagens_suporte_urls || [])];
    const htmlImgsSuporte = imgsSuporte.map(url => `<img src="${url}" class="q-support-img">`).join('');

    // --- 2. RENDERIZAÇÃO DO CORPO (ESTRUTURA) ---
    let htmlCorpoQuestao = "";

    if (q.estrutura && Array.isArray(q.estrutura)) {
        // MUDANÇA: Passamos 'banco' como contexto para remover botões de edição
        // Passamos imgsOriginalQ apenas como fallback, pois a prioridade agora é a URL dentro do bloco
        htmlCorpoQuestao = window.renderizarEstruturaHTML(q.estrutura, imgsOriginalQ, 'banco');
    } else {
        // Fallback legado
        htmlCorpoQuestao = `<div class="structure-text">${(q.enunciado || "").replace(/\n/g, '<br>')}</div>`;
        if (imgsOriginalQ.length > 0) {
            htmlCorpoQuestao = imgsOriginalQ.map(url => `<img src="${url}" class="structure-img" style="margin-bottom:10px;">`).join('') + htmlCorpoQuestao;
        }
    }

    if (htmlImgsSuporte) {
        htmlCorpoQuestao += `<div style="margin-top:15px; border-top:1px dashed var(--color-border); padding-top:10px;"><small style="color:gray;">Figuras de Suporte:</small>${htmlImgsSuporte}</div>`;
    }

    // --- 3. RENDERIZADORES AUXILIARES ---

    // ... (renderMatrizComplexidade mantém igual ao seu código anterior) ...
    const renderMatrizComplexidade = () => {
        if (!g.analise_complexidade?.fatores) return '';
        const labels = {
            texto_extenso: "Texto Extenso", vocabulario_complexo: "Vocabulário Denso", multiplas_fontes_leitura: "Múltiplas Fontes",
            interpretacao_visual: "Interp. Visual", dependencia_conteudo_externo: "Conteúdo Prévio", interdisciplinaridade: "Interdisciplinar",
            contexto_abstrato: "Abstrato", raciocinio_contra_intuitivo: "Contra-Intuitivo", abstracao_teorica: "Teoria Pura",
            deducao_logica: "Dedução Lógica", resolucao_multiplas_etapas: "Multi-etapas", transformacao_informacao: "Transformação Info",
            distratores_semanticos: "Distratores Fortes", analise_nuance_julgamento: "Julgamento Sutil"
        };
        const fatores = g.analise_complexidade.fatores;
        let htmlGrid = '<div class="complexity-matrix">';
        for (const [key, label] of Object.entries(labels)) {
            const isActive = !!(fatores[key] || fatores[key.replace(/_([a-z])/g, (_, x) => x.toUpperCase())]);
            htmlGrid += `<div class="comp-factor ${isActive ? 'active' : ''}"><div class="comp-dot"></div><span>${label}</span></div>`;
        }
        htmlGrid += '</div>';
        if (g.analise_complexidade.justificativa_dificuldade) {
            // Usa safe() se disponível no escopo ou implementa replace simples, mas adiciona a classe markdown-content
            const safeJust = String(g.analise_complexidade.justificativa_dificuldade).replace(/"/g, "&quot;");
            htmlGrid += `<div class="markdown-content" data-raw="${safeJust}" style="margin-top:10px; font-style:italic; font-size:0.85rem; color:var(--color-text-secondary);">${g.analise_complexidade.justificativa_dificuldade}</div>`;
        }
        return `<div class="q-res-section"><span class="q-res-label">Matriz de Dificuldade</span>${htmlGrid}</div>`;
    };

    const renderBotaoScanGabarito = () => {
        if (!imgsOriginalG || imgsOriginalG.length === 0) return '';
        return `<button class="btn-view-scan" onclick="abrirScanOriginal(this)" data-imgs="${jsonImgsG}">📸 Ver Scan Original do Gabarito</button>`;
    };

    const renderPassosComDetalhes = () => {
        if (!g.explicacao || g.explicacao.length === 0) return '';
        return `
        <div class="q-res-section">
            <span class="q-res-label">Resolução Detalhada</span>
            <div style="display:flex; flex-direction:column; gap:0;">
                ${g.explicacao.map((p, i) => {
            const origemLabel = (p.origem || "").includes('extraido') ? '📄 Material Original' : '🤖 Gerado por IA';
            const origemCor = (p.origem || "").includes('extraido') ? 'var(--color-success)' : 'var(--color-primary)';
            const estrutura = Array.isArray(p.estrutura) ? p.estrutura : [{ tipo: 'texto', conteudo: p.passo || "" }];

            // MUDANÇA: Contexto 'banco' para renderização limpa
            const htmlConteudo = window.renderizarEstruturaHTML(estrutura, [], 'banco');

            return `
                    <div class="q-step-wrapper">
                        <div class="q-step-header">
                            <div class="q-step-bullet">${i + 1}</div>
                            <div class="step-content-wrapper" style="flex:1; min-width:0;">${htmlConteudo}</div>
                        </div>
                        <details class="q-step-details">
                            <summary>Metadados</summary>
                            <div class="q-step-meta-box">
                                <div class="q-step-row"><span class="q-step-key">Origem:</span><span style="color:${origemCor}; font-weight:bold;">${origemLabel}</span></div>
                                ${p.fontematerial ? `<div class="q-step-row"><span class="q-step-key">Fonte:</span><span>${p.fontematerial}</span></div>` : ''}
                            </div>
                        </details>
                    </div>`;
        }).join('')}
            </div>
        </div>`;
    };

    const renderCreditosCompleto = () => {
        if (!g.creditos) return '';
        const c = g.creditos;
        return `
            <div class="q-res-section">
                <span class="q-res-label">Metadados & Créditos</span>
                <table class="credits-table">
                    <tr><td>Instituição</td><td>${c.autorouinstituicao || "—"}</td></tr>
                    <tr><td>Material</td><td>${c.material || "—"}</td></tr>
                    <tr><td>Ano</td><td>${c.ano || "—"}</td></tr>
                    <tr><td>Confiança</td><td>${c.confiancaidentificacao ? Math.round(c.confiancaidentificacao * 100) + '%' : "—"}</td></tr>
                </table>
            </div>`;
    };

    // --- 4. MONTAGEM ---
    const card = document.createElement('div');
    card.className = 'q-card';
    card.id = `card_${idFirebase}`;

    // Filtros
    card.dataset.materia = (q.materias_possiveis || []).join(" ");
    card.dataset.origem = meta.material_origem || "";
    const textoBusca = q.estrutura ? q.estrutura.map(b => b.conteudo).join(" ") : (q.enunciado || "");
    card.dataset.texto = (textoBusca + " " + (q.identificacao || "")).toLowerCase();

    const cardId = `q_${idFirebase}`;

    const htmlAlts = (q.alternativas || []).map(alt => {
        const letra = alt.letra.trim().toUpperCase();
        let conteudoHtml = "";

        if (alt.estrutura) {
            // MUDANÇA: Passa 'banco' como contexto para desabilitar edição
            conteudoHtml = window.renderizar_estrutura_alternativa(alt.estrutura, letra, [], 'banco');
        } else {
            conteudoHtml = alt.texto || "";
        }

        return `
        <button class="q-opt-btn" onclick="verificarRespostaBanco(this, '${cardId}', '${letra}', '${g.alternativa_correta}')">
            <span class="q-opt-letter">${letra})</span>
            <div class="q-opt-content">${conteudoHtml}</div>
        </button>`;
    }).join('');

    card.innerHTML = `
       <div class="q-header">
            <div style="display:flex; align-items:center; gap:10px;">
                <span class="q-id-badge">${idFirebase}</span>
                <span style="font-weight:bold; color:var(--color-text); font-size:0.9rem;">${meta.material_origem || "Banco"}</span>
            </div>
        </div>

        <div class="q-tags">
            ${(q.materias_possiveis || []).map(m => `<span class="q-tag highlight">${m}</span>`).join('')}
            ${(q.palavras_chave || []).map(t => `<span class="q-tag">${t}</span>`).join('')}
        </div>

        <div class="q-body">${htmlCorpoQuestao}</div>
        <div class="q-options" id="${cardId}_opts">${htmlAlts}</div>

        <div id="${cardId}_res" class="q-resolution" style="display:none;">
            <div class="q-res-header">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="q-res-badge">Gabarito: ${g.alternativa_correta}</span>
                    <span style="font-size:0.8rem; color:var(--color-text-secondary);">Confiança IA: ${Math.round((g.confianca || 0) * 100)}%</span>
                </div>
            </div>
            <div class="q-res-section">
                <span class="q-res-label">Justificativa</span>
                <p class="markdown-content" style="margin:0; line-height:1.5;">${g.justificativa_curta || "Sem justificativa."}</p>
            </div>
            ${renderPassosComDetalhes()}
            ${renderMatrizComplexidade()}
            ${renderBotaoScanGabarito()}
            ${renderCreditosCompleto()}
        </div>

        <div class="q-footer">
            ${imgsOriginalQ.length > 0 ? `
                <button class="q-action-link" onclick="abrirScanOriginal(this)" data-imgs="${jsonImgsQ}">📄 Ver Original (Enunciado)</button>
            ` : ''}
            <button onclick="window.toggleGabarito('${cardId}')" title="Ver/Esconder Gabarito" class="q-action-link">👁️ Ver/Esconder Gabarito</button>
        </div>
    `;

    return card;
}

window.toggleGabarito = function (cardId) {
    const el = document.getElementById(cardId + '_res');
    if (!el) return;

    // Alterna entre mostrar e esconder
    if (el.style.display === 'none') {
        el.style.display = 'block';
        // Opcional: faz scroll suave até a resolução
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
        el.style.display = 'none';
    }
};

// Interação de Resposta
window.verificarRespostaBanco = function (btn, cardId, letraEscolhida, letraCorreta) {
    const container = document.getElementById(cardId + '_opts');
    const resolution = document.getElementById(cardId + '_res');

    if (container.classList.contains('answered')) return;
    container.classList.add('answered');

    const todosBotoes = container.querySelectorAll('.q-opt-btn');
    letraCorreta = letraCorreta.trim().toUpperCase();
    letraEscolhida = letraEscolhida.trim().toUpperCase();

    todosBotoes.forEach(b => {
        const letra = b.querySelector('.q-opt-letter').innerText.replace(')', '').trim();

        if (letra === letraCorreta) {
            b.classList.add('correct');
        }
        if (letra === letraEscolhida && letra !== letraCorreta) {
            b.classList.add('wrong');
        }
        b.style.cursor = 'default';
    });

    // Delay e Revelação
    setTimeout(() => {
        resolution.style.display = 'block';
        resolution.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 800);
};

// Abrir Scan Original
window.abrirScanOriginal = function (btn) {
    const jsonImgs = btn.dataset.imgs;
    if (!jsonImgs) return;

    try {
        const imgs = JSON.parse(jsonImgs);
        const content = document.getElementById('modalScanContent');
        const modal = document.getElementById('modalScanOriginal');

        content.innerHTML = imgs.map(url => `
            <img src="${url}" style="max-width:100%; margin-bottom:20px; border-radius:4px; border:1px solid #333;">
        `).join('');

        modal.style.display = 'flex';
    } catch (e) {
        console.error("Erro ao abrir imagens originais", e);
    }
};

window.generateAPIKeyPopUp = function () {
    // [NOVO] Se a chave da Vercel existir, ignora o popup e inicia o app direto
    try {
        if (import.meta.env && import.meta.env.VITE_GOOGLE_GENAI_API_KEY) {
            console.log("Chave de ambiente detectada. Ignorando popup.");
            if (typeof generatePDFUploadInterface === 'function') {
                generatePDFUploadInterface();
            }
            return; // Retorna e não renderiza nada
        }
    } catch (e) { }

    // -----------------------------------------------------------
    // 1. INJEÇÃO DO HTML
    // -----------------------------------------------------------
    document.body.innerHTML += `
    <div id="apiKeyModal" class="modal-overlay hidden">
        <div class="modal-content">
            <div class="modal-header">
                <div class="icon-wrapper">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                    </svg>
                </div>
                <h2>Configuração Necessária</h2>
            </div>

            <div class="modal-body">
                <p>Para utilizar o assistente, é necessária uma chave de API do Google Gemini. Ao inserir sua chave em nosso site, você está consciente dos possíveis riscos de vazamento dela. Para maior segurança, sugerimos que realize uma restrição nos domínios em que a chave de API pode ser utilizada.</p>

                <div class="info-box">
                    <p>Sua chave será salva apenas na memória do seu navegador.</p>
                    <a href="https://aistudio.google.com/api-keys" target="_blank" class="link-external">
                        Obter chave <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    </a>
                </div>

                <form id="apiKeyForm">
                    <div class="form-group">
                        <label for="apiKeyInput" class="form-label">Cole sua API Key aqui</label>
                        <div class="input-wrapper">
                            <input type="password" id="apiKeyInput" name="apiKey" class="form-control" placeholder="AIzaSy..." autocomplete="on">
                        </div>
                        <span id="apiError" class="error-message hidden"></span>
                    </div>

                    <div class="modal-footer">
                        <button type="submit" id="saveApiKeyBtn" class="btn btn--primary btn--full-width">
                            Verificar e Continuar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    `;

    // -----------------------------------------------------------
    // 2. LÓGICA DO SCRIPT
    // -----------------------------------------------------------

    const modal = document.getElementById('apiKeyModal');
    const input = document.getElementById('apiKeyInput');
    const saveBtn = document.getElementById('saveApiKeyBtn');
    const errorMsg = document.getElementById('apiError');
    const form = document.getElementById('apiKeyForm');

    // 1. Tenta pegar a chave do Session Storage
    let apiKey = sessionStorage.getItem("GOOGLE_GENAI_API_KEY");

    // 2. Verifica URL
    const urlParams = new URLSearchParams(window.location.search);
    const urlKey = urlParams.get('apiKey');

    if (urlKey) {
        apiKey = urlKey;
        sessionStorage.setItem("GOOGLE_GENAI_API_KEY", apiKey);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // --- NOVA FUNÇÃO DE VALIDAÇÃO REAL ---
    async function testarChaveReal(key) {
        try {
            // Chama o endpoint de listar modelos. É rápido, leve e não gasta token de geração.
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
                method: 'GET'
            });

            if (response.ok) {
                return { valido: true };
            } else {
                const err = await response.json();
                return { valido: false, msg: err.error?.message || "Chave inválida ou erro na API." };
            }
        } catch (e) {
            return { valido: false, msg: "Erro de conexão. Verifique sua internet." };
        }
    }

    async function saveKey() {
        const key = input.value.trim();

        // Validação básica local
        if (key.length < 10) {
            mostrarErro("A chave parece muito curta.");
            return;
        }

        // UX: Estado de Loading
        const btnOriginalText = saveBtn.innerText;
        saveBtn.innerText = "Verificando...";
        saveBtn.disabled = true;
        saveBtn.style.opacity = "0.7";
        saveBtn.style.cursor = "wait";
        input.disabled = true;
        errorMsg.classList.add('hidden');

        // Validação Real
        const resultado = await testarChaveReal(key);

        if (resultado.valido) {
            // SUCESSO
            sessionStorage.setItem("GOOGLE_GENAI_API_KEY", key);
            apiKey = key;
            modal.classList.add('hidden');

            // Inicia o app
            if (typeof generatePDFUploadInterface === 'function') {
                generatePDFUploadInterface();
            }
        } else {
            // ERRO
            var mensagem = resultado.msg;
            if (mensagem == "") mensagem = "Erro não encontrado";
            mostrarErro(`Essa chave não funcionou. Tente outra. (Erro: ${mensagem})`);

            // Reseta UI
            saveBtn.innerText = btnOriginalText;
            saveBtn.disabled = false;
            saveBtn.style.opacity = "1";
            saveBtn.style.cursor = "pointer";
            input.disabled = false;
            input.focus();
        }
    }

    function mostrarErro(msg) {
        errorMsg.innerText = msg;
        errorMsg.classList.remove('hidden');
        input.style.borderColor = 'var(--color-error)';
    }

    // Inicialização
    if (!apiKey || apiKey === "null") {
        if (modal) {
            modal.classList.remove('hidden');
            if (input) setTimeout(() => input.focus(), 100);
        }
    } else {
        if (modal) modal.classList.add('hidden');
        if (typeof generatePDFUploadInterface === 'function') {
            generatePDFUploadInterface();
        }
    }

    // Listeners
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            saveKey();
        });
    }

    if (input) {
        input.addEventListener('input', () => {
            errorMsg.classList.add('hidden');
            input.style.borderColor = '';
        });
    }
};

gerarTelaInicial();