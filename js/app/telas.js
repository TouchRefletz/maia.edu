import { ChatStorageService } from "../services/chat-storage.js";
import * as MemoryService from "../services/memory-service.js";
import { criarCardTecnico } from "../banco/card-template.js";
import { gerarHtmlPainelFiltros } from "../banco/filtros-ui.js";
import {
  carregarBancoDados,
  configurarObserverScroll,
} from "../banco/paginacao-e-carregamento.js";
import {
  runChatPipeline,
  generateSilentScaffoldingStep,
} from "../chat/index.js";
import { ScaffoldingService } from "../chat/services/scaffolding-service.js"; // Import ScaffoldingService
import { renderLatexIn } from "../libs/loader";
import { auth, bancoState, logoutUser, onAuthStateChanged } from "../main.js";
import { generateChatHtmlString } from "../render/ChatRender";
import { hydrateAllChatContent } from "../render/hydration.js";
import { findBestQuestion } from "../services/question-service.js";
import {
  getIsListening,
  startListening,
  stopListening,
} from "../services/speech-to-text.js";
import {
  construirSkeletonLoader,
  criarElementoCardPensamento,
  splitThought,
} from "../sidebar/thoughts-base.js";
import { customAlert } from "../ui/GlobalAlertsLogic";
import { openAddQuestionsModal } from "../ui/add-questions-modal.js";
import {
  setupChipClickHandlers,
  startSuggestionRotation,
  stopSuggestionRotation,
} from "../ui/dynamic-suggestions.js";
import { openLoginModal } from "../ui/login-modal.js";
import { showConfirmModal } from "../ui/modal-confirm.js";
import { gerarHtmlModalScanOriginal } from "../ui/scan-original-modal.js";
import { checkAndRestoreFloatingTerminal } from "../upload/search-logic.js";
import { mountApiKeyModal } from "../ui/ApiKeyModal.tsx";
import {
  getTheme,
  toggleTheme,
  updateThemeIcon,
} from "../services/theme-service.js";
import {
  initCustomChatScrollbar,
  destroyCustomChatScrollbar,
  updateChatScrollbar,
} from "../ui/custom-chat-scrollbar.js";

let activeGenerationController = null;
window.isAuthFirstResolved = false;

/**
 * Renderiza (ou re-renderiza) a interface inicial da aplicação
 * Limpa o body, reconstrói o HTML e liga os listeners locais
 */
