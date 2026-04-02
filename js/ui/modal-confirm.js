/**
 * Exibe um modal de confirmação genérico.
 * @param {string} title - O título do modal.
 * @param {string} message - A mensagem de descrição.
 * @param {string} confirmText - Texto do botão de confirmar.
 * @param {string} cancelText - Texto do botão de cancelar.
 * @param {boolean} isPositiveAction - Se true, usa cor primária; se false, usa cor de erro (padrão: false).
 * @returns {Promise<boolean>} - Retorna true se confirmado, false se cancelado.
 */
export function showConfirmModal(
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  isPositiveAction = false,
) {
  return new Promise((resolve) => {
    // Criação do Overlay
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay custom-confirm-overlay hidden";

    // Criação do Content
    const content = document.createElement("div");
    content.className = "modal-content custom-confirm-content";

    // Header
    const header = document.createElement("div");
    header.className = "modal-header";
    header.innerHTML = `<h2>${title}</h2>`;

    // Body
    const body = document.createElement("div");
    body.className = "modal-body";

    const desc = document.createElement("p");
    desc.innerText = message;
    body.appendChild(desc);

    // Footer
    const footer = document.createElement("div");
    footer.className = "modal-footer";
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "10px";

    const btnCancel = document.createElement("button");
    btnCancel.className = "btn btn--outline";
    btnCancel.innerText = cancelText;

    const btnConfirm = document.createElement("button");
    btnConfirm.className = "btn btn--primary";

    // Define cor baseado em isPositiveAction
    if (isPositiveAction) {
      btnConfirm.style.backgroundColor = "var(--color-primary)";
      btnConfirm.style.borderColor = "var(--color-primary)";
    } else {
      btnConfirm.style.backgroundColor = "var(--color-error)";
      btnConfirm.style.borderColor = "var(--color-error)";
    }

    btnConfirm.innerText = confirmText;

    footer.appendChild(btnCancel);
    footer.appendChild(btnConfirm);

    // Montagem
    content.appendChild(header);
    content.appendChild(body);
    content.appendChild(footer);
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // Animação de entrada
    requestAnimationFrame(() => {
      overlay.classList.remove("hidden");
    });

    // Handlers
    const close = (value) => {
      overlay.style.opacity = "0";
      setTimeout(() => {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
        resolve(value);
      }, 300);
    };

    btnCancel.onclick = () => close(false);
    btnConfirm.onclick = () => close(true);

    overlay.onclick = (e) => {
      if (e.target === overlay) close(false);
    };

    // Keyboard support
    const handleKey = (e) => {
      if (e.key === "Escape") {
        document.removeEventListener("keyup", handleKey);
        close(false);
      }
      if (e.key === "Enter") {
        document.removeEventListener("keyup", handleKey);
        close(true);
      }
    };
    document.addEventListener("keyup", handleKey);
  });
}

/**
 * Exibe um modal de confirmação para edição do título da prova.
 * @param {string} currentTitle - O título atual da prova.
 * @returns {Promise<string|null>} - Retorna o novo título se confirmado, ou null se cancelado.
 */
/**
 * Exibe um modal de confirmação com checkbox obrigatório.
 * @param {string} title - O título do modal.
 * @param {string} message - A mensagem de descrição.
 * @param {string} checkboxLabel - Texto do checkbox (responsabilidade legal).
 * @param {string} confirmText - Texto do botão de confirmar.
 * @param {string} cancelText - Texto do botão de cancelar.
 * @param {boolean} isPositiveAction - Se true, usa cor primária; se false, usa cor de erro.
 * @returns {Promise<boolean>} - Retorna true se confirmado (com checkbox marcado), false se cancelado.
 */
