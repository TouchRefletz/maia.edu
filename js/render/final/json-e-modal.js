import { renderLatexIn } from '../../libs/loader.js';
import { safe } from '../../normalize/primitives.js';
import { customAlert } from '../../ui/alerts.js';
import { montarHtmlPainelGabarito, montarHtmlPainelQuestao, prepararDadosGerais } from './render-components.js';

export function resolverImagensPrioritarias(backupGlobal, originalLimpas) {
  return backupGlobal && backupGlobal.length > 0
    ? backupGlobal
    : originalLimpas || [];
}

export function prepararObjetoGabarito(g) {
  const gabaritoLimpo = JSON.parse(JSON.stringify(g));

  // Remove campos desnecessários
  delete gabaritoLimpo.alertas_credito;
  if (gabaritoLimpo.creditos) {
    delete gabaritoLimpo.creditos.como_identificou;
    delete gabaritoLimpo.creditos.precisa_credito_generico;
    delete gabaritoLimpo.creditos.texto_credito_sugerido;
  }

  // Resolve as imagens
  const imgsReais = resolverImagensPrioritarias(
    window.__BACKUP_IMGS_G,
    window.__imagensLimpas?.gabarito_original
  );

  if (imgsReais.length > 0) {
    gabaritoLimpo.fotos_originais = imgsReais;
    delete gabaritoLimpo.foto_original; // Remove a chave antiga
  }

  return gabaritoLimpo;
}

export function prepararObjetoQuestao(q) {
  const questaoFinal = JSON.parse(JSON.stringify(q));

  // Resolve as imagens
  const imgsReais = resolverImagensPrioritarias(
    window.__BACKUP_IMGS_Q,
    window.__imagensLimpas?.questao_original
  );

  if (imgsReais.length > 0) {
    questaoFinal.fotos_originais = imgsReais;
    delete questaoFinal.foto_original; // Remove a chave antiga
  }

  // Remove identificação redundante (pois será usada como chave do JSON)
  delete questaoFinal.identificacao;

  return questaoFinal;
}

export function gerarJsonFinal(q, g, tituloMaterial) {
  // 1. Prepara os objetos limpos
  const gabaritoLimpo = prepararObjetoGabarito(g);
  const questaoFinal = prepararObjetoQuestao(q);

  // 2. Define as chaves seguras
  const chaveProva = tituloMaterial || 'MATERIAL_SEM_TITULO';
  const chaveQuestao = q.identificacao || 'QUESTAO_SEM_ID'; // Nota: Usa 'q' original pois removemos do 'questaoFinal'

  // 3. Monta o Payload
  const payloadFinal = {
    [chaveProva]: {
      [chaveQuestao]: {
        meta: {
          timestamp: new Date().toISOString(),
        },
        dados_questao: questaoFinal,
        dados_gabarito: gabaritoLimpo,
      },
    },
  };

  // 4. Retorna a string pronta
  return JSON.stringify(payloadFinal, null, 2);
}

export function gerarHtmlHeaderModal(tituloMaterial) {
  return `
        <div class="final-modal-header" style="background: var(--color-surface); border-bottom: 1px solid var(--color-border); padding: 15px 25px; display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:15px;">
                <img src="logo.png" style="height:32px;">
                <div>
                    <h2 style="margin:0; font-size:1.4rem; font-weight:700; color:var(--color-text); line-height:1.2;">Revisão Final & Exportação</h2>
                    <div style="font-size:0.85rem; color:var(--color-text-secondary);">Material base: <strong style="color:var(--color-primary);">${safe(tituloMaterial)}</strong></div>
                </div>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn btn--sm btn--outline js-ver-originais" title="Ver prints originais">
                    👁️ Originais
                </button>
                <button class="btn btn--sm btn--secondary" onclick="document.getElementById('finalModal').remove()" style="border-color:var(--color-border); color:var(--color-text);">
                    ✕ Voltar para Edição
                </button>
            </div>
        </div>`;
}

export function gerarHtmlJsonDebug(jsonString) {
  return `
        <div class="json-debug-area" style="margin-top: 30px; background: #0f172a; border-radius: 8px; overflow: hidden; border: 1px solid var(--color-border);">
            <details>
                <summary class="json-debug-header">
                    <span>📦 JSON Payload Final (Clique para expandir)</span>
                    <span>📋</span>
                </summary>
                <div style="position:relative;">
                     <button class="btn btn--sm btn--primary" style="position:absolute; top:10px; right:10px;" onclick="navigator.clipboard.writeText(document.getElementById('finalJsonOutput').innerText); this.innerText='Copiado!'; setTimeout(()=>this.innerText='Copiar JSON', 1500);">Copiar JSON</button>
                     <pre class="json-dump" id="finalJsonOutput" style="padding: 20px; margin: 0; max-height: 300px; overflow: auto; font-size: 11px; line-height: 1.4;">${jsonString}</pre>
                </div>
            </details>
        </div>`;
}

