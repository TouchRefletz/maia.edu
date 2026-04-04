import React, { useEffect, useRef, useState } from 'react';
import { showPdfUrlModal } from './modal-confirm';

// DECLARAÇÃO GLOBAL DO PDF.JS (já carregado no index.html globalmente)
declare const pdfjsLib: any;

interface PdfEmbedRendererProps {
  // URLs
  pdfUrl?: string | null;
  pdf_url?: string | null; // Alias
  previewUrl?: string | null; // Alias

  // Page/Zoom
  page?: number;     // Standard
  pdf_page?: number; // User JSON
  
  zoom?: number;     // Standard
  pdf_zoom?: number; // User JSON

  // Crop Coordinates (Flat)
  pdf_left?: number;
  pdf_top?: number;
  pdf_width?: number | string;
  pdf_height?: number | string;
  
  // Nested legacy support (optional)
  cropDetails?: {
    pdf_left: number;
    pdf_top: number;
    pdf_width: number | string;
    pdf_height: number | string;
    pdfjs_source_w?: number;
    pdfjs_source_h?: number;
    pdfjs_x?: number;
    pdfjs_y?: number;
    pdfjs_crop_w?: number;
    pdfjs_crop_h?: number;
  };

  // Fallback data for PDF.js (Flat)
  pdfjs_source_w?: number;
  pdfjs_source_h?: number;
  pdfjs_x?: number;
  pdfjs_y?: number;
  pdfjs_crop_w?: number;
  pdfjs_crop_h?: number;

  style?: React.CSSProperties;
  
  // Se true, escala o embed proporcionalmente para caber no container pai
  scaleToFit?: boolean;
  
  // Força um render mode específico (para debug/toggle)
  forceRenderMode?: 'embed' | 'pdfjs' | 'puter' | 'auto';

  // Se true, não usa arquivo automático do viewer (prova que está aberta)
  readOnly?: boolean;
}

/**
 * Renderizador Híbrido com Toggle (3 modos):
 * 1. Modo 'puter' (PADRÃO): Usa iframe + puter.fetch() para bypass CORS universal.
 * 2. Modo 'embed': Usa <embed> nativo (Chrome/Edge) para fidelidade 100%.
 * 3. Modo 'pdfjs': Usa <canvas> (PDF.js) local com suporte a upload manual.
 * Fallback automático: puter → embed → pdfjs
 */
