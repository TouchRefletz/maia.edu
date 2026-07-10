import { gerarConteudoEmJSONComImagemStream } from "../api/worker.js";
import {
  getJudgeSystemPrompt,
  getJudgeResponseSchema,
  buildJudgePrompt,
} from "./prompts/judge-prompt.js";

/**
 * Substitui menções a modelos específicos por um marcador genérico para garantir anonimização cega.
 * @param {string} texto - O texto original
 * @returns {string} Texto anonimizado
 */
export function anonimizarModelos(texto) {
  if (typeof texto !== "string") return texto;
  return texto
    .replace(/gemma[- ]*4(?:[- ]*31b(?:[- ]*it)?)?/gi, "[MODELO_ANONIMIZADO]")
    .replace(/gemini[- ]*3\.5(?:[- ]*flash)?/gi, "[MODELO_ANONIMIZADO]")
    .replace(/gpt[- ]*oss(?:[- ]*120b)?/gi, "[MODELO_ANONIMIZADO]")
    .replace(/\bgemma\b/gi, "[MODELO_ANONIMIZADO]")
    .replace(/\bgemini\b/gi, "[MODELO_ANONIMIZADO]")
    .replace(/\bgpt\b/gi, "[MODELO_ANONIMIZADO]");
}

/**
 * Executa a avaliação cruzada do Apêndice A usando o modelo juiz especificado
 * @param {string} modelJudgeId - ID do modelo juiz (ex: "models/gemini-3.5-flash")
 * @param {string} enunciado - O enunciado da questão
 * @param {string} gabarito - O gabarito oficial / de referência
 * @param {string} respostaIA - A resposta que está sendo avaliada
 * @param {boolean} isInterdisciplinary - Se é interdisciplinar (FUVEST)
 * @param {Object} handlers - { onThought, onAnswerDelta, onStatus }
 * @param {AbortSignal} [signal] - Sinal opcional
 * @returns {Promise<Object>} Resposta e metadados da avaliação
 */
export async function executarAvaliacaoApendiceA(
  modelJudgeId,
  enunciado,
  gabarito,
  respostaIA,
  isInterdisciplinary,
  handlers = {},
  signal = null
) {
  // Anonimiza a resposta da IA avaliada antes de enviar ao juiz para evitar viés de preferência
  const respostaAnonimizada = anonimizarModelos(respostaIA);
  const enunciadoAnonimizado = anonimizarModelos(enunciado);
  const gabaritoAnonimizado = anonimizarModelos(gabarito);

  const promptOriginal = buildJudgePrompt(enunciadoAnonimizado, gabaritoAnonimizado, respostaAnonimizada, isInterdisciplinary);

  let thoughtsAccumulated = "";
  let rawResponseAccumulated = "";

  const systemInstruction = getJudgeSystemPrompt(isInterdisciplinary);
  const responseSchema = getJudgeResponseSchema(isInterdisciplinary);

  const options = {
    model: modelJudgeId,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    },
    systemInstruction: systemInstruction,
  };

  let startTime = performance.now();

  const localHandlers = {
    onStatus: handlers.onStatus,
    onThought: (thought) => {
      thoughtsAccumulated += thought;
      if (handlers.onThought) handlers.onThought(thought);
    },
    onAnswerDelta: (delta) => {
      rawResponseAccumulated += delta;
      if (handlers.onAnswerDelta) handlers.onAnswerDelta(delta);
    },
    onAttemptStart: () => {
      startTime = performance.now();
    },
    signal,
  };

  try {
    const finalResult = await gerarConteudoEmJSONComImagemStream(
      promptOriginal,
      responseSchema,
      [], // Sem imagens anexadas na avaliação do juiz
      "image/jpeg",
      localHandlers,
      options,
    );

    const endTime = performance.now();
    const latencyMs = Math.round(endTime - startTime);

    return {
      model: modelJudgeId,
      prompt_original: promptOriginal,
      prompt_compiled: `${systemInstruction}\n\n---\n\n=== PROMPT DO USUÁRIO (PRIORIDADE MÁXIMA) ===\nUsuário: ${promptOriginal}\n=== FIM DO PROMPT ===`,
      response_text: typeof finalResult === "string" ? finalResult : JSON.stringify(finalResult, null, 2),
      thoughts: thoughtsAccumulated,
      latency_ms: latencyMs,
    };
  } catch (error) {
    console.error("[Apêndice A] Erro na execução da avaliação:", error);
    throw error;
  }
}
