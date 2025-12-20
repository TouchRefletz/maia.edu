import { asStringArray } from '../normalize/primitives.js';
import { criarHtmlBlocoEditor } from '../editor/structure-editor.js';
import { normCreditos } from '../normalize/creditos.js';
import { normalizeAlternativasAnalisadas } from '../normalize/alternativas.js';
import { normalizeExplicacao } from '../normalize/explicacao.js';
import { pick } from '../utils/pick.js';
import { renderComplexidade } from './complexidade.js';
import { renderizarEstruturaHTML } from './structure.js';
import { safe } from '../normalize/primitives.js';

/**
 * Centraliza toda a extração e normalização de dados do gabarito.
 * Usa os seus helpers globais (pick, normCreditos, etc).
 */
export function prepararDadosGabarito(gabarito, questao) {
  const respostaLetra = String(
    pick(gabarito.alternativa_correta, gabarito.resposta, '')
  )
    .trim()
    .toUpperCase();

  // Normalização da explicação usando seu helper global
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
    questao: questao, // Passamos a questão original para ter acesso às alternativas originais
  };
}

export function renderCartaoGabarito(dados) {
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

  return `
        <div class="question gabarito-card">
            <div class="result-header">
                <h3>Gabarito</h3>
                <span class="badge-success">Ok</span>
            </div>

            <div class="questionText gabarito-head">
                <p><strong>Alternativa correta:</strong> ${safe(respostaLetra)}</p>
                ${justificativaCurta ? `<p class="gabarito-just markdown-content">${safe(justificativaCurta)}</p>` : ''}
            </div>
            
            ${typeof renderComplexidade !== 'undefined' ? renderComplexidade(complexidadeRaw) : ''}
            ${_renderMetaGabarito(confianca, creditos)}
            ${_renderOpcoesGabarito(questao, respostaLetra, alternativasAnalisadas)}
        </div>

        ${_renderPassosExplicacao(explicacaoArray)}
        ${_renderDetalhesTecnicos(dados)}
    `;
}

export function renderAcoesGabarito() {
  return `
        <div class="result-actions" id="actionsLeituraGabarito" style="margin-top:15px;">
            <button type="button" class="btn btn--secondary btn--full-width" id="btnEditarGabarito">
                Editar gabarito
            </button>
            <button type="button" class="btn btn--success btn--full-width" id="btnFinalizarTudo" style="margin-top:10px; font-weight:bold; border:1px solid rgba(0,0,0,0.1);">
                ✨ Finalizar Questão
            </button>
        </div>
    `;
}

// --- Sub-funções de Renderização Visual ---

export function _renderMetaGabarito(confianca, creditos) {
  const clamp01 = (n) => Math.max(0, Math.min(1, Number(n)));
  const fmtPct = (n) => `${Math.round(clamp01(n) * 100)}%`;
  const chips = [];

  // Chip Confiança
  if (
    confianca !== null &&
    confianca !== undefined &&
    !Number.isNaN(Number(confianca))
  ) {
    chips.push(`
            <div class="gabarito-chip gabarito-chip--info">
                <span class="gabarito-chip__k">Confiança</span>
                <span class="gabarito-chip__v">${safe(fmtPct(confianca))}</span>
            </div>
        `);
  }

  // Chip Origem
  if (creditos?.origemresolucao) {
    chips.push(`
            <div class="gabarito-chip gabarito-chip--muted">
                <span class="gabarito-chip__k">Origem</span>
                <span class="gabarito-chip__v">${safe(creditos.origemresolucao)}</span>
            </div>
        `);
  }

  if (!chips.length) return '';

  const showBar =
    confianca !== null &&
    confianca !== undefined &&
    !Number.isNaN(Number(confianca));
  const fill = showBar ? fmtPct(confianca) : '0%';

  return `
        <div class="gabarito-meta">
            <div class="gabarito-meta__row">${chips.join('')}</div>
            ${
              showBar
                ? `
                <div class="gabarito-confbar" style="--fill-width:${safe(fill)}">
                    <div class="gabarito-confbar__label">Confiança visual</div>
                    <div class="gabarito-confbar__track"><div class="gabarito-confbar__fill"></div></div>
                </div>
            `
                : ''
            }
        </div>
    `;
}

