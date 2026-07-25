import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PdfEmbedRenderer } from './PdfEmbedRenderer';

// Interfaces to type the CropperState interaction
interface CropperStateInterface {
  undo: () => void;
  redo: () => void;
  revert: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  editingSnapshot: any;
  getAllGroups: () => any[];
}

// Declare global CropperState if not available via import
declare const CropperState: CropperStateInterface;
declare const confirmImageSlotMode: () => void;
declare const cancelImageSlotMode: () => void;
declare const editImageSlotMode: (id: string) => void;
declare const deleteImageSlot: (id: string) => void;

declare global {
  interface Window {
    CropperState: any;
  }
}

interface SlotData {
  id: string;
  timestamp?: number;
  previewUrl?: string;

  // PDF Embed Support
  pdf_url?: string | null;
  pdf_page?: number;
  pdf_zoom?: number;
  pdf_left?: number;
  pdf_top?: number;
  pdf_width?: number | string;
  pdf_height?: number | string;

  // PDF.js Fallback
  pdfjs_source_w?: number;
  pdfjs_source_h?: number;
  pdfjs_x?: number;
  pdfjs_y?: number;
  pdfjs_crop_w?: number;
  pdfjs_crop_h?: number;
}

interface ImageSlotCardProps {
  slotId: string;
  label?: string;
  currentData?: SlotData | null;
  readOnly?: boolean;
}

// AI Extraction states
type AIExtractionState =
  | { status: 'idle'; thoughtsHistory: string[] }
  | { status: 'countdown'; secondsLeft: number; thoughtsHistory: string[] }
  | { status: 'extracting'; message: string; thoughtsHistory: string[] }
  | { status: 'thinking'; thought: string; thoughtsHistory: string[] } // Shows AI thinking (like page-agents-status-list)
  | { status: 'success'; message: string; thoughtsHistory: string[] } // Brief success message before filled
  | { status: 'error'; message: string; thoughtsHistory: string[] }
  | { status: 'cancelled'; thoughtsHistory: string[] }
  | { status: 'ready'; thoughtsHistory: string[] };

