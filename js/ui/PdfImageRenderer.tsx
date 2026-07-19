import React, { useEffect, useRef, useState } from 'react';

// ============================================
// PDF IMAGE RENDERER
// Renderiza imagens via PDF Embed (Chrome/Edge) ou PDF.js Fallback
// ============================================

declare global {
  interface Window {
    __pdfLocalFile?: File | null;
    __pdfOriginalUrl?: string | null;
    __pdfDownloadUrl?: string | null;
    pdfjsLib?: any;
  }
}

export interface PdfImageRendererProps {
  // Dados de crop (obrigatórios se imagem foi selecionada)
  pdfPage?: number;
  pdfZoom?: number;
  pdfLeft?: number;
  pdfTop?: number;
  pdfWidth?: string;
  pdfHeight?: string;

  // PDF.js fallback params
  pdfjsSourceW?: number;
  pdfjsSourceH?: number;
  pdfjsX?: number;
  pdfjsY?: number;
  pdfjsCropW?: number;
  pdfjsCropH?: number;

  // URL do PDF (do manifesto, pode ser null)
  pdfUrl?: string | null;

  // Link de download para mostrar ao usuário (quando precisa upload manual)
  downloadUrl?: string;

  // Fallback legado (apenas para retrocompatibilidade com dados antigos)
  legacyUrl?: string;

  // ID único para o componente
  id?: string;
}

// Detecta navegador Chrome/Edge
const isChromiumBased = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isChrome = ua.indexOf('Chrome') > -1;
  const isEdge = ua.indexOf('Edg') > -1;
  return isChrome || isEdge;
};

// Lista de proxies para fallback
// [REMOVIDO] Proxy List - User optou por upload manual em caso de falha
// const PROXY_LIST = ...

type RenderState = 'loading' | 'embed' | 'pdfjs' | 'upload' | 'error';

