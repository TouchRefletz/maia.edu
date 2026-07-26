import {
  gerarConteudoEmJSONComImagemStream,
  gerarEmbedding,
  upsertPineconeWorker,
} from '../api/worker.js';
import { TEXTBOOK_PAGE_SCHEMA } from './textbook-schema.js';

export function buildCoreVisionPrompt(context = {}) {
  const { prevPage1Metadata, prevPage2Metadata, bookTracker, currentBookTree } = context;

  let treeStructureContext = [];
  if (bookTracker && typeof bookTracker.toPromptContext === 'function') {
    treeStructureContext = bookTracker.toPromptContext();
  } else if (Array.isArray(currentBookTree)) {
    // Sanitização de segurança: remove o campo 'this_page' de nós mestre da árvore global
    treeStructureContext = currentBookTree.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const { this_page, ...cleanItem } = item;
      return cleanItem;
    });
  } else {
    treeStructureContext = currentBookTree || [];
  }

  let prompt = `Você é o Core Vision Neural Module do ecossistema Maia.edu.
Sua tarefa é analisar a imagem da página atual de um livro didático e mapear seu conteúdo de forma estritamente alinhada à estrutura real do livro, sem inventar caminhos.

========================================================================
[DADOS INJETADOS PELO SISTEMA - CONTEXTO DISPONÍVEL]
========================================================================
O sistema rastreia o progresso do livro e injeta as seguintes informações como sua única linha do tempo da verdade:

1. METADADOS DA PÁGINA N-1 (Anterior imediata):
${JSON.stringify(prevPage1Metadata || {}, null, 2)}

2. METADADOS DA PÁGINA N-2 (Duas páginas atrás):
${JSON.stringify(prevPage2Metadata || {}, null, 2)}

3. ÁRVORE ESTRUTURAL DO LIVRO DETECTADA ATÉ O MOMENTO:
${JSON.stringify(treeStructureContext, null, 2)}

========================================================================
[DIRETRIZES DE ORIENTAÇÃO E LIMITES DE RESPOSTA]
========================================================================
Para evitar alucinações, você deve seguir este mapa de permissões rígido:
- Você só pode marcar "this_page": true em tópicos que já existem na [ÁRVORE ESTRUTURAL DO LIVRO] ou que você acabou de ler em uma página legítima de sumário.
- Se as páginas N-1 e N-2 estavam tratando do tópico "X" e o fluxo de texto continua o mesmo sem títulos novos, você é obrigado a deduzir que o assunto continua ativo.
- Você está proibido de criar ou referenciar tópicos se estiver olhando para páginas de transição, capas ou folhas de créditos.

========================================================================
[REGRAS DE PREENCHIMENTO DOS CAMPOS]
========================================================================
1. "resumo" (MÁXIMA DENSIDADE E EXTENSÃO):
- Escreva um resumo extremamente longo, massivo e exaustivo de tudo o que a página aborda.
- É EXPRESSAMENTE PROIBIDO transcrever trechos de texto palavra por palavra. Descreva tudo de forma 100% indireta.
- Mapeie a progressão: detalhe quantos parágrafos a página tem e o foco conceitual de cada um deles. Descreva exaustivamente elementos visuais, gráficos, tabelas, boxes de curiosidades ou equações (explicando o que as variáveis representam em prosa).

2. "tags":
- Array de strings contendo os conceitos-chave acadêmicos puros tratados na página (ex: ["gimnospermas", "polinizacao"]).

3. "mapeamento_estrutura" (CONDICIONAL E RÍGIDO):
- CENÁRIO 1: CAPA, CONTRACAPA, PÁGINAS DE CRÉDITOS, AUTORES OU DIAGRAMAÇÕES VAZIAS
  Regra Absoluta: Remova o campo completamente do JSON de retorno. Devolva apenas "resumo" e "tags": ["capa_ou_creditos"].
- CENÁRIO 2: PÁGINAS DE CONTEÚDO (TEORIA/EXERCÍCIO) OU PÁGINAS DE SUMÁRIO
  Regra Absoluta: O campo "mapeamento_estrutura" torna-se OBRIGATÓRIO e deve conter os nós do tópico com id_topico, titulo_topico, this_page, is_sumario e categoria ("teoria" ou "exercicio").
`;

  return prompt;
}

/**
 * Helper para construir o link do arquivo no Hugging Face
 */
export function getHuggingFaceBookUrl(slug, filename) {
  if (!slug || !filename) return null;
  return `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/output/${slug}/files/${filename}`;
}

/**
 * Extrai o conteúdo teórico de uma página de livro didático usando Core Vision e salva no Pinecone
 */
