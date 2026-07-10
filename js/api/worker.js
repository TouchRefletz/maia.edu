import { parseStreamedJSON } from "../utils/json-stream-parser.js";

/**
 * Limpa blocos de código markdown (como ```json e ```) no início/fim de uma string JSON.
 */
function cleanJsonString(str) {
  if (typeof str !== "string") return str;
  let cleaned = str.trim();
  // Remove markdown codeblock no início (ex: ```json ou ```)
  cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/, "");
  // Remove markdown codeblock no final (ex: ```)
  cleaned = cleaned.replace(/\s*```$/, "");
  return cleaned.trim();
}

// --- CONFIGURAÇÃO DO WORKER ---
// Para local: http://localhost:8787
// Para prod: Sua URL do Cloudflare (ex: https://meu-worker.seu-usuario.workers.dev)
export const WORKER_URL =
  import.meta.env?.VITE_WORKER_URL || "http://localhost:8787";
console.log(
  "DEBUG ENV:",
  import.meta.env?.VITE_WORKER_URL,
  "FINAL URL:",
  WORKER_URL,
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
    while (cleanUrl.includes("%") && iterations < 5) {
      const decoded = decodeURIComponent(cleanUrl);
      if (decoded === cleanUrl) break;
      cleanUrl = decoded;
      iterations++;
    }
  } catch (e) {}

  if (
    cleanUrl.startsWith("blob:") ||
    cleanUrl.includes("localhost") ||
    cleanUrl.includes("127.0.0.1") ||
    cleanUrl.includes("download.inep.gov.br")
  )
    return cleanUrl;

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
      signal: body.signal, // Adicionado suporte a signal
      body: JSON.stringify({
        apiKey: sessionStorage.getItem("GOOGLE_GENAI_API_KEY") || undefined,
        githubApiKey: sessionStorage.getItem("GITHUB_PAT_KEY") || sessionStorage.getItem("githubApiKey") || undefined,
        groqApiKey: sessionStorage.getItem("GROQ_API_KEY") || undefined,
        ...body,
        signal: undefined, // Não enviar signal no corpo JSON
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Erro HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (
      !navigator.onLine ||
      (error.name === "TypeError" &&
        error.message.includes("Failed to fetch")) ||
      error.message === "NETWORK_ERROR"
    ) {
      throw new Error("NETWORK_ERROR");
    }
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
  mimeType = "image/jpeg",
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
  attachments = [], // Renamed from listaImagensBase64 to support generic files
  mimeType = "image/jpeg",
  handlers = {},
  options = {},
) {
  const MAX_RETRIES = 3;
  let attempt = 0;

  // Prepare payload based on attachment type
  let payloadImages = [];
  let payloadFiles = [];

  if (Array.isArray(attachments) && attachments.length > 0) {
    if (typeof attachments[0] === "string") {
      // Legacy behavior: Array of Base64 strings (Images only)
      payloadImages = attachments;
    } else if (typeof attachments[0] === "object") {
      // New behavior: Array of { data, mimeType } objects
      payloadFiles = attachments;
    }
  }

  while (attempt < MAX_RETRIES) {
    attempt++;
    const isRetry = attempt > 1;

    if (handlers?.onAttemptStart) {
      try {
        handlers.onAttemptStart();
      } catch (err) {
        console.error("[Worker] Error in onAttemptStart handler:", err);
      }
    }

    // Atualiza status na UI
    if (handlers?.onStatus) {
      if (isRetry) {
        handlers.onStatus(
          `Re-tentando conexão com IA (${attempt}/${MAX_RETRIES})...`,
        );
      } else {
        handlers.onStatus("Conectando ao Worker (1/3)...");
      }
    }

    try {
      // [DEBUG] Log API key status
      const customApiKey = options.apiKey || sessionStorage.getItem("GOOGLE_GENAI_API_KEY");
      const customGithubKey = options.githubApiKey || sessionStorage.getItem("GITHUB_PAT_KEY") || sessionStorage.getItem("githubApiKey");
      const customGroqKey = options.groqApiKey || sessionStorage.getItem("GROQ_API_KEY");
      console.log(
        `[Worker] Attempt ${attempt}/${MAX_RETRIES} - API Key present: ${!!customApiKey}, GitHub Key present: ${!!customGithubKey}, Groq Key present: ${!!customGroqKey}`,
      );

      const response = await fetch(`${WORKER_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: handlers.signal,
        body: JSON.stringify({
          apiKey: customApiKey || undefined,
          githubApiKey: customGithubKey || undefined,
          groqApiKey: customGroqKey || undefined,
          texto,
          schema: schema || undefined,
          jsonMode: !!schema,
          listaImagensBase64:
            payloadImages.length > 0 ? payloadImages : undefined,
          files: payloadFiles.length > 0 ? payloadFiles : undefined,
          mimeType,
          model: options.model,
          generationConfig: options.generationConfig,
          chatMode: options.chatMode,
          history: options.history,
          systemInstruction: options.systemInstruction,
          thinking: options.thinking !== undefined ? options.thinking : true,
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
              try {
                handlers?.onThought?.(msg.text);
              } catch (err) {
                console.error("Error in onThought handler:", err);
              }
            } else if (msg.type === "gemma_latency") {
              try {
                handlers?.onGemmaLatency?.(msg.latency_ms);
              } catch (err) {
                console.error("Error in onGemmaLatency handler:", err);
              }
            } else if (msg.type === "answer") {
              // Accumulate FIRST to ensure data integrity
              answerText += msg.text;
              try {
                handlers?.onAnswerDelta?.(msg.text);
              } catch (err) {
                console.error("Error in onAnswerDelta handler:", err);
              }
            } else if (msg.type === "debug") {
              console.log("🛠️ WORKER DEBUG:", msg.text);
            } else if (msg.type === "error") {
              if (msg.code === "RECITATION") {
                console.warn(
                  "⚠️ Não foi possível responder por conta de recitação.",
                );
                throw new Error("RECITATION_ERROR");
              }

              // Tratamento de Rate Limit / Sobrecarga / Falha Geral
              const isRateLimit =
                msg.status === 429 ||
                msg.status === 503 ||
                (msg.code === "ALL_MODELS_FAILED" &&
                  /rate|limit|quota|exhausted|429/i.test(msg.message || ""));

              if (isRateLimit) {
                console.error(
                  "⚠️ Worker Rate Limit/Outage:",
                  msg.code,
                  msg.message,
                  msg.attempts,
                );
                throw new Error("RATE_LIMIT_ERROR");
              } else if (msg.code === "ALL_MODELS_FAILED") {
                console.error(
                  "⚠️ Worker Model Execution Failed:",
                  msg.code,
                  msg.message,
                  msg.attempts,
                );
                throw new Error(`WORKER_RUN_FAILED: ${msg.message || "Unknown error"}`);
              }

              console.error("Erro do worker stream:", msg.text);
              handlers?.onStatus?.(`Erro: ${msg.text}`);
            } else if (msg.type === "status") {
              handlers?.onStatus?.(msg.text);
            } else if (msg.type === "reset") {
              console.log(
                "♻️ Tentativa falhou com RECITATION. Reiniciando buffer...",
              );
              answerText = "";
              if (handlers?.onReset) {
                try {
                  handlers.onReset();
                } catch (err) {
                  console.error("Error in onReset handler:", err);
                }
              }
              handlers?.onStatus?.(
                "Recitation detectado. Tentando novamente...",
              );
            }
          } catch (e) {
            if (e.message === "RECITATION_ERROR") throw e;
            if (e.message === "RATE_LIMIT_ERROR") throw e;
            if (e.message?.startsWith("WORKER_RUN_FAILED")) throw e;
            console.warn("Erro ao parsear chunk do worker:", line, e);
          }
        }
      }

      // Final buffer processing
      if (buffer.trim()) {
        try {
          const msg = JSON.parse(buffer);
          if (msg.type === "answer") answerText += msg.text;
        } catch (e) {}
      }

      // Apenas garantimos que não está vazio antes de parsear
      if (!answerText || !answerText.trim()) {
        throw new Error("EMPTY_RESPONSE_ERROR");
      }

      console.log(answerText);

      const cleanedAnswer = cleanJsonString(answerText);

      try {
        return JSON.parse(cleanedAnswer);
      } catch (pe) {
        if (schema) {
          console.warn("[Worker] Resposta não é JSON perfeito. Tentando recuperar...");
          const parsedRecovered = parseStreamedJSON(cleanedAnswer);
          if (parsedRecovered && typeof parsedRecovered === "object") {
            console.log("[Worker] JSON recuperado com sucesso via best-effort!");
            return parsedRecovered;
          }
          throw new Error("INVALID_JSON_STRUCTURE");
        }
        console.log("[Worker] Resposta não é JSON válido. Retornando texto bruto.", pe.message);
        return answerText;
      }
    } catch (error) {
      if (error.name === "AbortError") throw error;
      if (error.message === "RECITATION_ERROR") throw error;
      if (error.message === "RATE_LIMIT_ERROR") throw error;

      // Classifica se o erro é temporário/elegível para nova tentativa (incluindo falha de modelo e rede)
      const isRetryable =
        error.message === "EMPTY_RESPONSE_ERROR" ||
        error.message === "INVALID_JSON_STRUCTURE" ||
        error.message.startsWith("WORKER_RUN_FAILED") ||
        (error.name === "TypeError" && error.message.includes("Failed to fetch")) ||
        error.message === "NETWORK_ERROR";

      if (isRetryable) {
        if (attempt < MAX_RETRIES) {
          console.warn(
            `[Worker] Erro temporário detectado (${error.message}) na tentativa ${attempt}/${MAX_RETRIES}. Tentando novamente em ${attempt}s...`,
          );
          // Aguarda com delay incremental (1s, 2s, etc)
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }
      }

      // Se esgotou as tentativas ou o erro não é elegível para retry
      if (error.message === "EMPTY_RESPONSE_ERROR") throw error;

      // Detecção de erro de rede
      if (
        !navigator.onLine ||
        (error.name === "TypeError" &&
          error.message.includes("Failed to fetch")) ||
        error.message === "NETWORK_ERROR"
      ) {
        throw new Error("NETWORK_ERROR");
      }

      console.error("Erro no Worker stream:", error);
      throw new Error(`Falha no Worker: ${error.message}`);
    }
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
 * @param {string} target - 'default' (main/deep-search) ou 'filter' (maia-filter)
 * @returns {Promise<any>}
 */
