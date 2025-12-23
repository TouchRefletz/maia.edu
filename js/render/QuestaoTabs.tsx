import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { processarSalvamentoGabarito } from '../editor/gabarito-save.js';

// Importações originais mantidas para garantir a mesma lógica de negócio e templates
import { configurarEventosNovaAlternativa, gerarHtmlTemplateAlternativa } from '../editor/alternativas.js';
import { initBotaoAdicionarPasso, setupImageToggle } from '../editor/passos.js';
import { processarSalvamentoQuestao } from '../editor/questao-save.js';
import { initStepEditors } from '../editor/steps-ui.js';
import { configurarDelecao, configurarDragAndDrop, criarHtmlBlocoEditor, iniciarEditorEstrutura } from '../editor/structure-editor.js';
import { renderLatexIn } from '../libs/loader';
import { joinLines } from '../normalize/primitives.js';
// ... (imports)
import { validarProgressoImagens } from '../validation/metricas-imagens.js';
// import { renderAlternativas } from './alternativas.js'; // REMOVIDO
// import { renderizarEstruturaHTML } from './structure.js'; // REMOVIDO
import { trocarModo } from '../viewer/pdf-core.js';
import { esconderPainel } from '../viewer/sidebar.js';
import { Alternativas } from './AlternativasRender';
import { renderizarTelaFinal } from './final/json-e-modal.js';
import { renderTags } from './final/render-components.js';
import { AcoesGabaritoView, GabaritoCardView, GabaritoEditorView, prepararDadosGabarito } from './GabaritoCard.js';
import { MobileInteractableHeader } from './MobileLayout';
import { MainStructure } from './StructureRender';

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
  isRecitation?: boolean;
}

interface Props {
  questao: QuestaoData;
  gabarito: any; // Tipo do gabarito
  containerRef: HTMLElement; // Referência do container pai para LaTeX
}