function renderInitialUI() {
  document.body.innerHTML = "";
  document.getElementById("pdfViewerContainer")?.remove();
  bancoState.ultimoKeyCarregada = null;
  bancoState.todasQuestoesCache = [];

  const html = `
    <!-- Botão Hamburger -->
    <button class="hamburger-btn js-toggle-nav" aria-label="Abrir menu">☰</button>
    
    <!-- Overlay escuro -->
    <div class="nav-sidebar-overlay js-close-nav"></div>
    
    <!-- Sidebar Navigation -->
    <nav class="nav-sidebar">
      <!-- Close Button (Mobile) -->
      <button class="nav-sidebar-close-btn js-close-nav" aria-label="Fechar menu">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>

      <div class="nav-sidebar-header">
        <div class="nav-brand-group">
            <img src="logo.png" alt="Logo" class="nav-sidebar-logo">
            <span class="nav-sidebar-title">Maia<strong>.edu</strong></span>
        </div>
        <div id="navUserSection" class="nav-user-section">
            <!-- Injected via JS -->
            <button class="nav-header-key-btn js-config-api" title="Configurar Chave API">
                🔑
            </button>
        </div>
      </div>
      
      <div class="nav-sidebar-items">
        <button class="nav-sidebar-item nav-item--banco js-iniciar-estudante">
          <span class="nav-icon">📚</span>
          <span class="nav-label">
            <span class="nav-title">Banco de Questões</span>
            <span class="nav-desc">Acesse o repertório completo</span>
          </span>
        </button>
        
        <button class="nav-sidebar-item nav-item--search js-iniciar-busca">
          <span class="nav-icon">🔍</span>
          <span class="nav-label">
            <span class="nav-title">Pesquisar Provas</span>
            <span class="nav-desc">Busque e extraia da web</span>
          </span>
        </button>

        <button class="nav-sidebar-item nav-item--upload js-iniciar-upload">
          <span class="nav-icon">✨</span>
          <span class="nav-label">
            <span class="nav-title">Extrair exercícios</span>
            <span class="nav-desc">Através de IA em arquivos PDF</span>
          </span>
        </button>
        
        <button class="nav-sidebar-item nav-item--revisao js-iniciar-revisao">
          <span class="nav-icon">📝</span>
          <span class="nav-label">
            <span class="nav-title">Revisar Questões</span>
            <span class="nav-desc">Valide e corrija dados</span>
          </span>
        </button>
        
        <div class="nav-divider" style="height: 1px; background: var(--color-border); margin: 10px 0;"></div>
        <div class="nav-section-title" style="padding: 0 16px; font-size: 0.75rem; color: var(--color-text-secondary); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Histórico</div>
        <div id="navChatList" class="nav-chat-list" style="display:flex; flex-direction:column; gap:4px; overflow-y:auto;"></div>
      </div>
      
      <!-- Footer removido pois botão foi para o header -->
    </nav>

    <!-- Conteúdo Principal (Centralizado) -->
    <!-- Conteúdo Principal (Centralizado) - Modo Maia.ai -->
    <div class="maia-ai-container fade-in">
        <div id="brandHeader" style="justify-content: center; margin-bottom: 40px;">
            <img src="logo.png" alt="Logo Maia" id="brandLogo" style="width: 80px;">
            <span id="brandName" style="font-size: 4rem;">Maia<strong style="color:var(--color-primary)">.ai</strong></span>
        </div>



        <div class="chat-input-wrapper" id="chatInputWrapper">
            <!-- Input de arquivo oculto - Suporta formatos do Gemini -->
            <input type="file" id="chatFileInput" multiple 
                   accept=".pdf,.doc,.docx,.txt,.html,.css,.js,.json,.xml,.csv,.md,.py,.java,.cpp,.c,.php,.rb,.go,.rs,.ts,.tsx,.jsx,.sql,.sh,.yaml,.yml,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.mp3,.wav,.ogg,.aac,.flac,.mp4,.webm,.mov,.avi,.mkv" 
                   style="display:none">
            
            <!-- Container de arquivos anexados -->
            <div class="chat-attachments" id="chatAttachments"></div>
            
            <textarea 
                class="chat-input-field" 
                placeholder="O que vamos estudar hoje?" 
                rows="1"
                oninput="this.style.height = ''; this.style.height = this.scrollHeight + 'px'"
            ></textarea>
            
            <!-- Separator Line -->
            <div class="chat-input-divider"></div>

            <!-- Toolbar de Opções e Enviar -->
            <div class="chat-input-actions">
                <div class="chat-options-left" style="display: flex; gap: 8px;">
                    <!-- Wrapper Botão Mais (+) -->
                    <div style="position: relative;">
                        <button class="action-btn btn-plus" id="chatPlusBtn" title="Adicionar...">
                             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </button>
                        
                        <!-- Drop-up Menu Mais -->
                        <div class="chat-action-menu" id="chatActionMenu">
                            <button class="model-menu-item" id="chatUploadFilesBtn" style="justify-content: flex-start; gap: 12px;">
                                <div style="min-width: 24px; display: flex; align-items: center; justify-content: center;">
                                  <!-- Uploaded to: SVG Repo, www.svgrepo.com -->
                                  <svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="-6.4 -6.4 76.80 76.80" fill="currentColor" stroke="currentColor" stroke-width="0.00064">
                                  <path fill="currentColor" d="M44,16c-0.553,0-1-0.447-1-1V0H7C4.789,0,3,1.789,3,4v56c0,2.211,1.789,4,4,4h48c2.211,0,4-1.789,4-4V16H44 z M14,18h16c0.553,0,1,0.447,1,1s-0.447,1-1,1H14c-0.553,0-1-0.447-1-1S13.447,18,14,18z M48,51H14c-0.553,0-1-0.447-1-1 s0.447-1,1-1h34c0.553,0,1,0.447,1,1S48.553,51,48,51z M48,45H14c-0.553,0-1-0.447-1-1s0.447-1,1-1h34c0.553,0,1,0.447,1,1 S48.553,45,48,45z M48,39H14c-0.553,0-1-0.447-1-1s0.447-1,1-1h34c0.553,0,1,0.447,1,1S48.553,39,48,39z M48,33H14 c-0.553,0-1-0.447-1-1s0.447-1,1-1h34c0.553,0,1,0.447,1,1S48.553,33,48,33z M48,27H14c-0.553,0-1-0.447-1-1s0.447-1,1-1h34 c0.553,0,1,0.447,1,1S48.553,27,48,27z"/>
                                  </svg>
                                </div>
                                <div class="model-item-content">
                                    <span class="model-item-title">Enviar Arquivos</span>
                                    <span class="model-item-desc">PDFs, imagens, áudio e mais</span>
                                </div>
                            </button>
                            
                            <button class="model-menu-item" id="chatAddQuestionsBtn" style="justify-content: flex-start; gap: 12px;">
                                <div style="min-width: 24px; display: flex; align-items: center; justify-content: center;">
                                  <!-- Uploaded to: SVG Repo, www.svgrepo.com -->
                                  <svg fill="currentColor" width="24px" height="24px" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" stroke="currentColor">
                                  <g><path d="M397.5765,258.8732,269.125,287.3982v183.75l134.0506-29.8367A13.0954,13.0954,0,0,0,413.5,428.5358V271.6478A13.0751,13.0751,0,0,0,397.5765,258.8732Zm-18.4634,141.75-70,15.5753c-16.7352,3.5675-22.5757-21.6251-5.6866-25.6369l70-15.5753C390.3091,371.5209,395.9274,396.6024,379.1131,400.6227Zm0-61.25-70,15.5753c-16.7352,3.5675-22.5757-21.6251-5.6866-25.6369l70-15.5753C390.3091,310.2709,395.9274,335.3524,379.1131,339.3727Z"/> <path d="M98.5,271.6478v156.888a13.0193,13.0193,0,0,0,10.239,12.7757l134.136,29.8367v-183.75l-128.4494-28.525A13.0427,13.0427,0,0,0,98.5,271.6478Zm39.9881,40.3385,70,15.5752a13.13,13.13,0,1,1-5.6866,25.6369l-70-15.5752C116.0214,333.6135,121.5692,308.52,138.4881,311.9863Zm0,61.25,70,15.5752a13.13,13.13,0,1,1-5.6866,25.6369l-70-15.5752C116.0214,394.8635,121.5692,369.77,138.4881,373.2363Z"/> <path d="M295.375,198.4114h-78.75C211.0644,262.2762,300.8758,262.3157,295.375,198.4114Z"/> <path d="M223.8006,172.1614H288.114l16.8869-23.9749a59.9765,59.9765,0,0,0-6.7377-76.65c-52.5556-50.1672-131.6495,16.2162-91.2619,76.65Z"/> <path d="M339.0823,176.9979c4.3088,2.01,15.4449,10.3991,20.4309,9.7786,13.0267.3108,18.1793-18.0822,6.571-24.4941l-13.8769-8.014C337.134,145.8773,324.2867,168.125,339.0823,176.9979Z"/> <path d="M159.7415,154.263l-13.8855,8.0152c-11.6126,6.4161-6.4515,24.8005,6.571,24.4983,5.0458.5928,16.06-7.7524,20.44-9.7744C187.662,168.1154,174.8254,145.9082,159.7415,154.263Z"/> <path d="M346.3967,113.8626a13.1256,13.1256,0,0,0,13.125,13.125h16.0218c17.2522-.2916,17.2479-25.9584,0-26.25H359.5217A13.1257,13.1257,0,0,0,346.3967,113.8626Z"/> <path d="M136.4053,126.9876H152.427c17.2522-.2916,17.2479-25.9584,0-26.25H136.4053a13.125,13.125,0,0,0,0,26.25Z"/> <path d="M345.6533,75.2182c5.0458.5907,16.0517-7.7566,20.4309-9.7786,14.802-8.876,1.94-31.1206-13.125-22.73l-13.8769,8.0151C327.4676,57.1361,332.633,75.5258,345.6533,75.2182Z"/> <path d="M145.856,65.4439c4.3087,2.01,15.4513,10.397,20.4394,9.7743,13.0289.3066,18.1793-18.0842,6.5711-24.4983l-13.8855-8.014C143.8928,34.34,131.0668,56.5647,145.856,65.4439Z"/></g>
                                  </svg>
                                </div>
                                <div class="model-item-content">
                                    <span class="model-item-title">Adicionar Questões</span>
                                    <span class="model-item-desc">Importe exercícios para treinamento</span>
                                </div>
                            </button>
                        </div>
                    </div>

                    <!-- Wrapper Botão Modelo (Estilo "Gemini Loop") -->
                    <div style="position: relative;">
                         <button class="model-selector-btn" id="chatModelBtn" title="Alterar modelo">
                             <span id="currentModelText" style="font-weight: 500; font-size: 0.9rem;">Automático</span>
                             <!-- Chevron Down -->
                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.6;"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </button>

                        <!-- Menu Modelo Rico -->
                        <div class="chat-model-menu" id="chatModelMenu">
                            <!-- Item 3: Automático -->
                             <div class="model-menu-item selected" data-model="Automático" data-desc="O melhor para cada tarefa">
                                <div class="model-item-content">
                                    <span class="model-item-title">Automático</span>
                                    <span class="model-item-desc">A IA escolhe o melhor modo para o seu uso</span>
                                </div>
                                <div class="model-item-check">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="check-svg"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                </div>
                            </div>

                            <!-- Item 2: Rápido -->
                            <div class="model-menu-item" data-model="Rápido" data-desc="Respostas ágeis">
                                <div class="model-item-content">
                                    <span class="model-item-title">Rápido</span>
                                    <span class="model-item-desc">Excelente para um estudo rápido e eficaz</span>
                                </div>
                                <div class="model-item-check">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="check-svg"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                </div>
                            </div>

                            <!-- Item 1: Raciocínio (Selected) -->
                            <div class="model-menu-item" data-model="Raciocínio" data-desc="Resolve problemas complexos">
                                <div class="model-item-content">
                                    <span class="model-item-title">Raciocínio</span>
                                    <span class="model-item-desc">Obtenha respostas com menos alucinações ou incoerências</span>
                                </div>
                                <div class="model-item-check">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="check-svg"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="chat-options-right">
                    <button class="action-btn btn-mic" id="chatMicBtn" title="Microfone">
                        <svg width="20" height="20" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                        <g id="SVGRepo_bgCarrier" stroke-width="0"/>
                        <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"/>
                        <g id="SVGRepo_iconCarrier">
                        <path fill="currentColor" d="M480 704h160a64 64 0 0 0 64-64v-32h-96a32 32 0 0 1 0-64h96v-96h-96a32 32 0 0 1 0-64h96v-96h-96a32 32 0 0 1 0-64h96v-32a64 64 0 0 0-64-64H384a64 64 0 0 0-64 64v32h96a32 32 0 0 1 0 64h-96v96h96a32 32 0 0 1 0 64h-96v96h96a32 32 0 0 1 0 64h-96v32a64 64 0 0 0 64 64h96zm64 64v128h192a32 32 0 1 1 0 64H288a32 32 0 1 1 0-64h192V768h-96a128 128 0 0 1-128-128V192A128 128 0 0 1 384 64h256a128 128 0 0 1 128 128v448a128 128 0 0 1-128 128h-96z"/>
                        </g>
                        </svg>
                    </button>
                    <button class="chat-send-btn" aria-label="Enviar">
                        <!-- Seta para cima -->
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                    </button>
                </div>
            </div>
        </div>

        <div class="maia-ai-footer">
            <div class="suggestion-chip">Quero aprender sobre funções de 2º grau</div>
            <div class="suggestion-chip">Me ajude a resolver uma questão do Enem</div>
            <div class="suggestion-chip">Avalie a meu conhecimento em português</div>
        </div>
    </div>
    `;
  document.body.innerHTML = html;

  // === LÓGICA DOS MENUS (PLUS e MODELO) ===
  const plusBtn = document.getElementById("chatPlusBtn");
  const plusMenu = document.getElementById("chatActionMenu");

  const modelBtn = document.getElementById("chatModelBtn");
  const modelMenu = document.getElementById("chatModelMenu");

  function closeAllMenus() {
    plusMenu?.classList.remove("active");
    modelMenu?.classList.remove("active");
  }

  // Toggle Menu Plus
  if (plusBtn && plusMenu) {
    plusBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isActive = plusMenu.classList.contains("active");
      closeAllMenus(); // Fecha outros primeiro
      if (!isActive) plusMenu.classList.add("active");
    });
  }

  // Toggle Menu Model
  if (modelBtn && modelMenu) {
    modelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isActive = modelMenu.classList.contains("active");
      closeAllMenus();
      if (!isActive) modelMenu.classList.add("active");
    });

    // Seleção de item no menu de modelo
    modelMenu.querySelectorAll(".model-menu-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const modelName = item.dataset.model;

        // Update Selected Visuals
        modelMenu
          .querySelectorAll(".model-menu-item")
          .forEach((i) => i.classList.remove("selected"));
        item.classList.add("selected");

        // Update Button Text
        const textSpan = document.getElementById("currentModelText");
        if (textSpan) textSpan.textContent = modelName;

        // Salva modo selecionado no estado global
        window.selectedChatMode = modelName
          .toLowerCase()
          .replace("automático", "automatico")
          .replace("raciocínio", "raciocinio")
          .replace("rápido", "rapido");

        console.log("Modo alterado para:", window.selectedChatMode);
        closeAllMenus();
      });
    });
  }

  // Fechar ao clicar fora
  document.addEventListener("click", () => {
    closeAllMenus();
  });

  // Listener dentro dos menus para evitar fechar ao clicar neles (exceto botões)
  [plusMenu, modelMenu].forEach((menu) => {
    menu?.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  });

  // Persist Floating Terminal
  checkAndRestoreFloatingTerminal();

  // === MICROFONE (Speech-to-Text) ===
  const micBtn = document.getElementById("chatMicBtn");
  const chatTextarea = document.querySelector(".chat-input-field");

  if (micBtn && chatTextarea) {
    // Guarda texto base (antes de começar a gravar) para live preview
    let baseText = "";

    micBtn.addEventListener("click", (e) => {
      e.stopPropagation();

      if (getIsListening()) {
        // Para a gravação
        stopListening();
        micBtn.classList.remove("recording");
        return;
      }

      // Salva o texto atual como base para a transcrição ao vivo
      baseText = chatTextarea.value;

      // Inicia a gravação
      const started = startListening({
        onResult: (text, isFinal) => {
          // Mostra ao vivo: base + texto sendo falado
          const needsSpace = baseText.length > 0 && !baseText.endsWith(" ");
          chatTextarea.value = baseText + (needsSpace ? " " : "") + text;

          // Dispara evento para ajustar altura
          chatTextarea.dispatchEvent(new Event("input", { bubbles: true }));

          if (isFinal) {
            // Atualiza base para próxima frase
            baseText = chatTextarea.value;
          }
        },
        onEnd: () => {
          micBtn.classList.remove("recording");
        },
        onError: (errorMsg) => {
          micBtn.classList.remove("recording");
          if (errorMsg) {
            customAlert(errorMsg);
          }
        },
      });

      if (started) {
        micBtn.classList.add("recording");
      }
    });
  }

  // === SUGESTÕES DINÂMICAS ===
  // Inicia a rotação automática dos chips e placeholder
  startSuggestionRotation();
  setupChipClickHandlers();

  // === SISTEMA DE ANEXO DE ARQUIVOS ===
  const attachedFiles = []; // Array para guardar arquivos anexados
  const fileInput = document.getElementById("chatFileInput");
  const attachmentsContainer = document.getElementById("chatAttachments");
  const uploadBtn = document.getElementById("chatUploadFilesBtn");
  const inputWrapper = document.getElementById("chatInputWrapper");

  // Função para obter ícone baseado no tipo do arquivo
  function getFileIcon(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    const icons = {
      // Documentos
      pdf: "📄",
      doc: "📝",
      docx: "📝",
      txt: "📃",
      // Imagens
      png: "🖼️",
      jpg: "🖼️",
      jpeg: "🖼️",
      gif: "🖼️",
      webp: "🖼️",
      svg: "🖼️",
      bmp: "🖼️",
      // Áudio
      mp3: "🎵",
      wav: "🎵",
      ogg: "🎵",
      aac: "🎵",
      flac: "🎵",
      // Vídeo
      mp4: "🎬",
      webm: "🎬",
      mov: "🎬",
      avi: "🎬",
      mkv: "🎬",
      // Código
      js: "💻",
      ts: "💻",
      py: "💻",
      java: "💻",
      cpp: "💻",
      c: "💻",
      html: "🌐",
      css: "🎨",
      json: "📋",
      xml: "📋",
      md: "📖",
    };
    return icons[ext] || "📎";
  }

  // Função para formatar tamanho do arquivo
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  // Função para criar chip visual do arquivo
  function createAttachmentChip(file, index) {
    const chip = document.createElement("div");
    chip.className = "attachment-chip";
    chip.dataset.index = index;

    // Detecta se é arquivo de questão (padrão: NomeProva_ID.json)
    const isQuestionFile =
      file.type === "application/json" && file.name.endsWith(".json");

    // Preview de imagem se for imagem
    const isImage = file.type.startsWith("image/");
    let previewHtml = "";
    let displayName = file.name;

    if (isImage) {
      const url = URL.createObjectURL(file);
      chip.classList.add("attachment-chip--image-only"); // Class for pure image look

      chip.innerHTML = `
        <img src="${url}" alt="Image" class="attachment-preview-full">
        <button class="attachment-remove-overlay" title="Remover">&times;</button>
      `;

      // Handler para remover (Image Only)
      chip
        .querySelector(".attachment-remove-overlay")
        .addEventListener("click", (e) => {
          e.stopPropagation();
          removeAttachment(index);
        });

      return chip; // Return early for images
    } else if (isQuestionFile) {
      // Ícone especial para questões e oculta o .json
      previewHtml = `<span class="attachment-icon">📚</span>`;
      displayName = file.name.replace(/\.json$/, "");
    } else {
      previewHtml = `<span class="attachment-icon">${getFileIcon(file)}</span>`;
    }

    // Standard rendering for non-images
    chip.innerHTML = `
      ${previewHtml}
      <div class="attachment-info">
        <span class="attachment-name" title="${file.name}">${displayName}</span>
        <span class="attachment-size">${formatFileSize(file.size)}</span>
      </div>
      <button class="attachment-remove" title="Remover">&times;</button>
    `;

    // Handler para remover (Standard)
    chip.querySelector(".attachment-remove").addEventListener("click", (e) => {
      e.stopPropagation();
      removeAttachment(index);
    });

    return chip;
  }

  // Função para adicionar arquivos
  function addFiles(files) {
    for (const file of files) {
      // Verifica se já existe
      const exists = attachedFiles.some(
        (f) => f.name === file.name && f.size === file.size,
      );
      if (!exists) {
        attachedFiles.push(file);
      }
    }
    renderAttachments();
  }

  // Função para remover arquivo
  function removeAttachment(index) {
    attachedFiles.splice(index, 1);
    renderAttachments();
  }

  // Função para renderizar todos os anexos
  function renderAttachments() {
    attachmentsContainer.innerHTML = "";

    if (attachedFiles.length === 0) {
      attachmentsContainer.style.display = "none";
      return;
    }

    attachmentsContainer.style.display = "flex";
    attachedFiles.forEach((file, index) => {
      const chip = createAttachmentChip(file, index);
      attachmentsContainer.appendChild(chip);
    });
  }

  // Handler para botão "Enviar Arquivos"
  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      fileInput.click();
      closeAllMenus();
    });
  }

  // Handler para input file
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        addFiles(e.target.files);
        fileInput.value = ""; // Reset para permitir mesmo arquivo novamente
      }
    });
  }

  // Handler para botão "Adicionar Questões"
  const addQuestionsBtn = document.getElementById("chatAddQuestionsBtn");
  if (addQuestionsBtn) {
    addQuestionsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllMenus();
      openAddQuestionsModal();
    });
  }

  // Listener para questões selecionadas do modal
  window.addEventListener("questions-selected", (e) => {
    const { questions } = e.detail || {};
    if (questions && questions.length > 0) {
      // Adiciona questões como arquivos JSON anexados
      addQuestionsAsFiles(questions);
    }
  });

  // Função para adicionar questões como arquivos JSON anexados
  function addQuestionsAsFiles(questions) {
    questions.forEach((q) => {
      const nomeProva = q.prova.replace(/_/g, " ");
      const fileName = `${nomeProva}_${q.id}.json`;

      // Cria blob JSON com os dados completos da questão
      const jsonContent = JSON.stringify(q.fullData, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json" });

      // Cria objeto File
      const file = new File([blob], fileName, { type: "application/json" });

      // Adiciona à lista de arquivos anexados (usando a função addFiles já existente)
      addFiles([file]);
    });
  }

  // === DRAG AND DROP ===
  if (inputWrapper) {
    // Previne comportamento padrão
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      inputWrapper.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    // Highlight ao arrastar
    ["dragenter", "dragover"].forEach((eventName) => {
      inputWrapper.addEventListener(eventName, () => {
        inputWrapper.classList.add("drag-over");
      });
    });

    // Remove highlight
    ["dragleave", "drop"].forEach((eventName) => {
      inputWrapper.addEventListener(eventName, () => {
        inputWrapper.classList.remove("drag-over");
      });
    });

    // Handler de drop
    inputWrapper.addEventListener("drop", (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        addFiles(files);
      }
    });
  }

  // === BOTÃO ENVIAR / TRANSIÇÃO PARA MODO CONVERSA ===
  const sendBtn = document.querySelector(".chat-send-btn");
  if (sendBtn && chatTextarea) {
    sendBtn.addEventListener("click", (e) => {
      e.preventDefault();

      // [STOP LOGIC] Se já estiver gerando, interrompe
      if (activeGenerationController) {
        activeGenerationController.abort();
        // [FIX] Garante limpeza visual imediata (chama a função centralizada)
        handleGenerationAbortUI();
        return;
      }

      const mensagem = chatTextarea.value.trim();

      // Permite enviar se tem mensagem OU arquivos
      if (!mensagem && attachedFiles.length === 0) return;

      // [START LOGIC]
      activeGenerationController = new AbortController();
      // Muda ícone para Stop (Quadrado Preenchido e Branco) e adiciona classe stop-mode
      sendBtn.classList.add("stop-mode");
      // Ícone: Rect com fill current color (que será branco via CSS .stop-mode) e sem stroke
      sendBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="1"></rect></svg>`;

      // Para sugestões dinâmicas
      stopSuggestionRotation();

      // Transição para modo conversa (passa também os arquivos e o signal)
      transicionarParaModoConversa(mensagem, [...attachedFiles], {
        signal: activeGenerationController.signal,
      });

      // Limpa arquivos anexados
      attachedFiles.length = 0;
      renderAttachments();
    });

    // Também enviar ao pressionar Enter (sem Shift)
    chatTextarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    });

    // === PASTE EVENT HANDLER ===
    chatTextarea.addEventListener("paste", (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      const filesToUpload = [];

      for (let index in items) {
        const item = items[index];
        if (item.kind === "file") {
          const blob = item.getAsFile();
          if (blob) {
            filesToUpload.push(blob);
          }
        }
      }

      if (filesToUpload.length > 0) {
        // Prevent default only if we found files to handle,
        // effectively intercepting them from being pasted as text if they are files.
        // But for images, default paste usually doesn't do anything in textarea anyway.
        // We add them to our attachment system.
        addFiles(filesToUpload);

        // Optional: If you want to prevent the image name (if any) from being pasted as text
        // e.preventDefault();
      }
    });
  }

  // === LOAD CHAT HISTORY SIDEBAR ===
  loadSidebarChats();

  // Trigger initial auth render
  renderUserButton(auth.currentUser);
}

/**
 * Função Wrapper exportada para inicialização (chamada pelo main.js)
 * Garante que os listeners globais sejam anexados apenas uma vez
 */
export function gerarTelaInicial() {
  renderInitialUI();

  // 1. Initial Local Cleanup (Always runs) - Forced Update
  ChatStorageService.cleanupExpired();
  MemoryService.cleanupExpired(); // If implemented

  if (!window.__globalListenersAttached) {
    // Subscribe to Auth Changes
    onAuthStateChanged(auth, (user) => {
      window.isAuthFirstResolved = true;
      renderUserButton(user);

      if (user && !user.isAnonymous) {
        // 2. Sync Logic when Logged In (Real User)
        console.log("Usuário logado detectado. Iniciando sync...");
        ChatStorageService.syncPendingToCloud();
        // [FIX] Ensure we FETCH cloud chats too
        ChatStorageService.syncFromCloud(user.uid).then(() => {
          console.log("Chats baixados da nuvem.");
        });
        MemoryService.syncPendingToCloud(); // If implemented
      }
    });

    // Custom Event for manual updates (e.g. after linking account)
    window.addEventListener("auth-changed", () => {
      renderUserButton(auth.currentUser);
    });

    window.__globalListenersAttached = true;
  }
}

/**
 * Renderiza o botão de usuário no sidebar
 * (Movido para escopo do módulo para ser acessível pelos listeners globais)
 */
function renderUserButton(user) {
  const userSection = document.getElementById("navUserSection");
  if (!userSection) return;

  // Check if anonymous
  if (!user || user.isAnonymous) {
    userSection.innerHTML = `
        <button class="nav-login-btn js-open-login" title="Fazer Login / Criar Conta">
          <span class="login-icon"><img src="logo.png" alt="Logo" class="login-icon"></span>
          <span class="login-text">Entrar</span>
        </button>
        <button class="nav-header-key-btn js-config-api" title="Configurar Chave API">
            🔑
        </button>
        <button class="nav-header-key-btn js-toggle-theme" title="Alternar Tema">
            <!-- Icon initialized by JS -->
        </button>
      `;

    const loginBtn = userSection.querySelector(".js-open-login");
    if (loginBtn) {
      loginBtn.addEventListener("click", () => openLoginModal());
    }

    // Theme Toggle Listener (Anonymous)
    const themeBtn = userSection.querySelector(".js-toggle-theme");
    if (themeBtn) {
      updateThemeIcon(getTheme());
      themeBtn.addEventListener("click", () => toggleTheme());
    }
    // === DYNAMIC LOGOUT ALERT LOGIC ===
    const chatInputWrapper = document.getElementById("chatInputWrapper");
    let logoutAlert = document.getElementById("logoutAlertContainer");

    // 1. Create and Insert if logic demands (Not logged in AND auth resolved)
    if (window.isAuthFirstResolved && !logoutAlert && chatInputWrapper) {
      logoutAlert = document.createElement("div");
      logoutAlert.id = "logoutAlertContainer";
      logoutAlert.className = "logout-alert-container";
      logoutAlert.style.display = "block"; // Show immediately

      logoutAlert.innerHTML = `
            <div class="logout-alert-content">
                <div class="logout-alert-text">
                    <div class="logout-alert-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        Modo Visitante
                    </div>
                    <div class="logout-alert-desc">
                        O histórico e memórias são armazenados temporariamente por 30 minutos.
                    </div>
                </div>
                <div class="logout-alert-actions">
                    <button class="logout-alert-btn js-open-login-alert">
                        Fazer Login
                    </button>
                    <button class="logout-alert-close" id="closeLogoutAlert" title="Fechar aviso">
                        &times;
                    </button>
                </div>
            </div>
        `;

      // Insert before Chat Input
      chatInputWrapper.parentNode.insertBefore(logoutAlert, chatInputWrapper);

      // Attach Listeners
      const alertLoginBtn = logoutAlert.querySelector(".js-open-login-alert");
      if (alertLoginBtn) {
        alertLoginBtn.addEventListener("click", () => openLoginModal());
      }

      const closeAlertBtn = logoutAlert.querySelector("#closeLogoutAlert");
      if (closeAlertBtn) {
        closeAlertBtn.addEventListener("click", () => {
          logoutAlert.remove(); // Completely remove from DOM
        });
      }
    } else if (logoutAlert) {
      // Ensure visible if it exists
      logoutAlert.style.display = "block";
    }
  } else {
    // Logged in user - REMOVE ALERT if exists
    const logoutAlert = document.getElementById("logoutAlertContainer");
    if (logoutAlert) {
      logoutAlert.remove();
    }
    // Logged in user
    const displayName =
      user.displayName || (user.email ? user.email.split("@")[0] : "Viajante");

    const photoURL =
      user.photoURL ||
      "https://ui-avatars.com/api/?name=" + encodeURIComponent(displayName);

    userSection.innerHTML = `
        <div class="user-profile-dropdown" style="position: relative; flex: 1; min-width: 0;">
            <button class="nav-login-btn" id="userProfileBtn" style="width: 100%; padding: 6px 12px; gap: 10px; justify-content: flex-start; text-align: left; background: transparent; border: 1px solid var(--color-border);">
              <img src="${photoURL}" alt="User" class="nav-user-avatar" style="width: 32px; height: 32px; flex-shrink: 0; border: 2px solid var(--color-border);">
              <div style="display: flex; flex-direction: column; overflow: hidden; line-height: 1.2;">
                  <span style="font-weight: 700; font-size: 0.85rem; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(displayName)}</span>
                  <span style="font-size: 0.7rem; color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(user.email || "")}</span>
              </div>
            </button>
            
            <div class="user-dropdown-menu" id="userDropdownMenu" style="width: 100%; left: 0;">
                <button class="dropdown-item js-logout-btn">
                    Sair
                </button>
            </div>
        </div>
        <button class="nav-header-key-btn js-config-api" title="Configurar Chave API">
            🔑
        </button>
        <button class="nav-header-key-btn js-toggle-theme" title="Alternar Tema">
            <!-- Icon initialized by JS -->
        </button>
      `;

    // Profile Dropdown Logic
    const profileBtn = document.getElementById("userProfileBtn");
    const dropdown = document.getElementById("userDropdownMenu");

    // Theme Toggle Listener (Logged In)
    const themeBtn = userSection.querySelector(".js-toggle-theme");
    if (themeBtn) {
      updateThemeIcon(getTheme());
      themeBtn.addEventListener("click", () => toggleTheme());
    }

    if (profileBtn && dropdown) {
      profileBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("visible");
      });

      // Close on click outside
      document.addEventListener("click", (e) => {
        if (!dropdown.contains(e.target) && !profileBtn.contains(e.target)) {
          dropdown.classList.remove("visible");
        }
      });

      // Logout
      const logoutBtn = dropdown.querySelector(".js-logout-btn");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
          const { showConfirmModal } = await import("../ui/modal-confirm.js"); // lazy import
          const confirmed = await showConfirmModal(
            "Deseja realmente sair?",
            "Seus chats locais permanecerão, mas a sincronização será pausada.",
            "Sair",
            "Cancelar",
          );

          if (confirmed) {
            await logoutUser();
            dropdown.classList.remove("visible");
          }
        });
      }
    }
  }

  // Config API Key Listener (Re-attach inside render)
  const apiKeyBtns = userSection.querySelectorAll(".js-config-api");
  if (apiKeyBtns) {
    apiKeyBtns.forEach((btn) =>
      btn.addEventListener("click", () => mountApiKeyModal()),
    );
  }
}

/**
 * Carrega e renderiza a lista de chats na sidebar
 */
async function loadSidebarChats() {
  const list = document.getElementById("navChatList");
  if (!list) return;

  // Dynamic import to avoid cycle
  const { ChatStorageService } = await import("../services/chat-storage.js");

  // Handler para update (evita duplicar listener)
  if (!window._chatListListener) {
    window.addEventListener("chat-list-updated", () => loadSidebarChats());
    window._chatListListener = true;
  }

  const chats = await ChatStorageService.getChats();

  const newChatHtml = `
    <button class="nav-sidebar-item nav-chat-item" onclick="window.startNewChat()" style="justify-content: flex-start; margin-bottom: 10px; background: rgba(var(--color-primary-rgb), 0.1); border: 1px solid rgba(var(--color-primary-rgb), 0.2);">
        <span class="nav-icon" style="font-size: 1rem;">+</span>
        <span class="nav-label" style="font-weight: 500; color: var(--color-primary);">Novo Chat</span>
    </button>
  `;

  let historyHtml = "";

  if (chats.length === 0) {
    historyHtml = `<div style="padding: 10px 16px; font-size: 0.8rem; color: var(--color-text-secondary); font-style: italic;">Nenhum chat recente</div>`;
  } else {
    historyHtml = chats
      .map(
        (c) => `
        <button class="nav-sidebar-item nav-chat-item" onclick="window.loadChat('${
          c.id
        }')" style="justify-content: flex-start;">
            <span class="nav-icon" style="font-size: 1rem;">💬</span>
            <span class="nav-label" style="overflow: hidden;">
                <span class="nav-title" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${
                  c.title || "Novo Chat"
                }</span>
                <span class="nav-desc">${new Date(
                  c.updatedAt,
                ).toLocaleDateString()}</span>
            </span>
        </button>
    `,
      )
      .join("");
  }

  list.innerHTML = newChatHtml + historyHtml;
}

/**
 * Inicia um novo chat (reseta a aplicação sem reload)
 */
window.startNewChat = function () {
  // Abort active generation if any
  if (activeGenerationController) {
    activeGenerationController.abort();
    activeGenerationController = null;
  }

  // Limpa ID do chat atual
  window.currentChatId = null;

  // Limpa URL
  const url = window.location.pathname;
  window.history.replaceState({}, document.title, url);

  // Destroy custom scrollbar
  destroyCustomChatScrollbar();

  // Reconstrói a UI inicial (SPA Reset)
  renderInitialUI();
};

/**
 * Carrega um chat do histórico e exibe na tela
 */
window.loadChat = async function (chatId) {
  // Abort active generation if any
  if (activeGenerationController) {
    activeGenerationController.abort();
    activeGenerationController = null;
  }

  // Dynamic import to avoid cycle
  const { ChatStorageService } = await import("../services/chat-storage.js");

  const chat = await ChatStorageService.getChat(chatId);
  if (!chat) return;

  window.currentChatId = chatId;

  // 1. Prepara UI (sem mensagem inicial nova)
  transicionarParaModoConversa(null, []);

  // 2. Limpa mensagens existentes (transicionarParaModoConversa limpa se for primeira msg, mas aqui já estamos no modo)
  const messagesContainer = document.getElementById("chatMessages");
  if (messagesContainer) messagesContainer.innerHTML = "";

  // 3. Renderiza Histórico
  chat.messages.forEach((msg, index) => {
    // [FILTER] Ignora mensagens vazias/corrompidas (fix empty bubble)
    if (
      !msg.content &&
      (!msg.attachments || msg.attachments.length === 0) &&
      !msg.type &&
      !msg.content?._thoughts
    )
      return;

    if (msg.role === "user") {
      // Render User Message
      const userMessage = document.createElement("div");
      userMessage.className = "chat-message chat-message--user visible";
      userMessage.dataset.msgIndex = index; // Para persistência de Scaffolding

      // Recria anexos se houver (visual apenas, sem blob data se foi limpo)
      let filesHtml = "";
      if (msg.attachments && msg.attachments.length > 0) {
        filesHtml = `<div class="message-files">${msg.attachments
          .map(
            (f) => `
                    <div class="message-file-chip">
                        <span class="message-file-icon">📎</span>
                        <span class="message-file-name">${f.name || "Anexo"}</span>
                    </div>`,
          )
          .join("")}</div>`;
      }
      userMessage.innerHTML = `<div class="chat-message-content">${filesHtml}<p>${escapeHtml(msg.content)}</p></div>`;
      messagesContainer.appendChild(userMessage);
    } else if (msg.role === "model") {
      // Render AI Message
      const aiMessage = document.createElement("div");
      aiMessage.className = "chat-message chat-message--ai visible";
      aiMessage.id = `msg-${index}`; // ID estável
      aiMessage.dataset.msgIndex = index; // Para persistência de Scaffolding

      // [RENDER THOUGHTS] Se houver pensamentos salvos
      if (
        msg.content &&
        msg.content._thoughts &&
        Array.isArray(msg.content._thoughts)
      ) {
        // Reconstroi container de pensamentos
        const thoughtsContainer = document.createElement("div");
        thoughtsContainer.className = "chat-thought-container";

        const header = document.createElement("div");
        header.className = "chat-thought-header";
        // Estado concluído
        header.innerHTML = `
            <div class="summary-content-wrapper">
                 <div class="summary-logo-static" style="width:18px; height:18px; opacity:1; display:flex; align-items:center; justify-content:center;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                 </div>
                 <span class="summary-text">Raciocínio concluído</span>
            </div>
          `;

        const inner = document.createElement("div");
        inner.className = "chat-thoughts-inner";
        const list = document.createElement("div");
        list.className = "chat-thoughts-list";

        msg.content._thoughts.forEach((thoughtText) => {
          const { title, body } = splitThought(thoughtText);
          const card = criarElementoCardPensamento(title, body);
          list.appendChild(card);
        });

        inner.appendChild(list);
        thoughtsContainer.appendChild(header);
        thoughtsContainer.appendChild(inner);

        header.addEventListener("click", () => {
          thoughtsContainer.classList.toggle("open");
        });

        aiMessage.appendChild(thoughtsContainer);
      }

      const contentContainer = document.createElement("div");
      contentContainer.className = "chat-message-content";

      // msg.content deve ser o objeto estruturado {layout, conteudo} ou string legado
      let htmlContent = "";
      if (typeof msg.content === "object") {
        htmlContent = generateChatHtmlString(msg.content);
      } else {
        htmlContent = `<p>${msg.content}</p>`; // Fallback legacy
      }

      contentContainer.innerHTML = htmlContent;
      aiMessage.appendChild(contentContainer);
      messagesContainer.appendChild(aiMessage);

      // Hidratação
      hydrateAllChatContent(contentContainer);
      const staticSelectors = [
        ".q-header",
        ".q-options",
        ".q-footer",
        ".static-render-target",
      ];
      setTimeout(() => {
        staticSelectors.forEach((sel) => {
          contentContainer
            .querySelectorAll(sel)
            .forEach((el) => renderLatexIn(el));
        });
      }, 0);
    } else if (msg.role === "system") {
      // [RENDER SYSTEM EVENTS] Memória, Modo, etc.
      const systemMsg = document.createElement("div");
      systemMsg.className = "chat-message chat-message--system visible";

      let renderedContent = null;

      if (msg.content && msg.content.type === "memory_found") {
        const { title, facts, summary } = msg.content;
        const contentDiv = document.createElement("div");
        const factsList = Array.isArray(facts)
          ? facts
              .map((f) => {
                const similarity = f.score
                  ? ` <span style="opacity:0.6; font-size:0.8em">(${(f.score * 100).toFixed(0)}%)</span>`
                  : "";
                return `<li style="margin-bottom:4px;">${f.conteudo || "Conteúdo indisponível"}${similarity}</li>`;
              })
              .join("")
          : "";

        contentDiv.innerHTML = `
                <div style="margin-bottom:12px;">
                    <div style="font-weight:600; margin-bottom:4px; color:var(--color-text);">Resumo Contextual Gerado:</div>
                    <div style="font-style:italic; background:var(--color-bg-tertiary); padding:8px; border-radius:6px;">"${summary || "Nenhum resumo gerado."}"</div>
                </div>
                ${factsList ? `<div><div style="font-weight:600; margin-bottom:4px; color:var(--color-text);">Fatos Originais Recuperados (${facts.length}):</div><ul style="padding-left:20px; margin-top:0;">${factsList}</ul></div>` : ""}
            `;
        renderedContent = createExpandableStatusGlobal(title, contentDiv); // Usando helper global
      } else if (msg.content && msg.content.type === "mode_selected") {
        const { mode, reason, confidence } = msg.content;
        const modeNames = {
          rapido: "Rápido",
          raciocinio: "Raciocínio",
          automatico: "Automático",
        };

        const contentDiv = document.createElement("div");
        contentDiv.innerHTML = `
                <div style="margin-bottom:8px;"><strong>Decisão:</strong> ${modeNames[mode] || mode}</div>
                <div style="margin-bottom:8px;"><strong>Motivo:</strong> ${reason || "N/A"}</div>
                <div><strong>Confiança:</strong> ${(confidence * 100).toFixed(0)}%</div>
            `;
        renderedContent = createExpandableStatusGlobal(
          `Modo ${modeNames[mode] || mode} selecionado`,
          contentDiv,
        );
      }

      if (renderedContent) {
        const msgContent = document.createElement("div");
        msgContent.className = "chat-message-content";
        msgContent.style.padding = "0";
        msgContent.style.background = "transparent";
        msgContent.style.boxShadow = "none";
        msgContent.appendChild(renderedContent);
        systemMsg.appendChild(msgContent);
        messagesContainer.appendChild(systemMsg);
      }
    }
  });

  // 4. Update Header Title
  updateChatFloatingHeader(chat.title);

  // 5. Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // 6. Close sidebar on mobile
  document.querySelector(".nav-sidebar")?.classList.remove("open");
  document.querySelector(".nav-sidebar-overlay")?.classList.remove("visible");

  // 7. Hydrate Scaffolding (agora passa o ID do chat para o contexto)
  hydrateScaffoldingBlocks(messagesContainer);

  // 8. Initialize custom scrollbar for mobile
  setTimeout(() => initCustomChatScrollbar(), 100);
};

export function updateChatFloatingHeader(title) {
  let header = document.getElementById("chatFloatingHeader");
  if (!header) {
    // Create if not exists (in chat container)
    const container = document.querySelector(".maia-ai-container"); // or chatMessages parent
    if (container) {
      header = document.createElement("div");
      header.id = "chatFloatingHeader";
      header.className = "chat-floating-header glass-effect";
      container.appendChild(header);
    }
  }

  if (header) {
    header.innerHTML = `<span style="opacity:0.6;">Chat:</span> <strong>${title}</strong>`;
  }
}

/**
 * Função responsável por encontrar placeholders de questão no chat
 * e substituí-los pelo card real da questão (Hydration).
 */
async function hydrateQuestionBlocks(containerElement) {
  if (!containerElement) return;

  const placeholders = containerElement.querySelectorAll(
    ".chat-question-placeholder",
  ); // Select class directly

  // Processa sequencialmente ou paralelo? Paralelo é melhor pra UX.
  placeholders.forEach(async (placeholder) => {
    // Evita re-hidratar se já estiver processado
    if (placeholder.dataset.processed === "true") return;
    placeholder.dataset.processed = "true";

    try {
      const filterRaw = placeholder.dataset.filter;
      if (!filterRaw) return;

      const filtros = JSON.parse(filterRaw);

      // Busca a questão
      const questaoEncontrada = await findBestQuestion(filtros);

      if (questaoEncontrada) {
        // Cria o card usando o template oficial do Banco (retorna HTMLElement)
        const cardElement = criarCardTecnico(
          questaoEncontrada.id,
          questaoEncontrada.fullData,
        );

        // Adiciona classes e estilos para garantir visualização correta no chat
        cardElement.classList.add("chat-embedded-card");

        // Substitui o placeholder pelo card
        placeholder.replaceWith(cardElement);

        // --- SAFE LATEX RENDERING ---
        // Não rodar no card inteiro para evitar conflito com a hidratação React no .q-body e .q-resolution
        // Renderiza apenas nas partes estáticas conhecidas
        const staticSelectors = [
          ".q-header",
          ".q-options",
          ".q-footer",
          ".static-render-target", // Containers seguros (Justificativa, Relatorio)
          ".markdown-content", // Backup: pega direto os elementos (agora suportado pelo loader)
        ];

        // Usa setTimeout para garantir que o DOM atualizou e libs carregaram
        setTimeout(() => {
          staticSelectors.forEach((selector) => {
            const els = cardElement.querySelectorAll(selector);
            els.forEach((el) => renderLatexIn(el));
          });
        }, 0);
      } else {
        placeholder.innerHTML = `<div style="color:red; padding:10px;">Questão não encontrada.</div>`;
      }
    } catch (e) {
      console.error("Erro ao hidratar questão no chat:", e);
      placeholder.innerHTML = `<div style="color:red; padding:10px;">Erro ao carregar questão: ${e.message}</div>`;
    }
  });
}

/**
 * Transiciona a interface para o modo de conversa
 * - Fade out do glow de fundo
 * - Mostra mensagem do usuário
 * - Move input para baixo
 * - Dropdowns viram dropups
 * @param {string} mensagem - Texto da mensagem
 * @param {object} options - Opções extras (ex: signal)
 */
function transicionarParaModoConversa(mensagem, arquivos = [], options = {}) {
  // Garante que a rotação de sugestões/placeholder pare ao entrar no chat
  stopSuggestionRotation();

  const container = document.querySelector(".maia-ai-container");
  if (!container) return;

  // Verifica se já está em modo conversa (container de mensagens já existe)
  let messagesContainer = document.getElementById("chatMessages");
  const isFirstMessage = !messagesContainer;

  // Se é a primeira mensagem, fazer transição visual
  if (isFirstMessage) {
    // 1. Adiciona classe para iniciar transição
    container.classList.add("chat-mode");

    // 2. Remove elementos da tela inicial
    const brandHeader = document.getElementById("brandHeader");
    const footer = document.querySelector(".maia-ai-footer");
    const inputWrapper = document.querySelector(".chat-input-wrapper");

    // Remove header com logo grande e footer de sugestões
    if (brandHeader) {
      brandHeader.style.transition = "opacity 0.4s ease, transform 0.4s ease";
      brandHeader.style.opacity = "0";
      brandHeader.style.transform = "translateY(-20px)";
      setTimeout(() => brandHeader.remove(), 400);
    }

    if (footer) {
      footer.style.transition = "opacity 0.3s ease";
      footer.style.opacity = "0";
      setTimeout(() => footer.remove(), 300);
    }

    // 3. Criar container de mensagens
    messagesContainer = document.createElement("div");
    messagesContainer.className = "chat-messages";
    messagesContainer.id = "chatMessages";

    // Inserir área de mensagens antes do input
    if (inputWrapper) {
      inputWrapper.parentNode.insertBefore(messagesContainer, inputWrapper);
    }

    // Initialize custom scrollbar for mobile
    setTimeout(() => initCustomChatScrollbar(), 100);
  }

  // 4. Criar HTML dos arquivos anexados (se houver)
  let filesHtml = "";
  if (arquivos.length > 0) {
    const fileChips = arquivos
      .map((file) => {
        const isImage = file.type.startsWith("image/");
        const ext = file.name.split(".").pop().toLowerCase();
        const icons = {
          pdf: "📄",
          doc: "📝",
          docx: "📝",
          txt: "📃",
          png: "🖼️",
          jpg: "🖼️",
          jpeg: "🖼️",
          gif: "🖼️",
          webp: "🖼️",
          mp3: "🎵",
          wav: "🎵",
          mp4: "🎬",
          webm: "🎬",
          js: "💻",
          py: "💻",
          html: "🌐",
          css: "🎨",
          json: "📋",
        };
        const icon = icons[ext] || "📎";

        if (isImage) {
          const url = URL.createObjectURL(file);
          return `<div class="message-file-chip message-file-chip--image">
          <img src="${url}" alt="${file.name}" class="message-file-preview">
        </div>`;
        }
        return `<div class="message-file-chip">
        <span class="message-file-icon">${icon}</span>
        <span class="message-file-name">${file.name}</span>
      </div>`;
      })
      .join("");

    filesHtml = `<div class="message-files">${fileChips}</div>`;
  }

  // 5. Adicionar mensagem do usuário ao container existente
  // 5. Adicionar mensagem do usuário ao container existente (apenas se houver mensagem nova)
  if (mensagem || arquivos.length > 0) {
    const userMessage = document.createElement("div");
    userMessage.className = "chat-message chat-message--user";

    const messageContent = mensagem ? `<p>${escapeHtml(mensagem)}</p>` : "";
    userMessage.innerHTML = `
        <div class="chat-message-content">
          ${filesHtml}
          ${messageContent}
        </div>
      `;

    messagesContainer.appendChild(userMessage);

    // Animar entrada
    setTimeout(() => {
      userMessage.classList.add("visible");
    }, 50);

    // === SETUP FLOATING HEADER (Initial) ===
    // Se não tem ID ainda, o título provisório é a mensagem
    if (!window.currentChatId) {
      updateChatFloatingHeader(
        mensagem.slice(0, 30) + (mensagem.length > 30 ? "..." : ""),
      );
    } else {
      // Se já tem ID, mantemos o header atual ou buscamos do storage (no loadChat já define)
    }
  }

  // 5. Limpar textarea
  const chatTextarea = document.querySelector(".chat-input-field");
  if (chatTextarea) {
    chatTextarea.value = "";
    chatTextarea.style.height = "";
    chatTextarea.placeholder = "Continuar conversa...";
  }

  // 7. Mostrar indicador de carregamento (logo girando)
  // [MODIFICADO] Só mostra loading e chama pipeline se tiver nova mensagem/arquivo
  if (mensagem || (arquivos && arquivos.length > 0)) {
    const loadingIndicator = document.createElement("div");
    loadingIndicator.className = "chat-loading-container";
    loadingIndicator.id = "chatLoading";

    // Decide initial text based on current selection
    let loadingText = "Iniciando modelo";
    const currentMode = window.selectedChatMode || "automatico";

    if (currentMode === "automatico") {
      loadingText = "Decidindo modo de execução";
    }

    loadingIndicator.innerHTML = `
      <img src="logo.png" alt="Loading" class="chat-loading-logo">
      <span class="chat-loading-text">${loadingText}<span class="loading-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span></span>
  `;
    messagesContainer.appendChild(loadingIndicator);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // 8. Executar pipeline de chat com router
    const selectedMode = window.selectedChatMode || "automatico";

    // [REMOVIDO] createExpandableStatus local - agora usamos a global

    runChatPipeline(selectedMode, mensagem, arquivos, {
      apiKey: sessionStorage.getItem("geminiApiKey"),
      chatMode: true, // Ativa modo chat (preserva history)
      chatId: window.currentChatId, // Passa ID atual (null se novo)
      history: extractChatHistory(), // Passa histórico recuperado do DOM (contexto imediato)
      signal: options.signal, // Pass AbortSignal passed from Send Button

      // Callbacks de Persistência
      onChatCreated: (chat) => {
        window.currentChatId = chat.id;
        console.log("Chat criado:", chat.id);
        // Atualiza UI se necessário
        window.history.pushState({}, "", `?chat=${chat.id}`); // Opcional: URL amigável
      },
      onTitleUpdated: (id, newTitle) => {
        if (window.currentChatId === id) {
          updateChatFloatingHeader(newTitle);
        }
      },

      // Handle intermediate status updates
      onProcessingStatus: (type, data) => {
        if (type === "loading") {
          // Update loading text
          const loadingEl = document.getElementById("chatLoading");
          if (loadingEl) {
            const textEl = loadingEl.querySelector(".chat-loading-text");
            if (textEl) {
              // Keep the dots
              textEl.innerHTML = `${data}<span class="loading-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>`;
            }
          }
        } else if (type === "memory_found") {
          // Render Memory Block System Message Live
          const { title, facts, summary } = data;
          const messagesContainer = document.getElementById("chatMessages");
          const loadingEl = document.getElementById("chatLoading");

          if (messagesContainer) {
            const contentDiv = document.createElement("div");
            const factsList = Array.isArray(facts)
              ? facts
                  .map((f) => {
                    const similarity = f.score
                      ? ` <span style="opacity:0.6; font-size:0.8em">(${(f.score * 100).toFixed(0)}%)</span>`
                      : "";
                    return `<li style="margin-bottom:4px;">${f.conteudo || "Conteúdo indisponível"}${similarity}</li>`;
                  })
                  .join("")
              : "";

            contentDiv.innerHTML = `
                        <div style="margin-bottom:12px;">
                            <div style="font-weight:600; margin-bottom:4px; color:var(--color-text);">Resumo Contextual Gerado:</div>
                            <div style="font-style:italic; background:var(--color-bg-tertiary, #2a2a2a); padding:8px; border-radius:6px;">"${summary || "Nenhum resumo gerado."}"</div>
                        </div>
                        ${factsList ? `<div><div style="font-weight:600; margin-bottom:4px; color:var(--color-text);">Fatos Originais Recuperados (${facts.length}):</div><ul style="padding-left:20px; margin-top:0;">${factsList}</ul></div>` : ""}
                   `;

            const statusEl = createExpandableStatusGlobal(title, contentDiv);

            const systemMsg = document.createElement("div");
            systemMsg.className = "chat-message chat-message--system visible";
            const msgContent = document.createElement("div");
            msgContent.className = "chat-message-content";
            msgContent.style.padding = "0";
            msgContent.style.background = "transparent";
            msgContent.style.boxShadow = "none";
            msgContent.appendChild(statusEl);
            systemMsg.appendChild(msgContent);

            if (loadingEl) {
              messagesContainer.insertBefore(systemMsg, loadingEl);
            } else {
              messagesContainer.appendChild(systemMsg);
            }
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        }
      },

      // Notifica quando o router decide o modo
      onModeDecided: ({ mode, reason, confidence }) => {
        console.log(`[Router] Modo decidido: ${mode} - ${reason}`);

        const modeNames = {
          rapido: "Rápido",
          raciocinio: "Raciocínio",
          automatico: "Automático",
        };

        const loadingEl = document.getElementById("chatLoading");
        const messagesContainer = document.getElementById("chatMessages");

        // Atualiza o texto do loading para "Iniciando modelo"
        if (loadingEl) {
          const textEl = loadingEl.querySelector(".chat-loading-text");
          if (textEl) {
            textEl.innerHTML = `Iniciando modelo<span class="loading-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>`;
          }
        }

        if (messagesContainer) {
          // Cria conteúdo detalhado
          const contentDiv = document.createElement("div");
          contentDiv.innerHTML = `
            <div style="margin-bottom:8px;"><strong>Decisão:</strong> ${modeNames[mode] || mode}</div>
            <div style="margin-bottom:8px;"><strong>Motivo:</strong> ${reason || "N/A"}</div>
            <div><strong>Confiança:</strong> ${(confidence * 100).toFixed(0)}%</div>
        `;

          // [UPDATED] Use Global Helper
          const statusEl = createExpandableStatusGlobal(
            `Modo ${modeNames[mode] || mode} selecionado`,
            contentDiv,
          );

          const systemMsg = document.createElement("div");
          systemMsg.className = "chat-message chat-message--system visible";

          // Remove padding padrão do card system para abrigar o componente full-width
          const msgContent = document.createElement("div");
          msgContent.className = "chat-message-content";
          msgContent.style.padding = "0";
          msgContent.style.background = "transparent";
          msgContent.style.boxShadow = "none";
          msgContent.appendChild(statusEl);

          systemMsg.appendChild(msgContent);

          // Insere ANTES do loading se ele existir
          if (loadingEl) {
            messagesContainer.insertBefore(systemMsg, loadingEl);
          } else {
            messagesContainer.appendChild(systemMsg);
          }

          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      },

      onComplete: (fullMessage) => {
        // Ao finalizar a mensagem, rodamos a hidratação dos blocos de questão
        const messagesContainer = document.getElementById("chatMessages");
        if (messagesContainer) {
          hydrateQuestionBlocks(messagesContainer);
          hydrateScaffoldingBlocks(messagesContainer);
        }

        // [FIX] Remover ID de mensagem ativa para evitar conflito na próxima
        const currentAiMessage = document.getElementById("currentAiMessage");
        if (currentAiMessage) currentAiMessage.removeAttribute("id");

        // Reset Send Button UI
        activeGenerationController = null;
        const sendBtn = document.querySelector(".chat-send-btn");
        if (sendBtn) {
          sendBtn.classList.remove("stop-mode");
          sendBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`;
        }
      },

      onError: (error) => {
        console.warn("Pipeline Error/Abort:", error);

        // Se foi abort (AbortError), ou se explicitamente marcado como aborted
        if (
          error.name === "AbortError" ||
          error.message?.includes("aborted") ||
          error.aborted
        ) {
          handleGenerationAbortUI();
        } else {
          // Outros erros
          // Reset Send Button UI normal
          activeGenerationController = null;
          const sendBtn = document.querySelector(".chat-send-btn");
          if (sendBtn) {
            sendBtn.classList.remove("stop-mode");
            sendBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`;
          }

          const loading = document.getElementById("chatLoading");
          if (loading)
            loading.innerHTML = `<span style="color:red;">Erro: ${error.message}</span>`;
        }
      },

      // Callback de Pensamento (Reasoning/Chain of Thought)
      onThought: (thoughtText) => {
        // 1. Garante que o loading "geral" saiu
        const loading = document.getElementById("chatLoading");
        if (loading) loading.remove();

        let aiMessage = document.getElementById("currentAiMessage");
        if (!aiMessage) {
          aiMessage = document.createElement("div");
          aiMessage.className = "chat-message chat-message--ai visible";
          aiMessage.id = "currentAiMessage";
          // Estrutura: Conteúdo vai ser appendado depois
          aiMessage.innerHTML = `<div class="chat-message-content"></div>`;
          messagesContainer.appendChild(aiMessage);
        }

        // 2. Garante container de thoughts (DIV customizado, abandonando details/summary)
        let thoughtsContainer = aiMessage.querySelector(
          ".chat-thought-container",
        );
        let thoughtsInner = null;

        if (!thoughtsContainer) {
          // Wrapper Principal (transparente)
          thoughtsContainer = document.createElement("div");
          thoughtsContainer.className = "chat-thought-container";
          // Começa fechado por padrão (sem classe .open)

          // Header (O "Chip" Azul - sempre visível)
          const header = document.createElement("div");
          header.className = "chat-thought-header";
          header.innerHTML = `
            <div class="summary-content-wrapper">
                <img src="logo.png" class="summary-logo-spinner" alt="Thinking">
                <span class="summary-text">Processando raciocínio...</span>
            </div>
        `;

          // Container interno para os cards (O "Negócio Escuro")
          thoughtsInner = document.createElement("div");
          thoughtsInner.className = "chat-thoughts-inner";
          // Inicialmente escondido via CSS (quando container não tem .open)

          // Click handler para Toggle
          header.addEventListener("click", () => {
            thoughtsContainer.classList.toggle("open");
          });

          thoughtsContainer.appendChild(header);
          thoughtsContainer.appendChild(thoughtsInner);

          // Insere ANTES do conteúdo da resposta
          aiMessage.prepend(thoughtsContainer);

          // --- INICIALIZA O SKELETON REUTILIZADO ---
          // Passamos 'thoughtsInner' como o container pai
          const refs = construirSkeletonLoader(thoughtsInner);

          // Salvamos as referências no elemento DOM para reuso nas próximas chamadas
          thoughtsContainer._refs = refs;
        } else {
          // Recupera referências
          thoughtsInner = thoughtsContainer.querySelector(
            ".chat-thoughts-inner",
          );
        }

        // Referências do Skeleton
        const refs = thoughtsContainer._refs;
        if (!refs || !refs.thoughtListEl) return;

        // 3. Processa o novo pensamento
        const { title, body } = splitThought(thoughtText);

        // Atualiza o header com o título do último pensamento
        const summaryText = thoughtsContainer.querySelector(".summary-text");
        if (summaryText) summaryText.textContent = title;

        // Lógica de "Push Thought" adaptada (evita duplicatas e usa DOM manipulado)
        // Checa se é diferente do último inserido
        const lastSig = thoughtsContainer._lastThoughtSig;
        const currentSig = `${title}||${body}`;

        if (body && currentSig !== lastSig) {
          thoughtsContainer._lastThoughtSig = currentSig;

          // Cria o card visual reutilizando a função original
          const card = criarElementoCardPensamento(title, body);

          // Insere ANTES do skeleton (igual logika original)
          // O skeleton loader tem class .maia-thought-card--skeleton
          const skeletonCard = refs.thoughtListEl.querySelector(
            ".maia-thought-card--skeleton",
          );

          if (skeletonCard) {
            refs.thoughtListEl.insertBefore(card, skeletonCard);
          } else {
            refs.thoughtListEl.appendChild(card);
          }

          // Auto-Scroll no container interno
          if (thoughtsInner.scrollHeight > thoughtsInner.clientHeight) {
            thoughtsInner.scrollTop = thoughtsInner.scrollHeight;
          }
        }

        // Scroll do chat principal para acompanhar crescimento
        // messagesContainer.scrollTop = messagesContainer.scrollHeight;
        // (Opcional, as vezes irrita se scrollar muito, deixar usuario controlar)
      },

      // Stream de texto da resposta
      onStream: (responseObj) => {
        // Remove loading
        const loading = document.getElementById("chatLoading");
        if (loading) loading.remove();

        let aiMessage = document.getElementById("currentAiMessage");
        if (!aiMessage) {
          aiMessage = document.createElement("div");
          aiMessage.className = "chat-message chat-message--ai visible";
          aiMessage.id = "currentAiMessage";
          // Container principal do conteúdo
          aiMessage.innerHTML = `<div class="chat-message-content"></div>`;
          messagesContainer.appendChild(aiMessage);
        }

        // Garante que o container de thoughts esteja presente (mesmo que vazio ou fechado)
        // Se já foi criado no onThought, mantemos.
        let thoughtsContainer = aiMessage.querySelector(
          ".chat-thought-container",
        );

        // [ALTERADO] Não limpamos mais os pensamentos/skeleton aqui.
        // Mantemos o estado de "Processando" e o skeleton visíveis durante todo o stream da resposta.
        // A limpeza visual ocorrerá apenas no onComplete.

        // if (thoughtsContainer && thoughtsContainer._refs && !thoughtsContainer._cleaned) { ... }

        const contentContainer = aiMessage.querySelector(
          ".chat-message-content",
        );
        if (contentContainer) {
          // Gera o HTML a partir do objeto estruturado (agora recebemos o JSON parseado)
          const html = generateChatHtmlString(responseObj);
          contentContainer.innerHTML = html;

          // Renderiza Matemática/Markdown nos blocos novos
          // Otimização: Poderia renderizar apenas o último bloco, mas o renderLatexIn é robusto
          renderLatexIn(contentContainer);

          // Syntax Highlighting
          contentContainer.querySelectorAll("pre code").forEach((el) => {
            if (window.hljs) window.hljs.highlightElement(el);
          });

          // [NOVO] Hidratação unificada
          hydrateAllChatContent(contentContainer);
        }

        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      },

      // Conclusão
      onComplete: ({ mode, response }) => {
        console.log(`[Chat] Resposta completa (modo: ${mode})`);
        // Remove ID temporário
        const aiMessage = document.getElementById("currentAiMessage");
        if (aiMessage) {
          aiMessage.removeAttribute("id");

          // Limpeza final dos pensamentos (Skeleton e Status)
          // Agora fazemos isso apenas no fim para manter a sensação de "processo ativo"
          const thoughtsContainer = aiMessage.querySelector(
            ".chat-thought-container",
          );

          if (thoughtsContainer) {
            // 1. Remove Skeletons restantes
            const skeletons = thoughtsContainer.querySelectorAll(
              ".maia-thought-card--skeleton",
            );
            skeletons.forEach((s) => s.remove());

            // 2. Remove Status Area (Loading text bottom)
            const loadStatus = thoughtsContainer.querySelector(
              ".loading-status-area",
            );
            if (loadStatus) loadStatus.remove();

            // 3. Para o Spinner do Header
            const spinner = thoughtsContainer.querySelector(
              ".summary-logo-spinner",
            );
            if (spinner) {
              spinner.classList.remove("summary-logo-spinner");
              spinner.classList.add("summary-logo-static");
              spinner.style.animation = "none";
              spinner.style.opacity = "1";
              spinner.style.width = "18px";
              spinner.style.height = "18px";
            }

            // 4. Atualiza Texto do Header
            const summaryText =
              thoughtsContainer.querySelector(".summary-text");
            if (summaryText) {
              summaryText.textContent = "Raciocínio concluído";
            }

            thoughtsContainer._cleaned = true;
          }
        }
      },

      // Callback para atualizações de status (Loading/System Messages)
      onProcessingStatus: (type, message) => {
        const loadingEl = document.getElementById("chatLoading");
        const messagesContainer = document.getElementById("chatMessages");

        if (type === "loading" && loadingEl) {
          // Atualiza texto do spinner
          const textEl = loadingEl.querySelector(".chat-loading-text");
          if (textEl) {
            textEl.innerHTML = `${message}<span class="loading-dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>`;
          }
        } else if (type === "system_msg" && messagesContainer) {
          // Insere mensagem de sistema (estilo Badge)
          const systemMsg = document.createElement("div");
          systemMsg.className = "chat-message chat-message--system visible";
          systemMsg.innerHTML = `
            <div class="chat-message-content">
                <span class="chat-mode-badge">
                    ${message}
                </span>
            </div>
          `;

          // Insere ANTES do loading se ele existir
          if (loadingEl) {
            messagesContainer.insertBefore(systemMsg, loadingEl);
          } else {
            messagesContainer.appendChild(systemMsg);
          }
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } else if (type === "memory_found" && messagesContainer) {
          // Nova implementação para Memória com Detalhes
          const { title, facts, summary } = message;

          const contentDiv = document.createElement("div");

          // Formata fatos
          const factsList = Array.isArray(facts)
            ? facts
                .map((f) => {
                  const similarity = f.score
                    ? ` <span style="opacity:0.6; font-size:0.8em">(${(f.score * 100).toFixed(0)}%)</span>`
                    : "";
                  return `<li style="margin-bottom:4px;">${f.conteudo || "Conteúdo indisponível"}${similarity}</li>`;
                })
                .join("")
            : "";

          contentDiv.innerHTML = `
            <div style="margin-bottom:12px;">
                <div style="font-weight:600; margin-bottom:4px; color:var(--color-text);">Resumo Contextual Gerado:</div>
                <div style="font-style:italic; background:var(--color-bg-tertiary); padding:8px; border-radius:6px;">"${summary || "Nenhum resumo gerado."}"</div>
            </div>
            ${
              factsList
                ? `
            <div>
                <div style="font-weight:600; margin-bottom:4px; color:var(--color-text);">Fatos Originais Recuperados (${facts.length}):</div>
                <ul style="padding-left:20px; margin-top:0;">${factsList}</ul>
            </div>`
                : ""
            }
          `;

          const statusEl = createExpandableStatusGlobal(title, contentDiv); // Usando global helper

          const systemMsg = document.createElement("div");
          systemMsg.className = "chat-message chat-message--system visible";

          const msgContent = document.createElement("div");
          msgContent.className = "chat-message-content";
          msgContent.style.padding = "0";
          msgContent.style.background = "transparent";
          msgContent.style.boxShadow = "none";
          msgContent.appendChild(statusEl);

          systemMsg.appendChild(msgContent);

          if (loadingEl) {
            messagesContainer.insertBefore(systemMsg, loadingEl);
          } else {
            messagesContainer.appendChild(systemMsg);
          }
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      },

      // Erro
      onError: (error) => {
        console.error("[Chat] Erro:", error);
        const loading = document.getElementById("chatLoading");
        if (loading) loading.remove();

        const errorMessage = document.createElement("div");
        errorMessage.className = "chat-message chat-message--error visible";

        let errorText = `Erro: ${error.message || error}`;
        let isRateLimit = false;

        if (
          error.message &&
          (error.message.includes("RATE_LIMIT_ERROR") ||
            error.message.includes("Too Many Requests") ||
            error.message.includes("429"))
        ) {
          isRateLimit = true;
          errorText = `
            <strong>⚠️ Sistema Sobrecarregado</strong><br>
            Nossos servidores de IA estão com alta demanda no momento.<br>
            <span style="font-size:0.9em; opacity:0.8; display:block; margin-top:5px;">Por favor, aguarde alguns instantes e tente novamente.</span>
          `;
        }

        errorMessage.innerHTML = `<div class="chat-message-content"><p>${errorText}</p></div>`;
        messagesContainer.appendChild(errorMessage);
      },
    });
  }
}

