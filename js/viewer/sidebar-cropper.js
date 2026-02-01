import { CropperState } from "../cropper/cropper-state.js";
import {
  highlightGroup,
  initSelectionOverlay,
} from "../cropper/selection-overlay.js";
import { viewerState } from "../main.js";
import { showConfirmModal } from "../ui/modal-confirm.js";
import { SidebarPageManager } from "../ui/sidebar-page-manager.js";
import {
  addLogToQuestionTab,
  createQuestionTab,
  getTabsState,
  initSidebarTabs,
  isHubActive,
  setHubRenderCallback,
  updateTabStatus,
} from "../ui/sidebar-tabs.js";

export function initSidebarCropper() {
  const sidebar = document.getElementById("viewerSidebar");
  if (!sidebar) return;

  // Inicializa o sistema de abas
  initSidebarTabs();

  // Define o callback para renderizar o Hub
  setHubRenderCallback((container) => {
    renderHubContent(container);
  });

  // Inicializa o gerenciador de páginas (cria o container de páginas)
  SidebarPageManager.init();

  // Container Global (mantido apenas para o botão de adicionar no final, se desejado)
  // Mas o SidebarPageManager já ocupa o espaço.
  // Vamos injetar o botão "Adicionar" DEPOIS do container de páginas.

  let btnContainer = document.getElementById("sidebar-actions-footer");
  if (!btnContainer) {
    btnContainer = document.createElement("div");
    btnContainer.id = "sidebar-actions-footer";
    // Estilo simples para espaçamento
    btnContainer.style.padding = "10px";
    btnContainer.style.borderTop = "1px solid var(--border-color)";

    // Inserir após o container de páginas
    const pagesContainer = document.getElementById(
      SidebarPageManager.containerId,
    );
    if (pagesContainer) {
      pagesContainer.insertAdjacentElement("afterend", btnContainer);
    } else {
      sidebar.appendChild(btnContainer);
    }
  }

  // Inscrever-se nas mudanças de estado
  CropperState.subscribe(() => {
    // Só renderiza se a aba Hub estiver ativa
    if (isHubActive()) {
      renderSidebarContent();
    }
  });

  // Render inicial
  renderSidebarContent();

  // Garante que o sistema de overlay esteja ouvindo
  initSelectionOverlay();

  // FIX: User request "acompanhar scroll quando criando questao"
  document.addEventListener("maia:pagechanged", () => {
    // Se tivermos um grupo ativo SEM recortes (estamos criando),
    // ele deve "pular" para a página nova conforme o usuário scrolla.
    const active = CropperState.getActiveGroup();
    if (active && active.crops.length === 0) {
      renderSidebarContent();
    }
  });
}

/**
 * Renderiza o conteúdo do Hub (Lista de questões por página)
 * Chamado pelo sistema de abas quando a aba Hub está ativa
 */
function renderHubContent(container) {
  // Garantir que os containers necessários existam dentro do container fornecido
  let pagesContainer = container.querySelector("#sidebar-pages-container");
  if (!pagesContainer) {
    pagesContainer = document.createElement("div");
    pagesContainer.id = "sidebar-pages-container";
    pagesContainer.className = "sidebar-pages-container";
    pagesContainer.style.pointerEvents = "auto";
    container.appendChild(pagesContainer);
  }

  let btnContainer = container.querySelector("#sidebar-actions-footer");
  if (!btnContainer) {
    btnContainer = document.createElement("div");
    btnContainer.id = "sidebar-actions-footer";
    btnContainer.style.padding = "10px";
    btnContainer.style.borderTop = "1px solid var(--border-color)";
    container.appendChild(btnContainer);
  }

  // Reinicializar o SidebarPageManager com o novo container
  SidebarPageManager.init(0, pagesContainer);

  // Renderizar o conteúdo
  renderSidebarContent();
}