export async function extractTextbookPage(imageBase64, bookId, pageNum, context = {}, model = null) {
  const prompt = buildCoreVisionPrompt(context);
  let selectedModel =
    model ||
    window.selectedModelScannerDetect ||
    localStorage.getItem('selectedModelScannerDetect') ||
    'models/gemini-3.5-flash';

  if (!selectedModel.includes('/') && !selectedModel.startsWith('models/')) {
    selectedModel = `models/${selectedModel}`;
  }

  console.log(
    `[TextbookExtractor] Processando página ${pageNum} do livro ${bookId} com modelo ${selectedModel}...`,
  );

  const { SidebarPageManager } = await import('../ui/sidebar-page-manager.js');

  const result = await gerarConteudoEmJSONComImagemStream(
    prompt,
    TEXTBOOK_PAGE_SCHEMA,
    [imageBase64],
    'image/jpeg',
    {
      onThought: (text) =>
        SidebarPageManager.updateAgentStatus(pageNum, 'analysis', `Pensando: ${text}`),
      onStatus: (text) => {
        let statusMsg = text;
        if (typeof statusMsg === 'string' && /^🤖?\s*modelo:/i.test(statusMsg.trim())) {
          const modelName = statusMsg.replace(/^🤖?\s*modelo:\s*/i, '').trim();
          statusMsg = `Gerando resposta com o modelo ${modelName}...`;
        }
        SidebarPageManager.updateAgentStatus(pageNum, 'analysis', statusMsg);
      },
    },
    {
      model: selectedModel,
    },
  );

  if (!result || !result.resumo) {
    throw new Error(`Falha ao gerar extração teórica para a página ${pageNum}`);
  }

  return result;
}

/**
 * Indexa no Pinecone (namespace 'theory') o livro completo + cada página individualmente.
 * Executado APENAS ao finalizar/sincronizar a extração do livro.
 */
export async function indexBookInPinecone(bookId, pagesData = {}, extraMetadata = {}) {
  const sanitizeKey = (key) => key.replace(/[.#$/[\]]/g, '_');
  const sanitizedBook = sanitizeKey(bookId);
  const hfUrl =
    extraMetadata.hf_url ||
    (typeof window !== 'undefined' && (window.__pdfOriginalUrl || window.__pdfDownloadUrl)) ||
    getHuggingFaceBookUrl(extraMetadata.slug || sanitizedBook, extraMetadata.filename);

  if (!hfUrl || !hfUrl.trim()) {
    throw new Error('Sincronização cancelada: O Livro Didático não possui hf_url válido configurado no Hugging Face.');
  }

  const vectorsToUpsert = [];
  const pageEntries = Object.entries(pagesData);

  if (pageEntries.length === 0) {
    console.warn(`[TextbookExtractor] Nenhum dado de página para indexar o livro ${sanitizedBook}.`);
    return;
  }

  const allTagsSet = new Set();
  const summaryParts = [];

  // 1. Criar vetores para cada página separadamente (type: 'page')
  for (const [pageNumStr, pageResult] of pageEntries) {
    if (!pageResult) continue;
    const pageNum = parseInt(pageNumStr, 10);
    const tags = pageResult.tags || [];
    tags.forEach((t) => allTagsSet.add(t));

    const resumo = pageResult.resumo || '';
    if (resumo) {
      summaryParts.push(`[Página ${pageNum}]: ${resumo}`);
    }

    const textToEmbed = `${tags.join(' ')} ${resumo}`.trim();
    if (!textToEmbed) {
      console.warn(`[TextbookExtractor] Página ${pageNum} não possui texto/resumo para gerar embedding. Pulando...`);
      continue;
    }

    const category =
      (pageResult.mapeamento_estrutura && pageResult.mapeamento_estrutura[0]?.categoria) || 'teoria';

    try {
      const vetorPage = await gerarEmbedding(textToEmbed);
      if (vetorPage) {
        vectorsToUpsert.push({
          id: `${sanitizedBook}--pagina_${pageNum}`,
          values: vetorPage,
          metadata: {
            book_id: sanitizedBook,
            categoria: category,
            pageNum: pageNum,
            resumo: resumo,
            tags: tags.join(','),
            hf_url: hfUrl || '',
            type: 'page',
          },
        });
      }
    } catch (err) {
      console.warn(`[TextbookExtractor] Erro ao gerar embedding para página ${pageNum}:`, err);
    }
  }

  // 2. Criar vetor para o LIVRO TODO (type: 'book')
  const allTagsList = Array.from(allTagsSet);
  const fullSummaryText = summaryParts.join('\n');
  const bookCombinedText = `Livro: ${sanitizedBook} Tags: ${allTagsList.join(' ')}\nResumo Geral:\n${fullSummaryText}`;

  try {
    // Limita o texto para gerar embedding aos primeiros 8000 caracteres
    const vetorBook = await gerarEmbedding(bookCombinedText.slice(0, 8000));
    if (vetorBook) {
      vectorsToUpsert.push({
        id: `${sanitizedBook}--full`,
        values: vetorBook,
        metadata: {
          book_id: sanitizedBook,
          categoria: 'teoria',
          resumo_geral: fullSummaryText,
          tags: allTagsList.join(','),
          total_paginas: pageEntries.length,
          hf_url: hfUrl || '',
          type: 'book',
        },
      });
    }
  } catch (err) {
    console.warn(`[TextbookExtractor] Erro ao gerar embedding do livro completo:`, err);
  }

  // 3. Upsert no Pinecone (target 'livros')
  if (vectorsToUpsert.length > 0) {
    await upsertPineconeWorker(vectorsToUpsert, 'theory', 'livros');
    console.log(
      `[TextbookExtractor] Livro ${sanitizedBook} indexado com sucesso no Pinecone (index: livros, namespace: theory) (${vectorsToUpsert.length} vetores: 1 livro completo + ${vectorsToUpsert.length - 1} páginas).`,
    );
  }
}
