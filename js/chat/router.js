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
            name: file.name || "arquivo",
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

  const MAX_RETRIES = 3;
  let attempt = 0;
  let lastError = null;

  while (attempt < MAX_RETRIES) {
    attempt++;
    try {
      if (options.onAttemptStart) {
        try {
          options.onAttemptStart();
        } catch (e) {
          console.error("[Router] Error in onAttemptStart handler:", e);
        }
      }
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
      const githubApiKey =
        options.githubApiKey || sessionStorage.getItem("GITHUB_PAT_KEY") || sessionStorage.getItem("githubApiKey");
      const vertexProjectId =
        options.vertexProjectId || sessionStorage.getItem("VERTEX_PROJECT_ID");
      const vertexLocation =
        options.vertexLocation || sessionStorage.getItem("VERTEX_LOCATION");
      const vertexCredentials =
        options.vertexCredentials || sessionStorage.getItem("VERTEX_CREDENTIALS");

      const specificModel = options.selectedSpecificModel || (typeof window !== "undefined" ? window.selectedSpecificModel : null);
      const finalRouterModel = (specificModel && specificModel !== "automatico") ? specificModel : CHAT_CONFIG.routerModel;

      console.log(
        `[Router] 🎯 Tentativa ${attempt}/${MAX_RETRIES} - Iniciando classificação com modelo:`,
        finalRouterModel,
      );
      console.log(
        "[Router] 📝 Prompt enviado:",
        fullPrompt.substring(0, 200) + "...",
      );

      // Chama /generate com schema para obter JSON
      const response = await fetch(`${WORKER_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: options.signal, // Pass signal to fetch
        body: JSON.stringify({
          apiKey: apiKey || undefined,
          githubApiKey: githubApiKey || undefined,
          vertexProjectId: vertexProjectId || undefined,
          vertexLocation: vertexLocation || undefined,
          vertexCredentials: vertexCredentials || undefined,
          texto: fullPrompt,
          // Schema e Json Mode ATIVADOS
          schema: ROUTER_RESPONSE_SCHEMA,
          model: finalRouterModel,
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
            if (e.message?.startsWith("Worker Error")) throw e;
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
        throw e; // Jogar para o catch principal para tentar novamente ou falhar
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
        metodologia: routerResponse?.metodologia_recomendada || "feynman",
      };

      lastRoutingResult = result;
      console.log("[Router] Classificação concluída com sucesso:", result);
      return result;
    } catch (error) {
      // Propagar cancelamento imediatamente
      if (error.name === "AbortError") throw error;

      console.warn(`[Router] Tentativa ${attempt}/${MAX_RETRIES} falhou:`, error);
      lastError = error;

      if (attempt < MAX_RETRIES) {
        // Aguarda com delay incremental (1s, 2s)
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  // Se esgotou todas as tentativas, trata rede ou propaga falha geral
  if (
    !navigator.onLine ||
    (lastError && lastError.name === "TypeError" && lastError.message.includes("Failed to fetch")) ||
    (lastError && lastError.message === "NETWORK_ERROR")
  ) {
    throw new Error("NETWORK_ERROR");
  }

  console.error("[Router] Erro definitivo na classificação:", lastError);
  throw lastError || new Error("Falha no classificador do roteador.");
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