export function _renderOpcoesGabarito(questao, respostaLetra, alternativasAnalisadas) {
  const alts = Array.isArray(questao?.alternativas) ? questao.alternativas : [];
  if (!alts.length) return '';

  const normLetra = (v) =>
    String(v ?? '')
      .trim()
      .toUpperCase();
  const correta = normLetra(respostaLetra);

  return `
        <div class="answerOptions gabarito-options">
            ${alts
              .map((alt) => {
                const letra = normLetra(alt?.letra);
                const isCorrect = letra && correta && letra === correta;
                const analise = (alternativasAnalisadas || []).find(
                  (a) => normLetra(a?.letra) === letra
                );

                return `
                    <div class="answerOption ${isCorrect ? 'correct' : ''}">
                        <span class="option-letter">${safe(letra)}</span>
                        <div class="option-text">
                            ${safe(alt?.texto)}
                            ${analise?.motivo ? `<div class="option-reason">${safe(analise.motivo)}</div>` : ''}
                        </div>
                    </div>
                `;
              })
              .join('')}
        </div>
    `;
}

export function _renderPassosExplicacao(explicacaoArray) {
  if (!explicacaoArray.length) return '';

  return `
      <div class="passo gabarito-steps">
        <div class="passoText"><p><strong>Explicação (passo a passo)</strong></p></div>
        <div class="explicacao">
          <ol class="steps-list">
            ${explicacaoArray
              .map((p, idx) => {
                // Lógica de imagens mantida
                if (!window.__imagensLimpas) window.__imagensLimpas = {}; // Safety check
                if (!window.__imagensLimpas.gabarito_passos)
                  window.__imagensLimpas.gabarito_passos = {};
                const imagensDestePasso =
                  window.__imagensLimpas.gabarito_passos[idx] || [];

                const htmlConteudo = renderizarEstruturaHTML(
                  p.estrutura,
                  imagensDestePasso,
                  `gabarito_passo_${idx}`
                );

                const origemRaw = String(p?.origem || '')
                  .toLowerCase()
                  .replace(/_/g, '');
                const isExtraido = origemRaw.includes('extraido');

                const badgeOrigem = isExtraido
                  ? `<span class="step-chip" style="background:var(--color-bg-2); color:var(--color-success); border:1px solid var(--color-success); font-weight:600;">📄 Extraído</span>`
                  : `<span class="step-chip" style="background:rgba(59, 130, 246, 0.08); color:#2563eb; border:1px solid rgba(59, 130, 246, 0.3); font-weight:600;">🤖 IA</span>`;

                return `
                  <li class="step-card">
                    <div class="step-index">${idx + 1}</div>
                    <div class="step-body">
                      <div class="step-content">${htmlConteudo}</div>
                      <div class="step-meta" style="margin-top:10px; padding-top:8px; border-top:1px dashed var(--color-border); display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                        ${badgeOrigem}
                        ${p?.fontematerial ? `<span class="step-chip step-chip--muted" title="Fonte/Material: ${safe(p.fontematerial)}">📚 ${safe(p.fontematerial)}</span>` : ''}
                        ${p?.evidencia ? `<span class="step-chip step-chip--muted" title="Evidência Visual: ${safe(p.evidencia)}" style="border-style:dashed;">👁️ ${safe(p.evidencia)}</span>` : ''}
                      </div>
                    </div>
                  </li>
                `;
              })
              .join('')}
          </ol>
        </div>
      </div>
    `;
}

