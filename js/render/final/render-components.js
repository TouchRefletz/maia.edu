import { customAlert } from '../../ui/alerts.js';
import { renderizarEstruturaHTML } from '../structure.js';
import { renderizar_estrutura_alternativa } from '../structure.js';
import { safe } from '../../normalize/primitives.js';

export const renderImgsLimpas = (lista, titulo) => {
  if (!lista || lista.length === 0) return '';
  return `
        <div class="field-group" style="margin-bottom:15px; border:1px solid var(--color-border); padding:10px; border-radius:8px;">
            <span class="field-label" style="display:block; margin-bottom:5px;">${titulo} (${lista.length})</span>
            <div class="img-final-gallery" style="display:flex; flex-wrap:wrap; gap:8px;">
                ${lista
                  .map(
                    (src) => `
                    <div style="width:60px; height:60px; border:1px solid var(--color-border); border-radius:4px; overflow:hidden; background:var(--color-surface);">
                        <img src="${src}" style="width:100%; height:100%; object-fit:cover;">
                    </div>
                `
                  )
                  .join('')}
            </div>
        </div>`;
};

export const renderComplexidadeVisual = (comp) => {
  if (!comp || !comp.fatores) return '';
  const labels = {
    texto_extenso: 'Texto Extenso',
    vocabulario_complexo: 'Vocabulário Denso',
    multiplas_fontes_leitura: 'Múltiplas Fontes',
    interpretacao_visual: 'Interp. Visual',
    dependencia_conteudo_externo: 'Conteúdo Prévio',
    interdisciplinaridade: 'Interdisciplinar',
    contexto_abstrato: 'Abstrato',
    raciocinio_contra_intuitivo: 'Contra-Intuitivo',
    abstracao_teorica: 'Teoria Pura',
    deducao_logica: 'Dedução Lógica',
    resolucao_multiplas_etapas: 'Multi-etapas',
    transformacao_informacao: 'Transformação Info',
    distratores_semanticos: 'Distratores Fortes',
    analise_nuance_julgamento: 'Julgamento Sutil',
  };
  let htmlItems = '';
  Object.entries(comp.fatores).forEach(([k, v]) => {
    const key = k.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (v === true && labels[key]) {
      htmlItems += `<span class="badge" style="background:var(--color-secondary); color:var(--color-text); font-size:10px; border:1px solid var(--color-border);">${labels[key]}</span>`;
    }
  });
  return `
        <div class="field-group" style="margin-top:15px; background:rgba(0,0,0,0.02); padding:10px; border-radius:8px;">
            <span class="field-label" style="color:var(--color-primary);">⚡ Análise de Complexidade</span>
            <div style="display:flex; flex-wrap:wrap; gap:5px; margin-top:5px; margin-bottom:8px;">
                ${htmlItems || '<span style="font-size:11px; color:gray;">Nenhum fator crítico marcado.</span>'}
            </div>
            ${comp.justificativa_dificuldade ? `<div class="markdown-content" data-raw="${safe(comp.justificativa_dificuldade)}" style="font-size:12px; font-style:italic; color:var(--color-text-secondary); margin-top:8px;">${safe(comp.justificativa_dificuldade)}</div>` : ''}
        </div>`;
};

export const renderCreditosTable = (c) => {
  if (!c) return '';
  return `
        <div class="field-group" style="margin-top:15px;">
            <span class="field-label">Créditos & Fonte</span>
            <table style="width:100%; font-size:12px; border-collapse:collapse; margin-top:5px;">
                <tr style="border-bottom:1px solid var(--color-border);"><td style="color:var(--color-text-secondary); padding:4px;">Instituição</td><td style="padding:4px;">${safe(c.autor_ou_instituicao || c.autorouinstituicao || '—')}</td></tr>
                <tr style="border-bottom:1px solid var(--color-border);"><td style="color:var(--color-text-secondary); padding:4px;">Material</td><td style="padding:4px;">${safe(c.material || '—')}</td></tr>
                <tr style="border-bottom:1px solid var(--color-border);"><td style="color:var(--color-text-secondary); padding:4px;">Ano</td><td style="padding:4px;">${safe(c.ano || '—')}</td></tr>
                <tr><td style="color:var(--color-text-secondary); padding:4px;">Origem</td><td style="padding:4px;">${c.origem_resolucao === 'extraido_do_material' ? '📄 Extraído' : '🤖 IA'}</td></tr>
            </table>
        </div>`;
};

