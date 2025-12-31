import { gerarHtmlPainelFiltros } from "../banco/filtros-ui.js";
import {
  carregarBancoDados,
  configurarObserverScroll,
} from "../banco/paginacao-e-carregamento.js";
import { bancoState } from "../main.js";
import { gerarHtmlModalScanOriginal } from "../ui/scan-original-modal.js";
import { checkAndRestoreFloatingTerminal } from "../upload/search-logic.js";

/**
 * 1. TELA INICIAL
 */
export function gerarTelaInicial() {
  document.body.innerHTML = "";
  document.getElementById("pdfViewerContainer")?.remove();
  bancoState.ultimoKeyCarregada = null;
  bancoState.todasQuestoesCache = [];

  const html = `
    <div class="container fade-in" style="max-width: 900px; margin-top: 10vh; text-align: center; overflow-y: scroll">
        <div id="brandHeader" style="justify-content: center; margin-bottom: 40px;">
            <img src="logo.png" alt="Logo Maia" id="brandLogo" style="width: 80px;">
            <span id="brandName" style="font-size: 4rem;">Maia<strong style="color:var(--color-primary)">.edu</strong></span>
        </div>

        <h1 style="margin-bottom: 40px;">O que vamos fazer hoje?</h1>

        <div class="startScreenDiv">
            <div class="card card-hover js-iniciar-estudante" style="cursor: pointer; padding: 40px; transition: transform 0.2s; border: 1px solid var(--color-border);">
                <div style="font-size: 50px; margin-bottom: 20px;">📚</div>
                <h2 style="color: var(--color-primary); margin-bottom: 15px;">Banco de Questões</h2>
                <p style="color: var(--color-text-secondary);">
                    Acesse o repertório completo de questões utilizado pela nossa inteligência artificial.
                </p>
                <button class="btn btn--primary btn--full-width" style="margin-top: 20px;">Acessar Banco</button>
            </div>

            <div class="card card-hover js-iniciar-extracao" style="cursor: pointer; padding: 40px; transition: transform 0.2s; border: 1px solid var(--color-border);">
                <div style="font-size: 50px; margin-bottom: 20px;">🛠️</div>
                <h2 style="color: var(--color-warning); margin-bottom: 15px;">Extrair Questões</h2>
                <p style="color: var(--color-text-secondary);">
                    Extraia questões ausentes em nosso banco e ajude a nossa IA para ser mais inteligente.
                </p>
                <button class="btn btn--secondary btn--full-width" style="margin-top: 20px;">Abrir Extrator</button>
            </div>
        </div>
    </div>
    `;
  document.body.innerHTML = html;

  // Persist Floating Terminal
  checkAndRestoreFloatingTerminal();
}

export function iniciarFluxoExtracao() {
  generatePDFUploadInterface();
}

export async function iniciarModoEstudante() {
  // 1. Limpa a tela
  document.body.innerHTML = "";

  // 2. Monta o HTML Principal
  const htmlFiltros = gerarHtmlPainelFiltros();
  const htmlModal = gerarHtmlModalScanOriginal();

  const htmlLayout = `
    <div class="bank-layout">
        ${htmlFiltros}

        <div id="bankStream" class="bank-stream"></div>

        <div id="sentinelaScroll" style="padding: 40px; text-align:center;">
            <div class="spinner" style="margin: 0 auto;"></div>
            <p style="color:var(--color-text-secondary); font-size:12px; margin-top:10px;">Carregando banco de dados...</p>
        </div>
    </div>
    ${htmlModal}
    `;

  // 3. Injeta no DOM
  document.body.innerHTML = htmlLayout;

  // 4. Carregamento Inicial de Dados
  await carregarBancoDados();

  // 5. Configura Scroll Infinito
  // 5. Configura Scroll Infinito
  configurarObserverScroll();

  // Persist Floating Terminal
  checkAndRestoreFloatingTerminal();
}