function renderSidebarContent() {
  // 1. Limpa todas as perguntas de todas as páginas (para re-renderizar corretamente)
  // Como não sabemos quais páginas têm coisas, poderíamos limpar tudo ou ser mais cirúrgicos.
  // Para simplificar: SidebarPageManager poderia ter um 'clearAllQuestions()'.
  // Vamos iterar pelos grupos e organizar.

  // Melhor abordagem: Limpar containers de questões conhecidos ou resetar o Manager?
  // Resetar o Manager fecha os details, o que é ruim.
  // Vamos limpar individualmente as listas de questões das páginas que vamos tocar?
  // Ou melhor: Limpar TODAS as listas de questões visíveis.

  const allQuestionLists = document.querySelectorAll(".page-questions-list");
  // Store placeholders content to restore later if the page remains empty of groups
  const preservedPlaceholders = {};

  allQuestionLists.forEach((el) => {
    const placeholder = el.querySelector(".empty-page-placeholder");
    if (placeholder) {
      // Find page number from parent details id 'page-details-X'
      const details = el.closest(".page-details-group");
      if (details) {
        const idParts = details.id.split("-");
        const pageNum = parseInt(idParts[idParts.length - 1]);
        preservedPlaceholders[pageNum] = placeholder;
      }
    }
    el.innerHTML = "";
  });

  const groups = CropperState.groups;
  const activeGroup = CropperState.getActiveGroup();

  // Garante que o botão global de adicionar (rodapé) esteja presente
  const footer = document.getElementById("sidebar-actions-footer");
  if (footer) {
    // Remove empty state antigo se houver
    const empty = footer.querySelector(".cropper-empty-state");
    if (empty) empty.remove();

    // Renderiza botão de adicionar
    renderAddButton(footer);
  }

  // Removemos a verificação de groups.length === 0 com retorno antecipado
  // para permitir que os placeholders por página sejam renderizados.

  groups.forEach((group) => {
    // Skip rendering for slot-mode groups
    if (group.tags && group.tags.includes("slot-mode")) return;

    // Determinar a página
    let pageNum = 1;
    if (group.crops && group.crops.length > 0) {
      // Fix: Support both legacy 'page' and new 'anchorData.anchorPageNum'
      const firstCrop = group.crops[0];
      if (firstCrop.anchorData && firstCrop.anchorData.anchorPageNum) {
        pageNum = firstCrop.anchorData.anchorPageNum;
      } else if (firstCrop.page) {
        pageNum = firstCrop.page;
      }
    } else {
      // Se não tiver crop, tenta pegar a página atual do viewer ou assume 1
      // Tenta pegar de uma variável global ou data attribute
      const viewer = document.getElementById("viewer"); // PDF.js wrapper container often has info
      // Fallback: Se estamos no meio de um processo, talvez ScannerUI.activePage
      // Melhor: Se for criação manual, o usuário está vendo uma página.
      // Vamos tentar inferir ou usar 1.
      // TODO: Melhorar detecção de página atual para grupos vazios.

      // User Request: "onde o user croppar vai pra página respectiva o card da questão"
      // Usamos viewerState.pageNum como a verdade absoluta da página visível atual
      pageNum = viewerState.pageNum || 1;
    }

    // Garante que a seção da página existe
    const details = SidebarPageManager.getPageElement(pageNum);
    const listContainer = SidebarPageManager.getQuestionsContainer(pageNum);

    // [FIX] Guard against null when Hub is not active or container doesn't exist
    if (!details || !listContainer) {
      console.warn(
        `[sidebar-cropper] Cannot render group ${group.id} - details or listContainer is null for page ${pageNum}`,
      );
      return;
    }

    // Se o grupo está sendo editado, talvez abrir a página automaticamente?
    // User request: "quando a ia tiver analisando aquela página a sidebar sozinha vai abrir o details"
    // Para edição manual, também faz sentido.
    if (activeGroup && activeGroup.id === group.id) {
      details.open = true;
    }

    const isEditing = activeGroup && activeGroup.id === group.id;
    const item = createGroupCard(group, isEditing);

    // Adiciona na lista da página
    listContainer.appendChild(item);
  });

  // Check per-page empty states for ALL pages
  if (viewerState.pdfDoc && viewerState.pdfDoc.numPages) {
    for (let i = 1; i <= viewerState.pdfDoc.numPages; i++) {
      // Se a página não tiver grupos renderizados acima, checkAndShowEmptyState vai adicionar o placeholder
      SidebarPageManager.updatePageFooter(i);
    }
  } else {
    // Fallback: Se não temos numPages (ex: init), tenta usar os preserved ou DOM existente
    for (const pageNumStr of Object.keys(preservedPlaceholders)) {
      const p = parseInt(pageNumStr);
      SidebarPageManager.updatePageFooter(p);
    }
  }

  setTimeout(() => {
    // O seletor deve bater com a classe usada em createGroupCard (.active)
    const activeCard = document.querySelector(".cropper-group-item.active");
    if (activeCard) {
      activeCard.scrollIntoView({ behavior: "smooth", block: "center" });

      // User Request (Refinement): "fechar o que não for usado"
      // Se estamos editando um grupo (activeGroup existe), fecha as outras páginas
      // para dar foco total na página onde a questão está "vivendo" ou sendo criada.
      // Precisamos saber a página do activeGroup.
      // Já calculamos 'pageNum' dentro do loop, mas aqui estamos fora.
      // Vamos re-calcular ou pegar do DOM?
      // Pegando do DOM é mais seguro pois é onde o card foi renderizado.
      const parentDetails = activeCard.closest(".page-details-group");
      if (parentDetails) {
        const idParts = parentDetails.id.split("-");
        const activePageNum = parseInt(idParts[idParts.length - 1]);

        // Fecha todas menos esta
        SidebarPageManager.closeAllPagesExcept(activePageNum);
      }
    }
  }, 100);
}

