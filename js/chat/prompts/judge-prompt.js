/**
 * Prompt e rubrica do sistema de avaliação cruzada (LLM-as-a-Judge)
 * Baseado integralmente no Apêndice A do Projeto Científico
 */

export function getJudgeSystemPrompt(isInterdisciplinary = false) {
  const k6Rubric = `
[CRITÉRIO ADICIONAL - EXCLUSIVO PARA QUESTÕES IDENTIFICADAS COMO INTERDISCIPLINARES / FUVEST]
6. Integração Interdisciplinar: 5 = Identifica as disciplinas envolvidas e funde os conceitos de forma indissociável para resolver o problema; 4 = Explica ambas as disciplinas e cria ponte lógica clara com pequenos problemas de fluidez; 3 = Resolve ambas de forma correta, mas em blocos separados (justaposição fragmentada) sem conectá-las; 2 = Domina apenas uma disciplina e ignora ou erra a interface com a outra; 1 = Superficial e incorreto em ambas; 0 = Erro conceitual completo ou alucinação de conexões científicas.
`;

  const k6Instructions = `
• Para questões do estrato interdisciplinar, avalie com rigor crítico se a IA fundiu as matérias ou se apenas gerou parágrafos isolados de disciplinas diferentes. Respostas que resolvem a parte de Disciplina A num canto e a de Disciplina B no outro, sem criar o nexo causal exigido pela FUVEST, estão limitadas à nota máxima de 3 no critério de Integração Interdisciplinar, independentemente do tamanho do texto.
`;

  const k6JsonFormat = `,
    "integracao_interdisciplinar": {
      "nota": 0,
      "justificativa": "Sua justificativa"
    }`;

  return `Você é um avaliador acadêmico imparcial de respostas para questões de vestibular brasileiro. Sua tarefa é avaliar UMA resposta produzida por uma IA com base exclusivamente nos materiais fornecidos: 1. enunciado da questão; 2. gabarito ou resposta de referência; 3. resposta da IA avaliada; 4. rubrica de avaliação.

IMPORTANTE:
• Não tente adivinhar qual modelo gerou a resposta.
• Não favoreça estilo, extensão ou sofisticação verbal. Uma resposta curta, direta e correta deve receber a mesma nota máxima que uma resposta longa. Jamais atribua pontuações maiores apenas porque o texto gerado possui mais palavras ou parágrafos.
• Avalie apenas a qualidade real da resposta.
• Não use conhecimento externo quando ele não estiver sustentado pelo enunciado, pelo gabarito ou pela própria resposta.
• Se houver incerteza, seja conservador na nota.
• Use somente notas inteiras: 0, 1, 2, 3, 4 ou 5.
• Não dê a nota final sem justificar cada critério.
• Não reescreva a resposta do aluno/IA; apenas avalie.
• A PONTUAÇÃO GERAL (pontuacao_total) deve ser a soma exata das notas de cada critério. Como cada critério vale de 0 a 5, para a avaliação de 5 critérios a pontuação geral deve estar estritamente no intervalo de 0 a 25${isInterdisciplinary ? " (ou de 0 a 30 quando o critério interdisciplinar também for incluído)" : ""}.

Rubrica:
[CRITÉRIOS DE AVALIAÇÃO PADRÃO - QUESTÕES ENEM]
1. Correção da resposta: 5 = totalmente correta, em conformidade com o gabarito; 4 = pequena imprecisão, mas essencialmente correta; 3 = parcialmente correta; 2 = contém erros relevantes; 1 = majoritariamente incorreta; 0 = totalmente incorreta.
2. Qualidade do raciocínio: 5 = raciocínio completo, lógico e bem estruturado; 4 = raciocínio correto com pequenas falhas; 3 = raciocínio parcialmente correto; 2 = raciocínio confuso ou incompleto; 1 = raciocínio majoritariamente incorreto; 0 = sem raciocínio ou totalmente incoerente.
3. Presença de alucinações: 5 = nenhuma informação inventada; 4 = pequena imprecisão não comprometedora; 3 = algumas inconsistências; 2 = invenções que prejudicam parcialmente; 1 = várias informações incorretas; 0 = totalmente baseado em informações falsas.
4. Aderência ao enunciado: 5 = usa corretamente todas as informações da questão; 4 = usa bem a maior parte das informações; 3 = uso parcial das informações; 2 = interpretação limitada do enunciado; 1 = interpretação incorreta; 0 = ignora ou distorce completamente o enunciado.
5. Qualidade pedagógica / clareza: 5 = explicação clara, didática e fácil de entender; 4 = explicação clara com pequenas falhas; 3 = compreensível, mas pouco didática; 2 = difícil de entender; 1 = muito confusa; 0 = incompreensível ou ausente.
${isInterdisciplinary ? k6Rubric : ""}
Instruções de avaliação:
• Compare a resposta com o gabarito de referência.
• Verifique se a conclusão final está correta.
• Verifique se a caminho apresentado faz sentido.
• Identifique qualquer informação inventada, extrapolada ou não sustentada.
• Verifique se a resposta realmente usa os dados do enunciado.
• Verifique se a explicação seria útil para um estudante aprendendo o conteúdo.
• Não penalize diferenças de redação se o conteúdo estiver correto.
• Penalize fortemente afirmações falsas apresentadas com confiança.
• Se a resposta acertar o resultado, mas com justificativa errada, reduza a nota de raciocínio e, se necessário, de alucinação.
• Se a resposta errar o resultado, mas mostrar compreensão parcial consistente, atribua nota intermediária, não zero automático.
• Se a resposta omitir etapas importantes, isso afeta raciocínio e clareza.
• Se a resposta ignorar parte relevante do enunciado, reduza aderência ao enunciado.
${isInterdisciplinary ? k6Instructions : ""}
ADAPTAÇÃO ARQUITETURAL PARA CÓDIGO (RETORNO EM JSON):
Você deve retornar estritamente um objeto JSON válido, sem blocos markdown ou texto adicional, com o seguinte formato:
{
  "criterios": {
    "precisao": {
      "nota": 0,
      "justificativa": "Sua justificativa"
    },
    "raciocinio": {
      "nota": 0,
      "justificativa": "Sua justificativa"
    },
    "alucinacao": {
      "nota": 0,
      "justificativa": "Sua justificativa"
    },
    "aderencia_enunciado": {
      "nota": 0,
      "justificativa": "Sua justificativa"
    },
    "pedagogia": {
      "nota": 0,
      "justificativa": "Sua justificativa"
    }${isInterdisciplinary ? k6JsonFormat : ""}
  },
  "pontuacao_total": 0,
  "comentario_geral": "Síntese geral da avaliação"
}
`;
}

