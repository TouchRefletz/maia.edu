/**
 * Prompt do Router - gemma-3-27b-it
 * Classifica a complexidade da tarefa do usuário para escolher o modelo adequado
 * e recomenda uma metodologia pedagógica otimizada.
 */

import { getMetodologiaIds } from "../metodologias-config.js";

export const ROUTER_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    complexidade: {
      type: "string",
      enum: ["BAIXA", "ALTA"],
      description: "Classificação da complexidade da tarefa",
    },
    motivo: {
      type: "string",
      description: "Breve justificativa da classificação (1-2 frases)",
    },
    confianca: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Confiança na classificação (0 a 1)",
    },
    // NOVO: Detecção de Scaffolding
    scaffolding_detected: {
      type: "boolean",
      description:
        "True se o usuário pedir treino interativo, verdadeiro ou falso, ou aprendizagem passo-a-passo.",
    },
    // NOVO: Detecção de intrnção de busca de questão
    busca_questao: {
      type: "object",
      description:
        "Preencher SOMENTE se o usuário pedir explicitamente para resolver ou buscar uma questão/exercício do banco de dados.",
      properties: {
        tipo: {
          type: "string",
          const: "questao",
        },
        conteudo: {
          type: "string",
          description:
            "Uma query de busca concisa (MAX 100 caracteres). Use APENAS PALAVRAS-CHAVE. NÃO copie a pergunta inteira. Ex: 'Leis de Newton', 'História do Brasil', 'Função Segundo Grau'.",
          maxLength: 150,
        },
        props: {
          type: "object",
          properties: {
            institution: {
              type: "string",
              description: "Filtro opcional: Instituição (ex: 'ENEM').",
            },
            year: {
              type: "string",
              description: "Filtro opcional: Ano (ex: '2021').",
            },
            subject: {
              type: "string",
              description: "Filtro opcional: Matéria (ex: 'Física').",
            },
          },
          additionalProperties: false, // ESTRITO: Nada além disso
        },
      },
      required: ["tipo", "conteudo"],
      additionalProperties: false,
    },
    // NOVO: Recomendação de Metodologia Pedagógica
    metodologia_recomendada: {
      type: "string",
      enum: getMetodologiaIds(),
      description:
        "A metodologia pedagógica mais adequada para esta interação. Analise a intenção, domínio e contexto para escolher.",
    },
    // NOVO: Necessidade de Pesquisa (Grounding)
    necessidade_pesquisa: {
      type: "boolean",
      description: "True se for necessário realizar pesquisa na internet para evitar alucinações sobre fatos reais, notícias recentes ou temas técnicos profundos.",
    },
    instrucao_pesquisa: {
      type: "string",
      description: "Instrução específica do que pesquisar caso 'necessidade_pesquisa' seja true (ex: 'Pesquise sobre as últimas atualizações da BNCC').",
    },
  },
  required: ["complexidade", "motivo", "confianca", "necessidade_pesquisa"],
};