// === GLOBAL HELPERS (Move to module scope) ===

/**
 * Global Helper para criar status expansível (Estilo "Pensamento")
 * Disponível para loadChat e transicionarParaModoConversa
 */
export function createExpandableStatusGlobal(title, contentEl) {
  const container = document.createElement("div");
  container.className = "chat-thought-container"; // Reusa estilo do container de pensamento

  const header = document.createElement("div");
  header.className = "chat-thought-header";
  header.innerHTML = `
        <div class="summary-content-wrapper">
             <div class="summary-logo-static" style="width:18px; height:18px; opacity:1; display:flex; align-items:center; justify-content:center;">
                <!-- Ícone Check -->
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
             </div>
             <span class="summary-text">${title}</span>
        </div>
    `;

  const inner = document.createElement("div");
  inner.className = "chat-thoughts-inner";

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "maia-thought-content";
  contentWrapper.style.padding = "10px 16px 16px 16px";
  contentWrapper.style.fontSize = "0.9em";
  contentWrapper.style.lineHeight = "1.5";
  contentWrapper.style.color = "var(--color-text-secondary)";

  contentWrapper.appendChild(contentEl);
  inner.appendChild(contentWrapper);

  header.addEventListener("click", () => {
    container.classList.toggle("open");
  });

  container.appendChild(header);
  container.appendChild(inner);

  return container;
}

