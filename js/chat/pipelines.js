import {
  gerarConteudoEmJSONComImagemStream,
  realizarPesquisaGeral,
} from "../api/worker.js";
import * as MemoryService from "../services/memory-service.js"; // Import MemoryService
import { findBestQuestion } from "../services/question-service.js"; // Import question service
import { fileToBase64 } from "../utils/file-utils.js";
import { parseStreamedJSON } from "../utils/json-stream-parser.js";
import { getGenerationParams, getModeConfig } from "./config.js";
import { getMetodologia } from "./metodologias-config.js";
import {
  getSystemPromptRaciocinio,
  getSystemPromptRapido,
  getSystemPromptScaffolding,
} from "./prompts/chat-system-prompt.js";
import { determineFinalMode } from "./router.js";
import { CHAT_RESPONSE_SCHEMA, SCAFFOLDING_STEP_SCHEMA } from "./schemas.js"; // Import schema
import { ScaffoldingService } from "./services/scaffolding-service.js"; // Import ScaffoldingService
import {
  checkQuestionRelevance,
  triggerQuestionExtraction,
} from "./services/gap-detector.js"; // Import Gap Detector
import { ChatStorageService } from "../services/chat-storage.js"; // Import Persistence Service
import { validateStudyContext } from "./services/guardrail-service.js"; // Import Guardrail Semântico


/**
 * NORMALIZAÇÃO (STAGE 3 / TRANSFORMER)
 * Transforma a estrutura altamente estável do Gemini (nested objects)
 * de volta para a estrutura que o frontend espera (flat objects/props).
 */
function normalizarBlocos(blocos) {
  if (!Array.isArray(blocos)) return blocos;

  return blocos.flatMap((b) => {
    // 0. Auto-Splitter de LaTeX: Corrige quando a IA esquece de usar o bloco 'equacao'
    if (
      ["texto", "lista", "destaque", "citacao"].includes(b.tipo) &&
      typeof b.conteudo === "string"
    ) {
      const regex = /(\\\[[\s\S]*?\\\]|\\\(.*?\\\)|(?:\$\$[\s\S]*?\$\$))/g;
      if (regex.test(b.conteudo)) {
        const parts = b.conteudo.split(regex);
        return parts
          .map((part) => {
            if (!part) return null;
            if (part.startsWith("\\[") && part.endsWith("\\]")) {
              return { tipo: "equacao", conteudo: part.slice(2, -2).trim() };
            } else if (part.startsWith("\\(") && part.endsWith("\\)")) {
              return { tipo: "equacao", conteudo: part.slice(2, -2).trim() };
            } else if (part.startsWith("$$") && part.endsWith("$$")) {
              return { tipo: "equacao", conteudo: part.slice(2, -2).trim() };
            }
            return { ...b, conteudo: part }; // Mantém o tipo original para partes de texto
          })
          .filter(Boolean);
      }
    }

    // 1. Scaffolding: Move scaffolding_data para o root
    if (b.tipo === "scaffolding" && b.scaffolding_data) {
      const { scaffolding_data, ...resto } = b;
      return [{ ...resto, ...scaffolding_data }];
    }
    // 2. Slides: Renomeia slide_data para content e normaliza recursivamente
    if (b.tipo === "block_slide" && b.slide_data) {
      const { slide_data, ...resto } = b;
      return [{ ...resto, content: normalizarBlocos(slide_data) }];
    }
    return [b];
  });
}

function normalizarResposta(raw) {
  if (!raw || typeof raw !== "object") return raw;
  if (!raw.sections || !Array.isArray(raw.sections)) return raw;

  return {
    ...raw,
    sections: raw.sections.map((sec) => {
      // Normaliza 'slots' se existirem
      const slots = sec.slots || {};
      const novosSlots = {};
      let temSlots = false;

      Object.entries(slots).forEach(([key, blocks]) => {
        novosSlots[key] = normalizarBlocos(blocks);
        temSlots = true;
      });

      return {
        ...sec,
        slots: temSlots ? novosSlots : undefined,
        // Normaliza 'conteudo' linear se existir
        conteudo: sec.conteudo ? normalizarBlocos(sec.conteudo) : undefined,
      };
    }),
  };
}

