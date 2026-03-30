import React from 'react';
import { criarHtmlBlocoEditor } from '../editor/structure-editor.js';
import { normalizeAlternativasAnalisadas } from '../normalize/alternativas.js';
import { normCreditos } from '../normalize/creditos.js';
import { normalizeExplicacao } from '../normalize/explicacao.js';
import { asStringArray, safe, safeMarkdown } from '../normalize/primitives.js';
import { pick } from '../utils/pick';
// @ts-ignore - Importação legado pode não ter tipos
import { MainStructure } from './StructureRender';

// --- Tipagens ---

interface GabaritoRaw {
  alternativa_correta?: any;
  resposta?: any;
  explicacao?: any;
  resolucao?: any;
  alternativas_analisadas?: any[];
  justificativa_curta?: any;
  justificativa?: any;
  possui_imagem?: any;
  possuiimagem?: any;
  confianca?: any;
  coerencia?: any;
  observacoes?: any;
  creditos?: any;
  alertas_credito?: any;
  analise_complexidade?: any;
  analiseComplexidade?: any;
  fontes_externas?: Array<{ uri: string; title: string }>; // New field
  texto_referencia?: string; // Relatório da pesquisa
  resposta_modelo?: string;
  respostaModelo?: string;
}

interface CreditosData {
  origemresolucao?: string;
  materialidentificado?: boolean;
  confiancaidentificacao?: number | null;
  material?: string;
  autorouinstituicao?: string;
  ano?: string;
  precisacreditogenerico?: boolean;
  comoidentificou?: string;
  textocreditosugerido?: string;
}

interface GabaritoData {
  respostaLetra: string;
  justificativaCurta: string;
  possuiImagem: boolean;
  confianca: number | null;
  coerencia: any;
  observacoes: string[];
  creditosRaw: any;
  creditos: CreditosData | null;
  alertasCredito: string[];
  explicacaoArray: any[];
  alternativasAnalisadas: any[];
  complexidadeRaw: any;
  externas: Array<{ uri: string; title: string }>; // Normalized field
  textoReferencia: string;
  respostaModelo: string;
  questao: any;
}

// --- Lógica de Negócio (Preparação) ---

export function prepararDadosGabarito(gabarito: GabaritoRaw, questao: any): GabaritoData {
  const respostaLetra = String(
    pick(gabarito.alternativa_correta, gabarito.resposta, '')
  )
    .trim()
    .toUpperCase();

  // Normalização da explicação usando helper global
  const explicacaoArray = normalizeExplicacao(
    pick(gabarito.explicacao, gabarito.resolucao, [])
  );

  // Normalização das alternativas analisadas
  const alternativasAnalisadas = normalizeAlternativasAnalisadas(
    pick(gabarito.alternativas_analisadas, []),
    respostaLetra
  );

  return {
    respostaLetra,
    justificativaCurta: pick(
      gabarito.justificativa_curta,
      gabarito.justificativa,
      ''
    ),
    possuiImagem: !!pick(gabarito.possui_imagem, gabarito.possuiimagem, false),
    confianca: pick(gabarito.confianca, null),
    coerencia: pick(gabarito.coerencia, {}),
    observacoes: asStringArray(pick(gabarito.observacoes, [])),
    creditosRaw: pick(gabarito.creditos, {}),
    creditos: normCreditos(pick(gabarito.creditos, {})),
    alertasCredito: asStringArray(pick(gabarito.alertas_credito, [])),
    explicacaoArray,
    alternativasAnalisadas,
    complexidadeRaw: pick(
      gabarito.analise_complexidade,
      gabarito.analiseComplexidade,
      null
    ),
    externas: (pick(gabarito.fontes_externas, []) as any[]),
    textoReferencia: (pick(gabarito.texto_referencia, '') as string),
    respostaModelo: (pick(gabarito.resposta_modelo, gabarito.respostaModelo, gabarito.resposta, '') as string),
    questao: questao,
  };
}

// --- Componentes Visuais (Renderização) ---

const RawHTML = ({ html, className = '', style = {} }: { html: string, className?: string, style?: React.CSSProperties }) => {
  if (!html) return null;
  return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
};

const SafeText = ({ text }: { text: any }) => <>{safe(text)}</>;

const SafeMarkdown = ({ text }: { text: any }) => {
  const html = safeMarkdown(text);
  const ref = useMathRender([html]);
  return <div ref={ref} className="markdown-content" dangerouslySetInnerHTML={{ __html: html }} />;
};

