import { gerarConteudoEmJSONComImagemStream } from "../api/worker.js";
import {
  getJudgeSystemPrompt,
  getJudgeResponseSchema,
  buildJudgePrompt,
  processarAvaliacaoJuiz,
  getJudgeSystemPromptForPart,
  getJudgeResponseSchemaForPart,
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

    let processedResponseText = "";
    let processedResult = null;
    try {
      const parsedResult = typeof finalResult === "string" ? JSON.parse(finalResult) : finalResult;
      processedResult = processarAvaliacaoJuiz(parsedResult, isInterdisciplinary);
      processedResponseText = typeof finalResult === "string" ? finalResult : JSON.stringify(finalResult, null, 2);
    } catch (e) {
      console.warn("[Apêndice A] Falha ao pós-processar e calcular nota blinded:", e);
      processedResponseText = typeof finalResult === "string" ? finalResult : JSON.stringify(finalResult, null, 2);
    }

    return {
      model: modelJudgeId,
      prompt_original: promptOriginal,
      prompt_compiled: `${systemInstruction}\n\n---\n\n=== PROMPT DO USUÁRIO (PRIORIDADE MÁXIMA) ===\nUsuário: ${promptOriginal}\n=== FIM DO PROMPT ===`,
      response_text: processedResponseText,
      avaliacao_juiz: processedResult,
      thoughts: thoughtsAccumulated,
      latency_ms: latencyMs,
    };
  } catch (error) {
    console.error("[Apêndice A] Erro na execução da avaliação:", error);
    throw error;
  }
}

/**
 * Executa a avaliação em 4 partes síncronas/sequenciais para o Gemma.
 * Em caso de falha em uma parte, invoca onPartFailure para decidir entre retry ou skip.
 */