export function montarHtmlModalCompleto(
  headerHtml,
  htmlQuestaoSide,
  htmlGabaritoSide,
  jsonHtml
) {
  return `
    <div class="final-modal-overlay visible" id="finalModal" style="background: rgba(0,0,0,0.9); backdrop-filter: blur(5px);">
        <div class="final-modal-content" style="background: var(--color-background); border: 1px solid var(--color-border); max-width: 1500px; width:95%; height: 95vh; display:flex; flex-direction:column; box-shadow:0 0 40px rgba(0,0,0,0.5);">
            
            ${headerHtml}

            <div class="modal-body" style="background: var(--color-background); padding: 25px; overflow-y: auto; flex:1;">
                <div class="review-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; height:100%;">
                    <div class="review-col" style="background: var(--color-surface); padding: 20px; border-radius: var(--radius-lg); border: 1px solid var(--color-border); overflow-y:auto; max-height:100%;">
                        ${htmlQuestaoSide}
                    </div>
                    <div class="review-col" style="background: var(--color-surface); padding: 20px; border-radius: var(--radius-lg); border: 1px solid var(--color-border); overflow-y:auto; max-height:100%;">
                        ${htmlGabaritoSide}
                    </div>
                </div>
                ${jsonHtml}
            </div>

           <div class="modal-footer" style="background: var(--color-surface); border-top: 1px solid var(--color-border); padding: 20px; display:flex; justify-content:flex-end; gap:15px;">
                <button class="btn btn--secondary" onclick="document.getElementById('finalModal').remove()">Cancelar</button>
                <button id="btnConfirmarEnvioFinal" class="btn btn--primary js-confirmar-envio">
                    🚀 Confirmar e Enviar
                </button>
            </div>
        </div>
    </div>`;
}

export function exibirModalRevisaoFinal(
  tituloMaterial,
  htmlQuestaoSide,
  htmlGabaritoSide,
  jsonString
) {
  // 1. Gera os pedaços HTML
  const headerHtml = gerarHtmlHeaderModal(tituloMaterial);
  const jsonHtml = gerarHtmlJsonDebug(jsonString);

  // 2. Monta o HTML final
  const modalHTML = montarHtmlModalCompleto(
    headerHtml,
    htmlQuestaoSide,
    htmlGabaritoSide,
    jsonHtml
  );

  // 3. Gerenciamento do DOM (Remove antigo, insere novo)
  const oldModal = document.getElementById('finalModal');
  if (oldModal) oldModal.remove();

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // 4. Pós-renderização (LaTeX)
  setTimeout(() => {
    const modalEl = document.getElementById('finalModal');
    if (typeof renderLatexIn === 'function') {
      renderLatexIn(modalEl);
    }
  }, 50);
}

export function renderizarTelaFinal() {
  const dados = prepararDadosGerais();

  // Se retornou null, para a execução (igual ao 'return' que tinha dentro do if)
  if (!dados) return;

  // Desestrutura as variáveis para usar normalmente abaixo
  const { q, g, tituloMaterial, explicacaoArray, imagensFinais } = dados;

  const htmlQuestaoSide = montarHtmlPainelQuestao(
    q,
    tituloMaterial,
    imagensFinais
  );

  const htmlGabaritoSide = montarHtmlPainelGabarito(
    g,
    imagensFinais,
    explicacaoArray
  );

  const jsonString = gerarJsonFinal(q, g, tituloMaterial);

  exibirModalRevisaoFinal(
    tituloMaterial,
    htmlQuestaoSide,
    htmlGabaritoSide,
    jsonString
  );
}

export function iniciarPreparacaoEnvio() {
  const btnEnviar = document.getElementById('btnConfirmarEnvioFinal');
  const q = window.__ultimaQuestaoExtraida;
  const g = window.__ultimoGabaritoExtraido;

  // 1. Validação
  if (!q || !g) {
    customAlert('❌ Erro: Dados incompletos. Processe a questão e o gabarito.');
    return null; // Retorna null para sinalizar erro
  }

  // 2. Travamento de UI (Feedback Visual)
  if (btnEnviar) {
    btnEnviar.disabled = true;
    btnEnviar.innerText = '⏳ Preparando JSON...';
  }

  // Retorna os dados para você usar no resto da lógica
  return { btnEnviar, q, g };
}

export function resolverImagensEnvio(backup, atuais) {
  return backup && backup.length > 0 ? backup : atuais || [];
}