

import { getProxyPdfUrl } from '../api/worker.js';

// NOTA: Importamos pdfjsLib do escopo global (assumindo que já foi carregado via CDN no index.html)
// ou import dinamico se preferir. Para garantir isolamento, vamos configurar o worker aqui se precisar.

/**
 * Visualizador "Preview" Simplificado e Isolado.
 * Corrige problemas de conflito de IDs e adiciona UX refinada (spinner, error handling).
 */
export async function gerarPreviewPDF(args) {
    const { rawTitle, fileProva, fileGabarito } = args;

    // 1. Limpa Viewer Antigo
    const existing = document.getElementById('previewModalContainer');
    if (existing) existing.remove();

    // 2. Estrutura HTML do Modal
    // Usamos IDs unicos com prefixo "pv_" para evitar colisão com o viewer principal
    const modalHTML = `
    <div id="previewModalContainer" class="preview-modal" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.9); z-index:10000; display:flex; flex-direction:column;">
        
        <!-- HEADER -->
        <header style="height:60px; background:var(--color-surface); display:flex; align-items:center; justify-content:space-between; padding:0 25px; border-bottom:1px solid var(--color-border); box-shadow:0 4px 12px rgba(0,0,0,0.1);">
            <div style="display:flex; align-items:center; gap:15px;">
                <!-- Logo do Usuário -->
                <div style="width:36px; height:36px; border-radius:50%; overflow:hidden; display:flex; align-items:center; justify-content:center; background:var(--color-surface-hover);">
                    <img src="public/logo.png" alt="Logo" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='./logo.png'">
                </div>
                <div style="display:flex; flex-direction:column;">
                    <span style="font-weight:600; font-size:1rem; color:var(--color-text);">${rawTitle}</span>
                    <span style="font-size:0.8rem; color:var(--color-text-secondary); display:flex; gap:10px; align-items:center;">
                        Visualização Rápida
                    </span>
                </div>
            </div>
            
            <div style="display:flex; gap:10px;">
                <!-- Toggle Mode (Injetado via JS se precisar) -->
                <div id="pv_modeToggle" class="mode-toggle" style="margin-right:20px; display:none;">
                    <button id="pv_btnProva" class="mode-toggle__btn is-active">Prova</button>
                    <button id="pv_btnGabarito" class="mode-toggle__btn">Gabarito</button>
                </div>

                <button id="pv_btnClose" class="btn btn--secondary btn--sm" style="border:1px solid var(--color-border);">
                    ✕ Fechar
                </button>
            </div>
        </header>

        <!-- BODY -->
        <div style="flex:1; position:relative; overflow:hidden; display:flex; flex-direction:column; background:var(--color-background);">
            
            <!-- Toolbar Flutuante -->
            <div style="position:absolute; bottom:30px; left:50%; transform:translateX(-50%); z-index:100; 
                        background:var(--color-surface); padding:8px 16px; border-radius:50px; 
                        box-shadow:0 4px 20px rgba(0,0,0,0.3); border:1px solid var(--color-border); display:flex; gap:15px; align-items:center;">
                
                <button id="pv_btnPrev" class="btn-icon" title="Anterior">◀</button>
                <span id="pv_pageLabel" style="font-size:0.9rem; font-variant-numeric:tabular-nums; color:var(--color-text); min-width:60px; text-align:center;">
                    ...
                </span>
                <button id="pv_btnNext" class="btn-icon" title="Próxima">▶</button>
                
                <div style="width:1px; height:20px; background:var(--color-border);"></div>
                
                <button id="pv_btnZoomOut" class="btn-icon" title="Diminuir Zoom">-</button>
                <div style="background:var(--color-surface-hover); padding:2px 8px; border-radius:4px; font-size:0.85rem; min-width:45px; text-align:center;">
                    <span id="pv_zoomLabel">100%</span>
                </div>
                <button id="pv_btnZoomIn" class="btn-icon" title="Aumentar Zoom">+</button>
            </div>

            <!-- Loading Overlay Centered -->
            <div id="pv_loadingOverlay" class="spinner-overlay" style="display:flex;">
                <img src="public/logo.png" class="spinner-logo" alt="Carregando..." onerror="this.src='./logo.png'">
            </div>

            <!-- Canvas Container (Area de Scroll) -->
            <div id="pv_scrollContainer" style="flex:1; overflow:auto; display:flex; justify-content:center; align-items:flex-start; padding:40px;">
                <div id="pv_canvasWrapper" style="position:relative; box-shadow:0 10px 40px rgba(0,0,0,0.5);">
                    <canvas id="pv_canvas" style="display:block;"></canvas>
                </div>
            </div>

        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // --- STATE MANAGER ISOLADO ---
    const state = {
        pdfDoc: null,
        pageNum: 1,
        scale: 1.0, // Desktop default
        isRendering: false,
        pageNumPending: null,
        currentUrl: null,
        isLoading: false // Guard para evitar múltiplos cliques
    };

    // --- ELEMENTS ---
    const els = {
        container: document.getElementById('previewModalContainer'),
        scroll: document.getElementById('pv_scrollContainer'),
        canvas: document.getElementById('pv_canvas'),
        spinner: document.getElementById('pv_loadingOverlay'),
        label: document.getElementById('pv_pageLabel'),
        modeToggle: document.getElementById('pv_modeToggle'),
        btnProva: document.getElementById('pv_btnProva'),
        btnGabarito: document.getElementById('pv_btnGabarito')
    };

    // --- UTILS ---

    const handleError = (msg) => {
        if (!els.spinner) return;
        els.spinner.innerHTML = `
            <div style="text-align:center; color:#ff6b6b; padding:20px; background:rgba(0,0,0,0.8); border-radius:12px;">
                <div style="font-size:2rem; margin-bottom:10px;">⚠️</div>
                <h3 style="margin:0; color:white;">Erro ao carregar PDF</h3>
                <p style="margin:5px 0 0 0; font-size:0.9rem; opacity:0.8;">${msg}</p>
                <button id="pv_btnCloseError" style="margin-top:15px; padding:8px 16px; border-radius:6px; border:none; background:white; color:black; cursor:pointer;">Fechar</button>
            </div>
        `;
        document.getElementById('pv_btnCloseError').onclick = () => document.getElementById('previewModalContainer').remove();
    };

    // Using centralized proxy helper
    const getProxyUrl = getProxyPdfUrl;

    // --- PDF RENDER LOGIC (CORE) ---
    const renderPage = async (num) => {
        state.isRendering = true;

        try {
            const page = await state.pdfDoc.getPage(num);

            // Adjust scale for mobile if needed (on first load)
            // Mas aqui respeitamos o state.scale
            const viewport = page.getViewport({ scale: state.scale });

            els.canvas.height = viewport.height;
            els.canvas.width = viewport.width;

            const renderContext = {
                canvasContext: els.canvas.getContext('2d'),
                viewport: viewport
            };

            const renderTask = page.render(renderContext);

            await renderTask.promise;

            state.isRendering = false;

            // Update UI
            els.label.textContent = `${num} / ${state.pdfDoc.numPages}`;
            els.spinner.style.display = 'none'; // Hide spinner on success

            if (state.pageNumPending !== null) {
                renderPage(state.pageNumPending);
                state.pageNumPending = null;
            }

        } catch (err) {
            state.isRendering = false;
            console.error("PV Render Error:", err);
            // Non-fatal render error?
        }
    };

    const queueRenderPage = (num) => {
        if (state.isRendering) {
            state.pageNumPending = num;
        } else {
            renderPage(num);
        }
    };

    const loadRef = async (url) => {
        // Guard Check
        if (state.isLoading) return;

        // Robust Decoding Initial
        let cleanUrlInput = url;
        try {
            let i = 0;
            while (cleanUrlInput.includes('%') && i < 5) {
                let d = decodeURIComponent(cleanUrlInput);
                if (d === cleanUrlInput) break;
                cleanUrlInput = d;
                i++;
            }
        } catch (e) { }

        // Se já é um link de proxy, decodifica o parâmetro 'url' para evitar double-proxying
        if (cleanUrlInput.includes('/proxy-pdf?url=')) {
            try {
                const urlObj = new URL(cleanUrlInput);
                const innerUrl = urlObj.searchParams.get('url');
                if (innerUrl) cleanUrlInput = innerUrl;
            } catch (e) { }
        }

        if (state.currentUrl === cleanUrlInput && state.pdfDoc) return; // Já carregado

        state.isLoading = true;

        // Reset State
        state.pageNum = 1;
        state.isRendering = false;
        state.pageNumPending = null;
        state.currentUrl = cleanUrlInput;

        els.spinner.style.display = 'flex'; // Show spinner
        els.spinner.innerHTML = `<img src="public/logo.png" class="spinner-logo" alt="Carregando..." onerror="this.src='./logo.png'">`;

        try {
            const finalUrl = getProxyUrl(cleanUrlInput);
            console.log("PV Loading:", finalUrl);

            if (typeof pdfjsLib !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            }

            const loadingTask = pdfjsLib.getDocument(finalUrl);
            state.pdfDoc = await loadingTask.promise;

            // Setup Initial Scale (Fit Width)
            const page = await state.pdfDoc.getPage(1);
            const containerWidth = els.scroll.clientWidth - 80;
            const unscaledViewport = page.getViewport({ scale: 1 });
            const fitScale = containerWidth / unscaledViewport.width;

            state.scale = Math.min(Math.max(fitScale, 0.6), 1.5);
            updateUI();
            renderPage(state.pageNum);

        } catch (err) {
            console.error("PV Load Error:", err);
            let msg = "Arquivo não encontrado ou inacessível (Erro 404).";

            // Try Direct Load as absolute last resort (Safe fallback)
            try {
                console.log("PV: Proxy failed, trying direct load...");
                const loadingTask = pdfjsLib.getDocument(cleanUrlInput);
                state.pdfDoc = await loadingTask.promise;

                const page = await state.pdfDoc.getPage(1);
                const containerWidth = els.scroll.clientWidth - 80;
                const unscaledViewport = page.getViewport({ scale: 1 });
                const fitScale = containerWidth / unscaledViewport.width;
                state.scale = Math.min(Math.max(fitScale, 0.6), 1.5);
                updateUI();
                renderPage(state.pageNum);
            } catch (retryErr) {
                console.error("PV Direct Retry Failed:", retryErr);
                handleError(msg);
            }
        } finally {
            state.isLoading = false;
        }
    };

    // --- CONTROLS ---

    document.getElementById('pv_btnNext').onclick = () => {
        if (state.pageNum >= state.pdfDoc.numPages) return;
        state.pageNum++;
        queueRenderPage(state.pageNum);
    };

    document.getElementById('pv_btnPrev').onclick = () => {
        if (state.pageNum <= 1) return;
        state.pageNum--;
        queueRenderPage(state.pageNum);
    };

    // --- UI UPDATER ---
    const updateUI = () => {
        if (els.label) els.label.textContent = `${state.pageNum} / ${state.pdfDoc?.numPages || '?'}`;
        const zoomStr = Math.round(state.scale * 100) + '%';
        const zoomLabel = document.getElementById('pv_zoomLabel'); // Busca dinâmica
        if (zoomLabel) zoomLabel.textContent = zoomStr;
    };

    document.getElementById('pv_btnZoomIn').onclick = () => {
        if (state.scale >= 3) return;
        state.scale += 0.2;
        updateUI(); // Immediate feedback
        queueRenderPage(state.pageNum);
    };

    document.getElementById('pv_btnZoomOut').onclick = () => {
        if (state.scale <= 0.4) return;
        state.scale -= 0.2;
        updateUI(); // Immediate feedback
        queueRenderPage(state.pageNum);
    };

    document.getElementById('pv_btnClose').onclick = () => {
        // Cleanup State
        state.pdfDoc = null;
        state.pageNum = 1;
        state.isRendering = false;

        els.container.remove();
        // Clean references/memory if needed
    };

    // --- TOGGLE LOGIC ---
    if (fileGabarito) {
        els.modeToggle.style.display = 'flex';

        els.btnProva.onclick = () => {
            if (state.isLoading) return; // LOCK
            els.btnProva.classList.add('is-active');
            els.btnGabarito.classList.remove('is-active');
            loadRef(fileProva);
        };

        els.btnGabarito.onclick = () => {
            if (state.isLoading) return; // LOCK
            els.btnGabarito.classList.add('is-active');
            els.btnProva.classList.remove('is-active');
            loadRef(fileGabarito);
        };
    }

    // --- INIT ---
    // Start with Prova
    loadRef(fileProva);
}
