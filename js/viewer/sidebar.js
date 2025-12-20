// --- HELPER: Detecta o container correto de scroll (Mobile vs Desktop) ---
export function getScrollContainer() {
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
}

export function criarBackdropSeNecessario() {
  let backdrop = document.getElementById('sidebarBackdrop');
  const viewerBody = document.getElementById('viewerBody');
  if (!backdrop && viewerBody) {
    backdrop = document.createElement('div');
    backdrop.id = 'sidebarBackdrop';
    viewerBody.appendChild(backdrop);
    backdrop.onclick = () => esconderPainel();
  }
  return backdrop;
}

export function esconderPainel() {
  const viewerBody = document.getElementById('viewerBody');
  // 1. Esconde o Painel (CSS)
  if (viewerBody) viewerBody.classList.add('sidebar-collapsed');

  // 2. Esconde o Backdrop
  const bd = document.getElementById('sidebarBackdrop');
  if (bd) {
    bd.style.opacity = '0';
    bd.style.pointerEvents = 'none';
  }

  // 3. Destrava scroll do site
  document.body.style.overflow = '';

  mostrarBotaoReabrirPainel();
}

export function mostrarPainel() {
  const viewerBody = document.getElementById('viewerBody');
  // 1. Mostra o Painel
  if (viewerBody) viewerBody.classList.remove('sidebar-collapsed');

  // Remove Glow Effects
  document
    .getElementById('header-mobile-toggle')
    ?.classList.remove('glow-effect');
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
  const btnReabrir = document.getElementById('reopenSidebarBtn');
  if (btnReabrir) {
    btnReabrir.remove();
  }
}

export function mostrarBotaoReabrirPainel() {
  // 1. Guard Clauses (Verificações iniciais para sair rápido da função)
  const isMobile = window.innerWidth <= 900;
  const jaExiste = document.getElementById('reopenSidebarBtn');
  const container = document.getElementById('canvasContainer');

  if (isMobile || jaExiste || !container) return;

  // 2. Prepara o Container
  // Garante contexto de posicionamento apenas se necessário
  if (getComputedStyle(container).position === 'static') {
    container.style.position = 'relative';
  }

  // 3. Criação do Elemento
  const btn = document.createElement('button');

  // Atributos básicos
  Object.assign(btn, {
    id: 'reopenSidebarBtn',
    className: 'flyingBtn botao-reabrir-flutuante', // Usa classes CSS!
    type: 'button',
    title: 'Reabrir painel da questão',
    innerHTML: '💬',
  });

  // 4. Comportamento
  btn.onclick = () => {
    mostrarPainel();
  };

  // 5. Inserção
  container.appendChild(btn);
  // console.log("Botão de reabrir anexado ao container.");
}

export function configurarResizer(resizer) {
  // Validação: Se não existir ou já estiver configurado, sai fora.
  if (!resizer || resizer.dataset.bound) return;

  // Marca como configurado
  resizer.dataset.bound = '1';

  const MIN_WIDTH = 260;
  const MAX_WIDTH = 700;
  let isResizing = false;

  // 1. Início do arraste
  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizer.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  // 2. Movimento
  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    let newWidth = e.clientX;
    if (newWidth < MIN_WIDTH) newWidth = MIN_WIDTH;
    if (newWidth > MAX_WIDTH) newWidth = MAX_WIDTH;

    const sb = document.getElementById('viewerSidebar');
    if (sb) sb.style.width = `${newWidth}px`;
  });

  // 3. Fim do arraste
  document.addEventListener('mouseup', () => {
    if (!isResizing) return;

    isResizing = false;
    resizer.classList.remove('resizing');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
}