export function _renderDetalhesTecnicos(dados) {
  const { creditos, alertasCredito, observacoes, coerencia } = dados;
  if (!creditos && !alertasCredito.length && !observacoes.length && !coerencia)
    return '';

  // Helper interno para formatar chips de coerência
  const chip = (label, ok, okTxt = 'OK', badTxt = 'Atenção') => `
        <div class="coerencia-chip ${ok ? 'coerencia-chip--ok' : 'coerencia-chip--bad'}">
            <span class="coerencia-chip-k">${safe(label)}</span>
            <span class="coerencia-chip-v">${safe(ok ? okTxt : badTxt)}</span>
        </div>
    `;

  // Renderização da Coerência
  let htmlCoerencia = '';
  if (coerencia) {
    const altOk =
      coerencia.alternativa_correta_existe ??
      coerencia.alternativaCorretaExiste;
    const todasOk =
      coerencia.tem_analise_para_todas ?? coerencia.temAnaliseParaTodas;
    const obs = Array.isArray(coerencia.observacoes)
      ? coerencia.observacoes
      : [];
    const htmlObs = obs.length
      ? `<div class="coerencia-obs"><div class="coerencia-obs-title">Observações</div><ul>${obs.map((o) => `<li>${safe(o)}</li>`).join('')}</ul></div>`
      : `<div class="coerencia-obs coerencia-obs--empty">Sem observações.</div>`;

    htmlCoerencia = `
            <div class="field-group">
                <span class="field-label">Coerência (checagens)</span>
                <div class="coerencia-grid">
                    ${chip('Alternativa correta existe', !!altOk)}
                    ${chip('Análise para todas', !!todasOk)}
                    ${chip('Observações', obs.length === 0, 'Nenhuma', 'Há itens')}
                </div>
                ${htmlObs}
            </div>
        `;
  }

  // Renderização dos Créditos (Detalhes)
  let htmlCreditos = '';
  if (creditos) {
    const chipKV = (k, v, cls = '') =>
      `<div class="coerencia-chip ${cls}"><span class="coerencia-chip-k">${safe(k)}</span><span class="coerencia-chip-v">${safe(v ?? '—')}</span></div>`;
    const toPct = (n) =>
      !Number.isNaN(Number(n))
        ? `${Math.round(Math.max(0, Math.min(1, Number(n))) * 100)}%`
        : null;

    htmlCreditos = `
            <div class="field-group">
                <span class="field-label">Créditos / Fonte</span>
                <div class="coerencia-grid">
                    ${chipKV('Origem', creditos.origemresolucao || '—')}
                    ${chipKV('Material identificado', creditos.materialidentificado ? 'Sim' : 'Não', creditos.materialidentificado ? 'coerencia-chip--ok' : 'coerencia-chip--bad')}
                    ${creditos.confiancaidentificacao != null ? chipKV('Confiança ident.', toPct(creditos.confiancaidentificacao)) : ''}
                    ${creditos.material ? chipKV('Material', creditos.material) : ''}
                    ${creditos.autorouinstituicao ? chipKV('Autor/Instituição', creditos.autorouinstituicao) : ''}
                    ${creditos.ano ? chipKV('Ano', creditos.ano) : ''}
                    ${chipKV('Precisa crédito genérico', creditos.precisacreditogenerico ? 'Sim' : 'Não', creditos.precisacreditogenerico ? 'coerencia-chip--bad' : 'coerencia-chip--ok')}
                </div>
                ${creditos.comoidentificou ? `<div class="coerencia-obs"><div class="coerencia-obs-title">Evidência</div><div>${safe(creditos.comoidentificou)}</div></div>` : `<div class="coerencia-obs coerencia-obs--empty">Sem evidência registrada.</div>`}
                ${creditos.textocreditosugerido ? `<div class="coerencia-obs" style="margin-top:8px;"><div class="coerencia-obs-title">Crédito sugerido</div><div>${safe(creditos.textocreditosugerido)}</div></div>` : ''}
            </div>
        `;
  }

  return `
        <details class="gabarito-extra">
            <summary>Detalhes técnicos</summary>
            ${htmlCoerencia}
            ${observacoes.length ? `<div class="field-group"><span class="field-label">Observações</span><div class="data-box scrollable"><ul>${observacoes.map((o) => `<li>${safe(o)}</li>`).join('')}</ul></div></div>` : ''}
            ${htmlCreditos}
            ${alertasCredito.length ? `<div class="field-group"><span class="field-label">Alertas de crédito</span><div class="data-box scrollable"><ul>${alertasCredito.map((a) => `<li>${safe(a)}</li>`).join('')}</ul></div></div>` : ''}
        </details>
    `;
}

export function renderFormularioEditor(dados) {
  const {
    respostaLetra,
    justificativaCurta,
    confianca,
    explicacaoArray,
    questao,
    alternativasAnalisadas,
    coerencia,
    complexidadeRaw,
    creditos,
    alertasCredito,
    observacoes,
  } = dados;

  return `
        <form id="gabaritoEdit" class="hidden">
            <div class="field-group">
                <span class="field-label">Alternativa correta</span>
                <input id="editGabaritoResposta" class="form-control" type="text" value="${safe(respostaLetra)}" placeholder="Ex.: A" />
            </div>
            <div class="field-group">
                <span class="field-label">Justificativa curta</span>
                <textarea id="editGabaritoJust" class="form-control" rows="3" placeholder="1–2 frases">${safe(justificativaCurta || '')}</textarea>
            </div>
            <div class="field-group">
                <span class="field-label">Confiança (0–1)</span>
                <input id="editGabaritoConfianca" class="form-control" type="number" min="0" max="1" step="0.01" value="${confianca ?? ''}" placeholder="0.85" />
            </div>

            ${_renderEditorPassos(explicacaoArray)}
            ${_renderEditorAnaliseAlternativas(questao, alternativasAnalisadas)}
            ${_renderEditorCoerencia(coerencia)}
            ${_renderEditorComplexidade(complexidadeRaw)}
            ${_renderEditorCreditos(creditos)}

            <div class="field-group">
                <span class="field-label">Alertas de crédito (1 por linha)</span>
                <textarea id="editGabaritoAlertas" class="form-control" rows="3">${safe(alertasCredito.join('\n'))}</textarea>
            </div>
            <div class="field-group">
                <span class="field-label">Observações gerais (1 por linha)</span>
                <textarea id="editGabaritoObs" class="form-control" rows="3">${safe(observacoes.join('\n'))}</textarea>
            </div>

            <button type="button" class="btn btn--primary btn--full-width" id="btnSalvarEdicaoGabarito" style="margin-top:12px;">Salvar alterações (gabarito)</button>
            <button type="button" class="btn btn--secondary btn--full-width" id="btnCancelarEdicaoGabarito" style="margin-top:8px;">Cancelar</button>
        </form>
    `;
}

