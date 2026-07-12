/**
 * Prompt e rubrica do sistema de avaliação cruzada (LLM-as-a-Judge)
 * Reestruturado para Validação Factual Binária com Mascaramento de Pesos (Weight Blinding)
 * e suporte a critérios interdisciplinares (FUVEST) e pontuações por grupo.
 */

export function getJudgeSystemPrompt(isInterdisciplinary = false) {
  const fuvestSection = `
[GRUPO F - INTEGRAÇÃO INTERDISCIPLINAR (EXCLUSIVO FUVEST)]
# Peso 1: Estrutura Básica e Identificação (1 ponto cada)
35. mencao_nominal_disciplinas: A resposta nomeia explicitamente as disciplinas envolvidas na interface da questão?
36. presenca_conectivos_interdisciplinares: O texto utiliza conectivos de transição entre os blocos de conteúdo das diferentes matérias (ex: "sob a ótica química", "analisando historicamente")?
37. indicacao_natureza_mista: A resposta declara explicitamente no início ou na introdução que a resolução exige uma abordagem integrada das duas áreas?

# Peso 2: Ancoragem e Premissas das Áreas (2 pontos cada)
38. mapeamento_premissas_area_A: O texto isola e lista claramente os dados ou conceitos pertencentes à primeira disciplina envolvida?
39. mapeamento_premissas_area_B: O texto isola e lista claramente os dados ou conceitos pertencentes à segunda disciplina envolvida?
40. identificacao_objeto_ponte: A resposta aponta o objeto central (um texto, um gráfico, um fenômeno) que serve de base comum para as duas matérias?

# Peso 3: Didática e Transposição da Interface (3 pontos cada)
41. linguagem_acessivel_interface: O texto explica a interseção entre as duas disciplinas de forma direta, sem jargões acadêmicos herméticos, mantendo-se adequado ao ensino médio?
42. recurso_didatico_analogia_cruzada: A resposta constrói uma analogia ou metáfora que conecta elements de ambas as disciplinas para reduzir a carga cognitiva?
43. segmentacao_funcional_da_ponte: Existe um parágrafo ou bloco dedicado exclusivamente a explicar o ponto de contato teórico das disciplinas, sem misturá-lo com a refutação?

# Peso 4: Lógica Dedutiva e Eliminação Complexa (4 pontos cada)
44. ausencia_de_justaposicao_vazia: O texto evita resolver a questão em blocos totalmente separados (ex: resolve tudo de uma matéria e depois tudo da outra) sem criar conexões entre eles?
45. mecanismo_do_erro_interdisciplinar: A desconstrução de ao menos um distrator explica que o erro da alternativa ocorre por uma falsa relação estabelecida entre as duas áreas?
46. ausencia_de_saltos_logicos_na_interface: A transição lógica entre o raciocínio da Disciplina A e da Disciplina B ocorre de forma contínua, sem omitir etapas explicativas?

# Peso 5: Fusão Conceitual e Engenharia Analítica (5 pontos cada)
47. nexo_causal_interdisciplinar_formal: A resposta demonstra formalmente uma relação de causa e efeito onde um fenômeno da Área A altera ou explica diretamente uma variável da Área B?
48. fusao_conceitual_resolutiva: A dedução do gabarito correto depende obrigatoriamente da aplicação simultânea e indissociável de conceitos de ambas as disciplinas?
49. ausencia_de_alucinacao_cientifica_cruzada: A ponte teórica estabelecida entre as duas matérias é cientificamente válida e totalmente sustentada, sem inventar relações falsas?
50. independencia_da_memoria_parametrica_cruzada: O encadeamento prova textualmente que a lógica da interface se sustentaria mesmo se os dados ou os nomes do enunciado fossem alterados?
`;

  return `Você é um auditor acadêmico rigoroso, frio e imparcial de respostas para questões de vestibular brasileiro. Sua tarefa é avaliar uma resposta produzida por uma IA com base exclusivamente nos materiais fornecidos: 1. enunciado da questão; 2. gabarito ou resposta de referência; 3. resposta da IA avaliada.

IMPORTANTE:
• Não tente adivinhar qual modelo gerou a resposta.
• Não favoreça estilo, extensão ou sofisticação verbal. Uma resposta curta, direta e correta é o objetivo.
• Avalie apenas a qualidade real da resposta com base estritamente nas evidências textuais da resposta fornecida.
• Não use conhecimento externo quando ele não estiver sustentado pelo enunciado, pelo gabarito ou pela própria resposta.
• Você deve avaliar a resposta de forma fria e cética.
• Para cada um dos critérios a seguir, você deve definir "presente" como true apenas se houver evidência textual explícita do item na resposta avaliada. Se o item estiver ausente, for apenas cosmético ou sem conteúdo real correspondente, marque como false.
• Não seja benevolente: na dúvida, ou se a evidência for fraca ou puramente cosmética, marque false.

### CRITÉRIOS DE AVALIAÇÃO (CHECKLIST BINÁRIO)

[GRUPO A - ESTRUTURA E ESTÉTICA BÁSICA]
1. declaracao_gabarito_indica_letra: A resposta indica explicitamente a letra da alternativa correta logo na abertura ou no encerramento?
2. presenca_formatacao_negrito: O texto utiliza marcadores de negrito (**) de forma cirúrgica para destacar palavras-chave?
3. divisao_minima_paragrafos: O texto é distribuído fisicamente em pelo menos 3 blocos ou parágrafos distintos?
4. presenca_titulo_ou_cabecalho: A resposta utiliza cabeçalhos hierárquicos em Markdown (#, ##, ###) ou chaves/blocos estruturados de título/cabeçalho no JSON (ex: "tipo": "titulo") para organizar as seções?
5. uso_de_listas_ou_topicos: O texto emprega listas com marcadores (-, * ou números) para detalhar as informações?
6. ausencia_de_tags_corrompidas: O output gerado está livre de blocos de código Markdown vazios ou marcações JSON quebradas?
7. presenca_de_conclusao_clara: Existe uma seção ou parágrafo final dedicado unicamente a resumir o fechamento da questão?

[GRUPO B - ANCORAGEM FACTUAL E INTERPRETAÇÃO]
8. citacao_direta_texto_apoio: A resposta transcreve pelo menos um trecho ou frase literal contida no texto de apoio fornecido?
9. mencao_ao_comando_pergunta: O texto menciona explicitamente a pergunta central do comando ou a restrição imposta pelo enunciado?
10. isolamento_dados_quantitativos: A resposta isola e lista individualmente dados numéricos, unidades ou datas relevantes? (Marcar true se a questão for puramente textual).
11. ausencia_extrapolacao_hipotetica: O texto se mantém estritamente dentro dos limites factuais do enunciado, sem inventar dados externos?
12. parafrase_fiel_das_premissas: As afirmações feitas sobre as ideias do autor refletem fielmente o sentido original do texto de apoio?
13. mencao_a_fontes_ou_rodape: A resposta faz menção à fonte, autor ou veículo de publicação indicados na nota de rodapé? (Marcar true se não houver rodapé).
14. leitura_de_elementos_visuais: Se a questão possuir tabelas, gráficos ou imagens, a resposta cita ou analisa esses dados diretamente? (Marcar true se não houver imagem).

[GRUPO C - PEDAGOGIA E TRANSPOSIÇÃO COGNITIVA]
15. passo_a_passo_cronologico: A explicação segue um roteiro linear e progressivo de aprendizado (ex: do mapeamento de dados até a conclusão)?
16. linguagem_acessivel_ensino_medio: O vocabulário utilizado evita prolixidades acadêmicas desnecessárias, mantendo-se adequado para o ensino médio?
17. presenca_de_exemplos_praticos: O texto introduz um exemplo de aplicação prática para consolidar o entendimento do conceito tratado?
18. ausencia_de_redundancia_vazia: A resposta é concisa e evita repetir a mesma justificativa várias vezes usando sinônimos (baixa enrolação)?
19. definicao_de_termos_chave: A resposta conceitua ou define explicitamente o significado do objeto central cobrado (ex: o que são jargões corporativos, o que é a lei X)?
20. segmentacao_funcional_do_texto: Cada seção de texto cumpre um papel pedagógico exclusivo e bem delimitado, sem misturar tópicos?
21. recurso_visual_de_destaque: São utilizados recursos visuais especiais (como emojis explicativos, blocos de citação > ou caixas de destaque) para quebrar a densidade da leitura?

[GRUPO D - LOGICA DEDUTIVA E ELIMINAÇÃO]
22. analise_isolada_distrator_A: A alternativa A (quando incorreta) é analisada e refutada em um espaço físico isolado do texto?
23. analise_isolada_distrator_B: A alternativa B (quando incorreta) é analisada e refutada em um espaço físico isolado do texto?
24. analise_isolada_distrator_C: A alternativa C (quando incorreta) é analisada e refutada em um espaço físico isolado do texto?
25. analise_isolada_distrator_restante: O distrator restante aplicável (D ou E) é analisado e refutada em um espaço físico isolado do texto?
26. conexao_causal_premissa_conclusao: A resposta demonstra formalmente o nexo causal que liga os indícios do texto de apoio ao gabarito correto?
27. ausencia_de_saltos_logicos: A cadeia de resolução avança de forma contínua, sem omitir etapas intermediárias de raciocínio ou cálculo?
28. ausencia_de_raciocinio_circular: O modelo evita justificativas vazias ou tautológicas (ex: "a alternativa está incorreta porque não está certa")?

[GRUPO E - ENGENHARIA DA RESOLUÇÃO E INTERFACES]
29. aplicacao_nominal_arcabouco_teorico: A resposta nomeia e aplica explicitamente uma lei científica, teoria linguística de dicionário, escola literária formal ou arcabouço formal da matéria (ex: variação sociolinguística, pragmática, funções da linguagem), indo além de uma leitura superficial?
30. mecanismo_do_erro_nos_distratores: A eliminação de ao menos dois distratores desconstrói a lógica da alternativa, explicando o motivo conceitual do erro (por que a pegadinha parece certa, mas falha), em vez de apenas usar negação gramatical passiva (como "o texto não fala disso")?
31. independencia_da_memoria_parametrica: O encadeamento lógico prova textualmente que a resposta foi deduzida a partir da análise do contexto atual (mostrando que a lógica se sustentaria mesmo se os valores ou nomes do enunciado fossem trocados)?
32. metodologia_de_resolucao_explicita: A IA tutora declara ou adota uma metodologia pedagógica explícita de resolução de problemas (como metas de aprendizado ou o bloco adaptado de scaffolding socrático interativo)?
33. otimizacao_semantica_para_interface: A informação está organizada em blocos de dados semânticos limpos e modulares, otimizados para renderização direta em interfaces mobile/web sem exigir leitura linear de parágrafos extensos?
34. recurso_didatico_avancado_analogia: A resposta constrói uma analogia conceitual, metáfora estruturada ou modelo prático comparativo focado em reduzir drasticamente a carga cognitiva do estudante ao fixar o conceito complexo (ex: comparar padrões de linguagem a uma "roupa verbal")?
${isInterdisciplinary ? fuvestSection : ''}

ADAPTAÇÃO ARQUITETURAL PARA CÓDIGO (RETORNO EM JSON):
Você deve retornar estritamente um objeto JSON válido, sem blocos markdown ou texto adicional, com o formato especificado no response_schema.
`;
}