export async function upsertPineconeWorker(
  vectors,
  namespace = "",
  target = "default",
) {
  return await callWorker("/pinecone-upsert", { vectors, namespace, target });
}

/**
 * Limpa todos os vetores no Pinecone para um determinado target index
 * @param {string} target - 'default', 'filter' ou 'maia-memory'
 * @returns {Promise<any>}
 */
export async function clearAllPineconeVectors(target = "default") {
  return await callWorker("/pinecone-clear-all", { target });
}

/**
 * Consulta Pinecone via Worker
 * @param {Array} vector - Vetor de consulta
 * @param {number} topK - Número de resultados
 * @param {Object} filter - Filtros de metadados
 * @param {string} target - 'default' ou 'filter'
 * @param {string} namespace - Namespace opcional
 * @returns {Promise<any>}
 */
export async function queryPineconeWorker(
  vector,
  topK = 1,
  filter = {},
  target = "default",
  namespace = "",
) {
  return await callWorker("/pinecone-query", {
    vector,
    topK,
    filter,
    target,
    namespace,
  });
}

/**
 * Tenta extrair a URL original de URIs que podem ser proxies (Google, Vertex, etc.)
 * Resolve o problema de domínios "vertexaisearch" e falta de favicons.
 */
function resolveOriginalSourceUrl(uri, title) {
  if (!uri) return null;
  try {
    // Se o título já for uma URL, é a fonte mais direta
    if (
      title &&
      (title.startsWith("http://") || title.startsWith("https://"))
    ) {
      return title;
    }

    const url = new URL(uri);

    // 1. Tratamento para Google Search Proxy
    if (
      url.hostname.includes("google.com") &&
      (url.pathname.includes("/url") || url.pathname.includes("/search"))
    ) {
      const target = url.searchParams.get("url") || url.searchParams.get("q");
      if (target && target.startsWith("http")) return target;
    }

    // 2. Tratamento para Vertex AI Search
    if (
      url.hostname.includes("vertexaisearch.googleapis.com") ||
      url.hostname.includes("vertexaisearch.cloud.google.com")
    ) {
      const target =
        url.searchParams.get("url") ||
        url.searchParams.get("link") ||
        url.searchParams.get("uri");
      if (target && target.startsWith("http")) return target;
    }

    return uri;
  } catch (e) {
    // Se falhar o parse do URL, retorna original ou tenta regex simples se for Vertex
    if (uri.includes("url=http")) {
      const match = uri.match(/url=(https?%3A%2F%2F[^&]+)/);
      if (match) return decodeURIComponent(match[1]);
    }
    return uri;
  }
}

