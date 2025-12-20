import { esconderPainel } from './sidebar.js';

export function configurarResizerSidebar() {
  const sidebar = document.getElementById('viewerSidebar');
  const resizer = document.getElementById('sidebarResizer');

  // Se por algum motivo o HTML não carregou direito, aborta para não dar erro
  if (!sidebar || !resizer) return;

  // Configurações locais (ninguém mais precisa saber disso)
  const MIN_WIDTH = 200;
  const MAX_WIDTH = 600;
  let isResizing = false;

  // --- EVENTOS ---

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizer.classList.add('resizing');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault(); // Boa prática: evita comportamento padrão de arrastar imagem
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

export function montarResizerLateral() {
  const viewerBody = document.getElementById('viewerBody');
  const main = document.getElementById('viewerMain');

  // Se não tiver o corpo ou o main, não tem onde por o resizer
  if (!viewerBody || !main) return null;

  let resizer = document.getElementById('sidebarResizer');

  // Cria se não existir
  if (!resizer) {
    resizer = document.createElement('div');
    resizer.id = 'sidebarResizer';
  }

  // Garante que ele está inserido antes do conteúdo principal
  viewerBody.insertBefore(resizer, main);

  return resizer;
}

/**
 * Garante que a estrutura física do Sidebar e do Resizer existam no DOM.
 * Configura eventos de fechar e redimensionar.
 */
export const _garantirEstruturaSidebar = (
  viewerBody,
  main,
  sidebarExistente,
  resizerExistente
) => {
  let sidebar = sidebarExistente;
  let resizer = resizerExistente;

  // 1. CRIA A SIDEBAR (se necessário)
  if (!sidebar) {
    sidebar = document.createElement('aside');
    sidebar.id = 'viewerSidebar';
    viewerBody.insertBefore(sidebar, main);

    const headerSidebar = document.createElement('div');
    headerSidebar.style.cssText =
      'padding:10px; text-align:right; border-bottom:1px solid #ddd; margin-bottom:10px;';
    headerSidebar.innerHTML =
      '<small style="cursor:pointer; color:gray; font-weight:bold; text-transform:uppercase; font-size: 10px;">✕ Fechar Painel</small>';

    // Adicionei (e) aqui para garantir que o preventDefault funcione
    headerSidebar.onclick = (e) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      if (typeof esconderPainel === 'function') esconderPainel();
    };
    sidebar.appendChild(headerSidebar);
  }

  // 2. CRIA O RESIZER (se necessário)
  if (!resizer) {
    resizer = document.createElement('div');
    resizer.id = 'sidebarResizer';
    viewerBody.insertBefore(resizer, main);

    // Lógica de Redimensionamento
    if (!resizer.dataset.bound) {
      resizer.dataset.bound = '1';
      const MIN_W = 260,
        MAX_W = 700;
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
        let w = e.clientX;
        if (w < MIN_W) w = MIN_W;
        if (w > MAX_W) w = MAX_W;

        // Nota: acessa a variável 'sidebar' definida no escopo desta função
        if (sidebar) sidebar.style.width = `${w}px`;
      });

      document.addEventListener('mouseup', () => {
        if (!isResizing) return;
        isResizing = false;
        resizer.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      });
    }
  }

  // Retorna as referências (podem ter sido criadas agora ou mantidas as antigas)
  return { sidebar, resizer };
};