/**
 * Escapa HTML para prevenir XSS
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

export function iniciarFluxoPesquisa() {
  window.iniciarFluxoPesquisa();
}

export function iniciarFluxoUploadManual() {
  window.iniciarFluxoUploadManual();
}

export async function iniciarModoEstudante() {
  // Para rotação de sugestões ao sair da tela inicial
  stopSuggestionRotation();

  // 1. Limpa a tela
  document.body.innerHTML = "";

  // 2. Monta o HTML Principal
  const htmlFiltros = gerarHtmlPainelFiltros();
  const htmlModal = gerarHtmlModalScanOriginal();

  const htmlLayout = `
    <div class="bank-layout">
        ${htmlFiltros}

        <div id="bankStream" class="bank-stream"></div>

        <div id="sentinelaScroll" style="padding: 40px; text-align:center;">
            <div class="spinner" style="margin: 0 auto;"></div>
            <p style="color:var(--color-text-secondary); font-size:12px; margin-top:10px;">Carregando banco de dados...</p>
        </div>
    </div>
    ${htmlModal}
    `;

  // 3. Injeta no DOM
  document.body.innerHTML = htmlLayout;

  // 4. Carregamento Inicial de Dados
  await carregarBancoDados();

  // 5. Configura Scroll Infinito
  // 5. Configura Scroll Infinito
  configurarObserverScroll();

  // Persist Floating Terminal
  checkAndRestoreFloatingTerminal();
}

/**
 * 3. MODO REVISÃO DE QUESTÕES
 * Layout split-view com lista de questões e visualização lado a lado
 */
