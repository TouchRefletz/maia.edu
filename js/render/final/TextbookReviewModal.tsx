import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { customAlert } from '../../ui/GlobalAlertsLogic';
import { indexBookInPinecone } from '../../services/textbook-extractor.js';

interface TextbookReviewModalProps {
  slug: string;
  pagesData: Record<number, any>;
  totalPages?: number;
  onClose: () => void;
}

export const TextbookReviewModal: React.FC<TextbookReviewModalProps> = ({
  slug,
  pagesData = {},
  totalPages = 0,
  onClose,
}) => {
  const [pages, setPages] = useState<Record<number, any>>(pagesData);
  const [isSyncing, setIsSyncing] = useState(false);

  const getDOMTotalPages = () => {
    if (typeof document !== 'undefined') {
      const pageNumEl = document.getElementById('page_num');
      if (pageNumEl && pageNumEl.textContent) {
        const m = pageNumEl.textContent.match(/\/\s*(\d+)/);
        if (m && m[1]) return parseInt(m[1], 10);
      }
      const bodyText = document.body ? document.body.innerText : '';
      const m2 = bodyText.match(/PAG\s*\d+\s*\/\s*(\d+)/i);
      if (m2 && m2[1]) return parseInt(m2[1], 10);
    }
    return 0;
  };

  const expectedTotalPages =
    totalPages ||
    (window as any).viewerState?.pdfDoc?.numPages ||
    (window as any).__pdfTotalPages ||
    getDOMTotalPages();

  const pageNumbers = Object.keys(pages)
    .map(Number)
    .sort((a, b) => a - b);
  const scannedCount = pageNumbers.length;

  // O botão só é liberado SOMENTE se TODAS as páginas forem escaneadas
  const isAllPagesScanned =
    expectedTotalPages > 0 ? scannedCount >= expectedTotalPages : false;

  // Agrega todos os tópicos da estrutura do livro
  const bookTree: any[] = [];
  Object.values(pages).forEach((page: any) => {
    if (page?.mapeamento_estrutura && Array.isArray(page.mapeamento_estrutura)) {
      page.mapeamento_estrutura.forEach((topico: any) => {
        if (!bookTree.some((t) => t.id_topico === topico.id_topico)) {
          bookTree.push(topico);
        }
      });
    }
  });

  const handleResumoChange = (pageNum: number, val: string) => {
    setPages((prev) => ({
      ...prev,
      [pageNum]: {
        ...prev[pageNum],
        resumo: val,
      },
    }));
  };

  const handleSync = async () => {
    if (!isAllPagesScanned) {
      customAlert(
        `⚠️ Escaneamento incompleto (${scannedCount}/${expectedTotalPages || '?'} páginas). É necessário escanear todas as páginas antes de sincronizar.`,
        4000,
      );
      return;
    }

    const currentHfUrl =
      (window as any).__pdfOriginalUrl || (window as any).__pdfDownloadUrl || '';
    if (!currentHfUrl || !currentHfUrl.trim()) {
      customAlert(
        '❌ Sincronização bloqueada: O livro didático não possui hf_url configurado no Hugging Face.',
        5000,
      );
      return;
    }

    setIsSyncing(true);
    try {
      console.log(`[TextbookReview] Sincronizando livro ${slug}...`, pages);
      await indexBookInPinecone(slug, pages, { slug, hf_url: currentHfUrl });
      customAlert(
        '✅ Livro Didático (livro completo + cada página) sincronizado com sucesso no Pinecone!',
        4000,
      );
      onClose();
    } catch (err: any) {
      customAlert('❌ Erro na sincronização final: ' + (err.message || err), 4000);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.82)',
        backdropFilter: 'blur(8px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: 'var(--color-surface, #1e293b)',
          border: '1px solid var(--color-border, #334155)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '900px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          color: 'var(--color-text, #f8fafc)',
          fontFamily: 'inherit',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--color-border, #334155)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--color-primary, #38bdf8)', fontWeight: 600 }}>
              📖 Revisão e Sincronização do Livro Didático
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
              Slug: <strong style={{ color: '#cbd5e1' }}>{slug}</strong> | Progresso de Extração:{' '}
              <strong style={{ color: isAllPagesScanned ? '#34d399' : '#f87171' }}>
                {scannedCount}/{expectedTotalPages || '?'} Páginas
              </strong>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.4rem',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'all 0.2s ease',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {/* Status Banner */}
          {!isAllPagesScanned ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '10px',
                color: '#f87171',
                fontSize: '0.85rem',
                marginBottom: '20px',
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>⚠️</span>
              <div>
                <strong>Escaneamento incompleto ({scannedCount}/{expectedTotalPages || '?'} páginas):</strong> É necessário aguardar a extração de <strong>todas</strong> as páginas do livro para liberar a sincronização vetorial.
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '10px',
                color: '#34d399',
                fontSize: '0.85rem',
                marginBottom: '20px',
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>✅</span>
              <div>
                <strong>Escaneamento completo ({scannedCount}/{expectedTotalPages} páginas):</strong> Todas as páginas foram analisadas e o livro está pronto para indexação.
              </div>
            </div>
          )}

          {/* Tópicos Estruturais Mapeados */}
          {bookTree.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: '12px', color: '#cbd5e1', fontWeight: 600 }}>
                🌳 Árvore Estrutural do Livro ({bookTree.length} Tópicos Mapeados)
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {bookTree.map((top, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(51, 65, 85, 0.4)',
                      border: '1px solid #334155',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      color: '#e2e8f0',
                    }}
                  >
                    <strong style={{ color: '#38bdf8' }}>{top.id_topico}</strong> - {top.titulo_topico}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Páginas do Livro */}
          <h3 style={{ fontSize: '0.95rem', marginBottom: '12px', color: '#cbd5e1', fontWeight: 600 }}>
            📄 Resumos e Mapeamentos por Página
          </h3>

          {pageNumbers.length === 0 ? (
            <p style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.9rem' }}>
              Nenhuma página foi analisada ainda. Execute o escaneamento via Core Vision para gerar os resumos.
            </p>
          ) : (
            pageNumbers.map((pNum) => {
              const pData = pages[pNum] || {};
              return (
                <div
                  key={pNum}
                  style={{
                    background: 'rgba(30, 41, 59, 0.5)',
                    border: '1px solid #334155',
                    borderRadius: '10px',
                    padding: '16px',
                    marginBottom: '12px',
                  }}
                >
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#38bdf8', fontWeight: 600 }}>
                    Página {pNum}
                  </h4>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      color: '#94a3b8',
                      marginBottom: '6px',
                      fontWeight: 500,
                    }}
                  >
                    Resumo Teórico Exaustivo:
                  </label>
                  <textarea
                    value={pData.resumo || ''}
                    onChange={(e) => handleResumoChange(pNum, e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: '80px',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      padding: '10px',
                      fontSize: '0.82rem',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--color-border, #334155)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            background: 'rgba(15, 23, 42, 0.4)',
            borderBottomLeftRadius: '16px',
            borderBottomRightRadius: '16px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: '1px solid #334155',
              background: 'transparent',
              color: '#94a3b8',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '0.875rem',
              transition: 'all 0.2s ease',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSync}
            disabled={!isAllPagesScanned || isSyncing}
            style={{
              padding: '10px 22px',
              borderRadius: '8px',
              border: 'none',
              background: !isAllPagesScanned || isSyncing
                ? '#334155'
                : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: !isAllPagesScanned || isSyncing ? '#94a3b8' : '#ffffff',
              cursor: !isAllPagesScanned || isSyncing ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
              opacity: !isAllPagesScanned || isSyncing ? 0.6 : 1,
              boxShadow: !isAllPagesScanned || isSyncing
                ? 'none'
                : '0 4px 14px rgba(2, 132, 199, 0.35)',
              transition: 'all 0.2s ease',
            }}
          >
            {isSyncing
              ? 'Sincronizando...'
              : '🚀 Sincronizar Livro Didático (Pinecone & Hugging Face)'}
          </button>
        </div>
      </div>
    </div>
  );
};

export function openTextbookReviewModal(
  slug: string,
  pagesData: Record<number, any>,
  totalPages: number = 0,
) {
  const containerId = 'textbook-review-modal-root';
  let modalContainer = document.getElementById(containerId);
  if (!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.id = containerId;
    document.body.appendChild(modalContainer);
  }

  const root = createRoot(modalContainer);
  const handleClose = () => {
    root.unmount();
    modalContainer?.remove();
  };

  root.render(
    <TextbookReviewModal
      slug={slug}
      pagesData={pagesData}
      totalPages={totalPages}
      onClose={handleClose}
    />,
  );
}
