// --- CONFIGURAÇÃO DO WORKER ---
// Para local: http://localhost:8787
// Para prod: Sua URL do Cloudflare (ex: https://meu-worker.seu-usuario.workers.dev)
export const WORKER_URL = import.meta.env.VITE_WORKER_URL || "http://localhost:8787";
console.log(
  "DEBUG ENV:",
  import.meta.env.VITE_WORKER_URL,
  "FINAL URL:",
  WORKER_URL
);

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
          if (msg.type === "thought") {
            handlers?.onThought?.(msg.text);
          } else if (msg.type === "answer") {
            handlers?.onAnswerDelta?.(msg.text);
            answerText += msg.text;
          } else if (msg.type === "debug") {
            console.log("🛠️ WORKER DEBUG:", msg.text);
          } else if (msg.type === "error") {
            console.error("Erro do worker stream:", msg.text);
            handlers?.onStatus?.(`Erro: ${msg.text}`);
          } else if (msg.type === "status") {
            handlers?.onStatus?.(msg.text);
          }
        } catch (e) {
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

    // Parse final JSON
    const textoLimpo = answerText.replace(/``````/g, "").trim();
    return JSON.parse(textoLimpo);
  } catch (error) {
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