const QuestaoTabs: React.FC<Props> = ({ questao, gabarito, containerRef }) => {
  // Estado para controlar as abas
  const [activeTab, setActiveTab] = useState<'questao' | 'gabarito'>(
    (window as any).__modo === 'gabarito' && gabarito ? 'gabarito' : 'questao'
  );

  // Estado para controlar modo de edição da questão
  const [isEditing, setIsEditing] = useState(!!questao.isRecitation);

  // Estado para controlar modo de edição do gabarito
  const [isGabaritoEditing, setIsGabaritoEditing] = useState(false);

  // Referência para verificar se é a primeira renderização
  const isFirstRender = useRef(true);

  // --- EFEITO: Renderizar LaTeX ao mudar abas ou modo ---
  useEffect(() => {
    setTimeout(() => {
      if (typeof renderLatexIn === 'function' && containerRef) {
        renderLatexIn(containerRef);
      }
    }, 50); // Pequeno delay igual ao original
  }, [activeTab, isEditing, isGabaritoEditing, containerRef]);

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
    const tudoCerto = await validarProgressoImagens('gabarito');
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

      // Botões Add Bloco
      row.querySelectorAll('.btn-alt-add').forEach((btn: any) => {
        // Remove listener anterior para evitar duplicação em re-renders
        btn.onclick = null;
        btn.onclick = () => {
          const tipo = btn.dataset.addType;
          const html = criarHtmlBlocoEditor(tipo, '');
          const temp = document.createElement('div');
          temp.innerHTML = html.trim();
          const novoEl = temp.firstChild as HTMLElement; // Type assertion
          drag.appendChild(novoEl);
          novoEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); // Better UX
        };
      });

      // Botão Remover Alternativa
      const btnRemove = row.querySelector('.btn-remove-alt');
      if (btnRemove) {
        btnRemove.onclick = () => row.remove();
      }
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
    }
  };

  const handleConfirmarQuestao = async () => {
    const urls = (window as any).__pdfUrls || (window as any).pdfUrls;
    if (urls?.gabarito) (window as any).__preferirPdfGabarito = true;

    if (typeof trocarModo === 'function') {
      const trocou = await trocarModo('gabarito');
      if (trocou === false) return;
    }

    if ((window as any).modo == 'gabarito' && window.innerWidth <= 900) {
      if (typeof esconderPainel === 'function') esconderPainel();
    }

    // Força atualização de estado local se necessário
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
    <div className="questao-tabs-react-root">

      {/* HEADER MOBILE (Drag Handle) - Só aparece via CSS no mobile */}
      <MobileInteractableHeader />

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
          onClick={() => setActiveTab('gabarito')}
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
          <div className="field-group">
            <span className="field-label">Identificação</span>
            <div className="data-box">{questao.identificacao}</div>
          </div>

          <div className="field-group">
            <span className="field-label">Conteúdo da Questão</span>
            <div className="data-box scrollable" style={{ padding: '15px' }}>
              <MainStructure
                estrutura={questao.estrutura}
                imagensExternas={imagensLocaisQuestao}
                contexto="questao"
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <div className="field-group" style={{ flex: 1 }}>
              <span className="field-label">Matéria</span>
              <div className="data-box" dangerouslySetInnerHTML={{ __html: renderTags(questao.materias_possiveis, 'tag-subject') }} />
            </div>
          </div>

          <div className="field-group">
            <span className="field-label">Palavras-Chave</span>
            <div className="tags-wrapper" dangerouslySetInnerHTML={{ __html: renderTags(questao.palavras_chave, 'tag-keyword') }} />
          </div>

          <div className="field-group">
            <span className="field-label">Alternativas ({questao.alternativas?.length || 0})</span>
            <div className="alts-list">
              <Alternativas alts={questao.alternativas} />
            </div>
          </div>
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
                      {['texto', 'titulo', 'subtitulo', 'citacao', 'lista', 'equacao', 'codigo', 'destaque', 'separador', 'fonte', 'imagem'].map(type => (
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

            <div className="field-group">
              <span className="field-label">Alternativas</span>
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
                          <div className="structure-toolbar alt-add-buttons" style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {['texto', 'equacao', 'imagem'].map(t => (
                              <button key={t} type="button" className="btn btn--sm btn--secondary btn-alt-add" data-add-type={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button type="button" className="btn btn--secondary btn--full-width" id="btnAddAlt" style={{ marginTop: '5px' }} onClick={handleAdicionarAlternativa}>
                + Adicionar Alternativa
              </button>
            </div>

            <button type="button" className="btn btn--primary btn--full-width" id="btnSalvarEdicao" style={{ marginTop: '15px' }} onClick={handleSalvarEdicao}>
              💾 Salvar Alterações
            </button>
          </form>
        )}

        {/* Barra de Ações da Questão */}
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
      </div>

      {/* 3. Conteúdo da Aba Gabarito */}
      <div id="tabContentGabarito" style={{ display: activeTab === 'gabarito' ? 'block' : 'none' }}>
        {dadosGabarito ? (
          <>
            <div id="gabaritoView" className={isGabaritoEditing ? 'hidden' : ''}>
              <GabaritoCardView dados={dadosGabarito} />
              <AcoesGabaritoView
                onEdit={() => setIsGabaritoEditing(true)}
                onFinish={handleFinalizarTudo}
              />
            </div>

            {/* O formulário do editor do gabarito é complexo e gerado externamente. 
                  Injetamos HTML e deixamos os scripts de steps-ui.js assumirem o controle. */}
            <div className={!isGabaritoEditing ? 'hidden' : ''}>
              <GabaritoEditorView
                dados={dadosGabarito}
                onSave={handleSalvarGabarito}
                onCancel={handleCancelarGabarito}
              />
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            <p>Nenhum gabarito extraído ainda.</p>
            <small>Use a ferramenta de recorte para capturar o gabarito ou aguarde a IA.</small>
          </div>
        )}
      </div>

    </div>
  );
};

export default QuestaoTabs;