export const ImageSlotCard: React.FC<ImageSlotCardProps & { parentGroupId?: string | number }> = ({
  slotId,
  label = 'Imagem',
  currentData,
  parentGroupId,
  readOnly,
}) => {
  // State: 'empty' | 'capturing' | 'filled'
  // Initial state derived from props
  const [internalMode, setInternalMode] = useState<'empty' | 'capturing' | 'filled'>(
    currentData?.pdf_page || currentData?.pdf_url ? 'filled' : 'empty',
  );

  // Local state for UI re-renders (undo/redo definitions) usually handled by CropperState.subscribe
  // But here we might need to force update if we want buttons to enable/disable.
  const [_, setForceUpdate] = useState(0);

  // Local state for immediate updates from events (bypassing slow prop propagation)
  const [localData, setLocalData] = useState<SlotData | null>(null);

  // AI Extraction State
  const [aiState, setAiState] = useState<AIExtractionState>({
    status: 'idle',
    thoughtsHistory: [],
  });
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const resetToStartButtonRef = useRef<NodeJS.Timeout | null>(null);

  // ========== AI EXTRACTION LOGIC ==========

  // importation of splitThought function if available globally or mock it
  // (Assuming splitThought is attached to window in main.js or similar for reuse,
  // currently we will check for window.splitThought or try to dynamic import)
  useEffect(() => {
    import('../sidebar/thoughts-base.js').then((pkg) => {
      (window as any).splitThought = pkg.splitThought;
    });
  }, []);

  // Get question crops from parent group (returns all crops with their pages and bounds)
  const getParentGroupCrops = useCallback((): Array<{
    pageNum: number;
    x: number;
    y: number;
    w: number;
    h: number;
    // Normalized 0-1000 bounds
    normalized: { x: number; y: number; w: number; h: number };
  }> | null => {
    if (!window.CropperState) {
      console.log('[AI Extractor] CropperState not available');
      return null;
    }

    const groups = window.CropperState.groups || [];
    console.log(
      '[AI Extractor] Groups:',
      groups.map((g: any) => ({ id: g.id, cropsCount: g.crops?.length, tags: g.tags })),
    );

    // Try to find parent group by ID if provided
    let parentGroup = null;

    if (parentGroupId) {
      parentGroup = groups.find((g: any) => g.id == parentGroupId);
      console.log('[AI Extractor] Found by parentGroupId:', parentGroup?.id);
    }

    // Fallback: find first non-slot-mode group with crops (the "questão" group)
    if (!parentGroup) {
      parentGroup = groups.find(
        (g: any) => (!g.tags || !g.tags.includes('slot-mode')) && g.crops && g.crops.length > 0,
      );
      console.log('[AI Extractor] Fallback to first question group:', parentGroup?.id);
    }

    if (!parentGroup || !parentGroup.crops || parentGroup.crops.length === 0) {
      console.log('[AI Extractor] No valid parent group found');
      return null;
    }

    // Get current scale from viewerState
    const currentScale = (window as any).viewerState?.pdfScale || 1.0;

    // Process each crop to get its bounds
    return parentGroup.crops.map((crop: any) => {
      const anchorData = crop.anchorData;
      const pageNum = anchorData.anchorPageNum;

      // Get page wrapper to calculate pixel coordinates
      const pageWrapper = document.getElementById(`page-wrapper-${pageNum}`);
      const wrapperWidth = pageWrapper?.offsetWidth || 800;
      const wrapperHeight = pageWrapper?.offsetHeight || 1100;

      // anchorData has relativeLeft, relativeTop, unscaledW, unscaledH (in unscaled pixels)
      // Convert to normalized 0-1000 scale for AI
      const x = Math.round((anchorData.relativeLeft / (wrapperWidth / currentScale)) * 1000);
      const y = Math.round((anchorData.relativeTop / (wrapperHeight / currentScale)) * 1000);
      const w = Math.round((anchorData.unscaledW / (wrapperWidth / currentScale)) * 1000);
      const h = Math.round((anchorData.unscaledH / (wrapperHeight / currentScale)) * 1000);

      return {
        pageNum,
        x: anchorData.relativeLeft * currentScale,
        y: anchorData.relativeTop * currentScale,
        w: anchorData.unscaledW * currentScale,
        h: anchorData.unscaledH * currentScale,
        normalized: { x, y, w, h },
      };
    });
  }, [parentGroupId]);

  // Start AI extraction countdown
  const startAICountdown = useCallback(() => {
    // preserve history if needed? usually reset on new start
    setAiState({ status: 'countdown', secondsLeft: 5, thoughtsHistory: [] });

    let seconds = 5;
    countdownRef.current = setInterval(() => {
      seconds--;
      if (seconds <= 0) {
        clearInterval(countdownRef.current!);
        countdownRef.current = null;
        runAIExtraction();
      } else {
        setAiState((prev) => ({ ...prev, secondsLeft: seconds }));
      }
    }, 1000);
  }, []);

  // Cancel AI countdown
  const cancelAICountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setAiState((prev) => ({ ...prev, status: 'cancelled' }));

    // After 5 seconds, show "Extrair imagem com IA" text + "Iniciar" button
    resetToStartButtonRef.current = setTimeout(() => {
      setAiState((prev) => ({ ...prev, status: 'ready' }));
    }, 5000);
  }, []);

  // Manual start (after cancel)
  const manualStartAI = useCallback(() => {
    if (resetToStartButtonRef.current) {
      clearTimeout(resetToStartButtonRef.current);
      resetToStartButtonRef.current = null;
    }
    startAICountdown();
  }, [startAICountdown]);

  // Run AI extraction
  const runAIExtraction = useCallback(async () => {
    const parentCrops = getParentGroupCrops();
    if (!parentCrops || parentCrops.length === 0) {
      setAiState((prev) => ({
        ...prev,
        status: 'error',
        message: 'Não foi possível obter os bounds da questão',
      }));
      resetToStartButtonRef.current = setTimeout(
        () => setAiState((prev) => ({ ...prev, status: 'ready' })),
        5000,
      );
      return;
    }

    abortControllerRef.current = new AbortController();

    // Get unique pages that have crops from this question
    const pages = [...new Set(parentCrops.map((c) => c.pageNum))];

    try {
      // Dynamically import to avoid circular deps
      const { extractImagesFromRegion } = await import('../services/ai-image-extractor.js');

      // Process each page
      for (const pageNum of pages) {
        // Get all crops on this page for bounds checking
        const cropsOnPage = parentCrops.filter((c) => c.pageNum === pageNum);

        setAiState((prev) => ({
          ...prev,
          status: 'extracting',
          message: `Analisando página ${pageNum}...`,
        }));

        // For each page, we analyze the entire page, then filter to question bounds
        // Use the first crop's normalized bounds as the filter area
        // (In future, could merge multiple crops on same page)
        const questionBounds = cropsOnPage[0].normalized;

        const result = await extractImagesFromRegion(pageNum, questionBounds, {
          onStatus: (msg: string) =>
            setAiState((prev) => ({ ...prev, status: 'extracting', message: msg })),
          onThought: (thought: string) =>
            setAiState((prev) => ({
              ...prev,
              status: 'thinking',
              thought,
              thoughtsHistory: [...(prev.thoughtsHistory || []), thought],
            })),
          signal: abortControllerRef.current?.signal,
        });

        if (result.success && result.crops && result.crops.length > 0) {
          // Found image! Use the first valid crop (already in 0-1000 normalized coords)
          const firstCrop = result.crops[0];

          // CONFIRMAR AUTOMATICAMENTE sem interação do usuário
          if ((window as any).confirmAISlotDirectly) {
            setAiState((prev) => ({
              ...prev,
              status: 'success',
              message: 'Imagem detectada! Preenchendo...',
            }));

            // Pequeno delay para mostrar mensagem de sucesso
            await new Promise((r) => setTimeout(r, 500));

            await (window as any).confirmAISlotDirectly(
              slotId,
              pageNum,
              firstCrop, // { x, y, w, h } em 0-1000
            );

            setAiState({ status: 'idle', thoughtsHistory: [] });
            return; // Success, stop processing
          } else {
            console.error('[AI Extractor] confirmAISlotDirectly não disponível');
            setAiState((prev) => ({
              ...prev,
              status: 'error',
              message: 'Função de confirmação não disponível',
            }));
            resetToStartButtonRef.current = setTimeout(
              () => setAiState((prev) => ({ ...prev, status: 'ready' })),
              5000,
            );
            return;
          }
        }
      }

      // No images found on any page
      setAiState((prev) => ({
        ...prev,
        status: 'error',
        message: 'Nenhuma imagem encontrada na questão',
      }));
      resetToStartButtonRef.current = setTimeout(
        () => setAiState((prev) => ({ ...prev, status: 'ready' })),
        5000,
      );
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setAiState((prev) => ({ ...prev, status: 'cancelled' }));
        resetToStartButtonRef.current = setTimeout(
          () => setAiState((prev) => ({ ...prev, status: 'ready' })),
          5000,
        );
      } else {
        setAiState((prev) => ({ ...prev, status: 'error', message: e.message }));
        resetToStartButtonRef.current = setTimeout(
          () => setAiState((prev) => ({ ...prev, status: 'ready' })),
          5000,
        );
      }
    }
  }, [getParentGroupCrops, slotId, parentGroupId]);

  // Auto-start countdown when slot becomes empty
  useEffect(() => {
    if (internalMode === 'empty' && aiState.status === 'idle' && !readOnly) {
      // Start AI countdown automatically when empty slot appears
      startAICountdown();
    }

    return () => {
      // Cleanup on unmount
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      if (resetToStartButtonRef.current) {
        clearTimeout(resetToStartButtonRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [internalMode, readOnly]);

  // ========== EXISTING LOGIC ==========

  // Sync internal mode with props if external data changes
  useEffect(() => {
    // If props update (e.g. initial load or save from server), they take precedence if no local override exists yet
    // or we can treat them as a "reset". For now, let's allow props to set the baseline.
    if (currentData?.pdf_page || currentData?.pdf_url) {
      setInternalMode((prev) => (prev === 'capturing' ? 'capturing' : 'filled'));
    } else {
      setInternalMode((prev) => (prev === 'capturing' ? 'capturing' : 'empty'));
    }
  }, [currentData]);

  useEffect(() => {
    const handleModeChange = (e: CustomEvent) => {
      // e.detail: { slotId, mode: 'capturing'|'filled'|'idle' }
      if (e.detail.slotId == slotId) {
        if (e.detail.mode === 'idle') {
          // check if we have data to decide if empty or filled
          const hasData =
            localData?.pdf_page ||
            currentData?.pdf_page ||
            localData?.pdf_url ||
            currentData?.pdf_url;
          setInternalMode(hasData ? 'filled' : 'empty');
        } else {
          setInternalMode(e.detail.mode);
        }
      }
    };

    const handleSlotUpdate = (e: CustomEvent) => {
      if (e.detail.slotId == slotId) {
        console.log(`[ImageSlotCard] Slot Update recebido para ${slotId}`, e.detail);

        if (e.detail.action === 'filled' && e.detail.cropData) {
          // Merge cropData into local state
          setLocalData({
            id: slotId,
            ...e.detail.cropData,
            // previewUrl removed
          });
          setInternalMode('filled');
          // Stop AI extraction if running
          if (countdownRef.current) clearInterval(countdownRef.current);
          if (abortControllerRef.current) abortControllerRef.current.abort();
          setAiState({ status: 'idle', thoughtsHistory: [] });

          // [BATCH] Notifica BatchProcessor que o slot foi preenchido
          window.dispatchEvent(
            new CustomEvent('batch-slot-filled', {
              detail: { slotId },
            }),
          );
        } else if (e.detail.action === 'cleared') {
          setLocalData(null);
          setInternalMode('empty');
        }
      }
    };

    window.addEventListener('image-slot-mode-change' as any, handleModeChange);
    window.addEventListener('slot-update' as any, handleSlotUpdate);

    return () => {
      window.removeEventListener('image-slot-mode-change' as any, handleModeChange);
      window.removeEventListener('slot-update' as any, handleSlotUpdate);
    };
  }, [slotId, currentData, localData]);

  // Helper to trigger start
  const handleStartCapture = () => {
    // Cancel AI if running
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setAiState({ status: 'idle', thoughtsHistory: [] });

    window.dispatchEvent(
      new CustomEvent('image-slot-action', {
        detail: { action: 'start-capture', slotId, parentGroupId },
      }),
    );
  };

  const handleEdit = () => {
    // Call global function or dispatch
    if (typeof editImageSlotMode === 'function') {
      editImageSlotMode(slotId);
    } else {
      // Fallback dispatch
      window.dispatchEvent(
        new CustomEvent('image-slot-action', {
          detail: { action: 'edit', slotId },
        }),
      );
    }
  };

  const handleDelete = () => {
    if (typeof deleteImageSlot === 'function') {
      deleteImageSlot(slotId);
    } else {
      window.dispatchEvent(
        new CustomEvent('image-slot-action', {
          detail: { action: 'delete', slotId },
        }),
      );
    }
  };

  const handleConfirm = () => {
    if (typeof confirmImageSlotMode === 'function') {
      confirmImageSlotMode();
    }
  };

  const handleCancel = () => {
    if (typeof cancelImageSlotMode === 'function') {
      cancelImageSlotMode();
    }
  };

  // --- RENDERERS ---

  // Shared styles for the card container (Empty or Filled)
  const color = '#00BCD4'; // Cyan
  const borderColor = '5px solid rgb(0, 188, 212)';
  // Less opacity for empty state background maybe? Or consistent? Let's keep consistent for "Card" feel.
  const background = `linear-gradient(90deg, rgba(0, 188, 212, 0.082) 0%, transparent 40%)`;

  // ========== AI EXTRACTION HEADER COMPONENT ==========
  const renderAIHeader = () => {
    if (aiState.status === 'idle') return null;

    const isCountdown = aiState.status === 'countdown';
    const isThinking = aiState.status === 'thinking';
    // Use isExtracting explicitly
    const isExtracting = aiState.status === 'extracting';

    // Success/error/cancel should show the thought history too until user dismisses or resets
    const isSuccess = aiState.status === 'success';
    const isError = aiState.status === 'error';

    // Different background colors based on state
    let bgGradient = 'linear-gradient(90deg, rgba(99, 102, 241, 0.15) 0%, transparent 60%)';
    let borderColor = 'rgba(99, 102, 241, 0.2)';

    if (isSuccess) {
      bgGradient = 'linear-gradient(90deg, rgba(34, 197, 94, 0.2) 0%, transparent 60%)';
      borderColor = 'rgba(34, 197, 94, 0.3)';
    } else if (isError) {
      bgGradient = 'linear-gradient(90deg, rgba(239, 68, 68, 0.15) 0%, transparent 60%)';
      borderColor = 'rgba(239, 68, 68, 0.2)';
    } else if (isThinking || isExtracting) {
      bgGradient = 'linear-gradient(90deg, rgba(168, 85, 247, 0.15) 0%, transparent 60%)';
      borderColor = 'rgba(168, 85, 247, 0.2)';
    }

    // Determine Title and Icon
    let icon = '🤖';
    let title = 'Análise';

    if (isCountdown) {
      title = `Iniciando em ${aiState.secondsLeft}s...`;
      icon = '⏳';
    }
    if (isExtracting) {
      title = (aiState as any).message || 'Extraindo...';
    }
    if (isThinking) {
      // Main title remains generic
      title = 'IA Analisando...';
    }
    if (isSuccess) {
      title = aiState.message || 'Extração Concluída';
      icon = '✅';
    }
    if (isError) {
      title = aiState.message || 'Erro na Extração';
      icon = '❌';
    }
    if (aiState.status === 'cancelled') {
      title = 'Cancelado';
      icon = '🛑';
    }
    if (aiState.status === 'ready') {
      title = 'Extrair imagem com IA';
      icon = '✨';
    }

    // Last thought for the details summary
    const latestRaw = aiState.thoughtsHistory[aiState.thoughtsHistory.length - 1] || '';
    const parsed = (window as any).splitThought
      ? (window as any).splitThought(latestRaw)
      : { title: latestRaw, body: '' };
    const latestThoughtTitle = parsed.title || 'Processando...';

    return (
      <div
        className={`ai-slot-extraction-header ${isCountdown ? 'countdown-active' : ''} ${isThinking ? 'thinking-active' : ''}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          padding: '8px 12px',
          background: bgGradient,
          borderBottom: `1px solid ${borderColor}`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Animated border for countdown */}
        {isCountdown && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '2px',
              background: 'linear-gradient(90deg, #6366F1, #8B5CF6)',
              animation: 'ai-countdown-bar 5s linear forwards',
              width: '100%',
            }}
          />
        )}

        {/* Thinking/extracting pulse animation */}
        {(isThinking || isExtracting) && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '2px',
              background: isThinking
                ? 'linear-gradient(90deg, #A855F7, #6366F1, #A855F7)'
                : 'linear-gradient(90deg, #6366F1, #8B5CF6)',
              backgroundSize: '200% 100%',
              animation: 'ai-thinking-pulse 1.5s ease-in-out infinite',
              width: '100%',
            }}
          />
        )}

        {/* Main Row: Logo + Status + Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Logo / Icon */}
          <img
            src="logo.png"
            alt="Maia"
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '4px',
              animation: isThinking ? 'ai-logo-pulse 1s ease-in-out infinite' : undefined,
              display: 'block',
            }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <span className="agent-icon" style={{ display: 'none' }}>
            {icon}
          </span>

          {/* Title / Status Text */}
          <span
            style={{
              fontSize: '12px',
              color: isSuccess ? '#86efac' : '#e2e8f0',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: isSuccess ? 600 : 400,
            }}
          >
            {title}
          </span>

          {/* Controls (Cancel / Start) */}
          {(isCountdown || isExtracting || isThinking) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                cancelAICountdown();
              }}
              style={{
                fontSize: '11px',
                padding: '4px 10px',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '4px',
                color: '#fc8181',
                cursor: 'pointer',
                zIndex: 20,
              }}
            >
              Cancelar
            </button>
          )}

          {aiState.status === 'ready' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                manualStartAI();
              }}
              style={{
                fontSize: '11px',
                padding: '4px 10px',
                background: 'rgba(99, 102, 241, 0.2)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                borderRadius: '4px',
                color: '#a5b4fc',
                cursor: 'pointer',
                zIndex: 20,
              }}
            >
              Iniciar
            </button>
          )}

          {/* Retry button after error */}
          {aiState.status === 'error' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                manualStartAI();
              }}
              style={{
                fontSize: '11px',
                padding: '4px 10px',
                background: 'rgba(99, 102, 241, 0.2)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                borderRadius: '4px',
                color: '#a5b4fc',
                cursor: 'pointer',
                zIndex: 20,
              }}
            >
              Tentar Novamente
            </button>
          )}
        </div>

        {/* Maia Thoughts Details - Below Main Row */}
        {(isThinking || isSuccess || isError) && (
          <details
            className="maia-thoughts type-analysis"
            style={{ marginTop: '4px', border: 'none', background: 'transparent' }}
          >
            <summary
              className="maia-thoughts-summary"
              style={{
                padding: '0px',
                minHeight: 'auto',
                background: 'transparent',
                borderBottom: 'none',
              }}
            >
              <div className="maia-thoughts-header-content">
                <div className="maia-thoughts-title-group" style={{ opacity: 0.8 }}>
                  <span className="agent-text" style={{ fontSize: '11px', fontStyle: 'italic' }}>
                    {latestThoughtTitle}
                  </span>
                </div>
              </div>
            </summary>

            {/* Thoughts Body History */}
            <div
              id="ai-thoughts-list"
              style={{
                maxHeight: '200px',
                overflowY: 'auto',
                padding: '8px 0',
                marginTop: '4px',
                borderTop: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {aiState.thoughtsHistory.map((rawThought, idx) => {
                const { title, body } = (window as any).splitThought
                  ? (window as any).splitThought(rawThought)
                  : { title: rawThought, body: '' };

                if (!title && (!body || body === '...')) return null;

                let content = null;
                if (title && body && title.trim() !== body.trim()) {
                  content = (
                    <>
                      <div
                        className="maia-thought-title-inline"
                        style={{ fontWeight: 700, marginBottom: 4, color: 'var(--color-primary)' }}
                      >
                        {title}
                      </div>
                      <div className="maia-thought-body">{body}</div>
                    </>
                  );
                } else {
                  content = <div className="maia-thought-body is-title">{title || body}</div>;
                }

                return (
                  <div key={idx} className="maia-thought-card">
                    <div className="maia-thought-logo-wrap">
                      <img src="logo.png" className="maia-thought-logo" alt="Maia" />
                    </div>
                    <div className="maia-thought-content">{content}</div>
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </div>
    );
  };

  if (internalMode === 'empty') {
    // Empty State - Dashed Placeholder INSIDE the standard card structure
    const isAIBusy =
      aiState.status === 'extracting' ||
      aiState.status === 'thinking' ||
      aiState.status === 'countdown';

    return (
      <div
        className="cropper-group-item image-slot-card empty"
        data-slot-id={slotId}
        style={{
          borderLeft: borderColor,
          background: background,
          transition: 'background 0.4s',
          marginBottom: '10px',
          borderRadius: '4px',
          position: 'relative',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* AI Extraction Header */}
        {renderAIHeader()}

        {/* Header - Identical to Sidebar */}
        <div
          className="cropper-group-header"
          style={{
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <span
            className="cropper-group-title"
            style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '14px', whiteSpace: 'nowrap' }}
          >
            {label}
          </span>
          <div className="cropper-group-tags" style={{ marginLeft: 'auto', marginRight: '8px' }}>
            <span
              className="question-badge"
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: '#a0aec0',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                whiteSpace: 'nowrap',
              }}
            >
              VAZIO
            </span>
          </div>
        </div>

        {/* Content - Dashed Area */}
        <div style={{ padding: '0 12px 12px 12px', width: '100%', boxSizing: 'border-box' }}>
          <div
            className="js-captura-trigger"
            data-action={isAIBusy ? '' : 'select-slot'}
            data-slot-id={slotId}
            data-parent-group-id={parentGroupId}
            data-idx={slotId} // Compatibility with both delegation checks
            style={{
              border: '2px dashed #4a5568',
              borderRadius: '6px',
              padding: '30px 20px',
              textAlign: 'center',
              cursor: isAIBusy ? 'not-allowed' : 'pointer',
              color: isAIBusy ? '#555' : '#a0aec0',
              transition: 'all 0.2s ease',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              opacity: isAIBusy ? 0.6 : 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              boxSizing: 'border-box',
              pointerEvents: isAIBusy ? 'none' : 'auto',
            }}
            title={isAIBusy ? 'Aguarde a IA...' : 'Clique para selecionar manualmente'}
            onClick={isAIBusy ? undefined : handleStartCapture}
          >
            <div style={{ fontSize: '28px' }}>📷</div>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>
              Clique para selecionar manualmente
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Determine effective data to display (local update wins over props until saved/refreshed)
  const effectiveData = localData || currentData;

  // Active / Filled Style (Shared Visuals)
  // Variables 'color', 'borderColor', 'background' are already defined above.

  return (
    <div
      className="cropper-group-item"
      style={{
        borderLeft: borderColor,
        background: background,
        transition: 'background 0.4s',
        marginBottom: '10px',
        borderRadius: '4px', // Ensure slight rounded corners like sidebar
        position: 'relative',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div
        className="cropper-group-header"
        style={{ padding: '8px 12px', display: 'flex', alignItems: 'center' }}
      >
        <span
          className="cropper-group-title"
          style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '14px' }}
        >
          {label}
        </span>
        <div
          className="cropper-group-tags"
          style={{
            display: 'flex',
            gap: '4px',
            marginLeft: 'auto',
            marginRight: '8px',
          }}
        >
          {internalMode === 'capturing' && (
            <span
              className="question-badge manual"
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(255, 152, 0, 0.2)',
                color: '#FF9800',
                border: '1px solid rgba(255, 152, 0, 0.3)',
              }}
            >
              EDITANDO
            </span>
          )}
          {internalMode === 'filled' && (
            <span
              className="question-badge"
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: 'rgba(0, 188, 212, 0.2)',
                color: '#00BCD4',
                border: '1px solid rgba(0, 188, 212, 0.3)',
              }}
            >
              PREENCHIDO
            </span>
          )}
        </div>
      </div>

      {/* Content Area - Estrutura simplificada: só padding + embed */}
      {internalMode === 'filled' && effectiveData && (
        <div style={{ padding: '0 12px 12px 12px' }}>
          <PdfEmbedRenderer
            pdfUrl={effectiveData.pdf_url || effectiveData.previewUrl}
            page={effectiveData.pdf_page || 1}
            zoom={effectiveData.pdf_zoom || 200}
            cropDetails={{
              pdf_left: effectiveData.pdf_left || 0,
              pdf_top: effectiveData.pdf_top || 0,
              pdf_width: effectiveData.pdf_width || '100%',
              pdf_height: effectiveData.pdf_height || 300,
              pdfjs_source_w: effectiveData.pdfjs_source_w,
              pdfjs_source_h: effectiveData.pdfjs_source_h,
              pdfjs_x: effectiveData.pdfjs_x,
              pdfjs_y: effectiveData.pdfjs_y,
              pdfjs_crop_w: effectiveData.pdfjs_crop_w,
              pdfjs_crop_h: effectiveData.pdfjs_crop_h,
            }}
            style={{
              borderRadius: '4px',
              border: '1px solid #4a5568',
              backgroundColor: '#171923',
            }}
            scaleToFit={true}
          />
        </div>
      )}

      {/* Actions Footer */}
      <div className="cropper-actions" style={{ padding: '12px' }}>
        {internalMode === 'capturing' ? (
          // --- CAPTURING MODE ACTIONS ---
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', width: '100%' }}>
              <button
                className="btn btn--secondary btn--sm"
                style={{ flex: 1, width: '100%', display: 'block' }}
                onClick={() => {
                  // Direct logic if accessible or via window
                  if (window.CropperState) window.CropperState.undo();
                }}
                title="Desfazer (Ctrl+Z)"
              >
                ⟲ Desfazer
              </button>
              <button
                className="btn btn--secondary btn--sm"
                style={{ flex: 1, width: '100%', display: 'block' }}
                onClick={() => {
                  if (window.CropperState) window.CropperState.redo();
                }}
                title="Refazer (Ctrl+Y)"
              >
                ⟳ Refazer
              </button>
            </div>

            <button
              className="btn btn--outline btn--sm btn--full-width"
              style={{ marginBottom: '0.5rem', width: '100%' }}
              onClick={handleCancel}
            >
              Cancelar
            </button>

            <button
              className="btn btn--primary btn--sm btn--full-width"
              style={{ width: '100%' }}
              onClick={handleConfirm}
            >
              Concluir
            </button>
          </div>
        ) : (
          // --- FILLED MODE ACTIONS ---
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            {!readOnly && (
              <>
                <button
                  className="btn btn--sm btn--secondary"
                  style={{ flex: 1, display: 'block' }}
                  onClick={handleEdit}
                >
                  Editar / Recortar
                </button>
                <button
                  className="btn btn--sm btn--secondary"
                  style={{ flex: 1, display: 'block', color: '#fc8181', borderColor: '#fc8181' }}
                  onClick={handleDelete}
                  title="Remover Imagem"
                >
                  Excluir
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
