import { aiState } from '../main.js';
import { montarResizerLateral } from '../viewer/resizer.js';
import { configurarSidebarMobile, garantirSidebarEBackdrop } from '../viewer/sidebar-mobile.js';
import { configurarResizer, getScrollContainer, mostrarPainel } from '../viewer/sidebar.js';
import { construirSkeletonLoader, criarElementoCardPensamento, limparResultadosAnteriores, splitThought } from './thoughts-base.js';

export function executarSmartScroll(thoughtListEl) {
  // 1. Tenta pegar o container principal de scroll (definido em outros lugares do app)
  const scrollEl = getScrollContainer();

  // 2. Backup: Scrolla o container interno de pensamentos se necessário
  if (
    thoughtListEl &&
    thoughtListEl.scrollHeight > thoughtListEl.clientHeight
  ) {
    thoughtListEl.scrollTop = thoughtListEl.scrollHeight;
  }

  // 3. Lógica Principal
  if (scrollEl && !window.__userInterruptedScroll) {
    // Usuário NÃO interrompeu -> Auto Scroll
    setTimeout(() => {
      scrollEl.scrollTo({
        top: scrollEl.scrollHeight,
        behavior: 'auto', // 'auto' é melhor no mobile para evitar conflitos
      });
    }, 10);
  } else if (window.__userInterruptedScroll) {
    // Usuário subiu a tela -> Mostra botão "Resume"
    const btnResume = document.getElementById('resumeScrollBtn');
    if (btnResume) btnResume.classList.add('visible');
  }
}

export function pushThought(t) {
  // Garante que temos o container
  const listEl = document.getElementById('maiaThoughts'); // Busca segura pelo ID
  if (!listEl) return;

  // 1. Parsing e Validação de Duplicatas
  const { title, body } = splitThought(t); // (Função que já separamos antes)
  const sig = `${title}||${body}`;

  // Se vazio ou igual ao último, ignora
  if (!body || sig === aiState.lastThoughtSig) return;

  // Atualiza estado global
  aiState.lastThoughtSig = sig;
  if (!aiState.thoughtsBootstrapped) aiState.thoughtsBootstrapped = true;

  // 2. Criação do HTML (Chama a função 1)
  const card = criarElementoCardPensamento(title, body);

  // 3. Inserção no DOM
  // Insere ANTES do skeleton (para o skeleton ficar sempre por último pulsando)
  const firstSkeleton = listEl.querySelector('.maia-thought-card--skeleton');
  if (firstSkeleton) {
    listEl.insertBefore(card, firstSkeleton);
  } else {
    listEl.appendChild(card);
  }

  // 4. Scroll (Chama a função 2)
  executarSmartScroll(listEl);
}

export function montarBotaoResumeScroll() {
  const sidebarMain = document.getElementById('viewerSidebar');
  let btnResume = document.getElementById('resumeScrollBtn');

  // Se não tiver sidebar, não tem onde por botão. Se o botão já existe, não recria.
  if (!sidebarMain || btnResume) return btnResume;

  btnResume = document.createElement('button');
  btnResume.id = 'resumeScrollBtn';
  btnResume.innerHTML = '⬇'; // Down arrow
  btnResume.title = 'Voltar ao topo das novidades';

  sidebarMain.appendChild(btnResume); // Anexa ao Pai Relativo

  // Comportamento do Clique
  btnResume.onclick = (e) => {
    e.stopPropagation();
    window.__userInterruptedScroll = false; // Usuário aceitou voltar ao automático

    // Tenta pegar o container (função auxiliar que você deve ter no código)
    const el = getScrollContainer();

    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }

    btnResume.classList.remove('visible');
  };

  return btnResume;
}

export function anexarListenerDeScroll(scrollTarget) {
  if (!scrollTarget) return;

  scrollTarget.addEventListener(
    'scroll',
    () => {
      // Só importa se a IA estiver gerando texto
      if (!window.__isProcessing) return;

      const distanceToBottom =
        scrollTarget.scrollHeight -
        (scrollTarget.scrollTop + scrollTarget.clientHeight);
      const isAtBottom = distanceToBottom < 50; // Tolerância

      const btnResume = document.getElementById('resumeScrollBtn');

      if (isAtBottom) {
        // Usuário voltou ao fundo manualmente
        window.__userInterruptedScroll = false;
        if (btnResume) btnResume.classList.remove('visible');
      } else {
        // Usuário subiu a tela
        window.__userInterruptedScroll = true;
        if (btnResume) btnResume.classList.add('visible');
      }
    },
    { passive: true }
  );
}

export function configurarSmartScroll() {
  // Tenta pegar o alvo do scroll (container criado antes)
  const scrollTarget = getScrollContainer();

  // Validação de segurança
  if (!scrollTarget || scrollTarget.dataset.scrollListenerAdded) return;

  // Marca como configurado para não duplicar
  scrollTarget.dataset.scrollListenerAdded = 'true';

  // 1. Cria o botão na interface
  montarBotaoResumeScroll();

  // 2. Começa a ouvir o scroll
  anexarListenerDeScroll(scrollTarget);
}

export function prepararAreaDeResposta() {
  // 1. Garante Estrutura (Sidebar + Resizer)
  const sidebar = garantirSidebarEBackdrop();
  configurarSidebarMobile(sidebar);

  const resizer = montarResizerLateral();
  mostrarPainel();
  configurarResizer(resizer);

  // 2. Limpa e Carrega Loader
  limparResultadosAnteriores(sidebar);
  const refsLoader = construirSkeletonLoader(sidebar);

  if (!refsLoader) return null; // Deu erro na criação

  // 3. Configura Scroll e Fecha Modal
  configurarSmartScroll();
  document.getElementById('cropConfirmModal').classList.remove('visible');

  // 4. Cria a função de Status (Closure)
  const { textElement } = refsLoader;

  const setStatus = (_s) => {
    if (textElement) {
      textElement.innerText = _s || 'Maia está pensando...';
    }
  };

  // Define status inicial
  setStatus();

  // Retorna o que a função principal vai precisar usar
  return {
    setStatus,
    refsLoader, // Retorna caso precise acessar thoughtListEl depois
  };
}