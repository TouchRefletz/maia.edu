import { montarHtmlPainelGabarito, montarHtmlPainelQuestao, prepararDadosGerais } from './render-components.js';
// Importamos a função de montagem do React (assumindo que seu build system permite isso)
import { customAlert } from '../../ui/alerts.js';
import { mountJsonReviewModal } from './JsonReviewModal.tsx';

// --- MANTER EXPORTS DE LÓGICA AUXILIAR ---
// Algumas partes do sistema podem importar isso diretamente, então mantemos wrappers
// ou a lógica mínima necessária se ela for usada fora do contexto do modal.
// Se estas funções só eram usadas internamente neste arquivo, podem ser removidas/simplificadas.
// Assumindo que podem ser usadas externamente, mantemos referências simples ou duplicamos a lógica mínima.

export function resolverImagensPrioritarias(backupGlobal, originalLimpas) {
  return backupGlobal && backupGlobal.length > 0
    ? backupGlobal
    : originalLimpas || [];
}

// Estas funções de preparação agora existem dentro do TSX, 
// mas se outros arquivos as chamam, precisamos mantê-las aqui.
// Se ninguém chama de fora, podem ser deletadas. Por segurança, mantive a lógica original.
export function prepararObjetoGabarito(g) {
  const gabaritoLimpo = JSON.parse(JSON.stringify(g));
  delete gabaritoLimpo.alertas_credito;
  if (gabaritoLimpo.creditos) {
    delete gabaritoLimpo.creditos.como_identificou;
    delete gabaritoLimpo.creditos.precisa_credito_generico;
    delete gabaritoLimpo.creditos.texto_credito_sugerido;
  }
  const imgsReais = resolverImagensPrioritarias(
    window.__BACKUP_IMGS_G,
    window.__imagensLimpas?.gabarito_original
  );
  if (imgsReais.length > 0) {
    gabaritoLimpo.fotos_originais = imgsReais;
    delete gabaritoLimpo.foto_original;
  }
  return gabaritoLimpo;
}

export function prepararObjetoQuestao(q) {
  const questaoFinal = JSON.parse(JSON.stringify(q));
  const imgsReais = resolverImagensPrioritarias(
    window.__BACKUP_IMGS_Q,
    window.__imagensLimpas?.questao_original
  );
  if (imgsReais.length > 0) {
    questaoFinal.fotos_originais = imgsReais;
    delete questaoFinal.foto_original;
  }
  delete questaoFinal.identificacao;
  return questaoFinal;
}

export function gerarJsonFinal(q, g, tituloMaterial) {
  const gabaritoLimpo = prepararObjetoGabarito(g);
  const questaoFinal = prepararObjetoQuestao(q);
  const chaveProva = tituloMaterial || 'MATERIAL_SEM_TITULO';
  const chaveQuestao = q.identificacao || 'QUESTAO_SEM_ID';
  
  const payloadFinal = {
    [chaveProva]: {
      [chaveQuestao]: {
        meta: { timestamp: new Date().toISOString() },
        dados_questao: questaoFinal,
        dados_gabarito: gabaritoLimpo,
      },
    },
  };
  return JSON.stringify(payloadFinal, null, 2);
}

// Funções de HTML string não são mais necessárias para o funcionamento interno,
// mas mantemos export vazios ou deprecated caso alguém importe.
export function gerarHtmlHeaderModal(tituloMaterial) { return ''; }
export function gerarHtmlJsonDebug(jsonString) { return ''; }
export function montarHtmlModalCompleto() { return ''; }
export function exibirModalRevisaoFinal() { console.warn('Função depreciada. O React controla o modal.'); }

// --- FUNÇÃO PRINCIPAL ---

export function renderizarTelaFinal() {
  const dados = prepararDadosGerais();
  if (!dados) return;

  const { q, g, tituloMaterial, explicacaoArray, imagensFinais } = dados;

  // Geramos o HTML interno dos painéis usando os componentes legados
  const htmlQuestaoSide = montarHtmlPainelQuestao(q, tituloMaterial, imagensFinais);
  const htmlGabaritoSide = montarHtmlPainelGabarito(g, imagensFinais, explicacaoArray);

  // Criar container para o React
  const existingModal = document.getElementById('finalModalReactRoot');
  if (existingModal) existingModal.remove();

  const container = document.createElement('div');
  container.id = 'finalModalReactContainer'; // Container temporário
  document.body.appendChild(container);

  // Montar o componente React
  mountJsonReviewModal(container, {
    q,
    g,
    tituloMaterial,
    htmlQuestaoSide,
    htmlGabaritoSide,
    onConfirmCallback: () => {
        // Callback opcional: Lógica que deve rodar quando o usuário clica em Enviar
        // Caso existam event listeners globais atrelados à classe .js-confirmar-envio
        // O React já lida com a UI de loading.
        console.log("Evento de confirmação disparado pelo React");
    }
  });
}

// Função auxiliar para envio, mantida para compatibilidade
export function iniciarPreparacaoEnvio() {
  const btnEnviar = document.getElementById('btnConfirmarEnvioFinal');
  const q = window.__ultimaQuestaoExtraida;
  const g = window.__ultimoGabaritoExtraido;

  if (!q || !g) {
    customAlert('❌ Erro: Dados incompletos. Processe a questão e o gabarito.');
    return null;
  }
  
  // O React já gerencia o estado disabled/loading, mas se algo externo chamar isso:
  if (btnEnviar) {
    btnEnviar.disabled = true;
    btnEnviar.innerText = '⏳ Preparando JSON...';
  }

  return { btnEnviar, q, g };
}

export function resolverImagensEnvio(backup, atuais) {
  return backup && backup.length > 0 ? backup : atuais || [];
}