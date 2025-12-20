import { asArray } from './primitives.js';
import { asStringArray } from './primitives.js';
import { normCreditos } from './creditos.js';
import { normalizeAlternativasAnalisadas } from './alternativas.js';
import { normalizeExplicacao } from './explicacao.js';
import { pick } from '../utils/pick.js';
import { safeClone } from './primitives.js';

/**
 * PREPARAÇÃO DE DADOS INICIAIS
 * Desembrulha o payload (root), detecta se é gabarito e normaliza a resposta.
 */
export const _prepararDadosIniciais = (dados) => {
  // A IA às vezes manda o payload embrulhado (resultado/data/etc.)
  const root = pick(dados?.resultado, dados?.data, dados?.payload, dados) ?? {};

  // Detecta se é Gabarito
  const isGabaritoData =
    dados === window.__ultimoGabaritoExtraido ||
    (window.__modo === 'gabarito' && !window.__ultimaQuestaoExtraida) ||
    root?.alternativa_correta ||
    root?.resposta;

  return {
    root,
    isGabaritoData,
    dadosNorm: {}, // Base inicial limpa
  };
};

/**
 * 1. FUNÇÃO PRINCIPAL (Dispatcher)
 * Decide se processa como Gabarito ou Questão.
 */
export const _processarDadosPayload = (root, isGabaritoData) => {
  if (isGabaritoData) {
    return _processarGabarito(root);
  } else {
    return _processarQuestao(root);
  }
};

/**
 * 2. PROCESSADOR DE GABARITO
 * Normaliza campos específicos e injeta imagens nos passos da explicação.
 */
export const _processarGabarito = (root) => {
  // 1. Prepara a base da explicação
  const explicacaoBasica = normalizeExplicacao(
    pick(root?.explicacao, root?.resolucao, [])
  );

  // 2. Injeta imagens nos passos
  const explicacaoComImagens = explicacaoBasica.map((passo, idxPasso) => {
    const imgsDestePasso =
      window.__imagensLimpas?.gabarito_passos?.[idxPasso] || [];

    // Usa o helper genérico para injetar imagens na estrutura deste passo
    const novaEstrutura = _injetarImagensEmEstrutura(
      passo.estrutura,
      imgsDestePasso
    );

    return {
      ...passo,
      estrutura: novaEstrutura,
    };
  });

  return {
    // Campos básicos
    alternativa_correta: String(
      pick(
        root?.alternativa_correta,
        root?.resposta,
        root?.alternativacorreta,
        ''
      ) ?? ''
    ),
    justificativa_curta: String(
      pick(root?.justificativa_curta, root?.justificativacurta, '') ?? ''
    ),
    confianca: pick(root?.confianca, null),

    // Objetos complexos
    analise_complexidade: root?.analise_complexidade ?? {},

    // Explicação com imagens injetadas
    explicacao: explicacaoComImagens,

    creditos: normCreditos(root?.creditos),
    alertas_credito: asStringArray(pick(root?.alertas_credito, [])),
    observacoes: asStringArray(pick(root?.observacoes, [])),

    alternativas_analisadas: normalizeAlternativasAnalisadas(
      pick(root?.alternativas_analisadas, []),
      String(pick(root?.alternativa_correta, root?.resposta, ''))
    ),
    coerencia: root?.coerencia ?? {},
  };
};

/**
 * 3. PROCESSADOR DE QUESTÃO
 * Normaliza enunciado e alternativas, injetando imagens do recorte.
 */
export const _processarQuestao = (root) => {
  const imgsEnunciado = window.__imagensLimpas?.questao_original || [];
  const imgsAlternativasMap =
    window.__imagensLimpas?.alternativas?.questao || {};

  // Normaliza estrutura inicial do enunciado (garante array)
  const estruturaEnunciadoRaw = Array.isArray(root?.estrutura)
    ? root.estrutura
    : [
        {
          tipo: 'texto',
          conteudo: String(
            pick(root?.enunciado, root?.texto, root?.statement, '') ?? ''
          ),
        },
      ];

  // Injeta imagens no enunciado
  const estruturaEnunciado = _injetarImagensEmEstrutura(
    estruturaEnunciadoRaw,
    imgsEnunciado
  );

  // Processa Alternativas
  const alternativasRaw = asArray(
    pick(root?.alternativas, root?.alternatives, [])
  );
  const alternativasProcessadas = alternativasRaw.map((a) => {
    const letra = String(pick(a?.letra, a?.letter, '') ?? '')
      .trim()
      .toUpperCase();
    const imgsDestaLetra = imgsAlternativasMap[letra] || [];

    const estruturaBruta = Array.isArray(a?.estrutura)
      ? a.estrutura
      : [
          {
            tipo: 'texto',
            conteudo: String(pick(a?.texto, a?.text, '') ?? ''),
          },
        ];

    // Injeta imagens na alternativa
    const estrutura = _injetarImagensEmEstrutura(
      estruturaBruta,
      imgsDestaLetra
    ).filter((b) => ['texto', 'equacao', 'imagem'].includes(b.tipo));

    return { letra, estrutura };
  });

  return {
    identificacao: String(
      pick(root?.identificacao, root?.id, root?.codigo, '') ?? ''
    ),
    foto_original: root?.scan_original || imgsEnunciado[0] || null,
    estrutura: estruturaEnunciado,
    materias_possiveis: asArray(
      pick(root?.materias_possiveis, root?.materiaspossiveis, [])
    ).map(String),
    palavras_chave: asArray(
      pick(root?.palavras_chave, root?.palavraschave, [])
    ).map(String),
    alternativas: alternativasProcessadas,
  };
};

