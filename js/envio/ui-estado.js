import { gerarConteudoEmJSONComImagemStream } from '../api/worker.js';
import { obterConfiguracaoIA } from '../ia/config.js';
import { renderizarQuestaoFinal } from '../render/final/render-questao.js';
import { prepararAreaDeResposta, pushThought } from '../sidebar/thoughts-scroll.js';
import { customAlert } from '../ui/alerts.js';
import { coletarESalvarImagensParaEnvio, prepararImagensParaEnvio } from './imagens.js';

export function iniciarEstadoProcessamento() {
  // 1. Verificação de Segurança
  if (window.__isProcessing) return null; // Retorna null para sinalizar ABORTO

  // 2. Injeção de CSS
  var styleviewerSidebar = document.createElement('style');
  styleviewerSidebar.innerHTML = `
    #viewerSidebar {
        overflow-y: scroll;
    }
    `;
  document.body.appendChild(styleviewerSidebar);

  // 3. Definição de Estado
  window.__isProcessing = true;
  window.__userInterruptedScroll = false; // Reset smart scroll flag

  // Retorna o elemento para que a função principal possa removê-lo depois
  return styleviewerSidebar;
}

export function setarEstadoLoadingModal() {
  const btnProcessar = document.querySelector(
    '#cropConfirmModal .btn--primary'
  );
  const btnVoltar = document.querySelector('#cropConfirmModal .btn--secondary');

  // Segurança: se não achar o botão principal, nem segue.
  if (!btnProcessar) return null;

  const originalText = btnProcessar.innerText;

  // Aplica as mudanças visuais
  btnProcessar.innerText = 'Iniciando...';
  btnProcessar.disabled = true;
  if (btnVoltar) btnVoltar.disabled = true;

  // Retorna um "pacote" com tudo que precisamos para restaurar depois
  return {
    btnProcessar,
    btnVoltar,
    originalText,
  };
}

export async function inicializarEnvioCompleto() {
  // 1. Inicia CSS e Flags de Processamento
  const styleviewerSidebar = iniciarEstadoProcessamento();
  if (!styleviewerSidebar) return null; // Já estava processando

  // 2. Coleta as imagens cruas e salva backups
  const { imagensAtuais, imagensSuporteQuestao } =
    coletarESalvarImagensParaEnvio();

  // 3. Processa/Carimba as imagens (pode demorar um pouco)
  const listaImagens = await prepararImagensParaEnvio(
    imagensAtuais,
    imagensSuporteQuestao
  );

  // Se falhar no processamento, limpamos o passo 1
  if (!listaImagens) {
    window.__isProcessing = false;
    styleviewerSidebar.remove();
    return null;
  }

  // 4. Trava a UI (Botões do Modal)
  const uiState = setarEstadoLoadingModal();

  // Se falhar na UI, limpamos passo 1
  if (!uiState) {
    window.__isProcessing = false;
    styleviewerSidebar.remove();
    return null;
  }

  // Retorna o pacote completo para a função principal trabalhar
  return {
    styleviewerSidebar,
    listaImagens,
    uiState,
  };
}

export function finalizarProcessamentoVisual() {
  // 1. Atualiza o estado global
  window.__isProcessing = false;

  // 2. Verifica se precisa de Glow (só se estiver fechado)
  const viewerBody = document.getElementById('viewerBody');
  if (!viewerBody || !viewerBody.classList.contains('sidebar-collapsed')) {
    return;
  }

  // 3. Determina o alvo do brilho
  const isMobile = window.innerWidth <= 900;
  const targetId = isMobile ? 'header-mobile-toggle' : 'reopenSidebarBtn';

  const targetEl = document.getElementById(targetId);

  // 4. Aplica o efeito
  if (targetEl) {
    targetEl.classList.add('glow-effect');

    // DICA EXTRA: Remove o glow automaticamente quando o usuário clicar/abrir
    const removeGlow = () => {
      targetEl.classList.remove('glow-effect');
      targetEl.removeEventListener('click', removeGlow);
    };
    targetEl.addEventListener('click', removeGlow, { once: true });
  }
}

export function finalizarInterfacePosSucesso(styleviewerSidebar, uiState, modo) {
  // 1. Limpeza Visual
  if (styleviewerSidebar) styleviewerSidebar.remove();
  const btnResume = document.getElementById('resumeScrollBtn');
  if (btnResume) btnResume.remove();

  // 2. Feedback ao Usuário
  const mensagem =
    modo === 'gabarito'
      ? '✅ Gabarito identificado e anexado!'
      : '✅ Questão processada com sucesso!';
  customAlert(mensagem, 3000);

  restaurarEstadoBotoes(uiState);
}