// Cache local para evitar múltiplas requisições para o mesmo link no mesmo carregamento
const urlResolutionCache = new Map();

/**
 * Resolve um link original via worker (on-demand)
 * Útil para limpar links de redirecionamento do Google Search Grounding.
 */
export async function resolveLinkOnDemand(uri) {
  if (!uri || !uri.startsWith("http")) return uri;

  // 1. Tenta limpeza local rápida primeiro
  const fastResolve = resolveOriginalSourceUrl(uri);
  if (fastResolve !== uri) return fastResolve;

  // 2. Verifica se o domínio é um alvo que precisa de resolução remota
  const needsRemote =
    uri.includes("vertexaisearch.cloud.google.com") ||
    uri.includes("google.com/url");

  if (!needsRemote) return uri;

  // 3. Cache
  if (urlResolutionCache.has(uri)) return urlResolutionCache.get(uri);

  try {
    const workerUrl =
      typeof import.meta !== "undefined" && import.meta.env?.VITE_WORKER_URL
        ? import.meta.env.VITE_WORKER_URL
        : "https://maia-api.touchrefletz.workers.dev";

    const apiUrl = `${workerUrl}/resolve-link?url=${encodeURIComponent(uri)}`;
    const res = await fetch(apiUrl);

    if (res.ok) {
      const data = await res.json();
      if (data.resolved) {
        urlResolutionCache.set(uri, data.resolved);
        return data.resolved;
      }
    }
  } catch (e) {
    console.warn("[Worker API] Erro ao resolver link:", e);
  }

  return uri;
}

