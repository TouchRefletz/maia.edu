/**
 * Schema JSON estrito para extração de páginas de livros didáticos via Gemini API (Structured Outputs)
 */
export const TEXTBOOK_PAGE_SCHEMA = {
  type: 'object',
  properties: {
    resumo: {
      type: 'string',
      description:
        'Texto massivo, exaustivo e longo descrevendo indiretamente parágrafo por parágrafo, gráficos e dados teóricos da página. É proibido transcrever texto literal.',
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Lista de conceitos-chave acadêmicos puros tratados na página.',
    },
    mapeamento_estrutura: {
      type: 'array',
      description:
        'Obrigatório apenas para páginas com tópicos, conteúdo ou sumário. Deve ser omitido para capas, páginas de créditos ou folhas vazias.',
      items: {
        type: 'object',
        properties: {
          id_topico: {
            type: 'string',
            description: 'O ID exato do tópico (ex: 1.1, 1.2).',
          },
          titulo_topico: {
            type: 'string',
            description: 'O nome textual do tópico por extenso.',
          },
          this_page: {
            type: 'boolean',
            description:
              'Marque true se o assunto está sendo discutido na página atual, false se não.',
          },
          is_sumario: {
            type: 'boolean',
            description:
              'Marque true se você estiver olhando para a página física do sumário/índice do livro, false se for página de conteúdo.',
          },
          categoria: {
            type: 'string',
            enum: ['teoria', 'exercicio'],
            description: 'Classificação rigorosa do tipo de conteúdo mapeado neste nó.',
          },
        },
        required: ['id_topico', 'titulo_topico', 'this_page', 'is_sumario', 'categoria'],
      },
    },
  },
  required: ['resumo', 'tags'],
};