export async function iniciarModoRevisao() {
  // Para rotação de sugestões ao sair da tela inicial
  stopSuggestionRotation();

  // 1. Limpa a tela e reseta estados
  document.body.innerHTML = "";
  bancoState.ultimoKeyCarregada = null;
  bancoState.todasQuestoesCache = [];

  // 2. Monta o HTML do Layout de Revisão
  hasUnsavedChanges = false; // Reseta estado

  const htmlLayout = `
    <div class="review-layout">
        <!-- Header com voltar -->
        <div class="review-header">
            <button class="btn btn--sm btn--outline js-voltar-inicio" style="display: flex; align-items: center; gap: 8px;">
                ← Voltar
            </button>
            <h1 style="margin: 0; font-size: 1.5rem;">📝 Revisar Questões</h1>
        </div>

        <!-- Container Principal Split -->
        <div class="review-split">
            <!-- Painel Esquerdo: Lista de Questões -->
            <div class="review-list-panel">
                <div class="review-list-header">
                    <h3 style="margin: 0 0 10px 0;">Selecione uma questão</h3>
                    <input type="text" id="reviewSearchInput" placeholder="Buscar prova (ex: ENEM)..." 
                           style="width: 100%; padding: 8px; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-surface); color: var(--color-text);">
                </div>
                <div id="reviewList" class="review-list"></div>
                <div id="reviewSentinela" style="padding: 20px; text-align:center;">
                    <div class="spinner" style="margin: 0 auto;"></div>
                    <p style="color:var(--color-text-secondary); font-size:12px; margin-top:10px;">Carregando questões...</p>
                </div>
            </div>

            <!-- Painel Direito: Visualização -->
            <div class="review-detail-panel">
                <div id="reviewDetail" class="review-detail-content">
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--color-text-secondary);">
                        <div style="font-size: 60px; margin-bottom: 20px;">👈</div>
                        <p>Selecione uma questão na lista ao lado para visualizar</p>
                    </div>
                </div>
            </div>
            <!-- Elemento de fundo para fechar ao clicar fora (Mobile) -->
            <div class="review-backdrop" id="reviewBackdrop"></div>
        </div>
    </div>
  `;

  // 3. Injeta no DOM
  document.body.innerHTML = htmlLayout;

  // 4. Carrega questões para a lista (Modo Padrão)
  await carregarQuestoesRevisao();

  // 5. Configura Search e Scroll
  configurarBuscaRevisao();
  configurarScrollRevisao();

  // 6. Configura Comportamento Mobile (Resize & Backdrop)
  configurarComportamentoMobileRevisao();

  // Persist Floating Terminal
  checkAndRestoreFloatingTerminal();
}

function configuringMobileHeader(container) {
  // Se já existe, não recria
  if (container.querySelector(".review-mobile-header")) return;

  const header = document.createElement("div");
  header.className = "review-mobile-header mobile-only";
  header.innerHTML = `
        <div class="review-drag-handle"></div>
        <div class="review-mobile-title">Detalhes da Questão</div>
        <button class="review-close-btn" id="btnCloseReviewMobile">
            ×
        </button>
    `;

  // Inserir no topo
  container.insertBefore(header, container.firstChild);

  // Evento Fechar
  header
    .querySelector("#btnCloseReviewMobile")
    .addEventListener("click", fecharPainelMobile);

  // Swipe Down to Close (Simples)
  let startY = 0;
  header.addEventListener("touchstart", (e) => {
    startY = e.touches[0].clientY;
  });
  header.addEventListener("touchmove", (e) => {
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;
    if (deltaY > 50) {
      // Se arrastou 50px pra baixo
      fecharPainelMobile();
    }
  });
}

function fecharPainelMobile() {
  const panel = document.querySelector(".review-detail-panel");
  const backdrop = document.getElementById("reviewBackdrop");

  if (panel) panel.classList.remove("open");
  if (backdrop) {
    backdrop.classList.remove("visible");
    setTimeout(() => {
      backdrop.style.display = "none";
    }, 300);
  }
}

function abrirPainelMobile() {
  // Só abre se for mobile
  if (window.innerWidth > 900) return;

  const panel = document.querySelector(".review-detail-panel");
  const backdrop = document.getElementById("reviewBackdrop");

  // Garante que header existe
  if (panel) configuringMobileHeader(panel);

  if (panel) panel.classList.add("open");
  if (backdrop) {
    backdrop.style.display = "block";
    // Timeout para permitir transição de opacidade
    setTimeout(() => backdrop.classList.add("visible"), 10);
  }
}

function configurarComportamentoMobileRevisao() {
  // Listener de Resize
  window.addEventListener("resize", () => {
    // Se mudou para desktop e tem questão selecionada, garante layout resetado
    // O CSS media query já cuida da maioria, mas classes .open podem atrapalhar?
    // Na verdade .open no desktop não faz nada pois transform não é aplicado, mas é bom limpar.
    if (window.innerWidth > 900) {
      const panel = document.querySelector(".review-detail-panel");
      if (panel) panel.classList.remove("open");
    } else {
      // Se mudou para mobile e TEM questão selecionada (renderizada), abre o painel
      const conteudoRenderizado = document.getElementById(
        "reviewQuestaoContent",
      );
      // Se tem conteúdo (filhos), supomos que tem questão
      if (conteudoRenderizado && conteudoRenderizado.children.length > 0) {
        abrirPainelMobile();
      }
    }
  });

  // Backdrop Click
  const backdrop = document.getElementById("reviewBackdrop");
  if (backdrop) {
    backdrop.addEventListener("click", fecharPainelMobile);
  }
}

/**
 * Configura o listener de busca na revisão
 */
function configurarBuscaRevisao() {
  const searchInput = document.getElementById("reviewSearchInput");
  if (!searchInput) return;

  let debounceTimer;
  searchInput.addEventListener("input", (e) => {
    const term = e.target.value.trim();

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (term.length > 0) {
        // Modo Busca
        bancoState.modoPesquisa = true;
        bancoState.termoPesquisa = term;
        realizarBuscaRevisao(term);
      } else {
        // Voltar ao Modo Paginação Normal
        bancoState.modoPesquisa = false;
        bancoState.termoPesquisa = "";
        resetarListaRevisao();
        carregarQuestoesRevisao();
      }
    }, 500); // 500ms debounce
  });
}

function resetarListaRevisao() {
  bancoState.ultimoKeyCarregada = null;
  bancoState.todasQuestoesCache = [];
  bancoState.carregandoMais = false;
  document.getElementById("reviewList").innerHTML = "";
  document.getElementById("reviewSentinela").style.display = "block";
}

async function realizarBuscaRevisao(termo) {
  const listContainer = document.getElementById("reviewList");
  const sentinela = document.getElementById("reviewSentinela");

  listContainer.innerHTML = ""; // Limpa visualmente
  sentinela.style.display = "block"; // Mostra loading

  try {
    const { get, ref, query, orderByKey, startAt, endAt, limitToFirst } =
      await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js");
    const { db } = await import("../main.js");

    // Normalização "Smart Search":
    // O banco é Case-Sensitive. Buscamos variações comuns para tentar "adivinhar" o que o usuário quer.
    // 1. Exato (o que o usuário digitou) -> "eTec"
    // 2. Maiúsculo (comum para siglas) -> "ETEC"
    // 3. Capitalizado (comum para nomes) -> "Etec"
    // 4. Minúsculo (fallback) -> "etec"
    const variacoes = new Set();
    variacoes.add(termo); // 1. Exato
    variacoes.add(termo.toUpperCase()); // 2. UPPERCASE
    variacoes.add(termo.toLowerCase()); // 4. Lowercase
    if (termo.length > 0) {
      variacoes.add(
        termo.charAt(0).toUpperCase() + termo.slice(1).toLowerCase(),
      ); // 3. Capitalized
    }

    const dbRef = ref(db, "questoes");

    // Cria array de Promises (buscas paralelas)
    const promessasBusca = Array.from(variacoes).map(async (termoBusca) => {
      const consulta = query(
        dbRef,
        orderByKey(),
        startAt(termoBusca),
        endAt(termoBusca + "\uf8ff"),
        limitToFirst(20), // Limite menor por variação para não sobrecarregar
      );
      return get(consulta);
    });

    // Executa todas
    const snapshots = await Promise.all(promessasBusca);

    // Agrega resultados (Map para remover duplicatas por Chave de Prova)
    const resultadosUnicos = new Map();

    snapshots.forEach((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        Object.entries(data).forEach(([key, value]) => {
          resultadosUnicos.set(key, value);
        });
      }
    });

    sentinela.style.display = "none"; // Esconde loading

    if (resultadosUnicos.size > 0) {
      // Converte de volta para array e ordena alfabeticamente
      const listaProvas = Array.from(resultadosUnicos.entries()).sort((a, b) =>
        a[0].localeCompare(b[0]),
      );

      listaProvas.forEach(([nomeProva, mapQuestoes]) => {
        if (mapQuestoes && typeof mapQuestoes === "object") {
          Object.entries(mapQuestoes).forEach(([idQuestao, fullData]) => {
            if (!fullData.dados_questao) return;
            fullData._firebaseId = idQuestao;
            fullData._chaveProva = nomeProva;

            const item = criarItemListaRevisao(idQuestao, fullData, nomeProva);
            listContainer.appendChild(item);
          });
        }
      });
    } else {
      listContainer.innerHTML = `<p style="padding:20px; text-align:center; color:gray;">Nenhum resultado encontrado para "${termo}" (e variações).</p>`;
    }
  } catch (e) {
    console.error("Erro na busca:", e);
    sentinela.style.display = "none";
    listContainer.innerHTML = `<p style="padding:20px; color:red;">Erro ao buscar: ${e.message}</p>`;
  }
}

/**
 * Carrega questões para o painel de revisão
 */
async function carregarQuestoesRevisao() {
  if (bancoState.carregandoMais) return;
  // Se estiver em modo pesquisa, o scroll não deve carregar paginação normal
  if (bancoState.modoPesquisa) return;

  bancoState.carregandoMais = true;

  try {
    const { get, ref, query, orderByKey, limitToLast, endBefore } =
      await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js");
    const { db, TAMANHO_PAGINA } = await import("../main.js");

    const dbRef = ref(db, "questoes");
    let consulta;

    if (!bancoState.ultimoKeyCarregada) {
      consulta = query(dbRef, orderByKey(), limitToLast(TAMANHO_PAGINA));
    } else {
      consulta = query(
        dbRef,
        orderByKey(),
        endBefore(bancoState.ultimoKeyCarregada),
        limitToLast(TAMANHO_PAGINA),
      );
    }

    const snapshot = await get(consulta);

    if (snapshot.exists()) {
      const data = snapshot.val();
      const listaProvas = Object.entries(data).reverse();
      const novoCursor = listaProvas[listaProvas.length - 1][0];
      bancoState.ultimoKeyCarregada = novoCursor;

      const container = document.getElementById("reviewList");

      listaProvas.forEach(([nomeProva, mapQuestoes]) => {
        if (mapQuestoes && typeof mapQuestoes === "object") {
          Object.entries(mapQuestoes).forEach(([idQuestao, fullData]) => {
            if (!fullData.dados_questao) return;

            // Injeta o ID do Firebase no fullData para uso posterior
            fullData._firebaseId = idQuestao;
            fullData._chaveProva = nomeProva;

            // Adiciona ao cache
            bancoState.todasQuestoesCache.push({ key: idQuestao, ...fullData });

            // Cria item na lista
            const item = criarItemListaRevisao(idQuestao, fullData, nomeProva);
            container.appendChild(item);
          });
        }
      });
    } else {
      // Fim dos dados
      const sentinela = document.getElementById("reviewSentinela");
      if (sentinela) {
        sentinela.innerHTML =
          '<p style="color:var(--color-text-secondary);">Fim das questões.</p>';
      }
    }
  } catch (e) {
    console.error("Erro ao carregar questões para revisão:", e);
    const sentinela = document.getElementById("reviewSentinela");
    if (sentinela) {
      sentinela.innerHTML = `<p style="color:var(--color-error);">Erro: ${e.message}</p>`;
    }
  } finally {
    bancoState.carregandoMais = false;
  }
}

// Variável de controle estadual (Singleton do módulo)
let hasUnsavedChanges = false;

/**
 * Verifica se há alterações não salvas e pede confirmação
 * Exportada para ser usada no main.js (botão Voltar)
 */
export async function confirmExitingReview() {
  if (hasUnsavedChanges) {
    const confirmed = await showConfirmModal(
      "Alterações não salvas",
      "Você tem revisões marcadas que não foram enviadas. Tem certeza que deseja sair? As alterações serão perdidas.",
      "Sair sem salvar",
      "Cancelar",
      false, // Warning color
    );
    return confirmed;
  }
  return true;
}

/**
 * Cria um item da lista de questões para seleção
 */
function criarItemListaRevisao(id, fullData, nomeProva) {
  const q = fullData.dados_questao || {};
  const meta = fullData.meta || {};
  const identificacao = q.identificacao || id;
  const origem = meta.material_origem || nomeProva.replace(/_/g, " ");
  const materias = (q.materias_possiveis || []).slice(0, 2).join(", ");

  const item = document.createElement("div");
  item.className = "review-item";
  item.dataset.id = id;
  item.innerHTML = `
    <div class="review-item-id">${identificacao}</div>
    <div class="review-item-origem">${origem}</div>
    ${materias ? `<div class="review-item-materias">${materias}</div>` : ""}
  `;

  // Click handler
  item.addEventListener("click", async () => {
    // Verifica se já está selecionado
    if (item.classList.contains("selected")) return;

    // Checks for unsaved changes before switching
    if (hasUnsavedChanges) {
      const confirmed = await showConfirmModal(
        "Alterações não salvas",
        "Você tem revisões marcadas que não foram enviadas. Tem certeza que deseja trocar de questão? As alterações serão perdidas.",
        "Trocar sem salvar",
        "Cancelar",
        false, // Warning color
      );
      if (!confirmed) return;
    }

    // Reset unsaved variable as we are discarding or it was clean
    hasUnsavedChanges = false;

    // Remove seleção anterior
    document.querySelectorAll(".review-item.selected").forEach((el) => {
      el.classList.remove("selected");
    });
    // Marca como selecionado
    item.classList.add("selected");
    // Renderiza a questão
    await renderizarQuestaoRevisao(fullData);

    // [MOBILE] Abre o painel inferior
    abrirPainelMobile();
  });

  return item;
}

/**
 * Renderiza a questão selecionada no painel de detalhes
 * Painel esquerdo: Questão + Gabarito (readonly)
 * Painel direito: Imagens originais do scan
 */
/**
 * Renderiza a questão selecionada no painel de detalhes
 * Painel esquerdo: Questão + Gabarito (readonly)
 * Painel direito: Imagens originais do scan
 */
async function renderizarQuestaoRevisao(fullData) {
  const container = document.getElementById("reviewDetail");
  if (!container) return;

  const q = fullData.dados_questao || {};
  const g = fullData.dados_gabarito || {};

  // Garante que identificacao tenha um valor (usa ID do Firebase como fallback)
  if (!q.identificacao && fullData._firebaseId) {
    q.identificacao = fullData._firebaseId;
  }

  // Caminho da questão no Firebase (usa _firebaseId que injetamos)
  const questaoPath =
    fullData._chaveProva && fullData._firebaseId
      ? `${fullData._chaveProva}/${fullData._firebaseId}`
      : fullData._firebaseId || "unknown";

  // --- [NOVO] VERIFICAÇÃO DE REVISÃO ANTERIOR ---
  container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--color-text-secondary);">
          <div class="spinner"></div>
          <p style="margin-top: 10px;">Verificando status...</p>
      </div>`;

  try {
    const { verificarJaRevisou, registrarRevisaoUsuario } =
      await import("../review/review-save.js");
    const jaRevisou = await verificarJaRevisou(questaoPath);

    if (jaRevisou) {
      renderSuccessState(container);
      return;
    }

    // Se não revisou, prossegue com renderização normal...

    // Importa os módulos necessários
    const { mountQuestaoTabs } = await import("../render/questao-tabs.js");
    const { ensureLibsLoaded, renderLatexIn } =
      await import("../libs/loader.tsx");

    await ensureLibsLoaded();

    // Limpa o container
    container.innerHTML = "";

    // Cria o layout lado a lado
    const splitView = document.createElement("div");
    splitView.className = "review-side-by-side";
    splitView.innerHTML = `
      <div class="review-questao-panel">
        <h3 style="margin: 0 0 15px 0; color: var(--color-primary);">📄 Questão/Gabarito</h3>
        <div id="reviewQuestaoContent"></div>
      </div>
      <div class="review-gabarito-panel">
        <h3 style="margin: 0 0 15px 0; color: var(--color-success);">🖼️ Questão Original</h3>
        <div id="reviewOriginaisContent"></div>
      </div>
    `;

    container.appendChild(splitView);

    // === PAINEL ESQUERDO: Questão + Gabarito (modo revisão com botões ✅❌) ===
    const questaoContainer = document.getElementById("reviewQuestaoContent");

    // Handler para quando o usuário envia a revisão
    const handleReviewSubmit = async (reviewData) => {
      // Confirmação com usuário
      const confirmed = await showConfirmModal(
        "Confirmar Revisão",
        "Confirmar o envio da sua revisão? Você não poderá alterar sua avaliação depois.",
        "Confirmar Envio",
        "Cancelar",
        true, // POSITIVE ACTION (Blue/Green)
      );

      if (!confirmed) return;

      try {
        const { enviarTodasRevisoes } =
          await import("../review/review-save.js");

        await enviarTodasRevisoes(questaoPath, reviewData);
        await registrarRevisaoUsuario(questaoPath);

        // Reset dirty state on success
        hasUnsavedChanges = false;

        // Feedback visual imediato e bloqueio
        renderSuccessState(container);
        customAlert("✅ Revisão enviada com sucesso!");
      } catch (error) {
        console.error("[Revisão] Erro detalhado:", error);

        let msg = "❌ Erro ao enviar revisão: " + error.message;

        // Tratamento específico para erro de permissão comum
        if (error.message && error.message.includes("PERMISSION_DENIED")) {
          msg =
            "⛔ PERMISSÃO NEGADA pelo Firebase.\n\n" +
            "O banco de dados recusou a gravação. Verifique:\n" +
            "1. Se as regras (Rules) do Realtime Database permitem escrita em '/revisoes'.\n" +
            "2. Se a Autenticação Anônima está ativada no console do Firebase.\n" +
            "3. Se o ID da questão contém caracteres inválidos.";
        }

        customAlert(msg);
      }
    };

    // Monta os tabs de questão em modo revisão
    mountQuestaoTabs(questaoContainer, q, g, {
      isReadOnly: true,
      isReviewMode: true,
      onReviewSubmit: handleReviewSubmit,
      onReviewChange: (isDirty) => {
        hasUnsavedChanges = isDirty;
      },
    });

    // Renderiza LaTeX
    renderLatexIn(questaoContainer);

    // === PAINEL DIREITO: Imagens Originais do Scan ===
    const originaisContainer = document.getElementById(
      "reviewOriginaisContent",
    );
    await renderizarImagensOriginais(originaisContainer, q);
  } catch (e) {
    console.error("Erro ao inicializar revisão:", e);
    container.innerHTML = `<p style="color:red">Erro ao carregar revisão: ${e.message}</p>`;
  }
}

/**
 * Renderiza a tela de sucesso ("Já revisado")
 */
function renderSuccessState(container) {
  container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--color-success); text-align: center; padding: 40px; animation: fadeIn 0.5s ease;">
          <div style="font-size: 80px; margin-bottom: 20px;">🎉</div>
          <h2 style="margin-bottom: 15px;">Opa... você já revisou essa questão!</h2>
          <p style="color: var(--color-text-secondary); font-size: 1.1rem; max-width: 400px;">
              Sua contribuição já foi registrada. Continue assim e ajude a melhorar nosso banco!
          </p>
          <div style="margin-top: 30px; font-size: 40px; opacity: 0.2;">🚀</div>
      </div>
  `;
}