/**
 * Realiza uma pesquisa via Worker (usando Google Search Grounding)
 * Suporta STREAMING para exibir Thoughts.
 * @returns {Promise<any>} - Retorna objecto { report: string, sources: Array }
 */
export async function realizarPesquisa(
  texto,
  listaImagensBase64 = [],
  handlers = {},
  schema = null,
  model = null,
) {
  handlers?.onStatus?.("Conectando ao Researcher...");

  try {
    const response = await fetch(`${WORKER_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: handlers?.signal,
      body: JSON.stringify({
        apiKey:
          typeof sessionStorage !== "undefined"
            ? sessionStorage.getItem("GOOGLE_GENAI_API_KEY")
            : undefined,
        githubApiKey:
          typeof sessionStorage !== "undefined"
            ? (sessionStorage.getItem("GITHUB_PAT_KEY") || sessionStorage.getItem("githubApiKey"))
            : undefined,
        groqApiKey:
          typeof sessionStorage !== "undefined"
            ? sessionStorage.getItem("GROQ_API_KEY")
            : undefined,
        texto,
        listaImagensBase64,
        schema,
        model,
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
          console.log(msg);

          if (msg.type === "meta" && msg.event === "attempt_start") {
            handlers?.onStatus?.(`🤖 Modelo: ${msg.model}`);
          }

          if (msg.type === "thought") {
            handlers?.onThought?.(msg.text);
          } else if (msg.type === "answer") {
            // No caso do Search, 'answer' é o texto do relatório
            reportText += msg.text;
            handlers?.onStatus?.("🔎 Pesquisando e compilando relatório...");
          } else if (msg.type === "grounding") {
            groundingMetadata = msg.metadata;
          } else if (msg.type === "error") {
            throw new Error(msg.message || "Erro no worker de pesquisa");
          } else if (msg.type === "reset") {
            // Limpa relatório se houver reset (recitation)
            reportText = "";
            if (handlers?.onReset) {
              try {
                handlers.onReset();
              } catch (err) {
                console.error("Error in onReset handler:", err);
              }
            }
            handlers?.onStatus?.(
              "Recitation detectado na pesquisa. Tentando novo modelo...",
            );
          }
        } catch (e) {
          console.warn("Erro parse stream pesquisa:", e);
        }
      }
    }

    // Processa metadados
    console.log("DEBUG: Raw Grounding Metadata:", groundingMetadata);

    const chunks =
      groundingMetadata?.groundingChunks ||
      groundingMetadata?.grounding_chunks ||
      [];

    const sources = chunks
      .map((c) => {
        if (!c.web) return null;
        return {
          uri: resolveOriginalSourceUrl(c.web.uri, c.web.title),
          title: c.web.title,
        };
      })
      .filter((w) => w && w.uri);

    return {
      report: reportText,
      sources: sources,
      rawMetadata: groundingMetadata,
    };
  } catch (error) {
    if (
      !navigator.onLine ||
      (error.name === "TypeError" &&
        error.message.includes("Failed to fetch")) ||
      error.message === "NETWORK_ERROR"
    ) {
      throw new Error("NETWORK_ERROR");
    }
    console.error("Erro na pesquisa streaming:", error);
    throw error;
  }
}

/**
 * CLONE de realizarPesquisa para uso geral no roteador.
 * Realiza uma pesquisa via Worker (usando Google Search Grounding)
 * Suporta STREAMING para exibir Thoughts.
 */
export async function realizarPesquisaGeral(
  texto,
  listaImagensBase64 = [],
  handlers = {},
  schema = null,
) {
  handlers?.onStatus?.("Conectando ao sistema de pesquisa profunda...");

  try {
    const response = await fetch(`${WORKER_URL}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: handlers?.signal,
      body: JSON.stringify({
        apiKey:
          typeof sessionStorage !== "undefined"
            ? sessionStorage.getItem("GOOGLE_GENAI_API_KEY")
            : undefined,
        githubApiKey:
          typeof sessionStorage !== "undefined"
            ? (sessionStorage.getItem("GITHUB_PAT_KEY") || sessionStorage.getItem("githubApiKey"))
            : undefined,
        groqApiKey:
          typeof sessionStorage !== "undefined"
            ? sessionStorage.getItem("GROQ_API_KEY")
            : undefined,
        texto,
        listaImagensBase64,
        schema,
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
            reportText += msg.text;
          } else if (msg.type === "grounding") {
            groundingMetadata = msg.metadata;
          } else if (msg.type === "error") {
            throw new Error(msg.message || "Erro no worker de pesquisa");
          } else if (msg.type === "reset") {
            reportText = "";
            if (handlers?.onReset) {
              try {
                handlers.onReset();
              } catch (err) {
                console.error("Error in onReset handler:", err);
              }
            }
            handlers?.onStatus?.(
              "Recitation detectado na pesquisa. Tentando novo modelo...",
            );
          }
        } catch (e) {
          console.warn("Erro parse stream pesquisa:", e);
        }
      }
    }

    const chunks =
      groundingMetadata?.groundingChunks ||
      groundingMetadata?.grounding_chunks ||
      [];
    const sources = chunks
      .map((c) => {
        if (!c.web) return null;
        return {
          uri: resolveOriginalSourceUrl(c.web.uri, c.web.title),
          title: c.web.title,
        };
      })
      .filter((w) => w && w.uri);

    return {
      report: reportText,
      sources: sources,
      rawMetadata: groundingMetadata,
    };
  } catch (error) {
    if (
      !navigator.onLine ||
      (error.name === "TypeError" &&
        error.message.includes("Failed to fetch")) ||
      error.message === "NETWORK_ERROR"
    ) {
      throw new Error("NETWORK_ERROR");
    }
    console.error("Erro na pesquisa profunda:", error);
    throw error;
  }
}

