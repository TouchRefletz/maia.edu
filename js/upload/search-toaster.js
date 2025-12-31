/**
 * SearchToaster
 * Componente de UI que aparece quando a busca está rodando em background (ou usuário saiu da tela)
 */
export const SearchToaster = {
  element: null,
  onReopen: null, // Callback para reabrir a tela cheia
  onCancel: null, // Callback para cancelar

  init(callbacks = {}) {
    this.onReopen = callbacks.onReopen;
    this.onCancel = callbacks.onCancel;
    this.render();
  },

  render() {
    if (this.element) return;

    const styles = `
      <style>
        #maia-search-toaster {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 380px;
          background: var(--color-surface, #1e1e2e);
          border: 1px solid var(--color-border, #333);
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          z-index: 99999;
          font-family: 'Inter', sans-serif;
          transform: translateY(120%);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        #maia-search-toaster.visible {
          transform: translateY(0);
        }
        .toaster-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--color-text, #fff);
        }
        .toaster-status {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .toaster-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--color-primary, #6366f1);
          box-shadow: 0 0 8px var(--color-primary, #6366f1);
          animation: pulse 1.5s infinite;
        }
        .toaster-progress-bg {
          width: 100%;
          height: 4px;
          background: rgba(255,255,255,0.1);
          border-radius: 2px;
          overflow: hidden;
        }
        .toaster-progress-fill {
          height: 100%;
          background: var(--color-primary, #6366f1);
          width: 0%;
          transition: width 0.3s ease;
        }
        .toaster-task {
          font-size: 0.8rem;
          color: var(--color-text-secondary, #aaa);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .toaster-actions {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }
        .toaster-btn {
          flex: 1;
          padding: 8px;
          border-radius: 6px;
          border: 1px solid var(--color-border, #444);
          background: transparent;
          color: var(--color-text, #fff);
          cursor: pointer;
          font-size: 0.8rem;
          transition: all 0.2s;
        }
        .toaster-btn:hover {
          background: rgba(255,255,255,0.05);
        }
        .toaster-btn.btn-primary {
          background: var(--color-primary, #6366f1);
          border-color: var(--color-primary, #6366f1);
        }
        .toaster-warning {
          font-size: 0.75rem;
          color: var(--color-warning, #f59e0b);
          background: rgba(245, 158, 11, 0.1);
          padding: 6px 10px;
          border-radius: 4px;
          margin-top: 4px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        @keyframes pulse {
          0% { opacity: 0.6; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0.6; transform: scale(0.9); }
        }
      </style>
    `;

    const html = `
      <div id="maia-search-toaster">
        <div class="toaster-header">
          <div class="toaster-status">
            <div class="toaster-status-dot"></div>
            <span id="toaster-status-text">PROCESSANDO...</span>
          </div>
          <span id="toaster-percent">0%</span>
        </div>
        
        <div class="toaster-progress-bg">
          <div id="toaster-progress-fill" class="toaster-progress-fill"></div>
        </div>

        <div id="toaster-task" class="toaster-task">Iniciando tarefas...</div>

        <div class="toaster-warning" title="Logs podem ser perdidos se a conexão cair">
            ⚠️ <strong>Importante:</strong> Não feche esta aba.
        </div>

        <div class="toaster-actions">
           <button id="toaster-btn-reopen" class="toaster-btn btn-primary">⤢ Abrir</button>
           <button id="toaster-btn-cancel" class="toaster-btn">Cancelar</button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", styles + html);
    this.element = document.getElementById("maia-search-toaster");

    // Bind buttons
    document.getElementById("toaster-btn-reopen").onclick = () => {
      this.hide();
      if (this.onReopen) this.onReopen();
    };

    document.getElementById("toaster-btn-cancel").onclick = () => {
      if (confirm("Tem certeza que deseja cancelar a pesquisa?")) {
        this.hide();
        if (this.onCancel) this.onCancel();
      }
    };
  },

  show() {
    if (!this.element) this.render();
    setTimeout(() => {
      this.element.classList.add("visible");
    }, 10);
  },

  hide() {
    if (this.element) {
      this.element.classList.remove("visible");
    }
  },

  updateState(progress, statusText, taskText) {
    if (!this.element) {
      // If meant to be visible but not rendered, try rendering (or just ignore updates until show() is called)
      // Since show() calls render(), we just return here if not initialized.
      return;
    }

    const fillEl = document.getElementById("toaster-progress-fill");
    if (fillEl && progress !== undefined) {
      fillEl.style.width = `${progress}%`;
      const percentEl = document.getElementById("toaster-percent");
      if (percentEl) percentEl.innerText = `${Math.floor(progress)}%`;
    }

    if (statusText) {
      const statusEl = document.getElementById("toaster-status-text");
      if (statusEl) statusEl.innerText = statusText.toUpperCase();
    }

    if (taskText) {
      const taskEl = document.getElementById("toaster-task");
      if (taskEl) taskEl.innerText = taskText;
    }
  },
};
