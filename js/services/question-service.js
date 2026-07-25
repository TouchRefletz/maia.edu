import {
  get,
  limitToFirst,
  query,
  ref,
} from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';
import { gerarEmbedding, queryPineconeWorker } from '../api/worker.js';
import { db } from '../main.js';

/**
 * Decodifica Base64URL para string original (Reverso de sanitizarID)
 */
function desanitizarID(encoded) {
  if (!encoded) return '';
  try {
    // Base64URL -> Base64
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    // Padding
    while (base64.length % 4) {
      base64 += '=';
    }
    // Decode
    return decodeURIComponent(escape(atob(base64)));
  } catch (e) {
    console.error('[QuestionService] Falha ao desanitizar ID:', encoded, e);
    return encoded;
  }
}

export async function findBestQuestion(filtros) {
  const { query: queryText, institution, year, subject } = filtros;

  console.log('🔍 [QuestionService] Iniciando busca:', filtros);

  try {
    const textoBase =
      queryText ||
      `${subject || ''} ${institution || ''} ${year || ''}`.trim() ||
      'questão vestibular geral';

    let vetor = null;
    try {
      vetor = await gerarEmbedding(textoBase);
    } catch (e) {
      console.error('⚠️ Falha ao gerar embedding.', e);
    }

    let result = null;

    // --- TENTATIVA 1: BUSCA SEMÂNTICA (Pinecone) ---
    if (vetor) {
      let bestMatch = await trySearch(vetor, { institution, year, subject });
      // Fallbacks de filtro
      if (!bestMatch && year) bestMatch = await trySearch(vetor, { institution, subject });
      if (!bestMatch && institution) bestMatch = await trySearch(vetor, { subject });
      if (!bestMatch) bestMatch = await trySearch(vetor, {});

      if (bestMatch) {
        // ID Pinecone format: SANITIZED_KEY_PROVA--SANITIZED_KEY_QUESTAO
        const parts = bestMatch.id.split('--');

        if (parts.length === 2) {
          const provaKey = desanitizarID(parts[0]);
          const questaoKey = desanitizarID(parts[1]);

          console.log(`[QuestionService] Pinecone Match: ${bestMatch.id}`);
          console.log(`[QuestionService] Path: questoes/${provaKey}/${questaoKey}`);

          // Busca Direta no Firebase
          const qRef = ref(db, `questoes/${provaKey}/${questaoKey}`);
          const snapshot = await get(qRef);

          if (snapshot.exists()) {
            result = {
              id: questaoKey, // ID para renderização (pode ser o ID limpo)
              fullData: snapshot.val(),
              score: bestMatch.score,
            };
          } else {
            console.warn(`⚠️ Questão não encontrada no caminho: questoes/${provaKey}/${questaoKey}`);
          }
        } else {
          console.warn("⚠️ Formato de ID Pinecone inválido (sem '--'):", bestMatch.id);
        }
      }
    }

    // --- TENTATIVA 2: FALLBACK (Random/First) ---
    if (!result) {
      console.warn('⚠️ [QuestionService] Recorrendo ao Fallback Genérico.');

      // Estrutura: questoes -> { "PROVA_X": { "Q1": {}, "Q2": {} }, "PROVA_Y": ... }
      // Pegamos a primeira PROVA
      const provasQuery = query(ref(db, 'questoes'), limitToFirst(3)); // Pega 3 provas pra variar um pouco se der
      const provasSnap = await get(provasQuery);

      if (provasSnap.exists()) {
        const provas = provasSnap.val();
        const keysProvas = Object.keys(provas);

        // Pega uma prova aleatória das encontradas (ou a primeira)
        const provaKey = keysProvas[Math.floor(Math.random() * keysProvas.length)];
        const questoesDaProva = provas[provaKey];

        if (questoesDaProva) {
          const keysQuestoes = Object.keys(questoesDaProva);
          if (keysQuestoes.length > 0) {
            // Pega uma questão aleatória dessa prova
            const questaoKey = keysQuestoes[Math.floor(Math.random() * keysQuestoes.length)];
            const data = questoesDaProva[questaoKey];

            console.log(`[QuestionService] Fallback usado: questoes/${provaKey}/${questaoKey}`);

            result = {
              id: questaoKey,
              fullData: data,
              score: 0,
            };
          }
        }
      }
    }

    if (result) {
      return result;
    }

    throw new Error('Banco de questões vazio ou inacessível.');
  } catch (error) {
    console.error('❌ [QuestionService] Erro fatal na busca:', error);
    return null;
  }
}

async function trySearch(vector, filters) {
  const pineconeFilter = {};
  if (filters.institution) pineconeFilter.institution = filters.institution;
  if (filters.year) pineconeFilter.year = filters.year;

  const resultados = await queryPineconeWorker(vector, 1, pineconeFilter, 'default');

  if (resultados && resultados.matches && resultados.matches.length > 0) {
    return resultados.matches[0];
  }
  return null;
}