export function prepararDadosGerais() {
  const q = window.__ultimaQuestaoExtraida;
  const g = window.__ultimoGabaritoExtraido;

  // 1. Validação (Lógica original de parar se faltar algo)
  if (!q || !g) {
    customAlert(
      '⚠️ Extração incompleta. Certifique-se de processar Questão e Gabarito.'
    );
    return null; // Retorna null para sinalizar que deve parar
  }

  // 2. Retorna um objeto com tudo pronto
  return {
    q,
    g,
    tituloMaterial:
      window.__viewerArgs?.rawTitle || 'Material Não Identificado',
    explicacaoArray: Array.isArray(g.explicacao) ? g.explicacao : [],
    imagensFinais: {
      q_original: window.__imagensLimpas?.questao_original || [],
      q_suporte: window.__imagensLimpas?.questao_suporte || [],
      g_original: window.__imagensLimpas?.gabarito_original || [],
      g_suporte: window.__imagensLimpas?.gabarito_suporte || [],
    },
  };
}

export function gerarHtmlListaAlternativas(alternativas) {
  return (alternativas || [])
    .map((alt) => {
      // Mantém a lógica de verificar se é estrutura ou texto simples
      const estrutura = Array.isArray(alt.estrutura)
        ? alt.estrutura
        : [{ tipo: 'texto', conteudo: alt.texto || '' }];

      const htmlAlt = renderizar_estrutura_alternativa(estrutura, alt.letra);

      return `
            <div class="alt-row" style="background:var(--color-background);">
                <span class="alt-letter">${safe(alt.letra)}</span>
                <div class="alt-content">${htmlAlt}</div>
            </div>`;
    })
    .join('');
}

export function montarHtmlPainelQuestao(q, tituloMaterial, imagensFinais) {
  // Renderiza a estrutura do enunciado
  const htmlEstruturaQuestao = renderizarEstruturaHTML(
    q.estrutura,
    imagensFinais.q_original,
    'final_view_q'
  );

  // Renderiza as alternativas usando a função auxiliar acima
  const htmlAlternativas = gerarHtmlListaAlternativas(q.alternativas);

  return `
        <div class="extraction-result" style="border:none; padding:0; background:transparent;">
            <div class="result-header" style="background:var(--color-bg-1); padding:10px; border-radius:8px; margin-bottom:15px; border:1px solid var(--color-primary);">
                <div>
                    <h3 style="color:var(--color-primary); margin:0; font-size:16px;">QUESTÃO</h3>
                    <div style="font-size:11px; color:var(--color-text-secondary); margin-top:2px;">Material: <strong>${safe(tituloMaterial)}</strong></div>
                </div>
                <span class="badge-success" style="font-size:12px;">ID: ${safe(q.identificacao)}</span>
            </div>
            
            ${renderImgsLimpas(imagensFinais.q_suporte, 'Imagens de Suporte (Questão)')}
            
            <div class="field-group">
                <span class="field-label">Enunciado</span>
                <div class="data-box scrollable" style="background:var(--color-background); border-color:var(--color-border); padding:15px;">
                    ${htmlEstruturaQuestao}
                </div>
            </div>
            
            <div style="gap:10px; margin-top:10px;">
                <div class="field-group">
                    <span class="field-label">Matérias</span>
                    <div class="data-box">${renderTags(q.materias_possiveis, 'tag-subject')}</div>
                </div>
            </div>
            
            <div class="field-group" style="margin-top:10px;">
                <span class="field-label">Palavras-Chave</span>
                <div class="tags-wrapper">${renderTags(q.palavras_chave, 'tag-keyword')}</div>
            </div>
            
            <div class="field-group" style="margin-top:15px;">
                <span class="field-label">Alternativas</span>
                <div class="alts-list">
                    ${htmlAlternativas}
                </div>
            </div>
        </div>
    `;
}

