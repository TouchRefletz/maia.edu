/**
 * 1. GERAÇÃO DE HTML
 * Retorna apenas a string do template, tirando a sujeira visual da lógica.
 */
/**
 * 1. TEMPLATE DE BUSCA (Search Interface)
 */
export function getSearchInterfaceHTML() {
  return `
    <button class="btn btn--sm btn--outline js-voltar-inicio" style="position:fixed; top:20px; left:20px; z-index:100; border-radius:20px; background:var(--color-surface);">
        ← Voltar
    </button>

    <div id="mainWrapper" style="display: flex; flex-direction: column; align-items: center; justify-content: flex-start; min-height: 100vh; padding: 40px 20px; overflow-y: auto; width: 100%;">
        
        <div id="brandHeader" style="margin-bottom: 40px; text-align: center;">
            <img src="logo.png" alt="Logo Maia" id="brandLogo">
            <span id="brandName">Maia<strong>.lab</strong></span>
        </div>

        <div id="searchContainer" class="fade-in-centralized" style="display: flex; flex-direction: column; align-items: center; width: 100%; max-width: 800px;">
            <h1 id="searchTitle" style="text-align: center;">Nos dê o nome da prova e <strong>fazemos</strong> o resto.</h1>
            
            <div class="search-box-wrapper" style="width: 100%; position: relative; margin-top: 20px;">
                <input type="text" id="searchInput" class="form-control" placeholder="Ex: Provas do ENEM 2023..." style="padding-right: 50px; height: 50px; font-size: 1.1rem; width: 100%;">
                <button id="btnSearch" style="position: absolute; right: 5px; top: 5px; height: 40px; width: 40px; border: none; background: var(--color-primary); color: white; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </button>
            </div>
            
            <div id="searchTypeToggle" style="display: flex; gap: 10px; margin-top: 20px; background: var(--color-surface); padding: 5px; border-radius: 8px; border: 1px solid var(--color-border); width: 100%; max-width: 400px;">
                <button id="btnTypeProvas" data-type="provas" class="type-btn active" style="flex: 1; padding: 8px 16px; border: none; background: var(--color-primary); color: white; border-radius: 6px; cursor: pointer; font-weight: 500; transition: all 0.2s;">
                    Buscar Provas
                </button>
                <button id="btnTypeQuestoes" data-type="questoes" class="type-btn" style="flex: 1; padding: 8px 16px; border: none; background: transparent; color: var(--color-text-secondary); border-radius: 6px; cursor: pointer; font-weight: 500; transition: all 0.2s;">
                    Buscar Questões
                </button>
            </div>

            <p style="text-align: center; color: var(--color-text-secondary); font-size: 0.9rem; margin-top: 15px; opacity: 0.8;">
                Resultados gerados por IA podem conter imprecisões. 
                <button id="btnDisclaimerInfo" type="button" style="background:none; border:none; padding:0; color:var(--color-primary); text-decoration:underline; cursor:pointer; font-size:inherit; font-weight:500;">Saiba mais</button>
            </p>
        </div>

        <div id="searchResults" style="width: 100%; max-width: 1000px; margin-top: 30px; display: flex; flex-direction: column; align-items: center;">
            <!-- Resultados e Thoughts serão injetados aqui -->
        </div>
        
    </div>
    
    <!-- Disclaimer Modal -->
    <div id="disclaimerModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(2px); z-index:10000; align-items:center; justify-content:center;">
       <div style="background:var(--color-surface); padding:24px; border-radius:12px; max-width:480px; width:90%; box-shadow:0 10px 30px rgba(0,0,0,0.5); border:1px solid var(--color-border); position:relative;">
           <button id="btnCloseDisclaimer" type="button" style="position:absolute; top:12px; right:12px; background:none; border:none; cursor:pointer; color:var(--color-text-secondary); padding:4px;">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
           </button>
           <h3 style="margin-top:0; color:var(--color-text); margin-bottom:12px; font-size:1.1rem; border-bottom:1px solid var(--color-border); padding-bottom:8px;">Aviso sobre IA</h3>
           <p style="color:var(--color-text-secondary); line-height:1.5; font-size:0.9rem; margin-bottom:16px;">
               Os resultados desta busca são gerados e processados por modelos de inteligência artificial. Embora tenhamos sistemas de verificação, o conteúdo pode, ocasionalmente, estar incorreto, incompleto ou corrompido.
           </p>
           <div style="background:rgba(var(--color-primary-rgb), 0.1); border-left:4px solid var(--color-primary); padding:10px 14px; border-radius:4px; font-size:0.85rem; color:var(--color-text);">
               <strong>Recomendação:</strong> Sempre verifique a integridade dos arquivos e a exatidão das informações antes de utilizá-los para fins críticos.
           </div>
       </div>
    </div>
    `;
}