function renderAddButton(container) {
  if (!container) return;
  // Evita duplicar
  if (container.querySelector(".btn-add-question")) return;

  const btnAdd = document.createElement("button");
  btnAdd.className = "btn btn--primary btn--full-width btn-add-question";
  btnAdd.innerHTML = `<span class="icon">＋</span> Adicionar Nova Questão`;
  btnAdd.onclick = () => {
    // Tenta capturar página atual antes de criar
    // Exemplo fictício: window.PDFViewerApplication.page
    // Se não tivermos acesso fácil, o padrão será 1 e quando o usuário desenhar o crop,
    // o grupo será atualizado com a página correta e moverá de lugar.

    // [FIX] Mobile: Fecha sidebar para user ver o PDF
    if (window.innerWidth <= 900) {
      import("./sidebar.js").then(({ esconderPainel }) => esconderPainel());
    }

    CropperState.createGroup({ tags: ["manual", "NOVO"] });

    // Scroll?
  };
  container.appendChild(btnAdd);
}

function renderEmptyStateGlobal(container) {
  if (!container) return;
  container.innerHTML = ""; // Limpa botão de add se tiver

  const emptyMsg = document.createElement("div");
  emptyMsg.className = "cropper-empty-state";
  emptyMsg.innerHTML = `
      <div style="font-size: 2rem; margin-bottom: 0.5rem;">✂️</div>
      <p>Nenhuma questão criada</p>
      <small>Adicione uma questão para começar a recortar</small>
    `;

  const btnAdd = document.createElement("button");
  btnAdd.className = "btn btn--primary btn--full-width btn-add-question";
  btnAdd.style.marginTop = "1rem";
  btnAdd.innerHTML = `<span class="icon">＋</span> Adicionar Nova Questão`;
  btnAdd.onclick = () => {
    // [FIX] Mobile: Fecha sidebar
    if (window.innerWidth <= 900) {
      import("./sidebar.js").then(({ esconderPainel }) => esconderPainel());
    }
    CropperState.createGroup({ tags: ["manual", "NOVO"] });
  };

  emptyMsg.appendChild(btnAdd);
  container.appendChild(emptyMsg);
}

