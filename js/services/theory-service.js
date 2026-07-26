import { gerarEmbedding, queryPineconeWorker, getProxyPdfUrl } from '../api/worker.js';

function desanitizarID(encoded) {
  if (!encoded) return '';
  // IDs planos legíveis (ex: livro-123, pagina_22) não precisam de decode Base64
  if (/^(livro|pagina|book|page)[\-_]/i.test(encoded)) {
    return encoded;
  }
  try {
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return decodeURIComponent(escape(atob(base64)));
  } catch (_) {
    return encoded;
  }
}

export async function trySearchTheory(vector, filters = {}) {
  const pineconeFilter = {};

  if (filters.book_id) {
    pineconeFilter.book_id = filters.book_id;
  }

  if (filters.categorias && filters.categorias.length > 0) {
    pineconeFilter.categoria = { $in: filters.categorias };
  }

  const resultados = await queryPineconeWorker(
    vector,
    1,
    pineconeFilter,
    'livros', // Index isolado 'livros' no Pinecone
    'theory', // Namespace isolado 'theory'
  );

  if (resultados && resultados.matches && resultados.matches.length > 0) {
    return resultados.matches[0];
  }

  return null;
}

export async function findBestTheory(filtros = {}, options = {}) {
  const { termos = [], categorias = [], filtrar_livro } = filtros;
  console.log('📖 [TheoryService] Iniciando busca de teoria no Pinecone (Index: livros):', filtros);

  // Checa trava de bloqueio do Administrador
  const isSearchBlocked =
    typeof localStorage !== 'undefined' &&
    (localStorage.getItem('bloquearPesquisaIA') === 'true' ||
      localStorage.getItem('bloquear_pesquisa_ia') === 'true');

  try {
    const textoBase =
      (termos.join(' ') + ' ' + (filtrar_livro || '')).trim() || 'teoria geral didatica';

    let vetor = null;
    try {
      vetor = await gerarEmbedding(textoBase);
    } catch (e) {
      console.error('⚠️ Falha ao gerar embedding de teoria:', e);
    }

    let result = null;

    // --- TENTATIVA 1: BUSCA SEMÂNTICA NO PINECONE (Index livros, Namespace theory) ---
    if (vetor) {
      let bestMatch = await trySearchTheory(vetor, {
        book_id: filtrar_livro,
        categorias,
      });

      // Fallback de filtros: Se não achou com o livro específico, busca globalmente por categorias
      if (!bestMatch && filtrar_livro) {
        console.warn('⚠️ [TheoryService] Livro específico não retornou resultados. Buscando globalmente no index livros.');
        bestMatch = await trySearchTheory(vetor, { categorias });
      }

      // Fallback total: Busca sem nenhum filtro
      if (!bestMatch) {
        bestMatch = await trySearchTheory(vetor, {});
      }

      if (bestMatch) {
        const parts = bestMatch.id.split('--');
        const bookKey = parts.length === 2 ? desanitizarID(parts[0]) : (bestMatch.metadata?.book_id || 'livro');
        const pageKey = parts.length === 2 ? desanitizarID(parts[1]) : `pagina_${bestMatch.metadata?.pageNum || 1}`;
        const matchType = bestMatch.metadata?.type === 'book' || !bestMatch.metadata?.pageNum ? 'book' : 'page';

        console.log(`📖 [TheoryService] Pinecone Match (${matchType}): ${bestMatch.id}`);

        result = {
          id: pageKey,
          bookId: bookKey,
          matchType: matchType, // 'book' ou 'page'
          link_hf: bestMatch.metadata?.hf_url || null,
          fullData: {
            resumo: bestMatch.metadata?.resumo_geral || bestMatch.metadata?.resumo || 'Conteúdo teórico recuperado.',
            resumos_paginas: bestMatch.metadata?.resumos_paginas ? JSON.parse(bestMatch.metadata.resumos_paginas) : [],
            tags: bestMatch.metadata?.tags ? bestMatch.metadata.tags.split(',') : [],
            categoria: bestMatch.metadata?.categoria || 'teoria',
            pageNum: bestMatch.metadata?.pageNum ? parseInt(bestMatch.metadata.pageNum, 10) : null,
            link_hf: bestMatch.metadata?.hf_url || null,
          },
          score: bestMatch.score,
        };
      }
    }

    if (result) {
      return result;
    }

    if (isSearchBlocked) {
      console.warn('🔒 [TheoryService] Busca externa de livros bloqueada pelo Administrador.');
      throw new Error('Busca de livros externos bloqueada pelas configurações do Administrador.');
    }

    throw new Error('Nenhum resultado de teoria encontrado no Pinecone.');
  } catch (error) {
    console.error('❌ [TheoryService] Erro na busca de teoria:', error);
    return null;
  }
}

