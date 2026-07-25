import type React from 'react';

interface ReviewButtonsProps {
  fieldId: string;
  state: 'approved' | 'rejected' | null;
  onApprove: (fieldId: string) => void;
  onReject: (fieldId: string) => void;
  size?: 'sm' | 'md';
}

/**
 * Botões de verificação ✅❌ para o modo de revisão
 */
export const ReviewButtons: React.FC<ReviewButtonsProps> = ({
  fieldId,
  state,
  onApprove,
  onReject,
  size = 'sm',
}) => {
  const sizeClass = size === 'sm' ? 'review-btn--sm' : 'review-btn--md';

  return (
    <div className="review-btn-group">
      <button
        type="button"
        className={`review-btn review-btn--approve ${sizeClass} ${state === 'approved' ? 'active' : ''}`}
        onClick={() => onApprove(fieldId)}
        title="Aprovar"
      >
        ✓
      </button>
      <button
        type="button"
        className={`review-btn review-btn--reject ${sizeClass} ${state === 'rejected' ? 'active' : ''}`}
        onClick={() => onReject(fieldId)}
        title="Rejeitar"
      >
        ✗
      </button>
    </div>
  );
};

/**
 * Wrapper que adiciona os botões de revisão a um campo
 */
export const ReviewableField: React.FC<{
  fieldId: string;
  state: 'approved' | 'rejected' | null;
  onApprove: (fieldId: string) => void;
  onReject: (fieldId: string) => void;
  children: React.ReactNode;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}> = ({ fieldId, state, onApprove, onReject, children, label, className = '', style }) => {
  const stateClass =
    state === 'approved' ? 'field-approved' : state === 'rejected' ? 'field-rejected' : '';

  return (
    <div className={`reviewable-field ${stateClass} ${className}`} style={style}>
      {label && (
        <div className="reviewable-field-header">
          <span className="field-label">{label}</span>
          <ReviewButtons
            fieldId={fieldId}
            state={state}
            onApprove={onApprove}
            onReject={onReject}
          />
        </div>
      )}
      <div className="reviewable-field-content">{children}</div>
      {!label && (
        <div className="reviewable-field-inline-btns">
          <ReviewButtons
            fieldId={fieldId}
            state={state}
            onApprove={onApprove}
            onReject={onReject}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Componente para renderizar tags individuais com botões de revisão
 */
export const ReviewableTags: React.FC<{
  items: string[];
  fieldPrefix: string;
  tagClass: string;
  reviewState: Record<string, 'approved' | 'rejected' | null>;
  onApprove: (fieldId: string) => void;
  onReject: (fieldId: string) => void;
}> = ({ items, fieldPrefix, tagClass, reviewState, onApprove, onReject }) => {
  if (!items || items.length === 0) {
    return <span style={{ color: 'gray', fontSize: '12px' }}>Nenhum item</span>;
  }

  return (
    <div className="reviewable-tags-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {items.map((item, idx) => {
        const fieldId = `${fieldPrefix}_${idx}`;
        const state = reviewState[fieldId] || null;
        const stateClass =
          state === 'approved' ? 'tag-approved' : state === 'rejected' ? 'tag-rejected' : '';

        return (
          <div
            key={idx}
            className={`reviewable-tag ${stateClass}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '10px',
              borderRadius: '10px',
              background: 'var(--color-background-json)',
            }}
          >
            <span className={tagClass}>{item}</span>
            <div className="review-btn-group" style={{ marginLeft: '2px' }}>
              <button
                type="button"
                className={`review-btn review-btn--approve review-btn--xs ${state === 'approved' ? 'active' : ''}`}
                onClick={() => onApprove(fieldId)}
                title="Aprovar"
              >
                ✓
              </button>
              <button
                type="button"
                className={`review-btn review-btn--reject review-btn--xs ${state === 'rejected' ? 'active' : ''}`}
                onClick={() => onReject(fieldId)}
                title="Rejeitar"
              >
                ✗
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ReviewButtons;