export const JUDGE_SYSTEM_PROMPT = getJudgeSystemPrompt(false);

export const JUDGE_RUBRIC = ``;

export function getJudgeResponseSchema(isInterdisciplinary = false) {
  const baseProperties = {
    precisao: {
      type: "object",
      properties: {
        nota: { type: "integer" },
        justificativa: { type: "string" }
      },
      required: ["nota", "justificativa"]
    },
    raciocinio: {
      type: "object",
      properties: {
        nota: { type: "integer" },
        justificativa: { type: "string" }
      },
      required: ["nota", "justificativa"]
    },
    alucinacao: {
      type: "object",
      properties: {
        nota: { type: "integer" },
        justificativa: { type: "string" }
      },
      required: ["nota", "justificativa"]
    },
    aderencia_enunciado: {
      type: "object",
      properties: {
        nota: { type: "integer" },
        justificativa: { type: "string" }
      },
      required: ["nota", "justificativa"]
    },
    pedagogia: {
      type: "object",
      properties: {
        nota: { type: "integer" },
        justificativa: { type: "string" }
      },
      required: ["nota", "justificativa"]
    }
  };

  const requiredCriterios = ["precisao", "raciocinio", "alucinacao", "aderencia_enunciado", "pedagogia"];

  if (isInterdisciplinary) {
    baseProperties.integracao_interdisciplinar = {
      type: "object",
      properties: {
        nota: { type: "integer" },
        justificativa: { type: "string" }
      },
      required: ["nota", "justificativa"]
    };
    requiredCriterios.push("integracao_interdisciplinar");
  }

  return {
    type: "object",
    properties: {
      criterios: {
        type: "object",
        properties: baseProperties,
        required: requiredCriterios
      },
      pontuacao_total: { type: "integer" },
      comentario_geral: { type: "string" }
    },
    required: ["criterios", "pontuacao_total", "comentario_geral"]
  };
}

export const JUDGE_RESPONSE_SCHEMA = getJudgeResponseSchema(false);

export function buildJudgePrompt(enunciado, gabarito, respostaIA, isInterdisciplinary = false) {
  return `
Materiais de entrada:
[GABARITO DE REFERÊNCIA] ${gabarito}
[RESPOSTA A SER AVALIADA] ${respostaIA}

Instruções adicionais da questão:
Questão: ${enunciado}
A questão é do tipo: ${isInterdisciplinary ? "INTERDISCIPLINAR (FUVEST) - avaliar critério 6" : "ENEM PADRÃO - omitir critério 6"}.
`;
}
