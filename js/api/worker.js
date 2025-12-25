// --- CONFIGURAÇÃO DO WORKER ---
// Para local: http://localhost:8787
// Para prod: Sua URL do Cloudflare (ex: https://meu-worker.seu-usuario.workers.dev)
export const WORKER_URL =
  import.meta.env?.VITE_WORKER_URL || "http://localhost:8787";
console.log(
  "DEBUG ENV:",
  import.meta.env?.VITE_WORKER_URL,
  "FINAL URL:",
  WORKER_URL
);

/**
 * Helper to construct the Proxy URL with robust decoding/encoding of the target URL.
 * Solves issues with double/triple encoded URLs from various sources.
 */
export function getProxyPdfUrl(rawUrl) {
  if (!rawUrl) return null;

  // Robust Decoding Initial
  let cleanUrl = rawUrl;
  try {
    let iterations = 0;
    while (cleanUrl.includes('%') && iterations < 5) {
      const decoded = decodeURIComponent(cleanUrl);
      if (decoded === cleanUrl) break;
      cleanUrl = decoded;
      iterations++;
    }
  } catch (e) { }

  if (cleanUrl.startsWith('blob:') || cleanUrl.includes('localhost') || cleanUrl.includes('127.0.0.1')) return cleanUrl;

  return `${WORKER_URL}/proxy-pdf?url=${encodeURIComponent(cleanUrl)}`;
}

/**
 * Função genérica para chamar o Worker
 */
export async function callWorker(endpoint, body) {
  try {
    const response = await fetch(`${WORKER_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...body,
        apiKey: sessionStorage.getItem("GOOGLE_GENAI_API_KEY") || undefined,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Erro HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Erro ao chamar Worker (${endpoint}):`, error);
    throw error;
  }
}

export async function gerarConteudo(texto) {
  // O endpoint /generate retorna JSON. Se precisar só de texto, adaptamos.
  // Mas seu uso parece focado em JSON. Vamos manter compatibilidade básica.
  // Se for uso legado que espera string, pegaremos o JSON e stringificaremos ou ajustaremos o worker.
  // Por enquanto, vou supor que o uso principal é o JSON.
  const result = await callWorker("/generate", { texto });
  return typeof result === "string" ? result : JSON.stringify(result);
}

export async function gerarConteudoEmJSON(texto, schema = null) {
  return await callWorker("/generate", { texto, schema });
}

export async function gerarConteudoEmJSONComImagem(
  texto,
  schema = null,
  listaImagensBase64 = [],
  mimeType = "image/jpeg"
) {
  return await callWorker("/generate", {
    texto,
    schema,
    listaImagensBase64,
    mimeType,
  });
}

export async function gerarConteudoEmJSONComImagemStream(
  texto,
  schema = null,
  listaImagensBase64 = [],
  mimeType = "image/jpeg",
  handlers = {}
) {
  handlers?.onStatus?.("Conectando ao Worker...");

  try {
    const response = await fetch(`${WORKER_URL}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        texto,
        schema,
        listaImagensBase64,
        mimeType,
        apiKey: sessionStorage.getItem("GOOGLE_GENAI_API_KEY") || undefined,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Erro HTTP ${response.status}`);
    }

    if (!response.body) throw new Error("Resposta sem corpo (stream)");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let answerText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Decode current chunk e add to buffer
      buffer += decoder.decode(value, { stream: true });

      // Process lines individually
      let parts = buffer.split("\n");
      // Last part might be incomplete, keep it in buffer
      buffer = parts.pop() || "";

      for (const line of parts) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          console.log(msg);
          if (msg.type === "thought") {
            handlers?.onThought?.(msg.text);
          } else if (msg.type === "answer") {
            handlers?.onAnswerDelta?.(msg.text);
            answerText += msg.text;
          } else if (msg.type === "debug") {
            console.log("🛠️ WORKER DEBUG:", msg.text);
          } else if (msg.type === "error") {
            if (msg.code === 'RECITATION') {
              console.warn("⚠️ Não foi possível responder por conta de recitação.");
              throw new Error('RECITATION_ERROR');
            }
            console.error("Erro do worker stream:", msg.text);
            handlers?.onStatus?.(`Erro: ${msg.text}`);
          } else if (msg.type === "status") {
            handlers?.onStatus?.(msg.text);
          } else if (msg.type === "reset") {
            console.log("♻️ Tentativa falhou com RECITATION. Reiniciando buffer...");
            answerText = "";
            handlers?.onStatus?.("Recitation detectado. Tentando novamente...");
          }
        } catch (e) {
          if (e.message === 'RECITATION_ERROR') throw e;
          console.warn("Erro ao parsear chunk do worker:", line, e);
        }
      }
    }

    // Final buffer processing
    if (buffer.trim()) {
      try {
        const msg = JSON.parse(buffer);
        if (msg.type === "answer") answerText += msg.text;
      } catch (e) { }
    }

    // Apenas garantimos que não está vazio antes de parsear
    if (!answerText || !answerText.trim()) {
      throw new Error(
        "A API retornou vazio. Verifique se o modelo está sobrecarregado."
      );
    }

    console.log(answerText);

    return JSON.parse(answerText);
  } catch (error) {
    if (error.message === 'RECITATION_ERROR') throw error;
    console.error("Erro no Worker stream:", error);
    throw new Error(`Falha no Worker: ${error.message}`);
  }
}