export const PdfImageRenderer: React.FC<PdfImageRendererProps> = ({
  pdfPage = 1,
  pdfZoom = 200,
  pdfLeft = 0,
  pdfTop = 0,
  pdfWidth = '600px',
  pdfHeight = '400px',
  pdfjsSourceW = 2480,
  pdfjsSourceH = 3508,
  pdfjsX = 0,
  pdfjsY = 0,
  pdfjsCropW = 600,
  pdfjsCropH = 400,
  pdfUrl,
  downloadUrl,
  legacyUrl,
  id,
}) => {
  // Inicialização inteligente do estado para evitar "softlocks" de loading
  const [renderState, setRenderState] = useState<RenderState>(() => {
    // Se temos URL e é Chrome/Edge, vai pro embed direto
    if (pdfUrl && isChromiumBased()) return 'embed';
    
    // Se temos URL, mas não é Chrome, começa loading (para PDF.js)
    if (pdfUrl && !isChromiumBased()) return 'loading';

    // Se temos arquivo local, começa loading (para PDF.js)
    if (window.__pdfLocalFile) return 'loading';

    // Se não tem nada, já começa pedindo upload
    return 'upload';
  });

  const [errorMessage, setErrorMessage] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const embedRef = useRef<HTMLEmbedElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dimensões parseadas
  const widthPx = parseInt(pdfWidth) || 600;
  const heightPx = parseInt(pdfHeight) || 400;

  // Determinar qual estratégia usar
  useEffect(() => {
    const init = async () => {
      // Se o estado inicial já foi decidido como upload, não faz nada
      if (renderState === 'upload') return;

      // Se temos URL do PDF e é Chrome/Edge, garante embed
      if (pdfUrl && isChromiumBased()) {
        if (renderState !== 'embed') setRenderState('embed');
        return;
      }

      // Se temos URL do PDF mas não é Chrome/Edge, vai direto pra PDF.js
      if (pdfUrl) {
        await tryPdfjsWithUrl(pdfUrl);
        return;
      }

      // Se temos arquivo local global, usa ele
      if (window.__pdfLocalFile) {
        await tryPdfjsWithFile(window.__pdfLocalFile);
        return;
      }

      // Fallback final: se chegou aqui e estava em loading, muda para upload
      setRenderState('upload');
    };

    init();
  }, [pdfUrl]);

  // [FIX] Listener para detectar quando arquivo local é carregado externamente
  useEffect(() => {
    const handleExternalFile = async () => {
      console.log('[PdfImageRenderer] Arquivo externo detectado via evento');
      if (window.__pdfLocalFile) {
        await tryPdfjsWithFile(window.__pdfLocalFile);
      }
    };

    window.addEventListener('pdfLocalFileLoaded', handleExternalFile);
    
    return () => {
      window.removeEventListener('pdfLocalFileLoaded', handleExternalFile);
    };
  }, []);

  // Função para renderizar via PDF.js com URL
  const tryPdfjsWithUrl = async (url: string) => {
    setRenderState('loading');
    setErrorMessage('');

    try {
      // Tenta carregar diretamente
      await renderPdfjs(url);
      setRenderState('pdfjs');
    } catch (e) {
      console.warn('[PdfImageRenderer] URL direta falhou (Provavel CORS). Tentando Puter fallback...', e);
      
      let targetUrl = url;
      if (url.includes("/proxy-pdf?url=")) {
        try {
          const urlParams = new URLSearchParams(url.split("?")[1]);
          targetUrl = urlParams.get("url") || url;
        } catch (err) {}
      }

      // @ts-ignore
      if (targetUrl && targetUrl.startsWith("http") && window.puter && window.puter.net && window.puter.net.fetch) {
        try {
          // @ts-ignore
          if (window.puter.auth && typeof window.puter.auth.isSignedIn === "function" && !window.puter.auth.isSignedIn()) {
            console.log('[PdfImageRenderer] Usuário não logado no Puter. Solicitando autenticação...');
            // @ts-ignore
            if (typeof window.puter.auth.signIn === "function") {
              // @ts-ignore
              await window.puter.auth.signIn();
            }
          }
          // @ts-ignore
          const res = await window.puter.net.fetch(targetUrl);
          if (!res.ok) throw new Error(`Puter fetch status ${res.status}`);
          const arrayBuffer = await res.arrayBuffer();
          const typedArray = new Uint8Array(arrayBuffer);
          await renderPdfjsFromData(typedArray);
          setRenderState('pdfjs');
          return;
        } catch (puterErr) {
          console.error('[PdfImageRenderer] Puter fallback fetch failed:', puterErr);
        }
      }

      setErrorMessage('Acesso direto bloqueado pelo navegador. Por favor, baixe o PDF e selecione-o abaixo.');
      setRenderState('upload');
    }
  };

  // Função para renderizar via PDF.js com arquivo local
  const tryPdfjsWithFile = async (file: File) => {
    setRenderState('loading');
    setErrorMessage('');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const typedArray = new Uint8Array(arrayBuffer);
      await renderPdfjsFromData(typedArray);
      setRenderState('pdfjs');
    } catch (e) {
      console.error('[PdfImageRenderer] Erro ao processar arquivo:', e);
      setErrorMessage('Erro ao processar o arquivo PDF.');
      setRenderState('upload');
    }
  };

  // Renderiza PDF.js a partir de URL
  const renderPdfjs = async (url: string) => {
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) throw new Error('PDF.js não carregado');

    const loadingTask = pdfjsLib.getDocument(url);
    const doc = await loadingTask.promise;
    await renderPage(doc);
  };

  // Renderiza PDF.js a partir de dados binários
  const renderPdfjsFromData = async (data: Uint8Array) => {
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) throw new Error('PDF.js não carregado');

    const loadingTask = pdfjsLib.getDocument({ data });
    const doc = await loadingTask.promise;
    await renderPage(doc);
  };

  // Renderiza a página específica com crop
  const renderPage = async (doc: any) => {
    const page = await doc.getPage(pdfPage);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    // Calcula escala baseada na largura de origem
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const scale = pdfjsSourceW / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    // Define tamanho do canvas para o crop
    canvas.width = pdfjsCropW;
    canvas.height = pdfjsCropH;

    // HiDPI Scaling - exibe menor para manter qualidade
    canvas.style.width = `${pdfjsCropW / 2}px`;
    canvas.style.height = `${pdfjsCropH / 2}px`;

    // Translada para "mover" para a posição do crop
    context.translate(-pdfjsX, -pdfjsY);

    // Renderiza
    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;
  };

  // Handler para embed error
  const handleEmbedError = () => {
    console.warn('[PdfImageRenderer] Embed falhou, tentando PDF.js...');
    if (pdfUrl) {
      tryPdfjsWithUrl(pdfUrl);
    } else {
      setRenderState('upload');
    }
  };

  // Handler para upload manual
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Salva globalmente para reuso
    window.__pdfLocalFile = file;
    // [FIX] Dispara evento para notificar outros componentes
    window.dispatchEvent(new CustomEvent('pdfLocalFileLoaded'));

    await tryPdfjsWithFile(file);
  };

  // URL do embed
  const embedUrl = pdfUrl
    ? `${pdfUrl}#zoom=${pdfZoom},${pdfLeft},${pdfTop}&toolbar=0&page=${pdfPage}&scrollbar=0`
    : '';

  // Link para download
  const downloadLink = downloadUrl || pdfUrl || window.__pdfDownloadUrl || '';

  return (
    <div 
      ref={containerRef}
      className="pdf-image-renderer" 
      style={{ 
        overflow: 'hidden',
        width: pdfWidth,
        height: pdfHeight,
        position: 'relative',
        backgroundColor: 'var(--color-surface, #1a1a2e)',
        borderRadius: '8px',
        border: '1px solid var(--color-border, rgba(255,255,255,0.1))',
      }}
      data-renderer-id={id}
    >
      {/* Estado: Loading */}
      {renderState === 'loading' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          color: 'var(--color-text-secondary, #888)',
          fontSize: '12px',
        }}>
          <span>⏳ Carregando PDF...</span>
        </div>
      )}

      {/* Estado: Embed (Chrome/Edge) */}
      {renderState === 'embed' && embedUrl && (
        <embed
          ref={embedRef}
          src={embedUrl}
          style={{
            width: 'calc(100% + 20px)',
            height: 'calc(100% + 20px)',
            pointerEvents: 'none',
          }}
          onError={handleEmbedError}
        />
      )}

      {/* Estado: PDF.js Canvas */}
      {renderState === 'pdfjs' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}>
          <canvas 
            ref={canvasRef}
            style={{ 
              border: 'none',
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
          />
        </div>
      )}

      {/* Estado: Upload Manual */}
      {renderState === 'upload' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          textAlign: 'center',
          gap: '12px',
          height: '100%',
        }}>
          <div style={{ fontSize: '24px' }}>📄</div>
          
          {errorMessage && (
            <p style={{ 
              color: 'var(--color-warning, #FFA500)', 
              fontSize: '11px',
              margin: 0,
            }}>
              {errorMessage}
            </p>
          )}

          {downloadLink && (
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #888)' }}>
              <p style={{ margin: '0 0 4px 0' }}>Baixe o PDF original:</p>
              <a 
                href={downloadLink} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ 
                  color: 'var(--color-primary, #667eea)',
                  wordBreak: 'break-all',
                  fontSize: '10px',
                }}
              >
                📥 {downloadLink.length > 50 ? downloadLink.substring(0, 50) + '...' : downloadLink}
              </a>
            </div>
          )}

          <div style={{ 
            marginTop: '8px', 
            fontSize: '11px', 
            color: 'var(--color-text-secondary, #888)' 
          }}>
            <p style={{ margin: '0 0 8px 0' }}>Selecione o arquivo da prova:</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              style={{
                fontSize: '11px',
                color: 'var(--color-text, white)',
                cursor: 'pointer',
              }}
            />
          </div>
        </div>
      )}

      {/* Estado: Erro */}
      {renderState === 'error' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          color: 'var(--color-error, #ef4444)',
          fontSize: '12px',
          textAlign: 'center',
          padding: '20px',
        }}>
          <span>❌ Erro ao renderizar imagem</span>
        </div>
      )}

      {/* Canvas oculto para pre-render quando não é o estado ativo */}
      {renderState !== 'pdfjs' && (
        <canvas 
          ref={canvasRef}
          style={{ display: 'none' }}
        />
      )}
    </div>
  );
};

export default PdfImageRenderer;
