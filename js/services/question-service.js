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
        // 1.1 PRIORIDADE MÁXIMA: Carregar full_json direto do metadata do Pinecone (Zero Latency / Sem chamada ao Firebase)
        if (bestMatch.metadata && (bestMatch.metadata.full_json || bestMatch.metadata.has_full_json)) {
          if (bestMatch.metadata.full_json) {
            try {
              const fullData = typeof bestMatch.metadata.full_json === 'string'
                ? JSON.parse(bestMatch.metadata.full_json)
                : bestMatch.metadata.full_json;

              if (fullData && (fullData.dados_questao || fullData.dados_gabarito || fullData.enunciado)) {
                console.log(`[QuestionService] ⚡ Questão recuperada DIRETO do Pinecone metadata (sem Firebase): ${bestMatch.id}`);
                const questaoId =
                  bestMatch.metadata.questao ||
                  fullData.dados_questao?.identificacao ||
                  fullData.identificacao ||
                  bestMatch.id;

                result = {
                  id: questaoId,
                  fullData: fullData,
                  score: bestMatch.score || 0.95,
                };
              }
            } catch (errParse) {
              console.warn('[QuestionService] Falha ao parsear metadata.full_json do Pinecone:', errParse);
            }
          }
        }

        // 1.2 FALLBACK: Se o full_json não estava no Pinecone (ex: >38KB), busca no Firebase pelo path correto
        if (!result && bestMatch.id) {
          let provaKey = bestMatch.metadata?.prova || bestMatch.metadata?.exam || '';
          let questaoKey = bestMatch.metadata?.questao || '';

          if (!provaKey || !questaoKey) {
            if (bestMatch.id.includes('--')) {
              const parts = bestMatch.id.split('--');
              provaKey = desanitizarID(parts[0]);
              questaoKey = desanitizarID(parts[1]);
            } else {
              const decoded = desanitizarID(bestMatch.id);
              if (decoded.includes(' - ')) {
                const lastDashIndex = decoded.lastIndexOf(' - ');
                provaKey = decoded.substring(0, lastDashIndex).trim();
                questaoKey = decoded.substring(lastDashIndex + 3).trim();
              } else if (decoded.includes('--')) {
                const parts = decoded.split('--');
                provaKey = parts[0].trim();
                questaoKey = parts[1].trim();
              } else {
                provaKey = provaKey || decoded;
                questaoKey = questaoKey || decoded;
              }
            }
          }

          if (provaKey && questaoKey) {
            console.log(`[QuestionService] Pinecone Match (Firebase fetch): ${bestMatch.id}`);
            console.log(`[QuestionService] Path: questoes/${provaKey}/${questaoKey}`);

            try {
              const qRef = ref(db, `questoes/${provaKey}/${questaoKey}`);
              const snapshot = await get(qRef);

              if (snapshot.exists()) {
                result = {
                  id: questaoKey,
                  fullData: snapshot.val(),
                  score: bestMatch.score,
                };
              } else {
                console.warn(`⚠️ Questão não encontrada no caminho: questoes/${provaKey}/${questaoKey}`);
              }
            } catch (dbErr) {
              console.warn(`⚠️ Erro ao consultar Firebase em questoes/${provaKey}/${questaoKey}:`, dbErr.message);
            }
          }
        }
      }
    }

    // --- TENTATIVA 2: FALLBACK (Random/First) ---
    if (!result) {
      console.warn('⚠️ [QuestionService] Recorrendo ao Fallback Genérico.');

      try {
        // Estrutura: questoes -> { "PROVA_X": { "Q1": {}, "Q2": {} }, "PROVA_Y": ... }
        const provasQuery = query(ref(db, 'questoes'), limitToFirst(3));
        const provasSnap = await get(provasQuery);

        if (provasSnap.exists()) {
          const provas = provasSnap.val();
          const keysProvas = Object.keys(provas);

          const provaKey = keysProvas[Math.floor(Math.random() * keysProvas.length)];
          const questoesDaProva = provas[provaKey];

          if (questoesDaProva) {
            const keysQuestoes = Object.keys(questoesDaProva);
            if (keysQuestoes.length > 0) {
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
      } catch (fbErr) {
        console.warn('⚠️ Fallback do Firebase inacessível (permissão ou offline):', fbErr.message);
      }
    }

    if (result) {
      return result;
    }

    console.warn('[QuestionService] Nenhuma questão encontrada no Firebase.');
    return null;
  } catch (error) {
    console.error('❌ [QuestionService] Erro na busca de questão:', error);
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