/**
 * Pipeline principal - escolhe e executa o pipeline correto
 */
export async function runChatPipeline(
  selectedMode,
  message,
  attachments = [],
  context = {},
) {
  let executionMode = selectedMode;
  try {
  // 0. === GUARDRAIL SEMÂNTICO DE ESCOPO ===
  if (context.onProcessingStatus) {
    context.onProcessingStatus("loading", "Validando alinhamento semântico");
  }

  const guardrailValidation = await validateStudyContext(message);

  if (!guardrailValidation.isValid) {
    const reasonMap = {
      low_vector_score: "Score vetorial insuficiente",
      chrome_ai_rejected: "Juiz Local (Chrome AI) detectou off-topic",
      transformers_rejected: "Juiz Local (Transformers.js) detectou off-topic",
    };

    const reasonText = reasonMap[guardrailValidation.reason] || "Assunto fora do escopo educacional";
    console.warn(`[Pipeline] ⛔ Guardrail ativado: ${reasonText} (Score: ${guardrailValidation.score?.toFixed(3) || "N/A"})`);
    
    const rejectedResponse = {
      layout: [{ tipo: "destaque", size: "full" }],
      conteudo: [{
        tipo: "destaque",
        conteudo: `⛔ **Acesso Bloqueado pelo Guardrail**\n\nIdentifiquei que sua mensagem não possui alinhamento com o domínio de estudos desta IA.\n\n- **Motivo técnico:** ${reasonText}\n- **Score de Confiança:** \`${guardrailValidation.score?.toFixed(3) || "0.000"}\`\n\nPor favor, utilize o chat exclusivamente para tópicos acadêmicos (Matemática, Física, História, etc).`
      }]
    };

    if (context.onStream) {
      context.onStream(rejectedResponse);
    }
    if (context.onComplete) {
      context.onComplete({ mode: "blocked", response: rejectedResponse });
    }
    return { success: false, mode: "blocked", reason: guardrailValidation.reason, score: guardrailValidation.score };
  }

  // 1. === PERSISTENCE & INIT ===
  const oldActive = document.getElementById("stepsAccordion");
  if (oldActive) {
      oldActive.removeAttribute("id");
  }

  // Gerencia criação de chat se não existir ID
  let chatId = context.chatId;
  let isNewChat = false;

  // ACUMULADOR DE EVENTOS DO TURNO (Consolidado no final para evitar Race Conditions)
  const consolidatedTurnMessages = [];

  if (!chatId) {
    try {
      const newChat = await ChatStorageService.createNewChat(
        message,
        attachments,
      );
      chatId = newChat.id;
      context.chatId = chatId; // Atualiza contexto
      isNewChat = true;

      // Notifica UI sobre novo chat
      if (context.onChatCreated) context.onChatCreated(newChat);
    } catch (err) {
      console.warn("[Pipeline] Falha ao criar chat no storage:", err);
    }
  } else {
    // Persiste mensagem do usuário em chat existente
    try {
      await ChatStorageService.addMessage(chatId, "user", message, attachments);
    } catch (err) {
      console.warn("[Pipeline] Falha ao salvar mensagem do user:", err);
    }
  }


  // 2. === MEMORY SYSTEM INTEGRATION (PRE-ROUTING) ===
  // Buscamos memória ANTES do router para dar contexto à decisão
  let additionalContextMessage = "";
  let memoryContextForRouter = "";

  try {
    console.log("[Pipeline] 🧠 Consultando Memória Contextual...");
    // Update UI: "Recuperando informações..."
    if (context.onProcessingStatus) {
      window._currentChatPhase = "memory";
      context.onProcessingStatus("loading", "Recuperando informações");
    }

    const memoryFacts = await MemoryService.queryContext(message);

    console.log("[Pipeline] 🧠 Memória Contextual encontrada:", memoryFacts);

    if (memoryFacts.length > 0) {
      // Síntese de contexto via LLM para gerar diretivas comportamentais
      const contextString = await MemoryService.synthesizeContext(
        memoryFacts,
        message,
        context.apiKey,
        attachments,
        { signal: context.signal, onThought: context.onThought }, // Repassa callbacks pro service
      );

      if (contextString) {
        additionalContextMessage += `\n\n${contextString}\n`;
        // Contexto limpo para o router (sem quebras excessivas)
        memoryContextForRouter = contextString;

        console.log(
          "[Pipeline] 🧠 Diretivas de memória injetadas:",
          contextString,
        );
        // Update UI: "Memórias recuperadas!" (System Message + Status)
        if (context.onProcessingStatus) {
          // Check abort before updating UI
          if (context.signal?.aborted)
            throw new DOMException("Aborted", "AbortError");

          context.onProcessingStatus("loading", "Escolhendo modo de execução");
          // Passamos o objeto completo de detalhes para a UI renderizar o bloco expansível
          const memoryContent = {
            title: "Memórias recuperadas",
            facts: memoryFacts,
            summary: contextString,
          };
          context.onProcessingStatus("memory_found", memoryContent);

          // [PERSISTENCE] Acumular evento de memória
          consolidatedTurnMessages.push({
            role: "system",
            content: {
              type: "memory_found",
              ...memoryContent,
            },
          });
        }
      }
    }
  } catch (err) {

    if (err.name === "AbortError") throw err; // Propagate abort
    console.warn("[Pipeline] ⚠️ Erro no sistema de memória:", err);
  }

  // 2. Determina o modo final (Agora com CONTEXTO de memória)
  // Check abort
  if (context.signal?.aborted) throw new DOMException("Aborted", "AbortError");

  // Inicializa conjunto de queries se não existir
  if (!context.previousQueries) {
    context.previousQueries = [];
  }

  window._currentChatPhase = "mode"; // Garante que a UI de pensamentos do router renderize na caixa dele
  const { finalMode, wasRouted, routerResult } = await determineFinalMode(
    selectedMode,
    message,
    attachments,
    memoryContextForRouter,
    {
      previousQueries: context.previousQueries,
      signal: context.signal, // Pass signal to router
      apiKey: context.apiKey,
      onThought: context.onThought, // Hook de pensamentos pro router usar
    },
  );
  executionMode = finalMode;

  // 2b. === RESOLVE METODOLOGIA PEDAGÓGICA ===
  const userMetodologia = context.selectedMetodologia || "automatico";
  let finalMetodologiaId;

  if (userMetodologia !== "automatico") {
    // Usuário escolheu manualmente — usar diretamente
    finalMetodologiaId = userMetodologia;
    console.log(`[Pipeline] 📖 Metodologia manual: ${finalMetodologiaId}`);
  } else if (wasRouted && routerResult?.metodologia) {
    // Modo automático — usar recomendação do router
    finalMetodologiaId = routerResult.metodologia;
    console.log(`[Pipeline] 📖 Metodologia automática (Router): ${finalMetodologiaId}`);
  } else {
    // Fallback
    finalMetodologiaId = "feynman";
    console.log(`[Pipeline] 📖 Metodologia fallback: feynman`);
  }

  const metodologiaObj = getMetodologia(finalMetodologiaId);
  const metodologiaInjection = metodologiaObj?.systemPromptInjection || "";

  // LOGICA SCAFFOLDING
  if (finalMode === "scaffolding") {
    const decision = ScaffoldingService.decidirProximoStatus();

    // Tenta extrair dados do contexto ou mensagem
    // Se for o PRIMEIRO passo gerado pelo chat normal, não temos histórico ainda,
    // mas o ScaffoldingService lida com isso.
    const questaoAlvo = {
      questao: message, // Assume que a msg do user é o tópico/questão
      resposta_correta: "Não definido",
    };

    // Gera o prompt usando a nova lógica robusta
    const promptRefinado = ScaffoldingService.generateStepPrompt(
      questaoAlvo,
      decision,
      [], // Começa sem histórico linear no chat principal (o loop slide cuida do resto)
    );

    // Substitui a mensagem original pelo prompt estruturado para garantir o JSON correto
    // OU apenas apenda as instruções. O prompt refinado já é completo ("Você é um tutor..."),
    // então idealmente ele substitui ou domina o contexto.
    additionalContextMessage += "\n\n" + promptRefinado;

    console.log(
      `[Pipeline] 🏗️ Scaffolding: Decisão System=${decision ? "V" : "F"}, Prompt Refinado Injected.`,
    );
  }

  // Verifica tb se precisa buscar questão (AGORA RODA JUNTO COM SCAFFOLDING SE NECESSÁRIO)
  if (wasRouted && routerResult?.busca_questao) {
    console.log(
      "[Pipeline] 🔎 Router solicitou busca de questão:",
      routerResult.busca_questao,
    );
    try {
      const questionData = await findBestQuestion({
        query: routerResult.busca_questao.conteudo,
        ...routerResult.busca_questao.props,
      });

      if (questionData) {
        console.log(
          "[Pipeline] ✅ Questão encontrada e injetada no contexto:",
          questionData.id,
        );

        // REGISTRA QUERY USADA PARA NÃO REPETIR
        context.previousQueries.push(routerResult.busca_questao.conteudo);

        // SEMPRE injeta no contexto (mesmo com gap)
        additionalContextMessage += `\n\n[SISTEMA - DADOS INJETADOS]: O usuário solicitou uma questão. Use os dados abaixo para gerar o bloco 'questao' na resposta. Não invente, use estes dados:\n${JSON.stringify(questionData.fullData)}`;

        // GAP DETECTION: Check if result is genuinely relevant
        // Runs in parallel — don't block the chat response
        checkQuestionRelevance(
          routerResult.busca_questao.conteudo,
          questionData,
          context.apiKey,
          context.signal,
        )
          .then((relevance) => {
            console.log("[Pipeline] 🔍 Relevance check:", relevance);
            if (!relevance.relevant || relevance.needs_more) {
              console.log("[Pipeline] 🔍 Gap detected — triggering extraction");
              triggerQuestionExtraction(routerResult.busca_questao, context);
            }
          })
          .catch((err) => {
            if (err.name !== "AbortError") {
              console.warn("[Pipeline] ⚠️ Gap detection error:", err);
            }
          });
      } else {
        // No results at all — trigger extraction
        console.log("[Pipeline] ❌ No question found — triggering extraction");
        triggerQuestionExtraction(routerResult.busca_questao, context);
      }
    } catch (err) {
      console.warn(
        "[Pipeline] ⚠️ Falha ao buscar questão sugerida pelo router:",
        err,
      );
    }
  }

  // 2c. === RESEARCH STAGE (DEEP SEARCH) ===
  const needsResearch = window.researchEnabled || (wasRouted && routerResult?.necessidade_pesquisa);
  let searchSources = [];
  let searchReport = "";

  if (needsResearch) {
    console.log("[Pipeline] 🔍 Ativando Pesquisa Profunda...");
    if (context.onProcessingStatus) {
      window._currentChatPhase = "research";
      context.onProcessingStatus("loading", "Realizando pesquisa aprofundada");
    }

    try {
      const searchQuery = routerResult?.instrucao_pesquisa || message;
      
      // Instrução específica para o Agente de Pesquisa (Grounding)
      const researcherPrompt = `Você é um Pesquisador Especializado da Maia.edu. 
Sua tarefa é realizar uma pesquisa profunda e gerar um relatório técnico fundamentado sobre o tema abaixo.

REGRAS DE OURO:
1. RESPONDA SOMENTE EM MARKDOWN PURO: Utilize títulos, listas e negrito para organizar o conhecimento de forma didática e legível.
2. SEM FIRULAS TÉCNICAS: É terminantemente PROIBIDO o uso de diagramas Mermaid, tags HTML, scripts ou qualquer elemento visual que não seja Markdown padrão. 
3. CITAÇÕES DIRETAS E CLARAS: Você OBRIGATORIAMENTE deve usar expressões como "De acordo com o site X", "Segundo a instituição Y", "Dados do portal Z indicam que..." ao longo do texto. Isso permite que a IA que lerá seu relatório saiba exatamente quem disse o quê.
4. OBJETIVIDADE: Seja denso em informações e evite introduções protocolares.

TEMA DA PESQUISA: ${searchQuery}`;

      const searchResult = await realizarPesquisaGeral(
        researcherPrompt,
        attachments,
        {
          onStatus: context.onProcessingStatus,
          onThought: context.onThought,
          signal: context.signal,
        }
      );

      searchReport = searchResult.report;
      searchSources = searchResult.sources || [];

      if (searchReport) {
        additionalContextMessage += `\n\n--- INÍCIO DO CONHECIMENTO PESQUISADO (Uso Obrigatório) ---\n${searchReport}\n--- FIM DO CONHECIMENTO ---\n`;
        additionalContextMessage += `\n[SISTEMA]: Você acaba de realizar uma pesquisa profunda. Fale sobre o assunto com TOTAL AUTORIDADE, incorporando os dados acima como seu próprio conhecimento especializado. 
JAMAIS diga frases como "segundo o relatório", "com base na pesquisa realizada" ou "o relatório aponta". 
Em vez disso, atribua as informações diretamente às fontes reais citadas (Ex: "O MEC estabelece que...", "Dados da NASA confirmam...", "A Wikipedia registra que...") para passar credibilidade. 
Sua resposta deve ser fluida, natural e baseada em evidências.`;
        
        if (context.onProcessingStatus) {
          context.onProcessingStatus("research_done", {
            report: searchReport,
            sources: searchSources
          });
          
          if (chatId) {
            consolidatedTurnMessages.push({
              role: "system",
              content: {
                type: "research_results",
                report: searchReport,
                sources: searchSources,
              },
            });
          }
        }
      }
    } catch (err) {

      if (err.name === "AbortError") throw err;
      console.warn("[Pipeline] ⚠️ Falha na etapa de pesquisa profunda:", err);
    }
  }

  const finalMessage = message + additionalContextMessage;

  // Notifica sobre mudança de modo (se foi roteado)
  if (wasRouted && context.onModeDecided) {
    const modeData = {
      mode: finalMode,
      reason: routerResult?.reason,
      confidence: routerResult?.confidence,
      routerResult: routerResult, // Envia tudo explicito
      metodologia: finalMetodologiaId,
      metodologiaLabel: metodologiaObj?.label || finalMetodologiaId,
    };

    context.onModeDecided(modeData);

    // [PERSISTENCE] Acumular evento de decisão de modo
    consolidatedTurnMessages.push({
      role: "system",
      content: {
        type: "mode_selected",
        ...modeData,
      },
    });
  }


  // Executa pipeline específico
  let systemPrompt;
  let configMode;

  if (finalMode === "scaffolding") {
    systemPrompt = getSystemPromptScaffolding();
    configMode = "scaffolding";
  } else if (finalMode === "raciocinio") {
    systemPrompt = getSystemPromptRaciocinio(metodologiaInjection);
    configMode = "raciocinio";
  } else {
    systemPrompt = getSystemPromptRapido(metodologiaInjection);
    configMode = "rapido";
  }

  console.log(`[Pipeline] 🚀 Executando modo ${finalMode.toUpperCase()}`);

  if (context.onStart) {
    context.onStart({ mode: finalMode });
  }

  // Acumulador de pensamentos para persistência
    let accumulatedThoughts = [];

    const fullResponse = await generateChatStreamed({
      model: getModeConfig(configMode).model,
      generationConfig: getGenerationParams(configMode),
      systemPrompt,

      userMessage: finalMessage, // Usa a mensagem com contexto injetado
      attachments,
      onStream: context.onStream, // Callback recebe o objeto estruturado em progresso
      onThought: (thought) => {
        accumulatedThoughts.push(thought);
        if (context.onThought) context.onThought(thought);
      },
      apiKey: context.apiKey,
      chatMode: context.chatMode,
      history: context.history,
      signal: context.signal,
    });

    // A resposta final agora é o objeto estruturado completo ({ layout, conteudo })
    const finalContent = fullResponse || {};

    // [PERSISTENCE] Anexar pensamentos acumulados ao conteúdo final para salvar
    if (accumulatedThoughts.length > 0) {
      finalContent._thoughts = accumulatedThoughts;
    }

    // Anexar dados de pesquisa se houver
    if (searchSources && searchSources.length > 0) {
      finalContent.sources = searchSources;
      finalContent.report = searchReport;
    }

    if (context.onComplete) {
      context.onComplete({ mode: finalMode, response: finalContent });
    }

    // === PERSISTENCE: CONSOLIDATED SAVE ===
    if (chatId) {
      // Adiciona a resposta final da IA ao lote de mensagens do turno
      consolidatedTurnMessages.push({
        role: "model",
        content: finalContent,
      });

      // Salva tudo de uma vez no banco
      ChatStorageService.addMessages(chatId, consolidatedTurnMessages).catch(
        (err) =>
          console.warn("[Pipeline] Erro ao salvar histórico consolidado:", err),
      );

      // === AUTO-TITLE GENERATION (If New Chat) ===
      if (isNewChat) {
        generateChatTitleData(message, finalContent, context.apiKey)
          .then((title) => {
            if (title) {
              console.log("[Pipeline] Título gerado:", title);
              ChatStorageService.updateTitle(chatId, title);
              if (context.onTitleUpdated) context.onTitleUpdated(chatId, title);
            }
          })
          .catch((err) =>
            console.warn("[Pipeline] Erro ao gerar título:", err),
          );
      }
    }


    // === MEMORY EXTRACTION (ASYNC) ===
    // Notify UI that memory saving is starting
    if (context.onProcessingStatus) {
      context.onProcessingStatus("memory_saving", {
        title: "Salvando memórias...",
      });
    }

    setTimeout(() => {
      MemoryService.extractAndSaveNarrative(
        message,
        fullResponse,
        context.apiKey,
        attachments,
        { onThought: context.onThought, signal: context.signal },
      )
        .then(() => {
          console.log("[Pipeline] 🧠 Ciclo de memória concluído.");
          if (context.onProcessingStatus) {
            context.onProcessingStatus("memory_saved", {
              title: "Memórias salvas",
            });
          }
        })
        .catch((err) => {
          console.error("[Pipeline] ⚠️ Erro no ciclo de memória:", err);
          if (context.onProcessingStatus) {
            context.onProcessingStatus("memory_saved", {
              title: "Memórias processadas",
            });
          }
        });
    }, 100);

    return { success: true, mode: finalMode, response: finalContent };
  } catch (error) {
    // [FIX] Tratamento específico para cancelamento (Stop Generation)
    if (error.name === "AbortError" || error.message?.includes("aborted")) {
      console.log("[Pipeline] 🛑 Execução interrompida pelo usuário.");
      // Repassa o erro de abort para a UI atualizar o estado (botão voltar ao normal)
      if (context.onError) context.onError(error);
      return { success: false, mode: executionMode, aborted: true };
    }

    console.error("[Pipeline] Erro:", error);
    if (context.onError) context.onError(error);
    return { success: false, mode: executionMode, error: error.message };
  }
}