/**
 * Renderiza as imagens originais da questão (fotos_originais)
 */
async function renderizarImagensOriginais(container, questao) {
  // Busca as fotos originais do banco
  const fotosOriginais = questao.fotos_originais || [];

  if (fotosOriginais.length === 0) {
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; 
                  padding: 40px; color: var(--color-text-secondary); text-align: center;">
        <div style="font-size: 40px; margin-bottom: 15px; opacity: 0.5;">📷</div>
        <p style="margin: 0;">Nenhuma imagem original disponível para esta questão.</p>
      </div>
    `;
    return;
  }

  // Importa o React e o PdfEmbedRenderer para renderizar as imagens
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { PdfEmbedRenderer } = await import("../ui/PdfEmbedRenderer.tsx");

  // Cria elemento para React
  const reactContainer = document.createElement("div");
  reactContainer.className = "review-originais-list";
  container.appendChild(reactContainer);

  // Cria componente para renderizar as imagens
  const ImagensOriginais = () => {
    return React.createElement(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "15px" } },
      fotosOriginais.map((item, index) => {
        // Se for string (legado), renderiza img normal
        if (typeof item === "string") {
          if (item === "filled") {
            return React.createElement(
              "div",
              { key: index, style: { color: "gray", padding: "10px" } },
              "Imagem sem dados de visualização",
            );
          }
          return React.createElement("img", {
            key: index,
            src: item,
            className: "img-content",
            alt: `Imagem ${index + 1}`,
            style: { maxWidth: "100%", borderRadius: "8px" },
          });
        }

        // Se for objeto (novo sistema PDF), usa o PdfEmbedRenderer
        if (typeof item === "object" && item !== null) {
          return React.createElement(PdfEmbedRenderer, {
            key: index,
            pdfUrl: item.pdf_url,
            pdf_page: item.pdf_page,
            pdf_zoom: item.pdf_zoom,
            pdf_left: item.pdf_left,
            pdf_top: item.pdf_top,
            pdf_width: item.pdf_width,
            pdf_height: item.pdf_height,
            pdfjs_source_w: item.pdfjs_source_w,
            pdfjs_source_h: item.pdfjs_source_h,
            pdfjs_x: item.pdfjs_x,
            pdfjs_y: item.pdfjs_y,
            pdfjs_crop_w: item.pdfjs_crop_w,
            pdfjs_crop_h: item.pdfjs_crop_h,
            scaleToFit: true,
            readOnly: true,
          });
        }

        return null;
      }),
    );
  };

  // Renderiza o componente React
  const root = createRoot(reactContainer);
  root.render(React.createElement(ImagensOriginais));
}

/**
 * Configura scroll infinito para a lista de revisão
 */
function configurarScrollRevisao() {
  const sentinela = document.getElementById("reviewSentinela");
  if (!sentinela) return;

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        carregarQuestoesRevisao();
      }
    },
    { rootMargin: "100px" },
  );

  observer.observe(sentinela);
}

// === SCAFFOLDING HYDRATION LOGIC ===

/**
 * Hidrata os blocos de Scaffolding transformando em Slides Interativos
 * @param {HTMLElement} container - Container onde buscar os placeholders
 */
export function hydrateScaffoldingBlocks(container) {
  const placeholders = container.querySelectorAll(
    ".chat-scaffolding-placeholder:not(.hydrated)",
  );

  placeholders.forEach((placeholder) => {
    placeholder.classList.add("hydrated");

    // 1. Extração de Dados Iniciais
    const contentRaw = placeholder.getAttribute("data-content");
    const propsRaw = placeholder.getAttribute("data-props");
    let props = {};
    try {
      props = JSON.parse(propsRaw);
    } catch (e) {
      console.warn("Erro ao parsear props do scaffolding:", e);
    }

    // 2. Setup do Container de Slides
    // Criamos uma estrutura que suporta múltiplos passos visíveis um de cada vez
    placeholder.innerHTML = `
        <div class="scaffolding-container">
            <div class="scaffolding-slides-wrapper">
                <!-- Os slides são gerados dinamicamente via JS (initializeScaffoldingComponent) -->
            </div>
            <div class="scaffolding-controls">
                <!-- Area de status ou paginação se necessário -->
            </div>
        </div>
    `;

    // 3. Inicializa Lógica do Componente
    // Passamos o historico inicial como vazio ou inferido
    initializeScaffoldingComponent(placeholder, {
      question: contentRaw, // A "pergunta" inicial
      enunciado: contentRaw, // [FIX] Garante que o campo novo também tenha valor
      msgIndex: parseInt(
        placeholder.closest(".chat-message")?.dataset.msgIndex,
      ), // [PERSISTENCE]
      chatId: window.currentChatId, // [PERSISTENCE]
      ...props,
    });
  });
}

/**
 * HTML Template para um Slide de Scaffolding
 */
function renderScaffoldingSlideContent(pergunta, props, stepNumber) {
  const isFinished = props.status === "concluido";

  if (isFinished) {
    return `
            <div class="passo passo-finished-slide">
                <div class="passoText">
                    <h2><span style="font-size:0.8em; opacity:0.7">Treinamento Concluído!</span></h2>
                    <p style="font-size: 1.1em; font-weight: 500;">Você finalizou a etapa de preparação.</p>
                </div>
                <!-- Final Explanation / Adaptive Reasoning -->
                <div class="passoContext" style="margin-top: 20px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 8px; border-left: 3px solid var(--color-success);">
                     <h3 style="margin-top:0; font-size:1em; color:var(--color-success);">🎯 Resumo & Explicação Final</h3>
                     <p>${props.explicacao || props.raciocinio_adaptativo || "Agora você está pronto para responder a questão principal."}</p>
                </div>
                <div class="passoButton" style="display: flex; gap: 12px; flex-wrap: wrap;">
                     <button class="guessButton backPassoButton" style="flex: 1; min-width: 140px; background: transparent; border: 1px solid var(--color-border);">← Ver Passos Anteriores</button>
                     <button class="guessButton finishButton" style="flex: 2; min-width: 180px;">Ir para Questão Principal 🚀</button>
                </div>
            </div>
        `;
  }

  // Previne "undefined" usando fallback seguro
  const textoEnunciado =
    pergunta || props.enunciado || props.conteudo || "Carregando pergunta...";

  return `
        <div class="passo" id="scaffolding-step-${stepNumber}">
            <div class="passoText">
                <h2><span style="font-size:0.8em; opacity:0.7">Passo ${stepNumber}</span></h2>
                <p style="font-size: 1.1em; font-weight: 500;">${textoEnunciado}</p>
            </div>
            


            <div class="explicacao" style="display:none;">
                <div class="explicacao-content">
                    <h3 class="result-header"></h3>
                    
                    ${
                      props.raciocinio_adaptativo
                        ? `
                    <div class="passoContext" style="margin-bottom: 12px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 6px;">
                        <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom: 4px;">
                            <span style="font-size:0.85em; font-weight:600; color:var(--color-primary);">RACIOCÍNIO ADAPTATIVO:</span>
                        </div>
                        <span style="font-size:0.9em; opacity:0.9; font-style: italic;">${props.raciocinio_adaptativo}</span>
                    </div>`
                        : ""
                    }


                    <p class="explanation-text">${props.explicacao || props.feedback_v || "Veja a dica abaixo."}</p>
                    
                    <!-- Stats for Nerds (Hidden by default until revealed) -->
                    <div class="scaffolding-stats-container" style="margin-top:16px; padding-top:16px; border-top:1px dashed var(--color-border); font-size:0.85em; color:var(--color-text-secondary);">
                         <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                            <span>🎯 Precisão do Passo: <strong class="stat-score">${props.resultadoPasso ? (props.resultadoPasso * 100).toFixed(0) + "%" : "-"}</strong></span>
                            <span>🧠 Confiança: <strong class="stat-confidence">${props.taxaDeCerteza ? (props.taxaDeCerteza * 100).toFixed(0) + "%" : "-"}</strong></span>
                         </div>
                         <div style="display:flex; justify-content:space-between;">
                            <span>⏱️ Tempo: <strong class="stat-time">${props.tempoGasto ? props.tempoGasto + "s" : "-"}</strong></span>
                            <span>📈 Proficiência: <strong class="stat-proficiency">${props.proficiencia ? (props.proficiencia * 100).toFixed(0) + "%" : "-"}</strong></span>
                         </div>
                    </div>
                </div>
            </div>

            <div class="input input-area-wrapper">
                <div class="inputArea">
                    <label class="falseLabel">❌</label>
                    <input type="range" min="0" max="100" value="50" class="guessRange" />
                    <label class="trueLabel">✅</label>
                </div>
                <div style="text-align: center; margin-top: 5px; font-size: 0.8em; color: var(--color-text-secondary);">
                    <span class="range-value-label">Estou indeciso (50%)</span>
                </div>
            </div>

            <div class="passoButton">
                ${stepNumber > 1 ? `<button class="backPassoButton" style="background:transparent; border:1px solid var(--color-border); color:var(--color-text);">↩ Voltar</button>` : ""}
                <button class="nextPassoButton" style="display:none; background:transparent; border:1px solid var(--color-border); color:var(--color-text); margin-right: 8px;">Avançar ↪</button>
                
                ${
                  props.dica
                    ? `<button class="hintPassoButton" style="background:transparent; border:1px solid var(--color-warning); color:var(--color-warning); margin-right: 8px;">💡 Dica</button>`
                    : ""
                }

                <button class="newPassoButton">Não sei</button>
                <button class="guessButton submit-step-btn">Confirmar</button>
            </div>
            
            ${
              props.dica
                ? `<div class="dica-container" style="display:none; margin-top: 15px; padding: 10px; background: rgba(255, 193, 7, 0.1); border-left: 3px solid var(--color-warning); color: var(--color-text-secondary); font-size: 0.9em;">
                     <strong>💡 Dica:</strong> ${props.dica}
                   </div>`
                : ""
            }
        </div>
    `;
}

/**
 * Lógica Central do Componente de Scaffolding (State Machine)
 */
async function initializeScaffoldingComponent(containerElement, initialProps) {
  const slidesWrapper = containerElement.querySelector(
    ".scaffolding-slides-wrapper",
  );

  // [PERSISTENCE] Restore State
  const savedState = initialProps.savedState || {};
  let currentStepIndex = savedState.currentStepIndex || 1;
  let stepHistory = savedState.stepHistory || []; // { contexto: {pergunta, explicacao}, stats: {acertou, proficiencia...} }
  let accumulatedStats = savedState.accumulatedStats || []; // Para cálculo de médias

  // [PERSISTENCE] Helper to Save State
  const saveState = async () => {
    if (
      !initialProps.chatId ||
      initialProps.msgIndex === undefined ||
      isNaN(initialProps.msgIndex)
    )
      return;

    try {
      const { ChatStorageService } =
        await import("../services/chat-storage.js");
      const chat = await ChatStorageService.getChat(initialProps.chatId);

      if (chat && chat.messages && chat.messages[initialProps.msgIndex]) {
        let msgContent = chat.messages[initialProps.msgIndex].content;

        // Traverse to find scaffolding block
        let scaffoldingBlock = null;

        // 1. Check Root (Legacy/Simple)
        if (msgContent.tipo === "scaffolding") {
          scaffoldingBlock = msgContent;
        }
        // 2. Check Sections (New Schema)
        else if (msgContent.sections && Array.isArray(msgContent.sections)) {
          for (const section of msgContent.sections) {
            // Check direct content
            if (section.conteudo && Array.isArray(section.conteudo)) {
              const found = section.conteudo.find(
                (b) => b.tipo === "scaffolding",
              );
              if (found) {
                scaffoldingBlock = found;
                break;
              }
            }
            // Check slots
            if (section.slots) {
              for (const key in section.slots) {
                const found = section.slots[key]?.find(
                  (b) => b.tipo === "scaffolding",
                );
                if (found) {
                  scaffoldingBlock = found;
                  break;
                }
              }
            }
            if (scaffoldingBlock) break;
          }
        }

        if (scaffoldingBlock) {
          // Update local state directly on the block
          scaffoldingBlock.savedState = {
            currentStepIndex,
            stepHistory,
            accumulatedStats,
            htmlSnapshots,
            currentStepProps: initialProps,
          };

          chat.updatedAt = Date.now();
          await ChatStorageService.saveChat(chat);
          console.log("[Scaffolding] Estado salvo:", currentStepIndex);
        }
      }
    } catch (e) {
      console.error("[Scaffolding] Erro ao salvar estado:", e);
    }
  };

  // [PERSISTENCE] Reconstruct Slides from History (if any)
  // Step 1 is already in HTML. We check for steps 2..N
  if (stepHistory.length > 0) {
    // Hide Step 1 if we are ahead
    if (currentStepIndex > 1) {
      const slide1 = slidesWrapper.querySelector(
        '.scaffolding-slide[data-step="1"]',
      );
      if (slide1) {
        slide1.classList.remove("active-slide");
        slide1.style.display = "none";
      }
    }

    // (Reconstrução substituída pelo uso de slidesData abaixo)
  }

  // Initialize `slidesData` with Step 1
  let slidesData = [
    {
      step: 1,
      content:
        initialProps.enunciado ||
        initialProps.question ||
        initialProps.conteudo ||
        "Conteúdo indisponível",
      props: initialProps,
    },
  ];

  // Initialize `htmlSnapshots` from saved state
  let htmlSnapshots = savedState.htmlSnapshots || [];

  // Flag global: Se o scaffolding foi concluído (último step tem status: "concluido")
  // Quando true, bloqueia interação em todos passos e mostra tela final
  let isScaffoldingCompleted = false;

  // Use saved props for current step if available
  if (savedState.currentStepProps) {
    initialProps = savedState.currentStepProps;
  }

  // [SEMPRE] Verificar scaffoldingSteps para detectar status "concluido" e reconstruir estado
  // Precisa rodar SEMPRE que há chatId, não apenas quando stepHistory está vazio
  if (initialProps.chatId) {
    console.log(
      "[Scaffolding] Verificando scaffoldingSteps do chat:",
      initialProps.chatId,
    );

    try {
      const { ChatStorageService } =
        await import("../services/chat-storage.js");
      const savedSteps = await ChatStorageService.getScaffoldingSteps(
        initialProps.chatId,
      );

      if (savedSteps && savedSteps.length > 0) {
        console.log(
          `[Scaffolding] Encontrados ${savedSteps.length} passos no array scaffoldingSteps`,
        );

        // Verificar se o último passo salvo é de finalização (PRIMEIRO)
        const lastSavedStep = savedSteps[savedSteps.length - 1];
        const isLastStepFinalization = lastSavedStep?.status === "concluido";

        console.log(
          `[Scaffolding] Último passo status: "${lastSavedStep?.status}", isFinalization: ${isLastStepFinalization}`,
        );

        if (isLastStepFinalization) {
          // SCAFFOLDING CONCLUÍDO - Bloqueia tudo e mostra tela final
          isScaffoldingCompleted = true;
          currentStepIndex = savedSteps.length;

          console.log(
            "[Scaffolding] ✅ SCAFFOLDING CONCLUÍDO - Mostrando tela final",
          );
        }

        // Só reconstruir stepHistory e slidesData se estiverem vazios
        if (stepHistory.length === 0) {
          console.log(
            "[Scaffolding] Reconstruindo stepHistory e slidesData...",
          );

          let lastAnsweredIndex = -1;
          let hasNextStepPending = false;

          savedSteps.forEach((stepData, index) => {
            if (!stepData) return; // Skip gaps

            const stepNum = index + 1;

            // Reconstruir stepHistory
            if (stepData.resultado) {
              stepHistory.push(stepData.resultado);
              lastAnsweredIndex = index;
            } else if (stepData.status !== "concluido") {
              // Há um passo não respondido (ignora o de finalização)
              hasNextStepPending = true;
            }

            // Reconstruir slidesData
            const existing = slidesData.find((s) => s.step === stepNum);
            if (existing) {
              existing.props = { ...existing.props, ...stepData };
              existing.content =
                stepData.enunciado || stepData.pergunta || stepData.conteudo;
            } else {
              slidesData.push({
                step: stepNum,
                content:
                  stepData.enunciado || stepData.pergunta || stepData.conteudo,
                props: stepData,
              });
            }
          });

          // Definir currentStepIndex:
          // - Se há próximo passo não respondido, mostrar ele
          // - Se o último passo é de FINALIZAÇÃO (status: concluido), mostrar ele
          // - Senão, mostrar o último passo respondido (permitir ver resultado ou re-responder)

          // Verificar se o último passo salvo é de finalização
          const lastSavedStep = savedSteps[savedSteps.length - 1];
          const isLastStepFinalization = lastSavedStep?.status === "concluido";

          if (isLastStepFinalization) {
            // SCAFFOLDING CONCLUÍDO - Bloqueia tudo e mostra tela final
            isScaffoldingCompleted = true;
            currentStepIndex = savedSteps.length;
            // O passo de finalização é adicionado ao slidesData mais abaixo
          }
        }

        // [IMPORTANTE] Adicionar passo de finalização ao slidesData - FORA do bloco stepHistory
        // Isso garante que o passo de finalização esteja disponível mesmo quando há savedState
        if (isScaffoldingCompleted && lastSavedStep) {
          const existingFinal = slidesData.find(
            (s) => s.props?.status === "concluido",
          );
          if (!existingFinal) {
            console.log(
              "[Scaffolding] Adicionando passo de finalização ao slidesData",
            );
            slidesData.push({
              step: savedSteps.length,
              content: lastSavedStep.enunciado || "Treinamento Concluído",
              props: lastSavedStep,
            });
          }
        }

        console.log(
          `[Scaffolding] currentStepIndex: ${currentStepIndex}, isCompleted: ${isScaffoldingCompleted}, slidesData.length: ${slidesData.length}`,
        );
      }
    } catch (e) {
      console.warn("[Scaffolding] Erro ao recuperar scaffoldingSteps:", e);
    }
  }

  // [MIGRATION] If snapshots are missing but history exists, generate them (Fix for Old Chats)
  if (htmlSnapshots.length === 0 && stepHistory.length > 0) {
    console.log("[Scaffolding] Migrando histórico para Snapshots HTML...");

    stepHistory.forEach((item, index) => {
      // Create a props object for the static render
      const staticProps = {
        enunciado: item.contexto?.pergunta,
        explicacao: item.contexto?.explicacao,
        raciocinio_adaptativo: item.contexto?.raciocinio,
        status: "respondido", // Internal status for visual logic
        didSucceed: item.stats?.acertou,
        resposta_correta: item.stats?.acertou === true ? "Verdadeiro" : "Falso", // Approximate if missing
        ...item.stats,
      };

      const stepNum = index + 1;
      const content = item.contexto?.pergunta || "Questão recuperada";
      const existing = slidesData.find((s) => s.step === stepNum);
      if (existing) {
        existing.content = content;
        existing.props = { ...existing.props, ...staticProps };
      } else {
        slidesData.push({
          step: stepNum,
          content: content,
          props: { ...staticProps, question: content },
        });
      }

      const html = renderScaffoldingSlideContent(
        staticProps.enunciado,
        staticProps,
        index + 1,
      );

      // We need to inject the "Answered State" into this HTML string because renderScaffoldingSlideContent
      // returns the "Clean" state.
      // Easiest way: Render it, then manipulate a temporary DOM to apply the "Answered" look, then save HTML.
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;

      // Obter dados completos do passo salvo (se disponível via scaffoldingSteps)
      const fullStepData =
        slidesData.find((s) => s.step === index + 1)?.props || {};
      const savedUserAnswer = fullStepData.userAnswer ?? item.userAnswer ?? 50;
      const savedStats = fullStepData.resultado?.stats || item.stats || {};

      // Apply "Answered" transformations directly to DOM
      const guessRange = tempDiv.querySelector(".guessRange");
      const submitBtn = tempDiv.querySelector(".submit-step-btn");
      const unknownBtn = tempDiv.querySelector(".newPassoButton");
      const hintBtn = tempDiv.querySelector(".hintPassoButton");
      const explanationDiv = tempDiv.querySelector(".explicacao");
      const resultHeader = tempDiv.querySelector(".result-header");
      const dicaContainer = tempDiv.querySelector(".dica-container");
      const inputWrapper = tempDiv.querySelector(".input-area-wrapper");
      const backBtn = tempDiv.querySelector(".backPassoButton");
      const nextBtn = tempDiv.querySelector(".nextPassoButton");

      // 1. Restaurar valor do range e desabilitar
      if (guessRange) {
        guessRange.setAttribute("disabled", "true");
        guessRange.value = savedUserAnswer !== -1 ? savedUserAnswer : 50;

        // Atualizar visuals do range baseado no valor
        const valueLabel = tempDiv.querySelector(".range-value-label");
        if (valueLabel) {
          const val = parseInt(savedUserAnswer);
          if (val === -1 || val === 50) {
            valueLabel.innerText = "Não sei";
          } else if (val < 40) {
            valueLabel.innerText = `FALSO (${100 - val}% certeza)`;
          } else if (val > 60) {
            valueLabel.innerText = `VERDADEIRO (${val}% certeza)`;
          } else {
            valueLabel.innerText = "Indeciso";
          }
        }
      }

      // 2. Ocultar botões de interação (só deixa voltar/avançar)
      if (submitBtn) {
        submitBtn.style.display = "none";
        submitBtn.innerText = "Confirmar"; // Reset para evitar "Processando..."
      }
      if (unknownBtn) unknownBtn.style.display = "none";
      if (hintBtn) hintBtn.style.display = "none";
      if (dicaContainer) dicaContainer.style.display = "none";
      if (inputWrapper) inputWrapper.style.opacity = "0.6";

      // 3. Mostrar botão de voltar (exceto no step 1)
      if (backBtn) {
        backBtn.style.display = index > 0 ? "inline-block" : "none";
      }

      // 4. Mostrar botão de avançar (se há próximo passo OU tela de finalização)
      if (nextBtn) {
        // Se scaffolding concluído, o último passo de história pode avançar para a tela final
        const canAdvance =
          index < stepHistory.length - 1 ||
          (isScaffoldingCompleted && index === stepHistory.length - 1);
        nextBtn.style.display = canAdvance ? "inline-block" : "none";
      }

      // 5. Mostrar explicação e resultado
      const acertou = savedStats.acertou ?? item.stats?.acertou;
      if (explanationDiv) {
        explanationDiv.style.display = "block";
        if (resultHeader) {
          resultHeader.innerHTML = acertou
            ? `<span style="color:var(--color-success)">✓ Correto!</span>`
            : `<span style="color:var(--color-error)">✗ Incorreto</span>`;
        }
        // Explanation text
        const explText = tempDiv.querySelector(".explanation-text");
        if (explText && item.contexto?.explicacao)
          explText.innerHTML = item.contexto.explicacao;
      }

      // 6. Atualizar stats no display
      const statScoreEl = tempDiv.querySelector(".stat-score");
      const statConfEl = tempDiv.querySelector(".stat-confidence");
      const statTimeEl = tempDiv.querySelector(".stat-time");
      const statProfEl = tempDiv.querySelector(".stat-proficiency");

      if (statScoreEl && savedStats.resultadoPasso !== undefined)
        statScoreEl.innerText = `${(savedStats.resultadoPasso * 100).toFixed(0)}%`;
      if (statConfEl && savedStats.taxaDeCerteza !== undefined)
        statConfEl.innerText = `${(savedStats.taxaDeCerteza * 100).toFixed(0)}%`;
      if (statTimeEl && savedStats.tempoGasto !== undefined)
        statTimeEl.innerText = `${savedStats.tempoGasto}s`;
      if (statProfEl && savedStats.proficiencia !== undefined)
        statProfEl.innerText = `${(savedStats.proficiencia * 100).toFixed(0)}%`;

      htmlSnapshots.push(tempDiv.innerHTML);
    });

    // Save immediately so migration happens once
    savedState.htmlSnapshots = htmlSnapshots;
    saveState();
  }

  // [FINALIZATION] Verificar se há um passo de finalização em slidesData que ainda não foi renderizado
  const finalizationStep = slidesData.find(
    (s) => s.props?.status === "concluido",
  );
  if (finalizationStep && htmlSnapshots.length < finalizationStep.step) {
    console.log("[Scaffolding] Gerando snapshot para tela de finalização...");

    const finalizationHtml = renderScaffoldingSlideContent(
      finalizationStep.content || "Treinamento Concluído",
      finalizationStep.props,
      finalizationStep.step,
    );

    // Preencher gaps se necessário
    while (htmlSnapshots.length < finalizationStep.step - 1) {
      htmlSnapshots.push(""); // Gap placeholder
    }
    htmlSnapshots.push(finalizationHtml);

    // Salvar
    savedState.htmlSnapshots = htmlSnapshots;
    saveState();
  }

  // 1. Render Snapshots (History)
  // ANTES: Verificar se último snapshot é tela final antiga (sem botão voltar)
  // Se for, remover para forçar regeneração com novo template
  if (isScaffoldingCompleted && htmlSnapshots.length > 0) {
    const lastSnapshot = htmlSnapshots[htmlSnapshots.length - 1];
    if (
      lastSnapshot &&
      lastSnapshot.includes("finishButton") &&
      !lastSnapshot.includes("backPassoButton")
    ) {
      console.log(
        "[Scaffolding] Removendo snapshot antigo da tela final para regenerar com botão voltar",
      );
      htmlSnapshots.pop();
    }
  }

  htmlSnapshots.forEach((snapshotHtml, index) => {
    const slideDiv = document.createElement("div");
    slideDiv.className = "scaffolding-slide";
    slideDiv.dataset.step = index + 1;
    slideDiv.innerHTML = snapshotHtml;

    // [FIX] Limpar atributos data-listener-added que foram salvos no snapshot
    // Os listeners são perdidos quando o HTML é serializado/restaurado,
    // então precisamos removê-los para que sejam readicionados
    slideDiv.querySelectorAll("[data-listener-added]").forEach((el) => {
      delete el.dataset.listenerAdded;
    });

    // Ocultar todos inicialmente
    slideDiv.style.display = "none";

    slidesWrapper.appendChild(slideDiv);
  });

  // 2. Detectar se todos os passos foram respondidos e se há tela final
  // Se o número de snapshots >= stepHistory e todos foram respondidos,
  // devemos mostrar a tela final (ou o último passo com status "concluido")
  const allStepsCompleted =
    stepHistory.length > 0 &&
    stepHistory.some(
      (h) => h.status === "concluido" || h.contexto?.status === "concluido",
    );

  // Se savedState tem um step final, usamos ele
  const lastAnsweredStep = htmlSnapshots.length;

  // Determinar qual slide mostrar:
  // - Se scaffolding concluído, mostrar tela de finalização
  // - Se há próximo passo pendente, mostrar ele
  // - Senão, mostrar o último passo respondido
  let targetStepToShow;

  if (isScaffoldingCompleted) {
    // SCAFFOLDING CONCLUÍDO - Renderiza a tela de finalização diretamente
    targetStepToShow = currentStepIndex;

    // Buscar dados do passo de finalização em slidesData
    const finalizationData = slidesData.find(
      (s) => s.props?.status === "concluido",
    );

    // [FIX] Verificar se a tela de finalização JÁ existe (veio de um snapshot)
    const existingFinalizationSlide = slidesWrapper.querySelector(
      `.scaffolding-slide[data-step="${finalizationData?.step}"]`,
    );

    if (finalizationData && !existingFinalizationSlide) {
      const newSlideDiv = document.createElement("div");
      newSlideDiv.className = "scaffolding-slide";
      newSlideDiv.dataset.step = finalizationData.step;
      newSlideDiv.innerHTML = renderScaffoldingSlideContent(
        finalizationData.content,
        finalizationData.props,
        finalizationData.step,
      );
      slidesWrapper.appendChild(newSlideDiv);
      console.log("[Scaffolding] Tela de finalização renderizada");
    }
  } else if (currentStepIndex > htmlSnapshots.length) {
    // Há um novo passo dinâmico a ser gerado/mostrado
    targetStepToShow = currentStepIndex;

    const newSlideDiv = document.createElement("div");
    newSlideDiv.className = "scaffolding-slide";
    newSlideDiv.dataset.step = currentStepIndex;
    newSlideDiv.innerHTML = renderScaffoldingSlideContent(
      initialProps.enunciado || initialProps.question,
      initialProps,
      currentStepIndex,
    );
    slidesWrapper.appendChild(newSlideDiv);
  } else {
    // Mostrar o último passo respondido
    targetStepToShow = Math.max(1, lastAnsweredStep);
  }

  // 3. Mostrar o slide alvo
  const targetSlide = slidesWrapper.querySelector(
    `.scaffolding-slide[data-step="${targetStepToShow}"]`,
  );
  if (targetSlide) {
    targetSlide.classList.add("active-slide");
    targetSlide.style.display = "block";
  }

  // Detectar o total de slides renderizados
  const totalSlidesRendered =
    slidesWrapper.querySelectorAll(".scaffolding-slide").length;

  // 4. Configurar interações em TODOS os slides (para navegação funcionar)
  const allSlides = slidesWrapper.querySelectorAll(".scaffolding-slide");
  allSlides.forEach((slideEl) => {
    const stepNum = parseInt(slideEl.dataset.step);
    const slideData = slidesData.find((s) => s.step === stepNum);
    const isFinalizationSlide = slideEl.querySelector(".finishButton") !== null;

    // Se scaffolding está CONCLUÍDO, bloqueia TODOS os passos (exceto o de finalização)
    // NÃO permite soft exit quando concluído
    let isAnsweredSlide;

    if (isScaffoldingCompleted) {
      // Bloqueia todos os passos quando concluído
      isAnsweredSlide = !isFinalizationSlide;

      // Limpar botões com texto "Processando..." de snapshots antigos
      const submitBtnInSlide = slideEl.querySelector(".submit-step-btn");
      if (submitBtnInSlide) {
        submitBtnInSlide.style.display = "none";
        if (submitBtnInSlide.innerText.includes("Processando")) {
          submitBtnInSlide.innerText = "Confirmar";
        }
      }

      // Garantir que botões de navegação existam e funcionem
      const nextBtnInSlide = slideEl.querySelector(".nextPassoButton");
      const backBtnInSlide = slideEl.querySelector(".backPassoButton");

      // O último passo de história deve poder avançar para a tela final
      if (nextBtnInSlide && !isFinalizationSlide) {
        nextBtnInSlide.style.display = "inline-block";
      }
      if (backBtnInSlide && stepNum > 1) {
        backBtnInSlide.style.display = "inline-block";
      }
    } else {
      // SOFT EXIT: Se é o último passo e NÃO é tela de finalização,
      // permite re-responder mesmo que já tenha sido respondido.
      // Isso evita softlock caso a IA falhe ao gerar o próximo passo.
      const isLastStep = stepNum === totalSlidesRendered;
      const allowReAnswer = isLastStep && !isFinalizationSlide;

      // Para slides já respondidos (exceto o último não-final), configura apenas navegação
      isAnsweredSlide = stepNum <= htmlSnapshots.length && !allowReAnswer;
    }

    // Para slides já respondidos, configura apenas navegação (não interação)
    setupSlideInteractions(
      slideEl,
      slideData?.props || initialProps,
      isAnsweredSlide, // Flag para saber se é slide respondido
    );

    // [SNAPSHOT OF FINAL SCREEN] Se é tela final, salvar
    if (isFinalizationSlide) {
      const finalHtml = slideEl.innerHTML;
      if (!savedState.htmlSnapshots) savedState.htmlSnapshots = [];
      const idx = stepNum - 1;
      if (savedState.htmlSnapshots.length <= idx) {
        console.log("[Scaffolding] Salvando snapshot da Tela Final.");
        savedState.htmlSnapshots[idx] = finalHtml;
        saveState();
      }
    }
  });

  /**
   * Configura interações para um slide específico (Slider, Botões)
   * @param {HTMLElement} slideElement - Elemento do slide
   * @param {Object} stepProps - Propriedades do passo
   * @param {boolean} isAnsweredSlide - Se o slide já foi respondido (só configura navegação)
   */
  function setupSlideInteractions(
    slideElement,
    stepProps,
    isAnsweredSlide = false,
  ) {
    if (!slideElement) return;

    // Button listeners (Back/Next/Hint)
    const backBtn = slideElement.querySelector(".backPassoButton");
    const nextBtn = slideElement.querySelector(".nextPassoButton");

    // Configura navegação (funciona para todos slides)
    if (backBtn && !backBtn.dataset.listenerAdded) {
      backBtn.dataset.listenerAdded = "true";
      backBtn.addEventListener("click", () => {
        // Go to previous step
        const prevStep = parseInt(slideElement.dataset.step) - 1;
        if (prevStep < 1) return;
        changeSlide(prevStep);
      });
    }

    if (nextBtn && !nextBtn.dataset.listenerAdded) {
      nextBtn.dataset.listenerAdded = "true";
      nextBtn.addEventListener("click", () => {
        const currentStep = parseInt(slideElement.dataset.step);
        const nextStep = currentStep + 1;
        changeSlide(nextStep);
      });
    }

    /* Helper to switch slides */
    function changeSlide(targetStep) {
      const slides = slidesWrapper.querySelectorAll(".scaffolding-slide");
      slides.forEach((s) => {
        s.style.display = "none";
        s.classList.remove("active-slide");
        if (parseInt(s.dataset.step) === targetStep) {
          s.style.display = "block";
          s.classList.add("active-slide");
        }
      });
    }

    // Se for slide de finalização, configura botões de sair e voltar
    if (slideElement.querySelector(".finishButton")) {
      const finishBtn = slideElement.querySelector(".finishButton");
      if (!finishBtn.dataset.listenerAdded) {
        finishBtn.dataset.listenerAdded = "true";
        finishBtn.addEventListener("click", () => {
          // Scroll para a questão principal se existir, ou finish action
          const questionBlock = document.querySelector(
            ".chat-question-placeholder, .chat-embedded-card",
          );
          if (questionBlock)
            questionBlock.scrollIntoView({ behavior: "smooth" });
        });
      }

      // [FIX] Configurar botão "Ver Passos Anteriores" na tela de finalização
      const backBtnFinish = slideElement.querySelector(".backPassoButton");
      if (backBtnFinish && !backBtnFinish.dataset.listenerAdded) {
        backBtnFinish.dataset.listenerAdded = "true";
        backBtnFinish.addEventListener("click", () => {
          const prevStep = parseInt(slideElement.dataset.step) - 1;
          if (prevStep < 1) return;
          changeSlide(prevStep);
        });
      }
      return;
    }

    // Se é slide já respondido, configura apenas a dica e sai (não reconfigura os outros controles)
    if (isAnsweredSlide) {
      // [FIX] Configurar botão de dica para slides já respondidos também
      const hintBtnAnswered = slideElement.querySelector(".hintPassoButton");
      const dicaContainerAnswered =
        slideElement.querySelector(".dica-container");
      if (
        hintBtnAnswered &&
        dicaContainerAnswered &&
        !hintBtnAnswered.dataset.listenerAdded
      ) {
        hintBtnAnswered.dataset.listenerAdded = "true";
        hintBtnAnswered.addEventListener("click", () => {
          const isHidden = dicaContainerAnswered.style.display === "none";
          dicaContainerAnswered.style.display = isHidden ? "block" : "none";
          hintBtnAnswered.style.opacity = isHidden ? "1" : "0.7";
        });
      }
      return;
    }

    const guessRange = slideElement.querySelector(".guessRange");
    const submitBtn = slideElement.querySelector(".submit-step-btn");
    const unknownBtn = slideElement.querySelector(".newPassoButton");
    const explanationDiv = slideElement.querySelector(".explicacao");
    const resultHeader = slideElement.querySelector(".result-header");
    const inputWrapper = slideElement.querySelector(".input-area-wrapper");

    const hintBtn = slideElement.querySelector(".hintPassoButton");
    const dicaContainer = slideElement.querySelector(".dica-container");

    // [SOFT EXIT] Re-habilitar controles se estamos permitindo re-resposta
    // (Isso acontece quando o slide foi carregado de um snapshot mas é o último não-final)
    if (guessRange) {
      guessRange.removeAttribute("disabled");
    }
    if (submitBtn) {
      submitBtn.style.display = "inline-block";
      submitBtn.removeAttribute("disabled");
      submitBtn.innerText = "Confirmar";
    }
    if (unknownBtn) {
      unknownBtn.style.display = "inline-block";
    }
    if (hintBtn && stepProps.dica) {
      hintBtn.style.display = "inline-block";
    }
    if (inputWrapper) {
      inputWrapper.style.opacity = "1";
    }
    // Ocultar a explicação anterior (vai ser re-mostrada ao responder novamente)
    if (explanationDiv) {
      explanationDiv.style.display = "none";
    }

    // 1. Slider Logic (Visuals)
    function updateVisuals(value) {
      value = parseInt(value);
      const falseLabel = slideElement.querySelector(".falseLabel");
      const trueLabel = slideElement.querySelector(".trueLabel");
      const valueLabel = slideElement.querySelector(".range-value-label");
      const inputArea = slideElement.querySelector(".inputArea");

      if (!falseLabel) return; // Proteção

      const falseFactor = Math.max(1, 2.0 - (value / 100) * 1.0);
      const trueFactor = Math.max(1, 1 + (value / 100) * 1.0);
      falseLabel.style.transform = `scale(${falseFactor})`;
      trueLabel.style.transform = `scale(${trueFactor})`;

      if (value < 40) {
        falseLabel.style.opacity = "1";
        trueLabel.style.opacity = "0.5";
        valueLabel.innerText = `Acho que é FALSO (${100 - value}% de certeza)`;
        inputArea.style.borderColor = `rgba(192, 21, 47, ${0.2 + (50 - value) / 50})`;
      } else if (value > 60) {
        trueLabel.style.opacity = "1";
        falseLabel.style.opacity = "0.5";
        valueLabel.innerText = `Acho que é VERDADEIRO (${value}% de certeza)`;
        inputArea.style.borderColor = `rgba(33, 128, 141, ${0.2 + (value - 50) / 50})`;
      } else {
        valueLabel.innerText = "Estou indeciso";
        inputArea.style.borderColor = "var(--color-border)";
      }
    }

    guessRange.addEventListener("input", (e) => updateVisuals(e.target.value));
    updateVisuals(50); // Init

    // Hint Logic
    if (hintBtn && dicaContainer && !hintBtn.dataset.listenerAdded) {
      hintBtn.dataset.listenerAdded = "true";
      hintBtn.addEventListener("click", () => {
        const isHidden = dicaContainer.style.display === "none";
        dicaContainer.style.display = isHidden ? "block" : "none";
        hintBtn.style.opacity = isHidden ? "1" : "0.7";
      });
    }

    // 2. Submit Logic
    const handleSubmit = async (guessValue) => {
      // UI Lock
      guessRange.disabled = true;
      submitBtn.disabled = true;
      unknownBtn.style.display = "none";
      if (backBtn) backBtn.style.display = "none";
      // if (nextBtn) nextBtn.style.display = "none"; // Não esconde o nextBtn se ele já existir (revisão)
      submitBtn.innerText = "Processando...";
      inputWrapper.style.opacity = "0.6";

      // Calculos
      const gabaritoText =
        stepProps.resposta_correta ||
        (stepProps.gabarito ? "Verdadeiro" : "Falso");
      const isVerdadeiro = gabaritoText.toLowerCase() === "verdadeiro";
      const tempoGasto = 10; // Placeholder ou calcular com Date.now()
      const tempoIdeal = stepProps.tempo_ideal || 15;

      const stats = ScaffoldingService.calcularPontuacao(
        guessValue,
        isVerdadeiro,
        tempoGasto,
        tempoIdeal,
      );

      // UI Feedback (Reveal)
      explanationDiv.style.display = "block";
      explanationDiv.classList.add("fade-in");

      const acertou = stats.taxaDeAcerto === 1;

      // Feedback texto específico
      let feedbackText = stepProps.explicacao || "";
      if (acertou && stepProps.feedback_v) feedbackText = stepProps.feedback_v; // Assumindo resposta certa = V? Não necessariaente
      // Na vdd usamos feedback_v de Verdadeiro (usuario respondeu V) ? Ou feedback se ERA verdadeiro?
      // O schema diz: "Feedback se usuário responder X".
      // Se usuario respondeu > 50 (Verdadeiro):
      const userChuteBool = guessValue > 50;
      if (userChuteBool && stepProps.feedback_v)
        feedbackText = stepProps.feedback_v;
      if (!userChuteBool && stepProps.feedback_f)
        feedbackText = stepProps.feedback_f;

      resultHeader.innerHTML = acertou
        ? `<span style="color:var(--color-success)">✓ Correto! Era ${isVerdadeiro ? "Verdadeiro" : "Falso"}.</span>`
        : `<span style="color:var(--color-error)">✗ Incorreto. Era ${isVerdadeiro ? "Verdadeiro" : "Falso"}.</span>`;

      slideElement.querySelector(".explanation-text").innerHTML = feedbackText;

      // Populate Stats
      const statScoreEl = slideElement.querySelector(".stat-score");
      const statConfEl = slideElement.querySelector(".stat-confidence");
      const statTimeEl = slideElement.querySelector(".stat-time");
      const statProfEl = slideElement.querySelector(".stat-proficiency");

      if (statScoreEl)
        statScoreEl.innerText = `${(stats.resultadoPasso * 100).toFixed(0)}%`;
      if (statConfEl)
        statConfEl.innerText = `${(stats.taxaDeCerteza * 100).toFixed(0)}%`;
      if (statTimeEl) statTimeEl.innerText = `${stats.tempoGasto}s`;

      // Calculo proficiencia acumulada
      const currentProf = ScaffoldingService.calcularProficienciaMedia([
        ...accumulatedStats,
        stats,
      ]);
      if (statProfEl)
        statProfEl.innerText = `${(currentProf * 100).toFixed(0)}%`;

      // Atualiza histórico local
      const stepResultData = {
        contexto: {
          pergunta:
            stepProps.enunciado || stepProps.question || stepProps.conteudo,
          explicacao: feedbackText,
        },
        stats: {
          acertou,
          ...stats,
          proficiencia: currentProf,
        },
      };
      stepHistory.push(stepResultData);
      accumulatedStats.push(stats);

      // === INJEÇÃO SILENCIOSA NO HISTÓRICO DO CHAT ===
      injectSilentHistory(
        stepResultData.contexto.pergunta,
        userAnswerText(guessValue),
        stepResultData.contexto.explicacao,
        acertou,
      );

      // [SNAPSHOT] Save HTML of this finished step
      const currentHtml = slideElement.innerHTML;
      if (htmlSnapshots.length < currentStepIndex) {
        htmlSnapshots.push(currentHtml);
      } else {
        htmlSnapshots[currentStepIndex - 1] = currentHtml;
      }

      // [PERSISTENCE] Salvar resultado do passo no array scaffoldingSteps
      // Inclui props originais + resultado (stats e contexto)
      if (initialProps.chatId) {
        const { ChatStorageService } =
          await import("../services/chat-storage.js");
        await ChatStorageService.addScaffoldingStep(
          initialProps.chatId,
          currentStepIndex - 1, // 0-indexed
          {
            ...stepProps,
            resultado: stepResultData,
            userAnswer: guessValue,
            answeredAt: Date.now(),
          },
        );
      }

      // [PERSISTENCE] Save Progress
      await saveState();

      // Update UI Status
      // ... External logic ...
      submitBtn.innerText = "Confirmado";
      submitBtn.style.display = "none"; // Esconde botão de confirmar após sucesso
      if (backBtn) backBtn.style.display = "inline-block"; // Traz de volta o Back se quiser

      // Gerar Próximo Passo (Silent Generation)
      // O botão "Avançar" aparecerá via generateNextStep quando pronto
      await generateNextStep(stepResultData);
    };

    const userAnswerText = (val) => {
      if (val === -1) return "Não sei";
      const bool = val > 50;
      const cert = Math.abs(val - 50) * 2;
      return `${bool ? "VERDADEIRO" : "FALSO"} (${cert}%)`;
    };

    submitBtn.addEventListener("click", () => handleSubmit(guessRange.value));
    unknownBtn.addEventListener("click", () => handleSubmit(-1));

    // Back Button Logic
    if (backBtn) {
      backBtn.addEventListener("click", () => {
        // Encontra slide anterior
        const currentStep = parseInt(slideElement.dataset.step);
        const prevStep = currentStep - 1;

        // Encontra elemento do slide anterior (já existe no DOM, apenas oculto)
        const wrapper = slideElement.closest(".scaffolding-slides-wrapper");
        const prevSlide = wrapper.querySelector(
          `.scaffolding-slide[data-step="${prevStep}"]`,
        );

        if (prevSlide) {
          // Troca visibilidade
          slideElement.style.display = "none";
          slideElement.classList.remove("active-slide");

          prevSlide.style.display = "block";
          prevSlide.classList.add("active-slide");

          // Mostra botão 'Avançar' no slide anterior, pois sabemos que o atual existe
          const prevNextBtn = prevSlide.querySelector(".nextPassoButton");
          if (prevNextBtn) prevNextBtn.style.display = "inline-block";
        }
      });
    }

    // Next Button Logic
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        const currentStep = parseInt(slideElement.dataset.step);
        const nextStep = currentStep + 1;

        const wrapper = slideElement.closest(".scaffolding-slides-wrapper");
        const nextSlide = wrapper.querySelector(
          `.scaffolding-slide[data-step="${nextStep}"]`,
        );

        if (nextSlide) {
          slideElement.classList.remove("active-slide");
          slideElement.style.display = "none";

          nextSlide.style.display = "block";
          nextSlide.classList.add("active-slide");
        }
      });
    }
  }

  /**
   * Gera e renderiza o próximo passo
   */
  async function generateNextStep(lastResultData) {
    // Mostra Loading no slide atual ou um indicador
    const currentSlide = slidesWrapper.querySelector(".active-slide");
    const loadingIndicator = document.createElement("div");
    loadingIndicator.style.marginTop = "15px";
    loadingIndicator.innerHTML = `<span style="font-size:0.9em; color:var(--color-text-secondary)">🤖 Gerando próximo passo...</span>`;
    currentSlide.appendChild(loadingIndicator);

    try {
      // 1. Decide V ou F
      const nextBool = ScaffoldingService.decidirProximoStatus();

      // 2. Gera Prompt
      // [FIX] Passa o objeto COMPLETO (initialProps) para o service, pois ele contém todo o JSON rico (dados_questao, etc)
      const prompt = ScaffoldingService.generateStepPrompt(
        initialProps,
        nextBool,
        stepHistory,
      );

      // 3. Chama Worker (Silent)
      const apiKey = sessionStorage.getItem("geminiApiKey"); // Pega key da sessão
      const nextStepJSON = await generateSilentScaffoldingStep(prompt, apiKey);

      // 4. Renderiza Novo Slide (mas NÃO avança automaticamente)
      if (nextStepJSON) {
        loadingIndicator.remove();
        currentStepIndex++;

        // [PERSISTENCE] Track new slide data
        slidesData.push({
          step: currentStepIndex,
          content:
            nextStepJSON.enunciado ||
            nextStepJSON.pergunta ||
            nextStepJSON.conteudo,
          props: { ...nextStepJSON, question: nextStepJSON.enunciado },
        });

        // [PERSISTENCE] Salvar JSON resultante no array scaffoldingSteps do chat
        // O índice é 0-indexed: currentStepIndex 1 = index 0, etc.
        if (initialProps.chatId) {
          const { ChatStorageService } =
            await import("../services/chat-storage.js");
          await ChatStorageService.addScaffoldingStep(
            initialProps.chatId,
            currentStepIndex - 1, // 0-indexed: step 1 = index 0
            nextStepJSON,
          );
        }

        await saveState();

        const newSlideDiv = document.createElement("div");
        newSlideDiv.className = "scaffolding-slide";
        newSlideDiv.style.display = "none"; // Começa oculto
        newSlideDiv.dataset.step = currentStepIndex;
        // Garante que o template receba dados válidos
        const conteudo =
          nextStepJSON.enunciado ||
          nextStepJSON.pergunta ||
          nextStepJSON.conteudo ||
          "Erro ao carregar conteúdo.";

        newSlideDiv.innerHTML = renderScaffoldingSlideContent(
          conteudo,
          { ...nextStepJSON, question: nextStepJSON.enunciado },
          currentStepIndex,
        );

        slidesWrapper.appendChild(newSlideDiv);

        // NÃO esconde o atual nem mostra o novo automaticamente.
        // Apenas habilita o botão "Avançar" no slide atual.
        const currentNextBtn = currentSlide.querySelector(".nextPassoButton");
        if (currentNextBtn) {
          currentNextBtn.style.display = "inline-block";
          // Animação visual para chamar atenção?
          currentNextBtn.classList.add("fade-in");
        }

        // Setup interações no novo slide (para quando for exibido)
        setupSlideInteractions(newSlideDiv, {
          ...nextStepJSON,
          question: nextStepJSON.enunciado || nextStepJSON.pergunta,
        });
      }
    } catch (err) {
      console.error("Erro ao gerar próximo passo:", err);
      loadingIndicator.innerHTML = `<span style="color:var(--color-error)">Erro de conexão. Tente novamente.</span>`;
    }
  }
}

/**
 * Injeta uma mensagem de sistema invisível no DOM do chat
 * Isso permite que 'extractChatHistory' pegue o contexto para as próximas interações do usuário.
 */
function injectSilentHistory(pergunta, respostaUser, explicacao, acertou) {
  const messagesContainer = document.getElementById("chatMessages");
  if (!messagesContainer) return;

  const hiddenMsg = document.createElement("div");
  hiddenMsg.className = "chat-message chat-message--system hidden-context-node";
  // Classe 'hidden-context-node' deve ser CSS display:none, ou filtramos no extract
  // Mas 'extractChatHistory' filtra por .visible. Precisamos mudar isso ou usar strategy de Metadata.

  // Melhor abordagem: Criar um elemento .chat-message que é visível como "Resumo" ou invisível mas marcado.
  // O usuário pediu "jogado no HISTÓRICO do chat". Se o extractChatHistory ignora invisíveis, não adianta.
  // Vamos adicionar como um detalhe visível mas discreto OU alterar o extractChatHistory.
  // O USER PEDIU: "conteúdo gerado é jogado no HISTÓRICO... oculto momentaneamente"
  // Vamos usar display:none e ajustar extractChatHistory para incluir .hidden-context-node

  hiddenMsg.style.display = "none";
  hiddenMsg.innerHTML = `
        <div class="chat-message-content">
            [SCAFFOLDING STEP]
            Q: ${pergunta}
            User Answer: ${respostaUser}
            Result: ${acertou ? "Correct" : "Incorrect"}
            Explanation: ${explicacao}
        </div>
    `;

  messagesContainer.appendChild(hiddenMsg);
}

/**
 * Helper para extrair histórico do chat a partir do DOM
 * Retorna array de objetos { role, parts: [{ text }] }
 */
function extractChatHistory() {
  const container = document.getElementById("chatMessages");
  if (!container) return [];

  const history = [];
  const msgs = container.querySelectorAll(".chat-message");

  msgs.forEach((msg) => {
    // Apenas mensagens visíveis e que não sejam sistema/erro/loading
    // OU mensagens de scaffolding ocultas (.hidden-context-node)
    if (
      (msg.classList.contains("visible") ||
        msg.classList.contains("hidden-context-node")) &&
      !msg.classList.contains("chat-message--error") &&
      (!msg.classList.contains("chat-message--system") ||
        msg.classList.contains("hidden-context-node"))
    ) {
      let role = "";
      let text = "";

      if (msg.classList.contains("chat-message--user")) {
        role = "user";
        // Pega apenas o conteúdo de texto direto, ignorando estrutura HTML complexa
        text = msg.querySelector(".chat-message-content")?.textContent?.trim();
      } else if (msg.classList.contains("chat-message--ai")) {
        role = "model";
        // Pega o texto da resposta.
        text = msg.querySelector(".chat-message-content")?.textContent?.trim();
      }

      if (role && text) {
        history.push({ role, parts: [{ text }] });
      }
    }
  });

  // Remove a ÚLTIMA mensagem se for do usuário (pois ela é o prompt atual)
  // Mas verificamos se de fato a última capturada foi usuário.
  if (history.length > 0 && history[history.length - 1].role === "user") {
    history.pop();
  }

  return history;
}

/**
 * Função Global para lidar com UI de Abort/Cancelamento
 * Centraliza toda a lógica de limpeza visual quando o usuário para a geração.
 */
function handleGenerationAbortUI() {
  console.log("[UI] Lidando com interrupção de geração...");

  // 1. Resetar Controlador Global e Botão Enviar
  activeGenerationController = null;
  const sendBtn = document.querySelector(".chat-send-btn");
  if (sendBtn) {
    sendBtn.classList.remove("stop-mode");
    // Ícone Seta (Enviar)
    sendBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>`;
  }

  // 2. Tratar Loading Inicial (se ainda estiver na fase de loading)
  const loading = document.getElementById("chatLoading");
  if (loading) {
    loading.innerHTML = `<span style="color:var(--color-text-secondary); font-style:italic;"> Geração interrompida.</span>`;
    // Remove ID para que não seja mais tratado como loader ativo, mas mantém no DOM como log
    loading.removeAttribute("id");
  }

  // 3. Tratar Mensagem Parcial (se já estiver streamando ou pensando)
  const currentAiMsg = document.getElementById("currentAiMessage");
  if (currentAiMsg) {
    // a. Parar spinner de pensamento/raciocínio
    const thoughtContainer = currentAiMsg.querySelector(
      ".chat-thought-container",
    );
    if (thoughtContainer) {
      const spinner = thoughtContainer.querySelector(".summary-logo-spinner");
      const text = thoughtContainer.querySelector(".summary-text");
      if (spinner) spinner.style.display = "none";
      if (text) text.innerText = "Raciocínio interrompido.";

      // Força o thought a ficar cinza/inativo visualmente?
      thoughtContainer.style.opacity = "0.7";
    }

    // b. Adicionar mensagem de "Interrompido" no conteúdo
    const content = currentAiMsg.querySelector(".chat-message-content");
    if (content) {
      // Verifica duplicidade
      if (!content.innerText.includes("Geração interrompida")) {
        const stopMsg = document.createElement("p");
        stopMsg.style.color = "var(--color-text-secondary)";
        stopMsg.style.fontStyle = "italic";
        stopMsg.style.marginTop = "8px";
        stopMsg.style.borderTop = "1px dashed var(--color-border)";
        stopMsg.style.paddingTop = "8px";
        stopMsg.innerText = "Geração interrompida pelo usuário.";
        content.appendChild(stopMsg);
      }
    }

    // c. Remover ID para que a próxima mensagem não tente reusar este div
    currentAiMsg.removeAttribute("id");
  }
}

// Expor globalmente
window.handleGenerationAbortUI = handleGenerationAbortUI;
