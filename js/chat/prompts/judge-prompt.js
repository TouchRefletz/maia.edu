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
1. Correção e precisão da resposta: 5 = totalmente correta, em conformidade com o gabarito; 4 = pequena imprecisão, mas essencialmente correta; 3 = parcialmente correta (Nota máxima/teto se a IA acertar a alternativa correta/letra, mas apresentar qualquer salto lógico na tentativa de justificar a escolha); 2 = contém erros relevantes (Nota máxima/teto se a IA acertar a alternativa/letra, mas apresentar qualquer contradição teórica na justificativa); 1 = majoritariamente incorreta; 0 = totalmente incorreta.
2. Qualidade do raciocínio: 5 = raciocínio modularizado, sequencial (passo a passo) e estruturado de forma progressiva, apresentando obrigatoriamente a análise crítica individualizada de cada alternativa/distrator; 4 = raciocínio correto com pequenas falhas ou omissão menor na análise dos distratores; 3 = raciocínio parcialmente correto (Nota máxima/teto para respostas lineares que resolvem diretamente o problema sem detalhar ou justificar a incorreção de cada alternativa/distrator); 2 = raciocínio confuso, incompleto ou com lacunas lógicas importantes; 1 = raciocínio majoritariamente incorreto; 0 = sem raciocínio ou totalmente incoerente.
3. Presença de alucinações: 5 = nenhuma informação inventada, extrapolada ou teoricamente incorreta. Todas as declarações conceituais são factuais e sustentadas cientificamente; 4 = pequenas imprecisões de escrita ou jargão que não comprometem o rigor teórico da questão; 3 = presença de pequenas inconsistências teóricas ou informações marginais desnecessárias (Nota máxima/teto se o modelo cometer erros factuais de menor gravidade ou citar fontes inexistentes); 2 = invenções ou distorções conceituais que prejudicam parcialmente a explicação; 1 = várias informações erradas ou dados inventados; 0 = totalmente baseada em informações falsas.
4. Aderência ao enunciado / interpretação: 5 = demonstra compreensão integral da questão, interpretando e integrando corretamente todas as informações do enunciado, textos de apoio e dados visuais (como imagens traduzidas, gráficos ou tabelas) quando presentes; 4 = utiliza e interpreta bem a maior parte das informações fornecidas; 3 = interpretação parcial (Nota máxima/teto caso o modelo desconsidere elementos visuais críticos traduzidos ou textos de apoio cruciais, limitando-se a responder com base apenas em conhecimento prévio geral); 2 = interpretação muito limitada ou distorcida de dados essenciais; 1 = interpretação incorreta; 0 = ignora ou distorce completamente o enunciado.
5. Qualidade pedagógica / clareza: 5 = adota uma estratégia de mediação didática ativa (scaffolding), estruturando a resposta para guiar o estudante progressivamente pelas bases conceituais antes de apresentar a resolução direta; 4 = explicação clara com pequenas falhas didáticas; 3 = compreensível, mas de caráter passivo/expositivo (Nota máxima/teto para explicações que apenas expõem a resposta e justificativa de forma direta, sem recursos de scaffolding cognitivo ou mediação ativa de aprendizagem); 2 = explicação difícil de compreender ou confusa para um estudante; 1 = muito confusa; 0 = incompreensível ou ausente.
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
