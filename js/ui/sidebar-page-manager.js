import { splitThought } from "../sidebar/thoughts-base.js";

export const SidebarPageManager = {
  containerId: "sidebar-pages-container",

  init(totalPages = 0, specificContainer = null) {
    const parent = document.getElementById("viewerSidebar");
    if (!parent) return;

    // Verificar se container já existe ou usar o fornecido
    let container =
      specificContainer || document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement("div");
      container.id = this.containerId;
      container.className = "sidebar-pages-container";

      // POINTER EVENTS AUTO (Garante que cliques nos details funcionem)
      container.style.pointerEvents = "auto";

      // SEGURANÇA: Se o sistema de abas estiver ativo e NÃO for uma injeção explícita
      if (
        !specificContainer &&
        document.getElementById("sidebar-tabs-header")
      ) {
        // Estamos provavelmente numa aba de Questão, então não devemos recriar o Hub aqui.
        return;
      }

      // Inserir após o header da sidebar ou no topo
      const sidebarHeader = parent.querySelector(".sidebar-header");
      if (sidebarHeader) {
        sidebarHeader.insertAdjacentElement("afterend", container);
      } else {
        parent.prepend(container);
      }
    } else {
      // Limpa APENAS se estivermos reinicializando explicitamente (totalPages > 0)
      // Se totalPages == 0 (ou default), assumimos que é uma chamada de verificação/garantia,
      // então NÃO limpamos para preservar o estado (ex: questões manuais).
      if (totalPages > 0) {
        // Preserve global header and overlay if they exist, remove others
        Array.from(container.children).forEach((child) => {
          if (child.id !== "ai-scanner-global-header" && child.id !== "ai-sidebar-overlay") {
            child.remove();
          }
        });
      }
    }

    // Se totalPages foi passado, garante que todos os details existam
    if (totalPages > 0) {
      for (let i = 1; i <= totalPages; i++) {
        this.getPageElement(i);
      }
    }
  },

  getPageElement(pageNum) {
    let container = document.getElementById(this.containerId);
    if (!container) {
      // Se chamado sem init prévio, tenta init sem limpar (mas ideal é init correto)
      // Passar 0 não gera loop, só cria container
      this.init(0);
      container = document.getElementById(this.containerId);
    }

    const pageId = `page-details-${pageNum}`;
    let details = document.getElementById(pageId);

    if (!details) {
      details = document.createElement("details");
      details.id = pageId;
      details.className = "page-details-group";
      // details.open = false; // Começa fechado, abre sob demanda

      const summary = document.createElement("summary");
      summary.className = "page-summary";
      summary.innerHTML = `
        <div class="page-title-group">
          <span class="page-title">Página ${pageNum}</span>
          <button class="btn-scan-page-ai" data-page="${pageNum}" title="Analisar esta página com IA">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
          </button>
        </div>
        <span class="page-status-badge"></span>
      `;
      details.appendChild(summary);

      // Bind do botão de scan individual
      const btnScan = summary.querySelector(".btn-scan-page-ai");
      btnScan.onclick = async (e) => {
        e.stopPropagation(); // Evita abrir/fechar o details

        // Mostrar modal de confirmação
        const confirmed = await import("./modal-confirm.js").then((m) =>
          m.showConfirmModal(
            "Analisar Página com IA?",
            "Este processo analisará apenas esta página e não poderá ser cancelado. Deseja continuar?",
            "Analisar",
            "Voltar",
            true, // isPositiveAction = true (cor primária)
          ),
        );

        if (confirmed) {
          this._handleScanPageClick(pageNum);
        }
      };

      // Container para status dos agentes (IA)
      const agentsContainer = document.createElement("div");
      agentsContainer.className = "page-agents-status-list";
      details.appendChild(agentsContainer);

      // Container para cards de questões
      const questionsContainer = document.createElement("div");
      questionsContainer.className = "page-questions-list";
      details.appendChild(questionsContainer);

      // Inserir na ordem correta (pageNum crescente)
      // Simples append funciona se criarmos em ordem, mas garantindo:
      // [FIX] Guard against null container
      if (!container) {
        console.warn(
          `[SidebarPageManager] Container not found for page ${pageNum}, cannot insert.`,
        );
        return details;
      }
      const existingPages = Array.from(container.children);
      const nextSibling = existingPages.find((el) => {
        const p = parseInt(el.id.replace("page-details-", ""));
        return p > pageNum;
      });

      if (nextSibling) {
        container.insertBefore(details, nextSibling);
      } else {
        container.appendChild(details);
      }

      // Garante que o placeholder apareça por padrão na criação
      this.updatePageFooter(pageNum);
    }

    return details;
  },

  openPage(pageNum) {
    const details = this.getPageElement(pageNum);
    if (details) details.open = true;
  },

  updateAgentStatus(pageNum, agentType, text) {
    const details = this.getPageElement(pageNum);
    const agentsList = details.querySelector(".page-agents-status-list");

    // 1. Obter ultimo thought
    const lastThought = agentsList.lastElementChild;
    const isSameType =
      lastThought && lastThought.dataset.agentType === agentType;

    let thoughtEl;

    if (isSameType) {
      // Reusa existente
      thoughtEl = lastThought;
    } else {
      // Cria novo details
      thoughtEl = document.createElement("details");
      thoughtEl.className = "maia-thoughts";
      if (agentType) thoughtEl.classList.add(`type-${agentType}`);
      thoughtEl.dataset.agentType = agentType;
      // thoughtEl.open = false; // default

      const summary = document.createElement("summary");
      summary.className = "maia-thoughts-summary";
      thoughtEl.appendChild(summary);

      const bodyContainer = document.createElement("div");
      bodyContainer.id = "ai-thoughts-list"; // reuso de estilo
      // bodyContainer.className = "maia-thought-body-container";
      thoughtEl.appendChild(bodyContainer);

      agentsList.appendChild(thoughtEl);
    }

    // 2. Extrair dados com splitThought
    const thoughtData = splitThought(text);

    // Lógica Customizada para Status Específicos
    // Se o texto for um status curto e importante, ele vira o título do agente/details
    // e o corpo pode ser um texto descritivo padrão ou vazio.
    const statusKeywords = [
      "Interrompido.",
      "Nada a auditar.",
      "Extração finalizada.",
    ];
    let customTitle = null;
    let customBody = thoughtData.body;

    // Verifica se o texto processado (ou raw) bate com keywords
    if (
      statusKeywords.includes(thoughtData.title) ||
      statusKeywords.includes(text.trim())
    ) {
      customTitle = text.trim(); // O próprio texto é o status
      customBody = ""; // Sem corpo adicional necessário se não houver
    } else if (text.trim() === "Interrompido.") {
      customTitle = "Interrompido";
      customBody = "A operação foi cancelada pelo usuário.";
    }

    // Se o corpo estiver vazio e NÃO for um status de interrupção claro que dispense explicação,
    // colocamos a mensagem de "nenhuma questão".
    // Mas cuidado: se for apenas um título "Identifying Questions" com body vazio, não é "nenhuma questão".
    // A mensagem de "nenhuma questão" deve aparecer quando o PROCESSO termina e não achou nada.
    // O usuário disse: "não deixa o detail vazio assim quando não tem questão".
    // Isso geralmente acontece no agente 'auditor' ou 'correction' quando diz "Nada a auditar."

    if (customTitle) {
      thoughtData.title = customTitle;
    }

    if (!customBody || customBody.trim() === "") {
      // Se for um pensamento ativo (ex: "Identifying...") ok ter body vazio se for só titulo?
      // O user reclamou de "detail vazio".
      // Vamos colocar um placeholder se for realmente vazio visualmente.
      if (agentType === "auditor" && thoughtData.title === "Nada a auditar.") {
        customBody = "Nenhuma questão selecionada/encontrada para essa página.";
        // VERIFICAR EMPTY STATE AGORA
        this.updatePageFooter(pageNum);
      } else if (customBody === "") {
        // Se ainda assim vazio, deixamos vazio ou colocamos ...?
        // Se o title já diz tudo, talvez ok. Mas o user disse "não deixa vazio".
        // Vamos deixar vazio APENAS se o title for explicativo o suficiente, senão placeholder.
        // customBody = "...";
      }
    }

    if (customBody) thoughtData.body = customBody;

    // 3. Atualizar Summary (Icone + Titulo)
    // Ícones e Labels
    const config = {
      analysis: { icon: "🤖", label: "Análise" },
      auditor: { icon: "🔍", label: "Auditor" },
      correction: { icon: "✏️", label: "Corretor" },
      default: { icon: "⚙️", label: "Sistema" },
    };
    const typeConfig = config[agentType] || config.default;

    // Se tivermos um título extraído do texto (thoughtData.title), usamos ele no lugar do Label genérico
    // MAS mantemos o ícone do tipo.
    const displayTitle = thoughtData.title || typeConfig.label;

    const summaryEl = thoughtEl.querySelector("summary");
    summaryEl.innerHTML = `
        <div class="maia-thoughts-header-content">
            <div class="maia-thoughts-title-group">
                <span class="agent-icon" title="${typeConfig.label}">${
                  typeConfig.icon
                }</span>
                <span class="agent-text">${displayTitle}</span>
            </div>
        </div>
    `;

    // 4. Atualizar Body (Chain of Thought completo)
    const bodyContainer = thoughtEl.querySelector("#ai-thoughts-list");

    // Só adiciona card se houver algo para mostrar.
    // Se "thoughtData.body" for vazio, mas temos um TITLE que é novo, deveríamos logar o titulo no corpo tb?
    // Ex: "Verifying Boxes". Se isso for só titulo no summary, o histórico perde que verificou boxes.
    // O usuário quer Chain of Thought.
    // Então, sempre que chegar uma mensagem, ela deve virar um CARD, mesmo que curto.
    // O Summary reflete o "Latest State".

    // Se o body original era vazio mas extraímos um título (ex: "Identifying..."),
    // Então o conteúdo do card deve ser esse título, para ficar no histórico.

    // CORREÇÃO: User quer o título TAMBÉM no card aberto.
    // E quer remover os "..." (três pontos) que aparecem.

    // Se thoughtData.body for "...", ignoramos?
    if (thoughtData.body && thoughtData.body.trim() === "...") {
      thoughtData.body = "";
    }

    let cardContent = "";

    // Se tiver título e corpo, mostra ambos
    if (thoughtData.title && thoughtData.body) {
      // Se o título for IDÊNTICO ao corpo, mostra só um
      if (thoughtData.title.trim() === thoughtData.body.trim()) {
        cardContent = `<div class="maia-thought-body">${thoughtData.body}</div>`;
      } else {
        // Título em negrito/destaque + corpo
        cardContent = `
                <div class="maia-thought-title-inline" style="font-weight:700; margin-bottom:4px; color:var(--color-primary);">${thoughtData.title}</div>
                <div class="maia-thought-body">${thoughtData.body}</div>
             `;
      }
    } else if (thoughtData.title) {
      // Só título
      cardContent = `<div class="maia-thought-body is-title">${thoughtData.title}</div>`;
    } else if (thoughtData.body) {
      // Só corpo
      cardContent = `<div class="maia-thought-body">${thoughtData.body}</div>`;
    }

    if (cardContent) {
      // Check final anti-dot validation
      if (cardContent.includes(">...<") || cardContent.includes(">…<")) {
        // Skip rendering simple dot visuals
        return;
      }

      const cardHTML = `
            <div class="maia-thought-card">
                <div class="maia-thought-logo-wrap">
                    <img src="logo.png" class="maia-thought-logo" alt="Maia" />
                </div>
                <div class="maia-thought-content">
                    ${cardContent}
                </div>
            </div>
        `;
      // APPEND ao invés de substituir
      bodyContainer.insertAdjacentHTML("beforeend", cardHTML);

      // Auto-scroll para o final
      bodyContainer.scrollTop = bodyContainer.scrollHeight;
    }

    // Se o details estava fechado e chegou coisa nova, abrir
    // [FIX] NÃO fazer scroll automático aqui - o scroll deve ser controlado
    // pelo BatchProcessor para centralizar no CARD da questão, não nos pensamentos
    if (details) {
      details.open = true;
      // Scroll suave para o thought recém adicionado ou atualizado
      // Mas só se não estivermos muito longe (evitar saltos malucos se o user estiver lendo outra coisa?)
      // O user pediu "faca a sidebar ir ate ele". Então vamos forçar.
      setTimeout(() => {
        // Scroll no container da sidebar para mostrar este elemento
        // block: 'center' é o pedido "centralizar o detail em destaque"
        thoughtEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }
  },

  getQuestionsContainer(pageNum) {
    const details = this.getPageElement(pageNum);
    // [FIX] Return null if details doesn't exist (e.g., Hub not active)
    if (!details) return null;
    return details.querySelector(".page-questions-list");
  },

  clearQuestions(pageNum) {
    const container = this.getQuestionsContainer(pageNum);
    if (container) container.innerHTML = "";
  },

  updatePageFooter(pageNum) {
    const questionsContainer = this.getQuestionsContainer(pageNum);

    // Identificar se existem cartões de questão REAIS (ignorando placeholders/botoes antigos)
    const hasQuestions = Array.from(questionsContainer.children).some((child) =>
      child.classList.contains("cropper-group-item"),
    );

    // Limpar rodapés antigos (placeholders ou botões soltos)
    const oldPlaceholder = questionsContainer.querySelector(
      ".empty-page-placeholder",
    );
    if (oldPlaceholder) oldPlaceholder.remove();

    const oldBtn = questionsContainer.querySelector(
      ".btn-add-manual-page-footer",
    );
    if (oldBtn) oldBtn.remove();

    if (!hasQuestions) {
      // --- CASO 1: PÁGINA VAZIA (Exibir Placeholder Grande) ---
      const placeholder = document.createElement("div");
      placeholder.className = "empty-page-placeholder";
      placeholder.style.cssText = `
          padding: 12px;
          text-align: center;
          color: #888;
          font-size: 0.9em;
          background: rgba(255,255,255,0.05);
          border-radius: 6px;
          margin-top: 8px;
          border: 1px dashed #444;
      `;

      placeholder.innerHTML = `
        <div style="margin-bottom: 8px;">Nenhuma questão selecionada ou encontrada pela IA para esta página</div>
        <button class="btn-add-manual-page" style="
            background: var(--color-primary);
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.85em;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        ">
           ➕ Adicionar Questão
        </button>
      `;

      // Bind click
      const btn = placeholder.querySelector(".btn-add-manual-page");
      btn.onclick = (e) => this._handleAddClick(e, pageNum);

      questionsContainer.appendChild(placeholder);
    } else {
      // --- CASO 2: PÁGINA COM QUESTÕES (Exibir Botão Discreto no Final) ---
      const btnFooter = document.createElement("button");
      btnFooter.className = "btn-add-manual-page-footer";
      btnFooter.style.cssText = `
          width: 100%;
          background: transparent;
          border: 1px dashed #555;
          color: #aaa;
          padding: 8px;
          border-radius: 6px;
          margin-top: 8px;
          cursor: pointer;
          font-size: 0.85em;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
      `;
      btnFooter.innerHTML = "➕ Adicionar Outra Questão";

      btnFooter.onmouseover = () => {
        btnFooter.style.borderColor = "var(--color-primary)";
        btnFooter.style.color = "var(--color-primary)";
        btnFooter.style.background = "rgba(var(--color-primary-rgb), 0.05)";
      };
      btnFooter.onmouseout = () => {
        btnFooter.style.borderColor = "#555";
        btnFooter.style.color = "#aaa";
        btnFooter.style.background = "transparent";
      };

      btnFooter.onclick = (e) => this._handleAddClick(e, pageNum);

      questionsContainer.appendChild(btnFooter);
    }
  },

  _handleAddClick(e, pageNum) {
    e.stopPropagation();

    // [FIX] Mobile: Fecha sidebar para user ver o PDF ao criar/editar
    if (window.innerWidth <= 900) {
      import("../viewer/sidebar.js").then(({ esconderPainel }) =>
        esconderPainel(),
      );
    }

    import("../viewer/pdf-core.js").then(({ irParaPagina }) => {
      irParaPagina(pageNum);
      setTimeout(() => {
        import("../cropper/cropper-state.js").then(({ CropperState }) => {
          CropperState.createGroup({ tags: ["manual", "NOVO"] });
        });
      }, 100);
    });
  },

  _handleScanPageClick(pageNum) {
    import("../services/ai-scanner.js").then(({ AiScanner }) => {
      if (!AiScanner.lastPdfDoc) {
        customAlert("Nenhum documento carregado.", 3000);
        return;
      }
      AiScanner.processSinglePage(AiScanner.lastPdfDoc, pageNum);
    });
  },

  closeAllPagesExcept(pageNumToKeepOpen) {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const allDetails = container.querySelectorAll(".page-details-group");
    allDetails.forEach((detail) => {
      // Extrair numero da pagina do ID "page-details-X"
      const idParts = detail.id.split("-");
      const p = parseInt(idParts[idParts.length - 1]);

      if (p !== pageNumToKeepOpen) {
        detail.open = false;
      }
    });
  },
};
