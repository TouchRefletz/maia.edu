import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';
import { gerarTelaInicial, iniciarFluxoExtracao, iniciarModoEstudante } from './app/telas.js';
import { aplicarFiltrosBanco, limparFiltros } from './banco/filtros-ui.js';
import { abrirScanOriginal, toggleGabarito, verificarRespostaBanco } from './banco/interacoes.js';
import { ativarModoRecorte, iniciarCapturaParaSlot, onClickImagemFinal, removerImagemFinal } from './cropper/mode.js';
import { enviarDadosParaFirebase } from './firebase/envio.js';
import { verImagensOriginais } from './render/final/originais-modal.js';
import { generateAPIKeyPopUp } from './ui/api-key-modal.js';
import { setupDragAndDrop } from './upload/drag-drop.js';
import { setupFormLogic } from './upload/form-logic.js';
import { getUploadInterfaceHTML } from './upload/upload-template.js';

import {
  getAuth,
  signInAnonymously,
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';

export const TIPOS_ESTRUTURA_VALIDOS = new Set([
  'texto',
  'imagem',
  'citacao',
  'titulo',
  'subtitulo',
  'lista',
  'equacao',
  'codigo',
  'destaque',
  'separador',
  'fonte',
]);

window.__ultimaQuestaoExtraida = null;
window.__recortesAcumulados = [];
window.__isProcessing = false;
export let questaoAtual = {};
export const uploadState = {
  imagensConvertidas: 0,
};

// Variáveis de controle
export const bancoState = {
  ultimoKeyCarregada: null,
  observadorScroll: null,
  carregandoMais: false,
  todasQuestoesCache: [], // Cache local para filtros rápidos
};
export const TAMANHO_PAGINA = 20;

// Variáveis de controle de IA
export const aiState = {
  lastThoughtSig: '',
  thoughtsBootstrapped: false,
};

// Variáveis de controle de UI global
export const uiState = {
  alertTimeout: null,
  undoToastTimer: null,
};

// VariÃ¡veis de escopo global para o visualizador
export const viewerState = {
  pdfDoc: null,
  pageNum: 1,
  pdfScale: 1.0, // Zoom inicial
  cropper: null,
  isRendering: false, // Prevines renderizaÃ§Ãµes simultÃ¢neas
  scrollPos: { top: 0, left: 0 },
};
window.__viewerArgs = null; // guarda os arquivos e title
window.__modo = 'prova'; // "prova" | "gabarito"
window.__pdfUrls = { prova: null, gabarito: null };
window.__preferirPdfGabarito = true; // por padrÃ£o, quando existir PDF do gabarito, troca

window.__imagensLimpas = window.__imagensLimpas || {
  questao_original: [],
  questao_suporte: [],
  gabarito_original: [],
  gabarito_suporte: [],
  // ADICIONE ISSO AQUI:
  gabarito_passos: {}, // Estrutura: { 0: [img, img], 1: [img] } (chave Ã© o index do passo)
  alternativas: {
    questao: {},
    gabarito: {},
  },
};

window.__target_alt_letra = null;
window.__target_alt_index = null;

// GLOBAL LISTENER (Gerente de Cliques)
// Proteção contra múltiplas inicializações
if (!window.__globalListenerRegistered) {
  window.__globalListenerRegistered = true;
  console.log(' Inicializando Global Listener (Única vez)...');

  document.addEventListener('click', function (e) {
    // --- CASO 1: BotÃµes de Captura de Slot ---
    const gatilhoSlot = e.target.closest('.js-captura-trigger');
    if (gatilhoSlot) {
      iniciarCapturaParaSlot(gatilhoSlot.dataset.idx, gatilhoSlot.dataset.ctx);
      return;
    }

    // --- CASO 2: BotÃ£o de Recortar Final ---
    const gatilhoRecorte = e.target.closest('.js-recortar-final');
    if (gatilhoRecorte) {
      onClickImagemFinal();
      return;
    }

    // --- CASO 3: BotÃ£o de Remover Imagem ---
    const gatilhoRemover = e.target.closest('.js-remover-img');
    if (gatilhoRemover) {
      const { idx, ctx } = gatilhoRemover.dataset;
      removerImagemFinal(idx, ctx);
      return;
    }

    // --- CASO 4: BotÃ£o Ver Originais ---
    const gatilhoOriginais = e.target.closest('.js-ver-originais');
    if (gatilhoOriginais) {
      verImagensOriginais();
      return;
    }

    // --- CASO 5: BotÃ£o Confirmar e Enviar ---
    const gatilhoEnvio = e.target.closest('.js-confirmar-envio');
    if (gatilhoEnvio) {
      enviarDadosParaFirebase();
      return;
    }

    // --- CASO 6: BotÃ£o Voltar (Tela Inicial) ---
    const gatilhoVoltar = e.target.closest('.js-voltar-inicio');
    if (gatilhoVoltar) {
      gerarTelaInicial();
      return;
    }

    // --- CASO 7: Card Iniciar ExtraÃ§Ã£o ---
    const gatilhoExtracao = e.target.closest('.js-iniciar-extracao');
    if (gatilhoExtracao) {
      iniciarFluxoExtracao();
      return;
    }

    // --- CASO 8: Card Iniciar Modo Estudante ---
    const gatilhoEstudante = e.target.closest('.js-iniciar-estudante');
    if (gatilhoEstudante) {
      iniciarModoEstudante();
      return;
    }

    // --- CASO 9: BotÃ£o Limpar Filtros ---
    const gatilhoLimpar = e.target.closest('.js-limpar-filtros');
    if (gatilhoLimpar) {
      limparFiltros();
      return;
    }

    // --- CASO 10: BotÃ£o Aplicar Filtros (Busca) ---
    const gatilhoFiltrar = e.target.closest('.js-aplicar-filtros');
    if (gatilhoFiltrar) {
      aplicarFiltrosBanco();
      return;
    }

    // --- NOVO CASO 11: BotÃ£o Toggle Gabarito ---
    const gatilhoGabarito = e.target.closest('.js-toggle-gabarito');
    if (gatilhoGabarito) {
      // Recupera o ID que guardamos no HTML
      const cardId = gatilhoGabarito.dataset.cardId;
      toggleGabarito(cardId);
      return;
    }

    // --- NOVO CASO 12: Verificar Resposta (Alternativas) ---
    const gatilhoResposta = e.target.closest('.js-verificar-resp');
    if (gatilhoResposta) {
      // Extrai os dados do dataset do botÃ£o clicado
      const { cardId, letra, correta } = gatilhoResposta.dataset;

      // Chama a funÃ§Ã£o lÃ³gica passando o elemento (gatilhoResposta) e os dados
      verificarRespostaBanco(gatilhoResposta, cardId, letra, correta);
      return;
    }

    // --- NOVO CASO 13: Ver Scan Original (Enunciado ou Gabarito) ---
    const gatilhoScan = e.target.closest('.js-ver-scan');
    if (gatilhoScan) {
      // Passamos o prÃ³prio elemento HTML para a funÃ§Ã£o,
      // igual o 'this' fazia no onclick inline.
      abrirScanOriginal(gatilhoScan);
      return;
    }

    // --- NOVO CASO 14: Configurar API Key ---
    const gatilhoApi = e.target.closest('.js-config-api');
    if (gatilhoApi) {
      generateAPIKeyPopUp();
      return;
    }
  });
}

// Listener Ãºnico para fechar menus de passos ao clicar fora
if (!window._stepMenuGlobalListener) {
  document.addEventListener('click', (e) => {
    // Se o clique NÃƒO foi num botÃ£o de abrir menu, fecha todos os menus de passos
    if (
      !e.target.closest('.btn-toggle-step-add') &&
      !e.target.closest('.step-menu-content')
    ) {
      document
        .querySelectorAll('.step-menu-content')
        .forEach((m) => m.classList.add('hidden'));
    }
  });
  window._stepMenuGlobalListener = true;
}

window.__targetSlotContext = null; // 'questao' ou 'gabarito'

// ConfiguraÃ§Ã£o do Firebase
export const firebaseConfig = {
  apiKey: import.meta.env.FIREBASE_API_KEY,
  authDomain: import.meta.env.FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.FIREBASE_PROJECT_ID,
  // storageBucket: REMOVIDO (NÃ£o vamos usar)
  databaseURL: import.meta.env.FIREBASE_DATABASE_URL,
  messagingSenderId: import.meta.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.FIREBASE_APP_ID,
  measurementId: import.meta.env.FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Inicializa o Realtime Database
export const db = getDatabase(app);

// Inicializa AutenticaÃ§Ã£o AnÃ´nima
export const auth = getAuth(app);
signInAnonymously(auth)
  .then(() => {
    console.log('Autenticado anonimamente no Firebase.');
  })
  .catch((error) => {
    console.error('Erro na autenticaÃ§Ã£o anÃ´nima:', error);
  });

/**
 * 4. FUNÃ‡ÃƒO PRINCIPAL (MAESTRO)
 * A Ãºnica que vocÃª chama no seu cÃ³digo.
 */
window.generatePDFUploadInterface = function (initialData = null) {
  // Limpeza
  document.body.innerHTML = '';
  const viewer = document.getElementById('pdfViewerContainer');
  if (viewer) viewer.remove();

  // 1. Renderizar HTML
  document.body.innerHTML = getUploadInterfaceHTML();

  // 2. Capturar Elementos
  const elements = {
    titleInput: document.getElementById('pdfTitleInput'),
    gabaritoCheck: document.getElementById('gabaritoNaProvaCheck'),
    gabaritoGroup: document.getElementById('gabaritoInputGroup'),
    gabaritoInput: document.getElementById('gabaritoFileInput'),
    pdfInput: document.getElementById('pdfFileInput'),
    fileNameDisplay: document.getElementById('fileName'),
    gabaritoFileNameDisplay: document.getElementById('gabaritoFileName'),
    dropZoneProva: document.getElementById('dropZoneProva'),
    dropZoneGabarito: document.getElementById('dropZoneGabarito'),
    form: document.getElementById('pdfUploadForm'),
  };

  // 3. Ativar Drag & Drop
  setupDragAndDrop(
    elements.dropZoneProva,
    elements.pdfInput,
    elements.fileNameDisplay
  );
  setupDragAndDrop(
    elements.dropZoneGabarito,
    elements.gabaritoInput,
    elements.gabaritoFileNameDisplay
  );

  // 4. Iniciar LÃ³gica do FormulÃ¡rio
  setupFormLogic(elements, initialData);
};

window.iniciar_captura_para_slot_alternativa = function (letra, index) {
  window.__target_alt_letra = String(letra || '')
    .trim()
    .toUpperCase();
  window.__target_alt_index = Number(index);

  // Reaproveita teu fluxo existente de recorte/UI
  ativarModoRecorte(); // jÃ¡ existe e liga o cropper + botÃµes flutuantes [file:2]
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
            <button style="position:absolute; top:20px; right:20px; background:white; border:none; border-radius:50%; width:40px; height:40px; font-weight:bold; cursor:pointer;">âœ•</button>
        </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
};

gerarTelaInicial(); // Chama inicial ao carregar
window.setTimeout(() => generateAPIKeyPopUp(false), 500); // Tenta abrir (se nÃ£o tiver chave)