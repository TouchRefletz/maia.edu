import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { processarSalvamentoGabarito } from '../editor/gabarito-save.js';

// Componente de revisão
import { ReviewableTags, ReviewButtons } from './ReviewButtons';

// Importações originais mantidas para garantir a mesma lógica de negócio e templates
import { configurarEventosAlternativa, configurarEventosNovaAlternativa, gerarHtmlTemplateAlternativa } from '../editor/alternativas.js';
import { initBotaoAdicionarPasso, setupImageToggle } from '../editor/passos.js';
import { processarSalvamentoQuestao } from '../editor/questao-save.js';
import { initStepEditors } from '../editor/steps-ui.js';
import { configurarDelecao, configurarDragAndDrop, criarHtmlBlocoEditor, iniciarEditorEstrutura } from '../editor/structure-editor.js';
import { renderLatexIn } from '../libs/loader';
import { joinLines } from '../normalize/primitives.js';
// ... (imports)
import { validarProgressoImagens } from '../validation/metricas-imagens.js';
import { Alternativas } from './AlternativasRender';
import { renderizarTelaFinal } from './final/json-e-modal.js';
import { renderTags } from './final/render-components.js';
import { AcoesGabaritoView, GabaritoCardView, GabaritoEditorView, prepararDadosGabarito } from './GabaritoCard.js';
import { MobileInteractableHeader } from './MobileLayout';
import { MainStructure } from './StructureRender';
import { checkAnswerWithEmbeddings, checkAnswerWithAI } from '../services/answer-checker.js';

// Interfaces básicas para Tipagem (adaptar conforme seus objetos reais)
interface Bloco {
  tipo: string;
  conteudo: string;
}

interface Alternativa {
  letra: string;
  texto?: string;
  estrutura?: Bloco[];
}

interface QuestaoData {
  identificacao: string;
  estrutura: Bloco[];
  materias_possiveis: string[];
  palavras_chave: string[];
  alternativas: Alternativa[];
  tipo_resposta?: 'objetiva' | 'dissertativa';
  isRecitation?: boolean;
}

interface Props {
  questao: QuestaoData;
  gabarito: any; // Tipo do gabarito
  containerRef: HTMLElement; // Referência do container pai para LaTeX
  isReadOnly?: boolean; // Modo somente leitura (desativa edição de imagens)
  isReviewMode?: boolean; // Modo de revisão (adiciona botões ✅❌)
  onReviewSubmit?: (reviewState: Record<string, 'approved' | 'rejected'>) => void;
  onReviewChange?: (hasChanges: boolean) => void;
  aiThoughtsHtml?: string | null; // [NOVO] HTML pré-renderizado dos pensamentos
}