const PROMPT_PESQUISADOR = `Role: Você é um Pesquisador Sênior em Conteúdo Educacional (Vestibulares e Concursos).
Objetivo: Eu tenho uma imagem de uma questão e preciso que você encontre a resolução original dela na internet e escreva um RELATÓRIO TÉCNICO DE RESOLUÇÃO.

REGRAS DE OURO:
1. RESPONDA SEMPRE EM MARKDOWN: Use títulos, listas e negrito para organizar o conhecimento de forma didática.
2. CITAÇÕES DIRETAS E CLARAS: Você OBRIGATORIAMENTE deve usar expressões como "De acordo com o site X", "Segundo o gabarito oficial da Y", "O professor Z explica que..." ao longo do relatório. Isso é vital para a precisão técnica.

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
  textoQuestao = "", // Contexto específico da questão (JSON/Texto) para a pesquisa
  options = {},
) {
  // 1. Etapa de Pesquisa
  handlers?.onStatus?.(
    "🕵️ Analisando imagem e pesquisando resoluções (Step 1/2)...",
  );

  let relatorioPesquisa = "";
  let fontesEncontradas = [];

  // Decide quais imagens usar na pesquisa:
  // Se tiver imagens de pesquisa específicas (limpas), usa elas. Senão, usa as da lista (carimbadas/misturadas).
  const imagensParaBusca =
    imagensPesquisa && imagensPesquisa.length > 0
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
    const searchResult = await realizarPesquisa(
      promptPesquisaComContexto,
      imagensParaBusca,
      {
        onStatus: handlers?.onStatus,
        onThought: handlers?.onThought, // Thoughts do pesquisador!
        signal: handlers?.signal, // CRÍTICO: Passar o signal para abortar o fetch se a rede cair
      },
      null,
      options?.searchModel,
    );

    relatorioPesquisa = searchResult.report;
    fontesEncontradas = searchResult.sources || [];

    console.log("DEBUG: Relatório Pesquisa:", relatorioPesquisa);
    console.log("DEBUG: Fontes Encontradas:", fontesEncontradas);
  } catch (err) {
    console.warn(
      "Falha na etapa de pesquisa (prosseguindo sem contexto extra):",
      err,
    );
    handlers?.onStatus?.(
      "⚠️ Pesquisa falhou, gerando com conhecimento interno...",
    );
  }

  // 2. Etapa de Geração Final
  handlers?.onStatus?.(
    "✍️ Escrevendo gabarito detalhado com base na pesquisa (Step 2/2)...",
  );

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
    handlers,
    {
      model: options?.gabaritoModel,
    }
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

/**
 * Analisa e limpa mensagens de erro brutas do worker (e dos modelos).
 * Decodifica erros aninhados em JSON para extrair a causa raiz.
 * @param {string} errorMessage - Mensagem de erro original
 * @returns {string} Mensagem de erro amigável e limpa
 */
export function formatFriendlyError(errorMessage) {
  if (!errorMessage) return "Erro desconhecido nos modelos.";

  let cleanMsg = errorMessage.trim();
  const prefixes = [
    "Falha no Worker:",
    "WORKER_RUN_FAILED:",
    "Todos falharam:"
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of prefixes) {
      if (cleanMsg.startsWith(prefix)) {
        cleanMsg = cleanMsg.slice(prefix.length).trim();
        changed = true;
      }
    }
  }

  // Helper recursivo para extrair a mensagem de erros JSON aninhados
  const extractFromJson = (obj) => {
    if (!obj || typeof obj !== "object") return null;
    const inner = obj.error || obj;
    if (!inner || typeof inner !== "object") return null;
    
    let msg = inner.message || inner.error || null;
    let status = inner.status || null;
    let code = inner.code || null;

    if (typeof msg === "string") {
      try {
        const nested = JSON.parse(msg);
        const extracted = extractFromJson(nested);
        if (extracted) {
          return {
            message: extracted.message,
            status: extracted.status || status,
            code: extracted.code || code
          };
        }
      } catch (e) {}
    }

    return { message: msg, status, code };
  };

  try {
    const parsed = JSON.parse(cleanMsg);
    const result = extractFromJson(parsed);
    if (result && result.message) {
      let suffix = "";
      if (result.status && result.code) {
        suffix = ` (${result.status} - Código ${result.code})`;
      } else if (result.status) {
        suffix = ` (${result.status})`;
      } else if (result.code) {
        suffix = ` (Código ${result.code})`;
      }
      return `${result.message}${suffix}`;
    }
  } catch (e) {
    // Falhou em parsear como JSON, retorna a mensagem limpa
  }

  return cleanMsg;
}
