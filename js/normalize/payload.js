import { pick } from "../utils/pick.tsx";
import { normalizeAlternativasAnalisadas } from "./alternativas.js";
import { normCreditos } from "./creditos.js";
import { normalizeExplicacao } from "./explicacao.js";
import { asArray, asStringArray, safeClone } from "./primitives.js";

/**
 * PREPARAÇÃO DE DADOS INICIAIS
 * Desembrulha o payload (root), detecta se é gabarito e normaliza a resposta.
 */
export const _prepararDadosIniciais = (dados) => {
  // A IA às vezes manda o payload embrulhado (resultado/data/etc.)
  const root = pick(dados?.resultado, dados?.data, dados?.payload, dados) ?? {};

  // Detecta se é Gabarito baseado nos campos do dado, não no modo e usando 'in' para evitar falsos negativos com strings vazias
  const isGabaritoData = 
    ('alternativa_correta' in root) || 
    ('resposta' in root) || 
    ('justificativa_curta' in root) || 
    ('resposta_modelo' in root) || 
    ('explicacao' in root) || 
    ('analise_complexidade' in root);

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
    pick(root?.explicacao, root?.resolucao, []),
  );

  // 2. Injeta imagens nos passos
  const explicacaoComImagens = explicacaoBasica.map((passo, idxPasso) => {
    const imgsDestePasso =
      window.__imagensLimpas?.gabarito_passos?.[idxPasso] || [];

    // Usa o helper genérico para injetar imagens na estrutura deste passo
    const novaEstrutura = _injetarImagensEmEstrutura(
      passo.estrutura,
      imgsDestePasso,
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
        "",
      ) ?? "",
    ),
    justificativa_curta: String(
      pick(root?.justificativa_curta, root?.justificativacurta, "") ?? "",
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
      String(pick(root?.alternativa_correta, root?.resposta, "")),
    ),
    coerencia: root?.coerencia ?? {},
    fontes_externas: root?.fontes_externas || [],
    texto_referencia: root?.texto_referencia || "",
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
          tipo: "texto",
          conteudo: String(
            pick(root?.enunciado, root?.texto, root?.statement, "") ?? "",
          ),
        },
      ];

  // Injeta imagens no enunciado
  const estruturaEnunciado = _injetarImagensEmEstrutura(
    estruturaEnunciadoRaw,
    imgsEnunciado,
  );

  // Processa Alternativas
  const alternativasRaw = asArray(
    pick(root?.alternativas, root?.alternatives, []),
  );
  const alternativasProcessadas = alternativasRaw.map((a) => {
    const letra = String(pick(a?.letra, a?.letter, "") ?? "")
      .trim()
      .toUpperCase();
    const imgsDestaLetra = imgsAlternativasMap[letra] || [];

    const estruturaBruta = Array.isArray(a?.estrutura)
      ? a.estrutura
      : [
          {
            tipo: "texto",
            conteudo: String(pick(a?.texto, a?.text, "") ?? ""),
          },
        ];

    // Injeta imagens na alternativa
    const estrutura = _injetarImagensEmEstrutura(
      estruturaBruta,
      imgsDestaLetra,
    ).filter((b) => ["texto", "equacao", "imagem"].includes(b.tipo));

    return { letra, estrutura };
  });

  return {
    identificacao: String(
      pick(root?.identificacao, root?.id, root?.codigo, "") ?? "",
    ),
    foto_original: root?.scan_original || imgsEnunciado[0] || null,
    estrutura: estruturaEnunciado,
    materias_possiveis: asArray(
      pick(root?.materias_possiveis, root?.materiaspossiveis, []),
    ).map(String),
    palavras_chave: asArray(
      pick(root?.palavras_chave, root?.palavraschave, []),
    ).map(String),
    tipo_resposta: String(pick(root?.tipo_resposta, root?.tiporesposta, "objetiva")),
    alternativas: alternativasProcessadas,
    fotos_originais: asArray(pick(root?.fotos_originais, [])),
  };
};

/**
 * 4. HELPER: INJETOR DE IMAGENS
 * Percorre uma lista de blocos e associa imagens de um array externo aos blocos do tipo 'imagem'.
 */
