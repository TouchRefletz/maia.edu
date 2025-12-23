import { showUndoToast } from '../ui/GlobalAlertsLogic.tsx';

export function criarHtmlBlocoEditor(tipo, conteudo) {
  const safeContent = String(conteudo ?? '').replace(/"/g, '&quot;');
  const t = String(tipo ?? 'texto')
    .toLowerCase()
    .trim();

  const CFG = {
    texto: {
      label: 'TEXTO',
      kind: 'textarea',
      rows: 4,
      placeholder: 'Parágrafo de texto...',
    },
    titulo: {
      label: 'TÍTULO',
      kind: 'input',
      placeholder: 'Título (curto)...',
    },
    subtitulo: {
      label: 'SUBTÍTULO',
      kind: 'input',
      placeholder: 'Subtítulo...',
    },
    citacao: {
      label: 'CITAÇÃO',
      kind: 'textarea',
      rows: 3,
      placeholder: 'Texto da citação...',
    },
    lista: {
      label: 'LISTA',
      kind: 'textarea',
      rows: 4,
      placeholder: 'Um item por linha...',
    },
    equacao: {
      label: 'EQUAÇÃO',
      kind: 'textarea',
      rows: 2,
      placeholder: 'LaTeX (ex: \\frac{a}{b})',
    },
    codigo: {
      label: 'CÓDIGO',
      kind: 'textarea',
      rows: 6,
      placeholder: 'Cole o código aqui...',
    },
    destaque: {
      label: 'DESTAQUE',
      kind: 'textarea',
      rows: 3,
      placeholder: 'Trecho para destacar...',
    },
    fonte: {
      label: 'FONTE',
      kind: 'textarea',
      rows: 2,
      placeholder: 'Créditos / referência (ex: Fonte: ..., Adaptado de ...)',
    },
    imagem: {
      label: 'IMAGEM',
      kind: 'input',
      placeholder: 'Legenda/Alt-text (ex: Mapa, gráfico...)',
    },
    separador: { label: 'SEPARADOR', kind: 'separador' },
  };

  const cfg = CFG[t] ?? CFG.texto;

  const uniqueId = 'struct_field_' + Math.random().toString(36).substr(2, 9);

  let inputHtml = '';
  if (cfg.kind === 'input') {
    inputHtml = `<input type="text" id="${uniqueId}" class="form-control item-content" value="${safeContent}" placeholder="${cfg.placeholder}">`;
  } else if (cfg.kind === 'textarea') {
    inputHtml = `<textarea id="${uniqueId}" class="item-content form-control structure-textarea-auto" rows="${cfg.rows}" placeholder="${cfg.placeholder}" style="overflow:hidden; resize:none;">${safeContent}</textarea>`;
  } else if (cfg.kind === 'separador') {
    // mantÃ©m item-content para o salvamento ser consistente
    inputHtml = `
      <input type="hidden" class="item-content" value="">
      <div style="font-size:11px;color:var(--color-text-secondary);font-family:var(--font-family-mono);">
        (Sem conteúdo — este bloco só cria uma linha separadora)
      </div>
    `;
  }

  const label = cfg.label;
  const ocrButton = cfg.kind !== 'separador' && cfg.kind !== 'imagem'
    ? `<button type="button" class="btn-ocr-invoke" style="background:none; border:none; cursor:pointer; font-size:14px; margin-right:5px; color:#666;" onclick="window.iniciar_ocr_campo('${uniqueId}')" title="Usar OCR">🔍</button>`
    : '';

  return `
    <div class="structure-item" draggable="true" data-type="${t}">
      <div class="drag-handle">⋮⋮</div>
      <div class="structure-item-content">
        <div class="structure-item-header">
          <div style="display:flex; align-items:center;">
             ${ocrButton}
             <span class="structure-type-badge ${t}">${label}</span>
          </div>
          <button type="button" class="btn-delete-block" title="Remover bloco">×</button>
        </div>
        ${inputHtml}
      </div>
    </div>
  `;
}

export function ensureDeleteConfirmModal() {
  if (document.getElementById('deleteConfirmModal')) return;

  const overlay = document.createElement('div');
  overlay.id = 'deleteConfirmModal';
  overlay.className = 'modal-overlay hidden';
  overlay.innerHTML = `
    <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="delTitle">
      <div class="modal-header">
        <h2 id="delTitle">Remover bloco?</h2>
      </div>

      <div class="modal-body">
        <p>Tem certeza que deseja remover este bloco? Você poderá desfazer logo em seguida.</p>
      </div>

      <div class="modal-footer" style="display:flex; gap:10px; justify-content:flex-end;">
        <button type="button" class="btn btn--secondary" id="delCancelBtn">Cancelar</button>
        <button type="button" class="btn btn--primary" id="delOkBtn">Remover</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Fecha ao clicar fora
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
}

export function openDeleteConfirmModal(onConfirm) {
  ensureDeleteConfirmModal();

  const overlay = document.getElementById('deleteConfirmModal');
  const btnCancel = document.getElementById('delCancelBtn');
  const btnOk = document.getElementById('delOkBtn');

  const close = () => overlay.classList.add('hidden');

  btnCancel.onclick = close;
  btnOk.onclick = () => {
    close();
    onConfirm?.();
  };

  overlay.classList.remove('hidden');
}

/**
 * Função Principal (Orquestradora)
 * Inicializa os eventos chamando as funções especializadas.
 */
export function iniciarEditorEstrutura(targetContainer) {
  // 1. DEFINE O ALVO
  const container =
    targetContainer || document.getElementById('editor-drag-container');

  // Se não achou nenhum container, para por aqui.
  if (!container) return;

  // Inicializa cada parte separadamente
  configurarDelecao(container);
  configurarDragAndDrop(container);
  configurarBotoesAdicionar(container, targetContainer);
}

/**
 * Parte 1: Lógica de Deletar Blocos
 * Configura o listener de clique para remover itens com confirmação e undo.
 */
export function configurarDelecao(container) {
  const deleteHandler = (e) => {
    const btn = e.target.closest('.btn-delete-block');
    if (!btn) return;

    const item = btn.closest('.structure-item');
    if (!item) return;

    // Chama seu modal global de confirmação
    openDeleteConfirmModal(() => {
      const parent = item.parentNode;
      const next = item.nextSibling; // guarda quem estava depois para poder desfazer

      item.remove();

      // Mostra o toast para desfazer a ação
      showUndoToast('Bloco removido.', () => {
        if (next && next.parentNode === parent) {
          parent.insertBefore(item, next);
        } else {
          parent.appendChild(item);
        }
      });
    });
  };

  // TRUQUE IMPORTANTE: Remove o listener anterior antes de adicionar um novo.
  container.removeEventListener('click', container._deleteHandlerRef);
  container._deleteHandlerRef = deleteHandler; // Salva a referência no próprio elemento DOM
  container.addEventListener('click', container._deleteHandlerRef);
}

/**
 * Parte 2: Lógica Drag & Drop
 * Configura os eventos de arrastar, soltar e calcular a posição.
 */
export function configurarDragAndDrop(container) {
  let draggedItem = null;

  // Quando começa a arrastar
  const dragStartHandler = (e) => {
    if (!e.target.classList.contains('structure-item')) return;
    draggedItem = e.target;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';

    if (e.dataTransfer.setDragImage) {
      // Opcional: ajustar imagem de drag se quiser
    }
  };

  // Quando termina de arrastar
  const dragEndHandler = (e) => {
    if (!e.target.classList.contains('structure-item')) return;
    e.target.classList.remove('dragging');
    draggedItem = null;
  };

  // Enquanto está passando por cima (calcula onde soltar)
  const dragOverHandler = (e) => {
    e.preventDefault(); // Necessário para permitir o drop
    const afterElement = getDragAfterElement(container, e.clientY);

    if (draggedItem) {
      if (afterElement == null) {
        container.appendChild(draggedItem);
      } else {
        container.insertBefore(draggedItem, afterElement);
      }
    }
  };

  // Remove listeners antigos de Drag (para evitar duplicação)
  container.removeEventListener('dragstart', container._dragStartRef);
  container.removeEventListener('dragend', container._dragEndRef);
  container.removeEventListener('dragover', container._dragOverRef);

  // Salva referências e adiciona novos
  container._dragStartRef = dragStartHandler;
  container._dragEndRef = dragEndHandler;
  container._dragOverRef = dragOverHandler;

  container.addEventListener('dragstart', container._dragStartRef);
  container.addEventListener('dragend', container._dragEndRef);
  container.addEventListener('dragover', container._dragOverRef);
}

/**
 * Parte 3: Botões de Adicionar
 * Configura a toolbar de adicionar blocos (apenas se for o container principal ou padrão).
 */
export function configurarBotoesAdicionar(container, targetContainer) {
  // A lógica original verifica se NÃO passamos container específico ou se é o principal
  if (!targetContainer || container.id === 'editor-drag-container') {
    const addBtnContainer = document.getElementById('editor-add-buttons');

    if (addBtnContainer) {
      // Limpa eventos antigos para não duplicar se renderizar a tela de novo
      const novoContainerBtn = addBtnContainer.cloneNode(true);
      addBtnContainer.parentNode.replaceChild(
        novoContainerBtn,
        addBtnContainer
      );

      // Re-seleciona o elemento novo limpo
      const toolbar = document.getElementById('editor-add-buttons');
      const menu = toolbar.querySelector('#editorAddMenu');
      const toggleBtn = toolbar.querySelector('#btnToggleAddMenu');

      // Configura cliques dos botões de adicionar bloco
      toolbar.querySelectorAll('.btn-add-block').forEach((btn) => {
        btn.onclick = () => {
          const tipo = btn.dataset.addType;
          const html = criarHtmlBlocoEditor(tipo, '');

          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = html.trim();
          const novoEl = tempDiv.firstChild;

          container.appendChild(novoEl);
          novoEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

          if (menu) menu.classList.add('hidden');
        };
      });

      // Configura o Menu Dropdown (se existir)
      if (toggleBtn && menu) {
        toggleBtn.onclick = (e) => {
          e.preventDefault();
          menu.classList.toggle('hidden');
        };

        // Fecha ao clicar fora
        document.addEventListener('click', (e) => {
          if (!toolbar.contains(e.target)) menu.classList.add('hidden');
        });
      }
    }
  }
}

/**
 * Helper: Calcula a posição do mouse em relação aos itens
 * Usado pela função de Drag & Drop.
 */
export function getDragAfterElement(container, y) {
  const draggableElements = [
    ...container.querySelectorAll('.structure-item:not(.dragging)'),
  ];

  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      // Se o offset é negativo (estamos acima do centro do elemento) e maior que o anterior...
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    },
    { offset: Number.NEGATIVE_INFINITY }
  ).element;
}