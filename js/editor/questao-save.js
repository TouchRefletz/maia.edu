import { renderizarQuestaoFinal } from '../render/final/render-questao.js';
import { normalizarEstrutura } from '../render/structure.js';
import { customAlert } from '../ui/alerts.js';
import { trocarModo } from '../viewer/pdf-core.js';
import { esconderPainel } from '../viewer/sidebar.js';
import { criarEAnexarAlternativa } from './alternativas.js';

/**
 * Configura os botões de ação da Questão:
 * 1. Confirmar Questão (Troca de modo/aba)
 * 2. Adicionar Nova Alternativa (Edição)
 */
export const configurarBotoesControleQuestao = (container) => {
  // --- 1. Botão Confirmar ---
  const btnConfirmar = container.querySelector('#btnConfirmarQuestao');
  if (btnConfirmar) {
    btnConfirmar.onclick = async () => {
      const urls = window.__pdfUrls || window.pdfUrls;
      if (urls?.gabarito) window.__preferirPdfGabarito = true;

      if (typeof trocarModo === 'function') await trocarModo('gabarito');

      if (window.modo == 'gabarito' && window.innerWidth <= 900) {
        if (typeof esconderPainel === 'function') esconderPainel();
      }
    };
  }

  // --- 2. Botão Adicionar Alternativa ---
  const btnAddAlt = container.querySelector('#btnAddAlt');
  if (btnAddAlt) {
    btnAddAlt.onclick = () => {
      const divAlts = container.querySelector('#editalts');
      if (divAlts) {
        criarEAnexarAlternativa(divAlts);
      }
    };
  }
};

/**
 * Configura o botão de salvar as edições da Questão.
 */
export const initBotaoSalvarQuestao = (container) => {
  const btnSalvar = container.querySelector('#btnSalvarEdicao');
  if (btnSalvar) {
    btnSalvar.onclick = () => processarSalvamentoQuestao(container);
  }
};

/**
 * Orquestra a leitura de todos os campos da questão, atualiza o objeto global e re-renderiza.
 */
export const processarSalvamentoQuestao = (container) => {
  // 1. Extração dos Dados
  const identificacao =
    container.querySelector('#edit_identificacao')?.value || '';

  // Extrai a estrutura principal (Enunciado) e gera o texto simples
  const { estrutura, enunciado } = extrairEstruturaEnunciado(container);

  // Extrai as alternativas
  const alternativas = extrairAlternativasDoEditor(container);

  // Extrai metadados (helper reutilizável)
  const extrairLinhas = (sel) =>
    (container.querySelector(sel)?.value || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  const materias = extrairLinhas('#edit_materias');
  const palavrasChave = extrairLinhas('#edit_palavras');

  // 2. Atualização do Objeto Global
  if (window.__ultimaQuestaoExtraida) {
    window.__ultimaQuestaoExtraida.identificacao = identificacao;
    window.__ultimaQuestaoExtraida.estrutura = estrutura;
    window.__ultimaQuestaoExtraida.enunciado = enunciado;
    window.__ultimaQuestaoExtraida.materias_possiveis = materias;
    window.__ultimaQuestaoExtraida.palavras_chave = palavrasChave;
    window.__ultimaQuestaoExtraida.alternativas = alternativas;

    // 3. Feedback e Renderização
    if (typeof customAlert === 'function')
      customAlert('✅ Conteúdo estruturado salvo!', 2000);

    if (typeof renderizarQuestaoFinal === 'function') {
      renderizarQuestaoFinal(window.__ultimaQuestaoExtraida);
    }
  } else {
    console.warn('Objeto window.__ultimaQuestaoExtraida não encontrado.');
  }
};

/**
 * Lê os blocos do editor principal (Drag & Drop), normaliza e gera o texto plano do enunciado.
 */
export const extrairEstruturaEnunciado = (container) => {
  const containerEditor = container.querySelector('#editor-drag-container');
  const novaEstrutura = [];

  if (containerEditor) {
    containerEditor.querySelectorAll('.structure-item').forEach((item) => {
      const tipo = item.dataset.type;
      const inputEl = item.querySelector('.item-content');
      const conteudo = inputEl ? inputEl.value : '';
      novaEstrutura.push({ tipo, conteudo });
    });
  }

  // Supõe que normalizarEstrutura é uma função global do seu sistema
  const estruturaNormalizada =
    typeof normalizarEstrutura === 'function'
      ? normalizarEstrutura(novaEstrutura)
      : novaEstrutura;

  // Gera texto plano apenas dos blocos de texto/título para o campo 'enunciado'
  const novoEnunciado = estruturaNormalizada
    .filter((b) => ['texto', 'citacao', 'titulo', 'subtitulo'].includes(b.tipo))
    .map((b) => b.conteudo)
    .join('\n');

  return {
    estrutura: estruturaNormalizada,
    enunciado: novoEnunciado,
  };
};

/**
 * Lê as linhas de alternativas e seus blocos internos.
 */
export const extrairAlternativasDoEditor = (container) => {
  const novasAlternativas = [];

  container.querySelectorAll('.alt-edit-row').forEach((row) => {
    const letra = String(row.querySelector('.alt-letter')?.value ?? '')
      .trim()
      .toUpperCase();
    if (!letra) return; // Pula se não tiver letra

    const estrutura = [];
    row
      .querySelectorAll('.alt-drag-container .structure-item')
      .forEach((item) => {
        const tipo = String(item.dataset.type ?? 'texto')
          .toLowerCase()
          .trim();
        const conteudo = String(
          item.querySelector('.item-content')?.value ?? ''
        );

        // Filtra apenas os tipos permitidos em alternativas
        if (['texto', 'equacao', 'imagem'].includes(tipo)) {
          estrutura.push({ tipo, conteudo });
        }
      });

    novasAlternativas.push({ letra, estrutura });
  });

  return novasAlternativas;
};