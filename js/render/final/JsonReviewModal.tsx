import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { renderLatexIn } from '../../libs/loader.js';
import { safe } from '../../normalize/primitives.js';
import { customAlert } from '../../ui/GlobalAlertsLogic';
// @ts-ignore - JS module
import { showConfirmModalWithCheckbox } from '../../ui/modal-confirm.js';
import { PainelGabarito, PainelQuestao } from './RenderComponents';
import { TextAuditModal } from './TextAuditModal';

// Declaração de tipos para globais e módulos legados
declare global {
  interface Window {
    __BACKUP_IMGS_G?: string[];
    __imagensLimpas?: {
      gabarito_original?: any[];
      questao_original?: any[];
      alternativas?: { questao?: Record<string, string[]> };
    };
    __BACKUP_IMGS_Q?: any[];
    __ultimaQuestaoExtraida: any;
    __ultimoGabaritoExtraido: any;
    __pdfOriginalUrl?: string | null;
  }
}

// Props que o componente receberá do adaptador JS
interface JsonReviewModalProps {
  q: any;
  g: any;
  tituloMaterial: string;
  imagensFinais: any; // Adicionado
  explicacaoArray: any[]; // Adicionado
  htmlQuestaoSide?: string; // Tornado opcional (deprecated)
  htmlGabaritoSide?: string; // Tornado opcional (deprecated)
  onClose: () => void;
  onConfirm: (payload: string) => void;
}

// --- FUNÇÕES DE LÓGICA (Portadas do JS original) ---

function resolverImagensPrioritarias(backupGlobal: string[] | undefined, originalLimpas: string[] | undefined): string[] {
  return backupGlobal && backupGlobal.length > 0 ? backupGlobal : originalLimpas || [];
}

function prepararObjetoGabarito(g: any) {
  const gabaritoLimpo = JSON.parse(JSON.stringify(g));
  delete gabaritoLimpo.alertas_credito;
  if (gabaritoLimpo.creditos) {
    delete gabaritoLimpo.creditos.como_identificou;
    delete gabaritoLimpo.creditos.precisa_credito_generico;
    delete gabaritoLimpo.creditos.texto_credito_sugerido;
  }

  const imgsReais = resolverImagensPrioritarias(
    window.__BACKUP_IMGS_G,
    window.__imagensLimpas?.gabarito_original
  );

  if (imgsReais.length > 0) {
    gabaritoLimpo.fotos_originais = imgsReais;
    delete gabaritoLimpo.foto_original;
  }
  return gabaritoLimpo;
}

function prepararObjetoQuestao(q: any) {
  const questaoFinal = JSON.parse(JSON.stringify(q));

  // Tenta pegar do novo sistema (PDF/Green Box)
  const questaoGlobal = window.__ultimaQuestaoExtraida;
  let imgsReais: any[] = [];

  if (questaoGlobal && Array.isArray(questaoGlobal.fotos_originais) && questaoGlobal.fotos_originais.length > 0) {
      imgsReais = questaoGlobal.fotos_originais;
  } else {
      // Fallback para sistema antigo
      imgsReais = resolverImagensPrioritarias(
        window.__BACKUP_IMGS_Q,
        window.__imagensLimpas?.questao_original
      );
  }

  if (imgsReais.length > 0) {
    questaoFinal.fotos_originais = imgsReais;
    delete questaoFinal.foto_original;
  }

  delete questaoFinal.identificacao;
  return questaoFinal;
}

function gerarJsonFinalLogic(q: any, g: any, tituloMaterial: string) {
  const gabaritoLimpo = prepararObjetoGabarito(g);
  const questaoFinal = prepararObjetoQuestao(q);

  const chaveProva = tituloMaterial || 'MATERIAL_SEM_TITULO';
  const chaveQuestao = q.identificacao || 'QUESTAO_SEM_ID';

  const payloadFinal = {
    [chaveProva]: {
      [chaveQuestao]: {
        meta: { 
          timestamp: new Date().toISOString(),
          source_url: window.__pdfOriginalUrl || undefined
        },
        dados_questao: questaoFinal,
        dados_gabarito: gabaritoLimpo,
      },
    },
  };

  return JSON.stringify(payloadFinal, null, 2);
}