// Sub-componente: Meta Gabarito (Chips e Barra de Confiança) - com suporte a revisão
export const MetaGabarito: React.FC<{
  confianca: number | null;
  creditos: CreditosData | null;
  isReviewMode?: boolean;
  reviewState?: Record<string, 'approved' | 'rejected' | null>;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}> = ({ confianca, creditos, isReviewMode, reviewState, onApprove, onReject }) => {
  const clamp01 = (n: any) => Math.max(0, Math.min(1, Number(n)));
  const fmtPct = (n: any) => `${Math.round(clamp01(n) * 100)}%`;

  const hasConfianca = confianca !== null && confianca !== undefined && !Number.isNaN(Number(confianca));
  const hasOrigem = !!creditos?.origemresolucao;

  if (!hasConfianca && !hasOrigem) return null;

  const fill = hasConfianca ? fmtPct(confianca) : '0%';
  
  // IDs de revisão
  const origemFieldId = 'gabarito_origem';
  const origemState = reviewState?.[origemFieldId] || null;
  const origemStateClass = origemState === 'approved' ? 'block-approved' : origemState === 'rejected' ? 'block-rejected' : '';

  return (
    <div className="gabarito-meta">
      <div className="gabarito-meta__row" style={{ gap: '10px' }}>
        {hasConfianca && (
          <div className="gabarito-chip gabarito-chip--info">
            <span className="gabarito-chip__k">Confiança</span>
            <span className="gabarito-chip__v"><SafeText text={fmtPct(confianca)} /></span>
          </div>
        )}
        {hasOrigem && (
          isReviewMode && onApprove && onReject ? (
            <div className={`gabarito-chip gabarito-chip--muted reviewable-chip ${origemStateClass}`} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="gabarito-chip__k">Origem</span>
              <span className="gabarito-chip__v"><SafeText text={creditos?.origemresolucao} /></span>
              <div className="review-btn-group" style={{ marginLeft: '4px' }}>
                <button type="button" className={`review-btn review-btn--approve review-btn--xs ${origemState === 'approved' ? 'active' : ''}`} onClick={() => onApprove(origemFieldId)}>✓</button>
                <button type="button" className={`review-btn review-btn--reject review-btn--xs ${origemState === 'rejected' ? 'active' : ''}`} onClick={() => onReject(origemFieldId)}>✗</button>
              </div>
            </div>
          ) : (
            <div className="gabarito-chip gabarito-chip--muted">
              <span className="gabarito-chip__k">Origem</span>
              <span className="gabarito-chip__v"><SafeText text={creditos?.origemresolucao} /></span>
            </div>
          )
        )}
      </div>
      {hasConfianca && (
        <div className="gabarito-confbar" style={{ '--fill-width': safe(fill) } as React.CSSProperties}>
          <div className="gabarito-confbar__label">Confiança visual</div>
          <div className="gabarito-confbar__track">
            <div className="gabarito-confbar__fill"></div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-componente: Opções (Alternativas) - com suporte a revisão
export const OpcoesGabarito: React.FC<{
  questao: any;
  respostaLetra: string;
  alternativasAnalisadas: any[];
  isReviewMode?: boolean;
  reviewState?: Record<string, 'approved' | 'rejected' | null>;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}> = ({ questao, respostaLetra, alternativasAnalisadas, isReviewMode, reviewState, onApprove, onReject }) => {
  const alts = Array.isArray(questao?.alternativas) ? questao.alternativas : [];
  if (!alts.length) return null;

  const normLetra = (v: any) => String(v ?? '').trim().toUpperCase();
  const correta = normLetra(respostaLetra);

  return (
    <div className="answerOptions gabarito-options">
      {alts.map((alt: any, idx: number) => {
        const letra = normLetra(alt?.letra);
        const isCorrect = letra && correta && letra === correta;
        const analise = (alternativasAnalisadas || []).find((a) => normLetra(a?.letra) === letra);
        
        // IDs de revisão
        const altFieldId = `gabarito_alt_${letra}`;
        const motivoFieldId = `gabarito_alt_${letra}_motivo`;
        const altState = reviewState?.[altFieldId] || null;
        const motivoState = reviewState?.[motivoFieldId] || null;
        const altStateClass = altState === 'approved' ? 'block-approved' : altState === 'rejected' ? 'block-rejected' : '';
        const motivoStateClass = motivoState === 'approved' ? 'block-approved' : motivoState === 'rejected' ? 'block-rejected' : '';

        if (isReviewMode && onApprove && onReject) {
          return (
            <div key={idx} className="answerOption-wrapper" style={{ display: 'flex', alignItems: 'stretch', gap: '8px' }}>
              {/* Alternativa com layout original */}
              <div className={`answerOption ${isCorrect ? 'correct' : ''} ${altStateClass}`} style={{ flex: 1 }}>
                <span className="option-letter"><SafeText text={letra} /></span>
                <div className="option-text">
                  <SafeMarkdown text={alt?.texto} />
                  {/* Justificativa com wrapper e cabeçalho */}
                  {analise?.motivo && (
                    <div className={`reviewable-block ${motivoStateClass}`} style={{ marginTop: '10px', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="reviewable-block-header" style={{ display: 'flex', alignItems: 'center', marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px dashed rgba(255,255,255,0.1)' }}>
                        <span className="reviewable-block-tipo" style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>📝 Justificativa</span>
                        <div className="review-btn-group" style={{ marginLeft: 'auto' }}>
                          <button 
                            type="button" 
                            className={`review-btn review-btn--approve review-btn--xs ${motivoState === 'approved' ? 'active' : ''}`} 
                            onClick={() => onApprove(motivoFieldId)} 
                            title={`Aprovar justificativa`}
                          >✓</button>
                          <button 
                            type="button" 
                            className={`review-btn review-btn--reject review-btn--xs ${motivoState === 'rejected' ? 'active' : ''}`} 
                            onClick={() => onReject(motivoFieldId)} 
                            title={`Rejeitar justificativa`}
                          >✗</button>
                        </div>
                      </div>
                      <div className="option-reason-content">
                        <SafeMarkdown text={analise.motivo} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Botões de revisão da alternativa (classificação) no canto direito externo */}
              <div className="review-btn-group-vertical" style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', paddingTop: '8px' }}>
                <button 
                  type="button" 
                  className={`review-btn review-btn--approve review-btn--xs ${altState === 'approved' ? 'active' : ''}`} 
                  onClick={() => onApprove(altFieldId)} 
                  title={`Aprovar: classificação da alternativa ${letra}`}
                >✓</button>
                <button 
                  type="button" 
                  className={`review-btn review-btn--reject review-btn--xs ${altState === 'rejected' ? 'active' : ''}`} 
                  onClick={() => onReject(altFieldId)} 
                  title={`Rejeitar: classificação da alternativa ${letra}`}
                >✗</button>
              </div>
            </div>
          );
        }

        return (
          <div key={idx} className={`answerOption ${isCorrect ? 'correct' : ''}`}>
            <span className="option-letter"><SafeText text={letra} /></span>
            <div className="option-text">
              <SafeMarkdown text={alt?.texto} />
              {analise?.motivo && <div className="option-reason"><SafeMarkdown text={analise.motivo} /></div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Sub-componente: Passos Explicação - com suporte a revisão
export const PassosExplicacao: React.FC<{
  explicacaoArray: any[];
  isReviewMode?: boolean;
  reviewState?: Record<string, 'approved' | 'rejected' | null>;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}> = ({ explicacaoArray, isReviewMode, reviewState, onApprove, onReject }) => {
  if (!explicacaoArray.length) return null;

  return (
    <div className="passo gabarito-steps">
      <div className="passoText"><p><strong>Explicação (passo a passo)</strong></p></div>
      <div className="explicacao">
        <ol className="steps-list">
          {explicacaoArray.map((p, idx) => {
            // Lógica de side-effect window.__imagensLimpas mantida do original
            if (!(window as any).__imagensLimpas) (window as any).__imagensLimpas = {};
            if (!(window as any).__imagensLimpas.gabarito_passos) (window as any).__imagensLimpas.gabarito_passos = {};

            const imagensDestePasso = (window as any).__imagensLimpas.gabarito_passos[idx] || [];

            const origemRaw = String(p?.origem || '').toLowerCase().replace(/_/g, '');
            const isExtraido = origemRaw.includes('extraido');
            
            // IDs de revisão
            const passoFieldId = `gabarito_passo_${idx}`;
            const origemFieldId = `gabarito_passo_${idx}_origem`;
            const evidenciaFieldId = `gabarito_passo_${idx}_evidencia`;
            
            const passoState = reviewState?.[passoFieldId] || null;
            const origemState = reviewState?.[origemFieldId] || null;
            const evidenciaState = reviewState?.[evidenciaFieldId] || null;
            
            const passoStateClass = passoState === 'approved' ? 'block-approved' : passoState === 'rejected' ? 'block-rejected' : '';
            const origemStateClass = origemState === 'approved' ? 'block-approved' : origemState === 'rejected' ? 'block-rejected' : '';
            const evidenciaStateClass = evidenciaState === 'approved' ? 'block-approved' : evidenciaState === 'rejected' ? 'block-rejected' : '';

            if (isReviewMode && onApprove && onReject) {
              return (
                <li key={idx} className="step-card-wrapper" style={{ display: 'flex', alignItems: 'stretch', gap: '8px' }}>
                  {/* Step card com layout original */}
                  <div className={`step-card ${passoStateClass}`} style={{ flex: 1, display: 'flex' }}>
                    <div className="step-index">{idx + 1}</div>
                    <div className="step-body">
                      <div className="step-content">
                        {/* MainStructure com review mode para cada bloco */}
                        <MainStructure 
                            estrutura={p.estrutura}
                            imagensExternas={imagensDestePasso}
                            contexto={`gabarito_passo_${idx}`}
                            isReadOnly={false}
                            isReviewMode={true}
                            reviewState={reviewState}
                            onApprove={onApprove}
                            onReject={onReject}
                            blockPrefix={`gabarito_passo_${idx}_bloco`}
                        />
                      </div>
                      <div className="step-meta" style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed var(--color-border)', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {/* Origem - revisável */}
                        <div className={`step-chip-wrapper ${origemStateClass}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '6px' }}>
                          {isExtraido ? (
                            <span className="step-chip" style={{ background: 'var(--color-bg-2)', color: 'var(--color-success)', border: '1px solid var(--color-success)', fontWeight: 600 }}>📄 Extraído</span>
                          ) : (
                            <span className="step-chip" style={{ background: 'rgba(59, 130, 246, 0.08)', color: '#2563eb', border: '1px solid rgba(59, 130, 246, 0.3)', fontWeight: 600 }}>🤖 IA</span>
                          )}
                          <div className="review-btn-group">
                            <button type="button" className={`review-btn review-btn--approve review-btn--xs ${origemState === 'approved' ? 'active' : ''}`} onClick={() => onApprove(origemFieldId)} title="Aprovar origem">✓</button>
                            <button type="button" className={`review-btn review-btn--reject review-btn--xs ${origemState === 'rejected' ? 'active' : ''}`} onClick={() => onReject(origemFieldId)} title="Rejeitar origem">✗</button>
                          </div>
                        </div>

                        {p?.fontematerial && (
                          <span className="step-chip step-chip--muted" title={`Fonte/Material: ${safe(p.fontematerial)}`}>
                            📚 <SafeText text={p.fontematerial} />
                          </span>
                        )}
                        
                        {/* Evidência - revisável */}
                        {p?.evidencia && (
                          <div className={`step-chip-wrapper ${evidenciaStateClass}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '6px' }}>
                            <span className="step-chip step-chip--muted" title={`Evidência Visual: ${safe(p.evidencia)}`} style={{ borderStyle: 'dashed' }}>
                              👁️ <SafeText text={p.evidencia} />
                            </span>
                            <div className="review-btn-group">
                              <button type="button" className={`review-btn review-btn--approve review-btn--xs ${evidenciaState === 'approved' ? 'active' : ''}`} onClick={() => onApprove(evidenciaFieldId)} title="Aprovar evidência">✓</button>
                              <button type="button" className={`review-btn review-btn--reject review-btn--xs ${evidenciaState === 'rejected' ? 'active' : ''}`} onClick={() => onReject(evidenciaFieldId)} title="Rejeitar evidência">✗</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Botões de revisão do passo inteiro */}
                  <div className="review-btn-group-vertical" style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', paddingTop: '8px' }}>
                    <button type="button" className={`review-btn review-btn--approve review-btn--xs ${passoState === 'approved' ? 'active' : ''}`} onClick={() => onApprove(passoFieldId)} title={`Aprovar passo ${idx + 1}`}>✓</button>
                    <button type="button" className={`review-btn review-btn--reject review-btn--xs ${passoState === 'rejected' ? 'active' : ''}`} onClick={() => onReject(passoFieldId)} title={`Rejeitar passo ${idx + 1}`}>✗</button>
                  </div>
                </li>
              );
            }

            return (
              <li key={idx} className="step-card">
                <div className="step-index">{idx + 1}</div>
                <div className="step-body">
                  <div className="step-content">
                    <MainStructure 
                        estrutura={p.estrutura}
                        imagensExternas={imagensDestePasso}
                        contexto={`gabarito_passo_${idx}`}
                        isReadOnly={false} 
                    />
                  </div>
                  <div className="step-meta" style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed var(--color-border)', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {isExtraido ? (
                      <span className="step-chip" style={{ background: 'var(--color-bg-2)', color: 'var(--color-success)', border: '1px solid var(--color-success)', fontWeight: 600 }}>📄 Extraído</span>
                    ) : (
                      <span className="step-chip" style={{ background: 'rgba(59, 130, 246, 0.08)', color: '#2563eb', border: '1px solid rgba(59, 130, 246, 0.3)', fontWeight: 600 }}>🤖 IA</span>
                    )}

                    {p?.fontematerial && (
                      <span className="step-chip step-chip--muted" title={`Fonte/Material: ${safe(p.fontematerial)}`}>
                        📚 <SafeText text={p.fontematerial} />
                      </span>
                    )}
                    {p?.evidencia && (
                      <span className="step-chip step-chip--muted" title={`Evidência Visual: ${safe(p.evidencia)}`} style={{ borderStyle: 'dashed' }}>
                        👁️ <SafeText text={p.evidencia} />
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
};

// Sub-componente: Fontes de Pesquisa - com suporte a revisão
export const FontesPesquisa: React.FC<{
  fontes: Array<{ uri: string; title: string }>;
  isReviewMode?: boolean;
  reviewState?: Record<string, 'approved' | 'rejected' | null>;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}> = ({ fontes, isReviewMode, reviewState, onApprove, onReject }) => {
  if (!fontes || !fontes.length) return null;

  return (
    <div className="gabarito-sources" style={{ margin: '15px 0', padding: '12px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-bg-2)' }}>
      <p style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text)' }}>
        <span>📚</span> Referências Bibliográficas
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {fontes.map((fonte, idx) => {
          const fonteFieldId = `gabarito_fonte_${idx}`;
          const fonteState = reviewState?.[fonteFieldId] || null;
          const fonteStateClass = fonteState === 'approved' ? 'block-approved' : fonteState === 'rejected' ? 'block-rejected' : '';
          
          if (isReviewMode && onApprove && onReject) {
            return (
              <li key={idx} className={`fonte-wrapper ${fonteStateClass}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', borderRadius: '6px' }}>
                <a
                  href={fonte.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '12px', color: 'var(--color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}
                  title={fonte.title}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                    {fonte.title || fonte.uri}
                  </span>
                  <span style={{ fontSize: '10px', opacity: 0.7 }}>↗</span>
                </a>
                <div className="review-btn-group">
                  <button type="button" className={`review-btn review-btn--approve review-btn--xs ${fonteState === 'approved' ? 'active' : ''}`} onClick={() => onApprove(fonteFieldId)} title="Aprovar fonte">✓</button>
                  <button type="button" className={`review-btn review-btn--reject review-btn--xs ${fonteState === 'rejected' ? 'active' : ''}`} onClick={() => onReject(fonteFieldId)} title="Rejeitar fonte">✗</button>
                </div>
              </li>
            );
          }
          
          return (
            <li key={idx}>
              <a
                href={fonte.uri}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '12px', color: 'var(--color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                title={fonte.title}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                  {fonte.title || fonte.uri}
                </span>
                <span style={{ fontSize: '10px', opacity: 0.7 }}>↗</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

// Sub-componente: Detalhes Técnicos - com suporte a revisão
export const DetalhesTecnicos: React.FC<{
  dados: GabaritoData;
  isReviewMode?: boolean;
  reviewState?: Record<string, 'approved' | 'rejected' | null>;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}> = ({ dados, isReviewMode, reviewState, onApprove, onReject }) => {
  const { creditos, alertasCredito, observacoes, coerencia } = dados;
  if (!creditos && !alertasCredito.length && !observacoes.length && !coerencia) return null;

  // Helper para criar chip revisável
  const ReviewableChip = ({ fieldId, label, children }: { fieldId: string; label: string; children: React.ReactNode }) => {
    const state = reviewState?.[fieldId] || null;
    const stateClass = state === 'approved' ? 'block-approved' : state === 'rejected' ? 'block-rejected' : '';
    
    if (isReviewMode && onApprove && onReject) {
      return (
        <div className={`chip-wrapper ${stateClass}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '6px', padding: '2px' }}>
          {children}
          <div className="review-btn-group">
            <button type="button" className={`review-btn review-btn--approve review-btn--xs ${state === 'approved' ? 'active' : ''}`} onClick={() => onApprove(fieldId)} title={`Aprovar ${label}`}>✓</button>
            <button type="button" className={`review-btn review-btn--reject review-btn--xs ${state === 'rejected' ? 'active' : ''}`} onClick={() => onReject(fieldId)} title={`Rejeitar ${label}`}>✗</button>
          </div>
        </div>
      );
    }
    return <>{children}</>;
  };

  const Chip = ({ label, ok, okTxt = 'OK', badTxt = 'Atenção', fieldId }: any) => {
    const chip = (
      <div className={`coerencia-chip ${ok ? 'coerencia-chip--ok' : 'coerencia-chip--bad'}`}>
        <span className="coerencia-chip-k"><SafeText text={label} /></span>
        <span className="coerencia-chip-v"><SafeText text={ok ? okTxt : badTxt} /></span>
      </div>
    );
    
    if (fieldId) {
      return <ReviewableChip fieldId={fieldId} label={label}>{chip}</ReviewableChip>;
    }
    return chip;
  };

  const ChipKV = ({ k, v, cls = '', fieldId }: any) => {
    const chip = (
      <div className={`coerencia-chip ${cls}`}>
        <span className="coerencia-chip-k"><SafeText text={k} /></span>
        <span className="coerencia-chip-v"><SafeText text={v ?? '—'} /></span>
      </div>
    );
    
    if (fieldId) {
      return <ReviewableChip fieldId={fieldId} label={k}>{chip}</ReviewableChip>;
    }
    return chip;
  };

  const toPct = (n: any) => !Number.isNaN(Number(n)) ? `${Math.round(Math.max(0, Math.min(1, Number(n))) * 100)}%` : null;

  const coerenciaObs = Array.isArray(coerencia?.observacoes) ? coerencia.observacoes : [];
  
  const isDissertativa = dados.questao?.tipo_resposta === 'dissertativa' || (!dados.questao?.alternativas || dados.questao.alternativas.length === 0);

  // Filtra logs inúteis de questões dissertativas gerados pela lógica da IA ou backend
  const filteredCoerenciaObs = coerenciaObs.filter((o: string) => !o.toLowerCase().includes('questão dissertativa') && !o.toLowerCase().includes('alternativa correta está vazia') && !o.toLowerCase().includes('alternativa_correta está vazia'));
  const filteredObservacoes = observacoes.filter((o: string) => !o.toLowerCase().includes('questão dissertativa') && !o.toLowerCase().includes('alternativa correta está vazia') && !o.toLowerCase().includes('alternativa_correta está vazia'));

  return (
    <details className="gabarito-extra" open={isReviewMode}>
      <summary>Detalhes técnicos</summary>

      {/* Coerência */}
      {coerencia && (
        <div className="field-group">
          <span className="field-label">Coerência (checagens)</span>
          <div className="coerencia-grid">
            {!isDissertativa && <Chip fieldId="detalhes_coerencia_alt_correta" label="Alternativa correta existe" ok={!!(coerencia.alternativa_correta_existe ?? coerencia.alternativaCorretaExiste)} />}
            {!isDissertativa && <Chip fieldId="detalhes_coerencia_analise_todas" label="Análise para todas" ok={!!(coerencia.tem_analise_para_todas ?? coerencia.temAnaliseParaTodas)} />}
            <Chip fieldId="detalhes_coerencia_observacoes" label="Observações" ok={filteredCoerenciaObs.length === 0} okTxt="Nenhuma" badTxt="Há itens" />
          </div>
          {filteredCoerenciaObs.length ? (
            <div className="coerencia-obs">
              <div className="coerencia-obs-title">Observações</div>
              <ul>
                {filteredCoerenciaObs.map((o: string, i: number) => {
                  const obsFieldId = `detalhes_coerencia_obs_${i}`;
                  const obsState = reviewState?.[obsFieldId] || null;
                  const obsStateClass = obsState === 'approved' ? 'block-approved' : obsState === 'rejected' ? 'block-rejected' : '';
                  
                  if (isReviewMode && onApprove && onReject) {
                    return (
                      <li key={i} className={`obs-item ${obsStateClass}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', borderRadius: '4px' }}>
                        <span style={{ flex: 1 }}><SafeText text={o} /></span>
                        <div className="review-btn-group">
                          <button type="button" className={`review-btn review-btn--approve review-btn--xs ${obsState === 'approved' ? 'active' : ''}`} onClick={() => onApprove(obsFieldId)}>✓</button>
                          <button type="button" className={`review-btn review-btn--reject review-btn--xs ${obsState === 'rejected' ? 'active' : ''}`} onClick={() => onReject(obsFieldId)}>✗</button>
                        </div>
                      </li>
                    );
                  }
                  return <li key={i}><SafeText text={o} /></li>;
                })}
              </ul>
            </div>
          ) : (
            <div className="coerencia-obs coerencia-obs--empty">Sem observações.</div>
          )}
        </div>
      )}

      {/* Observações Gerais */}
      {filteredObservacoes.length > 0 && (
        <div className="field-group">
          <span className="field-label">Observações</span>
          <div className="data-box scrollable">
            <ul>
              {filteredObservacoes.map((o: string, i: number) => {
                const obsFieldId = `detalhes_obs_${i}`;
                const obsState = reviewState?.[obsFieldId] || null;
                const obsStateClass = obsState === 'approved' ? 'block-approved' : obsState === 'rejected' ? 'block-rejected' : '';
                
                if (isReviewMode && onApprove && onReject) {
                  return (
                    <li key={i} className={`obs-item ${obsStateClass}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', borderRadius: '4px' }}>
                      <span style={{ flex: 1 }}><SafeText text={o} /></span>
                      <div className="review-btn-group">
                        <button type="button" className={`review-btn review-btn--approve review-btn--xs ${obsState === 'approved' ? 'active' : ''}`} onClick={() => onApprove(obsFieldId)}>✓</button>
                        <button type="button" className={`review-btn review-btn--reject review-btn--xs ${obsState === 'rejected' ? 'active' : ''}`} onClick={() => onReject(obsFieldId)}>✗</button>
                      </div>
                    </li>
                  );
                }
                return <li key={i}><SafeText text={o} /></li>;
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Créditos */}
      {creditos && (
        <div className="field-group">
          <span className="field-label">Créditos / Fonte</span>
          <div className="coerencia-grid">
            <ChipKV fieldId="detalhes_creditos_origem" k="Origem" v={creditos.origemresolucao} />
            <ChipKV fieldId="detalhes_creditos_material_identificado" k="Material identificado" v={creditos.materialidentificado ? 'Sim' : 'Não'} cls={creditos.materialidentificado ? 'coerencia-chip--ok' : 'coerencia-chip--bad'} />
            {/* Confiança ident. SEM revisão */}
            {creditos.confiancaidentificacao != null && <ChipKV k="Confiança ident." v={toPct(creditos.confiancaidentificacao)} />}
            {creditos.material && <ChipKV fieldId="detalhes_creditos_material" k="Material" v={creditos.material} />}
            {creditos.autorouinstituicao && <ChipKV fieldId="detalhes_creditos_autor" k="Autor/Instituição" v={creditos.autorouinstituicao} />}
            {creditos.ano && <ChipKV fieldId="detalhes_creditos_ano" k="Ano" v={creditos.ano} />}
            <ChipKV fieldId="detalhes_creditos_generico" k="Precisa crédito genérico" v={creditos.precisacreditogenerico ? 'Sim' : 'Não'} cls={creditos.precisacreditogenerico ? 'coerencia-chip--bad' : 'coerencia-chip--ok'} />
          </div>
          
          {/* Evidência - revisável */}
          {(() => {
            const evidenciaFieldId = 'detalhes_creditos_evidencia';
            const evidenciaState = reviewState?.[evidenciaFieldId] || null;
            const evidenciaStateClass = evidenciaState === 'approved' ? 'block-approved' : evidenciaState === 'rejected' ? 'block-rejected' : '';
            
            if (creditos.comoidentificou) {
              if (isReviewMode && onApprove && onReject) {
                return (
                  <div className={`coerencia-obs ${evidenciaStateClass}`} style={{ padding: '8px', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                      <div className="coerencia-obs-title" style={{ flex: 1 }}>Evidência</div>
                      <div className="review-btn-group">
                        <button type="button" className={`review-btn review-btn--approve review-btn--xs ${evidenciaState === 'approved' ? 'active' : ''}`} onClick={() => onApprove(evidenciaFieldId)}>✓</button>
                        <button type="button" className={`review-btn review-btn--reject review-btn--xs ${evidenciaState === 'rejected' ? 'active' : ''}`} onClick={() => onReject(evidenciaFieldId)}>✗</button>
                      </div>
                    </div>
                    <div><SafeText text={creditos.comoidentificou} /></div>
                  </div>
                );
              }
              return (
                <div className="coerencia-obs">
                  <div className="coerencia-obs-title">Evidência</div>
                  <div><SafeText text={creditos.comoidentificou} /></div>
                </div>
              );
            }
            
            if (isReviewMode && onApprove && onReject) {
              return (
                <div className={`coerencia-obs coerencia-obs--empty ${evidenciaStateClass}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '6px' }}>
                  <span style={{ flex: 1 }}>Sem evidência registrada.</span>
                  <div className="review-btn-group">
                    <button type="button" className={`review-btn review-btn--approve review-btn--xs ${evidenciaState === 'approved' ? 'active' : ''}`} onClick={() => onApprove(evidenciaFieldId)}>✓</button>
                    <button type="button" className={`review-btn review-btn--reject review-btn--xs ${evidenciaState === 'rejected' ? 'active' : ''}`} onClick={() => onReject(evidenciaFieldId)}>✗</button>
                  </div>
                </div>
              );
            }
            return <div className="coerencia-obs coerencia-obs--empty">Sem evidência registrada.</div>;
          })()}
          
          {creditos.textocreditosugerido && (
            <div className="coerencia-obs" style={{ marginTop: '8px' }}>
              <div className="coerencia-obs-title">Crédito sugerido</div>
              <div><SafeText text={creditos.textocreditosugerido} /></div>
            </div>
          )}
        </div>
      )}

      {/* Alertas */}
      {alertasCredito.length > 0 && (
        <div className="field-group">
          <span className="field-label">Alertas de crédito</span>
          <div className="data-box scrollable">
            <ul>
              {alertasCredito.map((a, i) => {
                const alertaFieldId = `detalhes_alerta_${i}`;
                const alertaState = reviewState?.[alertaFieldId] || null;
                const alertaStateClass = alertaState === 'approved' ? 'block-approved' : alertaState === 'rejected' ? 'block-rejected' : '';
                
                if (isReviewMode && onApprove && onReject) {
                  return (
                    <li key={i} className={`obs-item ${alertaStateClass}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', borderRadius: '4px' }}>
                      <span style={{ flex: 1 }}><SafeText text={a} /></span>
                      <div className="review-btn-group">
                        <button type="button" className={`review-btn review-btn--approve review-btn--xs ${alertaState === 'approved' ? 'active' : ''}`} onClick={() => onApprove(alertaFieldId)}>✓</button>
                        <button type="button" className={`review-btn review-btn--reject review-btn--xs ${alertaState === 'rejected' ? 'active' : ''}`} onClick={() => onReject(alertaFieldId)}>✗</button>
                      </div>
                    </li>
                  );
                }
                return <li key={i}><SafeText text={a} /></li>;
              })}
            </ul>
          </div>
        </div>
      )}
    </details>
  );
};

// --- Componentes Principais (Views) ---

// Props de revisão para o gabarito
interface GabaritoReviewProps {
  isReviewMode?: boolean;
  reviewState?: Record<string, 'approved' | 'rejected' | null>;
  onApprove?: (fieldId: string) => void;
  onReject?: (fieldId: string) => void;
}

// Helper: Botões de revisão inline
const ReviewBtns: React.FC<{
  fieldId: string;
  state: 'approved' | 'rejected' | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}> = ({ fieldId, state, onApprove, onReject }) => (
  <div className="review-btn-group" style={{ marginLeft: 'auto', flexShrink: 0 }}>
    <button
      type="button"
      className={`review-btn review-btn--approve review-btn--xs ${state === 'approved' ? 'active' : ''}`}
      onClick={() => onApprove(fieldId)}
      title="Aprovar"
    >✓</button>
    <button
      type="button"
      className={`review-btn review-btn--reject review-btn--xs ${state === 'rejected' ? 'active' : ''}`}
      onClick={() => onReject(fieldId)}
      title="Rejeitar"
    >✗</button>
  </div>
);

// Helper: Wrapper de campo revisável
const ReviewableItem: React.FC<{
  fieldId: string;
  state: 'approved' | 'rejected' | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  label?: string;
  children: React.ReactNode;
  inline?: boolean;
}> = ({ fieldId, state, onApprove, onReject, label, children, inline }) => {
  const stateClass = state === 'approved' ? 'block-approved' : state === 'rejected' ? 'block-rejected' : '';
  
  if (inline) {
    return (
      <div className={`reviewable-item-inline ${stateClass}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', borderRadius: '6px', background: 'var(--color-background-json)' }}>
        {label && <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginRight: '4px' }}>{label}</span>}
        {children}
        <ReviewBtns fieldId={fieldId} state={state} onApprove={onApprove} onReject={onReject} />
      </div>
    );
  }
  
  return (
    <div className={`reviewable-block ${stateClass}`} style={{ margin: '8px 0', padding: '10px', borderRadius: '8px' }}>
      <div className="reviewable-block-header" style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
        {label && <span className="reviewable-block-tipo">{label}</span>}
        <ReviewBtns fieldId={fieldId} state={state} onApprove={onApprove} onReject={onReject} />
      </div>
      {children}
    </div>
  );
};

// Sub-componente: ComplexityCard com suporte a revisão
import { useMathRender } from '../libs/loader.js';
import { _calcularComplexidade } from './ComplexityCard';

const ComplexityCardReviewable: React.FC<{
  data: any;
  isReviewMode?: boolean;
  reviewState?: Record<string, 'approved' | 'rejected' | null>;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}> = ({ data, isReviewMode, reviewState, onApprove, onReject }) => {
  const calculations = _calcularComplexidade(data);
  if (!calculations) return null;

  const { pct, nivel, itensAtivos, grupos, CFG } = calculations;

  // Renderiza cada fator como um elemento revisável (todos os fatores, ativos e inativos)
  const renderGrupo = (catKey: string, catLabel: string) => {
    const itens = grupos[catKey as keyof typeof grupos];
    const cfg = CFG[catKey as keyof typeof CFG];
    
    return (
      <div style={{ marginBottom: 8 }} key={catKey}>
        <div style={{ fontSize: 10, fontWeight: 'bold', color: cfg.color, textTransform: 'uppercase', marginBottom: 4 }}>
          {cfg.label}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          {itens.map((i: any) => {
            const fieldId = `complexidade_fator_${i.key}`;
            const state = reviewState?.[fieldId] || null;
            const stateClass = state === 'approved' ? 'block-approved' : state === 'rejected' ? 'block-rejected' : '';
            
            // Em modo review, TODOS os fatores têm botões de revisão
            if (isReviewMode && onApprove && onReject) {
              return (
                <div
                  key={i.key}
                  className={`reviewable-factor ${stateClass}`}
                  style={{
                    fontSize: 11,
                    color: i.ativo ? 'var(--color-text)' : 'var(--color-text-secondary)',
                    opacity: i.ativo ? 1 : 0.7,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '4px 6px',
                    borderRadius: '4px',
                    background: 'var(--color-background-json)',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: i.ativo ? cfg.color : '#555',
                    }}
                  />
                  <span style={{ flex: 1 }}>{i.label}</span>
                  <div className="review-btn-group" style={{ flexShrink: 0 }}>
                    <button
                      type="button"
                      className={`review-btn review-btn--approve review-btn--xs ${state === 'approved' ? 'active' : ''}`}
                      onClick={() => onApprove(fieldId)}
                    >✓</button>
                    <button
                      type="button"
                      className={`review-btn review-btn--reject review-btn--xs ${state === 'rejected' ? 'active' : ''}`}
                      onClick={() => onReject(fieldId)}
                    >✗</button>
                  </div>
                </div>
              );
            }
            
            return (
              <div
                key={i.key}
                style={{
                  fontSize: 11,
                  color: i.ativo ? 'var(--color-text)' : 'var(--color-text-secondary)',
                  opacity: i.ativo ? 1 : 0.6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: i.ativo ? cfg.color : '#ddd',
                  }}
                />
                {i.label}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Nível de dificuldade revisável
  const nivelFieldId = 'complexidade_nivel';
  const nivelState = reviewState?.[nivelFieldId] || null;
  const nivelStateClass = nivelState === 'approved' ? 'block-approved' : nivelState === 'rejected' ? 'block-rejected' : '';

  // Justificativa revisável
  const justFieldId = 'complexidade_justificativa';
  const justState = reviewState?.[justFieldId] || null;
  const justStateClass = justState === 'approved' ? 'block-approved' : justState === 'rejected' ? 'block-rejected' : '';

  return (
    <div
      className="complexity-card"
      style={{
        marginTop: 15,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 15,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Nível de Dificuldade - Revisável */}
      {isReviewMode && onApprove && onReject ? (
        <div className={`reviewable-block ${nivelStateClass}`} style={{ padding: '10px', marginBottom: '10px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span className="reviewable-block-tipo">📊 Nível de Dificuldade</span>
            <ReviewBtns fieldId={nivelFieldId} state={nivelState} onApprove={onApprove} onReject={onReject} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
            <span className="field-label" style={{ fontSize: 11, opacity: 0.8 }}>
              NÍVEL DE DIFICULDADE
            </span>
            <span style={{ fontWeight: 900, fontSize: 14, color: nivel.cor }}>
              {nivel.texto} ({pct}%)
            </span>
          </div>
          {/* Barra de Progresso */}
          <div style={{ height: 8, width: '100%', background: 'var(--color-background-progress-bar)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: nivel.cor, borderRadius: 99, transition: 'width 1s ease' }} />
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
            <span className="field-label" style={{ fontSize: 11, opacity: 0.8 }}>NÍVEL DE DIFICULDADE</span>
            <span style={{ fontWeight: 900, fontSize: 14, color: nivel.cor }}>{nivel.texto} ({pct}%)</span>
          </div>
          <div style={{ height: 8, width: '100%', background: 'var(--color-background-progress-bar)', borderRadius: 99, overflow: 'hidden', marginBottom: 15 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: nivel.cor, borderRadius: 99, transition: 'width 1s ease' }} />
          </div>
        </>
      )}

      {/* Tags Ativas - SEM revisão (só exibição) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {itensAtivos.length === 0 ? (
          <span style={{ fontSize: 11, color: 'gray' }}>—</span>
        ) : (
          itensAtivos.map((item: any) => {
            const c = CFG[item.cat as keyof typeof CFG].color;
            
            return (
              <span
                key={item.key}
                style={{
                  fontSize: 10,
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontWeight: 700,
                  border: `1px solid ${c}`,
                  color: c,
                  background: 'var(--color-surface)',
                }}
              >
                {item.label}
              </span>
            );
          })
        )}
      </div>

      {/* Justificativa - Revisável */}
      {data.justificativa_dificuldade && (
        isReviewMode && onApprove && onReject ? (
          <div className={`reviewable-block ${justStateClass}`} style={{ padding: '10px', marginBottom: '10px', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
              <span className="reviewable-block-tipo">📝 Justificativa de Dificuldade</span>
              <ReviewBtns fieldId={justFieldId} state={justState} onApprove={onApprove} onReject={onReject} />
            </div>
            <div
              className="markdown-content"
              data-raw={data.justificativa_dificuldade}
              style={{
                fontSize: 12,
                color: 'var(--color-text-secondary)',
                fontStyle: 'italic',
                lineHeight: 1.4,
              }}
            >
              {data.justificativa_dificuldade}
            </div>
          </div>
        ) : (
          <div
            className="markdown-content"
            data-raw={data.justificativa_dificuldade}
            style={{
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              background: 'var(--color-bg-1)',
              padding: 10,
              borderRadius: 'var(--radius-base)',
              fontStyle: 'italic',
              lineHeight: 1.4,
              marginBottom: 10,
            }}
          >
            {data.justificativa_dificuldade}
          </div>
        )
      )}

      {/* Detalhes (Accordion) - SEMPRE aberto no modo review */}
      <details style={{ fontSize: 12, borderTop: '1px solid var(--color-border)', paddingTop: 8 }} open={isReviewMode}>
        <summary style={{ cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 600, fontSize: 11, outline: 'none' }}>
          VER ANÁLISE DETALHADA
        </summary>
        <div style={{ marginTop: 10, paddingLeft: 4 }}>
          {renderGrupo('leitura', 'Suporte e Leitura')}
          {renderGrupo('conhecimento', 'Conhecimento Prévio')}
          {renderGrupo('raciocinio', 'Raciocínio')}
          {renderGrupo('operacional', 'Operacional')}
        </div>
      </details>
    </div>
  );
};

export const GabaritoCardView: React.FC<{ dados: GabaritoData } & GabaritoReviewProps> = ({ dados, isReviewMode, reviewState, onApprove, onReject }) => {
  const {
    respostaLetra,
    justificativaCurta,
    complexidadeRaw,
    confianca,
    creditos,
    questao,
    alternativasAnalisadas,
    explicacaoArray,
  } = dados;

  // IDs dos campos revisáveis
  const altCorretaId = 'gabarito_alternativa_correta';
  const justificativaId = 'gabarito_justificativa';
  
  const altState = reviewState?.[altCorretaId] || null;
  const justState = reviewState?.[justificativaId] || null;

  const isDissertativa = questao?.tipo_resposta === 'dissertativa' || (!questao?.alternativas || questao.alternativas.length === 0);

  return (
    <>
      <div className="question gabarito-card">
        <div className="result-header">
          <h3>Gabarito</h3>
          <span className="badge-success">Ok</span>
        </div>

        <div className="questionText gabarito-head">
          {/* Alternativa Correta - Revisável (Somente para objetiva) */}
          {!isDissertativa && (
            isReviewMode && onApprove && onReject ? (
              <ReviewableItem
                fieldId={altCorretaId}
                state={altState}
                onApprove={onApprove}
                onReject={onReject}
                label="🅰️ Alternativa Correta"
              >
                <p style={{ margin: 0 }}><strong>Alternativa correta:</strong> <SafeText text={respostaLetra} /></p>
              </ReviewableItem>
            ) : (
              <p><strong>Alternativa correta:</strong> <SafeText text={respostaLetra} /></p>
            )
          )}
          
          {/* Resposta Esperada - Revisável (Somente para dissertativa) */}
          {isDissertativa && dados.respostaModelo && (
            isReviewMode && onApprove && onReject ? (
              <ReviewableItem
                fieldId="gabarito_resposta_modelo"
                state={reviewState?.['gabarito_resposta_modelo'] || null}
                onApprove={onApprove}
                onReject={onReject}
                label="📝 Resposta Esperada (Critério da IA)"
              >
                <div className="gabarito-just markdown-content"><SafeMarkdown text={dados.respostaModelo} /></div>
              </ReviewableItem>
            ) : (
              <div className="gabarito-just" style={{ marginBottom: '15px' }}>
                <strong>Resposta Esperada: </strong>
                <div className="markdown-content" style={{ display: 'inline' }}><SafeMarkdown text={dados.respostaModelo} /></div>
              </div>
            )
          )}
          
          {/* Justificativa - Revisável */}
          {justificativaCurta && (
            isReviewMode && onApprove && onReject ? (
              <ReviewableItem
                fieldId={justificativaId}
                state={justState}
                onApprove={onApprove}
                onReject={onReject}
                label="📝 Justificativa"
              >
                <div className="gabarito-just markdown-content"><SafeMarkdown text={justificativaCurta} /></div>
              </ReviewableItem>
            ) : (
              <div className="gabarito-just markdown-content"><SafeMarkdown text={justificativaCurta} /></div>
            )
          )}
        </div>

        {/* Complexidade - Componente revisável */}
        <ComplexityCardReviewable
          data={complexidadeRaw}
          isReviewMode={isReviewMode}
          reviewState={reviewState}
          onApprove={onApprove}
          onReject={onReject}
        />
        
        <MetaGabarito
          confianca={confianca}
          creditos={creditos}
          isReviewMode={isReviewMode}
          reviewState={reviewState}
          onApprove={onApprove}
          onReject={onReject}
        />
        {!isDissertativa && (
          <OpcoesGabarito
            questao={questao}
            respostaLetra={respostaLetra}
            alternativasAnalisadas={alternativasAnalisadas}
            isReviewMode={isReviewMode}
            reviewState={reviewState}
            onApprove={onApprove}
            onReject={onReject}
          />
        )}
      </div>

      <PassosExplicacao
        explicacaoArray={explicacaoArray}
        isReviewMode={isReviewMode}
        reviewState={reviewState}
        onApprove={onApprove}
        onReject={onReject}
      />
      <FontesPesquisa
        fontes={dados.externas}
        isReviewMode={isReviewMode}
        reviewState={reviewState}
        onApprove={onApprove}
        onReject={onReject}
      />
      
      {/* Relatório Técnico - revisável */}
      {(() => {
        const relatorioFieldId = 'gabarito_relatorio_tecnico';
        const relatorioState = reviewState?.[relatorioFieldId] || null;
        const relatorioStateClass = relatorioState === 'approved' ? 'block-approved' : relatorioState === 'rejected' ? 'block-rejected' : '';
        
        if (isReviewMode && onApprove && onReject) {
          return (
            <div className={`reviewable-block ${relatorioStateClass}`} style={{ margin: '15px 0', padding: '10px', borderRadius: '8px' }}>
              <div className="reviewable-block-header" style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                <span className="reviewable-block-tipo">📄 Relatório Técnico</span>
                <div className="review-btn-group" style={{ marginLeft: 'auto' }}>
                  <button type="button" className={`review-btn review-btn--approve review-btn--xs ${relatorioState === 'approved' ? 'active' : ''}`} onClick={() => onApprove(relatorioFieldId)} title="Aprovar relatório técnico">✓</button>
                  <button type="button" className={`review-btn review-btn--reject review-btn--xs ${relatorioState === 'rejected' ? 'active' : ''}`} onClick={() => onReject(relatorioFieldId)} title="Rejeitar relatório técnico">✗</button>
                </div>
              </div>
              <div
                className="markdown-content relatorio-content"
                data-raw={dados.textoReferencia || ''}
                style={{
                  marginTop: '10px',
                  overflowY: 'auto',
                  padding: '5px'
                }}
              >
                {dados.textoReferencia ? <SafeText text={dados.textoReferencia} /> : <em>Relatório de pesquisa não disponível.</em>}
              </div>
            </div>
          );
        }
        
        return (
          <details className="gabarito-extra" open={!dados.textoReferencia}>
            <summary>
              📄 Relatório Técnico
            </summary>
            <div
              className="markdown-content relatorio-content"
              data-raw={dados.textoReferencia || ''}
              style={{
                marginTop: '10px',
                overflowY: 'auto',
                padding: '5px'
              }}
            >
              {dados.textoReferencia ? <SafeText text={dados.textoReferencia} /> : <em>Relatório de pesquisa não disponível.</em>}
            </div>
          </details>
        );
      })()}

      <DetalhesTecnicos
        dados={dados}
        isReviewMode={isReviewMode}
        reviewState={reviewState}
        onApprove={onApprove}
        onReject={onReject}
      />
    </>
  );
};

export const AcoesGabaritoView: React.FC<{ onEdit: () => void, onFinish: () => void }> = ({ onEdit, onFinish }) => {
  return (
    <div className="result-actions" id="actionsLeituraGabarito" style={{ marginTop: '15px' }}>
      <button type="button" className="btn btn--secondary btn--full-width" id="btnEditarGabarito" onClick={onEdit}>
        Editar gabarito
      </button>
      <button type="button" className="btn btn--success btn--full-width" id="btnFinalizarTudo" onClick={onFinish} style={{ marginTop: '10px', fontWeight: 'bold', border: '1px solid rgba(0,0,0,0.1)' }}>
        ✨ Finalizar Questão
      </button>
    </div>
  );
};

// --- Componentes do Editor ---

const EditorPassos: React.FC<{ explicacaoArray: any[] }> = ({ explicacaoArray }) => {
  return (
    <div className="field-group">
      <span className="field-label">Explicação (passos)</span>
      <div id="editGabaritoPassos">
        {(explicacaoArray || []).map((p, idx) => {
          const blocosHtml = (p.estrutura || [])
            .map((b: any) => criarHtmlBlocoEditor(b.tipo, b.conteudo))
            .join('');

          const origemRaw = String(p.origem || '').toLowerCase().replace(/_/g, '');
          const isExtraido = origemRaw.includes('extraido');
          const isIA = !isExtraido;

          return (
            <div key={idx} className="step-edit-row" data-step-index={idx} style={{ border: '1px solid var(--color-border)', padding: '15px', borderRadius: '8px', marginBottom: '15px', background: 'var(--color-bg-1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                <strong style={{ color: 'var(--color-primary)' }}>Passo {idx + 1}</strong>
                <button type="button" className="btn btn--sm btn--outline btn-remove-step" style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)', fontSize: '11px' }}>✕ Remover Passo</button>
              </div>
              <div className="structure-editor-wrapper">
                <div className="structure-editor-container step-drag-container" style={{ minHeight: '50px', background: 'var(--color-background)' }}>
                  <RawHTML html={blocosHtml} />
                </div>
                <div className="structure-toolbar step-add-toolbar" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--color-border)', position: 'relative' }}>
                  <button type="button" className="btn btn--sm btn--secondary btn--full-width btn-toggle-step-add" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px', background: 'var(--color-bg-2)' }}>
                    <span>+ Adicionar Bloco de Conteúdo</span><span style={{ fontSize: '10px', opacity: 0.7 }}>▼</span>
                  </button>
                  <div className="step-menu-content hidden" style={{ position: 'absolute', top: '100%', left: 0, width: '100%', zIndex: 100, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '5px', padding: '10px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', marginTop: '5px' }}>
                    {['texto', 'imagem', 'equacao', 'lista', 'destaque', 'citacao', 'codigo', 'titulo', 'subtitulo', 'fonte', 'separador'].map(type => (
                      <button key={type} type="button" className="btn btn--sm btn--outline btn-add-step-item" data-type={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '15px', background: 'rgba(0,0,0,0.03)', padding: '10px', borderRadius: '6px' }}>
                <div style={{ flex: 1 }}>
                  <span className="field-label" style={{ fontSize: '10px', marginBottom: '2px', display: 'block', color: 'var(--color-text-secondary)' }}>Origem do Conteúdo</span>
                  <select className="form-control passo-origem" style={{ width: '100%' }} defaultValue={isExtraido ? "extraido_do_material" : "gerado_pela_ia"}>
                    <option value="extraido_do_material">📄 Extraído do Material</option>
                    <option value="gerado_pela_ia">🤖 Gerado pela IA</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <span className="field-label" style={{ fontSize: '10px', marginBottom: '2px', display: 'block', color: 'var(--color-text-secondary)' }}>Fonte / Material</span>
                  <input className="form-control passo-fonte" placeholder="Ex: Página 32..." defaultValue={safe(p.fontematerial || '')} style={{ width: '100%' }} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <span className="field-label" style={{ fontSize: '10px', marginBottom: '2px', display: 'block', color: 'var(--color-text-secondary)' }}>Evidência Visual (se houver)</span>
                  <input className="form-control passo-evidencia" placeholder="Ex: Gráfico azul, segundo parágrafo..." defaultValue={safe(p.evidencia || '')} style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="btn btn--secondary btn--full-width" id="btnAddPassoGabarito" style={{ marginTop: '6px' }}>
        + Adicionar Novo Passo
      </button>
    </div>
  );
};

const EditorComplexidade: React.FC<{ complexidadeRaw: any }> = ({ complexidadeRaw }) => {
  const cFatores = complexidadeRaw?.fatores || {};
  const chk = (key: string, label: string) => {
    const val = !!pick(cFatores[key], cFatores[key.replace(/_([a-z])/g, (_, x) => x.toUpperCase())], false);
    return (
      <label style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px', cursor: 'pointer' }}>
        <input type="checkbox" className="chk-complexidade" data-key={key} defaultChecked={val} />
        <span style={{ fontSize: '12px' }}>{label}</span>
      </label>
    );
  };

  return (
    <div className="field-group" style={{ border: '1px solid var(--color-border)', padding: '10px', borderRadius: '8px', background: 'rgba(0,0,0,0.02)' }}>
      <span className="field-label" style={{ color: 'var(--color-primary)', marginBottom: '8px', display: 'block' }}>Matriz de Complexidade</span>
      <div style={{ fontSize: '11px', color: 'gray', marginBottom: '10px' }}>Marque os fatores determinantes para a dificuldade.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        <div>
          <strong style={{ fontSize: '10px', textTransform: 'uppercase', color: 'gray', display: 'block', marginBottom: '4px' }}>Leitura</strong>
          {chk('texto_extenso', 'Texto Extenso')}
          {chk('vocabulario_complexo', 'Vocabulário Denso')}
          {chk('multiplas_fontes_leitura', 'Múltiplas Fontes')}
          {chk('interpretacao_visual', 'Interp. Visual')}

          <strong style={{ fontSize: '10px', textTransform: 'uppercase', color: 'gray', display: 'block', marginBottom: '4px', marginTop: '8px' }}>Conhecimento</strong>
          {chk('dependencia_conteudo_externo', 'Conteúdo Prévio')}
          {chk('interdisciplinaridade', 'Interdisciplinar')}
          {chk('contexto_abstrato', 'Contexto Abstrato')}
        </div>
        <div>
          <strong style={{ fontSize: '10px', textTransform: 'uppercase', color: 'gray', display: 'block', marginBottom: '4px' }}>Raciocínio</strong>
          {chk('raciocinio_contra_intuitivo', 'Contra-Intuitivo')}
          {chk('abstracao_teorica', 'Teoria Pura')}
          {chk('deducao_logica', 'Dedução Lógica')}

          <strong style={{ fontSize: '10px', textTransform: 'uppercase', color: 'gray', display: 'block', marginBottom: '4px', marginTop: '8px' }}>Operacional</strong>
          {chk('resolucao_multiplas_etapas', 'Multi-etapas')}
          {chk('transformacao_informacao', 'Transformação Info')}
          {chk('distratores_semanticos', 'Distratores Fortes')}
          {chk('analise_nuance_julgamento', 'Julgamento')}
        </div>
      </div>
      <div style={{ marginTop: '10px' }}>
        <span className="field-label">Justificativa da Dificuldade</span>
        <textarea id="editComplexidadeJust" className="form-control" rows={2} placeholder="Explique por que é difícil..." defaultValue={safe(complexidadeRaw?.justificativa_dificuldade || '')}></textarea>
      </div>
    </div>
  );
};

export const GabaritoEditorView: React.FC<{ dados: GabaritoData; onSave: () => void; onCancel: () => void }> = ({ dados, onSave, onCancel }) => {
  const {
    respostaLetra,
    justificativaCurta,
    confianca,
    explicacaoArray,
    questao,
    alternativasAnalisadas,
    coerencia,
    complexidadeRaw,
    creditos: creditosNull,
    alertasCredito,
    observacoes,
  } = dados;

  const creditos = creditosNull || {} as CreditosData;

  const isDissertativa = questao?.tipo_resposta === 'dissertativa' || (!questao?.alternativas || questao.alternativas.length === 0);

  return (
    <form id="gabaritoEdit">
      {!isDissertativa && (
        <div className="field-group">
          <span className="field-label">Alternativa correta</span>
          <input id="editGabaritoResposta" className="form-control" type="text" defaultValue={safe(respostaLetra)} placeholder="Ex.: A" />
        </div>
      )}
      {isDissertativa && (
        <div className="field-group">
          <span className="field-label">Resposta Esperada (Critério da IA)</span>
          <textarea id="editGabaritoRespostaModelo" className="form-control" rows={4} placeholder="Digite a resposta ou critério principal esperado..." defaultValue={safe(dados.respostaModelo)}></textarea>
        </div>
      )}
      <div className="field-group">
        <span className="field-label">Justificativa curta</span>
        <textarea id="editGabaritoJust" className="form-control" rows={3} placeholder="1–2 frases" defaultValue={safe(justificativaCurta || '')}></textarea>
      </div>
      <div className="field-group">
        <span className="field-label">Confiança (0–1)</span>
        <input id="editGabaritoConfianca" className="form-control" type="number" min={0} max={1} step={0.01} defaultValue={confianca ?? ''} placeholder="0.85" />
      </div>

      {/* Editor Passos */}
      <EditorPassos explicacaoArray={explicacaoArray} />

      {/* Editor Análise Alternativas */}
      {!isDissertativa && (
        <div className="field-group">
          <span className="field-label">Análise por alternativa</span>
          <div id="editGabaritoAnalises" className="alts-list">
            {(Array.isArray(questao?.alternativas) ? questao.alternativas : []).map((alt: any, i: number) => {
              const letra = String(alt?.letra || '').trim().toUpperCase();
              const analise = (alternativasAnalisadas || []).find((a) => String(a?.letra || '').trim().toUpperCase() === letra);
              return (
                <div key={i} className="alt-row alt-edit-row" style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <input className="form-control" style={{ width: '60px', textAlign: 'center' }} value={safe(letra)} disabled />
                  <textarea className="form-control gabarito-motivo" data-letra={safe(letra)} rows={2} placeholder="Motivo (correta/errada)" defaultValue={safe(analise?.motivo || '')}></textarea>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Editor Coerência */}
      <div className="field-group">
        <span className="field-label">Coerência (checagens internas)</span>
        {!isDissertativa && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input id="editCoerenciaAltExiste" type="checkbox" defaultChecked={!!(coerencia?.alternativa_correta_existe ?? coerencia?.alternativaCorretaExiste)} />
              <span style={{ fontSize: '12px' }}>Alternativa correta existe</span>
            </label>
            <label style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input id="editCoerenciaTodasAnalise" type="checkbox" defaultChecked={!!(coerencia?.tem_analise_para_todas ?? coerencia?.temAnaliseParaTodas)} />
              <span style={{ fontSize: '12px' }}>Tem análise para todas</span>
            </label>
          </div>
        )}
        <textarea id="editCoerenciaObs" className="form-control" rows={3} placeholder="Observações de consistência" defaultValue={safe((Array.isArray(coerencia?.observacoes) ? coerencia.observacoes : []).join('\n'))}></textarea>
      </div>

      {/* Editor Complexidade */}
      <EditorComplexidade complexidadeRaw={complexidadeRaw} />

      {/* Editor Créditos */}
      <div className="field-group">
        <span className="field-label">Créditos / Fonte</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <span className="field-label">Origem da resolução</span>
            <input id="editCredOrigem" className="form-control" type="text" defaultValue={safe(creditos.origemresolucao || '')} placeholder="extraidodomaterial / geradopelaia" />
          </div>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <span className="field-label">Material</span>
            <input id="editCredMaterial" className="form-control" type="text" defaultValue={safe(creditos.material || '')} placeholder="Ex.: FUVEST 2023" />
          </div>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <span className="field-label">Autor/Instituição</span>
            <input id="editCredAutor" className="form-control" type="text" defaultValue={safe(creditos.autorouinstituicao || '')} placeholder="Banca, escola, editora..." />
          </div>
          <div style={{ flex: '0 0 100px' }}>
            <span className="field-label">Ano</span>
            <input id="editCredAno" className="form-control" type="text" defaultValue={safe(creditos.ano || '')} placeholder="2024" />
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
          <div style={{ flex: '0 0 140px' }}>
            <span className="field-label">Mat. identificado?</span>
            <label style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
              <input id="editCredMatIdentificado" type="checkbox" defaultChecked={creditos.materialidentificado} />
              <span style={{ fontSize: '12px' }}>Sim</span>
            </label>
          </div>
          <div style={{ flex: '0 0 170px' }}>
            <span className="field-label">Precisa crédito genérico?</span>
            <label style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
              <input id="editCredPrecisaGenerico" type="checkbox" defaultChecked={creditos.precisacreditogenerico} />
              <span style={{ fontSize: '12px' }}>Sim</span>
            </label>
          </div>
          <div style={{ flex: 1, minWidth: '160px' }}>
            <span className="field-label">Confiança identificação (0–1)</span>
            <input id="editCredConfId" className="form-control" type="number" min={0} max={1} step={0.01} defaultValue={creditos.confiancaidentificacao ?? ''} />
          </div>
        </div>
        <div style={{ marginTop: '8px' }}>
          <span className="field-label">Como identificou</span>
          <textarea id="editCredComo" className="form-control" rows={2} placeholder="Cabeçalho, rodapé, diagramação..." defaultValue={safe(creditos.comoidentificou || '')}></textarea>
        </div>
        <div style={{ marginTop: '8px' }}>
          <span className="field-label">Crédito sugerido (texto)</span>
          <textarea id="editCredTextoSugerido" className="form-control" rows={2} placeholder="Texto pronto para mostrar como crédito." defaultValue={safe(creditos.textocreditosugerido || '')}></textarea>
        </div>
      </div>

      {/* Alertas e Observações Finais */}
      <div className="field-group">
        <span className="field-label">Alertas de crédito (1 por linha)</span>
        <textarea id="editGabaritoAlertas" className="form-control" rows={3} defaultValue={safe(alertasCredito.join('\n'))}></textarea>
      </div>
      <div className="field-group">
        <span className="field-label">Observações gerais (1 por linha)</span>
        <textarea id="editGabaritoObs" className="form-control" rows={3} defaultValue={safe(observacoes.join('\n'))}></textarea>
      </div>

      <button type="button" className="btn btn--primary btn--full-width" id="btnSalvarEdicaoGabarito" style={{ marginTop: '12px' }} onClick={onSave}>Salvar alterações (gabarito)</button>
      <button type="button" className="btn btn--secondary btn--full-width" id="btnCancelarEdicaoGabarito" style={{ marginTop: '8px' }} onClick={onCancel}>Cancelar</button>
    </form>
  );
};