function createGroupCard(group, isEditing) {
  const item = document.createElement("div");
  item.className = `cropper-group-item ${isEditing ? "active" : ""}`;

  // Apply visual color indicator (Left Border + Subtle BG)
  const color = CropperState.getGroupColor(group);
  item.style.borderLeft = `5px solid ${color}`;

  // Estado inicial do background
  const initialBackground = `linear-gradient(90deg, ${color}15 0%, transparent 40%)`;
  const fullBackground = `linear-gradient(90deg, ${color}40 0%, ${color}20 50%, transparent 100%)`;
  item.style.background = initialBackground;
  item.style.transition = "background 0.4s ease";

  // HOVER ANIMATION: Controlada 100% via JavaScript
  let hoverTimeout = null;
  let isHighlightActive = false;
  let animationFrame = null;
  let animationStartTime = null;
  let isAnimating = false;
  let currentProgress = 0; // 0 a 1

  // Função que gera o background baseado no progresso (0 a 1)
  function getGradientForProgress(progress) {
    // Interpola os valores:
    // opacity: 15 -> 40 (hex: 15 = 0.08, 40 = 0.25)
    // stop1: 40% -> 100%
    const opacity1 = Math.round(15 + (40 - 15) * progress); // 15 -> 40
    const opacity2 = Math.round(0 + 20 * progress); // 0 -> 20
    const stop1 = Math.round(40 + (100 - 40) * progress); // 40% -> 100%
    const stop2 = Math.round(0 + 50 * progress); // 0% -> 50%

    if (progress < 0.1) {
      return `linear-gradient(90deg, ${color}${opacity1.toString(16).padStart(2, "0")} 0%, transparent ${stop1}%)`;
    }
    return `linear-gradient(90deg, ${color}${opacity1.toString(16).padStart(2, "0")} 0%, ${color}${opacity2.toString(16).padStart(2, "0")} ${stop2}%, transparent ${stop1}%)`;
  }

  // Animação de entrada (0% -> 100% em 1 segundo)
  function animateIn(timestamp) {
    if (!animationStartTime) animationStartTime = timestamp;
    const elapsed = timestamp - animationStartTime;
    const duration = 1000; // 1 segundo

    currentProgress = Math.min(elapsed / duration, 1);
    item.style.background = getGradientForProgress(currentProgress);

    if (currentProgress < 1 && isAnimating) {
      animationFrame = requestAnimationFrame(animateIn);
    } else if (currentProgress >= 1) {
      // Animação completa - ativa highlight
      isHighlightActive = true;
      isAnimating = false;
      highlightGroup(group.id);
    }
  }

  // Animação de saída (currentProgress -> 0% em 0.4 segundos)
  function animateOut(timestamp) {
    if (!animationStartTime) animationStartTime = timestamp;
    const elapsed = timestamp - animationStartTime;
    const duration = 400; // 0.4 segundos
    const startProgress = currentProgress;

    const progress = Math.min(elapsed / duration, 1);
    const newProgress = startProgress * (1 - progress); // Interpola de startProgress para 0

    currentProgress = newProgress;
    item.style.background = getGradientForProgress(currentProgress);

    if (progress < 1 && isAnimating) {
      animationFrame = requestAnimationFrame(animateOut);
    } else {
      // Animação completa - volta ao estado inicial
      item.style.background = initialBackground;
      isAnimating = false;
      currentProgress = 0;
    }
  }

  item.addEventListener("mouseenter", () => {
    // Bloqueia hover se estiver editando ou se a IA estiver rodando
    if (isEditing) return;
    if (document.body.classList.contains("ai-scanning-active")) return;

    // Cancela qualquer animação em andamento
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }

    // Inicia animação de entrada
    isAnimating = true;
    animationStartTime = null;
    animationFrame = requestAnimationFrame(animateIn);
  });

  item.addEventListener("mouseleave", () => {
    // Cancela animação de entrada se ainda não completou
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }

    // Remove highlight do visualizador
    if (isHighlightActive) {
      highlightGroup(null);
      isHighlightActive = false;
    }

    // Inicia animação de saída
    isAnimating = true;
    animationStartTime = null;
    animationFrame = requestAnimationFrame(animateOut);
  });

  // HEADER (Título + Contador)
  const header = document.createElement("div");
  header.className = "cropper-group-header";

  const title = document.createElement("span");
  title.className = "cropper-group-title";
  title.innerText = group.label;

  const count = document.createElement("span");
  count.className = "cropper-group-count";
  count.innerText = `${group.crops.length}`;

  header.appendChild(title);

  // Render Tags (Safety Checked)
  try {
    if (Array.isArray(group.tags) && group.tags.length > 0) {
      const tagsContainer = document.createElement("div");
      tagsContainer.className = "cropper-group-tags";
      tagsContainer.style.display = "flex";
      tagsContainer.style.gap = "4px";
      tagsContainer.style.marginLeft = "auto";
      tagsContainer.style.marginRight = "8px";

      group.tags.forEach((tag) => {
        const badge = document.createElement("span");
        badge.className = `question-badge`;

        // Add specific class based on tag
        if (tag === "manual" || tag === "ia" || tag === "revisada") {
          badge.classList.add(tag);
        }

        // Set text content
        if (tag === "manual") {
          badge.innerText = "MANUAL";
        } else if (tag === "ia") {
          badge.innerText = "IA";
        } else if (tag === "revisada") {
          badge.innerText = "REVISADA";
        } else {
          badge.innerText = tag;
        }

        tagsContainer.appendChild(badge);
      });
      header.appendChild(tagsContainer);
    }
  } catch (err) {
    console.warn("Error rendering tags:", err);
  }

  header.appendChild(count);
  item.appendChild(header);

  // ACTIONS CONTAINER
  const actionsDiv = document.createElement("div");
  actionsDiv.className = "cropper-actions";

  if (isEditing) {
    // --- MODO EDIÇÃO (INLINE) ---

    // Container para botões de undo lado a lado
    const undoContainer = document.createElement("div");
    undoContainer.style.display = "flex";
    undoContainer.style.gap = "0.5rem";
    undoContainer.style.marginBottom = "0.5rem";

    const btnUndo = document.createElement("button");
    btnUndo.className = "btn btn--secondary btn--sm";
    btnUndo.style.flex = "1";
    btnUndo.innerText = "⟲ Desfazer";
    btnUndo.title = "Desfazer última ação (Ctrl+Z)";
    btnUndo.disabled = !CropperState.canUndo();
    btnUndo.onclick = (e) => {
      e.stopPropagation();
      CropperState.undo();
    };

    const btnRedo = document.createElement("button");
    btnRedo.className = "btn btn--secondary btn--sm";
    btnRedo.style.flex = "1";
    btnRedo.innerText = "⟳ Refazer";
    btnRedo.title = "Refazer ação desfeita (Ctrl+Shift+Z)";
    btnRedo.disabled = !CropperState.canRedo();
    btnRedo.onclick = (e) => {
      e.stopPropagation();
      CropperState.redo();
    };

    undoContainer.appendChild(btnUndo);
    undoContainer.appendChild(btnRedo);

    const btnRevert = document.createElement("button");
    btnRevert.className = "btn btn--outline btn--sm btn--full-width";
    btnRevert.innerText = "↺ Reverter Tudo";
    btnRevert.title = "Voltar ao estado antes de começar a editar";
    btnRevert.style.marginBottom = "0.5rem";
    btnRevert.disabled = !CropperState.editingSnapshot;
    btnRevert.onclick = (e) => {
      e.stopPropagation();
      CropperState.revert();
    };

    const btnCancel = document.createElement("button");
    btnCancel.className = "btn btn--outline btn--sm btn--full-width";
    btnCancel.innerText = "Cancelar";
    btnCancel.style.marginBottom = "0.5rem";
    btnCancel.onclick = async (e) => {
      e.stopPropagation();

      const isCreatingNew =
        Array.isArray(group.tags) && group.tags.includes("NOVO");

      if (window.__isManualPageAdd) {
        try {
          const { restaurarVisualizacaoOriginal, resetarInterfaceBotoes } =
            await import("../cropper/cropper-core.js");
          await restaurarVisualizacaoOriginal();
          resetarInterfaceBotoes();
        } catch (err) {
          console.error("Erro ao limpar modo manual:", err);
        }
      }

      // Se estamos CRIANDO uma nova (mesmo com crops), o Cancelar deve destruir tudo.
      // Se estamos EDITANDO uma existente, o Cancelar deve apenas parar de editar.
      // Se o grupo estiver vazio, sempre deleta (lixo).
      if (group.crops.length === 0 || isCreatingNew) {
        CropperState.deleteGroup(group.id);
      } else {
        CropperState.setActiveGroup(null);
      }
    };

    const btnDone = document.createElement("button");
    btnDone.className = "btn btn--primary btn--sm btn--full-width";
    btnDone.innerText = "Concluir";

    if (group.crops.length === 0) {
      btnDone.disabled = true;
      btnDone.style.opacity = "0.5";
      btnDone.style.cursor = "not-allowed";
      btnDone.title = "Faça pelo menos uma seleção para concluir";
    }

    btnDone.onclick = async (e) => {
      e.stopPropagation();

      if (group.crops.length === 0) return;

      // Logic: If tag is 'ia', switch to 'revisada', also remove 'NOVO'
      if (Array.isArray(group.tags)) {
        // Remove NOVO marker on done
        group.tags = group.tags.filter((t) => t !== "NOVO");

        if (group.tags.includes("ia")) {
          group.tags = group.tags.filter((t) => t !== "ia");
          group.tags.push("revisada");
        }
      } else if (!group.tags) {
        group.tags = [];
      }

      if (window.__isManualPageAdd) {
        try {
          const { restaurarVisualizacaoOriginal, resetarInterfaceBotoes } =
            await import("../cropper/cropper-core.js");
          await restaurarVisualizacaoOriginal();
          resetarInterfaceBotoes();
        } catch (err) {
          console.error("Erro ao limpar modo manual:", err);
        }
      }

      CropperState.setActiveGroup(null);
    };

    actionsDiv.appendChild(undoContainer);
    actionsDiv.appendChild(btnRevert);
    actionsDiv.appendChild(btnCancel);
    actionsDiv.appendChild(btnDone);
  } else {
    // --- VERIFICAÇÃO DE ESTADO DE PROCESSAMENTO (FIX) ---
    // Verifica se existe uma aba de processamento ativa para este grupo
    let isProcessing = false;
    // Import dinâmico ou acesso global? tabsState é exportado?
    // Vamos usar uma abordagem baseada em classe CSS ou atributo no grupo se possível.
    // Mas o estado está no sidebar-tabs. Precisamos checar lá.
    // Como estamos dentro de um loop de render, import pode ser lento.
    // Melhor: Adicionar uma propriedade 'isProcessing' ao objeto group no CropperState?
    // OU: Verificar se existe um elemento visual indicando processamento? Não, estamos recriando.

    // Vamos checar o tabsState via função exportada que adicionamos
    const tabs = getTabsState().tabs;
    const relatedTab = tabs.find((t) => t.groupId === group.id);

    if (group.status === "sent") {
      // [NOVO] Estado Salvo/Concluído (Solicitado pelo User)
      // Prioridade ALTA: Se já foi enviado, mostra sucesso mesmo se a aba ainda estiver fechando
      actionsDiv.innerHTML = `
        <div style="
            width: 100%;
            padding: 8px;
            text-align: center;
            background: rgba(76, 175, 80, 0.1); /* Green tint */
            border: 1px solid #4CAF50;
            border-radius: 4px;
            color: #4CAF50;
            font-size: 0.9em;
            font-weight: 500;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        ">
            ✅ Salvo no banco de dados!
        </div>
      `;
    } else if (group.status === "ready") {
      // [BATCH] Questão processada pela IA, aguardando envio manual
      actionsDiv.innerHTML = `
        <div style="
            width: 100%;
            padding: 8px;
            text-align: center;
            background: rgba(34, 197, 94, 0.15);
            border: 1px solid rgba(34, 197, 94, 0.5);
            border-radius: 4px;
            color: #22c55e;
            font-size: 0.9em;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        ">
            ✅ Pronto para envio!
        </div>
      `;
    } else if (relatedTab) {
      // User request: "coloca só em processamento pra sempre"
      // Independente do status real (complete/error), aqui mostramos que está rolando/foi enviado.
      actionsDiv.innerHTML = `
        <div style="
            width: 100%;
            padding: 8px;
            text-align: center;
            background: rgba(var(--color-primary-rgb), 0.1);
            border: 1px dashed var(--color-primary);
            border-radius: 4px;
            color: var(--color-primary);
            font-size: 0.9em;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        ">
            <span class="spinner-sm" style="width: 14px; height: 14px; border-width: 2px;"></span>
            Em processamento...
        </div>
      `;
    } else {
      // --- MODO VISUALIZAÇÃO NORMAL ---
      const btnSend = document.createElement("button");
      btnSend.className = "btn btn--sm btn--primary";
      btnSend.style.flex = "1";
      btnSend.innerText = "Enviar";
      btnSend.onclick = async (e) => {
        e.stopPropagation();

        // Modal de confirmação
        const confirmed = await showConfirmModal(
          "Enviar Questão",
          "Você está prestes a enviar esta questão para processamento. Este processo envolve chamadas à IA e não pode ser cancelado após iniciado.",
          "Enviar",
          "Cancelar",
          true, // isPositiveAction - cor primária
        );

        if (!confirmed) return;

        // Criar nova aba para esta questão
        const tabId = createQuestionTab(group.id, group.label);

        // Atualizar status inicial
        updateTabStatus(tabId, { status: "processing", progress: 10 });
        addLogToQuestionTab(tabId, "Iniciando processamento...");

        // Força um update no CropperState para disparar re-render (agora com estado 'processing' detectado)
        // Mas como o render é async por causa do import, talvez seja melhor setar manual agora também
        // para feedback instantâneo.
        // FIX: Substituir botões por aviso de processamento (Visual Imediato)
        actionsDiv.innerHTML = `
                <div style="
                  width: 100%;
                  padding: 8px;
                  text-align: center;
                  background: rgba(var(--color-primary-rgb), 0.1);
                  border: 1px dashed var(--color-primary);
                  border-radius: 4px;
                  color: var(--color-primary);
                  font-size: 0.9em;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 8px;
              ">
                    <span class="spinner-sm" style="width: 14px; height: 14px; border-width: 2px;"></span>
                    Em processamento...
                </div>
            `;

        // Processar a questão
        import("../cropper/save-handlers.js").then((mod) => {
          mod.salvarQuestaoEmLote(group.id, tabId);
        });
      };

      const btnEdit = document.createElement("button");
      btnEdit.className = "btn btn--sm btn--secondary";
      btnEdit.innerText = "Editar";
      btnEdit.onclick = (e) => {
        e.stopPropagation();

        // [FIX] Mobile: Fecha sidebar
        if (window.innerWidth <= 900) {
          import("./sidebar.js").then(({ esconderPainel }) => esconderPainel());
        }

        CropperState.setActiveGroup(group.id);
      };

      const btnDel = document.createElement("button");
      btnDel.className = "btn btn--sm btn--outline btn-icon";
      btnDel.style.color = "var(--color-error)";
      btnDel.style.borderColor = "var(--color-error)";
      btnDel.innerHTML = "🗑️";
      btnDel.title = "Excluir Questão";
      btnDel.onclick = async (e) => {
        e.stopPropagation();
        const confirmed = await showConfirmModal(
          "Excluir Questão",
          `Tem certeza que deseja excluir "${group.label}"?`,
          "Excluir",
          "Cancelar",
        );
        if (confirmed) {
          CropperState.deleteGroup(group.id);
        }
      };

      actionsDiv.appendChild(btnSend);
      actionsDiv.appendChild(btnEdit);
      actionsDiv.appendChild(btnDel);
    }
  }

  item.appendChild(actionsDiv);
  return item;
}