export const _injetarImagensEmEstrutura = (estrutura, imagensDisponiveis) => {
  let cursor = 0;

  return (estrutura || []).map((bloco) => {
    const tipo = String(bloco?.tipo || "texto")
      .toLowerCase()
      .trim();
    const conteudo = String(bloco?.conteudo ?? "");

    if (tipo === "imagem") {
      // Pega da memória local OU mantém o que já estava salvo
      // [FIX] Preservar campos novos (imagem_url, pdf_url, etc) com ...bloco
      const imagemLocal = imagensDisponiveis[cursor];
      cursor++;

      if (imagemLocal) {
        // Se temos uma imagem salva localmente (edição), ela tem prioridade total
        // Misturamos com o bloco original apenas para manter campos que não mudaram (se houver)
        // Mas garantimos que conteudo/url/etc venham do local
        return {
          ...bloco, // Base original
          ...imagemLocal, // Sobrescreve com dados locais (pdf_url, coords, etc)
          tipo: "imagem", // Garante tipo
          conteudo: imagemLocal.conteudo || bloco.conteudo, // Mantém descrição se não houver nova
        };
      }

      return {
        ...bloco, // Preserva outros campos (conteudo, metadados PDF, etc)
        tipo: "imagem",
        conteudo: conteudo,
      };
    }

    return { ...bloco, tipo, conteudo };
  });
};

/**
 * Gerencia a atualização das variáveis globais de estado.
 * Salva no global de gabarito ou de questão dependendo do tipo do dado.
 */
export const _atualizarEstadoGlobal = (dados, dadosNorm, isGabaritoData) => {
  if (isGabaritoData) {
    // É Gabarito, atualiza a variável global do gabarito
    window.__ultimoGabaritoExtraido = safeClone(dadosNorm);
  } else {
    // É Questão, atualiza a variável global da questão
    window.__ultimaQuestaoExtraida = safeClone(dadosNorm);
  }
};

/**
 * PREPARAÇÃO BÁSICA DA INTERFACE E ESTADO
 * Define variáveis de segurança, limpa loaders/overlays e seleciona elementos do DOM.
 */
export const _prepararInterfaceBasica = (dadosNorm) => {
  let questao = window.__ultimaQuestaoExtraida;

  // Fallback de segurança: se não tem questão salva, usa o dado atual
  if (!questao) {
    window.__ultimaQuestaoExtraida = dadosNorm;
    questao = dadosNorm;
  }

  // --- LIMPEZA DE UI (Loaders e Botões Antigos) ---
  document.getElementById("reopenSidebarBtn")?.remove();

  const skeletonLoader = document.getElementById("ai-skeleton-loader");
  if (skeletonLoader && skeletonLoader.parentElement) {
    skeletonLoader.parentElement.remove();
  }

  // --- SELEÇÃO DE ELEMENTOS DO VIEWER ---
  const viewerBody = document.getElementById("viewerBody");
  const main = document.getElementById("viewerMain");

  // Nota: Retornamos como valores para serem manipulados (criados) depois se necessário
  const sidebar = document.getElementById("viewerSidebar");
  const resizer = document.getElementById("sidebarResizer");

  // --- LIMPEZA DE OVERLAYS DE RECORTE ---
  document.querySelector(".selection-box")?.remove();
  document.getElementById("crop-overlay")?.remove();

  // Remove skeleton interno da sidebar, se houver
  const skeleton = sidebar?.querySelector(".skeleton-loader");
  if (skeleton) skeleton.remove();

  // Retorna tudo que o restante da função principal vai precisar usar
  return {
    questao,
    gabarito: window.__ultimoGabaritoExtraido || null, // Busca gabarito do global
    viewerBody,
    main,
    sidebar,
    resizer,
  };
};

/**
 * Prepara o container principal de renderização e garante backups das imagens originais.
 * [BATCH FIX] Agora respeita o elementoAlvo para criar containers únicos por aba.
 */
export const _prepararContainerEBackups = (elementoAlvo, dados) => {
  let container;

  // [BATCH FIX] Se temos um elementoAlvo específico (ex: container de aba),
  // criamos um container filho NOVO em vez de reusar um global.
  if (
    elementoAlvo &&
    elementoAlvo.id &&
    elementoAlvo.id.startsWith("tab-content-")
  ) {
    // Container específico para esta aba
    const uniqueId = `extractionResult-${elementoAlvo.id}`;
    container = document.getElementById(uniqueId);

    if (!container) {
      container = document.createElement("div");
      container.id = uniqueId;
    }
  } else {
    // Comportamento legado: busca ou cria container global
    container = document.getElementById("extractionResult");

    if (!container) {
      const legacy = document.getElementById("renderContainer");
      if (legacy && legacy !== elementoAlvo) {
        container = legacy;
      }
    }

    if (!container) {
      container = document.createElement("div");
      container.id = "renderContainer";
    }

    // Configuração final do container legado
    container.id = "extractionResult";
  }

  // 2. Lógica de Backup (Questão)
  if (!window.__BACKUP_IMG_Q) {
    const imgsQ = window.__imagensLimpas?.questao_original || [];
    if (imgsQ.length > 0) window.__BACKUP_IMG_Q = imgsQ[0];
  }

  // Configuração de classe
  container.className = "extraction-result";

  return container;
};
