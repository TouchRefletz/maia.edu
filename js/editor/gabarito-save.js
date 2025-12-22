import { renderizarQuestaoFinal } from '../render/final/render-questao.js';
import { customAlert } from '../ui/GlobalAlertsLogic.tsx';

/**
 * Configura os botões que alternam entre visualizar e editar (Questão e Gabarito).
 * Também lida com o cancelamento (que geralmente reseta a view).
 */
export const configurarNavegacaoEdicao = (container, gabarito) => {
  // --- 1. Cancelar Edição da QUESTÃO (Volta para Leitura) ---
  const btnCancelarEdicao = container.querySelector('#btnCancelarEdicao');
  if (btnCancelarEdicao) {
    btnCancelarEdicao.onclick = () => {
      const view = container.querySelector('#questaoView');
      const edit = container.querySelector('#questaoEdit');
      const actions = container.querySelector('#actionsLeitura');

      if (edit) edit.classList.add('hidden');
      if (view) view.classList.remove('hidden');
      if (actions) actions.classList.remove('hidden');
    };
  }

  // --- 2. Editar GABARITO (Entra no modo edição) ---
  const btnEditarGabarito = container.querySelector('#btnEditarGabarito');
  if (btnEditarGabarito) {
    btnEditarGabarito.onclick = () => {
      const view = container.querySelector('#gabaritoView');
      const edit = container.querySelector('#gabaritoEdit');
      const actions = container.querySelector('#actionsLeituraGabarito');

      if (view) view.classList.add('hidden');
      if (actions) actions.classList.add('hidden');
      if (edit) edit.classList.remove('hidden');
    };
  }

  // --- 3. Cancelar Edição do GABARITO (Reseta tudo) ---
  const btnCancelarEdicaoGabarito = container.querySelector(
    '#btnCancelarEdicaoGabarito'
  );
  if (btnCancelarEdicaoGabarito) {
    btnCancelarEdicaoGabarito.onclick = () => {
      renderizarQuestaoFinal(window.ultimoGabaritoExtraido || gabarito);
    };
  }
};

/**
 * Configura o evento de clique do botão Salvar.
 */
export const initBotaoSalvarGabarito = (container, questao) => {
  const btnSalvar = container.querySelector('#btnSalvarEdicaoGabarito');
  if (btnSalvar) {
    btnSalvar.onclick = () => processarSalvamentoGabarito(container, questao);
  }
};

/**
 * Função Mestra: Orquestra a leitura de todos os campos, monta o objeto final e atualiza a tela.
 */
export const processarSalvamentoGabarito = (container, questao) => {
  // Helpers locais
  const normLetra = (v) =>
    String(v || '')
      .trim()
      .toUpperCase();

  // 1. Campos Básicos
  const respostaNova = normLetra(
    container.querySelector('#editGabaritoResposta')?.value
  );
  const justNova = container.querySelector('#editGabaritoJust')?.value || '';
  const confRaw = container.querySelector('#editGabaritoConfianca')?.value;
  const confNova = confRaw === '' ? null : Number(confRaw);

  // 2. Extração das Seções Complexas (Delegada para funções específicas)
  const passos = extrairPassosDoEditor(container);
  const alternativasAnalisadas = extrairAnaliseAlternativas(
    container,
    questao,
    respostaNova,
    normLetra
  );
  const complexidade = extrairComplexidade(container);
  const coerencia = extrairCoerencia(container);
  const creditos = extrairCreditos(container);
  const alertas = extrairLinhas(container, '#editGabaritoAlertas');
  const observacoes = extrairLinhas(container, '#editGabaritoObs');

  // 3. Montagem do Objeto Final
  const base = window.__ultimoGabaritoExtraido || (typeof gabarito !== 'undefined' ? gabarito : {}) || {};
  // Clone seguro (deep copy)
  const novo =
    typeof structuredClone === 'function'
      ? structuredClone(base)
      : JSON.parse(JSON.stringify(base));

  novo.alternativa_correta = respostaNova;
  novo.resposta = respostaNova;
  novo.justificativa_curta = justNova;
  novo.confianca = confNova;
  novo.explicacao = passos;
  novo.alternativas_analisadas = alternativasAnalisadas;
  novo.coerencia = coerencia;
  novo.creditos = creditos;
  novo.alertas_credito = alertas;
  novo.observacoes = observacoes;
  novo.analise_complexidade = complexidade;

  // 4. Atualização Global e Renderização
  window.__ultimoGabaritoExtraido = novo;

  if (typeof customAlert === 'function')
    customAlert('✅ Gabarito atualizado!', 2000);

  // Chama a função principal de renderização (certifique-se que ela existe no escopo global)
  if (typeof renderizarQuestaoFinal === 'function') {
    renderizarQuestaoFinal(novo);
  }
};