export function showConfirmModalWithCheckbox(
  title,
  message,
  checkboxLabel,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  isPositiveAction = true,
) {
  return new Promise((resolve) => {
    // Criação do Overlay
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay custom-confirm-overlay hidden";

    // Criação do Content
    const content = document.createElement("div");
    content.className = "modal-content custom-confirm-content";

    // Header
    const header = document.createElement("div");
    header.className = "modal-header";
    header.innerHTML = `<h2>${title}</h2>`;

    // Body
    const body = document.createElement("div");
    body.className = "modal-body";

    const desc = document.createElement("p");
    desc.innerText = message;
    desc.style.marginBottom = "16px";
    body.appendChild(desc);

    // Checkbox container
    const checkboxContainer = document.createElement("label");
    checkboxContainer.style.display = "flex";
    checkboxContainer.style.alignItems = "flex-start";
    checkboxContainer.style.gap = "10px";
    checkboxContainer.style.cursor = "pointer";
    checkboxContainer.style.padding = "12px";
    checkboxContainer.style.background =
      "var(--color-surface-alt, rgba(0,0,0,0.1))";
    checkboxContainer.style.borderRadius = "8px";
    checkboxContainer.style.border = "1px solid var(--color-border)";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.style.width = "18px";
    checkbox.style.height = "18px";
    checkbox.style.marginTop = "2px";
    checkbox.style.accentColor = "var(--color-primary)";
    checkbox.style.cursor = "pointer";

    const checkboxText = document.createElement("span");
    checkboxText.innerText = checkboxLabel;
    checkboxText.style.fontSize = "0.9rem";
    checkboxText.style.color = "var(--color-text)";
    checkboxText.style.lineHeight = "1.4";

    checkboxContainer.appendChild(checkbox);
    checkboxContainer.appendChild(checkboxText);
    body.appendChild(checkboxContainer);

    // Footer
    const footer = document.createElement("div");
    footer.className = "modal-footer";
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "10px";

    const btnCancel = document.createElement("button");
    btnCancel.className = "btn btn--outline";
    btnCancel.innerText = cancelText;

    const btnConfirm = document.createElement("button");
    btnConfirm.className = "btn btn--primary";
    btnConfirm.disabled = true; // Começa desabilitado
    btnConfirm.style.opacity = "0.5";
    btnConfirm.style.cursor = "not-allowed";

    // Define cor baseado em isPositiveAction
    if (isPositiveAction) {
      btnConfirm.style.backgroundColor = "var(--color-primary)";
      btnConfirm.style.borderColor = "var(--color-primary)";
    } else {
      btnConfirm.style.backgroundColor = "var(--color-error)";
      btnConfirm.style.borderColor = "var(--color-error)";
    }

    btnConfirm.innerText = confirmText;

    // Habilita/desabilita botão baseado no checkbox
    checkbox.addEventListener("change", () => {
      btnConfirm.disabled = !checkbox.checked;
      btnConfirm.style.opacity = checkbox.checked ? "1" : "0.5";
      btnConfirm.style.cursor = checkbox.checked ? "pointer" : "not-allowed";
    });

    footer.appendChild(btnCancel);
    footer.appendChild(btnConfirm);

    // Montagem
    content.appendChild(header);
    content.appendChild(body);
    content.appendChild(footer);
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // Animação de entrada
    requestAnimationFrame(() => {
      overlay.classList.remove("hidden");
    });

    // Handlers
    const close = (value) => {
      overlay.style.opacity = "0";
      setTimeout(() => {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
        resolve(value);
      }, 300);
    };

    btnCancel.onclick = () => close(false);
    btnConfirm.onclick = () => {
      if (checkbox.checked) {
        close(true);
      }
    };

    overlay.onclick = (e) => {
      if (e.target === overlay) close(false);
    };

    // Keyboard support
    const handleKey = (e) => {
      if (e.key === "Escape") {
        document.removeEventListener("keyup", handleKey);
        close(false);
      }
      if (e.key === "Enter" && checkbox.checked) {
        document.removeEventListener("keyup", handleKey);
        close(true);
      }
    };
    document.addEventListener("keyup", handleKey);
  });
}