export async function executarAvaliacaoGemmaEmPartes(
  modelJudgeId,
  enunciado,
  gabarito,
  respostaIA,
  isInterdisciplinary,
  handlers = {},
  onPartAction,
  stepConfigs = null
) {
  const respostaAnonimizada = anonimizarModelos(respostaIA);
  const enunciadoAnonimizado = anonimizarModelos(enunciado);
  const gabaritoAnonimizado = anonimizarModelos(gabarito);
  const promptOriginal = buildJudgePrompt(enunciadoAnonimizado, gabaritoAnonimizado, respostaAnonimizada, isInterdisciplinary);

  const accumulatedCriterios = {};
  const accumulatedComments = [];
  const partDetails = [];

  let totalLatency = 0;
  let accumulatedThoughts = "";

  for (let part = 1; part <= 4; part++) {
    let partDone = false;
    while (!partDone) {
      const stepConfig = stepConfigs ? stepConfigs[part - 1] : null;
      const stepModel = stepConfig ? stepConfig.model : modelJudgeId;
      const stepThinking = stepConfig ? stepConfig.thinking : true;
      const stepModelLabel = stepModel === "vertex-maas/gpt-oss-120b" ? "GPT-OSS-120B (Vertex)" :
                             stepModel === "groq/gpt-oss-120b" ? "GPT-OSS-120B (Groq)" : stepModel;
      const thinkingLabel = (stepModel === "vertex-maas/gpt-oss-120b") ? (stepThinking ? " [com pensamento]" : " [sem pensamento]") : "";

      if (handlers.onStatus) handlers.onStatus(`Executando Parte ${part} de 4 com ${stepModelLabel}${thinkingLabel}...`);
      if (handlers.onThought) handlers.onThought(`\n\n=== [PARTE ${part} DE 4] ===\n`);
      if (handlers.onAnswerDelta) handlers.onAnswerDelta(`\n\n=== [PARTE ${part} DE 4] ===\n`);

      const systemInstruction = getJudgeSystemPromptForPart(part, isInterdisciplinary);
      const responseSchema = getJudgeResponseSchemaForPart(part, isInterdisciplinary);

      const options = {
        model: stepModel,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        },
        systemInstruction: systemInstruction,
        thinking: stepThinking,
      };

      const startTime = performance.now();
      
      let partThoughts = "";
      let partRawResponse = "";
      
      const localHandlers = {
        onStatus: handlers.onStatus,
        onThought: (thought) => {
          partThoughts += thought;
          accumulatedThoughts += thought;
          if (handlers.onThought) handlers.onThought(thought);
        },
        onAnswerDelta: (delta) => {
          partRawResponse += delta;
          if (handlers.onAnswerDelta) handlers.onAnswerDelta(delta);
        },
        onAttemptStart: () => {},
        signal: handlers.signal,
      };

      try {
        const finalResult = await gerarConteudoEmJSONComImagemStream(
          promptOriginal,
          responseSchema,
          [], // Sem imagens
          "image/jpeg",
          localHandlers,
          options
        );
        const endTime = performance.now();
        const latency = Math.round(endTime - startTime);

        const parsed = typeof finalResult === "string" ? JSON.parse(finalResult) : finalResult;
        
        if (handlers.onStatus) handlers.onStatus(`Parte ${part} concluída. Aguardando confirmação...`);
        const action = await onPartAction(part, "success", null, parsed, latency, systemInstruction, promptOriginal);
        
        if (action === "cancel") {
          throw new Error("USER_CANCELLED");
        }
        
        if (action === "next") {
          if (parsed && parsed.criterios) {
            Object.assign(accumulatedCriterios, parsed.criterios);
          }
          if (parsed && parsed.comentario_geral) {
            accumulatedComments.push(`Parte ${part}: ${parsed.comentario_geral}`);
          }

          partDetails.push({
            part,
            model: stepModel,
            latency_ms: latency,
            response_text: finalResult,
            thoughts: partThoughts,
            prompt_original: promptOriginal,
            prompt_compiled: `${systemInstruction}\n\n---\n\nUsuário: ${promptOriginal}`,
            avaliacao_juiz: parsed
          });

          totalLatency += latency;
          partDone = true;
        }
      } catch (err) {
        if (handlers.isExited?.() || (err.name === "AbortError" && !handlers.signal)) {
          throw err;
        }
        console.error(`Erro na parte ${part}:`, err);
        const displayErrorMsg = err.name === "AbortError" || handlers.signal?.aborted ? "Interrompido pelo usuário" : (err.message || "Erro desconhecido");
        if (handlers.onStatus) handlers.onStatus(`Erro na parte ${part}: ${displayErrorMsg}`);
        const action = await onPartAction(part, "error", displayErrorMsg, null, 0, systemInstruction, promptOriginal);
        
        if (action === "cancel") {
          throw new Error("USER_CANCELLED");
        }
        
        if (action === "next") {
          const schema = getJudgeResponseSchemaForPart(part, isInterdisciplinary);
          const criteriaKeys = Object.keys(schema.properties.criterios.properties);
          for (const key of criteriaKeys) {
            accumulatedCriterios[key] = { presente: false, evidencia: "Pulado pelo usuário devido a erro na geração." };
          }
          accumulatedComments.push(`Parte ${part}: Pulado pelo usuário devido a erro.`);
          
          const defaultResult = {
            criterios: {},
            comentario_geral: "Erro de geração"
          };
          for (const key of criteriaKeys) {
            defaultResult.criterios[key] = { presente: false, evidencia: "Erro" };
          }

          partDetails.push({
            part,
            model: stepModel,
            latency_ms: 0,
            response_text: JSON.stringify({ error: err.message }),
            thoughts: partThoughts,
            prompt_original: promptOriginal,
            prompt_compiled: `${systemInstruction}\n\n---\n\nUsuário: ${promptOriginal}`,
            avaliacao_juiz: defaultResult
          });

          partDone = true;
        }
      }
    }
  }

  const compiledResult = {
    criterios: accumulatedCriterios,
    comentario_geral: accumulatedComments.join("\n\n"),
  };

  const processedResult = processarAvaliacaoJuiz(compiledResult, isInterdisciplinary);

  return {
    model: modelJudgeId,
    prompt_original: promptOriginal,
    prompt_compiled: `Avaliação dividida em 4 partes síncronas.`,
    response_text: JSON.stringify(compiledResult, null, 2),
    avaliacao_juiz: processedResult,
    thoughts: accumulatedThoughts,
    latency_ms: totalLatency,
    gemma_part_details: partDetails,
    part_details: partDetails,
  };
}