// Stub para manter compatibilidade se algo importar diretamente (não deveria)
export async function runRapidoPipeline(message, attachments, context) {
  return runChatPipeline("rapido", message, attachments, context);
}

export async function runRaciocinioPipeline(message, attachments, context) {
  return runChatPipeline("raciocinio", message, attachments, context);
}

/**
 * Gera um passo de scaffolding silenciosamente (sem atualizar UI principal).
 * Usado para o fluxo de "Slides" do Scaffolding.
 */
export async function generateSilentScaffoldingStep(
  prompt,
  apiKey,
  attachments = [],
) {
  console.log("[Pipeline] 🤫 Gerando passo de scaffolding silencioso...");

  /*
   Reutilizamos generateChatStreamed mas sem callbacks de UI (onStream)
   e com chatMode=false para garantir geração stateless pura baseada no prompt montado.
  */
  const response = await generateChatStreamed({
    model: "gemini-3-flash-preview", // Modelo rápido para scaffolding
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: SCAFFOLDING_STEP_SCHEMA,
    },
    systemPrompt:
      "You are a helpful assistant. Output ONLY valid JSON matching the schema. Do not output multiple JSON objects.", // Strict instruction
    userMessage: prompt,
    attachments,
    onStream: null, // Silencioso
    onThought: null,
    apiKey,
    chatMode: false,
    history: [], // Sem histórico do servidor, gerenciado manualmente no prompt
  });

  return response;
}