export function gerarHtmlPassosGabarito(explicacaoArray) {
  // Se não houver explicação, não renderiza nada
  if (!explicacaoArray || !explicacaoArray.length) return '';

  const htmlLista = explicacaoArray
    .map((p, idx) => {
      // Busca imagens específicas deste passo
      const imgsPasso = window.__imagensLimpas?.gabarito_passos?.[idx] || [];

      // Renderiza o conteúdo do passo
      const htmlPasso = renderizarEstruturaHTML(
        p.estrutura,
        imgsPasso,
        `final_view_gab_${idx}`
      );

      // Lógica do Badge (Extraído vs IA)
      const isExtraido = String(p.origem || '').includes('extraido');
      const badge = isExtraido
        ? `<span class="step-chip" style="border-color:var(--color-success); color:var(--color-success);">📄 Extraído</span>`
        : `<span class="step-chip" style="border-color:var(--color-primary); color:var(--color-primary);">🤖 IA</span>`;

      return `
            <li class="step-card">
                <div class="step-index">${idx + 1}</div>
                <div class="step-body">
                    <div class="step-content">${htmlPasso}</div>
                    <div class="step-meta" style="margin-top:8px; padding-top:6px; border-top:1px dashed var(--color-border);">
                        ${badge}
                        ${p.fontematerial ? `<span class="step-chip step-chip--muted">📚 ${safe(p.fontematerial)}</span>` : ''}
                    </div>
                </div>
            </li>`;
    })
    .join('');

  // Retorna o bloco completo com o título e a lista
  return `
        <div class="field-group" style="margin-top:15px;">
            <span class="field-label">Resolução Detalhada</span>
            <div class="gabarito-steps" style="overflow-y:auto; padding-right:5px;">
                <ol class="steps-list">
                    ${htmlLista}
                </ol>
            </div>
        </div>`;
}

export function montarHtmlPainelGabarito(g, imagensFinais, explicacaoArray) {
  const htmlPassos = gerarHtmlPassosGabarito(explicacaoArray);

  return `
        <div class="extraction-result" style="border:none; padding:0; background:transparent;">
            <div class="result-header" style="background:var(--color-bg-2); padding:10px; border-radius:8px; margin-bottom:15px; border:1px solid var(--color-warning);">
                <div>
                    <h3 style="color:var(--color-warning); margin:0; font-size:16px;">GABARITO</h3>
                    <div style="font-size:11px; color:var(--color-text-secondary); margin-top:2px;">
                        Confiança IA: <strong>${Math.round((g.confianca || 0) * 100)}%</strong>
                    </div>
                </div>
                <span class="badge" style="background:var(--color-success); color:white; font-size:14px; padding:4px 10px;">
                    LETRA ${safe(g.alternativa_correta)}
                </span>
            </div>
            
            ${renderImgsLimpas(imagensFinais.g_suporte, 'Imagens de Suporte (Gabarito)')}
            
            <div class="field-group">
                <span class="field-label">Resumo / Justificativa</span>
                <div class="data-box markdown-content" style="background:var(--color-background); font-size:13px;">
                    ${safe(g.justificativa_curta)}
                </div>
            </div>
            
            ${renderComplexidadeVisual(g.analise_complexidade)}
            
            ${htmlPassos}
            
            ${renderCreditosTable(g.creditos)}
        </div>
    `;
}

export const renderTags = (l, c) =>
  !l || l.length === 0
    ? '<span style="font-size:11px; color:gray; opacity:0.7;">—</span>'
    : l.map((i) => `<span class="data-tag ${c}">${safe(i)}</span>`).join('');