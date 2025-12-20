import { configurarRemocaoPasso } from './passos.js';
import { criarHtmlBlocoEditor } from './structure-editor.js';
import { iniciarEditorEstrutura } from './structure-editor.js';

export const initStepEditors = (container) => {
  // Supõe que 'container' é global ou acessível nesse escopo, conforme seu código original
  const containerPassos = container.querySelector('#editGabaritoPassos');
  if (!containerPassos) return;

  // Para cada linha existente, chama o configurador
  containerPassos.querySelectorAll('.step-edit-row').forEach((row) => {
    configurarLinhaEditorPasso(row);
  });
};

/**
 * Orquestra a configuração de uma única linha (passo) do editor.
 */
export const configurarLinhaEditorPasso = (row) => {
  const dragContainer = row.querySelector('.step-drag-container');
  const menu = row.querySelector('.step-menu-content');

  // 1. Configura Drag & Drop
  if (dragContainer) {
    iniciarEditorEstrutura(dragContainer);
  }

  // 2. Configura o Menu (Toggle)
  configurarMenuToggle(row, menu);

  // 3. Configura Botões de Inserção (Itens)
  configurarBotoesInsercao(row, dragContainer, menu);

  // 4. Configura Remoção do Passo
  configurarRemocaoPasso(row);
};

/**
 * Lógica de abrir/fechar o menu e garantir que apenas um fique aberto por vez.
 */
export const configurarMenuToggle = (row, menu) => {
  const toggleBtn = row.querySelector('.btn-toggle-step-add');

  if (toggleBtn && menu) {
    toggleBtn.onclick = (e) => {
      e.stopPropagation(); // Impede fechamento imediato

      const wasHidden = menu.classList.contains('hidden');

      // Fecha todos os menus abertos na página (reset global)
      document
        .querySelectorAll('.step-menu-content')
        .forEach((m) => m.classList.add('hidden'));

      // Se estava fechado, abre este específico
      if (wasHidden) menu.classList.remove('hidden');
    };
  }
};

/**
 * Configura os botões que adicionam blocos (texto, imagem, etc).
 */
export const configurarBotoesInsercao = (row, dragContainer, menu) => {
  row.querySelectorAll('.btn-add-step-item').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const tipo = btn.dataset.type;

      // Chama o helper que cria e insere o HTML
      adicionarBlocoAoContainer(dragContainer, tipo);

      // Fecha o menu após adicionar
      if (menu) menu.classList.add('hidden');
    };
  });
};

/**
 * Helper isolado para criar o DOM do bloco e scrollar até ele.
 */
export const adicionarBlocoAoContainer = (dragContainer, tipo) => {
  if (!dragContainer) return;

  // Gera HTML (função global existente)
  const html = criarHtmlBlocoEditor(tipo, '');

  // Cria elemento DOM
  const temp = document.createElement('div');
  temp.innerHTML = html.trim();
  const novoBloco = temp.firstChild;

  // Insere e foca
  dragContainer.appendChild(novoBloco);
  novoBloco.scrollIntoView({ behavior: 'smooth', block: 'center' });
};