// --- COMPONENTE REACT ---

const JsonReviewModal: React.FC<JsonReviewModalProps> = ({
  q,
  g,
  tituloMaterial,
  imagensFinais,
  explicacaoArray,
  htmlQuestaoSide,
  htmlGabaritoSide,
  onClose,
  onConfirm
}) => {
  const [currentQ, setCurrentQ] = useState<any>(q);
  const [currentG, setCurrentG] = useState<any>(g);

  // Atualiza estado local se as props mudarem
  useEffect(() => {
    setCurrentQ(q);
    setCurrentG(g);
  }, [q, g]);

  const [isCopying, setIsCopying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  // Calcula o JSON apenas quando currentQ, currentG ou tituloMaterial mudam
  const jsonString = useMemo(() => {
    return gerarJsonFinalLogic(currentQ, currentG, tituloMaterial);
  }, [currentQ, currentG, tituloMaterial]);

  // Renderiza LaTeX após montar o componente e quando os dados mudam
  useEffect(() => {
    const modalEl = document.getElementById('finalModalReactRoot');
    if (modalEl && typeof renderLatexIn === 'function') {
      // Pequeno delay para garantir que o React renderizou o DOM
      setTimeout(() => renderLatexIn(modalEl), 100);
    }
  }, [currentQ, currentG]);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonString);
    setIsCopying(true);
    setTimeout(() => setIsCopying(false), 1500);
  };

  const handleConfirm = async () => {
    if (!currentQ || !currentG) {
      customAlert('❌ Erro: Dados incompletos. Processe a questão e o gabarito.');
      return;
    }

    // Modal de confirmação com checkbox de responsabilidade legal
    const confirmed = await showConfirmModalWithCheckbox(
      '⚠️ Confirmar Envio',
      'Atenção: Esta ação é irreversível. Após o envio, os dados serão salvos permanentemente no banco de dados e não poderão ser alterados ou removidos.',
      'Declaro que possuo os direitos autorais ou autorização para compartilhar este conteúdo, e assumo total responsabilidade legal sobre o material enviado.',
      '🚀 Confirmar Envio',
      'Cancelar',
      true // isPositiveAction
    );

    if (!confirmed) {
      return; // Usuário cancelou ou não marcou o checkbox
    }

    setIsSending(true);
    onConfirm(jsonString);
  };

  return (
    <div
      className="final-modal-overlay visible"
      id="finalModalReactRoot"
      style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9999,
        background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(5px)', display: 'flex',
        justifyContent: 'center', alignItems: 'center'
      }}
    >
      <div
        className="final-modal-content"
        style={{
          background: 'var(--color-background)', border: '1px solid var(--color-border)',
          maxWidth: '1500px', width: '95%', height: '95vh', display: 'flex',
          flexDirection: 'column', boxShadow: '0 0 40px rgba(0,0,0,0.5)'
        }}
      >
        {/* HEADER */}
        <div style={{
          background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
          padding: '15px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <img src="logo.png" style={{ height: '32px' }} alt="Logo" />
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.2 }}>
                Revisão Final & Exportação
              </h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                Material base: <strong style={{ color: 'var(--color-primary)' }}>{safe(tituloMaterial)}</strong>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn btn--sm btn--outline"
              onClick={() => setIsAuditOpen(true)}
              title="Auditar erros de digitação e alucinações de IA"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', borderColor: '#3b82f6', color: '#60a5fa' }}
            >
              <span>🧹</span> Auditar Texto & Alucinações
            </button>
            <button className="btn btn--sm btn--outline js-ver-originais" title="Ver prints originais">
              👁️ Originais
            </button>
            <button
              className="btn btn--sm btn--secondary"
              onClick={onClose}
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              ✕ Voltar para Edição
            </button>
          </div>
        </div>

        {/* MODAL DE AUDITORIA DE TEXTO OPCIONAL */}
        {isAuditOpen && (
          <TextAuditModal
            q={currentQ}
            g={currentG}
            onClose={() => setIsAuditOpen(false)}
            onApplyFixes={(updatedQ, updatedG) => {
              setCurrentQ(updatedQ);
              setCurrentG(updatedG);
            }}
          />
        )}

        {/* BODY */}
        <div className="modal-body" style={{ background: 'var(--color-background)', padding: '25px', overflowY: 'auto', flex: 1 }}>
          <div className="review-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '30px', height: '100%' }}>
            {/* Coluna Questão */}
            <div
              className="review-col"
              style={{ background: 'var(--color-surface)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflowY: 'auto', maxHeight: '100%' }}
            >
                {/* Renderização Direta do Componente React (Alive) */}
                <PainelQuestao q={currentQ} tituloMaterial={tituloMaterial} imagensFinais={imagensFinais} />
            </div>
            
            {/* Coluna Gabarito */}
            <div
              className="review-col"
              style={{ background: 'var(--color-surface)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflowY: 'auto', maxHeight: '100%' }}
            >
                {/* Renderização Direta do Componente React (Alive) */}
                <PainelGabarito g={currentG} imagensFinais={imagensFinais} explicacaoArray={explicacaoArray} />
            </div>
          </div>

          {/* JSON Debug Area */}
          <div className="json-debug-area" style={{ marginTop: '30px', background: '#0f172a', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
            <details>
              <summary className="json-debug-header" style={{ cursor: 'pointer', padding: '10px', color: '#fff' }}>
                <span>📦 JSON Payload Final (Clique para expandir)</span>
              </summary>
              <div style={{ position: 'relative' }}>
                <button
                  className="btn btn--sm btn--primary"
                  style={{ position: 'absolute', top: '10px', right: '10px' }}
                  onClick={handleCopyJson}
                >
                  {isCopying ? 'Copiado!' : 'Copiar JSON'}
                </button>
                <pre
                  className="json-dump"
                  id="finalJsonOutput"
                  style={{ padding: '20px', margin: 0, maxHeight: '300px', overflow: 'auto', fontSize: '11px', lineHeight: 1.4, color: '#a5b4fc' }}
                >
                  {jsonString}
                </pre>
              </div>
            </details>
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', padding: '20px', display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
          <button className="btn btn--secondary" onClick={onClose}>Cancelar</button>
          <button
            id="btnConfirmarEnvioFinal"
            className="btn btn--primary"
            onClick={handleConfirm}
            disabled={isSending}
          >
            {isSending ? '⏳ Preparando JSON...' : '🚀 Confirmar e Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- FUNÇÃO EXPORTADA PARA O ADAPTADOR JS ---

export function mountJsonReviewModal(
  container: HTMLElement,
  data: {
    q: any,
    g: any,
    tituloMaterial: string,
    imagensFinais: any,
    explicacaoArray: any[],
    htmlQuestaoSide?: string, // Depreciado
    htmlGabaritoSide?: string, // Depreciado
    // Callback para disparar o evento original caso exista algum listener global
    onConfirmCallback?: () => void
  }
) {
  const root = createRoot(container);

  const handleClose = () => {
    // Timeout para garantir animação de saída se houver (opcional)
    root.unmount();
    container.remove();
  };

  const handleConfirm = async (payload: string) => {
    // Chama a função de envio para Firebase
    const { enviarDadosParaFirebase } = await import('../../firebase/envio.js');
    enviarDadosParaFirebase();
    
    // Callback opcional
    if (data.onConfirmCallback) data.onConfirmCallback();
  };

  root.render(
    <JsonReviewModal
      q={data.q}
      g={data.g}
      tituloMaterial={data.tituloMaterial}
      imagensFinais={data.imagensFinais}
      explicacaoArray={data.explicacaoArray}
      htmlQuestaoSide={data.htmlQuestaoSide}
      htmlGabaritoSide={data.htmlGabaritoSide}
      onClose={handleClose}
      onConfirm={handleConfirm}
    />
  );
}