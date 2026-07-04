/**
 * Chat Module - Index
 * Exporta todas as funcionalidades do módulo de chat
 */

// Configuração
export {
  CHAT_CONFIG,
  complexityToMode,
  getGenerationParams,
  getModeConfig,
} from "./config.js";

// Router
export {
  clearRoutingCache,
  determineFinalMode,
  getLastRoutingResult,
  routeMessage,
} from "./router.js";

// Pipelines
export {
  runChatPipeline,
  runRaciocinioPipeline,
  runRapidoPipeline,
  generateSilentScaffoldingStep,
  generatePersonaSimulation,
} from "./pipelines.js";

// Prompts
export {
  buildRouterPrompt,
  ROUTER_RESPONSE_SCHEMA,
  ROUTER_SYSTEM_PROMPT,
} from "./prompts/router-prompt.js";

export {
  getSystemPromptBase,
  getSystemPromptRaciocinio,
  getSystemPromptRapido,
} from "./prompts/chat-system-prompt.js";
