/**
 * Configuração do Sistema de Chat
 * Define modelos, modos e parâmetros gerais
 */

export const CHAT_CONFIG = {
  /**
   * Modos disponíveis de operação
   * - automatico: Router decide qual modelo usar
   * - rapido: Modelo rápido, respostas ágeis
   * - raciocinio: Modelo com raciocínio profundo
   */
  modes: {
    automatico: {
      id: "automatico",
      label: "Automático",
      description: "A IA escolhe o melhor modo para você",
      usesRouter: true,
      model: null, // decidido pelo router
    },
    rapido: {
      id: "rapido",
      label: "Rápido",
      description: "Excelente para um estudo rápido e eficaz",
      usesRouter: false,
      model: "models/gemini-3.5-flash",
    },
    raciocinio: {
      id: "raciocinio",
      label: "Raciocínio",
      description: "Obtenha respostas com menos alucinações ou incoerências",
      usesRouter: false,
      model: "models/gemini-3.5-flash",
    },
    scaffolding: {
      id: "scaffolding",
      label: "Scaffolding (Beta)",
      description: "Treinamento passo-a-passo com verdadeiro ou falso",
      usesRouter: false,
      model: "models/gemini-3.5-flash",
    },
    // Modelos Google Gemini
    "models/gemini-3.5-flash": {
      id: "models/gemini-3.5-flash",
      label: "Gemini 3.5 Flash",
      description: "Equilíbrio perfeito de velocidade e inteligência",
      usesRouter: false,
      model: "models/gemini-3.5-flash",
    },
    "models/gemini-3-flash-preview": {
      id: "models/gemini-3-flash-preview",
      label: "Gemini 3 Flash (Preview)",
      description: "Modelo flash rápido de testes",
      usesRouter: false,
      model: "models/gemini-3-flash-preview",
    },
    "models/gemini-3.1-flash-lite": {
      id: "models/gemini-3.1-flash-lite",
      label: "Gemini 3.1 Flash Lite",
      description: "Super leve e ultra veloz",
      usesRouter: false,
      model: "models/gemini-3.1-flash-lite",
    },
    "models/gemini-2.5-flash": {
      id: "models/gemini-2.5-flash",
      label: "Gemini 2.5 Flash",
      description: "Modelo flash legado estável",
      usesRouter: false,
      model: "models/gemini-2.5-flash",
    },
    "models/gemini-2.5-flash-lite": {
      id: "models/gemini-2.5-flash-lite",
      label: "Gemini 2.5 Flash Lite",
      description: "Modelo de entrada extremamente ágil",
      usesRouter: false,
      model: "models/gemini-2.5-flash-lite",
    },
    "models/gemma-4-31b-it": {
      id: "models/gemma-4-31b-it",
      label: "Gemma 4 31B IT",
      description: "Modelo aberto Gemma avançado",
      usesRouter: false,
      model: "models/gemma-4-31b-it",
    },
    "models/gemma-4-26b-a4b-it": {
      id: "models/gemma-4-26b-a4b-it",
      label: "Gemma 4 26B a4b IT",
      description: "Gemma com arquitetura otimizada",
      usesRouter: false,
      model: "models/gemma-4-26b-a4b-it",
    },
    // Modelos OpenAI (GitHub Models)
    "github/gpt-5": {
      id: "github/gpt-5",
      label: "OpenAI GPT-5",
      description: "O topo de linha atual da OpenAI",
      usesRouter: false,
      model: "github/gpt-5",
    },
    "github/gpt-5-chat": {
      id: "github/gpt-5-chat",
      label: "OpenAI GPT-5 Chat (Preview)",
      description: "gpt-5 otimizado para diálogo",
      usesRouter: false,
      model: "github/gpt-5-chat",
    },
    "github/gpt-5-mini": {
      id: "github/gpt-5-mini",
      label: "OpenAI GPT-5-mini",
      description: "Versão equilibrada e otimizada do gpt-5",
      usesRouter: false,
      model: "github/gpt-5-mini",
    },
    "github/gpt-4.1": {
      id: "github/gpt-4.1",
      label: "OpenAI GPT-4.1",
      description: "A evolução direta do GPT-4o",
      usesRouter: false,
      model: "github/gpt-4.1",
    },
    "github/gpt-4.1-mini": {
      id: "github/gpt-4.1-mini",
      label: "OpenAI GPT-4.1-mini",
      description: "Evolução compacta e direta do GPT-4o-mini",
      usesRouter: false,
      model: "github/gpt-4.1-mini",
    },
    "github/gpt-4o": {
      id: "github/gpt-4o",
      label: "OpenAI GPT-4o",
      description: "Inteligência geral rápida e robusta",
      usesRouter: false,
      model: "github/gpt-4o",
    },
    "github/gpt-4o-mini": {
      id: "github/gpt-4o-mini",
      label: "OpenAI GPT-4o-mini",
      description: "O mais rápido da linha GPT-4",
      usesRouter: false,
      model: "github/gpt-4o-mini",
    },
    "github/o1": {
      id: "github/o1",
      label: "OpenAI o1",
      description: "Raciocínio complexo com pensamento profundo",
      usesRouter: false,
      model: "github/o1",
    },
    "github/o3": {
      id: "github/o3",
      label: "OpenAI o3",
      description: "Modelo de raciocínio profundo de última geração",
      usesRouter: false,
      model: "github/o3",
    },
    "github/o3-mini": {
      id: "github/o3-mini",
      label: "OpenAI o3-mini",
      description: "Raciocínio complexo em formato ágil com visão",
      usesRouter: false,
      model: "github/o3-mini",
    },
    "github/o4-mini": {
      id: "github/o4-mini",
      label: "OpenAI o4-mini",
      description: "O mais novo modelo de raciocínio compacto",
      usesRouter: false,
      model: "github/o4-mini",
    },
  },

  /**
   * Configuração do Router
   */
  routerModel: "models/gemma-4-31b-it",

  /**
   * Mapeamento de Complexidade para Modos
   */
  complexityToMode: {
    BAIXA: "rapido",
    ALTA: "raciocinio",
    SCAFFOLDING: "scaffolding",
  },

  /**
   * Parâmetros de geração por modo
   */
  generationParams: {
    rapido: {
      temperature: 1,
    },
    raciocinio: {
      temperature: 1,
      // Habilita thinking para modelos que suportam
    },
    scaffolding: {
      temperature: 1,
      // Pensamentos do tutor
    },
  },

  /**
   * Timeout em ms para cada etapa
   */
  timeouts: {
    router: 10000, // 10s para classificação
    response: 60000, // 60s para resposta principal
  },
};

/**
 * Obtém configuração de um modo específico
 * @param {string} modeId - ID do modo (automatico, rapido, raciocinio)
 * @returns {object} Configuração do modo
 */
export function getModeConfig(modeId) {
  return CHAT_CONFIG.modes[modeId] || CHAT_CONFIG.modes.automatico;
}

/**
 * Obtém parâmetros de geração para um modo
 * @param {string} modeId - ID do modo
 * @returns {object} Parâmetros de geração
 */
export function getGenerationParams(modeId) {
  return (
    CHAT_CONFIG.generationParams[modeId] || CHAT_CONFIG.generationParams.rapido
  );
}

/**
 * Converte complexidade classificada para modo
 * @param {string} complexity - 'BAIXA' ou 'ALTA'
 * @returns {string} ID do modo correspondente
 */
export function complexityToMode(complexity) {
  return CHAT_CONFIG.complexityToMode[complexity] || "rapido";
}
