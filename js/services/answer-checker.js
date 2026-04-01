/**
 * Answer Checker — Verificação de respostas dissertativas
 *
 * DEFAULT: Pinecone embedding similarity (sem IA generativa)
 * OPTIONAL: AI correction with full JSON context (Gemini 3 Flash)
 */

import { WORKER_URL } from "../api/worker.js";

// ─── DEFAULT: Embedding-Based Correction ─────────────────────

/**
 * Verifica resposta dissertativa usando similaridade de embeddings.
 * Não usa IA generativa — apenas compara vetores.
 *
 * @param {string} userAnswer - Resposta do usuário
 * @param {string} expectedAnswer - Resposta esperada (resposta_modelo do gabarito)
 * @param {Object} questionData - Dados completos da questão (para keywords)
 * @param {string} apiKey - API key para embedding
 * @returns {Promise<{score: number, similarity: number, keywordsFound: string[], keywordsMissing: string[], feedback: string}>}
 */
export async function checkAnswerWithEmbeddings(
  userAnswer,
  expectedAnswer,
  questionData,
  apiKey,
) {
  if (!userAnswer || !expectedAnswer) {
    return {
      score: 0,
      similarity: 0,
      keywordsFound: [],
      keywordsMissing: [],
      feedback: "Impossível corrigir (resposta modelo ou do aluno vazia).",
      method: "error",
    };
  }

  try {
    // 1. Generate embeddings for both answers in parallel
    const [userEmbedding, expectedEmbedding] = await Promise.all([
      generateEmbedding(userAnswer, apiKey),
      generateEmbedding(expectedAnswer, apiKey),
    ]);

    // 2. Calculate cosine similarity
    const similarity = cosineSimilarity(userEmbedding, expectedEmbedding);
    const score = Math.round(similarity * 100);

    // 3. Keyword matching (extract from expected answer + question)
    const keywords = extractKeywords(expectedAnswer, questionData);
    const normalizedUserAnswer = userAnswer
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const keywordsFound = [];
    const keywordsMissing = [];

    for (const kw of keywords) {
      const normalizedKw = kw
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      if (normalizedUserAnswer.includes(normalizedKw)) {
        keywordsFound.push(kw);
      } else {
        keywordsMissing.push(kw);
      }
    }

    // 4. Generate feedback based on score thresholds
    const feedback = generateFeedback(score, keywordsFound, keywordsMissing);

    return {
      score,
      similarity: parseFloat(similarity.toFixed(4)),
      keywordsFound,
      keywordsMissing,
      feedback,
      method: "embeddings",
    };
  } catch (error) {
    console.error("[AnswerChecker] Embedding check error:", error);
    return {
      score: 0,
      similarity: 0,
      keywordsFound: [],
      keywordsMissing: [],
      feedback:
        "Não foi possível verificar sua resposta. Tente novamente ou use a correção com IA.",
      method: "error",
    };
  }
}

// ─── OPTIONAL: AI-Based Correction ───────────────────────────

/**
 * Corrige resposta dissertativa usando IA (Gemini 3 Flash).
 * Recebe o full_json completo da questão para contexto máximo.
 *
 * @param {string} userAnswer - Resposta do usuário
 * @param {Object} fullQuestionJson - JSON completo da questão (com gabarito)
 * @param {string} apiKey - API key
 * @returns {Promise<Object>} Correção detalhada com pontos fortes/fracos
 */
