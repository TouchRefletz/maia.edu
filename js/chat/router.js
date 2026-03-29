/**
 * Router - Sistema de Roteamento de Complexidade
 * Usa gemma-3-27b via /generate para classificar a tarefa
 */

import { jsonrepair } from "jsonrepair";
import { WORKER_URL } from "../api/worker.js";
import { fileToBase64 } from "../utils/file-utils.js";
import { CHAT_CONFIG, complexityToMode, getModeConfig } from "./config.js";
import {
  ROUTER_RESPONSE_SCHEMA,
  ROUTER_SYSTEM_PROMPT,
  buildRouterPrompt,
} from "./prompts/router-prompt.js";

let lastRoutingResult = null;

/**
 * Classifica a complexidade de uma mensagem usando o router
 */
export async function routeMessage(
  message,
  attachments = [],
  memoryContext = "",
  options = {},
) {
  const hasAttachments = attachments && attachments.length > 0;

  // Processa anexos para base64 se houver
  let processedFiles = [];
  if (hasAttachments) {
    try {
      processedFiles = await Promise.all(
        attachments.map(async (file) => {
          const base64 = await fileToBase64(file);
          return {
            data: base64,
            mimeType: file.type || "application/octet-stream",
          };
        }),
      );
    } catch (err) {
      console.warn("[Router] Erro ao processar anexos:", err);
    }
  }

  // Comentado para permitir que o router analise a imagem
  /*
  const hasComplexAttachments =
    hasAttachments &&
    attachments.some(
      (file) =>
        file.type.startsWith("image/") || file.type === "application/pdf",
    );

  if (hasComplexAttachments) {
    const result = {
      mode: "raciocinio",
      complexity: "ALTA",
      reason: "Anexo de imagem ou PDF detectado",
      confidence: 1.0,
    };
    lastRoutingResult = result;
    return result;
  }
  */

  try {
    // Extrai previousQueries das options se existir
    const previousQueries = options.previousQueries || [];

    const routerPrompt = buildRouterPrompt(
      message,
      hasAttachments,
      memoryContext,
      previousQueries,
    );
    const fullPrompt = `${ROUTER_SYSTEM_PROMPT}\n\n---\n\n${routerPrompt}`;

    const apiKey =
      options.apiKey || sessionStorage.getItem("GOOGLE_GENAI_API_KEY");

    console.log(
      "[Router] 🎯 Iniciando classificação com modelo:",
      CHAT_CONFIG.routerModel,
    );
    console.log(
      "[Router] 📝 Prompt enviado:",
      fullPrompt.substring(0, 200) + "...",
    );

    console.log(CHAT_CONFIG.routerModel);

    // Chama /generate com schema para obter JSON
    const response = await fetch(`${WORKER_URL}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: options.signal, // Pass signal to fetch
      body: JSON.stringify({
        apiKey: apiKey || undefined,
        texto: fullPrompt,
        // Schema e Json Mode ATIVADOS para Gemini Flash
        schema: ROUTER_RESPONSE_SCHEMA,
        model: CHAT_CONFIG.routerModel,
        jsonMode: true,
        thinking: true, // Aqui o router foi ajustado para emitir pensamentos
        files: processedFiles.length > 0 ? processedFiles : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP ${response.status}`);
    }

    // Processa stream para obter JSON
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let answerText = "";
    let rawAccumulator = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      // Accumulate raw for debug/fallback
      rawAccumulator += chunk;

      let parts = buffer.split("\n");
      buffer = parts.pop() || "";

      for (const line of parts) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);

          if (msg.type === "thought" && options.onThought) {
            options.onThought(msg.text);
          } else if (msg.type === "answer") {
            answerText += msg.text;
          } else if (msg.type === "error") {
            // Se o worker reportar erro explícito, lançamos aqui
            throw new Error(`Worker Error: ${msg.text || "Unknown"}`);
          }
        } catch (e) {
          // Ignore parsing errors for individual lines (keep stream alive)
        }
      }
    }

    let routerResponse;
    try {
      let textToParse = answerText;

      // Se não recebemos chunks do tipo "answer", tentamos usar a resposta bruta
      if (!textToParse || !textToParse.trim()) {
        console.warn(
          "[Router] Sem chunks 'answer', tentando parsear resposta bruta...",
        );
        textToParse = rawAccumulator;
      }

      if (!textToParse || !textToParse.trim()) {
        throw new Error(
          "Resposta vazia do router (nem chunks 'answer' nem JSON bruto validos)",
        );
      }

      // Parse do JSON final acumulado
      try {
        // Tenta extrair JSON de blocos de markdown ou texto sujo
        const jsonMatch = textToParse.match(/\{[\s\S]*\}/);
        const cleanJson = jsonMatch ? jsonMatch[0] : textToParse;

        routerResponse = JSON.parse(cleanJson);
      } catch (e) {
        // Fallback robusto com jsonrepair
        try {
          console.log(
            "[Router] Falha no parse direto. Tentando reparar com jsonrepair...",
          );
          routerResponse = JSON.parse(jsonrepair(textToParse));
        } catch (repairError) {
          console.warn("[Router] Falha grave ao reparar JSON:", repairError);
          throw e;
        }
      }
    } catch (e) {
      console.warn("[Router] Falha ao processar resposta JSON:", e);
      throw e; // Jogar para o catch principal para fallback seguro
    }

    console.log("[Router] 📨 Resposta do modelo:", routerResponse);

    // FIX: Default seguro = BAIXA (Pedidio do usuário: não ir pra raciocínio erradamente)
    const complexity = routerResponse?.complexidade || "BAIXA";
    let mode = complexityToMode(complexity);

    if (routerResponse?.scaffolding_detected) {
      mode = "scaffolding";
    }

    const result = {
      mode,
      complexity,
      reason: routerResponse?.motivo || "Classificação automática",
      confidence: routerResponse?.confianca || 0.5,
      busca_questao: routerResponse?.busca_questao || null,
      scaffolding: routerResponse?.scaffolding_detected || false,
    };

    lastRoutingResult = result;
    console.log("[Router] Classificação:", result);
    return result;
  } catch (error) {
    // [FIX] Propagar cancelamento para o pipeline parar
    if (error.name === "AbortError") throw error;

    if (!navigator.onLine || (error.name === "TypeError" && error.message.includes("Failed to fetch")) || error.message === "NETWORK_ERROR") {
      throw new Error("NETWORK_ERROR");
    }

    console.error("[Router] Erro na classificação:", error);

    // Fallback: usar RÁPIDO em caso de erro (pedido do usuário)
    const result = {
      mode: "rapido",
      complexity: "BAIXA",
      reason: "Fallback por erro no router",
      confidence: 0,
    };
    lastRoutingResult = result;
    return result;
  }
}

export function getLastRoutingResult() {
  return lastRoutingResult;
}

export function clearRoutingCache() {
  lastRoutingResult = null;
}

/**
 * Determina o modo final baseado na seleção do usuário
 */
export async function determineFinalMode(
  selectedMode,
  message,
  attachments = [],
  memoryContext = "",
  options = {},
) {
  const modeConfig = getModeConfig(selectedMode);

  // Se o modo não usa router, retorna direto
  if (!modeConfig.usesRouter) {
    return {
      finalMode: selectedMode,
      wasRouted: false,
    };
  }

  // Modo automático: usa o router
  const routerResult = await routeMessage(
    message,
    attachments,
    memoryContext,
    options,
  );

  return {
    finalMode: routerResult.mode,
    wasRouted: true,
    routerResult,
  };
}