/**
 * 2. TEMPLATE DE UPLOAD MANUAL
 */
export function getManualUploadInterfaceHTML() {
  return `
    <button class="btn btn--sm btn--outline js-voltar-inicio" style="position:fixed; top:20px; left:20px; z-index:100; border-radius:20px; background:var(--color-surface);">
        ← Voltar
    </button>

    <div id="mainWrapper" style="display: flex; flex-direction: column; align-items: center; justify-content: flex-start; min-height: 100vh; padding: 40px 20px; overflow-y: auto; width: 100%;">
        
        <div id="brandHeader" style="margin-bottom: 40px; text-align: center;">
            <img src="logo.png" alt="Logo Maia" id="brandLogo">
            <span id="brandName">Maia<strong>.api</strong></span>
        </div>

        <div id="manualUploadContainer" class="fade-in-centralized" style="display: flex; flex-direction: column; align-items: center; width: 100%; max-width: 800px;">
            <div class="header-upload-manual" style="margin-bottom: 30px; text-align: center;">
                 <h2>Upload Manual</h2>
                 <p style="color: var(--color-text-secondary);">Arraste seu PDF ou clique para selecionar</p>
            </div>

            <form id="pdfUploadForm" style="width: 100%;">
                <div class="form-group">
                    <label class="form-label" for="pdfTitleInput">Nome da Prova</label>
                    <input type="text" id="pdfTitleInput" class="form-control" placeholder="Ex: ENEM 2023 - Caderno Azul" required style="width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text);">
                </div>
                <div class="form-group">
                    <label class="form-label">Arquivo da Prova</label>
                    <label id="dropZoneProva" for="pdfFileInput" class="btn btn--primary btn--full-width file-upload-btn">
                        Selecionar ou Soltar Prova (PDF)
                    </label>
                    <input type="file" id="pdfFileInput" accept=".pdf" style="display: none;">
                    <span id="fileName" class="file-name-display">Nenhum arquivo selecionado</span>
                    <input type="text" id="sourceUrlProva" class="form-control" placeholder="Link original da prova (Opcional)" style="margin-top: 10px; width: 100%; padding: 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text);">
                </div>

                <div class="modal-footer">
                    <button type="submit" id="submitPdfBtn" class="btn btn--primary btn--full-width">Extrair Questões</button>
                </div>
            </form>
        </div>
    </div>
    <div id="pdfUploadContainerBackground" style="position:fixed; top:0; left:0; width:100%; height:100%; z-index:-1; background:var(--color-background);"></div>
    
    <!-- Privacy Confirmation Modal -->
    <div id="privacyConfirmModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.8); backdrop-filter:blur(4px); z-index:13000; align-items:center; justify-content:center;">
       <div style="background:var(--color-surface); padding:30px; border-radius:16px; max-width:500px; width:90%; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); border:1px solid var(--color-border); display:flex; flex-direction:column; gap:20px;">
           <div style="text-align:center;">
               <div style="width:50px; height:50px; background:rgba(var(--color-warning-rgb, 255, 193, 7), 0.1); border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 15px auto;">
                   <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning, #ffc107)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
               </div>
               <h3 style="margin:0; color:var(--color-text); font-size:1.25rem;">Aviso de Privacidade</h3>
           </div>
           
           <p style="margin:0; text-align:center; color:var(--color-text-secondary); line-height:1.6;">
               Você não informou os links de origem dos arquivos enviados. Ao confirmar o envio, os arquivos, ao menos que estejam em nosso banco de dados, são considerados privados e eles não serão coletados. Você deseja continuar?
           </p>

           <div style="display:flex; gap:12px; justify-content:center; margin-top:10px;">
               <button id="btnCancelUpload" type="button" class="btn btn--outline" style="flex:1;">Voltar</button>
               <button id="btnConfirmUpload" type="button" class="btn btn--primary" style="flex:1;">Continuar Envio</button>
           </div>
       </div>
    </div>

    <!-- Processing Confirmation Modal -->
    <div id="processingConfirmModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.8); backdrop-filter:blur(4px); z-index:13000; align-items:center; justify-content:center;">
       <div style="background:var(--color-surface); padding:30px; border-radius:16px; max-width:500px; width:90%; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); border:1px solid var(--color-border); display:flex; flex-direction:column; gap:20px;">
           <div style="text-align:center;">
               <div style="width:50px; height:50px; background:rgba(var(--color-info-rgb, 33, 150, 243), 0.1); border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 15px auto;">
                   <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
               </div>
               <h3 style="margin:0; color:var(--color-text); font-size:1.25rem;">Confirmação Final</h3>
           </div>
           
            <p style="margin:0; text-align:center; color:var(--color-text-secondary); line-height:1.6;">
               Você tem certeza que deseja iniciar o processo de sincronização e indexação? 
           </p>

           <div id="copyrightCheckContainer" style="display:none; flex-direction:row; align-items:flex-start; gap:10px; background:rgba(255,255,255,0.03); padding:12px; border-radius:8px; border:1px solid var(--color-border);">
                <input type="checkbox" id="checkCopyrightPublic" style="margin-top:4px;">
                <label for="checkCopyrightPublic" style="font-size:0.85rem; color:var(--color-text); cursor:pointer; line-height:1.4;">
                    Certifico que detenho os direitos necessários ou que o conteúdo é de livre distribuição. Reconheço a integral responsabilidade legal por este upload e isento a plataforma de qualquer infração de propriedade intelectual decorrente de declarações falsas.
                </label>
           </div>
           <p id="copyrightWarningText" style="display:block; font-size:0.75rem; color:var(--color-text-secondary); text-align:center; margin-top:-10px;">
              Certifique-se de que os arquivos estão corretos antes de prosseguir.
           </p>

           <div style="display:flex; gap:12px; justify-content:center; margin-top:10px;">
               <button id="btnCancelProcessing" type="button" class="btn btn--outline" style="flex:1;">Cancelar</button>
               <button id="btnStartProcessing" type="button" class="btn btn--primary" style="flex:1;">Iniciar Processo</button>
           </div>
       </div>
    </div>
    
     <div id="cancelUploadConfirmModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.8); backdrop-filter:blur(4px); z-index:14000; align-items:center; justify-content:center;">
       <div style="background:var(--color-surface); padding:24px; border-radius:12px; max-width:400px; width:90%; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); border:1px solid var(--color-border); display:flex; flex-direction:column; gap:16px;">
           <h3 style="margin:0; color:var(--color-text); font-size:1.1rem;">Cancelar Envio?</h3>
           <p style="margin:0; color:var(--color-text-secondary); line-height:1.5;">
               Isso interromperá todas as operações de upload e sincronização em andamento.
           </p>
           <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:8px;">
               <button id="btnKeepUploading" type="button" class="btn btn--text" style="color:var(--color-text);">Não, continuar</button>
               <button id="btnConfirmCancel" type="button" class="btn btn--sm" style="background:rgba(220, 53, 69, 0.1); color:#ff6b6b; border:1px solid rgba(220, 53, 69, 0.3);">Sim, cancelar</button>
           </div>
       </div>
    </div>
    `;
}