export async function gerarEmbedding(texto) {
  // console.log("Chamando Embedding no Worker...");
  return await callWorker("/embed", { texto });
}

/**
 * Faz upload de imagem via Worker (ImgBB)
 * @param {string} imageBase64 - String Base64 completa da imagem
 * @returns {Promise<string|null>} - URL da imagem ou null
 */
export async function uploadImagemWorker(imageBase64) {
  try {
    const result = await callWorker("/upload-image", { image: imageBase64 });
    return result.success ? result.data.url : null;
  } catch (error) {
    console.error("Erro no upload de imagem via Worker:", error);
    return null;
  }
}

/**
 * Envia vetores para o Pinecone via Worker
 * @param {Array} vectors - Lista de vetores {id, values, metadata}
 * @param {string} namespace - Namespace opcional
 * @returns {Promise<any>}
 */
export async function upsertPineconeWorker(vectors, namespace = "") {
  return await callWorker("/pinecone-upsert", { vectors, namespace });
}

/**
 * Realiza uma pesquisa via Worker (usando Google Search Grounding)
 * Suporta STREAMING para exibir Thoughts.
 * @returns {Promise<any>} - Retorna objecto { report: string, sources: Array }
 */
export async function realizarPesquisa(texto, listaImagensBase64 = [], handlers = {}, schema = null) {
  handlers?.onStatus?.("Conectando ao Researcher...");

  try {
    const response = await fetch(`${WORKER_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        texto,
        listaImagensBase64,
        schema,
        apiKey:
          typeof sessionStorage !== "undefined"
            ? sessionStorage.getItem("GOOGLE_GENAI_API_KEY")
            : undefined,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Erro HTTP ${response.status}`);
    }

    if (!response.body) throw new Error("Resposta sem corpo (stream)");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    let reportText = "";
    let groundingMetadata = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let parts = buffer.split("\n");
      buffer = parts.pop() || "";

      for (const line of parts) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);

          if (msg.type === "thought") {
            handlers?.onThought?.(msg.text);
          } else if (msg.type === "answer") {
            // No caso do Search, 'answer' é o texto do relatório
            reportText += msg.text;
          } else if (msg.type === "grounding") {
            groundingMetadata = msg.metadata;
          } else if (msg.type === "error") {
            throw new Error(msg.message || "Erro no worker de pesquisa");
          } else if (msg.type === "reset") {
            // Limpa relatório se houver reset (recitation)
            reportText = "";
            handlers?.onStatus?.("Recitation detectado na pesquisa. Tentando novo modelo...");
          }
        } catch (e) {
          console.warn("Erro parse stream pesquisa:", e);
        }
      }
    }

    // Processa metadados
    console.log("DEBUG: Raw Grounding Metadata:", groundingMetadata);

    const chunks = groundingMetadata?.groundingChunks || groundingMetadata?.grounding_chunks || [];
    const sources = chunks
      .map(c => c.web)
      .filter(w => w && w.uri); // Relaxado: exige apenas URI, título opcional

    return {
      report: reportText,
      sources: sources,
      rawMetadata: groundingMetadata
    };

  } catch (error) {
    console.error("Erro na pesquisa streaming:", error);
    throw error;
  }
}

const PROMPT_PESQUISADOR = `Role: Você é um Pesquisador Sênior em Conteúdo Educacional (Vestibulares e Concursos).
Objetivo: Eu tenho uma imagem de uma questão e preciso que você encontre a resolução original dela na internet e escreva um RELATÓRIO TÉCNICO DE RESOLUÇÃO (Não use "Exaustiva", seja objetivo e técnico).
Suas Instruções de Pesquisa (Search Tools):
OBRIGATÓRIO: Você DEVE usar a ferramenta de busca (Google Search) para validar o texto da questão e encontrar a fonte original. Execute buscas múltiplas se necessário.
Encontre a Questão: Use o texto da imagem para achar a prova original (Ex: Fuvest 2021, ENEM 2018, Banca Vunesp).
Ache o Gabarito Oficial: Descubra qual é a alternativa correta (Gabarito Oficial ou Definitivo).
Consulte os Mestres: Leia as resoluções de sites de elite (Poliedro, Anglo, Objetivo, Etapa, QConcursos, Descomplica). Veja como diferentes professores explicaram.
Instruções de Escrita (O Relatório):
Não use estruturas rígidas. Sinta-se livre para estruturar a explicação da forma que julgar mais didática e completa para este caso específico.
Seja Obcecado por Detalhes: Se for Matemática, narre cada transformação algébrica. Se for História, dê o contexto da época. Se for Biologia, explique o processo fisiológico a fundo.
Fundamente tudo: Não tire nada da sua cabeça. Use as informações que você leu nas resoluções online. Se o site do Anglo diz X e o Objetivo diz Y, mencione ambos se isso enriquecer a explicação.
Argumente contra o Erro: Se possível, explique brevemente por que as alternativas erradas ("distratores") estão erradas.`;

