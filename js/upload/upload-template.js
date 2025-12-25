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

    <div id="mainWrapper" style="display: flex; flex-direction: column; align-items: center; justify-content: flex-start; min-height: 100vh; padding: 40px 20px; overflow-y: auto; width: 100%;">
        
        <div id="brandHeader" style="margin-bottom: 40px; text-align: center;">
            <img src="logo.png" alt="Logo Maia" id="brandLogo">
            <span id="brandName">Maia<strong>.api</strong></span>
        </div>

        <div id="searchContainer" class="fade-in-centralized" style="display: flex; flex-direction: column; align-items: center; width: 100%; max-width: 800px;">
            <h1 id="searchTitle" style="text-align: center;">Busque a prova que você quer <strong>dominar</strong>.</h1>
            
            <div class="search-box-wrapper" style="width: 100%; position: relative; margin-top: 20px;">
            <input type="text" id="searchInput" class="form-control" placeholder="Ex: Provas do ENEM 2023..." style="padding-right: 50px; height: 50px; font-size: 1.1rem; width: 100%;">
            <button id="btnSearch" style="position: absolute; right: 5px; top: 5px; height: 40px; width: 40px; border: none; background: var(--color-primary); color: white; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </button>
        </div>

        <div id="searchResults" style="width: 100%; max-width: 1000px; margin-top: 30px; display: flex; flex-direction: column; align-items: center;">
            <!-- Resultados e Thoughts serão injetados aqui -->
        </div>
        
        <div style="margin-top: 50px; margin-bottom: 30px; display: flex; flex-direction: column; align-items: center; gap: 10px;">
             <span style="color: var(--color-text-secondary); font-size: 0.9rem;">Ou se preferir</span>
             <button id="btnShowUpload" class="btn btn--outline">Fazer Upload Manualmente</button>
        </div>
    </div>

        <div id="manualUploadContainer" class="fade-in-centralized hidden" style="display: none; flex-direction: column; align-items: center; width: 100%; max-width: 800px;">
            <div class="header-upload-manual" style="margin-bottom: 30px; text-align: center;">
                 <button id="btnBackToSearch" class="btn btn--sm btn--text">← Voltar para Pesquisa</button>
                 <h2>Upload Manual</h2>
            </div>

        <form id="pdfUploadForm" style="width: 100%; max-width: 500px;">
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
                <button type="submit" id="submitPdfBtn" class="btn btn--primary btn--full-width">Extrair Questões</button>
            </div>
        </form>
    </div>
    <div id="pdfUploadContainerBackground" style="position:fixed; top:0; left:0; width:100%; height:100%; z-index:-1; background:var(--color-background);"></div>
    `;
}
