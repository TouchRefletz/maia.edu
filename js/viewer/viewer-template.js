/**
 * Retorna a string HTML completa do visualizador.
 * Recebe 'args' para preencher dados dinâmicos como o título.
 * NOTA: Todos os onclicks foram removidos e substituídos por IDs.
 */
export function montarTemplateViewer(args) {
  return `
    <div id="pdfViewerContainer" class="fade-in">
        <header id="viewerHeader">
            <div class="header-left">
                <img src="logo.png" class="header-logo" alt="Logo">
                <span class="header-title">Maia.api - ${args.rawTitle}</span>
            </div>

            <div class="header-actions">
                <button id="btnFecharViewer" class="btn btn--sm btn--secondary">✕ Fechar</button>
            </div>
        </header>

        <!-- FLOATING CLOSE BUTTON (Top Right) -->
        <button id="btnFloatingClose" class="floating-close-btn mobile-only">✕</button>

        <!-- FLOATING TOOLS TOGGLE (Bottom Right) -->
        <button id="btnMobileTools" class="floating-tools-btn mobile-only">⚙️</button>

        <!-- UNIFIED FLOATING TOOLS PANEL (Bottom, Initially Hidden) -->
        <div id="floatingToolsPanel" class="floating-bottom-panel hidden mobile-only">
             <div class="tools-row">
                 <div class="tool-group">
                     <button id="btnPrevMobile" class="btn-icon">◀</button>
                     <span id="pageNumMobile">Pg 1</span>
                     <button id="btnNextMobile" class="btn-icon">▶</button>
                 </div>
                 <div class="tool-divider"></div>
                 <div class="tool-group">
                     <button id="btnZoomOutMobile" class="btn-icon">-</button>
                     <span id="zoomLevelMobile">100%</span>
                     <button id="btnZoomInMobile" class="btn-icon">+</button>
                 </div>
             </div>
        </div>


        <div id="viewerBody">
            <!-- SIDEBAR (Panel) -->
            <aside id="viewerSidebar">
                <!-- Conteúdo será injetado via JS (sidebar-cropper.js) -->
            </aside>
            
            <!-- RESIZER HANDLE -->
            <div id="sidebarResizer"></div>

            <main id="viewerMain">
                <section class="pdf-panel" id="panelProva">
                    <div class="panel-label">
                        <div class="pdf-controls-box">
                            <label class="control-label">Navegação</label>
                            <div class="control-row">
                                <button id="btn-prev" class="btn-icon">◀</button>
                                <span id="page_num">Pag 1</span>
                                <button id="btn-next" class="btn-icon">▶</button>
                            </div>
                        </div>
                        <div class="pdf-controls-box">
                            <label class="control-label">Zoom</label>
                            <div class="control-row">
                                <button id="btnZoomOut" class="btn-icon">-</button>
                                <span id="zoom_level">100%</span>
                                <button id="btnZoomIn" class="btn-icon">+</button>
                            </div>
                        </div>
                    </div>

                    <div class="viewer-viewport-wrapper" style="position: relative; flex: 1; overflow: hidden; display: flex; flex-direction: column;">
                        <div id="ai-glow-overlay" class="viewer-glow-overlay"></div>
                        <div id="canvasContainer" class="canvas-wrapper">
                            <!-- Canvas das páginas serão inseridos via JS (renderAllPages) -->
                        </div>
                    </div>
                </section>
            </main>
        </div>

        <div id="floatingActionParams" class="hidden">
            <button class="flyingBtn btn--success" data-action="confirm-crop">✅ Confirmar Seleção</button>
            <button class="flyingBtn btn--danger" data-action="cancel-crop">✕ Cancelar</button>
        </div>

        <div id="cropConfirmModal" class="custom-modal-overlay">
            <div class="custom-modal-content">
                <h3 style="margin:0; color: var(--color-text)">Imagens Selecionadas (<span id="countImagens">0</span>)</h3>
                <p style="color: var(--color-text-secondary); font-size: 0.9em;">Revise os recortes antes de enviar.</p>
                
                <div id="cropPreviewGallery" class="crop-preview-gallery">
                </div>

                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <button id="btnModalMaisRecorte" class="btn btn--secondary" style="flex: 1;">➕ Recortar Outra Parte</button>
                    <button id="btnModalProcessar" class="btn btn--primary" style="flex: 1;">🚀 Processar Tudo</button>
                </div>
                <button id="btnModalCancelarTudo" class="btn btn--sm btn--outline" style="margin-top:10px; border:none; color:#aaa">Cancelar tudo</button>
            </div>
        </div>
    </div>
    `;
}