/**
 * Lê a estrutura complexa dos passos (Drag & Drop).
 */
export const extrairPassosDoEditor = (container) => {
  const passos = [];
  container
    .querySelectorAll('#editGabaritoPassos .step-edit-row')
    .forEach((row) => {
      const origem =
        row.querySelector('.passo-origem')?.value || 'gerado_pela_ia';
      const fontematerial = row.querySelector('.passo-fonte')?.value || '';
      const evidencia = row.querySelector('.passo-evidencia')?.value || '';

      const estruturaPasso = [];
      row
        .querySelectorAll('.step-drag-container .structure-item')
        .forEach((item) => {
          const tipo = item.dataset.type;
          const conteudo = item.querySelector('.item-content')?.value || '';
          estruturaPasso.push({ tipo, conteudo });
        });

      if (estruturaPasso.length > 0) {
        const passoTextoSimples = estruturaPasso
          .map((b) => b.conteudo)
          .join(' ');
        passos.push({
          passo: passoTextoSimples,
          estrutura: estruturaPasso,
          origem,
          fontematerial,
          evidencia,
        });
      }
    });
  return passos;
};

/**
 * Lê a análise de cada alternativa e compara com a resposta correta.
 */
export const extrairAnaliseAlternativas = (
  container,
  questao,
  respostaNova,
  normLetra
) => {
  const motivos = {};
  container.querySelectorAll('.gabarito-motivo').forEach((t) => {
    const letra = normLetra(t.dataset.letra);
    motivos[letra] = t.value || '';
  });

  const alts = Array.isArray(questao?.alternativas) ? questao.alternativas : [];

  return alts.map((a) => {
    const letra = normLetra(a?.letra);
    return {
      letra,
      correta: letra && respostaNova && letra === respostaNova,
      motivo: motivos[letra] || '',
    };
  });
};

/**
 * Lê os checkboxes da matriz de complexidade.
 */
export const extrairComplexidade = (container) => {
  const fatores = {};
  container.querySelectorAll('.chk-complexidade').forEach((chk) => {
    const k = chk.dataset.key;
    fatores[k] = chk.checked;
  });

  const justificativa =
    container.querySelector('#editComplexidadeJust')?.value || '';

  return {
    fatores: fatores,
    justificativa_dificuldade: justificativa,
  };
};

/**
 * Lê os dados de Coerência.
 */
export const extrairCoerencia = (container) => {
  return {
    alternativa_correta_existe: !!container.querySelector(
      '#editCoerenciaAltExiste'
    )?.checked,
    tem_analise_para_todas: !!container.querySelector(
      '#editCoerenciaTodasAnalise'
    )?.checked,
    observacoes: extrairLinhas(container, '#editCoerenciaObs'),
  };
};

/**
 * Lê todos os campos de Créditos.
 */
export const extrairCreditos = (container) => {
  const valConf = container.querySelector('#editCredConfId')?.value;

  return {
    origemresolucao: container.querySelector('#editCredOrigem')?.value || '',
    materialidentificado: !!container.querySelector('#editCredMatIdentificado')
      ?.checked,
    confiancaidentificacao: valConf === '' ? null : Number(valConf),
    material: container.querySelector('#editCredMaterial')?.value || '',
    autorouinstituicao: container.querySelector('#editCredAutor')?.value || '',
    ano: container.querySelector('#editCredAno')?.value || '',
    comoidentificou: container.querySelector('#editCredComo')?.value || '',
    precisacreditogenerico: !!container.querySelector(
      '#editCredPrecisaGenerico'
    )?.checked,
    textocreditosugerido:
      container.querySelector('#editCredTextoSugerido')?.value || '',
  };
};

/**
 * Helper utilitário para pegar texto de textarea e transformar em array de linhas.
 */
export const extrairLinhas = (container, seletor) => {
  return (container.querySelector(seletor)?.value || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
};