const QuestaoTabs: React.FC<Props> = ({ questao, gabarito, containerRef, isReadOnly = false, isReviewMode = false, onReviewSubmit, onReviewChange, aiThoughtsHtml }) => {
  // Estado para controlar as abas
  const [activeTab, setActiveTab] = useState<'questao' | 'gabarito'>('questao');

  // Estado para controlar modo de edição da questão
  const [isEditing, setIsEditing] = useState(!!questao.isRecitation && !isReviewMode);

  // Estado para controlar modo de edição do gabarito
  const [isGabaritoEditing, setIsGabaritoEditing] = useState(false);

  // Estado para revisões (modo review)
  const [reviewState, setReviewState] = useState<Record<string, 'approved' | 'rejected' | null>>({});
  
  // Total de campos revisáveis (contados do DOM)
  const [totalReviewFields, setTotalReviewFields] = useState(0);

  // Referência para verificar se é a primeira renderização
  const isFirstRender = useRef(true);
  
  // Referência para o container do componente
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // Estado para dissertativa (resposta do aluno)
  const [userAnswer, setUserAnswer] = useState('');
  const [answerResult, setAnswerResult] = useState<any>(null);
  const [isCheckingAnswer, setIsCheckingAnswer] = useState(false);
  const [isAIChecking, setIsAIChecking] = useState(false);

  // Estado para dissertativa (modo UI teste/dissertativa)
  const isQuestaoDefaultDissertativa = questao.tipo_resposta === 'dissertativa' || (!questao.alternativas || questao.alternativas.length === 0);
  const [tipoRespostaMenu, setTipoRespostaMenu] = useState<'objetiva' | 'dissertativa'>(isQuestaoDefaultDissertativa ? 'dissertativa' : 'objetiva');
  
  // Detecta se é dissertativa (depende se está no modo revisão/leitura ou edição)
  const isDissertativa = isEditing ? tipoRespostaMenu === 'dissertativa' : isQuestaoDefaultDissertativa;


  // Handler: Check answer via embeddings (default)
  const handleCheckEmbeddings = async () => {
    if (!userAnswer.trim()) return;
    setIsCheckingAnswer(true);
    setAnswerResult(null);
    try {
      const expectedAnswer = gabarito?.resposta_modelo || gabarito?.dados_gabarito?.resposta_modelo || '';
      const result = await checkAnswerWithEmbeddings(
        userAnswer,
        expectedAnswer,
        { dados_questao: questao },
        (window as any).__API_KEY,
      );
      setAnswerResult(result);
    } catch (e) {
      console.error('[Dissertativa] Check error:', e);
      setAnswerResult({ score: 0, feedback: 'Erro ao verificar resposta.', method: 'error' });
    }
    setIsCheckingAnswer(false);
  };

  // Handler: Check answer via AI (optional)
  const handleCheckAI = async () => {
    if (!userAnswer.trim()) return;
    setIsAIChecking(true);
    setAnswerResult(null);
    try {
      const fullJson = { dados_questao: questao, dados_gabarito: gabarito };
      const result = await checkAnswerWithAI(userAnswer, fullJson, (window as any).__API_KEY);
      setAnswerResult(result);
    } catch (e) {
      console.error('[Dissertativa] AI check error:', e);
      setAnswerResult({ score: 0, feedback_geral: 'Erro na correção com IA.', method: 'error' });
    }
    setIsAIChecking(false);
  };

  // Handlers para revisão
  const handleApprove = (fieldId: string) => {
    setReviewState(prev => ({ ...prev, [fieldId]: prev[fieldId] === 'approved' ? null : 'approved' }));
  };

  const handleReject = (fieldId: string) => {
    setReviewState(prev => ({ ...prev, [fieldId]: prev[fieldId] === 'rejected' ? null : 'rejected' }));
  };
  
  // Efeito para contar o total de campos revisáveis no DOM
  useEffect(() => {
    if (!isReviewMode) return;
    
    // Esperar o DOM renderizar completamente
    const countReviewFields = () => {
      const container = tabsContainerRef.current;
      if (container) {
        const reviewGroups = container.querySelectorAll('.review-btn-group, .review-btn-group-vertical');
        setTotalReviewFields(reviewGroups.length);
      }
    };
    
    // Pequeno delay para garantir que o DOM está completo
    const timer = setTimeout(countReviewFields, 100);
    return () => clearTimeout(timer);
  }, [isReviewMode, activeTab, gabarito, questao]);

  // --- EFEITO: Notificar mudanças no reviewState para o pai (Controle de Unsaved Changes) ---
  useEffect(() => {
    if (onReviewChange) {
      // Verifica se há alguma chave com valor !== null
      const hasChanges = Object.values(reviewState).some(v => v !== null);
      onReviewChange(hasChanges);
    }
  }, [reviewState, onReviewChange]);

  // --- EFEITO: Renderizar LaTeX ao mudar abas ou modo ---
  useEffect(() => {
    setTimeout(() => {
      if (typeof renderLatexIn === 'function' && containerRef) {
        renderLatexIn(containerRef);
      }
    }, 50); // Pequeno delay igual ao original
  }, [activeTab, isEditing, isGabaritoEditing, containerRef, questao, gabarito]);

  // --- EFEITO: Inicializar Scripts Legados do Editor (Drag & Drop, etc) ---
  useLayoutEffect(() => {
    if (activeTab === 'questao' && isEditing) {
      // Inicializa o editor de estrutura principal
      iniciarEditorEstrutura();

      // Configura eventos dos botões de alternativas
      configurarBotoesAlternativasLegado();
    }
  }, [activeTab, isEditing]);

  // --- EFEITO: Auto-Resize para Textarea (Robustez) ---
  useEffect(() => {
    if (isEditing) {
      const resizeAll = () => {
        document.querySelectorAll('textarea.form-control').forEach((el: any) => {
          el.style.height = 'auto';
          el.style.height = el.scrollHeight + 'px';
          // Adiciona listener se ainda não tiver
          if (!el._autoResizeAttached) {
            el.addEventListener('input', (e: Event) => {
              const target = e.currentTarget as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = target.scrollHeight + 'px';
            });
            el._autoResizeAttached = true;
          }
        });
      };

      // Roda imediatamente 
      resizeAll();

      // E roda a cada 500ms para pegar novos elementos adicionados dinamicamente (fallback simples)
      const interval = setInterval(resizeAll, 1000);
      return () => clearInterval(interval);
    }
  }, [activeTab, isEditing, questao.estrutura]); // Re-roda se a estrutura mudar

  // --- EFEITO: Inicializar Scripts Legados do Gabarito ---
  useLayoutEffect(() => {
    if (activeTab === 'gabarito' && gabarito && isGabaritoEditing) {
      // Inicializa botões de passos e editores de passos
      initBotaoAdicionarPasso(containerRef);
      initStepEditors(containerRef);

      // Configura toggle de imagem (com delay original)
      setTimeout(() => {
        setupImageToggle(
          'editGabaritoPossuiImagem',
          'containerGaleriaGabarito',
          (window as any).__ultimoGabaritoExtraido
        );
      }, 0);
    }
  }, [activeTab, gabarito, containerRef, isGabaritoEditing]);


  // --- HELPERS (Lógica Original) ---

  const handleFinalizarTudo = async () => {
    const tudoCerto = await validarProgressoImagens('tudo');
    if (tudoCerto) {
      renderizarTelaFinal();
    }
  };

  const configurarBotoesAlternativasLegado = () => {
    // Reutiliza a lógica de eventos para botões dentro das alternativas
    const container = document.getElementById('edit_alts');
    if (!container) return;

    container.querySelectorAll('.alt-edit-row').forEach((row: any) => {
      const drag = row.querySelector('.alt-drag-container');
      if (!drag) return;

      // INICIALIZA OS EVENTOS DO EDITOR NA ALTERNATIVA (Delete + Drag)
      configurarDelecao(drag);
      configurarDragAndDrop(drag);

      // DELEGA TUDO PARA A FUNÇÃO COMPLETA DE ALTERNATIVAS (Incluindo Dropdown)
      configurarEventosAlternativa(row);
    });
  };

  const handleAdicionarAlternativa = () => {
    const containerAlts = document.getElementById('edit_alts');
    if (containerAlts) {
      // Lógica original portada
      const novaLinha = document.createElement('div');
      novaLinha.className = 'alt-row alt-edit-row';
      novaLinha.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-bottom:10px;';
      const blocoTextoInicial = criarHtmlBlocoEditor('texto', '');
      novaLinha.innerHTML = gerarHtmlTemplateAlternativa(blocoTextoInicial);
      configurarEventosNovaAlternativa(novaLinha);
      containerAlts.appendChild(novaLinha);
    }
  };

  const handleSalvarEdicao = () => {
    // Chama a função legada passando o formulário como container
    const form = document.getElementById('questaoEdit');
    if (form) {
      processarSalvamentoQuestao(form);
      setIsEditing(false);
    }
  };

  const handleConfirmarQuestao = async () => {
    // Valida imagens antes de confirmar
    const ok = await validarProgressoImagens('questao');
    if (!ok) return;
    
    // Questão confirmada - agora o usuário pode editar ou finalizar
    setActiveTab('gabarito');
  };

  // --- RENDERIZAÇÃO: Preparação de HTML Strings (Mantendo lógica original) ---

  // HTML Visual da Questão
  const imagensLocaisQuestao = (window as any).__imagensLimpas?.questao_original || [];

  // HTML Editor da Questão (Blocos)
  const estruturaAtual = questao.estrutura || [];
  const blocosHtml = estruturaAtual
    .map((bloco) => criarHtmlBlocoEditor(bloco.tipo, bloco.conteudo))
    .join('');

  // Preparação de dados do gabarito
  const dadosGabarito = gabarito ? prepararDadosGabarito(gabarito, questao) : null;

  const handleSalvarGabarito = () => {
    // Passamos o formulário (ou o container geral) para a função de salvamento
    const container = document.getElementById('gabaritoEdit');
    if (container) {
      processarSalvamentoGabarito(container.parentElement, questao);
      setIsGabaritoEditing(false); // Sai do modo de edição após salvar
    }
  };

  const handleCancelarGabarito = () => {
    setIsGabaritoEditing(false);
  };

  return (
    <div className="questao-tabs-react-root" ref={tabsContainerRef}>

      {/* HEADER MOBILE (Drag Handle) - Só aparece via CSS no mobile */}
      {/* Em modo review, o container pai já possui seu próprio header móvel */}
      {!isReviewMode && <MobileInteractableHeader />}

      {/* [NOVO] Raciocínio da IA (Se disponível e não estiver em modo Review) */}
      {aiThoughtsHtml && !isReviewMode && (
        <details className="ai-thoughts-reveal" style={{ marginBottom: '15px', border: '1px solid var(--color-border)', borderRadius: '6px', backgroundColor: 'var(--color-surface)' }}>
          <summary style={{ padding: '10px', cursor: 'pointer', fontWeight: '500', color: 'var(--color-text-secondary)', userSelect: 'none' }}>
            🧠 Mostrar Raciocínio da IA
          </summary>
          <div 
            className="ai-thoughts-content-injected maia-thoughts"
            style={{ padding: '0 15px 15px 15px', maxHeight: '400px', overflowY: 'auto' }}
            dangerouslySetInnerHTML={{ __html: aiThoughtsHtml }} 
          />
        </details>
      )}

      {/* TABS HEADER */}
      {/* ... (Header mantido igual, não precisa alterar aqui, apenas no final) ... */}
      <div className="tabs-header" style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '15px' }}>
        <button
          className={`tab-btn ${activeTab === 'questao' ? 'active' : ''}`}
          style={{
            flex: 1,
            padding: '10px',
            background: activeTab === 'questao' ? 'var(--color-background-hover)' : 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'questao' ? '600' : '400',
            borderBottom: activeTab === 'questao' ? '2px solid var(--color-primary)' : 'transparent',
            color: activeTab === 'questao' ? 'var(--color-primary)' : 'var(--color-text)'
          }}
          onClick={() => setActiveTab('questao')}
        >
          Questão
        </button>
        <button
          className={`tab-btn ${activeTab === 'gabarito' ? 'active' : ''}`}
          style={{
            flex: 1,
            padding: '10px',
            background: activeTab === 'gabarito' ? 'var(--color-background-hover)' : 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontWeight: activeTab === 'gabarito' ? '600' : '400',
            borderBottom: activeTab === 'gabarito' ? '2px solid var(--color-primary)' : 'transparent',
            color: activeTab === 'gabarito' ? 'var(--color-primary)' : 'var(--color-text)',
            opacity: (dadosGabarito || activeTab === 'gabarito') ? 1 : 0.6
          }}
          onClick={async () => {
            if (activeTab === 'gabarito') return;
            const ok = await validarProgressoImagens('questao');
            if (ok) setActiveTab('gabarito');
          }}
        >
          Gabarito
        </button>
      </div>

      {/* 2. Conteúdo da Aba Questão */}
      <div id="tabContentQuestao" style={{ display: activeTab === 'questao' ? 'block' : 'none' }}>
        <div className="result-header">
          {/* ... (Header Conteúdo Questão) ... */}
          <h3>Questão Extraída</h3>
          {questao.isRecitation ? (
            <span className="badge-warning" style={{ backgroundColor: '#ff9800', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
              Recitation / Manual
            </span>
          ) : (
            <span className="badge-success">Sucesso</span>
          )}
        </div>

        {/* ... (Resto do conteúdo da Questão - abreviado para focar na mudança do Gabarito) ... */}
        {/* MODO LEITURA */}
        <div id="questaoView" className={isEditing ? 'hidden' : ''}>
          {isReviewMode ? (
            <div className="field-group">
              <div className="reviewable-field-header">
                <span className="field-label">Identificação</span>
                <ReviewButtons
                  fieldId="identificacao"
                  state={reviewState['identificacao'] || null}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              </div>
              <div className={`data-box ${reviewState['identificacao'] === 'approved' ? 'field-approved' : reviewState['identificacao'] === 'rejected' ? 'field-rejected' : ''}`}>
                {questao.identificacao}
              </div>
            </div>
          ) : (
            <div className="field-group">
              <span className="field-label">Identificação</span>
              <div className="data-box">{questao.identificacao}</div>
            </div>
          )}

          {/* Conteúdo da Questão */}
          {isReviewMode ? (
            <div className="field-group">
              <span className="field-label">Conteúdo da Questão</span>
              <div className="data-box scrollable" style={{ padding: '15px' }}>
                <MainStructure
                  estrutura={questao.estrutura}
                  imagensExternas={imagensLocaisQuestao}
                  contexto="questao"
                  isReadOnly={isReadOnly}
                  isReviewMode={true}
                  reviewState={reviewState}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  blockPrefix="estrutura"
                />
              </div>
            </div>
          ) : (
            <div className="field-group">
              <span className="field-label">Conteúdo da Questão</span>
              <div className="data-box scrollable" style={{ padding: '15px' }}>
                <MainStructure
                  estrutura={questao.estrutura}
                  imagensExternas={imagensLocaisQuestao}
                  contexto="questao"
                  isReadOnly={isReadOnly}
                />
              </div>
            </div>
          )}

          {/* Matérias */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            {isReviewMode ? (
              <div className="field-group" style={{ flex: 1 }}>
                <span className="field-label">Matéria</span>
                <div className="data-box">
                  <ReviewableTags
                    items={questao.materias_possiveis || []}
                    fieldPrefix="materia"
                    tagClass="tag-subject"
                    reviewState={reviewState}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                </div>
              </div>
            ) : (
              <div className="field-group" style={{ flex: 1 }}>
                <span className="field-label">Matéria</span>
                <div className="data-box" dangerouslySetInnerHTML={{ __html: renderTags(questao.materias_possiveis, 'tag-subject') }} />
              </div>
            )}
          </div>

          {/* Palavras-Chave */}
          {isReviewMode ? (
            <div className="field-group">
              <span className="field-label">Palavras-Chave</span>
              <div className="tags-wrapper">
                <ReviewableTags
                  items={questao.palavras_chave || []}
                  fieldPrefix="palavra_chave"
                  tagClass="tag-keyword"
                  reviewState={reviewState}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              </div>
            </div>
          ) : (
            <div className="field-group">
              <span className="field-label">Palavras-Chave</span>
              <div className="tags-wrapper" dangerouslySetInnerHTML={{ __html: renderTags(questao.palavras_chave, 'tag-keyword') }} />
            </div>
          )}

          {/* Alternativas / Dissertativa */}
          {isDissertativa ? (
            /* === DISSERTATIVA MODE === */
            <div className="field-group dissertativa-section">
              <span className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                ✍️ Questão Dissertativa
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'var(--color-primary)', color: '#fff', fontWeight: 500 }}>Dissertativa</span>
              </span>
              
              <div style={{
                marginTop: '10px',
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-2)',
              }}>
                <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'var(--color-text)' }}>
                  Esta questão será corrigida baseada nos seguintes <strong>Fatores e Critérios</strong> esperados pela IA:
                </p>

                {gabarito?.resposta_modelo && (
                   <div style={{ marginBottom: '12px' }}>
                     <strong style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>📝 Resposta Modelo Esperada:</strong>
                     <div style={{ margin: '4px 0 0 8px', fontSize: '13px', fontStyle: 'italic', color: 'var(--color-text)', borderLeft: '3px solid var(--color-primary)', paddingLeft: '8px' }}>
                       {gabarito.resposta_modelo}
                     </div>
                   </div>
                )}
                
                {gabarito?.justificativa_curta && !gabarito?.resposta_modelo && (
                   <div style={{ marginBottom: '12px' }}>
                     <strong style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>📝 Critérios Base:</strong>
                     <div style={{ margin: '4px 0 0 8px', fontSize: '13px', fontStyle: 'italic', color: 'var(--color-text)', borderLeft: '3px solid var(--color-primary)', paddingLeft: '8px' }}>
                       {gabarito.justificativa_curta}
                     </div>
                   </div>
                )}

                {questao.palavras_chave?.length > 0 && (
                  <div>
                    <strong style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>🔎 Palavras-Chave de Atenção:</strong>
                    <div style={{ marginTop: '4px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {questao.palavras_chave.map((pw: string, i: number) => (
                        <span key={i} style={{ fontSize: '11px', background: 'rgba(34,197,94,0.1)', color: 'var(--color-success, #22c55e)', border: '1px solid rgba(34,197,94,0.3)', padding: '2px 8px', borderRadius: '20px' }}>
                          {pw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {(!gabarito?.resposta_modelo && !gabarito?.justificativa_curta && !(questao.palavras_chave?.length > 0)) && (
                   <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Nenhum critério específico extraído ainda.</span>
                )}
              </div>
            </div>
          ) : (
            /* === OBJETIVA MODE (original) === */
            isReviewMode ? (
              <div className="field-group">
                <span className="field-label">Alternativas ({questao.alternativas?.length || 0})</span>
                <div className="alts-list">
                  <Alternativas 
                    alts={questao.alternativas} 
                    isReviewMode={true}
                    reviewState={reviewState}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                </div>
              </div>
            ) : (
              <div className="field-group">
                <span className="field-label">Alternativas ({questao.alternativas?.length || 0})</span>
                <div className="alts-list">
                  <Alternativas alts={questao.alternativas} />
                </div>
              </div>
            )
          )}
        </div>


        {/* MODO EDIÇÃO */}
        {isEditing && (
          <form id="questaoEdit">
            <div className="field-group">
              <span className="field-label">Identificação</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <input id="edit_identificacao" className="form-control" type="text" defaultValue={questao.identificacao} style={{ flex: 1 }} />
                <button type="button" className="btn btn--sm btn--outline" onClick={() => window.iniciar_ocr_campo?.('edit_identificacao')} title="Usar OCR">🔍</button>
              </div>
            </div>

            <div className="field-group">
              <span className="field-label">Estrutura (Edição de Texto)</span>
              <div id="edit_estrutura_container">
                {/* Wrapper do Editor de Estrutura */}
                <div className="structure-editor-wrapper">
                  <div id="editor-drag-container" className="structure-editor-container" dangerouslySetInnerHTML={{ __html: blocosHtml }} />

                  <div id="editor-add-buttons" className="structure-toolbar structure-toolbar--addmenu">
                    <button type="button" id="btnToggleAddMenu" className="btn btn--primary btn--full-width btn-add-main">
                      + Adicionar bloco
                    </button>
                    <div id="editorAddMenu" className="add-menu hidden">
                      {['texto', 'titulo', 'subtitulo', 'citacao', 'lista', 'tabela', 'equacao', 'codigo', 'destaque', 'separador', 'fonte', 'imagem'].map(type => (
                        <button key={type} type="button" className="btn-add-block" data-add-type={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <small style={{ color: 'gray', fontSize: '10px' }}>* Para alterar imagens, clique no botão "Trocar Imagem" na visualização acima.</small>
            </div>

            <div className="field-group">
              <span className="field-label">Matérias (1/linha)</span>
              <textarea
                id="edit_materias"
                className="form-control"
                rows={2}
                defaultValue={joinLines(questao.materias_possiveis)}
                style={{ overflow: 'hidden', resize: 'none' }}
                onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }}
                ref={(ref) => { if (ref) { ref.style.height = 'auto'; ref.style.height = ref.scrollHeight + 'px'; } }}
              />
            </div>

            <div className="field-group">
              <span className="field-label">Palavras-chave (1/linha)</span>
              <textarea
                id="edit_palavras"
                className="form-control"
                rows={2}
                defaultValue={joinLines(questao.palavras_chave)}
                style={{ overflow: 'hidden', resize: 'none' }}
                onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }}
                ref={(ref) => { if (ref) { ref.style.height = 'auto'; ref.style.height = ref.scrollHeight + 'px'; } }}
              />
            </div>

            {/* TOGGLE TIPO DE RESPOSTA (Objetiva x Dissertativa) */}
            <div className="field-group" style={{ marginBottom: '15px' }}>
              <span className="field-label">Tipo de Questão</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                {/* Save final state context here */}
                <input type="hidden" id="edit_tipo_resposta" defaultValue={tipoRespostaMenu} />
                <button
                  type="button"
                  id="btn_toggle_objetiva"
                  className={`btn ${tipoRespostaMenu === 'objetiva' ? 'btn--primary' : 'btn--outline'}`}
                  onClick={(e) => {
                     const input = document.getElementById('edit_tipo_resposta') as HTMLInputElement;
                     if (input) input.value = 'objetiva';
                     e.currentTarget.className = "btn btn--primary";
                     e.currentTarget.style.fontWeight = "bold";
                     const btnDiss = document.getElementById('btn_toggle_dissertativa');
                     if (btnDiss) {
                       btnDiss.className = "btn btn--outline";
                       btnDiss.style.fontWeight = "normal";
                     }
                     const altsContainer = document.getElementById('edit_alts_container');
                     if (altsContainer) altsContainer.style.display = 'block';
                  }}
                  style={{ flex: 1, fontWeight: tipoRespostaMenu === 'objetiva' ? 'bold' : 'normal' }}
                >
                  📝 Questão Teste (Objetiva)
                </button>
                <button
                  type="button"
                  id="btn_toggle_dissertativa"
                  className={`btn ${tipoRespostaMenu === 'dissertativa' ? 'btn--primary' : 'btn--outline'}`}
                  onClick={(e) => {
                     const input = document.getElementById('edit_tipo_resposta') as HTMLInputElement;
                     if (input) input.value = 'dissertativa';
                     e.currentTarget.className = "btn btn--primary";
                     e.currentTarget.style.fontWeight = "bold";
                     const btnObj = document.getElementById('btn_toggle_objetiva');
                     if (btnObj) {
                       btnObj.className = "btn btn--outline";
                       btnObj.style.fontWeight = "normal";
                     }
                     const altsContainer = document.getElementById('edit_alts_container');
                     if (altsContainer) altsContainer.style.display = 'none';
                  }}
                  style={{ flex: 1, fontWeight: tipoRespostaMenu === 'dissertativa' ? 'bold' : 'normal' }}
                >
                  ✍️ Questão Dissertativa
                </button>
              </div>
            </div>

            {/* Alternativas (Sempre geradas no DOM, visibility controlada) */}
            <div className="field-group" id="edit_alts_container" style={{ display: tipoRespostaMenu === 'objetiva' ? 'block' : 'none' }}>
              <span className="field-label">Alternativas da Questão (Testes)</span>
              <div id="edit_alts" className="alts-list">
                  {(questao.alternativas || []).map((alt, i) => {
                    const estruturaAlt = Array.isArray(alt.estrutura) ? alt.estrutura : [{ tipo: 'texto', conteudo: String(alt.texto ?? '') }];
                    const blocosAltHtml = estruturaAlt.map((b) => criarHtmlBlocoEditor(b.tipo, b.conteudo)).join('');
  
                    return (
                      <div key={i} className="alt-row alt-edit-row" data-alt-index={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                          <input className="form-control alt-letter" style={{ width: '60px', textAlign: 'center' }} defaultValue={alt.letra} placeholder="Letra" />
                          <button type="button" className="btn btn--sm btn--outline btn-remove-alt" style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)', minWidth: '30px' }} title="Remover alternativa">✕</button>
                        </div>
                        <div className="alt-editor">
                          <div className="structure-editor-wrapper">
                            <div className="structure-editor-container alt-drag-container" dangerouslySetInnerHTML={{ __html: blocosAltHtml }}></div>
                            
                            {/* MENU DROPDOWN (Nova UI) */}
                            <div className="structure-toolbar alt-add-buttons" style={{ marginTop: '6px', position: 'relative' }}>
                               <button type="button" className="btn btn--sm btn--secondary btn-alt-toggle-menu" style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '5px', alignItems: 'center' }}>
                                   <span>+</span> <span>Adicionar Conteúdo</span>
                               </button>
                               <div className="alt-add-menu hidden" style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', borderRadius: '6px', padding: '8px', zIndex: 999, flexDirection: 'column', gap: '4px', marginTop: '5px', display: 'none' }}>
                                   {['texto', 'equacao', 'imagem'].map(t => (
                                       <button key={t} type="button" className="btn btn--sm btn--text btn-alt-add" style={{ justifyContent: 'flex-start', textAlign: 'left', width: '100%' }} data-add-type={t}>
                                           {t === 'texto' ? '📄 Texto' : t === 'equacao' ? '∑ Equação' : '📷 Imagem'}
                                       </button>
                                   ))}
                                   <div style={{ height: '1px', background: 'var(--color-border)', margin: '4px 0' }}></div>
                                   {['lista', 'tabela', 'codigo', 'citacao', 'destaque'].map(t => (
                                       <button key={t} type="button" className="btn btn--sm btn--text btn-alt-add" style={{ justifyContent: 'flex-start', textAlign: 'left', width: '100%' }} data-add-type={t}>
                                           {t === 'lista' ? '≡ Lista' : t === 'tabela' ? '▦ Tabela' : t === 'codigo' ? '{ } Código' : t === 'citacao' ? '“ Citação' : '★ Destaque'}
                                       </button>
                                   ))}
                                   <div style={{ height: '1px', background: 'var(--color-border)', margin: '4px 0' }}></div>
                                    {['titulo', 'subtitulo', 'separador', 'fonte'].map(t => (
                                       <button key={t} type="button" className="btn btn--sm btn--text btn-alt-add" style={{ justifyContent: 'flex-start', textAlign: 'left', width: '100%' }} data-add-type={t}>
                                           {t === 'titulo' ? 'H1 Título' : t === 'subtitulo' ? 'H2 Subtítulo' : t === 'separador' ? '__ Separador' : '© Fonte'}
                                       </button>
                                   ))}
                               </div>
                            </div>
                            
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button type="button" className="btn btn--secondary btn--full-width" id="btnAddAlt" style={{ marginTop: '5px' }} onClick={handleAdicionarAlternativa}>
                  + Adicionar Alternativa Teste
                </button>
            </div>

            <button type="button" className="btn btn--primary btn--full-width" id="btnSalvarEdicao" style={{ marginTop: '15px' }} onClick={handleSalvarEdicao}>
              💾 Salvar Alterações
            </button>
          </form>
        )}

        {/* Barra de Ações da Questão - Oculta no modo review */}
        {!isReviewMode && (
          <div className="result-actions" id="actionsLeitura" style={{ marginTop: '15px' }}>
            {!isEditing ? (
              <button type="button" className="btn btn--secondary btn--full-width" id="btnEditar" onClick={() => setIsEditing(true)}>
                {questao.isRecitation ? '✏️ Transcrever Manualmente' : '✏️ Editar Conteúdo'}
              </button>
            ) : (
              <div id="questaoEditActions">
                <button type="button" className="btn btn--secondary btn--full-width" id="btnCancelarEdicao" onClick={() => setIsEditing(false)}>
                  Cancelar
                </button>
              </div>
            )}

            {/* Botão Confirmar (Só aparece se não tiver gabarito, lógica original) */}
            {!gabarito && !isEditing && (
              <button
                type="button"
                className="btn btn--primary btn--full-width"
                id="btnConfirmarQuestao"
                style={{ marginTop: '5px' }}
                onClick={handleConfirmarQuestao}
              >
                Confirmar e Extrair Gabarito ➡️
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. Conteúdo da Aba Gabarito */}
      <div id="tabContentGabarito" style={{ display: activeTab === 'gabarito' ? 'block' : 'none' }}>
        {dadosGabarito ? (
          <>
            <div id="gabaritoView" className={isGabaritoEditing ? 'hidden' : ''}>
              {/* Gabarito com revisão granular - passa props diretamente */}
              <GabaritoCardView
                dados={dadosGabarito}
                isReviewMode={isReviewMode}
                reviewState={reviewState}
                onApprove={handleApprove}
                onReject={handleReject}
              />
              {/* Oculta ações de editar/finalizar no modo review */}
              {!isReviewMode && (
                <AcoesGabaritoView
                  onEdit={() => setIsGabaritoEditing(true)}
                  onFinish={handleFinalizarTudo}
                />
              )}
            </div>

            {/* O formulário do editor do gabarito é complexo e gerado externamente. 
                  Injetamos HTML e deixamos os scripts de steps-ui.js assumirem o controle. */}
            {!isReviewMode && (
              <div className={!isGabaritoEditing ? 'hidden' : ''}>
                <GabaritoEditorView
                  dados={dadosGabarito}
                  onSave={handleSalvarGabarito}
                  onCancel={handleCancelarGabarito}
                />
              </div>
            )}
          </>
        ) : (
          <div className="empty-state" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            <p>Nenhum gabarito extraído ainda.</p>
            <small>Use a ferramenta de recorte para capturar o gabarito ou aguarde a IA.</small>
          </div>
        )}
      </div>

      {/* Botão Enviar Revisão (só aparece no modo review) */}
      {isReviewMode && (() => {
        // Contar aprovados e rejeitados baseado no estado
        const totalMarcados = Object.values(reviewState).filter(v => v !== null).length;
        const totalAprovados = Object.values(reviewState).filter(v => v === 'approved').length;
        const totalRejeitados = Object.values(reviewState).filter(v => v === 'rejected').length;
        
        // Usar o total contado do DOM
        const totalCampos = totalReviewFields;
        const totalPendentes = totalCampos - totalMarcados;
        
        // Botão só habilitado se TODOS os campos foram marcados
        const todosPreenchidos = totalCampos > 0 && totalMarcados >= totalCampos;
        
        return (
          <div style={{ padding: '15px 0' }}>
            <div className="review-progress">
              <span className="review-progress-item review-progress-item--approved">
                ✓ {totalAprovados} aprovados
              </span>
              <span className="review-progress-item review-progress-item--rejected">
                ✗ {totalRejeitados} rejeitados
              </span>
              <span className="review-progress-item review-progress-item--pending">
                ○ {totalCampos === 0 ? '—' : totalPendentes > 0 ? totalPendentes : 0} pendentes
              </span>
              <span className="review-progress-item" style={{ marginLeft: 'auto', color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                Total: {totalMarcados}/{totalCampos}
              </span>
            </div>
            
            {!todosPreenchidos && totalCampos > 0 && (
              <div className="review-warning" style={{ 
                margin: '8px 0', 
                padding: '8px 12px', 
                background: 'rgba(251, 146, 60, 0.1)', 
                border: '1px solid rgba(251, 146, 60, 0.3)', 
                borderRadius: '6px',
                fontSize: '12px',
                color: '#fb923c'
              }}>
                ⚠️ Marque todos os {totalPendentes > 0 ? totalPendentes : 0} campos pendentes antes de enviar
              </div>
            )}
            
            <button
              type="button"
              className={`btn-enviar-revisao ${!todosPreenchidos ? 'btn-enviar-revisao--disabled' : ''}`}
              onClick={() => {
                const finalReview = Object.fromEntries(
                  Object.entries(reviewState).filter(([_, v]) => v !== null)
                ) as Record<string, 'approved' | 'rejected'>;
                onReviewSubmit?.(finalReview);
              }}
              disabled={!todosPreenchidos}
              title={!todosPreenchidos ? `Faltam ${totalPendentes > 0 ? totalPendentes : 0} campos para revisar` : 'Enviar revisão completa'}
            >
              📤 Enviar Revisão {todosPreenchidos ? '✓' : `(${totalPendentes > 0 ? totalPendentes : 0} pendentes)`}
            </button>
          </div>
        );
      })()}

    </div>
  );
};

export default QuestaoTabs;