export function showTitleConfirmationModal(currentTitle) {
  return new Promise((resolve) => {
    // Criação do Overlay
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay custom-confirm-overlay hidden"; // Reusing base modal-overlay + custom class + hidden for animation

    // Criação do Content
    const content = document.createElement("div");
    content.className = "modal-content custom-confirm-content"; // Reusing base modal-content + custom class

    // Header
    const header = document.createElement("div");
    header.className = "modal-header";
    header.innerHTML = `<h2>Confirmar Título</h2>`;

    // Body
    const body = document.createElement("div");
    body.className = "modal-body";

    const desc = document.createElement("p");
    desc.innerText =
      "Verifique se o título e a versão da prova estão corretos. Você pode editar se necessário.";

    const inputGroup = document.createElement("div");
    inputGroup.className = "form-group";

    const label = document.createElement("label");
    label.className = "form-label";
    label.innerText = "Título da Prova";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "form-control";
    input.value = currentTitle;
    // Auto-select text on focus
    setTimeout(() => input.select(), 100);

    inputGroup.appendChild(label);
    inputGroup.appendChild(input);
    body.appendChild(desc);
    body.appendChild(inputGroup);

    // Footer
    const footer = document.createElement("div");
    footer.className = "modal-footer";
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "10px";

    const btnCancel = document.createElement("button");
    btnCancel.className = "btn btn--outline";
    btnCancel.innerText = "Cancelar";

    const btnConfirm = document.createElement("button");
    btnConfirm.className = "btn btn--primary";
    btnConfirm.innerText = "Confirmar e Extrair";

    footer.appendChild(btnCancel);
    footer.appendChild(btnConfirm);

    // Montagem
    content.appendChild(header);
    content.appendChild(body);
    content.appendChild(footer);
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // Animação de entrada
    requestAnimationFrame(() => {
      overlay.classList.remove("hidden"); // Assuming modal-overlay might start hidden or we handle opacity
      // Se baseando no modal.css original, ele tem opacity:1 por padrão e hidden opcional.
      // Vamos garantir que ele apareça.
    });

    // Handlers
    const close = (value) => {
      overlay.style.opacity = "0";
      setTimeout(() => {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
        resolve(value);
      }, 300); // Wait for transition
    };

    btnCancel.onclick = () => close(null);

    btnConfirm.onclick = () => {
      const newTitle = input.value.trim();
      if (!newTitle) {
        input.classList.add("error"); // Simple visual feedback
        return;
      }
      close(newTitle);
    };

    // Close on click outside
    overlay.onclick = (e) => {
      if (e.target === overlay) close(null);
    };

    // Enter key to confirm
    input.onkeyup = (e) => {
      if (e.key === "Enter") btnConfirm.click();
      if (e.key === "Escape") btnCancel.click();
    };
  });
}

/**
 * Exibe um modal para gerenciar o link do PDF embed.
 * @param {string|null} currentUrl - A URL atual do PDF (pode ser null/vazio).
 * @returns {Promise<{action: 'set'|'remove'|'cancel', url?: string}>}
 *   - action='set': O usuário definiu/trocou a URL (url contém a nova URL)
 *   - action='remove': O usuário removeu a URL
 *   - action='cancel': O usuário cancelou
 */