/**
 * Gera resposta usando /generate com streaming e JSON estruturado
 */
async function generateChatStreamed(params) {
  const {
    model,
    generationConfig,
    systemPrompt,
    userMessage,
    attachments = [],
    onStream,
    onThought,
    apiKey,
    chatMode,
    history,
    signal, // Receive signal
  } = params;

  // Monta o prompt combinando system + user com ênfase no user
  const currentDateTime = new Date().toLocaleString("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
  });
  const timeContext = `\n[SISTEMA - DATA/HORA ATUAL: ${currentDateTime}]`;

  const fullPrompt = `${systemPrompt}${timeContext}\n\n---\n\n=== PROMPT DO USUÁRIO (PRIORIDADE MÁXIMA) ===\nUsuário: ${userMessage}\n=== FIM DO PROMPT ===`;

  // Converte anexos (imagens ou arquivos) para base64
  const arquivosProcessados = [];
  // mimeType padrão caso seja só 1 arquivo de imagem (mantendo lógica antiga se necessário, mas agora passamos explicito no objeto)
  let mimeType = "image/jpeg";

  for (const file of attachments) {
    const base64 = await fileToBase64(file);
    arquivosProcessados.push({
      data: base64,
      mimeType: file.type || "application/octet-stream",
    });
    // Se for o primeiro, define o mimeType "principal" (apenas para compatibilidade de assinatura, embora o worker agora use o array de files)
    if (arquivosProcessados.length === 1) {
      mimeType = file.type;
    }
  }

  // Estado local para controle do streaming JSON
  let jsonBuffer = "";
  let lastParsedJson = null;

  // Handlers para o worker
  const handlers = {
    onStatus: (status) => console.log(`[Worker Status] ${status}`),
    onThought: (thought) => {
      if (onThought) onThought(thought);
    },
    onAnswerDelta: (delta) => {
      jsonBuffer += delta;

      // Tenta parsear o que temos até agora (best effort)
      const currentParsedAnswer = parseStreamedJSON(jsonBuffer);

      // Se conseguiu extrair um objeto válido (mesmo que parcial)
      if (currentParsedAnswer) {
        // APLICA NORMALIZAÇÃO NO STREAM (Para UI não quebrar)
        const normalizedAnswer = normalizarResposta(currentParsedAnswer);

        // Envia o objeto COMPLETO para a UI a cada update
        if (onStream) onStream(normalizedAnswer);
        lastParsedJson = normalizedAnswer;
      }
    },
    signal, // Pass signal to worker handlers
  };

  const options = {
    model,
    generationConfig,
    chatMode,
    history,
    systemInstruction: chatMode ? systemPrompt : undefined, // In Chat Mode, separate system instruction
  };

  console.log("[Generate] 🚀 Iniciando geração JSON Estruturado Streamed...");

  // Chama a função do worker
  // Ela retorna o JSON final parseado quando terminar (ou lança erro)
  const finalJSON = await gerarConteudoEmJSONComImagemStream(
    fullPrompt,
    generationConfig?.responseSchema || CHAT_RESPONSE_SCHEMA,
    arquivosProcessados, // Agora passamos lista de objetos {data, mimeType}
    mimeType,
    handlers,
    options,
  );

  // APLICA NORMALIZAÇÃO FINAL
  return normalizarResposta(finalJSON);
}