// --- Sub-funções do Editor ---

export function _renderEditorPassos(explicacaoArray) {
  const passosHtml = (explicacaoArray || [])
    .map((p, idx) => {
      const blocosHtml = (p.estrutura || [])
        .map((b) => criarHtmlBlocoEditor(b.tipo, b.conteudo))
        .join('');
      const origemRaw = String(p.origem || '')
        .toLowerCase()
        .replace(/_/g, '');
      const isExtraido = origemRaw.includes('extraido');
      const isIA = !isExtraido;

      return `
            <div class="step-edit-row" data-step-index="${idx}" style="border:1px solid var(--color-border); padding:15px; border-radius:8px; margin-bottom:15px; background:var(--color-bg-1);">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px; align-items:center;">
                    <strong style="color:var(--color-primary);">Passo ${idx + 1}</strong>
                    <button type="button" class="btn btn--sm btn--outline btn-remove-step" style="color:var(--color-error); border-color:var(--color-error); font-size:11px;">✕ Remover Passo</button>
                </div>
                <div class="structure-editor-wrapper">
                    <div class="structure-editor-container step-drag-container" style="min-height: 50px; background: var(--color-background);">${blocosHtml}</div>
                    <div class="structure-toolbar step-add-toolbar" style="margin-top:8px; padding-top:8px; border-top:1px dashed var(--color-border); position:relative;">
                        <button type="button" class="btn btn--sm btn--secondary btn--full-width btn-toggle-step-add" style="display:flex; justify-content:center; align-items:center; gap:5px; background:var(--color-bg-2);">
                            <span>+ Adicionar Bloco de Conteúdo</span><span style="font-size:10px; opacity:0.7;">▼</span>
                        </button>
                        <div class="step-menu-content hidden" style="position:absolute; top:100%; left:0; width:100%; z-index:100; display:grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap:5px; padding:10px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.15); margin-top:5px;">
                            <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="texto">Texto</button>
                            <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="imagem">Imagem</button>
                            <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="equacao">Equação</button>
                            <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="lista">Lista</button>
                            <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="destaque">Destaque</button>
                            <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="citacao">Citação</button>
                            <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="codigo">Código</button>
                            <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="titulo">Título</button>
                            <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="subtitulo">Subtítulo</button>
                            <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="fonte">Fonte</button>
                            <button type="button" class="btn btn--sm btn--outline btn-add-step-item" data-type="separador">Separador</button>
                        </div>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:15px; background:rgba(0,0,0,0.03); padding:10px; border-radius:6px;">
                    <div style="flex:1;">
                        <span class="field-label" style="font-size:10px; margin-bottom:2px; display:block; color:var(--color-text-secondary);">Origem do Conteúdo</span>
                        <select class="form-control passo-origem" style="width:100%;">
                            <option value="extraido_do_material" ${isExtraido ? 'selected' : ''}>📄 Extraído do Material</option>
                            <option value="gerado_pela_ia" ${isIA ? 'selected' : ''}>🤖 Gerado pela IA</option>
                        </select>
                    </div>
                    <div style="flex:1;">
                        <span class="field-label" style="font-size:10px; margin-bottom:2px; display:block; color:var(--color-text-secondary);">Fonte / Material</span>
                        <input class="form-control passo-fonte" placeholder="Ex: Página 32..." value="${safe(p.fontematerial || '')}" style="width:100%;" />
                    </div>
                    <div style="grid-column: 1 / -1;">
                        <span class="field-label" style="font-size:10px; margin-bottom:2px; display:block; color:var(--color-text-secondary);">Evidência Visual (se houver)</span>
                        <input class="form-control passo-evidencia" placeholder="Ex: Gráfico azul, segundo parágrafo..." value="${safe(p.evidencia || '')}" style="width:100%;" />
                    </div>
                </div>
            </div>
        `;
    })
    .join('');

  return `
        <div class="field-group">
            <span class="field-label">Explicação (passos)</span>
            <div id="editGabaritoPassos">${passosHtml}</div>
            <button type="button" class="btn btn--secondary btn--full-width" id="btnAddPassoGabarito" style="margin-top:6px;">
                + Adicionar Novo Passo
            </button>
        </div>
    `;
}