export function showPdfUrlModal(currentUrl = null) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay custom-confirm-overlay hidden";

    const content = document.createElement("div");
    content.className = "modal-content custom-confirm-content";
    content.style.maxWidth = "480px";

    // Header
    const header = document.createElement("div");
    header.className = "modal-header";
    header.innerHTML = `<h2>🔗 Link do PDF</h2>`;

    // Body
    const body = document.createElement("div");
    body.className = "modal-body";

    // Descrição
    const desc = document.createElement("p");
    desc.innerText = currentUrl
      ? "Você pode trocar ou remover o link do PDF utilizado para visualização."
      : "Cole abaixo o link de um arquivo PDF para visualizar diretamente.";
    desc.style.marginBottom = "16px";
    desc.style.fontSize = "0.9rem";
    body.appendChild(desc);

    // URL atual (se existir)
    if (currentUrl) {
      const currentBox = document.createElement("div");
      currentBox.style.cssText = `
        padding: 10px 14px; margin-bottom: 14px;
        background: var(--color-surface-alt, rgba(0,0,0,0.15));
        border: 1px solid var(--color-border);
        border-radius: 8px; font-size: 0.8rem;
        word-break: break-all; color: var(--color-text-secondary);
        display: flex; flex-direction: column; gap: 4px;
      `;
      const currentLabel = document.createElement("span");
      currentLabel.innerText = "Link atual:";
      currentLabel.style.cssText = "font-weight: 600; font-size: 0.75rem; color: var(--color-text); opacity: 0.7;";
      const currentLink = document.createElement("span");
      currentLink.innerText = currentUrl.length > 80 ? currentUrl.substring(0, 80) + "…" : currentUrl;
      currentLink.style.cssText = "color: var(--color-primary); font-size: 0.8rem;";
      currentBox.appendChild(currentLabel);
      currentBox.appendChild(currentLink);
      body.appendChild(currentBox);
    }

    // Input group
    const inputGroup = document.createElement("div");
    inputGroup.className = "form-group";
    inputGroup.style.marginBottom = "6px";

    const label = document.createElement("label");
    label.className = "form-label";
    label.innerText = currentUrl ? "Novo link (deixe vazio para manter)" : "Link do PDF";
    label.style.fontSize = "0.85rem";

    const input = document.createElement("input");
    input.type = "url";
    input.className = "form-control";
    input.placeholder = "https://exemplo.com/arquivo.pdf";
    input.style.fontSize = "0.85rem";
    setTimeout(() => input.focus(), 150);

    inputGroup.appendChild(label);
    inputGroup.appendChild(input);
    body.appendChild(inputGroup);

    // Footer
    const footer = document.createElement("div");
    footer.className = "modal-footer";
    footer.style.display = "flex";
    footer.style.justifyContent = "flex-end";
    footer.style.gap = "10px";
    footer.style.flexWrap = "wrap";

    // Botão Remover (só aparece se já tem URL)
    if (currentUrl) {
      const btnRemove = document.createElement("button");
      btnRemove.className = "btn btn--outline";
      btnRemove.innerText = "🗑️ Remover Link";
      btnRemove.style.cssText = `
        margin-right: auto; color: var(--color-error);
        border-color: var(--color-error); font-size: 0.8rem;
      `;
      btnRemove.onclick = () => close({ action: "remove" });
      footer.appendChild(btnRemove);
    }

    const btnCancel = document.createElement("button");
    btnCancel.className = "btn btn--outline";
    btnCancel.innerText = "Cancelar";

    const btnConfirm = document.createElement("button");
    btnConfirm.className = "btn btn--primary";
    btnConfirm.style.backgroundColor = "var(--color-primary)";
    btnConfirm.style.borderColor = "var(--color-primary)";
    btnConfirm.innerText = currentUrl ? "🔄 Trocar" : "✅ Definir";

    footer.appendChild(btnCancel);
    footer.appendChild(btnConfirm);

    // Montagem
    content.appendChild(header);
    content.appendChild(body);
    content.appendChild(footer);
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.classList.remove("hidden");
    });

    const close = (value) => {
      overlay.style.opacity = "0";
      setTimeout(() => {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
        resolve(value);
      }, 300);
    };

    btnCancel.onclick = () => close({ action: "cancel" });

    btnConfirm.onclick = () => {
      const newUrl = input.value.trim();
      if (!newUrl) {
        // Se não digitou nada, cancela (mantém o que tinha)
        close({ action: "cancel" });
        return;
      }
      if (!newUrl.startsWith("http://") && !newUrl.startsWith("https://")) {
        input.style.borderColor = "var(--color-error)";
        input.style.boxShadow = "0 0 0 2px rgba(239,68,68,0.3)";
        return;
      }
      close({ action: "set", url: newUrl });
    };

    overlay.onclick = (e) => {
      if (e.target === overlay) close({ action: "cancel" });
    };

    input.onkeyup = (e) => {
      // Reset error style on typing
      input.style.borderColor = "";
      input.style.boxShadow = "";
      if (e.key === "Enter") btnConfirm.click();
      if (e.key === "Escape") btnCancel.click();
    };
  });
}
