import { esconderPainel } from './sidebar.js';
import { mostrarPainel } from './sidebar.js';

export function garantirSidebarEBackdrop() {
  let sidebar = document.getElementById('viewerSidebar');
  const viewerBody = document.getElementById('viewerBody');
  const main = document.getElementById('viewerMain');

  // 1. Cria ou Recupera a Sidebar
  if (!sidebar) {
    sidebar = document.createElement('aside');
    sidebar.id = 'viewerSidebar';

    // JÁ INSERE NA DOM (pra não ficar aquele elemento solto na memória)
    if (viewerBody && main) {
      viewerBody.insertBefore(sidebar, main);
    }
  }

  // 2. Cria ou Recupera o Backdrop
  let backdrop = document.getElementById('sidebarBackdrop');
  if (!backdrop && viewerBody) {
    backdrop = document.createElement('div');
    backdrop.id = 'sidebarBackdrop';
    viewerBody.appendChild(backdrop);

    // Configura o clique para fechar (com segurança)
    backdrop.onclick = () => {
      esconderPainel();
    };
  }

  return sidebar;
}

export function criarHeaderMobile(sidebar) {
  // Evita duplicação
  if (sidebar.querySelector('#header-mobile-toggle')) {
    return sidebar.querySelector('#header-mobile-toggle');
  }

  const headerSidebar = document.createElement('div');
  headerSidebar.id = 'header-mobile-toggle';
  headerSidebar.innerHTML = `<div class="drag-handle"></div>`;

  sidebar.prepend(headerSidebar);

  return headerSidebar;
}

export function anexarToggleClique(headerSidebar) {
  const viewerBody = document.getElementById('viewerBody');

  const toggleSheet = () => {
    const isCollapsed = viewerBody.classList.contains('sidebar-collapsed');
    if (isCollapsed) {
      mostrarPainel();
    } else {
      esconderPainel();
    }
  };

  headerSidebar.onclick = (e) => {
    // Se estiver arrastando (flag global do escopo da sidebar), ignora
    // Como 'isDragging' era local, vamos checar se o elemento tem dataset de arraste
    if (headerSidebar.dataset.isDragging === 'true') return;

    e.preventDefault();
    e.stopPropagation();
    toggleSheet();
  };
}

export function anexarLogicaArrasteMobile(headerSidebar, sidebar) {
  const viewerBody = document.getElementById('viewerBody');
  let startY = 0;
  let currentTranslate = 0;
  const PEEK_HEIGHT = 50;

  const getSheetHeight = () => sidebar.offsetHeight;

  // --- TOUCH START ---
  headerSidebar.addEventListener(
    'touchstart',
    (e) => {
      const touch = e.touches[0];
      startY = touch.clientY;

      headerSidebar.dataset.isDragging = 'false';

      // Posição inicial
      const isCollapsed = viewerBody.classList.contains('sidebar-collapsed');
      currentTranslate = isCollapsed ? getSheetHeight() - PEEK_HEIGHT : 0;

      sidebar.style.transition = 'none'; // Tira animação para ficar fluido
    },
    { passive: true }
  );

  // --- TOUCH MOVE ---
  headerSidebar.addEventListener(
    'touchmove',
    (e) => {
      const touch = e.touches[0];
      const deltaY = touch.clientY - startY;
      const newTranslate = currentTranslate + deltaY;
      const maxTranslate = getSheetHeight() - PEEK_HEIGHT;

      // Limites com resistência
      if (newTranslate >= -20 && newTranslate <= maxTranslate + 20) {
        sidebar.style.transform = `translateY(${newTranslate}px)`;

        if (Math.abs(deltaY) > 5) {
          headerSidebar.dataset.isDragging = 'true';
        }
      }
    },
    { passive: true }
  );

  // --- TOUCH END ---
  headerSidebar.addEventListener(
    'touchend',
    (e) => {
      sidebar.style.transition = ''; // Restaura animação CSS
      sidebar.style.transform = ''; // Remove style inline

      const touch = e.changedTouches[0];
      const deltaY = touch.clientY - startY;

      // Decisão Magnética (Abre ou Fecha?)
      if (Math.abs(deltaY) > 60) {
        if (deltaY > 0) {
          esconderPainel();
        } else {
          mostrarPainel();
        }
      }

      // Delay para liberar o clique
      setTimeout(() => {
        headerSidebar.dataset.isDragging = 'false';
      }, 50);
    },
    { passive: true }
  );
}

export function configurarSidebarMobile(sidebar) {
  // 1. Cria HTML
  const header = criarHeaderMobile(sidebar);

  // Se já tinha listeners (verificando se já foi configurado), evita duplicar
  if (header.dataset.listenersAdded) return;

  // 2. Anexa Lógicas
  anexarToggleClique(header);
  anexarLogicaArrasteMobile(header, sidebar);

  header.dataset.listenersAdded = 'true';
}