export const PdfEmbedRenderer: React.FC<PdfEmbedRendererProps> = (props) => {
  // 1. Normalize Props
  const fileUrl = props.pdfUrl || props.pdf_url || props.previewUrl || null;
  const pageNum = props.page || props.pdf_page || 1;
  const zoomLevel = props.zoom || props.pdf_zoom || 200;
  const scaleToFit = props.scaleToFit ?? false;

  // Extract crop details from flat props OR nested object
  const c = {
    left: props.pdf_left ?? props.cropDetails?.pdf_left ?? 0,
    top: props.pdf_top ?? props.cropDetails?.pdf_top ?? 0,
    width: props.pdf_width ?? props.cropDetails?.pdf_width ?? 600,
    height: props.pdf_height ?? props.cropDetails?.pdf_height ?? 400,
    
    // PDFJS
    sW: props.pdfjs_source_w ?? props.cropDetails?.pdfjs_source_w ?? 2480,
    sH: props.pdfjs_source_h ?? props.cropDetails?.pdfjs_source_h,
    X: props.pdfjs_x ?? props.cropDetails?.pdfjs_x ?? 0,
    Y: props.pdfjs_y ?? props.cropDetails?.pdfjs_y ?? 0,
    cW: props.pdfjs_crop_w ?? props.cropDetails?.pdfjs_crop_w ?? 600,
    cH: props.pdfjs_crop_h ?? props.cropDetails?.pdfjs_crop_h ?? 400
  };

  const style = props.style;

  // Detectar navegador (Simples, igual ao index.html de referência)
  const isChromeOrEdge = /Chrome|Edg/.test(navigator.userAgent);
  
  // [ROBUSTNESS] Global URL override logic
  // @ts-ignore
  const globalPdfUrl = typeof window !== 'undefined' ? (window.__pdfOriginalUrl || window.__pdfDownloadUrl) : null;
  const baseUrl = (fileUrl && typeof fileUrl === 'string' && fileUrl.startsWith('blob:') && globalPdfUrl) ? globalPdfUrl : fileUrl;
  
  // [NEW] URL manual fornecida pelo usuário (prioridade sobre tudo)
  const [manualPdfUrl, setManualPdfUrl] = useState<string>('');
  const [manualUrlInput, setManualUrlInput] = useState<string>('');
  const effectiveUrl = manualPdfUrl || baseUrl;

  // Estado do toggle - inicia com 'puter' como padrão quando há URL
  // Fallback: puter → embed (Chrome/Edge) → pdfjs
  const [renderMode, setRenderMode] = useState<'puter' | 'embed' | 'pdfjs'>(
    props.forceRenderMode === 'pdfjs' ? 'pdfjs' :
    props.forceRenderMode === 'embed' ? 'embed' :
    props.forceRenderMode === 'puter' ? 'puter' :
    'puter' // Default: sempre tenta puter primeiro
  );
  
  // [NEW] Estado para rastrear falha do modo Puter (iframe)
  const [puterFailed, setPuterFailed] = useState(false);
  // [NEW] Dimensões reais do conteúdo do iframe (reportadas pelo viewer)
  const [puterIframeHeight, setPuterIframeHeight] = useState<number | null>(null);

  const [fallbackError, setFallbackError] = useState<string | null>(null);
  const [embedFailed, setEmbedFailed] = useState(false); // [NEW] Detecta falha do embed
  const [hasUploadedFile, setHasUploadedFile] = useState(false); // [NEW] Rastreia upload de arquivo
  const [isLoadingLocal, setIsLoadingLocal] = useState(false); // [FIX] Previne re-render durante carregamento
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendered, setIsRendered] = useState(false);
  const [retryRender, setRetryRender] = useState(0); // [FIX] Força re-tentativa quando canvas não está pronto
  const [externalFileVersion, setExternalFileVersion] = useState(0); // [FIX] Rastreia quando arquivo externo é carregado
  
  // [FIX] Refs para controle de render concorrente
  const currentRenderTaskRef = useRef<any>(null); // Referência ao renderTask atual do PDF.js
  const isRenderingRef = useRef(false); // Flag para evitar múltiplos renders simultâneos
  const pdfDocRef = useRef<any>(null); // Cache do documento PDF carregado
  
  // Ref para o container externo (para medir o pai)
  const containerRef = useRef<HTMLDivElement>(null);
  // Scale dinâmico calculado com base no tamanho do pai
  const [dynamicScale, setDynamicScale] = useState(1);

  // Dimensões originais do crop em pixels (calculadas fora do if para usar no effect)
  // [FIX] Se width for %, usaremos o cW (crop width pixel) ou fallback 600
  const isPercentWidth = typeof c.width === 'string' && c.width.includes('%');
  const origWidth = isPercentWidth 
    ? (c.cW || 600) 
    : (typeof c.width === 'number' ? c.width : parseInt(c.width as string) || 600);
  const origHeight = typeof c.height === 'number' ? c.height : parseInt(c.height as string) || 400;

  // [RESTORED] Check if we need scale logic (Only for Embed mode)
  useEffect(() => {
    // We only need to calculate scale if we are in embed mode AND scaleToFit is on
    if (!scaleToFit || !containerRef.current) return;

    const calculateScale = () => {
      // Only strictly necessary for Embed, but harmless to calc for both
      const parent = containerRef.current?.parentElement;
      if (!parent) return;
      
      const parentWidth = parent.clientWidth;
      const availableWidth = parentWidth - 24; // Margin safety
      
      // [FIX] Proportional scaling for both dimensions
      const widthScale = availableWidth < origWidth ? availableWidth / origWidth : 1;
      
      // Calculate height after width scaling
      // [FIX] Added even more padding (120px) to ensure disclaimer has breathing room
      const heightAfterWidthScale = (origHeight + 120) * widthScale;
      const maxAllowedHeight = window.innerHeight * 0.8;
      const heightScale = heightAfterWidthScale > maxAllowedHeight ? maxAllowedHeight / heightAfterWidthScale : 1;
      
      setDynamicScale(widthScale * heightScale); 
    };

    calculateScale();

    const resizeObserver = new ResizeObserver(() => calculateScale());
    const parent = containerRef.current?.parentElement;
    if (parent) resizeObserver.observe(parent);

    // Listener de redimensionamento da janela (para garantir recalculação em caso de resize do browser)
    window.addEventListener('resize', calculateScale);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', calculateScale);
    };
  }, [scaleToFit, origWidth, puterIframeHeight]);

  // Reset isRendered when switching modes
  useEffect(() => {
    if (renderMode === 'pdfjs') {
      setIsRendered(false);
      setFallbackError(null);
    }
    // [FIX] Reset embedFailed quando trocar de modo
    if (renderMode === 'embed') {
      setEmbedFailed(false);
    }
    if (renderMode === 'puter') {
      setPuterFailed(false);
    }
  }, [renderMode]);

  // [NEW] Listener para mensagens do iframe do puter viewer
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'pdfViewerReady') {
        if (event.data.success) {
          // Sucesso — atualiza dimensões exatas do iframe
          if (event.data.contentHeight) {
            console.log('[PdfEmbed] Recebeu dimensões do viewer:', event.data.contentWidth, 'x', event.data.contentHeight);
            setPuterIframeHeight(event.data.contentHeight);
          }
        } else {
          console.warn('[PdfEmbed] Puter viewer falhou, fazendo fallback...');
          setPuterFailed(true);
          // Fallback: puter → embed (Chrome/Edge) → pdfjs
          if (isChromeOrEdge) {
            setRenderMode('embed');
          } else {
            setRenderMode('pdfjs');
          }
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isChromeOrEdge]);

  // [FIX] Listener para detectar quando window.__pdfLocalFile é carregado externamente
  useEffect(() => {
    const handleExternalFile = () => {
      console.log("[PdfEmbed] Arquivo externo detectado via evento");
      
      // [FIX] Cancela qualquer render em andamento
      if (currentRenderTaskRef.current) {
        try {
          currentRenderTaskRef.current.cancel();
        } catch (e) {}
        currentRenderTaskRef.current = null;
      }
      
      // [FIX] Limpa cache do documento para forçar recarregamento
      pdfDocRef.current = null;
      isRenderingRef.current = false;
      
      setExternalFileVersion(prev => prev + 1);
      setIsRendered(false); // Força re-render
      setFallbackError(null); // Limpa erros anteriores
      setIsLoadingLocal(false); // Reset loading state
      
      // Se estiver em embed, muda para pdfjs (embed não suporta arquivo local)
      // MAS: só faz isso se NÃO estiver em readOnly (banco de questões)
      // Em readOnly sem URL, deve continuar mostrando "Visualização não disponível"
      if (renderMode === 'embed' && !props.readOnly) {
        setRenderMode('pdfjs');
      }
    };

    window.addEventListener('pdfLocalFileLoaded', handleExternalFile);
    
    // [FIX] Também verifica se arquivo já existe quando componente monta
    // @ts-ignore
    if (window.__pdfLocalFile && !isRendered && renderMode === 'pdfjs' && !isRenderingRef.current) {
      // Agenda um pequeno delay para garantir que o canvas esteja montado
      setTimeout(() => {
        setExternalFileVersion(prev => prev + 1);
      }, 100);
    }
    
    return () => {
      window.removeEventListener('pdfLocalFileLoaded', handleExternalFile);
      // [FIX] Cleanup: cancela render quando componente desmonta
      if (currentRenderTaskRef.current) {
        try {
          currentRenderTaskRef.current.cancel();
        } catch (e) {}
      }
    };
  }, [renderMode, isRendered]);

  // Render Page Helper (Defined outside useEffect to be accessible)
  const renderPageOnCanvas = async (pdfDoc: any) => {
        console.log("[PdfEmbed] renderPageOnCanvas chamado - pageNum:", pageNum);
        
        // [FIX] Se já está renderizando, ignora chamada duplicada
        if (isRenderingRef.current) {
          console.log("[PdfEmbed] Render já em andamento, ignorando chamada duplicada");
          return;
        }
        
        // [FIX] Cancela qualquer render anterior ainda em andamento
        if (currentRenderTaskRef.current) {
          try {
            console.log("[PdfEmbed] Cancelando render anterior...");
            currentRenderTaskRef.current.cancel();
          } catch (e) {
            // Ignora erros de cancelamento
          }
          currentRenderTaskRef.current = null;
        }
        
        isRenderingRef.current = true;
        
        try {
          const pdfPage = await pdfDoc.getPage(pageNum);
          const canvas = canvasRef.current;
          
          // [FIX] Guard against null canvas (not mounted or unmounted during async render)
          if (!canvas) {
            // [FIX] Limite máximo de tentativas para evitar loop infinito
            const MAX_RETRIES = 10;
            if (retryRender >= MAX_RETRIES) {
              console.error("[PdfEmbed] Canvas não está disponível após " + MAX_RETRIES + " tentativas");
              setFallbackError("Erro interno: Canvas não disponível");
              setIsLoadingLocal(false);
              isRenderingRef.current = false;
              return;
            }
            console.warn("[PdfEmbed] Canvas não está montado, agendando re-tentativa... (" + (retryRender + 1) + "/" + MAX_RETRIES + ")");
            isRenderingRef.current = false;
            // Agenda re-tentativa após um pequeno delay para dar tempo do canvas montar
            setTimeout(() => {
              setRetryRender(prev => prev + 1);
            }, 100);
            return;
          }
          
          const context = canvas.getContext('2d');
          if (!context) {
            console.error("[PdfEmbed] Não foi possível obter contexto 2D do canvas");
            isRenderingRef.current = false;
            return;
          }

          // [FIX] Detecta se há coordenadas de crop específicas ou se estamos usando valores padrão
          // Se não há crop específico, renderiza a página inteira
          const hasSpecificCrop = (
            props.pdfjs_x !== undefined || 
            props.pdfjs_y !== undefined || 
            props.cropDetails?.pdfjs_x !== undefined ||
            props.cropDetails?.pdfjs_y !== undefined ||
            props.pdfjs_crop_w !== undefined ||
            props.pdfjs_crop_h !== undefined
          );

          const unscaledViewport = pdfPage.getViewport({ scale: 1.0 });
          
          let finalWidth: number;
          let finalHeight: number;
          let offsetX: number;
          let offsetY: number;
          let scale: number;

          if (hasSpecificCrop) {
            // Modo CROP: usa as coordenadas especificadas
            scale = c.sW / unscaledViewport.width;
            finalWidth = c.cW;
            finalHeight = c.cH;
            offsetX = c.X;
            offsetY = c.Y;
            
            console.log("[PdfEmbed] Modo CROP - Configuração:", {
              canvasSize: `${finalWidth}x${finalHeight}`,
              cropPos: `(${offsetX}, ${offsetY})`,
              scale: scale,
              sourceWidth: c.sW
            });
          } else {
            // Modo PÁGINA COMPLETA: renderiza a página inteira
            // Usa escala para obter alta resolução (2x para retina)
            const targetWidth = 800; // largura razoável para visualização
            scale = targetWidth / unscaledViewport.width;
            const viewport = pdfPage.getViewport({ scale: scale });
            
            finalWidth = viewport.width;
            finalHeight = viewport.height;
            offsetX = 0;
            offsetY = 0;
            
            console.log("[PdfEmbed] Modo PÁGINA COMPLETA - Configuração:", {
              canvasSize: `${finalWidth}x${finalHeight}`,
              originalSize: `${unscaledViewport.width}x${unscaledViewport.height}`,
              scale: scale
            });
          }

          const viewport = pdfPage.getViewport({ scale: scale });

          // 2. Define o tamanho do canvas
          canvas.width = finalWidth;
          canvas.height = finalHeight;

          // [FIX] Preencher fundo branco (para PDFs transparentes)
          context.fillStyle = '#FFFFFF';
          context.fillRect(0, 0, finalWidth, finalHeight);

          // [FIX] Salva o estado do contexto antes de transladar
          context.save();
          
          // 3. Translada o contexto para "mover" a página (só se há crop)
          if (hasSpecificCrop) {
            context.translate(-offsetX, -offsetY);
          }

          // [FIX] Guarda referência ao renderTask para poder cancelar
          const renderTask = pdfPage.render({
              canvasContext: context,
              viewport: viewport
          });
          currentRenderTaskRef.current = renderTask;

          await renderTask.promise;
          
          // [FIX] Restaura o estado do contexto
          context.restore();
          
          console.log("[PdfEmbed] ✅ Render no canvas completado com sucesso");
          currentRenderTaskRef.current = null;
          setIsRendered(true);
          
          // [DEBUG] Check visibility
          setTimeout(() => {
            if (canvasRef.current) {
                console.log("[PdfEmbed] Canvas DOM Stats:", {
                    width: canvasRef.current.width,
                    height: canvasRef.current.height,
                    offsetWidth: canvasRef.current.offsetWidth,
                    offsetHeight: canvasRef.current.offsetHeight,
                    styleDisplay: canvasRef.current.style.display,
                    styleVisibility: canvasRef.current.style.visibility
                });
            }
            if (containerRef.current) {
                console.log("[PdfEmbed] Container DOM Stats:", {
                    offsetWidth: containerRef.current.offsetWidth,
                    offsetHeight: containerRef.current.offsetHeight
                });
            }
          }, 500);

          setRetryRender(0); // [FIX] Reset retry counter após sucesso
          setIsLoadingLocal(false); // [FIX] Garante que loading é desabilitado
        } catch (err: any) {
          // [FIX] Ignora erros de cancelamento
          if (err?.name === 'RenderingCancelledException' || err?.message?.includes('cancelled')) {
            console.log("[PdfEmbed] Render cancelado (esperado)");
          } else {
            console.error("[PdfEmbed] Erro no render:", err);
            setFallbackError("Erro ao renderizar: " + err.message);
          }
        } finally {
          isRenderingRef.current = false;
        }
  };

  // Handler para upload manual
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("[PdfEmbed] Upload manual de arquivo:", file.name);
    
    // [FIX] Cancela qualquer render em andamento
    if (currentRenderTaskRef.current) {
      try {
        currentRenderTaskRef.current.cancel();
      } catch (e) {}
      currentRenderTaskRef.current = null;
    }
    
    // [FIX] Limpa cache do documento para forçar recarregamento
    pdfDocRef.current = null;
    isRenderingRef.current = false;

    // Salva globalmente para reuso
    // @ts-ignore
    window.__pdfLocalFile = file;
    setFallbackError(null); // Limpa erro
    setIsRendered(false); // Reset para forçar re-render
    setHasUploadedFile(true); // [FIX] Marca que temos arquivo - força re-render
    setIsLoadingLocal(true); // [FIX] Inicia loading - previne mostrar placeholder
    
    // [FIX] Força modo pdfjs se estiver em embed (embed não suporta arquivo local)
    if (renderMode === 'embed') {
      setRenderMode('pdfjs');
      // O useEffect vai cuidar do render quando renderMode mudar
      return;
    }
    
    // Se já está em pdfjs, renderiza diretamente
    try {
      const arrayBuffer = await file.arrayBuffer();
      // @ts-ignore
      const pdfDoc = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      pdfDocRef.current = pdfDoc; // [FIX] Salva cache
      await renderPageOnCanvas(pdfDoc);
      // Nota: isLoadingLocal é desabilitado dentro de renderPageOnCanvas
    } catch (err: any) {
      if (!err?.message?.includes('cancelled')) {
        setFallbackError("Erro ao processar arquivo: " + err.message);
      }
      setIsLoadingLocal(false); // [FIX] Termina loading mesmo em erro
    }
  };

  // --- LÓGICA DE PDFJS (Canvas) ---
  useEffect(() => {
    if (renderMode !== 'pdfjs') return;
    if (isRendered) return;
    
    // [FIX] Evita múltiplas chamadas de carregamento simultâneas
    if (isRenderingRef.current || isLoadingLocal) {
      console.log("[PdfEmbed] useEffect ignorado - já em andamento");
      return;
    }

    // [READONLY LOGIC] 
    // - Sem readOnly: usa arquivo do viewer (window.__pdfLocalFile) automaticamente
    // - Com readOnly: NÃO usa arquivo da prova (que está aberto no viewer), pede upload manual
    // - [FIX] Se hasUploadedFile é true, o usuário fez upload MANUAL neste componente, então DEVEMOS usar.
    const canUseViewerFile = !props.readOnly || hasUploadedFile;

    // Se temos arquivo local (via upload ou global), prioriza ele - MAS só se !readOnly
    // @ts-ignore
    if (canUseViewerFile && window.__pdfLocalFile) {
        setFallbackError(null); // Clear any previous URL errors
        setIsLoadingLocal(true); // [FIX] Inicia loading antes de processar
        
        const renderLocal = async () => {
             // @ts-ignore
            console.log("[PdfEmbed] Usando arquivo local (buffer) - readOnly:", props.readOnly);
            try {
                // [FIX] Reutiliza documento PDF se já foi carregado
                let pdfDoc = pdfDocRef.current;
                
                if (!pdfDoc) {
                  // @ts-ignore
                  const buffer = await window.__pdfLocalFile.arrayBuffer();
                  // @ts-ignore
                  pdfDoc = await window.pdfjsLib.getDocument({ data: buffer }).promise;
                  pdfDocRef.current = pdfDoc; // Cache para reuso
                }
                
                await renderPageOnCanvas(pdfDoc);
                // Nota: isLoadingLocal é desabilitado dentro de renderPageOnCanvas após sucesso
            } catch (err: any) {
                console.error("[PdfEmbed] Erro ao renderizar arquivo local:", err);
                // [FIX] Não mostra erro se foi cancelamento
                if (!err?.message?.includes('cancelled')) {
                  setFallbackError("Erro no arquivo local: " + err.message);
                }
                setIsLoadingLocal(false); // [FIX] Termina loading mesmo em erro
            }
        };
        renderLocal();
        return;
    }

    if (!effectiveUrl) {
        setFallbackError("NEEDS_UPLOAD");
        return;
    }

    const renderCanvas = async () => {
      try {
        setIsLoadingLocal(true);
        
        console.log("[PdfEmbed] Carregando direto:", effectiveUrl);
        // @ts-ignore
        const loadingTask = window.pdfjsLib.getDocument(effectiveUrl);

        try {
            const pdfDoc = await loadingTask.promise;
            pdfDocRef.current = pdfDoc; // Cache para reuso
            await renderPageOnCanvas(pdfDoc);
        } catch (err: any) {
            console.warn("[PdfEmbed] Falha no carregamento direto:", err);
            // Se falhar e for URL remota, pede upload manual
            // [FIX] Any error maps to "Need Upload"
            throw new Error("CORS_BLOCK");
        }

      } catch (e: any) {
        console.error("PDF Render Fallback Error:", e);
        setFallbackError(e.message || "Erro ao renderizar PDF.");
        setIsLoadingLocal(false);
      }
    };
    
    renderCanvas();
  }, [effectiveUrl, pageNum, c.left, c.top, renderMode, isRendered, props.readOnly, hasUploadedFile, retryRender, externalFileVersion]);

  // --- TOGGLE BUTTON STYLE ---
  const modeColors: Record<string, string> = {
    puter: 'linear-gradient(135deg, #f59e0b, #d97706)',
    embed: 'linear-gradient(135deg, #667eea, #764ba2)',
    pdfjs: 'linear-gradient(135deg, #22c55e, #16a34a)',
  };
  const modeLabels: Record<string, string> = {
    puter: '🌐 Puter',
    embed: '📄 Embed',
    pdfjs: '🎨 PDF.js',
  };

  const controlsContainerStyle: React.CSSProperties = {
    position: 'absolute',
    top: '4px',
    right: '4px',
    zIndex: 100,
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
    transform: `scale(${dynamicScale*3})`,
    transformOrigin: 'top right',
    pointerEvents: 'none',
  };

  const toggleButtonStyle: React.CSSProperties = {
    padding: '2px 6px',
    fontSize: '8.5px',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    background: modeColors[renderMode] || modeColors.puter,
    color: '#fff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
    transition: 'all 0.2s ease',
    pointerEvents: 'auto',
  };

  // Cicla: puter → embed → pdfjs → puter
  const toggleRenderMode = () => {
    setRenderMode(prev => {
      if (prev === 'puter') return 'embed';
      if (prev === 'embed') return 'pdfjs';
      return 'puter'; // pdfjs → puter
    });
  };

  // --- BOTÃO EDITAR LINK DO PDF ---
  const editLinkButtonStyle: React.CSSProperties = {
    padding: '2px 6px',
    fontSize: '8.5px',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    background: manualPdfUrl 
      ? 'linear-gradient(135deg, #06b6d4, #0891b2)'
      : 'linear-gradient(135deg, rgba(148,163,184,0.5), rgba(100,116,139,0.5))',
    color: '#fff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    transition: 'all 0.2s ease',
    width: '53px',
    pointerEvents: 'auto',
  };

  const handleEditLink = async () => {
    const currentActive = effectiveUrl || null;
    const result = await showPdfUrlModal(currentActive);

    if (result.action === 'set' && result.url) {
      setPuterIframeHeight(null); // Reset para recalcular
      setManualPdfUrl(result.url);
      setManualUrlInput(result.url); // Sincroniza o input inline também
    } else if (result.action === 'remove') {
      setPuterIframeHeight(null);
      setManualPdfUrl('');
      setManualUrlInput('');
    }
    // 'cancel' = não faz nada
  };

  // Botão de editar link — SÓ aparece quando há URL ativa (senão é redundante com o placeholder)
  // --- AGRUPAMENTO DOS CONTROLES (RECURSIVO/DINÂMICO) ---
  const renderControls = () => (
    <div style={controlsContainerStyle}>
      {effectiveUrl && (
        <button
          style={editLinkButtonStyle}
          onClick={handleEditLink}
          title="Trocar ou remover link do PDF"
        >
          🔗 Editar
        </button>
      )}
      <button 
        style={toggleButtonStyle} 
        onClick={toggleRenderMode} 
        title="Alternar modo de visualização"
      >
        {modeLabels[renderMode]}
      </button>
    </div>
  );

  // --- RENDER PUTER (iframe) --- [NEW DEFAULT]
  if (renderMode === 'puter') {
    // Handler para o usuário submeter URL manual
    const handleManualUrlSubmit = () => {
      const trimmed = manualUrlInput.trim();
      if (trimmed && (trimmed.startsWith('http://') || trimmed.startsWith('https://'))) {
        setPuterIframeHeight(null); // Reset height para recalcular
        setManualPdfUrl(trimmed);
      }
    };

    // Campo de input de URL (aparece quando não tem URL ou sempre como opção)
    const urlInputBar = (
      <div style={{
        display: 'flex', gap: '6px', width: '100%', maxWidth: '500px',
        padding: '0 8px', marginTop: '4px',
      }}>
        <input
          type="url"
          placeholder="Cole o link do PDF aqui..."
          value={manualUrlInput}
          onChange={(e) => setManualUrlInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleManualUrlSubmit(); }}
          style={{
            flex: 1, padding: '8px 12px', fontSize: '11px',
            background: 'var(--color-bg-1, #1e293b)', color: 'var(--color-text, #e2e8f0)',
            border: '1px solid var(--color-border, rgba(148,163,184,0.2))',
            borderRadius: '6px', outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handleManualUrlSubmit}
          style={{
            padding: '8px 14px', fontSize: '11px', fontWeight: 600,
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: '#fff', border: 'none', borderRadius: '6px',
            cursor: 'pointer', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: '4px',
          }}
        >
          🌐 Carregar
        </button>
      </div>
    );

    if (!effectiveUrl) {
      // Sem URL, mostra placeholder com campo de input
      return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%', minHeight: '120px' }}>
          {renderControls()}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '24px 16px', background: 'var(--color-surface)', borderRadius: '12px',
            border: '1px solid var(--color-border)', gap: '12px', minHeight: '100px',
          }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(var(--color-primary-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>📄</div>
            <span style={{ fontSize: '13px', color: 'var(--color-text)', fontWeight: 500, textAlign: 'center' }}>Visualização não disponível</span>
            <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>Nenhum link de PDF encontrado — cole abaixo para visualizar</span>
            {urlInputBar}
          </div>
        </div>
      );
    }

    // Construir URL do viewer com todos os parâmetros
    const viewerParams = new URLSearchParams();
    viewerParams.set('url', effectiveUrl);
    viewerParams.set('page', String(pageNum));
    if (c.sW) viewerParams.set('sourceW', String(c.sW));
    if (c.sH) viewerParams.set('sourceH', String(c.sH));
    if (c.X) viewerParams.set('x', String(c.X));
    if (c.Y) viewerParams.set('y', String(c.Y));
    if (c.cW) viewerParams.set('cropW', String(c.cW));
    if (c.cH) viewerParams.set('cropH', String(c.cH));
    if (c.left) viewerParams.set('left', String(c.left));
    if (c.top) viewerParams.set('top', String(c.top));
    
    const viewerSrc = `/pdf-viewer.html?${viewerParams.toString()}`;

    // Calcula dimensões para o iframe
    // Estimativa inicial — capped at 80vh para evitar sumiço
    const maxVh = typeof window !== 'undefined' ? window.innerHeight * 0.8 : 720;
    const estimatedHeight = Math.min(origHeight + 42, maxVh);
    // Dimensões reais já recebidas: também capped at 80vh
    const finalIframeHeight = puterIframeHeight 
      ? Math.min(puterIframeHeight, maxVh) 
      : estimatedHeight;

    // Final container height calculation
    const currentRealHeight = puterIframeHeight || (origHeight + 42);
    const containerHeight = currentRealHeight * dynamicScale;

    return (
      <div 
        ref={containerRef} 
        style={{ 
          position: 'relative', 
          width: '100%', 
          maxWidth: `${origWidth * dynamicScale}px`,
          height: `${containerHeight}px`,
        }}
      >
        {/* Buttons now outside the scaled div to remain proportional and properly spaced */}
        {renderControls()}

        <div style={{
          width: `${origWidth}px`,
          height: `${currentRealHeight}px`,
          transform: `scale(${dynamicScale})`,
          transformOrigin: 'top left',
          borderRadius: '8px',
          background: '#0f172a',
          overflow: 'hidden'
        }}>
          <iframe
            src={viewerSrc}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
              overflow: 'hidden',
            }}
            sandbox="allow-scripts allow-same-origin"
            title="Visualizador PDF via Puter"
            scrolling="no"
          />
        </div>
      </div>
    );
  }

  // --- RENDER EMBED ---
  // [RESTORED] Embed logic MUST use scale() to preserve the viewport relative to the crop
  if (renderMode === 'embed') {
    // [NEW] Se não tem URL, mostrar "Visualização não disponível"
    if (!effectiveUrl) {
      const noUrlOuterStyle: React.CSSProperties = {
        position: 'relative',
        width: '100%',
        height: 'auto',
        minHeight: '120px',
        overflow: 'hidden',
        boxSizing: 'border-box',
      };

      const noUrlContentStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        background: 'var(--color-surface)',
        borderRadius: '12px',
        border: '1px solid var(--color-border)',
        gap: '12px',
        minHeight: '100px',
      };

      return (
        <div ref={containerRef} style={noUrlOuterStyle}>
          {renderControls()}
          <div style={noUrlContentStyle}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(var(--color-primary-rgb), 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
            }}>
              📄
            </div>
            <span style={{
              fontSize: '13px',
              color: 'var(--color-text)',
              fontWeight: 500,
              textAlign: 'center',
            }}>
              Visualização não disponível
            </span>
            <span style={{
              fontSize: '10px',
              color: 'var(--color-text-secondary)',
              textAlign: 'center',
            }}>
              Nenhum link de PDF encontrado
            </span>
          </div>
        </div>
      );
    }

    // [QUALITY FIX] Instead of CSS Scaling (which blurs), we modify the PDF ZOOM native parameter.
    // Mathematical logic: NewZoom = OriginalZoom * ScaleFactor
    // Example: 200% Zoom * 0.5 Scale = 100% Native Render (Crisp)
    const effectiveZoom = scaleToFit ? (zoomLevel * dynamicScale) : zoomLevel;
    
    // Format coordinates and zoom
    // We keep coordinates integers or rounded for stability, but zoom can be precise
    const embedSrc = `${effectiveUrl}#zoom=${effectiveZoom.toFixed(2)},${Math.round(c.left)},${Math.round(c.top)}&page=${pageNum}&toolbar=0&scrollbar=0`;
    
    const needsScale = scaleToFit && dynamicScale < 1;

    // 1. Outer Container: Visual size (Scaled)
    // When using native zoom, the physical size IS the visual size.
    // We apply the same dimensions to both container and wrapper.
    const finalWidth = needsScale ? origWidth * dynamicScale : origWidth;
    const finalHeight = needsScale ? origHeight * dynamicScale : origHeight;

    const activeOuterStyle: React.CSSProperties = {
        position: 'relative',
        width: `${finalWidth}px`,
        height: `${finalHeight}px`,
        overflow: 'hidden',
        // maxWidth: '100%', // [FIX] Removed to prevent cutoff
        boxSizing: 'border-box',
    };

    // 2. Inner Wrapper: No more Transform!
    const activeWrapperStyle: React.CSSProperties = {
        ...style,
        width: `${finalWidth}px`,
        height: `${finalHeight}px`,
        overflow: 'hidden',
        // [REMOVED] transform: needsScale ? `scale(${dynamicScale})` : undefined,
        transformOrigin: 'top left',
        backgroundColor: 'var(--color-surface)',
    };
    
    // Embed fills the wrapper
    const activeEmbedStyle: React.CSSProperties = {
        width: 'calc(100% + 20px)', 
        height: 'calc(100% + 20px)',
        border: 'none',
        pointerEvents: 'none',
    };

    // [NEW] Link de download style (sempre visível como fallback)
    const downloadLinkStyle: React.CSSProperties = {
      position: 'absolute',
      bottom: '8px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
      padding: '6px 14px',
      fontSize: '10px',
      fontWeight: 600,
      color: '#fff',
      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.9) 0%, rgba(139, 92, 246, 0.9) 100%)',
      borderRadius: '6px',
      textDecoration: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,0.1)',
      transition: 'all 0.2s ease',
    };

    // [NEW] Overlay de erro do embed (se ele falhar)
    if (embedFailed) {
      const embedFailedOverlay: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%)',
        borderRadius: '8px',
        gap: '12px',
        padding: '20px',
        zIndex: 10,
      };

      return (
        <div ref={containerRef} style={{...activeOuterStyle, minHeight: '140px'}}>
          {renderControls()}
          <div style={embedFailedOverlay}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
            }}>
              ⚠️
            </div>
            <span style={{
              fontSize: '13px',
              color: 'rgba(226, 232, 240, 0.9)',
              fontWeight: 500,
              textAlign: 'center',
            }}>
              Não foi possível carregar o PDF
            </span>
            <span style={{
              fontSize: '10px',
              color: 'rgba(148, 163, 184, 0.7)',
              textAlign: 'center',
              marginBottom: '8px',
            }}>
              Seu navegador pode não suportar este formato
            </span>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <a 
                href={effectiveUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                style={{
                  padding: '8px 16px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#fff',
                  background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                📥 Baixe a prova aqui
              </a>
              <button
                onClick={toggleRenderMode}
                style={{
                  padding: '8px 16px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'rgba(226, 232, 240, 0.9)',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                🎨 Usar PDF.js
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div ref={containerRef} style={activeOuterStyle}>
        {renderControls()}
        <div style={activeWrapperStyle} title="Visualização via PDF Embed">
          <embed 
            key={embedSrc} 
            src={embedSrc} 
            type="application/pdf"
            style={activeEmbedStyle} 
            onError={() => {
                console.warn("[PdfEmbed] Embed failed, showing fallback");
                setEmbedFailed(true);
            }}
          />
        </div>
        {/* [NEW] Link de download sempre visível na parte inferior */}

      </div>
    );
  }

  // --- RENDER PDFJS (Canvas) ---
  // [NEW] PDF.js uses Responsive CSS (No Scale) for MAX Quality
  
  // [FIX] Limit height effectively by limiting width based on aspect ratio
  // Height = Width / AspectRatio. We want Height <= 80vh.
  // So Width <= 80vh * AspectRatio.
  const aspectRatio = origWidth / (origHeight || 1);
  const maxHeightLimit = '80vh';
  const maxWidthFromHeight = `calc(${maxHeightLimit} * ${aspectRatio})`;

  // Outer: 100% width responsive but constrained by max-height equivalent
  const pdfJsOuterStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: 'auto', 
    maxWidth: `min(100%, ${maxWidthFromHeight})`,
    margin: '0 auto', // Center it if it shrinks
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' // Optional slick shadow
  };

  // Wrapper: Aspect Ratio Hack (DEBUG MODE: Red Border)
  const pdfJsWrapperStyle: React.CSSProperties = {
      ...style,
      position: 'relative',
      width: '100%',
      height: '0',
      paddingBottom: `${(origHeight / origWidth) * 100}%`, 
      backgroundColor: 'var(--color-surface)',
      overflow: 'hidden',
  };

  // Canvas: Ocupa 100% absoluto do wrapper
  // Importante: width/height atributos do canvas continuam High-Res (c.cW/c.cH)
  // O CSS apenas redimensiona a visualização.
  const canvasStyle: React.CSSProperties = {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      border: 'none',
      display: 'block',
      objectFit: 'contain' // Garante que o conteúdo não estique estranho
  };

  // Se houver erro ou falta de URL, mostramos UI de Upload
  // [READONLY LOGIC] hasLocalFile só conta se !readOnly
  // [FIX] hasUploadedFile força re-render quando usuário faz upload
  // [FIX] isLoadingLocal previne mostrar placeholder enquanto carrega
  const canUseViewerFile = !props.readOnly;
  const hasLocalFile = (canUseViewerFile && typeof window !== 'undefined' && !!(window as any).__pdfLocalFile) || hasUploadedFile;
  
  // [FIX] Não mostrar upload UI se estiver carregando OU se tiver arquivo local
  // Erro só mostra upload UI se for NEEDS_UPLOAD ou CORS_BLOCK, não erros de processamento com arquivo já carregado
  const isRecoverableError = fallbackError === "NEEDS_UPLOAD" || fallbackError?.includes("CORS_BLOCK");
  const shouldShowUpload = !isLoadingLocal && (
    (isRecoverableError && !hasLocalFile) || 
    (!effectiveUrl && !hasLocalFile && !isLoadingLocal)
  );

  if (shouldShowUpload) {
      // Logic for determining the message type
      const needsUpload = fallbackError === "NEEDS_UPLOAD" || fallbackError?.includes("CORS_BLOCK") || !effectiveUrl;
      
      // Upload UI Container
      const uploadContainerStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        background: 'var(--color-surface)',
        borderRadius: '12px',
        border: '1px solid var(--color-border)',
        gap: '16px',
        minHeight: '140px',
        boxShadow: 'var(--shadow-lg, 0 8px 32px rgba(0, 0, 0, 0.2))',
      };

      // Icon circle
      const iconCircleStyle: React.CSSProperties = {
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: 'rgba(var(--color-primary-rgb), 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        border: '1px solid rgba(var(--color-primary-rgb), 0.2)',
      };

      // Button styles
      const primaryButtonStyle: React.CSSProperties = {
        background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
        border: 'none',
        borderRadius: '8px',
        padding: '10px 20px',
        color: '#fff',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s ease',
        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
      };

      const secondaryButtonStyle: React.CSSProperties = {
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '6px',
        padding: '8px 14px',
        color: 'rgba(226, 232, 240, 0.8)',
        fontSize: '11px',
        fontWeight: 500,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.2s ease',
      };

      return (
          <div ref={containerRef} style={pdfJsOuterStyle}>
             {renderControls()}
              
              <div style={{...pdfJsWrapperStyle, height: 'auto', paddingBottom: 0}}>
                  <div style={uploadContainerStyle}>
                      {/* Icon */}
                      <div style={iconCircleStyle}>
                        📄
                      </div>
                      
                      {/* Title */}
                      <div style={{ textAlign: 'center' }}>
                        <p style={{
                          margin: '0 0 4px 0',
                          fontSize: '14px',
                          fontWeight: 600,
                          color: 'var(--color-text)',
                        }}>
                          Visualização não disponível
                        </p>
                        <p style={{
                          margin: 0,
                          fontSize: '11px',
                          color: 'var(--color-text-secondary)',
                        }}>
                          {props.readOnly 
                            ? "Modo somente leitura - selecione o PDF manualmente"
                            : (!effectiveUrl ? "Arquivo sem link - selecione o PDF original" : "Acesso ao arquivo bloqueado")
                          }
                        </p>
                      </div>

                      {/* Actions */}
                      {needsUpload && (
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '10px', 
                          alignItems: 'center',
                          marginTop: '4px'
                        }}>
                          {/* Primary Upload Button */}
                          <label style={primaryButtonStyle}>
                            <span style={{ fontSize: '14px' }}>📂</span>
                            Selecionar Arquivo PDF
                            <input 
                                type="file" 
                                accept="application/pdf"
                                onChange={handleFileUpload}
                                style={{display: 'none'}}
                            />
                          </label>

                          {/* Download Link (if URL exists but blocked) */}
                          {effectiveUrl && (
                            <a 
                              href={effectiveUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              style={{
                                ...secondaryButtonStyle,
                                textDecoration: 'none',
                              }}
                            >
                              <span style={{ fontSize: '12px' }}>📥</span>
                              Baixe a prova aqui
                            </a>
                          )}
                        </div>
                      )}
                      
                      {/* Error message (non-upload errors) */}
                      {!needsUpload && fallbackError && (
                        <div style={{
                          padding: '8px 12px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          borderRadius: '6px',
                          marginTop: '4px',
                        }}>
                          <p style={{
                            margin: 0,
                            fontSize: '10px',
                            color: 'rgba(252, 129, 129, 0.9)',
                          }}>
                            {fallbackError}
                          </p>
                        </div>
                      )}
                  </div>
              </div>
          </div>
      )
  }

  // [FIX] Loading overlay styles - agora renderiza JUNTO com o canvas visível
  const loadingOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
    borderRadius: '8px',
    gap: '12px',
    zIndex: 10,
  };

  // [FIX] REMOVIDO o return antecipado - o canvas deve sempre estar montado para receber o render

  // [FIX] Show error with retry option if there's a processing error (not NEEDS_UPLOAD/CORS)
  if (fallbackError && !isRecoverableError && hasLocalFile) {
    const errorContainerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
      borderRadius: '8px',
      border: '1px solid rgba(239, 68, 68, 0.2)',
      gap: '12px',
      minHeight: '100px',
    };

    return (
      <div ref={containerRef} style={pdfJsOuterStyle}>
        {renderControls()}
        <div style={errorContainerStyle}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
          }}>
            ⚠️
          </div>
          <span style={{
            fontSize: '12px',
            color: 'rgba(252, 129, 129, 0.9)',
            fontWeight: 500,
            textAlign: 'center',
          }}>
            {fallbackError}
          </span>
          <label style={{
            background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            📂 Tentar outro arquivo
            <input 
              type="file" 
              accept="application/pdf"
              onChange={handleFileUpload}
              style={{display: 'none'}}
            />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={pdfJsOuterStyle}>
        {renderControls()}
        <div style={pdfJsWrapperStyle}>
            <canvas ref={canvasRef} style={canvasStyle} />
            {/* [FIX] Loading overlay sobre o canvas - canvas permanece montado */}
            {isLoadingLocal && !isRendered && (
              <div style={loadingOverlayStyle}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid rgba(99, 102, 241, 0.2)',
                  borderTopColor: '#6366F1',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }} />
                <span style={{
                  fontSize: '12px',
                  color: 'rgba(226, 232, 240, 0.8)',
                  fontWeight: 500,
                }}>
                  Carregando PDF...
                </span>
                <style>{`
                  @keyframes spin {
                    to { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            )}
        </div>
    </div>
  );
};