export const JUDGE_SYSTEM_PROMPT = getJudgeSystemPrompt(false);

export const JUDGE_RUBRIC = ``;

export function getJudgeResponseSchema(isInterdisciplinary = false) {
  const criteriosProperties = {
    declaracao_gabarito_indica_letra: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string", description: "Evidência literal." } }, required: ["presente", "evidencia"] },
    presenca_formatacao_negrito: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string", description: "Evidência literal." } }, required: ["presente", "evidencia"] },
    divisao_minima_paragrafos: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string", description: "Evidência literal." } }, required: ["presente", "evidencia"] },
    presenca_titulo_ou_cabecalho: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string", description: "Evidência literal." } }, required: ["presente", "evidencia"] },
    uso_de_listas_ou_topicos: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string", description: "Evidência literal." } }, required: ["presente", "evidencia"] },
    ausencia_de_tags_corrompidas: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string", description: "Evidência literal." } }, required: ["presente", "evidencia"] },
    presenca_de_conclusao_clara: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string", description: "Evidência literal." } }, required: ["presente", "evidencia"] },
    citacao_direta_texto_apoio: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string", description: "Evidência literal." } }, required: ["presente", "evidencia"] },
    mencao_ao_comando_pergunta: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string", description: "Evidência literal." } }, required: ["presente", "evidencia"] },
    isolamento_dados_quantitativos: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string", description: "Evidência literal." } }, required: ["presente", "evidencia"] },
    ausencia_extrapolacao_hipotetica: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string", description: "Evidência literal." } }, required: ["presente", "evidencia"] },
    parafrase_fiel_das_premissas: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string", description: "Evidência literal." } }, required: ["presente", "evidencia"] },
    mencao_a_fontes_ou_rodape: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string", description: "Evidência literal." } }, required: ["presente", "evidencia"] },
    leitura_de_elementos_visuais: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string", description: "Evidência literal." } }, required: ["presente", "evidencia"] },
    passo_a_passo_cronologico: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string", description: "Evidência literal." } }, required: ["presente", "evidencia"] },
    linguagem_acessivel_ensino_medio: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string", description: "Evidência literal." } }, required: ["presente", "evidencia"] },
    presenca_de_exemplos_praticos: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string", description: "Evidência literal." } }, required: ["presente", "evidencia"] },
    ausencia_de_redundancia_vazia: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string", description: "Evidência literal." } }, required: ["presente", "evidencia"] },
    definicao_de_termos_chave: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string", description: "Evidência literal." } }, required: ["presente", "evidencia"] },
    segmentacao_funcional_do_texto: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string", description: "Evidência literal." } }, required: ["presente", "evidencia"] },
    recurso_visual_de_destaque: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string", description: "Evidência literal." } }, required: ["presente", "evidencia"] },
    analise_isolada_distrator_A: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string", description: "Evidência literal." } }, required: ["presente", "evidencia"] },
    analise_isolada_distrator_B: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
    analise_isolada_distrator_C: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
    analise_isolada_distrator_restante: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
    conexao_causal_premissa_conclusao: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
    ausencia_de_saltos_logicos: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
    ausencia_de_raciocinio_circular: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
    aplicacao_nominal_arcabouco_teorico: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
    mecanismo_do_erro_nos_distratores: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
    independencia_da_memoria_parametrica: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
    metodologia_de_resolucao_explicita: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
    otimizacao_semantica_para_interface: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
    recurso_didatico_avancado_analogia: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] }
  };

  const requiredCriterios = [
    "declaracao_gabarito_indica_letra", "presenca_formatacao_negrito", "divisao_minima_paragrafos",
    "presenca_titulo_ou_cabecalho", "uso_de_listas_ou_topicos", "ausencia_de_tags_corrompidas",
    "presenca_de_conclusao_clara", "citacao_direta_texto_apoio", "mencao_ao_comando_pergunta",
    "isolamento_dados_quantitativos", "ausencia_extrapolacao_hipotetica", "parafrase_fiel_das_premissas",
    "mencao_a_fontes_ou_rodape", "leitura_de_elementos_visuais", "passo_a_passo_cronologico",
    "linguagem_acessivel_ensino_medio", "presenca_de_exemplos_praticos", "ausencia_de_redundancia_vazia",
    "definicao_de_termos_chave", "segmentacao_funcional_do_texto", "recurso_visual_de_destaque",
    "analise_isolada_distrator_A", "analise_isolada_distrator_B", "analise_isolada_distrator_C",
    "analise_isolada_distrator_restante", "conexao_causal_premissa_conclusao", "ausencia_de_saltos_logicos",
    "ausencia_de_raciocinio_circular", "aplicacao_nominal_arcabouco_teorico", "mecanismo_do_erro_nos_distratores",
    "independencia_da_memoria_parametrica", "metodologia_de_resolucao_explicita", "otimizacao_semantica_para_interface",
    "recurso_didatico_avancado_analogia"
  ];

  if (isInterdisciplinary) {
    const interdisciplinaresProperties = {
      mencao_nominal_disciplinas: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
      presenca_conectivos_interdisciplinares: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
      indicacao_natureza_mista: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
      mapeamento_premissas_area_A: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
      mapeamento_premissas_area_B: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
      identificacao_objeto_ponte: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
      linguagem_acessivel_interface: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
      recurso_didatico_analogia_cruzada: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
      segmentacao_funcional_da_ponte: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
      ausencia_de_justaposicao_vazia: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
      mecanismo_do_erro_interdisciplinar: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
      ausencia_de_saltos_logicos_na_interface: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
      nexo_causal_interdisciplinar_formal: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
      fusao_conceitual_resolutiva: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
      ausencia_de_alucinacao_cientifica_cruzada: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] },
      independencia_da_memoria_parametrica_cruzada: { type: "object", properties: { presente: { type: "boolean" }, evidencia: { type: "string" } }, required: ["presente", "evidencia"] }
    };

    const interdisciplinaresRequired = [
      "mencao_nominal_disciplinas", "presenca_conectivos_interdisciplinares", "indicacao_natureza_mista",
      "mapeamento_premissas_area_A", "mapeamento_premissas_area_B", "identificacao_objeto_ponte",
      "linguagem_acessivel_interface", "recurso_didatico_analogia_cruzada", "segmentacao_funcional_da_ponte",
      "ausencia_de_justaposicao_vazia", "mecanismo_do_erro_interdisciplinar", "ausencia_de_saltos_logicos_na_interface",
      "nexo_causal_interdisciplinar_formal", "fusao_conceitual_resolutiva", "ausencia_de_alucinacao_cientifica_cruzada",
      "independencia_da_memoria_parametrica_cruzada"
    ];

    Object.assign(criteriosProperties, interdisciplinaresProperties);
    requiredCriterios.push(...interdisciplinaresRequired);
  }

  return {
    type: "object",
    properties: {
      criterios: {
        type: "object",
        properties: criteriosProperties,
        required: requiredCriterios
      },
      comentario_geral: { type: "string" }
    },
    required: ["criterios", "comentario_geral"]
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
A questão é do tipo: ${isInterdisciplinary ? "FUVEST/INTERDISCIPLINAR" : "ENEM PADRÃO"}.
`;
}

/**
 * Pesos ocultos para questões padrão (itens 1 a 34).
 */
export const PESOS_PADRAO = {
  "declaracao_gabarito_indica_letra": 1,
  "presenca_formatacao_negrito": 1,
  "divisao_minima_paragrafos": 1,
  "presenca_titulo_ou_cabecalho": 1,
  "uso_de_listas_ou_topicos": 1,
  "ausencia_de_tags_corrompidas": 1,
  "presenca_de_conclusao_clara": 1,
  "citacao_direta_texto_apoio": 2,
  "mencao_ao_comando_pergunta": 2,
  "isolamento_dados_quantitativos": 2,
  "ausencia_extrapolacao_hipotetica": 2,
  "parafrase_fiel_das_premissas": 2,
  "mencao_a_fontes_ou_rodape": 2,
  "leitura_de_elementos_visuais": 2,
  "passo_a_passo_cronologico": 3,
  "linguagem_acessivel_ensino_medio": 3,
  "presenca_de_exemplos_praticos": 3,
  "ausencia_de_redundancia_vazia": 3,
  "definicao_de_termos_chave": 3,
  "segmentacao_funcional_do_texto": 3,
  "recurso_visual_de_destaque": 3,
  "analise_isolada_distrator_A": 4,
  "analise_isolada_distrator_B": 4,
  "analise_isolada_distrator_C": 4,
  "analise_isolada_distrator_restante": 4,
  "conexao_causal_premissa_conclusao": 4,
  "ausencia_de_saltos_logicos": 4,
  "ausencia_de_raciocinio_circular": 4,
  "aplicacao_nominal_arcabouco_teorico": 5,
  "mecanismo_do_erro_nos_distratores": 5,
  "independencia_da_memoria_parametrica": 5,
  "metodologia_de_resolucao_explicita": 5,
  "otimizacao_semantica_para_interface": 5,
  "recurso_didatico_avancado_analogia": 5
};

/**
 * Pesos ocultos para questões interdisciplinares (itens 35 a 50).
 */
export const PESOS_INTERDISCIPLINARES = {
  "mencao_nominal_disciplinas": 1,
  "presenca_conectivos_interdisciplinares": 1,
  "indicacao_natureza_mista": 1,
  "mapeamento_premissas_area_A": 2,
  "mapeamento_premissas_area_B": 2,
  "identificacao_objeto_ponte": 2,
  "linguagem_acessivel_interface": 3,
  "recurso_didatico_analogia_cruzada": 3,
  "segmentacao_funcional_da_ponte": 3,
  "ausencia_de_justaposicao_vazia": 4,
  "mecanismo_do_erro_interdisciplinar": 4,
  "ausencia_de_saltos_logicos_na_interface": 4,
  "nexo_causal_interdisciplinar_formal": 5,
  "fusao_conceitual_resolutiva": 5,
  "ausencia_de_alucinacao_cientifica_cruzada": 5,
  "independencia_da_memoria_parametrica_cruzada": 5
};

/**
 * Calcula a nota normalizada baseada na checagem cega de presença binária.
 */
export function calcularNotaBlinded(criteriosJSON, isInterdisciplinary = false) {
  let pontuacaoTotal = 0;

  for (const chave in PESOS_PADRAO) {
    if (criteriosJSON[chave] && (criteriosJSON[chave].presente === true || criteriosJSON[chave].presente === "true")) {
      pontuacaoTotal += PESOS_PADRAO[chave];
    }
  }

  if (isInterdisciplinary) {
    for (const chave in PESOS_INTERDISCIPLINARES) {
      if (criteriosJSON[chave] && (criteriosJSON[chave].presente === true || criteriosJSON[chave].presente === "true")) {
        pontuacaoTotal += PESOS_INTERDISCIPLINARES[chave];
      }
    }
  }

  return pontuacaoTotal;
}

/**
 * Pós-processa o JSON de avaliação, calculando a nota total e os valores de cada
 * grupo pedagógico no código de execução de forma separada.
 */
export function processarAvaliacaoJuiz(avaliacaoJSON, isInterdisciplinary = false) {
  if (!avaliacaoJSON || !avaliacaoJSON.criterios) {
    return avaliacaoJSON;
  }

  const criterios = avaliacaoJSON.criterios;
  const check = (key) => (criterios[key] && (criterios[key].presente === true || criterios[key].presente === "true")) ? 1 : 0;

  // Calculo dos grupos A a E
  const grupoA = 
    check("declaracao_gabarito_indica_letra") * 1 +
    check("presenca_formatacao_negrito") * 1 +
    check("divisao_minima_paragrafos") * 1 +
    check("presenca_titulo_ou_cabecalho") * 1 +
    check("uso_de_listas_ou_topicos") * 1 +
    check("ausencia_de_tags_corrompidas") * 1 +
    check("presenca_de_conclusao_clara") * 1;

  const grupoB = 
    check("citacao_direta_texto_apoio") * 2 +
    check("mencao_ao_comando_pergunta") * 2 +
    check("isolamento_dados_quantitativos") * 2 +
    check("ausencia_extrapolacao_hipotetica") * 2 +
    check("parafrase_fiel_das_premissas") * 2 +
    check("mencao_a_fontes_ou_rodape") * 2 +
    check("leitura_de_elementos_visuais") * 2;

  const grupoC = 
    check("passo_a_passo_cronologico") * 3 +
    check("linguagem_acessivel_ensino_medio") * 3 +
    check("presenca_de_exemplos_praticos") * 3 +
    check("ausencia_de_redundancia_vazia") * 3 +
    check("definicao_de_termos_chave") * 3 +
    check("segmentacao_funcional_do_texto") * 3 +
    check("recurso_visual_de_destaque") * 3;

  const grupoD = 
    check("analise_isolada_distrator_A") * 4 +
    check("analise_isolada_distrator_B") * 4 +
    check("analise_isolada_distrator_C") * 4 +
    check("analise_isolada_distrator_restante") * 4 +
    check("conexao_causal_premissa_conclusao") * 4 +
    check("ausencia_de_saltos_logicos") * 4 +
    check("ausencia_de_raciocinio_circular") * 4;

  const grupoE = 
    check("aplicacao_nominal_arcabouco_teorico") * 5 +
    check("mecanismo_do_erro_nos_distratores") * 5 +
    check("independencia_da_memoria_parametrica") * 5 +
    check("metodologia_de_resolucao_explicita") * 5 +
    check("otimizacao_semantica_para_interface") * 5 +
    check("recurso_didatico_avancado_analogia") * 5;

  const notasGrupo = {
    grupo_a: grupoA,
    grupo_b: grupoB,
    grupo_c: grupoC,
    grupo_d: grupoD,
    grupo_e: grupoE
  };

  if (isInterdisciplinary) {
    let grupoF = 0;
    for (const chave in PESOS_INTERDISCIPLINARES) {
      if (criterios[chave] && (criterios[chave].presente === true || criterios[chave].presente === "true")) {
        grupoF += PESOS_INTERDISCIPLINARES[chave];
      }
    }
    notasGrupo.grupo_f = grupoF;
  }

  avaliacaoJSON.pontuacao_total = calcularNotaBlinded(criterios, isInterdisciplinary);
  avaliacaoJSON.notas_grupo = notasGrupo;

  return avaliacaoJSON;
}