// fileToBase64 imported from utils

export async function generateChatTitleData(userMsg, aiContent, apiKey) {
  try {
    const aiText =
      typeof aiContent === "string"
        ? aiContent
        : aiContent.conteudo || JSON.stringify(aiContent);

    // Prompt simples e direto para texto puro
    // IMPORTANTE: Gemma NÃO pode usar sections, JSON, markdown ou qualquer formatação
    const prompt = `
Você é um assistente simples. Sua ÚNICA tarefa é gerar um título curto para esta conversa.

REGRAS CRÍTICAS:
- Retorne APENAS o título, nada mais
- NÃO use JSON, sections, markdown, aspas ou qualquer formatação
- NÃO escreva "Título:", "Title:", ou prefixos
- NÃO use estruturas como { } ou [ ]
- O título deve ter entre 3 a 6 palavras em português

EXEMPLOS DE BONS RESULTADOS:
- "Análise de Funções Quadráticas"
- "Estrutura do DNA Celular"
- "Revolução Industrial Brasileira"
- "Cálculo de Derivadas Parciais"
- "Fotossíntese e Respiração Celular"

DADOS DA CONVERSA:
Usuário disse: "${userMsg.substring(0, 200)}"
IA respondeu sobre: "${aiText.substring(0, 200)}"

RESPOSTA (apenas o título, texto puro):`;

    // Usa gerarConteudoEmJSONComImagemStream com modelo Gemma e sem JSON mode forçado
    // Necessário adaptar a chamada pois ela espera schemas/attachments
    // Assinatura: (texto, schema, attachments, mimeType, handlers, options)
    let titleAccumulator = "";

    await gerarConteudoEmJSONComImagemStream(
      prompt,
      null, // Schema null
      [], // Attachments empty
      "image/jpeg", // mimeType placeholder
      {
        onAnswerDelta: (text) => {
          titleAccumulator += text;
        },
      },
      {
        model: "gemma-3-27b-it", // Modelo solicitado pelo usuário (Gemma)
        generationConfig: { responseMimeType: "text/plain" }, // Força texto plano
      },
    );

    let title = titleAccumulator;

    // Limpeza garantida
    if (typeof title !== "string") {
      title = JSON.stringify(title);
    }

    // Remove aspas extras e quebras de linha que o modelo possa ter colocado
    title = title
      .replace(/^["']|["']$/g, "")
      .replace(/\n/g, " ")
      .trim();

    // Remove prefixos comuns se houver
    title = title.replace(/^Título:\s*/i, "");
    title = title.replace(/^Title:\s*/i, "");

    // Se o modelo gerou JSON apesar das instruções, tenta extrair o título
    if (title.startsWith("{") || title.startsWith("[")) {
      try {
        const parsed = JSON.parse(title);
        // Tenta extrair título de estruturas comuns
        title =
          parsed.title ||
          parsed.titulo ||
          parsed.name ||
          parsed.sections?.[0]?.title ||
          JSON.stringify(parsed).substring(0, 50);
      } catch {
        // Se não for JSON válido, pega apenas os primeiros 50 chars
        title = title.replace(/[{}\[\]]/g, "").substring(0, 50);
      }
    }

    // Remove qualquer markdown restante
    title = title.replace(/[#*_`]/g, "").trim();

    return title || "Nova Conversa";
  } catch (e) {
    console.warn("Erro no gerador de títulos:", e);
    return null;
  }
}