export function restaurarEstadoBotoes(uiState) {
  if (!uiState) return;

  const { btnProcessar, btnVoltar, originalText } = uiState;

  if (btnProcessar) {
    btnProcessar.innerText = originalText;
    btnProcessar.disabled = false;
  }

  if (btnVoltar) {
    btnVoltar.disabled = false;
  }
}

export function tratarErroEnvio(error, uiState, refsLoader) {
  console.error('Erro no processamento:', error);

  // 1. Reset Global
  window.__isProcessing = false;

  // 2. Remove o Loader (se ele existir)
  if (refsLoader && refsLoader.loadingContainer) {
    refsLoader.loadingContainer.remove();
  }

  // 3. Feedback Visual e Reabertura do Modal
  customAlert('❌ Erro ao processar. Tente novamente.', 3000);

  const modal = document.getElementById('cropConfirmModal');
  if (modal) modal.classList.add('visible');

  // 4. Restaura os botões (Reutilizando a lógica)
  restaurarEstadoBotoes(uiState);
}

export async function confirmarEnvioIA() {
  // --- PASSO 1: PREPARAÇÃO DE DADOS E ESTADO ---
  const dadosIniciais = await inicializarEnvioCompleto();
  if (!dadosIniciais) return;
  // Desempacota dados (Adicione styleviewerSidebar na lista)
  const { styleviewerSidebar, listaImagens, uiState } = dadosIniciais;
  // --- PASSO 2: PREPARAÇÃO VISUAL (SIDEBAR E LOADER) ---
  // A mágica acontece aqui: uma linha resolve toda a UI
  const uiTools = prepararAreaDeResposta();
  if (!uiTools) return;

  // AGORA SIM: Extraímos o setStatus E o refsLoader para usar depois
  const { setStatus, refsLoader } = uiTools;

  try {
    setStatus(`Enviando ${listaImagens.length} imagens para IA...`);

    const { promptDaIA, JSONEsperado } = obterConfiguracaoIA(window.__modo);

    setStatus(`Analisando ${listaImagens.length} imagem(ns)...`);

    const resposta = await gerarConteudoEmJSONComImagemStream(
      promptDaIA,
      JSONEsperado,
      listaImagens,
      'image/jpeg',
      {
        onStatus: (s) => setStatus(s),
        onThought: (t) => pushThought(t),
        onAnswerDelta: () => setStatus('Gerando JSON...'),
      }
    );

    console.log('Resposta recebida:', resposta);

    // Desliga flag e aplica efeitos visuais
    finalizarProcessamentoVisual();

    // 1. Anexa as imagens locais ao JSON da IA
    enriquecerRespostaComImagensLocais(resposta, window.__modo);

    // 2. Salva nas variáveis globais
    salvarResultadoNoGlobal(resposta, window.__modo);

    // 3. Renderiza o resultado na tela (sua função existente)
    renderizarQuestaoFinal(resposta);

    // 4. Limpa a bagunça e avisa o usuário
    finalizarInterfacePosSucesso(styleviewerSidebar, uiState, window.__modo);
  } catch (error) {
    tratarErroEnvio(error, uiState, refsLoader);
  }
}

export function enriquecerRespostaComImagensLocais(resposta, modo) {
  const imagens = window.__imagensLimpas || {};

  if (modo === 'gabarito') {
    // Modo Gabarito: Anexa suporte
    resposta.imagens_suporte = imagens.gabarito_suporte || [];
  } else {
    // Modo Questão: Anexa suporte e scan original
    resposta.imagens_suporte = imagens.questao_suporte || [];

    // Salva o scan original (a imagem grandona)
    if (imagens.questao_original && imagens.questao_original.length > 0) {
      resposta.scan_original = imagens.questao_original[0];
    }

    // Importante: Limpa a lista de originais para os próximos slots nascerem vazios
    imagens.questao_original = [];
  }

  return resposta;
}

export function salvarResultadoNoGlobal(resposta, modo) {
  if (modo === 'gabarito') {
    window.__ultimoGabaritoExtraido = resposta;
  } else {
    window.__ultimaQuestaoExtraida = resposta;
    window.questaoAtual = resposta;
  }

  // Limpa a lista de recortes temporários
  window.__recortesAcumulados = [];
}