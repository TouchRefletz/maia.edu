import { gerarEmbedding, upsertPineconeWorker } from '../api/worker.js';
import { customAlert } from '../ui/GlobalAlertsLogic.tsx';
import { construirTextoSemantico } from './envio-textos.js';

export async function processarEmbeddingSemantico(
  btnEnviar,
  questaoFinal,
  gabaritoLimpo
) {
  if (btnEnviar) btnEnviar.innerText = '🧠 Criando Cérebro...';

  let textoParaVetorizar = construirTextoSemantico(
    questaoFinal.dados_questao || questaoFinal,
    gabaritoLimpo
  );

  textoParaVetorizar = textoParaVetorizar
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 8000);

  console.log('📝 Texto Semântico para Embedding:', textoParaVetorizar);

  let vetorEmbedding = null;

  if (textoParaVetorizar.length > 20) {
    try {
      vetorEmbedding = await gerarEmbedding(textoParaVetorizar);
    } catch (errEmbed) {
      console.warn('⚠️ Falha ao gerar embedding:', errEmbed);
    }
  }

  // CORREÇÃO: Retorna um objeto com o vetor E o texto
  return { vetorEmbedding, textoParaVetorizar };
}

export async function indexarNoPinecone(
  btnEnviar,
  vetorEmbedding,
  idPinecone,
  chaveProva,
  textoParaVetorizar
) {
  // Só executa se tiver vetor gerado
  if (vetorEmbedding) {
    // 1. Feedback Visual
    if (btnEnviar) btnEnviar.innerText = '🌲 Indexando no Pinecone...';

    try {
      // 2. Monta o objeto para o Pinecone
      const vectorItem = {
        id: idPinecone,
        values: vetorEmbedding,
        metadata: {
          prova: chaveProva,
          texto_preview: textoParaVetorizar.substring(0, 200),
        },
      };

      // 3. Envio via Worker
      await upsertPineconeWorker([vectorItem]);
      console.log('✅ Vector salvo no Pinecone (Worker):', idPinecone);
    } catch (errPine) {
      // 4. Tratamento de Erro (Não bloqueia o salvamento no Firebase)
      console.error('❌ Erro Pinecone Worker:', errPine);
      customAlert('⚠️ Aviso: Indexação falhou, mas questão será salva.');
    }
  }
}