import {
  ref,
  set,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { resetarParaProximaQuestao } from "../app/reset.js";
import { CropperState } from "../cropper/cropper-state.js";
import {
  indexarNoPinecone,
  processarEmbeddingSemantico,
} from "../ia/embedding-e-pinecone.js";
import {
  construirDadosParaEnvio,
  gerarIdentificadoresEnvio,
} from "../ia/envio-textos.js";
import { prepararPayloadComImagens } from "../ia/payload-imagens.js";
import { db } from "../main.js";
import { DataNormalizer } from "../normalizer/data-normalizer.js";
import { iniciarPreparacaoEnvio } from "../render/final/json-e-modal.js";
import { customAlert } from "../ui/GlobalAlertsLogic.tsx";
import { getActiveTab, removeTab, switchToHub } from "../ui/sidebar-tabs.js";

export async function finalizarEnvioFirebase(
  btnEnviar,
  chaveProva,
  idQuestaoUnico,
  payloadParaSalvar,
) {
  // 1. Feedback Visual
  if (btnEnviar) btnEnviar.innerText = "💾 Salvando no Banco...";

  // 2. Define o caminho e Referência
  const caminhoFinal = `questoes/${chaveProva}/${idQuestaoUnico}`;
  // Assume que 'db', 'ref' e 'set' estão importados do Firebase no seu arquivo
  const novaQuestaoRef = ref(db, caminhoFinal);

  // 3. Salva os dados
  await set(novaQuestaoRef, payloadParaSalvar);

  // 4. Logs de Sucesso
  console.log("Sucesso! Salvo em:", caminhoFinal);
  console.log("Payload Final:", payloadParaSalvar);

  // 5. Atualiza a UI da aba e fecha (Feedback Visual Solicitado)
  const activeTab = getActiveTab();
  if (activeTab && activeTab.type === "question") {
    // Atualiza o estado do grupo no CropperState para "sent"
    // Isso garante que o card no Hub mostre "Salvo!" em vez de voltar para "Enviar"
    if (activeTab.groupId) {
      const group = CropperState.groups.find((g) => g.id === activeTab.groupId);
      if (group) {
        group.status = "sent";
      }
    }

    // FIX: Troca para o Hub ANTES de notificar para que o re-render aconteça
    // e o usuário veja a mensagem "Salvo no banco de dados!"
    switchToHub();

    // Agora dispara o notify para re-renderizar o Hub com o novo status
    CropperState.notify();

    // Aguarda 2 segundos para o usuário ver a mensagem de sucesso, depois fecha a aba
    setTimeout(() => {
      removeTab(activeTab.id);
    }, 100);
  }

  resetarParaProximaQuestao();
}

export function tratarErroEnvioFirebase(error, btnEnviar) {
  // 1. Log técnico para o desenvolvedor
  console.error("Erro fatal no envio:", error);

  // 2. Alerta visual para o usuário
  customAlert("❌ Falha no envio: " + (error.message || "Erro desconhecido"));

  // 3. Destrava a interface para nova tentativa
  if (btnEnviar) {
    btnEnviar.disabled = false;
    btnEnviar.innerText = "🚀 Tentar Novamente";
  }
}

export async function enviarDadosParaFirebase(overrideQ, overrideG) {
  // 1. Inicia e valida
  const contextoEnvio = iniciarPreparacaoEnvio(overrideQ, overrideG);
  if (!contextoEnvio) return;
  const { btnEnviar, q, g } = contextoEnvio;

  try {
    // 2. CORREÇÃO: Constroi os dados PRIMEIRO para ter acesso ao tituloMaterial, questaoFinal, etc.
    const { tituloMaterial, questaoFinal, gabaritoLimpo } =
      construirDadosParaEnvio(q, g);

    // 3. Agora sim podemos gerar os IDs (pois temos o tituloMaterial)
    const { chaveProva, idQuestaoUnico, idPinecone } =
      gerarIdentificadoresEnvio(tituloMaterial, q);

    // 4. Gera Embedding (Desestrutura para pegar vetor E texto)
    const { vetorEmbedding, textoParaVetorizar } =
      await processarEmbeddingSemantico(btnEnviar, questaoFinal, gabaritoLimpo);

    // 5. Upload e Payload (Modifica payloadParaSalvar com URLs reais)
    const payloadParaSalvar = await prepararPayloadComImagens(
      btnEnviar,
      questaoFinal,
      gabaritoLimpo,
    );

    // [NEW] Adiciona Link Original (se disponível no fluxo de upload)
    if (window.__pdfOriginalUrl) {
      payloadParaSalvar.meta = payloadParaSalvar.meta || {};
      payloadParaSalvar.meta.source_url = window.__pdfOriginalUrl;
    }

    // 6. Indexa no Pinecone (Agora temos todas as variáveis definidas)
    await indexarNoPinecone(
      btnEnviar,
      vetorEmbedding,
      idPinecone,
      chaveProva,
      textoParaVetorizar,
      payloadParaSalvar,
    );

    // 6.1 Flush de novos termos para o índice de filtros
    await DataNormalizer.flush();

    // Salva no Firebase e reseta a tela
    await finalizarEnvioFirebase(
      btnEnviar,
      chaveProva,
      idQuestaoUnico,
      payloadParaSalvar,
    );
  } catch (error) {
    tratarErroEnvioFirebase(error, btnEnviar);
  }
}
