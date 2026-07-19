// --- AlternativasRender.tsx ---
import React from 'react';
import { AlternativeStructure } from './StructureRender';

interface EstruturaItem {
  tipo: string;
  conteudo: string;
}

interface Alternativa {
  letra?: string;
  estrutura?: EstruturaItem[];
  texto?: string;
}

interface AlternativasProps {
  alts?: Alternativa[];
  // Props de revisão
  isReviewMode?: boolean;
  reviewState?: Record<string, 'approved' | 'rejected' | null>;
  onApprove?: (fieldId: string) => void;
  onReject?: (fieldId: string) => void;
}

export const Alternativas: React.FC<AlternativasProps> = ({ 
  alts, 
  isReviewMode, 
  reviewState, 
  onApprove, 
  onReject 
}) => {
  if (!alts || alts.length === 0) {
    return <div className="data-box">Sem alternativas</div>;
  }

  return (
    <>
      {alts.map((a, index) => {
        const letra = String(a?.letra ?? '')
          .trim()
          .toUpperCase();

        const estrutura = Array.isArray(a?.estrutura)
          ? a.estrutura
          : [{ tipo: 'texto', conteudo: String(a?.texto ?? '') }];

        const altFieldId = `alt_${letra}`;
        const altState = reviewState?.[altFieldId] || null;

        // Modo revisão: envolve com botões
        if (isReviewMode && onApprove && onReject) {
          const stateClass = altState === 'approved' ? 'block-approved' : altState === 'rejected' ? 'block-rejected' : '';

          return (
            <div className={`reviewable-block ${stateClass}`} key={`${letra}-${index}`} style={{ marginBottom: '12px' }}>
              {/* Header da alternativa com botões */}
              <div className="reviewable-block-header">
                <span className="reviewable-block-tipo" style={{ fontWeight: 'bold', fontSize: '14px' }}>
                  Alternativa {letra}
                </span>
                <div className="review-btn-group">
                  <button
                    type="button"
                    className={`review-btn review-btn--approve review-btn--xs ${altState === 'approved' ? 'active' : ''}`}
                    onClick={() => onApprove(altFieldId)}
                    title="Aprovar alternativa"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    className={`review-btn review-btn--reject review-btn--xs ${altState === 'rejected' ? 'active' : ''}`}
                    onClick={() => onReject(altFieldId)}
                    title="Rejeitar alternativa"
                  >
                    ✗
                  </button>
                </div>
              </div>
              
              {/* Conteúdo com blocos individuais */}
              <div className="alt-content" style={{ flex: 1, width: '100%', minWidth: 0 }}>
                <AlternativeStructure
                  estrutura={estrutura}
                  letra={letra}
                  imagensExternas={[]}
                  contexto="questao"
                  isReviewMode={true}
                  reviewState={reviewState}
                  onApprove={onApprove}
                  onReject={onReject}
                  blockPrefix={`alt_${letra}_bloco`}
                />
              </div>
            </div>
          );
        }

        // Modo normal
        return (
          <div className="alt-row" key={`${letra}-${index}`} style={{ display: 'flex', width: '100%', alignItems: 'flex-start' }}>
            <span className="alt-letter">{letra}</span>
            <div className="alt-content" style={{ flex: 1, width: '100%', minWidth: 0 }}>
              <AlternativeStructure
                estrutura={estrutura}
                letra={letra}
                imagensExternas={[]}
                contexto="questao"
              />
            </div>
          </div>
        );
      })}
    </>
  );
};