/**
 * Função orquestradora para Gabarito:
 * 1. Pesquisa / Relatório
 * 2. Geração da resposta final baseada no relatório
 */
export async function gerarGabaritoComPesquisa(
  promptDaIA,
  JSONEsperado,
  listaImagens,
  mimeType,
  handlers,
  imagensPesquisa = [], // Argumento opcional para imagens limpas/originais
  textoQuestao = ""      // Contexto específico da questão (JSON/Texto) para a pesquisa
) {
  // 1. Etapa de Pesquisa
  handlers?.onStatus?.("🕵️ Analisando imagem e pesquisando resoluções (Step 1/2)...");

  let relatorioPesquisa = "";
  let fontesEncontradas = [];

  // Decide quais imagens usar na pesquisa: 
  // Se tiver imagens de pesquisa específicas (limpas), usa elas. Senão, usa as da lista (carimbadas/misturadas).
  const imagensParaBusca = (imagensPesquisa && imagensPesquisa.length > 0)
    ? imagensPesquisa
    : listaImagens;

  try {
    // Adiciona o contexto da questão (SE FORNECIDO) ao prompt do pesquisador
    // Agora usamos 'textoQuestao' em vez de 'promptDaIA' para não poluir com instruções do próximo passo
    let promptPesquisaComContexto = PROMPT_PESQUISADOR;

    if (textoQuestao) {
      promptPesquisaComContexto += `\n\n--- DADOS DA QUESTÃO ---\nUse o texto abaixo para localizar a questão original:\n${textoQuestao}`;
    }

    // Passamos os handlers para ver thoughts também nesta etapa
    const searchResult = await realizarPesquisa(promptPesquisaComContexto, imagensParaBusca, {
      onStatus: handlers?.onStatus,
      onThought: handlers?.onThought // Thoughts do pesquisador!
    });

    relatorioPesquisa = searchResult.report;
    fontesEncontradas = searchResult.sources || [];

    console.log("DEBUG: Relatório Pesquisa:", relatorioPesquisa);
    console.log("DEBUG: Fontes Encontradas:", fontesEncontradas);

  } catch (err) {
    console.warn("Falha na etapa de pesquisa (prosseguindo sem contexto extra):", err);
    handlers?.onStatus?.("⚠️ Pesquisa falhou, gerando com conhecimento interno...");
  }

  // 2. Etapa de Geração Final
  handlers?.onStatus?.("✍️ Escrevendo gabarito detalhado com base na pesquisa (Step 2/2)...");

  // Enriquece o prompt original com o relatório
  // Enriquece o prompt original com o relatório
  let finalPrompt = promptDaIA;
  if (relatorioPesquisa) {
    finalPrompt += `\n\n--- INÍCIO DO RELATÓRIO DE PESQUISA (Contexto Obrigatório) ---\nUse as informações abaixo para enriquecer a explicação e garantir a precisão do gabarito:\n${relatorioPesquisa}\n--- FIM DO RELATÓRIO ---\n`;
    finalPrompt += `\nINSTRUÇÃO OBRIGATÓRIA DE CITAÇÃO:\nVocê DEVE utilizar as informações do relatório acima para compor a explicação. SE O RELATÓRIO CITOU UMA FONTE ESPECÍFICA (Site X, Professor Y), VOCÊ DEVE MENCIONAR ISSO NO CAMPO 'evidencia' DE CADA PASSO.\nExemplo de evidencia: "Adaptado da resolução do site Etapa".\nExemplo de evidencia: "Confirmação via gabarito oficial da Fuvest encontrado na pesquisa".\nNUNCA INVENTE FONTES. Se não usar o relatório, diga "Análise IA".`;
  }

  // Chama a geração normal (streaming)
  const jsonFinal = await gerarConteudoEmJSONComImagemStream(
    finalPrompt,
    JSONEsperado,
    listaImagens,
    mimeType,
    handlers
  );

  // 3. Injeção HARDCODED das fontes e relatório no JSON final
  if (fontesEncontradas.length > 0) {
    jsonFinal.fontes_externas = fontesEncontradas;
  }

  if (relatorioPesquisa) {
    jsonFinal.texto_referencia = relatorioPesquisa; // Para renderizar na UI por demanda
  }

  console.log("DEBUG: JSON FINAL GABARITO:", jsonFinal);

  return jsonFinal;
}
