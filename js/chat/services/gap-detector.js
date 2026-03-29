/**
 * Gap Detector — Detecção de lacunas no banco de questões
 *
 * 1. checkQuestionRelevance: Usa Gemini 3 Flash para analisar se o resultado
 *    do Pinecone é realmente relevante para a busca do usuário.
 * 2. triggerQuestionExtraction: Dispara workflow de extração via Worker
 *    e notifica o usuário no chat.
 */

import { WORKER_URL } from "../../api/worker.js";

// --- SCHEMA PARA RELEVANCE CHECK ---

const RELEVANCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    relevant: {
      type: "boolean",
      description:
        "true se o resultado encontrado é genuinamente relevante para a busca do usuário.",
    },
    reason: {
      type: "string",
      description:
        "Justificativa curta (1-2 frases) de por que é ou não relevante.",
    },
    needs_more: {
      type: "boolean",
      description:
        "true se existem questões sobre o tema mas são poucas ou insuficientes para uma prática completa.",
    },
  },
  required: ["relevant", "reason", "needs_more"],
};

// --- RELEVANCE CHECK ---

/**
 * Analisa se o resultado do Pinecone é relevante para a busca do usuário.
 * Usa Gemini 3 Flash com schema para decisão estruturada.
 *
 * @param {string} query - O que o usuário buscou (ex: "Óptica FUVEST")
 * @param {Object} questionData - Resultado do findBestQuestion
 * @param {string} apiKey - Chave Gemini
 * @param {AbortSignal} signal - Sinal de cancelamento
 * @returns {Promise<{relevant: boolean, reason: string, needs_more: boolean}>}
 */
export async function checkQuestionRelevance(
  query,
  questionData,
  apiKey,
  signal,
) {
  try {
    // Extrai informações relevantes do resultado para análise
    const preview =
      questionData.fullData?.metadata?.texto_preview ||
      questionData.preview ||
      JSON.stringify(questionData.fullData).substring(0, 500);

    const institution =
      questionData.fullData?.metadata?.institution ||
      questionData.institution ||
      "Desconhecida";

    const year =
      questionData.fullData?.metadata?.year || questionData.year || "?";

    const score = questionData.score || 0;

    const prompt = `Você é um analisador de relevância de questões educacionais.

O USUÁRIO buscou: "${query}"

O MELHOR RESULTADO encontrado no banco de dados foi:
- Preview: "${preview.substring(0, 400)}"
- Instituição: ${institution}
- Ano: ${year}
- Score de similaridade: ${(score * 100).toFixed(1)}%

ANALISE:
1. O resultado é GENUINAMENTE relevante para o que o usuário buscou? (Um resultado sobre "Termodinâmica" NÃO é relevante se o user pediu "Óptica")
2. Mesmo se relevante, o banco precisa de MAIS questões sobre esse tema? (Se só tem 1 questão sobre um tema amplo como "Funções", precisa de mais)

Responda com o JSON estruturado.`;

    const response = await fetch(`${WORKER_URL}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        apiKey: apiKey || undefined,
        texto: prompt,
        schema: RELEVANCE_SCHEMA,
        model: "gemini-3-flash-preview",
        jsonMode: true,
        thinking: false, // Rápido, sem thinking
      }),
    });

    if (!response.ok) {
      console.warn(
        `[GapDetector] Relevance check HTTP error: ${response.status}`,
      );
      // Fallback: assume relevant (don't trigger extraction on error)
      return {
        relevant: true,
        reason: "Fallback por erro HTTP",
        needs_more: false,
      };
    }

    // Process streamed response
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let answerText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      let parts = buffer.split("\n");
      buffer = parts.pop() || "";

      for (const line of parts) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.type === "answer") {
            answerText += msg.text;
          }
        } catch {
          // Ignore parse errors on individual lines
        }
      }
    }

    // Parse final JSON
    const jsonMatch = answerText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      console.log("[GapDetector] Relevance check:", result);
      return {
        relevant: result.relevant ?? true,
        reason: result.reason || "",
        needs_more: result.needs_more ?? false,
      };
    }

    // Fallback
    console.warn("[GapDetector] Could not parse relevance response");
    return {
      relevant: true,
      reason: "Fallback: parse failed",
      needs_more: false,
    };
  } catch (error) {
    if (error.name === "AbortError") throw error;

    if (!navigator.onLine || (error.name === "TypeError" && error.message.includes("Failed to fetch")) || error.message === "NETWORK_ERROR") {
      throw new Error("NETWORK_ERROR");
    }

    console.warn("[GapDetector] Relevance check error:", error);
    return { relevant: true, reason: "Fallback por erro", needs_more: false };
  }
}

// --- TRIGGER EXTRACTION ---

/**
 * Dispara o workflow de extração de questões via Worker e notifica o chat.
 *
 * @param {Object} buscaQuestao - { tipo, conteudo, props } do router
 * @param {Object} context - Contexto do pipeline (onProcessingStatus, chatId, etc.)
 */
export async function triggerQuestionExtraction(buscaQuestao, context) {
  try {
    console.log(
      "[GapDetector] 🔍 Triggering question extraction for:",
      buscaQuestao.conteudo,
    );

    // 1. Notify chat UI
    if (context.onProcessingStatus) {
      context.onProcessingStatus("extraction_triggered", {
        title: "Extração de questões solicitada",
        message:
          "🔍 Nossa IA identificou lacunas no banco de dados relacionado ao tema solicitado. " +
          "Foi solicitada a extração de novas questões — elas estarão disponíveis em alguns minutos.",
        query: buscaQuestao.conteudo,
        props: buscaQuestao.props,
      });
    }

    // 2. Persist notification in chat history
    if (context.chatId) {
      const { ChatStorageService } =
        await import("../../services/chat-storage.js");
      ChatStorageService.addMessage(context.chatId, "system", {
        type: "extraction_triggered",
        message:
          "🔍 Nossa IA identificou lacunas no banco de dados relacionado ao tema solicitado. " +
          "Foi solicitada a extração de novas questões — elas estarão disponíveis em alguns minutos.",
        query: buscaQuestao.conteudo,
        props: buscaQuestao.props,
        timestamp: new Date().toISOString(),
      }).catch((err) =>
        console.warn("[GapDetector] Failed to persist notification:", err),
      );
    }

    // 3. Call Worker to trigger extraction workflow
    const response = await fetch(`${WORKER_URL}/trigger-extraction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: buscaQuestao.conteudo,
        institution: buscaQuestao.props?.institution,
        subject: buscaQuestao.props?.subject,
        year: buscaQuestao.props?.year,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[GapDetector] Extraction trigger failed:", errText);
      return;
    }

    const result = await response.json();
    console.log("[GapDetector] ✅ Extraction triggered:", result);
  } catch (error) {
    // Don't propagate — extraction is async, don't break the chat
    console.error("[GapDetector] Error triggering extraction:", error);
  }
}
