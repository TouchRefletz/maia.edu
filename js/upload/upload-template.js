/**
 * 1. GERAÇÃO DE HTML
 * Retorna apenas a string do template, tirando a sujeira visual da lógica.
 */
export function getUploadInterfaceHTML() {
  return `
    <button class="btn btn--sm btn--outline js-voltar-inicio" style="position:fixed; top:20px; left:20px; z-index:100; border-radius:20px; background:var(--color-surface);">
        ← Voltar
    </button>

    <button class="js-config-api" title="Configurar API Key"
        style="position:fixed; top:20px; right:20px; z-index:100; width:45px; height:45px; border-radius:50%; background:var(--color-surface); border:1px solid var(--color-border); cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,0.1); transition:all 0.2s ease;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
        </svg>
    </button>

    <div id="pdfUploadContainer" class="fade-in-centralized">
        <div id="brandHeader">
            <img src="logo.png" alt="Logo Maia" id="brandLogo">
            <span id="brandName">Maia<strong>.api</strong></span>
        </div>
        <h1 id="promptTitle">Extraia questões e faça da educação <strong>acessível</strong></h1>
        
        <form id="pdfUploadForm">
            <div class="form-group">
                <label for="pdfTitleInput" class="form-label">Título do material</label>
                <div class="input-wrapper">
                    <input type="text" id="pdfTitleInput" class="form-control" placeholder="Ex: FUVEST 2023" required>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">Arquivo da Prova</label>
                <label id="dropZoneProva" for="pdfFileInput" class="btn btn--primary btn--full-width file-upload-btn">
                    Selecionar ou Soltar Prova (PDF)
                </label>
                <input type="file" id="pdfFileInput" accept=".pdf" style="display: none;" required>
                <span id="fileName" class="file-name-display">Nenhum arquivo selecionado</span>
            </div>

            <div class="form-group" id="gabaritoInputGroup">
                <label class="form-label">Arquivo do Gabarito</label>
                <label id="dropZoneGabarito" for="gabaritoFileInput" class="btn btn--primary btn--full-width file-upload-btn">
                    Selecionar ou Soltar Gabarito (PDF)
                </label>
                <input type="file" id="gabaritoFileInput" accept=".pdf" style="display: none;">
                <span id="gabaritoFileName" class="file-name-display">Nenhum arquivo selecionado</span>
            </div>

            <div class="form-group checkbox-group">
                <input type="checkbox" id="gabaritoNaProvaCheck">
                <label for="gabaritoNaProvaCheck" class="checkbox-label">O gabarito está no mesmo arquivo</label>
            </div>

            <div class="modal-footer">
                <button type="submit" id="submitPdfBtn" class="btn btn--primary btn--full-width">Visualizar e Extrair</button>
            </div>
        </form>
    </div>
    <div id="pdfUploadContainerBackground"></div>
    `;
}
