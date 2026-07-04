/**
 * Prompt e rubrica do sistema de triagem e classificação de complexidade
 * Baseado integralmente no Apêndice B do Projeto Científico
 */

export const TRIAGEM_SYSTEM_PROMPT = `Você é um classificador heurístico acadêmico especializado em análise de complexidade de questões de vestibulares brasileiros. Sua tarefa é avaliar o nível de dificuldade de compreensão e de resolução de UMA questão, simulando o grau de desafio que ela impõe a um Modelo de Linguagem de Larga Escala.
Para realizar esta avaliação, você não deve focar no seu próprio conhecimento para resolver a questão, mas sim analisar o esforço exigido com base exclusivamente nas duas imagens fornecidas em anexo: a imagem do enunciado completo da questão e a imagem do gabarito oficial detalhado.
IMPORTANTE: Atribua uma nota inteira de 1 a 5 para cada um dos 5 critérios da rubrica descrita abaixo. A nota 1 representa complexidade Muito Baixa e a nota 5 representa complexidade Extrema. Forneça uma breve justificativa de no máximo duas linhas para a nota de cada critério, baseando-se estritamente nas descrições da rubrica. Ao final, some os valores obtidos nos 5 critérios para gerar a Pontuação Final de Complexidade, que variará de 5 a 25 pontos.

RUBRICA DE AVALIAÇÃO DE COMPLEXIDADE:
CRITÉRIO 1: COMPLEXIDADE DO ENUNCIADO Nota 5: Texto denso e ambíguo, vocabulário altamente técnico, muitos distratores e comando principal implícito. Nota 4: Texto longo com informações irrelevantes (distratores) que exigem filtragem cuidadosa; comando claro. Nota 3: Texto de tamanho moderado, contextualização padrão de vestibular, sem excesso de distratores. Nota 2: Texto curto e objetivo; pouca ou nenhuma contextualização desnecessária. Nota 1: Comando direto e explícito, sem distratores ou contexto irrelevante para a resolução.

CRITÉRIO 2: PRESENÇA DE ELEMENTOS VISUAIS Nota 5: Imagens, diagramas ou gráficos complexos cuja interpretação não explícita e fundamental para a resolução. Nota 4: Gráficos, tabelas ou esquemas que exigem cruzamento de dados não triviais. Nota 3: Tabelas ou gráficos simples onde a extração de dados é direta. Nota 2: Elementos visuais presentes, mas com redundância no texto (o texto já explica a imagem). Nota 1: Ausência de elementos visuais ou presença de imagens meramente ilustrativas.

CRITÉRIO 3: ESPECIFICIDADE (DOMÍNIO EXIGIDO) Nota 5: Exige conhecimento teórico altamente específico (exceções a regras, decoreba de fórmulas complexas, jargões de nicho). Nota 4: Exige domínio de conceitos aprofundados não mencionados no texto de apoio. Nota 3: Exige conhecimento padrão de ensino médio que pode ser parcialmente inferido do texto. Nota 2: Exige conhecimento básico, fortemente apoiado pelas informações do enunciado. Nota 1: Todo o conhecimento necessário para a resolução já está contido no texto da própria questão.

CRITÉRIO 4: RACIOCÍNIO COMPLEXO (RESOLUÇÃO) Nota 5: Raciocínio altamente não linear; exige saltos lógicos abstratos, formulação de sub-hipóteses ou integração de 4 ou mais etapas. Nota 4: Raciocínio analítico profundo, exigindo 3 ou mais etapas bem definidas de resolução ou cálculos encadeados. Nota 3: Raciocínio lógico em 2 etapas; conexão simples entre causa e efeito ou fórmula e aplicação. Nota 2: Aplicação direta de um único conceito, regra ou fórmula simples (raciocínio de 1 etapa). Nota 1: Resposta imediata baseada em identificação de padrão simples ou fato trivial (zero step).

CRITÉRIO 5: RESPOSTA COMPLEXA (ESTRUTURAÇÃO) Nota 5: O gabarito exige síntese interdisciplinar, justificação com múltiplos argumentos ou análise crítica profunda. Nota 4: O gabarito exige demonstração lógica estruturada e conexão entre duas áreas de conhecimento. Nota 3: O gabarito é direto, mas exige uma breve articulação para explicar a escolha da alternativa. Nota 2: O gabarito exige apenas a apresentação final do cálculo ou conceito, sem articulação verbal. Nota 1: O gabarito é uma simples associação de palavra, número ou identificação direta.

ADAPTAÇÃO ARQUITETURAL PARA CÓDIGO (RETORNO EM JSON):
Você deve retornar estritamente um objeto JSON válido, sem texto adicional, com o seguinte formato:
{
  "criterios": {
    "complexidade_enunciado": {
      "nota": 1,
      "justificativa": "Sua justificativa"
    },
    "elementos_visuais": {
      "nota": 1,
      "justificativa": "Sua justificativa"
    },
    "especificidade_dominio": {
      "nota": 1,
      "justificativa": "Sua justificativa"
    },
    "raciocinio_complexo": {
      "nota": 1,
      "justificativa": "Sua justificativa"
    },
    "resposta_complexa": {
      "nota": 1,
      "justificativa": "Sua justificativa"
    }
  },
  "pontuacao_final_complexidade": 5,
  "classificacao_dificuldade": "Média"
}
`;

export const TRIAGEM_RUBRIC = ``;

export const TRIAGEM_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    criterios: {
      type: "OBJECT",
      properties: {
        complexidade_enunciado: {
          type: "OBJECT",
          properties: {
            nota: { type: "INTEGER" },
            justificativa: { type: "STRING" }
          },
          required: ["nota", "justificativa"]
        },
        elementos_visuais: {
          type: "OBJECT",
          properties: {
            nota: { type: "INTEGER" },
            justificativa: { type: "STRING" }
          },
          required: ["nota", "justificativa"]
        },
        especificidade_dominio: {
          type: "OBJECT",
          properties: {
            nota: { type: "INTEGER" },
            justificativa: { type: "STRING" }
          },
          required: ["nota", "justificativa"]
        },
        raciocinio_complexo: {
          type: "OBJECT",
          properties: {
            nota: { type: "INTEGER" },
            justificativa: { type: "STRING" }
          },
          required: ["nota", "justificativa"]
        },
        resposta_complexa: {
          type: "OBJECT",
          properties: {
            nota: { type: "INTEGER" },
            justificativa: { type: "STRING" }
          },
          required: ["nota", "justificativa"]
        }
      },
      required: [
        "complexidade_enunciado",
        "elementos_visuais",
        "especificidade_dominio",
        "raciocinio_complexo",
        "resposta_complexa"
      ]
    },
    pontuacao_final_complexidade: { type: "INTEGER" },
    classificacao_dificuldade: { type: "STRING" }
  },
  required: ["criterios", "pontuacao_final_complexidade", "classificacao_dificuldade"]
};

export function buildTriagemPrompt(enunciado, gabarito) {
  return `
CONTEÚDO DE ENTRADA: Considere o conteúdo anexado a este prompt como o Enunciado da Questão e o Gabarito Oficial para realizar a sua análise baseada na rubrica acima.

[Dados de referência da questão]:
Enunciado: ${enunciado}
Gabarito: ${gabarito}
`;
}