/**
 * Baixa o PDF do Hugging Face / Link externo e retorna o anexo apropriado (livro completo ou página isolada).
 */
export async function fetchTheoryAttachment(theoryMatch) {
  const hfUrl = theoryMatch.link_hf || theoryMatch.fullData?.link_hf;
  if (!hfUrl) return null;

  console.log(`[TheoryService] Baixando material de teoria (${theoryMatch.matchType}): ${hfUrl}`);

  let res = null;
  const proxyUrl = getProxyPdfUrl(hfUrl);

  // 1. Tenta baixar via Worker Proxy (para contornar CORS em servidores externos)
  if (proxyUrl && proxyUrl !== hfUrl) {
    try {
      console.log(`[TheoryService] Tentando baixar via Worker Proxy: ${proxyUrl}`);
      const proxyRes = await fetch(proxyUrl);
      if (proxyRes.ok) {
        res = proxyRes;
      } else {
        console.warn(`[TheoryService] Worker Proxy retornou status HTTP ${proxyRes.status}. Tentando fallback direto.`);
      }
    } catch (proxyErr) {
      console.warn('[TheoryService] Falha no Worker Proxy. Tentando fetch direto/fallback:', proxyErr);
    }
  }

  // 2. Fallback: Fetch direto se proxy não respondeu ou não foi aplicável
  if (!res) {
    try {
      res = await fetch(hfUrl);
    } catch (directErr) {
      console.warn('[TheoryService] Fetch direto falhou, tentando Puter fallback se disponível:', directErr);
    }
  }

  // 3. Fallback: Puter fetch (se window.puter.net.fetch estiver disponível no cliente)
  if ((!res || !res.ok) && typeof window !== 'undefined' && window.puter?.net?.fetch) {
    try {
      console.log('[TheoryService] Tentando download via Puter net fetch...');
      const puterRes = await window.puter.net.fetch(hfUrl);
      if (puterRes.ok) {
        res = puterRes;
      }
    } catch (puterErr) {
      console.warn('[TheoryService] Puter net fetch falhou:', puterErr);
    }
  }

  if (!res || !res.ok) {
    throw new Error(`Falha HTTP ${res?.status || 'network_error'} ao baixar arquivo de teoria`);
  }

  const pdfArrayBuffer = await res.arrayBuffer();

  // Se o match for do LIVRO COMPLETO, envia o PDF inteiro
  if (theoryMatch.matchType === 'book' || !theoryMatch.fullData?.pageNum) {
    const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
    const fileName = `livro_${theoryMatch.bookId || 'didatico'}.pdf`;
    return new File([pdfBlob], fileName, { type: 'application/pdf' });
  }

  // Se o match for de UMA PÁGINA ESPECÍFICA, carrega via PDF.js e renderiza APENAS essa página
  const pageNum = parseInt(theoryMatch.fullData.pageNum, 10) || 1;
  console.log(`[TheoryService] Renderizando e isolando APENAS a página ${pageNum} do livro...`);

  if (typeof window !== 'undefined' && window.pdfjsLib) {
    const pdfDoc = await window.pdfjsLib.getDocument({ data: pdfArrayBuffer }).promise;
    const targetPageNum = Math.min(Math.max(1, pageNum), pdfDoc.numPages);
    const page = await pdfDoc.getPage(targetPageNum);

    const dpi = 200;
    const scale = dpi / 72;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    await page.render({ canvasContext: ctx, viewport }).promise;

    const pageBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const fileName = `pagina_${targetPageNum}_${theoryMatch.bookId || 'livro'}.png`;
    return new File([pageBlob], fileName, { type: 'image/png' });
  } else {
    // Fallback: se pdfjsLib não estiver disponível, retorna o Blob PDF original
    const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
    const fileName = `pagina_${pageNum}_${theoryMatch.bookId || 'livro'}.pdf`;
    return new File([pdfBlob], fileName, { type: 'application/pdf' });
  }
}