export function _renderEditorAnaliseAlternativas(questao, alternativasAnalisadas) {
  const altsHtml = (
    Array.isArray(questao?.alternativas) ? questao.alternativas : []
  )
    .map((alt) => {
      const letra = String(alt?.letra || '')
        .trim()
        .toUpperCase();
      const analise = (alternativasAnalisadas || []).find(
        (a) =>
          String(a?.letra || '')
            .trim()
            .toUpperCase() === letra
      );

      return `
            <div class="alt-row alt-edit-row" style="display:flex; gap:6px; align-items:flex-start; margin-bottom:6px;">
                <input class="form-control" style="width:60px; text-align:center;" value="${safe(letra)}" disabled />
                <textarea class="form-control gabarito-motivo" data-letra="${safe(letra)}" rows="2" placeholder="Motivo (correta/errada)">${safe(analise?.motivo || '')}</textarea>
            </div>
        `;
    })
    .join('');

  return `
        <div class="field-group">
            <span class="field-label">Análise por alternativa</span>
            <div id="editGabaritoAnalises" class="alts-list">${altsHtml}</div>
        </div>
    `;
}

export function _renderEditorCoerencia(coerencia) {
  return `
        <div class="field-group">
            <span class="field-label">Coerência (checagens internas)</span>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <label style="display:flex; gap:6px; align-items:center;">
                    <input id="editCoerenciaAltExiste" type="checkbox" ${(coerencia?.alternativa_correta_existe ?? coerencia?.alternativaCorretaExiste) ? 'checked' : ''} />
                    <span style="font-size:12px;">Alternativa correta existe</span>
                </label>
                <label style="display:flex; gap:6px; align-items:center;">
                    <input id="editCoerenciaTodasAnalise" type="checkbox" ${(coerencia?.tem_analise_para_todas ?? coerencia?.temAnaliseParaTodas) ? 'checked' : ''} />
                    <span style="font-size:12px;">Tem análise para todas</span>
                </label>
            </div>
            <textarea id="editCoerenciaObs" class="form-control" rows="3" placeholder="Observações de consistência">${safe((Array.isArray(coerencia?.observacoes) ? coerencia.observacoes : []).join('\n'))}</textarea>
        </div>
    `;
}

export function _renderEditorComplexidade(complexidadeRaw) {
  const cFatores = complexidadeRaw?.fatores || {};
  const chk = (key, label) => {
    const val = !!pick(
      cFatores[key],
      cFatores[key.replace(/_([a-z])/g, (_, x) => x.toUpperCase())],
      false
    );
    return `
            <label style="display:flex; gap:6px; align-items:center; margin-bottom:4px; cursor:pointer;">
                <input type="checkbox" class="chk-complexidade" data-key="${key}" ${val ? 'checked' : ''}>
                <span style="font-size:12px;">${label}</span>
            </label>`;
  };

  return `
        <div class="field-group" style="border:1px solid var(--color-border); padding:10px; border-radius:8px; background:rgba(0,0,0,0.02);">
            <span class="field-label" style="color:var(--color-primary); margin-bottom:8px; display:block;">Matriz de Complexidade</span>
            <div style="font-size:11px; color:gray; margin-bottom:10px;">Marque os fatores determinantes para a dificuldade.</div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
                <div>
                    <strong style="font-size:10px; text-transform:uppercase; color:gray; display:block; margin-bottom:4px;">Leitura</strong>
                    ${chk('texto_extenso', 'Texto Extenso')} ${chk('vocabulario_complexo', 'Vocabulário Denso')}
                    ${chk('multiplas_fontes_leitura', 'Múltiplas Fontes')} ${chk('interpretacao_visual', 'Interp. Visual')}
                    <strong style="font-size:10px; text-transform:uppercase; color:gray; display:block; margin-bottom:4px; margin-top:8px;">Conhecimento</strong>
                    ${chk('dependencia_conteudo_externo', 'Conteúdo Prévio')} ${chk('interdisciplinaridade', 'Interdisciplinar')}
                    ${chk('contexto_abstrato', 'Contexto Abstrato')}
                </div>
                <div>
                    <strong style="font-size:10px; text-transform:uppercase; color:gray; display:block; margin-bottom:4px;">Raciocínio</strong>
                    ${chk('raciocinio_contra_intuitivo', 'Contra-Intuitivo')} ${chk('abstracao_teorica', 'Teoria Pura')}
                    ${chk('deducao_logica', 'Dedução Lógica')}
                    <strong style="font-size:10px; text-transform:uppercase; color:gray; display:block; margin-bottom:4px; margin-top:8px;">Operacional</strong>
                    ${chk('resolucao_multiplas_etapas', 'Multi-etapas')} ${chk('transformacao_informacao', 'Transformação Info')}
                    ${chk('distratores_semanticos', 'Distratores Fortes')} ${chk('analise_nuance_julgamento', 'Julgamento')}
                </div>
            </div>
            <div style="margin-top:10px;">
                <span class="field-label">Justificativa da Dificuldade</span>
                <textarea id="editComplexidadeJust" class="form-control" rows="2" placeholder="Explique por que é difícil...">${safe(complexidadeRaw?.justificativa_dificuldade || '')}</textarea>
            </div>
        </div>
    `;
}