export async function checkAnswerWithAI(userAnswer, fullQuestionJson, apiKey) {
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      score: {
        type: "number",
        minimum: 0,
        maximum: 100,
        description: "Nota de 0 a 100",
      },
      feedback_geral: {
        type: "string",
        description: "Avaliação geral da resposta (2-3 frases)",
      },
      criterios_avaliados: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            criterio: {
              type: "string",
              description: "Ponto/Critério esperado pela questão",
            },
            atendido: {
              type: "boolean",
              description: "Se o estudante atendeu ou não a esse critério",
            },
            feedback: {
              type: "string",
              description: "Pequeno comentário justificando se atendeu ou não",
            }
          },
          required: ["criterio", "atendido", "feedback"],
        },
        description: "Lista de pontos cobrados na resposta modelo e se o estudante cumpriu",
      },
      pontos_fortes: {
        type: "array",
        items: { type: "string" },
        description: "O que o aluno acertou ou abordou bem",
      },
      pontos_fracos: {
        type: "array",
        items: { type: "string" },
        description: "O que ficou faltando ou incorreto",
      },
      sugestoes: {
        type: "array",
        items: { type: "string" },
        description: "Sugestões de melhoria para a resposta",
      },
      comparacao_com_gabarito: {
        type: "string",
        description:
          "Comparação direta entre a resposta do aluno e a resposta modelo",
      },
    },
    required: [
      "score",
      "feedback_geral",
      "criterios_avaliados",
      "pontos_fortes",
      "pontos_fracos",
      "sugestoes",
      "comparacao_com_gabarito",
    ],
  };

  const prompt = `Você é um professor avaliador de questões dissertativas. 

QUESTÃO COMPLETA (com gabarito):
${JSON.stringify(fullQuestionJson, null, 2)}

RESPOSTA DO ALUNO:
"${userAnswer}"

INSTRUÇÕES:
1. Compare a resposta do aluno com a resposta modelo (resposta_modelo) e a explicação do gabarito.
2. Identifique os critérios que a questão cobra e avalie um por um (em 'criterios_avaliados').
3. Seja justo mas educativo — destaque o que o aluno acertou antes de apontar erros.
4. A nota deve refletir proporcionalmente o quanto da resposta modelo foi coberto.

Responda com o JSON estruturado.`;

  try {
    const response = await fetch(`${WORKER_URL}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: apiKey || undefined,
        texto: prompt,
        schema,
        model: "gemini-3-flash-preview",
        jsonMode: true,
        thinking: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
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
          // Ignore parse errors
        }
      }
    }

    const jsonMatch = answerText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      result.method = "ai";
      return result;
    }

    throw new Error("Could not parse AI response");
  } catch (error) {
    console.error("[AnswerChecker] AI correction error:", error);
    return {
      score: 0,
      feedback_geral:
        "Erro na correção com IA. Tente novamente ou use a correção por embeddings.",
      criterios_avaliados: [],
      pontos_fortes: [],
      pontos_fracos: [],
      sugestoes: [],
      comparacao_com_gabarito: "",
      method: "error",
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────

async function generateEmbedding(text, apiKey) {
  const response = await fetch(`${WORKER_URL}/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      texto: text,
      apiKey: apiKey || undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding failed: ${response.status}`);
  }

  const data = await response.json();
  return data.embedding;
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

function extractKeywords(expectedAnswer, questionData) {
  const keywords = new Set();

  // From question's palavras_chave
  const questionKeywords = questionData?.dados_questao?.palavras_chave || [];
  questionKeywords.forEach((kw) => keywords.add(kw));

  if (expectedAnswer) {
    // Extract meaningful terms: normalize, drop short words (covers most PT stopwords), rank by frequency
    const terms = expectedAnswer
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/\s+/)
      .map((w) => w.replace(/[^\w]/g, ""))
      .filter((w) => w.length > 4);

    const freq = {};
    for (const t of terms) freq[t] = (freq[t] || 0) + 1;

    Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([word]) => keywords.add(word));
  }

  return [...keywords];
}

function generateFeedback(score, keywordsFound, keywordsMissing) {
  if (score >= 85) {
    return `Excelente! Sua resposta demonstra boa compreensão do tema. ${keywordsFound.length > 0 ? `Você abordou corretamente: ${keywordsFound.slice(0, 5).join(", ")}.` : ""}`;
  } else if (score >= 65) {
    let msg = `Boa resposta, mas há espaço para melhoria.`;
    if (keywordsFound.length > 0) {
      msg += ` Pontos abordados: ${keywordsFound.slice(0, 3).join(", ")}.`;
    }
    if (keywordsMissing.length > 0) {
      msg += ` Conceitos que poderiam ser incluídos: ${keywordsMissing.slice(0, 3).join(", ")}.`;
    }
    return msg;
  } else if (score >= 40) {
    let msg = `Resposta parcial. Alguns conceitos-chave estão ausentes.`;
    if (keywordsMissing.length > 0) {
      msg += ` Faltaram: ${keywordsMissing.slice(0, 5).join(", ")}.`;
    }
    return msg;
  } else {
    return `Sua resposta precisa de mais desenvolvimento. Revise os conceitos principais: ${keywordsMissing.slice(0, 5).join(", ") || "verifique o gabarito"}.`;
  }
}