/**
 * 4. HELPER: INJETOR DE IMAGENS
 * Percorre uma lista de blocos e associa imagens de um array externo aos blocos do tipo 'imagem'.
 */
export const _injetarImagensEmEstrutura = (estrutura, imagensDisponiveis) => {
  let cursor = 0;

  return (estrutura || []).map((bloco) => {
    const tipo = String(bloco?.tipo || 'texto')
      .toLowerCase()
      .trim();
    const conteudo = String(bloco?.conteudo ?? '');

    if (tipo === 'imagem') {
      // Pega da memória local OU mantém o que já estava salvo
      const imgBase64 =
        imagensDisponiveis[cursor] || bloco.imagem_base64 || null;
      cursor++;

      return {
        tipo: 'imagem',
        conteudo: conteudo,
        imagem_base64: imgBase64,
      };
    }

    return { tipo, conteudo };
  });
};

/**
 * Gerencia a atualização das variáveis globais de estado.
 * Verifica se é edição (mesma referência) ou dado novo (IA).
 */
export const _atualizarEstadoGlobal = (dados, dadosNorm) => {
  // Verifica referências para saber se é edição
  const isEdicaoQuestao = dados === window.__ultimaQuestaoExtraida;
  const isEdicaoGabarito = dados === window.__ultimoGabaritoExtraido;

  if (isEdicaoGabarito) {
    // Se estamos salvando uma edição do Gabarito
    window.__ultimoGabaritoExtraido = safeClone(dadosNorm);
  } else if (isEdicaoQuestao) {
    // Se estamos salvando uma edição da Questão
    window.__ultimaQuestaoExtraida = safeClone(dadosNorm);
  } else {
    // Se não é edição, é DADO NOVO vindo da IA
    if (window.__modo === 'gabarito') {
      window.__ultimoGabaritoExtraido = safeClone(dadosNorm);
    } else {
      // Se for dado novo de Prova/Questão
      // Verifica se mudou a questão (ID diferente) para limpar o gabarito antigo
      const idAtual = window.__ultimaQuestaoExtraida
        ? window.__ultimaQuestaoExtraida.identificacao
        : null;
      const idNovo = dadosNorm.identificacao;

      if (idAtual && idAtual !== idNovo) {
        window.__ultimoGabaritoExtraido = null;
      }

      window.__ultimaQuestaoExtraida = safeClone(dadosNorm);
    }
  }
};

/**
 * PREPARAÇÃO BÁSICA DA INTERFACE E ESTADO
 * Define variáveis de segurança, limpa loaders/overlays e seleciona elementos do DOM.
 */
export const _prepararInterfaceBasica = (dadosNorm) => {
  let questao = window.__ultimaQuestaoExtraida;
  const gabarito = window.__ultimoGabaritoExtraido;

  // Fallback de segurança: se não tem questão salva, usa o dado atual
  if (!questao) {
    window.__ultimaQuestaoExtraida = dadosNorm;
    questao = dadosNorm;
  }

  // --- LIMPEZA DE UI (Loaders e Botões Antigos) ---
  document.getElementById('reopenSidebarBtn')?.remove();

  const skeletonLoader = document.getElementById('ai-skeleton-loader');
  if (skeletonLoader && skeletonLoader.parentElement) {
    skeletonLoader.parentElement.remove();
  }

  // --- SELEÇÃO DE ELEMENTOS DO VIEWER ---
  const viewerBody = document.getElementById('viewerBody');
  const main = document.getElementById('viewerMain');

  // Nota: Retornamos como valores para serem manipulados (criados) depois se necessário
  const sidebar = document.getElementById('viewerSidebar');
  const resizer = document.getElementById('sidebarResizer');

  // --- LIMPEZA DE OVERLAYS DE RECORTE ---
  document.querySelector('.selection-box')?.remove();
  document.getElementById('crop-overlay')?.remove();

  // Remove skeleton interno da sidebar, se houver
  const skeleton = sidebar?.querySelector('.skeleton-loader');
  if (skeleton) skeleton.remove();

  // Retorna tudo que o restante da função principal vai precisar usar
  return {
    questao,
    gabarito,
    viewerBody,
    main,
    sidebar,
    resizer,
  };
};

/**
 * Prepara o container principal de renderização e garante backups das imagens originais.
 */
export const _prepararContainerEBackups = (elementoAlvo, dados) => {
  // 1. Busca ou cria o container
  let container = elementoAlvo || document.getElementById('renderContainer');

  if (!container) {
    container = document.createElement('div');
    // ID temporário que pode ser útil para debugging antes da atribuição final
    container.id = 'renderContainer';
  }

  // 2. Lógica de Backup (Questão)
  if (!window.__BACKUP_IMG_Q) {
    const imgsQ = window.__imagensLimpas?.questao_original || [];
    if (imgsQ.length > 0) window.__BACKUP_IMG_Q = imgsQ[0];
  }

  // 3. Lógica de Backup (Gabarito)
  // Verifica se é modo gabarito ou se os dados parecem ser de um gabarito
  if (window.__modo === 'gabarito' || (dados && dados.alternativa_correta)) {
    if (!window.__BACKUP_IMG_G) {
      const imgsG = window.__imagensLimpas?.gabarito_original || [];
      if (imgsG.length > 0) window.__BACKUP_IMG_G = imgsG[0];
    }
  }

  // 4. Configuração final do container
  container.id = 'extractionResult';
  container.className = 'extraction-result';

  return container;
};