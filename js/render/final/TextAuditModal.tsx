import React, { useState, useEffect, useRef } from 'react';
import { AuditItem, AuditOptions, runFullTextAudit, applyAuditFix } from '../../services/text-audit-service';
import { IA_MODELS } from '../../ui/ModelSelectorModal';

interface TextAuditModalProps {
  q: any;
  g: any;
  onClose: () => void;
  onApplyFixes: (updatedQ: any, updatedG: any) => void;
}

export const TextAuditModal: React.FC<TextAuditModalProps> = ({
  q,
  g,
  onClose,
  onApplyFixes
}) => {
  const isMounted = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [currentQ, setCurrentQ] = useState<any>(q);
  const [currentG, setCurrentG] = useState<any>(g);

  const [useLanguageTool, setUseLanguageTool] = useState(false); // Desativado por padrão por performance
  const [useAI, setUseAI] = useState(true);
  const [selectedModel, setSelectedModel] = useState('models/gemini-3.5-flash');

  const [isAuditing, setIsAuditing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [items, setItems] = useState<AuditItem[]>([]);
  const [hasRun, setHasRun] = useState(false);

  // No mount: Executa apenas a verificação instantânea por Heurísticas (0ms, sem chamadas pesadas)
  useEffect(() => {
    isMounted.current = true;
    runQuickHeuristicOnly();

    return () => {
      isMounted.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const runQuickHeuristicOnly = async () => {
    setIsAuditing(true);
    setStatusText('Executando verificação rápida de ideogramas...');
    try {
      const auditResults = await runFullTextAudit(currentQ, currentG, {
        useLanguageTool: false,
        useAI: false,
        onStatusUpdate: (msg) => { if (isMounted.current) setStatusText(msg); }
      });
      if (isMounted.current) {
        setItems(auditResults);
        setHasRun(true);
      }
    } catch (err) {
      console.error('Erro na auditoria rápida:', err);
    } finally {
      if (isMounted.current) setIsAuditing(false);
    }
  };

  const handleCancelAudit = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (isMounted.current) {
      setIsAuditing(false);
      setStatusText('Análise cancelada pelo usuário.');
    }
  };

  const handleRunAudit = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsAuditing(true);
    setStatusText('Iniciando auditoria de texto...');
    try {
      const options: AuditOptions = {
        useLanguageTool,
        useAI,
        modelId: selectedModel,
        onStatusUpdate: (msg) => {
          if (isMounted.current) setStatusText(msg);
        },
        signal: abortControllerRef.current.signal
      };

      const auditResults = await runFullTextAudit(currentQ, currentG, options);
      if (isMounted.current) {
        setItems(auditResults);
        setHasRun(true);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError' && !abortControllerRef.current?.signal.aborted) {
        console.error('Erro na auditoria:', err);
        if (isMounted.current) setStatusText('Erro ao executar auditoria.');
      } else if (isMounted.current) {
        setStatusText('Análise cancelada.');
      }
    } finally {
      if (isMounted.current) setIsAuditing(false);
    }
  };

  const handleAcceptItem = (item: AuditItem) => {
    const { updatedQ, updatedG } = applyAuditFix(currentQ, currentG, item);
    setCurrentQ(updatedQ);
    setCurrentG(updatedG);
    onApplyFixes(updatedQ, updatedG);

    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'accepted' } : i));
  };

  const handleRejectItem = (item: AuditItem) => {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'rejected' } : i));
  };

  const handleAcceptAll = () => {
    let workingQ = currentQ;
    let workingG = currentG;

    const pendingItems = items.filter(i => i.status === 'pending');
    pendingItems.forEach(item => {
      const { updatedQ, updatedG } = applyAuditFix(workingQ, workingG, item);
      workingQ = updatedQ;
      workingG = updatedG;
    });

    setCurrentQ(workingQ);
    setCurrentG(workingG);
    onApplyFixes(workingQ, workingG);

    setItems(prev => prev.map(i => i.status === 'pending' ? { ...i, status: 'accepted' } : i));
  };

  const handleRejectAll = () => {
    setItems(prev => prev.map(i => i.status === 'pending' ? { ...i, status: 'rejected' } : i));
  };

  const pendingCount = items.filter(i => i.status === 'pending').length;
  const acceptedCount = items.filter(i => i.status === 'accepted').length;

  return (
    <div
      className="text-audit-modal-overlay"
      style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10000,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', display: 'flex',
        justifyContent: 'center', alignItems: 'center'
      }}
    >
      <div
        className="text-audit-modal-content"
        style={{
          background: 'var(--color-surface, #1e293b)', color: '#f8fafc',
          border: '1px solid var(--color-border, #334155)',
          maxWidth: '1200px', width: '92%', height: '90vh', borderRadius: '12px',
          display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
        }}
      >
        {/* HEADER */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid var(--color-border, #334155)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.6)'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>🧹</span> Auditoria de Texto e Anti-Alucinação
            </h2>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px' }}>
              Verificação de erros ortográficos, acentuação corrompida (ex: â/ã) e ideogramas chineses.
            </div>
          </div>

          <button
            onClick={() => {
              if (abortControllerRef.current) abortControllerRef.current.abort();
              onClose();
            }}
            className="btn btn--sm"
            style={{ background: '#334155', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', padding: '6px 14px' }}
          >
            ✕ Fechar Auditoria
          </button>
        </div>

        {/* CONTROLS BAR */}
        <div style={{
          padding: '14px 24px', background: '#0f172a', borderBottom: '1px solid #334155',
          display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={useLanguageTool}
                onChange={e => setUseLanguageTool(e.target.checked)}
              />
              <span>LanguageTool (Sem IA)</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={useAI}
                onChange={e => setUseAI(e.target.checked)}
              />
              <span>Auditoria com IA</span>
            </label>

            {useAI && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Modelo:</span>
                <select
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                  style={{
                    background: '#1e293b', color: '#f8fafc', border: '1px solid #475569',
                    borderRadius: '6px', padding: '4px 8px', fontSize: '0.85rem'
                  }}
                >
                  {IA_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {isAuditing ? (
            <button
              onClick={handleCancelAudit}
              style={{
                background: '#ef4444', color: '#fff', border: 'none',
                borderRadius: '6px', padding: '8px 18px', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              ⛔ Cancelar Análise
            </button>
          ) : (
            <button
              onClick={handleRunAudit}
              style={{
                background: '#3b82f6', color: '#fff', border: 'none',
                borderRadius: '6px', padding: '8px 18px', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              🔍 Executar Auditoria Completa
            </button>
          )}
        </div>

        {/* BODY */}
        <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto', background: '#0f172a' }}>
          {isAuditing && (
            <div style={{ padding: '30px', textAlign: 'center', color: '#60a5fa', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '1.8rem' }}>⏳</div>
              <div style={{ fontWeight: 600 }}>{statusText}</div>
              <button
                onClick={handleCancelAudit}
                style={{
                  background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px',
                  padding: '6px 16px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer'
                }}
              >
                ⛔ Cancelar Análise da IA
              </button>
            </div>
          )}

          {!isAuditing && hasRun && pendingCount === 0 && acceptedCount === 0 && (
            <div style={{
              padding: '50px 20px', textAlign: 'center', background: '#1e293b',
              borderRadius: '8px', border: '1px solid #334155', marginTop: '20px'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🎉</div>
              <h3 style={{ margin: 0, color: '#4ade80' }}>Nenhum erro ou alucinação encontrado!</h3>
              <p style={{ color: '#94a3b8', marginTop: '8px', fontSize: '0.9rem' }}>
                O texto da questão e do gabarito está sem falhas aparentes de acentuação, ortografia ou ideogramas orientais.
              </p>
            </div>
          )}

          {!isAuditing && items.length > 0 && (
            <div>
              {/* SUMMARY & BATCH ACTIONS */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '16px', padding: '10px 14px', background: '#1e293b',
                borderRadius: '8px', border: '1px solid #334155'
              }}>
                <div style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
                  Encontrados <strong style={{ color: '#f59e0b' }}>{items.length}</strong> problemas
                  {pendingCount > 0 && <span> (<strong style={{ color: '#60a5fa' }}>{pendingCount}</strong> pendentes)</span>}
                  {acceptedCount > 0 && <span> • <strong style={{ color: '#4ade80' }}>{acceptedCount}</strong> aceitos</span>}
                </div>

                {pendingCount > 0 && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={handleAcceptAll}
                      style={{
                        background: '#166534', color: '#4ade80', border: '1px solid #22c55e',
                        borderRadius: '6px', padding: '5px 12px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      ✅ Aceitar Todos Pendentes
                    </button>
                    <button
                      onClick={handleRejectAll}
                      style={{
                        background: '#334155', color: '#94a3b8', border: '1px solid #475569',
                        borderRadius: '6px', padding: '5px 12px', fontSize: '0.82rem', cursor: 'pointer'
                      }}
                    >
                      ❌ Recusar Todos
                    </button>
                  </div>
                )}
              </div>

              {/* CARDS LIST WITH DIFF VIEW */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {items.map((item) => {
                  const isAccepted = item.status === 'accepted';
                  const isRejected = item.status === 'rejected';

                  return (
                    <div
                      key={item.id}
                      style={{
                        background: '#1e293b', borderRadius: '8px', border: '1px solid #334155',
                        overflow: 'hidden', opacity: isRejected ? 0.45 : 1, transition: 'all 0.2s ease'
                      }}
                    >
                      {/* CARD HEADER */}
                      <div style={{
                        padding: '10px 16px', background: '#0f172a', borderBottom: '1px solid #334155',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{
                            background: '#3b82f6', color: '#fff', fontSize: '0.75rem', fontWeight: 700,
                            padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase'
                          }}>
                            {item.fieldPath}
                          </span>
                          <span style={{
                            background: item.source === 'ia' ? '#8b5cf6' : (item.source === 'languagetool' ? '#06b6d4' : '#eab308'),
                            color: '#fff', fontSize: '0.72rem', padding: '2px 7px', borderRadius: '4px', fontWeight: 600
                          }}>
                            {item.source === 'ia' ? 'IA' : (item.source === 'languagetool' ? 'LanguageTool' : 'Heurística')}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.83rem', color: '#fbbf24', fontStyle: 'italic' }}>
                          {item.reason}
                        </div>
                      </div>

                      {/* DIFF VIEW CONTAINER (SIDE-BY-SIDE / CODE DIFF STYLE) */}
                      <div style={{ padding: '14px 16px' }}>
                        <div style={{
                          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px',
                          fontFamily: 'monospace', fontSize: '0.88rem', lineHeight: 1.5
                        }}>
                          {/* REMOVED / ORIGINAL (RED) */}
                          <div style={{
                            background: 'rgba(239, 68, 68, 0.12)', borderLeft: '4px solid #ef4444',
                            borderRadius: '4px', padding: '10px 12px', color: '#fca5a5', overflowX: 'auto'
                          }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', marginBottom: '4px', textTransform: 'uppercase' }}>
                              - Original (Com Problema)
                            </div>
                            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {item.originalText}
                            </div>
                          </div>

                          {/* ADDED / SUGGESTED (GREEN) */}
                          <div style={{
                            background: 'rgba(34, 197, 94, 0.12)', borderLeft: '4px solid #22c55e',
                            borderRadius: '4px', padding: '10px 12px', color: '#86efac', overflowX: 'auto'
                          }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#22c55e', marginBottom: '4px', textTransform: 'uppercase' }}>
                              + Sugerido (Corrigido)
                            </div>
                            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {item.suggestedText}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* CARD ACTIONS */}
                      <div style={{
                        padding: '10px 16px', background: '#0f172a', borderTop: '1px solid #334155',
                        display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center'
                      }}>
                        {isAccepted ? (
                          <span style={{ color: '#4ade80', fontSize: '0.85rem', fontWeight: 600 }}>
                            ✓ Correção Aplicada
                          </span>
                        ) : isRejected ? (
                          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                            ✕ Sugestão Recusada
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleRejectItem(item)}
                              style={{
                                background: '#334155', color: '#cbd5e1', border: '1px solid #475569',
                                borderRadius: '6px', padding: '6px 14px', fontSize: '0.82rem', cursor: 'pointer'
                              }}
                            >
                              ❌ Recusar
                            </button>
                            <button
                              onClick={() => handleAcceptItem(item)}
                              style={{
                                background: '#15803d', color: '#fff', border: 'none',
                                borderRadius: '6px', padding: '6px 16px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer'
                              }}
                            >
                              ✅ Aceitar Correção
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid #334155', background: 'rgba(15, 23, 42, 0.6)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            {acceptedCount > 0 ? `✨ ${acceptedCount} alteração(ões) aplicada(s) ao JSON final.` : 'Nenhuma alteração pendente.'}
          </div>

          <button
            onClick={() => {
              if (abortControllerRef.current) abortControllerRef.current.abort();
              onClose();
            }}
            style={{
              background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px',
              padding: '8px 20px', fontWeight: 600, cursor: 'pointer'
            }}
          >
            Concluir Auditoria
          </button>
        </div>
      </div>
    </div>
  );
};