export function _renderEditorCreditos(creditos) {
  if (!creditos) creditos = {};
  return `
        <div class="field-group">
            <span class="field-label">Créditos / Fonte</span>
            <div style="display:flex; flex-wrap:wrap; gap:10px;">
                <div style="flex:1; min-width:160px;">
                    <span class="field-label">Origem da resolução</span>
                    <input id="editCredOrigem" class="form-control" type="text" value="${safe(creditos.origemresolucao || '')}" placeholder="extraidodomaterial / geradopelaia" />
                </div>
                <div style="flex:1; min-width:160px;">
                    <span class="field-label">Material</span>
                    <input id="editCredMaterial" class="form-control" type="text" value="${safe(creditos.material || '')}" placeholder="Ex.: FUVEST 2023" />
                </div>
                <div style="flex:1; min-width:160px;">
                    <span class="field-label">Autor/Instituição</span>
                    <input id="editCredAutor" class="form-control" type="text" value="${safe(creditos.autorouinstituicao || '')}" placeholder="Banca, escola, editora..." />
                </div>
                <div style="flex:0 0 100px;">
                    <span class="field-label">Ano</span>
                    <input id="editCredAno" class="form-control" type="text" value="${safe(creditos.ano || '')}" placeholder="2024" />
                </div>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:8px;">
                <div style="flex:0 0 140px;">
                    <span class="field-label">Mat. identificado?</span>
                    <label style="display:flex; gap:6px; align-items:center; margin-top:4px;">
                        <input id="editCredMatIdentificado" type="checkbox" ${creditos.materialidentificado ? 'checked' : ''} />
                        <span style="font-size:12px;">Sim</span>
                    </label>
                </div>
                <div style="flex:0 0 170px;">
                    <span class="field-label">Precisa crédito genérico?</span>
                    <label style="display:flex; gap:6px; align-items:center; margin-top:4px;">
                        <input id="editCredPrecisaGenerico" type="checkbox" ${creditos.precisacreditogenerico ? 'checked' : ''} />
                        <span style="font-size:12px;">Sim</span>
                    </label>
                </div>
                <div style="flex:1; min-width:160px;">
                    <span class="field-label">Confiança identificação (0–1)</span>
                    <input id="editCredConfId" class="form-control" type="number" min="0" max="1" step="0.01" value="${creditos.confiancaidentificacao ?? ''}" />
                </div>
            </div>
            <div style="margin-top:8px;">
                <span class="field-label">Como identificou</span>
                <textarea id="editCredComo" class="form-control" rows="2" placeholder="Cabeçalho, rodapé, diagramação...">${safe(creditos.comoidentificou || '')}</textarea>
            </div>
            <div style="margin-top:8px;">
                <span class="field-label">Crédito sugerido (texto)</span>
                <textarea id="editCredTextoSugerido" class="form-control" rows="2" placeholder="Texto pronto para mostrar como crédito.">${safe(creditos.textocreditosugerido || '')}</textarea>
            </div>
        </div>
    `;
}