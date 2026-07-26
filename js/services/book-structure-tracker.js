/**
 * BookStructureTracker - Gerenciador do Estado Estrutural e Acumulado de Livros Didáticos
 * Rastreia páginas especiais (capa, créditos, sumário), tópicos ativos e faixas de páginas.
 */
export class BookStructureTracker {
  constructor() {
    this.coversAndCredits = new Set();
    this.summaryPages = new Set();
    this.topics = new Map(); // id_topico -> object
    this.pageHistory = new Map(); // pageNum -> { pageType, topicIds }
    this.lastProcessedPage = 0;
  }

  /**
   * Reseta todo o estado do rastreador
   */
  reset() {
    this.coversAndCredits.clear();
    this.summaryPages.clear();
    this.topics.clear();
    this.pageHistory.clear();
    this.lastProcessedPage = 0;
  }

  /**
   * Registra o resultado da extração de uma página no estado global do livro
   */
  addPageExtraction(pageNum, extractionResult) {
    if (!extractionResult) return;
    this.lastProcessedPage = Math.max(this.lastProcessedPage, pageNum);

    const { tags = [], mapeamento_estrutura = [] } = extractionResult;
    const isCoverOrCredits =
      tags.includes('capa_ou_creditos') ||
      !mapeamento_estrutura ||
      mapeamento_estrutura.length === 0;

    if (isCoverOrCredits) {
      this.coversAndCredits.add(pageNum);
      this.pageHistory.set(pageNum, {
        pageType: 'capa_ou_creditos',
        topicIds: [],
      });
      return;
    }

    const activeTopicIds = [];
    let pageIsSummary = false;

    mapeamento_estrutura.forEach((item) => {
      if (!item || !item.id_topico) return;

      const topicId = String(item.id_topico).trim();

      if (item.is_sumario) {
        pageIsSummary = true;
        this.summaryPages.add(pageNum);
      }

      let topicRecord = this.topics.get(topicId);
      if (!topicRecord) {
        topicRecord = {
          id_topico: topicId,
          titulo_topico: item.titulo_topico || topicId,
          is_sumario: !!item.is_sumario,
          categoria: item.categoria || 'teoria',
          contentPages: new Set(),
          theoryPages: new Set(),
          exercisePages: new Set(),
        };
        this.topics.set(topicId, topicRecord);
      } else {
        if (item.titulo_topico) topicRecord.titulo_topico = item.titulo_topico;
        if (item.is_sumario) topicRecord.is_sumario = true;
        if (item.categoria) topicRecord.categoria = item.categoria;
      }

      // Se o assunto está sendo discutido NESTA página E NÃO É UMA PÁGINA DE SUMÁRIO
      if (item.this_page && !item.is_sumario) {
        activeTopicIds.push(topicId);
        topicRecord.contentPages.add(pageNum);
        if (item.categoria === 'exercicio') {
          topicRecord.exercisePages.add(pageNum);
        } else {
          topicRecord.theoryPages.add(pageNum);
        }
      }
    });

    this.pageHistory.set(pageNum, {
      pageType: pageIsSummary ? 'sumario' : 'conteudo',
      topicIds: activeTopicIds,
    });
  }

  /**
   * Helper para formatar conjunto de números em faixas legíveis (ex: [5,6,7,10] -> "5-7, 10")
   */
  formatPageRanges(pageSet) {
    if (!pageSet || pageSet.size === 0) return 'Nenhuma';
    const sorted = Array.from(pageSet).sort((a, b) => a - b);
    const ranges = [];
    let start = sorted[0];
    let end = start;

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        ranges.push(start === end ? `${start}` : `${start}-${end}`);
        start = sorted[i];
        end = start;
      }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    return `Páginas ${ranges.join(', ')}`;
  }

  /**
   * Gera a estrutura de contexto limpa e concisa para o prompt da IA ({{ESTRUTURA_ATUAL_DO_LIVRO}})
   * CRÍTICO: NÃO INCLUI "this_page: true" nos nós mestre!
   */
  toPromptContext() {
    const formattedTopics = Array.from(this.topics.values()).map((t) => {
      const theoryStr = this.formatPageRanges(t.theoryPages);
      const exerciseStr = this.formatPageRanges(t.exercisePages);
      const contentStr = this.formatPageRanges(t.contentPages);

      let detailPages = contentStr;
      if (t.theoryPages.size > 0 || t.exercisePages.size > 0) {
        const parts = [];
        if (t.theoryPages.size > 0) parts.push(`Teoria: ${theoryStr.replace('Páginas ', '')}`);
        if (t.exercisePages.size > 0) parts.push(`Exercício: ${exerciseStr.replace('Páginas ', '')}`);
        detailPages = `${contentStr} (${parts.join(', ')})`;
      }

      return {
        id_topico: t.id_topico,
        titulo_topico: t.titulo_topico,
        categoria_dominante: t.categoria,
        is_sumario: t.is_sumario,
        paginas_discutidas: detailPages,
      };
    });

    return {
      progresso: `Páginas 1 a ${this.lastProcessedPage} analisadas`,
      paginas_especiais: {
        capas_e_creditos: Array.from(this.coversAndCredits).sort((a, b) => a - b),
        sumario: Array.from(this.summaryPages).sort((a, b) => a - b),
      },
      topicos_detectados: formattedTopics,
    };
  }

  /**
   * Gera um resumo da árvore para inclusão nos metadados de indexação no Pinecone
   */
  getSummaryForIndexing() {
    const summaryLines = [];
    if (this.coversAndCredits.size > 0) {
      summaryLines.push(`Capas/Créditos: Páginas ${Array.from(this.coversAndCredits).join(', ')}`);
    }
    if (this.summaryPages.size > 0) {
      summaryLines.push(`Sumário: Páginas ${Array.from(this.summaryPages).join(', ')}`);
    }
    this.topics.forEach((t) => {
      summaryLines.push(
        `Tópico ${t.id_topico} (${t.titulo_topico}): ${this.formatPageRanges(t.contentPages)}`,
      );
    });
    return summaryLines.join(' | ');
  }
}

export const globalBookTracker = new BookStructureTracker();
