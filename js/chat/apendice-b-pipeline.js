import { gerarConteudoEmJSONComImagemStream } from "../api/worker.js";
import {
  TRIAGEM_SYSTEM_PROMPT,
  TRIAGEM_RESPONSE_SCHEMA,
  buildTriagemPrompt,
} from "./prompts/triagem-prompt.js";

// Helper para converter URL da imagem em objeto Base64
async function fetchImageAsBase64(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(",")[1];
        resolve({
          data: base64,
          mimeType: blob.type || "image/jpeg",
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn("[Apêndice B] Erro ao carregar/converter imagem:", url, error);
    return null;
  }
}

function normalizarArrayImagens(obj) {
  if (!obj) return [];
  if (obj.fotos_originais && Array.isArray(obj.fotos_originais)) {
    return obj.fotos_originais;
  } else if (obj.foto_original) {
    return [obj.foto_original];
  } else if (obj.scan_original) {
    return [obj.scan_original];
  }
  return [];
}

/**
 * Executa o classificador heurístico de complexidade do Apêndice B usando Gemma 4 31B IT
 * @param {Object} questaoObj - O objeto da questão contendo { id, prova, fullData }
 * @param {Object} handlers - { onThought, onAnswerDelta, onStatus }
 * @param {AbortSignal} [signal] - Sinal opcional de abortar requisição
 * @returns {Promise<Object>} Resultado completo do experimento
 */
export async function executarTriageApendiceB(questaoObj, handlers = {}, signal = null) {
  const { id, prova, fullData } = questaoObj;
  const q = fullData.dados_questao || {};
  const g = fullData.dados_gabarito || {};

  // 1. Constrói o texto do enunciado e gabarito para o prompt
  const enunciadoTexto = q.estrutura
    ? q.estrutura.map((b) => b.conteudo || "").join(" ")
    : q.enunciado || "";
  const gabaritoTexto = g.explicacao
    ? g.explicacao
        .flatMap((b) => (b.estrutura ? b.estrutura.map((i) => i.conteudo) : []))
        .join(" ")
    : g.justificativa_curta || "";
  const correctOption = g.alternativa_correta ? `Alternativa Correta: ${g.alternativa_correta}` : "";
  const fullGabaritoRef = `${correctOption}\n${gabaritoTexto}`;

  const promptOriginal = buildTriagemPrompt(enunciadoTexto, fullGabaritoRef);

  // 2. Resolve e carrega as imagens da questão e gabarito em base64
  if (handlers.onStatus) handlers.onStatus("Baixando imagens da questão e do gabarito...");
  const qImgs = normalizarArrayImagens(q);
  const gImgs = normalizarArrayImagens(g);
  const allImgs = [...new Set([...qImgs, ...gImgs])];

  const attachments = [];
  for (const url of allImgs) {
    const base64Obj = await fetchImageAsBase64(url);
    if (base64Obj) {
      attachments.push(base64Obj);
    }
  }

  // 3. Executa a chamada streamed
  if (handlers.onStatus) handlers.onStatus("Conectando ao modelo Gemma 4 31B IT...");

  let thoughtsAccumulated = "";
  let rawResponseAccumulated = "";

  const options = {
    model: "models/gemma-4-31b-it", // Gemma 4 travado para o experimento
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: TRIAGEM_RESPONSE_SCHEMA,
    },
    systemInstruction: TRIAGEM_SYSTEM_PROMPT,
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
      TRIAGEM_RESPONSE_SCHEMA,
      attachments,
      "image/jpeg",
      localHandlers,
      options,
    );

    const endTime = performance.now();
    const latencySec = parseFloat(((endTime - startTime) / 1000).toFixed(3));

    // O finalResult retornado pelo worker já é o objeto JSON parseado
    return {
      question_id: id,
      prova: prova,
      timestamp: new Date().toISOString(),
      model: "models/gemma-4-31b-it",
      prompt_original: promptOriginal,
      response_text: finalResult,
      thoughts: thoughtsAccumulated,
      latency_sec: latencySec,
    };
  } catch (error) {
    console.error("[Apêndice B] Erro na execução do pipeline:", error);
    throw error;
  }
}