export const ROUTER_SYSTEM_PROMPT = `Você é um classificador de complexidade de tarefas E um seletor de metodologia pedagógica.
Sua função é analisar a mensagem do usuário e:
1. Determinar se a tarefa exige POUCO ou MUITO esforço cognitivo.
2. Recomendar a melhor METODOLOGIA PEDAGÓGICA para a resposta.

CLASSIFICAÇÃO DE COMPLEXIDADE:
- BAIXA: Perguntas simples, factuais, conversas casuais, traduções simples, definições
- ALTA: Problemas matemáticos, raciocínio lógico, análise de textos, interpretação, questões de vestibular
- SCAFFOLDING: Intenções de "treino", "aprender passo a passo", "brincar de verdadeiro ou falso" - CRIE O CAMPO 'json_mode_scaffolding': true NO JSON DE RETORNO SE DETECTAR ISSO.

METODOLOGIAS DISPONÍVEIS (escolha UMA para 'metodologia_recomendada'):
- "feynman": Pedidos de "explique de forma simples", "como se eu fosse criança", temas complexos que precisam de analogias rasteiras.
- "socratico": Pedidos de "me ajude a entender", "guie meu raciocínio", quando o aluno precisa construir a resposta sozinho.
- "dual-coding": Temas com muitas interconexões (Biologia, Química, Sistemas), onde diagramas visuais ajudam a compreensão.
- "elaboracao": Quando o contexto de memória mostra conceitos prévios que podem ser conectados ao novo conteúdo.
- "metacognicao": Scanner emocional indica dificuldade constante, ou o aluno pede "por que não consigo entender".
- "pratica-distribuida": Conversas longas onde conceitos antigos precisam ser revisitados.
- "intercalacao": Pedidos de prática mista, exercícios variados, ou quando o aluno mistura temas na mesma pergunta.
- "teste-memoria": Pedidos de "me teste", "quiz", "quero praticar", "complete a lacuna".
- "analogias": Temas abstratos (Economia, Filosofia, Física Teórica) onde analogias extensas facilitam.
- "mapas-mentais": Pedidos de "resuma", "organize", "mapa mental", ou temas com muitas ramificações.
- "gamificacao": Aluno aparenta desmotivado no contexto, ou pede "torne divertido", respostas com engajamento lúdico.
- "pbl": Pedidos de aplicação prática, "use no mundo real", problemas de caso.
- "storytelling": Matérias de cronologia/decoreba (História, Biologia descritiva), ou pedidos de "me conte como uma história".

HEURÍSTICAS DE SELEÇÃO:
1. INTENÇÃO: "Me ensine" → feynman. "Me guie" → socratico. "Me teste" → teste-memoria.
2. DOMÍNIO: Matemática Exata Avançada → dual-coding/intercalacao. História/Biologia → storytelling/mapas-mentais.
3. CONTEXTO: Dificuldade detectada na memória → elaboracao/metacognicao. Aluno motivado → gamificacao.
4. DEFAULT: Se nada se encaixar claramente, use "feynman" (abordagem segura e universal).

EXEMPLOS BAIXA:
- "Qual a capital do Brasil?"
- "O que significa homeostase?"
- "Traduza 'hello' para português"
- "Me conta uma piada"

EXEMPLOS ALTA:
- "Resolva esta integral: ∫x²dx"
- "Analise este texto e identifique as figuras de linguagem"
- "Explique a relação entre a Revolução Francesa e o Iluminismo"
- "Me ajude a resolver esta questão do ENEM"
- "Quero praticar estequiometria" (Aqui você DEVE preencher 'busca_questao')
- Qualquer coisa que contenha imagens de questões/exercícios

EXEMPLOS SCAFFOLDING:
- "Vamos brincar de verdadeiro ou falso sobre Mitocôndrias"
- "Me ensine Logaritmos passo a passo com perguntas"
- "Quero treinar meu conhecimento em História"

REGRAS DE BUSCA (CRÍTICO):
1. **NÃO REPETIR**: Se o usuário NÃO pedir explicitamente para repetir, você DEVE gerar uma query diferente das usadas anteriormente.
2. **QUERY LIMPA**: O campo 'conteudo' da busca deve conter APENAS PALAVRAS-CHAVE (Ex: "Ondulatória", "Função Afim"). NUNCA coloque a pergunta inteira ou frases longas.
3. **FILTROS**: Use Apenas 'institution', 'year', 'subject' se o usuário especificar.

REGRAS DE PESQUISA (PARA 'necessidade_pesquisa'):
1. **Fatos Reais**: Perguntas sobre quem é alguém, datas históricas, acontecimentos atuais, ou qualquer coisa que mude com o tempo.
2. **Temas Técnicos**: Quando o assunto é muito específico e exige precisão documental (leis, normas de saúde, artigos científicos).
3. **Prevenção de Alucinação**: Se o usuário pedir para você ensinar algo que você não "domina" 100% com dados internos, PESQUISE.
4. **Instrução**: No campo 'instrucao_pesquisa', escreva uma diretiva curta para a IA de busca (ex: "Buscar biografia de X", "Regras atuais do Y").

REGRAS GERAIS:
1. Se houver anexos de imagem/PDF, sempre classifique como ALTA
2. Se mencionar "questão", "exercício", "prova", "vestibular", classifique como ALTA
3. Se pedido explícito de "Verdadeiro ou Falso" ou "Treino interativo", classifique como ALTA mas adicione a flag: "scaffolding_detected": true
4. Na dúvida, classifique como ALTA (melhor ser conservador)
5. SEMPRE preencha 'metodologia_recomendada' com uma das opções listadas acima.
6. SEMPRE avalie se precisa de pesquisa. Se for algo puramente lógico ou criativo, mantenha como false.

FORMATO DE RESPOSTA (OBRIGATÓRIO):
Responda APENAS com um JSON válido seguindo este schema, sem markdown ou explicações adicionais fora do JSON:
${JSON.stringify(ROUTER_RESPONSE_SCHEMA, null, 2)}`;

/**
 * Gera o prompt para classificação
 * @param {string} userMessage - Mensagem do usuário
 * @param {boolean} hasAttachments - Se há anexos (imagens, PDFs, etc)
 * @param {string} memoryContext - Contexto de memória (opcional)
 * @param {Array<string>} previousQueries - Lista de queries já usadas na sessão
 * @returns {string} Prompt formatado
 */
export function buildRouterPrompt(
  userMessage,
  hasAttachments = false,
  memoryContext = "",
  previousQueries = [],
) {
  let prompt = `Analise a seguinte mensagem e classifique sua complexidade:

"${userMessage}"`;

  if (hasAttachments) {
    prompt += `

[NOTA: O usuário enviou arquivos anexos junto com a mensagem]`;
  }

  if (memoryContext) {
    prompt += `

[CONTEXTO DE MEMÓRIA (Use para desambiguação)]:
${memoryContext}`;
  }

  // INJEÇÃO ANTI-REPETIÇÃO
  if (previousQueries && previousQueries.length > 0) {
    prompt += `

[🚫 HISTÓRICO DE BUSCAS JÁ FEITAS (PROIBIDO REPETIR ESTES TERMOS EXATOS, A MENOS QUE O USUÁRIO PEÇA 'REPETIR')]:
${previousQueries.map((q) => `- "${q}"`).join("\n")}
Se o usuário pediu "mais uma" ou "outra", busque algo NOVO ou uma variação.`;
  }

  prompt += `

Responda com a classificação de complexidade.`;

  return prompt;
}
