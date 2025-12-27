import { getProxyPdfUrl, realizarPesquisa } from '../api/worker.js';
import { construirSkeletonLoader, limparResultadosAnteriores } from '../sidebar/thoughts-base.js';
import { pushThought } from '../sidebar/thoughts-scroll.js';
import { showTitleConfirmationModal } from '../ui/modal-confirm.js';
import { gerarVisualizadorPDF } from '../viewer/events.js';
import { gerarPreviewPDF } from '../viewer/viewer-preview.js';

export function setupSearchLogic() {
    const btnSearch = document.getElementById('btnSearch');
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    const btnShowUpload = document.getElementById('btnShowUpload');
    const btnBackToSearch = document.getElementById('btnBackToSearch');

    const searchContainer = document.getElementById('searchContainer');
    const manualUploadContainer = document.getElementById('manualUploadContainer');

    // --- Toggles de Interface ---
    if (btnShowUpload) {
        btnShowUpload.addEventListener('click', () => {
            searchContainer.classList.add('hidden');
            searchContainer.style.display = 'none';

            manualUploadContainer.classList.remove('hidden');
            manualUploadContainer.style.display = 'flex';
            manualUploadContainer.classList.add('fade-in-centralized');
        });
    }

    if (btnBackToSearch) {
        btnBackToSearch.addEventListener('click', () => {
            manualUploadContainer.classList.add('hidden');
            manualUploadContainer.style.display = 'none';

            searchContainer.classList.remove('hidden');
            searchContainer.style.display = 'flex';
            searchContainer.classList.add('fade-in-centralized');
        });
    }

    // --- Lógica de Pesquisa ---
    const doSearch = async () => {
        const query = searchInput.value.trim();
        if (!query) return;

        // 1. Prepara a área de resultados e INSERE O CONTAINER DE PENSAMENTOS
        searchResults.innerHTML = ''; // Limpa tudo

        // Cria um container específico para os pensamentos dentro do results
        const thoughtsContainer = document.createElement('div');
        thoughtsContainer.style.width = '100%';
        thoughtsContainer.style.maxWidth = '800px';
        thoughtsContainer.style.marginBottom = '30px';
        searchResults.appendChild(thoughtsContainer);

        // Usa a mesma função do sidebar para criar o loader/estrutura
        limparResultadosAnteriores(thoughtsContainer);
        const refsLoader = construirSkeletonLoader(thoughtsContainer);

        // Configura o texto inicial do loader
        if (refsLoader && refsLoader.textElement) {
            refsLoader.textElement.innerText = "Pesquisando e analisando...";
        }

        try {
            const prompt = `Você é um agente de busca de provas (vestibulares/ENEM/concursos) focado em encontrar ARQUIVOS PDF e retornar pares (prova, gabarito).

TAREFA

Pesquise na web.

Entrada do usuário (query): "${query}"

OBJETIVO (OBRIGATÓRIO)

Retornar TODAS as versões encontradas da prova relacionadas à query (ex.: ENEM: 1º dia e 2º dia, todas as cores/cadernos e tipos disponíveis como impresso/digital/reaplicação/adaptado, quando existirem PDFs).

Retornar SOMENTE links diretos para arquivos PDF.

Retornar resultados SEMPRE no formato de pares: uma prova ↔ um gabarito.

Proibir páginas HTML no output (páginas oficiais podem ser usadas apenas como pista, mas NUNCA retornadas).

REGRA “UMA PROVA ↔ UM GABARITO” (OBRIGATÓRIA)

Para cada PROVA (um PDF), encontre o GABARITO correspondente (um PDF) e gere um item de resultado contendo:
{ prova_url: "...pdf", gabarito_url: "...pdf" }

O “match” deve ser feito pela MESMA variante quando possível (mesmo ano + mesmo dia + mesmo caderno/código/cor/tipo/idioma).

É proibido associar um gabarito de outra variante (ex.: outro caderno/cor/dia) só para “preencher”.

EXCEÇÃO (SOMENTE NO GABARITO): você pode repetir o MESMO arquivo de gabarito em mais de um item SE (e somente se) o PDF do gabarito explicitamente atender múltiplas provas/variantes (ex.: um gabarito único para dois cadernos no mesmo arquivo).

Se não existir gabarito em PDF para uma prova específica, NÃO inclua essa prova em results (prefira retornar menos itens, porém corretamente pareados).

ESTRATÉGIA DE BUSCA (faça em iterações)
A) Descoberta do “hub” e padrões

Busque por páginas oficiais apenas como pista (não retornar no output), para descobrir:

como a instituição organiza (por dia/cor/tipo)

padrões de nomes (ex.: D1/D2, CD1/CD2..., “impresso”, “digital”, “reaplicacao”, “adaptado”)

B) Coleta exaustiva por variantes (expansão)

A partir da query, expanda automaticamente as buscas para cobrir variações típicas:

“1º dia”, “2º dia”, “dia 1”, “dia 2”

“caderno”, “cor” (azul/amarelo/branco/rosa/verde etc.) e “CD1/CD2/…”

“prova”, “caderno de questões”, “PV”, “gabarito”, “GB”

“impresso”, “digital”, “reaplicação”, “PPL”, “leitor de tela”, “adaptado”

Use operadores para forçar PDF:

filetype:pdf

site:inep.gov.br OR site:download.inep.gov.br OR site:gov.br (ou domínio oficial equivalente da banca)

C) Pareamento (matching) e validação

Colete PDFs de prova e PDFs de gabarito.

Crie uma chave de variante para cada PDF (quando possível), extraída do nome do arquivo e/ou conteúdo do snippet:
variant_key := {ano, exame, dia, caderno_codigo, cor, tipo_aplicacao, idioma/opcao, modalidade}

Para cada prova, encontre o gabarito com a MESMA variant_key (ou o mais específico possível).

Remova duplicados por URL final.

VALIDAÇÃO RÍGIDA DE URL

Aceite somente URLs que terminam com “.pdf” (ignorando querystrings).

Descarte:

encurtadores

páginas HTML

links “download” sem arquivo .pdf direto

PDFs corrompidos/que não abrem (se isso puder ser inferido)

SAÍDA (OBRIGATÓRIA)

Retorne APENAS um JSON válido, sem markdown e sem texto extra.

Cada item de results DEVE conter prova_url e gabarito_url (ambos PDFs).

Ordene results por: dia (1, depois 2), depois por cor/caderno.

CONDIÇÃO DE FALHA

Se não encontrar NENHUM par (prova+gabarito) em PDF após as tentativas, retorne:
{ "query": "${query}", "results": [] }`;

            const SEARCH_SCHEMA = {
                "type": "object",
                "properties": {
                    "query": { "type": "string" },
                    "results": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": { "type": "string", "description": "Chave estável da variante (ex.: ENEM-2025-D2-CD7-AZUL-IMPRESSO)." },
                                "exam": { "type": "string", "description": "Ex.: ENEM." },
                                "year": { "type": "integer" },
                                "day": { "type": "integer", "enum": [1, 2] },
                                "booklet_code": { "type": "string", "description": "Ex.: CD7 (quando existir)." },
                                "color": { "type": "string", "description": "Ex.: Azul/Amarelo/Branco/Verde/Rosa (quando existir)." },
                                "application_type": { "type": "string", "description": "Ex.: impresso, digital, reaplicacao, PPL, adaptado (quando existir)." },
                                "prova_url": { "type": "string", "pattern": "\\\\.pdf(\\\\?.*)?$" },
                                "gabarito_url": { "type": "string", "pattern": "\\\\.pdf(\\\\?.*)?$" },
                                "source_prova": { "type": "string" },
                                "source_gabarito": { "type": "string" }
                            },
                            "required": ["prova_url", "gabarito_url"]
                        }
                    }
                },
                "required": ["query", "results"]
            };

            // Handler para Thoughts (streaming e exibição)
            // Precisamos adaptar o pushThought para buscar o elemento correto 
            // já que o searchResults é recriado. Mas as funções do thoughts-scroll.js 
            // usam IDs globais ou elementos fixos. 
            // A função 'pushThought' busca pelo ID 'maiaThoughts'.
            // Como limpamos results e criamos novo loader com construirSkeletonLoader, ele cria id='maiaThoughts'.

            const handlers = {
                onThought: (text) => pushThought(text),
                onStatus: (status) => {
                    if (refsLoader && refsLoader.textElement) refsLoader.textElement.innerText = status;
                }
            };

            // Chama o Worker com Schema e Handlers
            const result = await realizarPesquisa(prompt, [], handlers, SEARCH_SCHEMA);

            // Remove o loader após concluir
            if (refsLoader && refsLoader.loadingContainer) {
                refsLoader.loadingContainer.remove();
            }

            // O Worker retorna o texto gerado (que deve ser JSON) no campo 'report'
            let data;
            try {
                const jsonString = result.report.replace(/```json/g, '').replace(/```/g, '').trim();
                data = JSON.parse(jsonString);
            } catch (parseErr) {
                console.warn('Erro ao parsear JSON da pesquisa:', parseErr, result.report);
                // Fallback apenas se houver sources e falhar JSON
                if (result.sources && result.sources.length > 0) {
                    data = {
                        results: result.sources.map(s => ({
                            exam: "Resultado da Web",
                            prova_url: s,
                            gabarito_url: null,
                            year: new Date().getFullYear()
                        }))
                    };
                } else {
                    throw new Error("Não foi possível processar os resultados.");
                }
            }

            // Renderiza Resultados Finais
            const listaResultados = data.results || data.resultados || [];

            if (listaResultados.length > 0) {
                // Cria Grid CONTAINER após remover o thoughts
                const grid = document.createElement('div');
                grid.style.display = 'grid';
                grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))';
                grid.style.gap = '20px';
                grid.style.width = '100%';
                searchResults.appendChild(grid);

                listaResultados.forEach(item => {
                    // Normalização dos dados
                    const titulo = item.titulo || `${item.exam || 'Prova'} ${item.year || ''} ${item.day ? '- Dia ' + item.day : ''} ${item.color ? '- ' + item.color : ''}`;
                    const descricao = item.descricao || `${item.application_type || ''} ${item.booklet_code || ''}`.trim() || 'Prova Oficial';
                    let urlProva = item.prova_url || item.url;
                    let urlGabarito = item.gabarito_url || null;

                    // --- URL CLEANING UTILITY ---
                    const cleanPdfUrl = (url) => {
                        if (!url) return null;
                        let clean = url.trim();

                        // FIX: Decode recursivo (Users request)
                        try {
                            let i = 0;
                            while (clean.includes('%') && i < 5) {
                                let d = decodeURIComponent(clean);
                                if (d === clean) break;
                                clean = d;
                                i++;
                            }
                        } catch (e) { }

                        // Fix common issues
                        if (clean.startsWith('//')) clean = 'https:' + clean;
                        if (!clean.startsWith('http')) clean = 'https://' + clean;
                        // Remove spaces acting as typos in some scrapers
                        clean = clean.replace(/\s/g, '%20');
                        return clean;
                    };

                    urlProva = cleanPdfUrl(urlProva);
                    urlGabarito = cleanPdfUrl(urlGabarito);

                    const card = document.createElement('div');
                    card.className = 'preview-card'; // New CSS Class
                    // Styles are now in CSS, removing inline styles

                    // Badges
                    let badgesHtml = '';
                    if (item.year) badgesHtml += `<span class="badge badge--primary">${item.year}</span>`;
                    if (urlGabarito) badgesHtml += `<span class="badge badge--success">Com Gabarito</span>`;

                    // New Card Structure
                    card.innerHTML = `
                        <!-- 1. Background Image/Canvas -->
                        <div class="preview-card__thumb">
                             <img src="public/logo.png" class="preview-card__loader" alt="Carregando">
                             <canvas style="display:none;"></canvas>
                        </div>

                        <!-- 2. Badges (Absolute Top Right) -->
                        <div class="preview-card__badges">
                             ${badgesHtml}
                        </div>

                        <!-- 3. Gradient Overlay -->
                        <div class="preview-card__overlay"></div>

                        <!-- 4. Floating Content (Bottom) -->
                        <div class="preview-card__content">
                             <h3 class="preview-card__title">${titulo}</h3>
                             <!-- Subtitle removed as requested -->
                             
                             <div class="preview-card__actions-row" style="display:flex; gap:10px; margin-top:10px;">
                                <button class="preview-card__btn-extract" style="flex:1; background:var(--color-primary); color:white; border:none; padding:8px; border-radius:6px; cursor:pointer; font-weight:600; font-size:0.9rem;">
                                    Extrair
                                </button>
                                <button class="preview-card__btn-preview" style="flex:1; background:rgba(255,255,255,0.1); color:white; border:1px solid rgba(255,255,255,0.2); padding:8px; border-radius:6px; cursor:pointer; font-size:0.9rem;">
                                    Visualizar
                                </button>
                             </div>
                        </div>
                    `;

                    // Lógica de Cliques (Delegation)
                    const btnExtract = card.querySelector('.preview-card__btn-extract');
                    const btnPreview = card.querySelector('.preview-card__btn-preview');

                    // 1. Ação Extrair (Abrir Viewer Principal)
                    btnExtract.onclick = async (e) => {
                        e.stopPropagation(); // Impede trigger do card (se houver)
                        if (!urlProva) {
                            alert('URL da prova não encontrada.');
                            return;
                        }

                        // Show confirmation modal
                        const confirmedTitle = await showTitleConfirmationModal(titulo);
                        if (!confirmedTitle) return; // Cancelled

                        // Inicia o Viewer Completo
                        // Prepara URLs com Proxy para o Viewer Main
                        const finalUrlProva = getProxyPdfUrl(urlProva);
                        const finalUrlGabarito = urlGabarito ? getProxyPdfUrl(urlGabarito) : null;

                        gerarVisualizadorPDF({
                            title: `(${confirmedTitle})`,
                            rawTitle: confirmedTitle,
                            fileProva: finalUrlProva,
                            fileGabarito: finalUrlGabarito,
                            gabaritoNaProva: false
                        });
                    };

                    // 2. Ação Visualizar (Abrir Modal Preview)
                    const openPreview = () => {
                        if (!urlProva) {
                            alert('URL da prova não encontrada.');
                            return;
                        }

                        const originalText = btnPreview.innerHTML;
                        btnPreview.innerHTML = '⏳';

                        gerarPreviewPDF({
                            title: `(${titulo})`,
                            rawTitle: titulo,
                            fileProva: urlProva,
                            fileGabarito: urlGabarito,
                            gabaritoNaProva: false
                        }).then(() => {
                            btnPreview.innerHTML = originalText;
                        }).catch(err => {
                            console.error(err);
                            btnPreview.innerHTML = originalText;
                        });
                    };

                    btnPreview.onclick = (e) => {
                        e.stopPropagation();
                        openPreview();
                    };

                    // Card click faz preview também (opcional, mantendo UX anterior se clicar fora dos botões)
                    card.onclick = (e) => {
                        // Se clicou nos botões já foi tratado
                        openPreview();
                    };

                    grid.appendChild(card);

                    // Trigger Thumbnail Generation
                    if (urlProva) {
                        // Pass loader element correctly (no longer .thumb-loader, but .preview-card__loader)
                        generateThumbnail(urlProva, card.querySelector('canvas'), card.querySelector('.preview-card__loader'));
                    }
                });
            } else {
                searchResults.innerHTML = `
            <div style="text-align:center; color:var(--color-text-secondary); padding:40px; background:var(--color-surface); border-radius:12px;">
                <h3>Nenhum resultado encontrado</h3>
                <p>Tente ser mais específico na busca (ex: "ENEM 2023 2º dia azul").</p>
            </div>
        `;
            }

        } catch (e) {
            console.error(e);
            // Mantém o thoughts container visível se deu erro? Não, remove
            const loader = searchResults.querySelector('#ai-skeleton-loader');
            if (loader) loader.remove();

            searchResults.innerHTML += `
        <div style="text-align:center; color:var(--color-warning); padding:20px; border:1px dashed var(--color-warning);">
            <p>Ocorreu um erro durante a pesquisa.</p>
            <small>${e.message}</small> <br><br>
            <button class="btn btn--sm btn--outline" onclick="this.parentElement.remove()">Tentar novamente</button>
        </div>
      `;
        }
    };

    if (btnSearch) {
        btnSearch.addEventListener('click', doSearch);
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') doSearch();
        });
        setTimeout(() => searchInput.focus(), 100);
    }
}

async function generateThumbnail(url, canvas, loader) {
    if (!url) return;
    try {
        const finalUrl = getProxyPdfUrl(url);

        if (typeof pdfjsLib !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        // Limit to page 1, distinct intent
        const loadingTask = pdfjsLib.getDocument(finalUrl);
        const pdfDoc = await loadingTask.promise;
        const page = await pdfDoc.getPage(1);

        const viewport = page.getViewport({ scale: 0.6 }); // Small thumbnail
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;

        // Show canvas, hide loader
        canvas.style.display = 'block';
        if (loader) loader.style.display = 'none';

    } catch (err) {
        // Silent fail for thumbnail
        console.warn('Thumb fail:', err);
        if (loader) loader.innerHTML = '<span style="font-size:2rem; opacity:0.2;">📄</span>';
    }
}
