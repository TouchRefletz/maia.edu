// --- HELPER: Detecta o container correto de scroll (Mobile vs Desktop) ---
import { refreshOverlayPosition } from "../cropper/selection-overlay.js";

export function getScrollContainer() {
  const sidebar = document.getElementById("viewerSidebar");
  if (!sidebar) return null;

  // Mobile: O scroll fica no wrapper explícito
  if (window.innerWidth <= 900) {
    const wrapper = document.getElementById("maia-scroll-wrapper");
    if (wrapper) return wrapper;
    // Fallback para selector caso o ID não esteja lá
    const contentDiv = sidebar.querySelector("div:not(#header-mobile-toggle)");
    if (contentDiv) return contentDiv;
  }

  // Desktop: O scroll é no próprio sidebar
  return sidebar;
}

export function criarBackdropSeNecessario() {
  let backdrop = document.getElementById("sidebarBackdrop");
  const viewerBody = document.getElementById("viewerBody");
  if (!backdrop && viewerBody) {
    backdrop = document.createElement("div");
    backdrop.id = "sidebarBackdrop";
    viewerBody.appendChild(backdrop);
    // backdrop.onclick = () => esconderPainel(); // REMOVIDO: Sidebar agora é fixa
  }
  return backdrop;
}

export function esconderPainel(mostrarBotao = true) {
  const viewerBody = document.getElementById("viewerBody");
  // 1. Esconde o Painel (CSS)
  if (viewerBody) viewerBody.classList.add("sidebar-collapsed");

  // 2. Esconde o Backdrop
  const bd = document.getElementById("sidebarBackdrop");
  if (bd) {
    bd.style.opacity = "0";
    bd.style.pointerEvents = "none";
  }

  // 3. Destrava scroll do site
  document.body.style.overflow = "";

  if (mostrarBotao) mostrarBotaoReabrirPainel();

  // Show Floating Mobile Controls (Button & Panel State?)
  // User: "sumir quando abrir e voltar quando fechar"
  // Logic: Show Button. Keep Panel state (hidden or not) if we want, or just show button.
  // Actually simplest is: Remove .hidden from wrapper? No wrapper.
  const toolsBtn = document.getElementById("btnMobileTools");
  const closeBtn = document.getElementById("btnFloatingClose");
  if (toolsBtn) toolsBtn.style.display = ""; // Restore default (CSS handles mobile-only)
  if (closeBtn) closeBtn.style.display = "";

  // Note: floatingToolsPanel visibility is managed by the toggle. We don't auto-open it.

  // ATUALIZA O CROPPER IMEDIATAMENTE E DEPOIS DA ANIMAÇÃO
  refreshOverlayPosition();
  setTimeout(refreshOverlayPosition, 305); // 300ms é o transition do CSS comumente
}

export function mostrarPainel() {
  const viewerBody = document.getElementById("viewerBody");
  // 1. Mostra o Painel
  if (viewerBody) viewerBody.classList.remove("sidebar-collapsed");

  // Remove Glow Effects
  document
    .getElementById("header-mobile-toggle")
    ?.classList.remove("glow-effect");
  document.getElementById("reopenSidebarBtn")?.classList.remove("glow-effect");

  // Hide Floating Mobile Controls
  const toolsBtn = document.getElementById("btnMobileTools");
  const closeBtn = document.getElementById("btnFloatingClose");
  const toolsPanel = document.getElementById("floatingToolsPanel");

  if (toolsBtn) toolsBtn.style.display = "none";
  if (closeBtn) closeBtn.style.display = "none";
  if (toolsPanel) toolsPanel.classList.add("hidden"); // Also hide the popup if open

  // 2. Lógica Mobile (Backdrop e Scroll)
  if (window.innerWidth <= 900) {
    // Garante que o backdrop existe
    const bd = criarBackdropSeNecessario();
    if (bd) {
      // Forçar reflow se necessário, mas geralmente não precisa
      requestAnimationFrame(() => {
        bd.style.opacity = "1";
        bd.style.pointerEvents = "auto";
      });
    }
    document.body.style.overflow = "hidden";
  }

  // 3. REMOVE O BOTÃO DE REABRIR
  const btnReabrir = document.getElementById("reopenSidebarBtn");
  if (btnReabrir) {
    btnReabrir.remove();
  }

  // ATUALIZA O CROPPER IMEDIATAMENTE E DEPOIS DA ANIMAÇÃO
  refreshOverlayPosition();
  setTimeout(refreshOverlayPosition, 305);
}

export function mostrarBotaoReabrirPainel() {
  // 1. Guard Clauses (Verificações iniciais para sair rápido da função)
  const isMobile = window.innerWidth <= 900;
  const jaExiste = document.getElementById("reopenSidebarBtn");
  const container = document.getElementById("canvasContainer");

  if (isMobile || jaExiste || !container) return;

  // 2. Prepara o Container
  // Garante contexto de posicionamento apenas se necessário
  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }

  // 3. Criação do Elemento
  const btn = document.createElement("button");

  // Atributos básicos
  Object.assign(btn, {
    id: "reopenSidebarBtn",
    className: "flyingBtn botao-reabrir-flutuante", // Usa classes CSS!
    type: "button",
    title: "Reabrir painel da questão",
    innerHTML: "💬",
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
  resizer.dataset.bound = "1";

  const MIN_WIDTH = 260;
  const MAX_WIDTH = 700;
  let isResizing = false;

  // 1. Início do arraste
  resizer.addEventListener("mousedown", (e) => {
    isResizing = true;
    resizer.classList.add("resizing");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  });

  // 2. Movimento
  document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;

    let newWidth = e.clientX;
    if (newWidth < MIN_WIDTH) newWidth = MIN_WIDTH;
    if (newWidth > MAX_WIDTH) newWidth = MAX_WIDTH;

    const sb = document.getElementById("viewerSidebar");
    if (sb) sb.style.width = `${newWidth}px`;

    // SYNC CROPPER
    refreshOverlayPosition();
  });

  // 3. Fim do arraste
  document.addEventListener("mouseup", () => {
    if (!isResizing) return;

    isResizing = false;
    resizer.classList.remove("resizing");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });
}

// --- INTEGRAÇÃO COM MÓDULO DE CROPPER (NOVO) ---
import { initSidebarCropper } from "./sidebar-cropper.js";

export function inicializarSidebarCompleta() {
  // O header com botão de fechar agora é parte do sistema de abas (sidebar-tabs.js)
  // Não precisa mais criar aqui
  initSidebarCropper();
}
