import { renderizarEstruturaHTML } from '../render/structure.js';

export function gerarHtmlCorpoQuestao(q, imgsOriginalQ, htmlImgsSuporte) {
  let htmlFinal = '';

  // 1. Gera o corpo principal (Estruturado vs Legado)
  if (q.estrutura && Array.isArray(q.estrutura)) {
    htmlFinal = renderizarEstruturaHTML(q.estrutura, imgsOriginalQ, 'banco');
  } else {
    // Lógica de Fallback Legado
    const imgsHtml =
      imgsOriginalQ.length > 0
        ? imgsOriginalQ
            .map(
              (url) =>
                `<img src="${url}" class="structure-img" style="margin-bottom:10px;">`
            )
            .join('')
        : '';

    htmlFinal =
      imgsHtml +
      `<div class="structure-text">${(q.enunciado || '').replace(/\n/g, '<br>')}</div>`;
  }

  // 2. Adiciona Imagens de Suporte (se houver)
  if (htmlImgsSuporte) {
    htmlFinal += `<div style="margin-top:15px; border-top:1px dashed var(--color-border); padding-top:10px;"><small style="color:gray;">Figuras de Suporte:</small>${htmlImgsSuporte}</div>`;
  }

  return htmlFinal;
}

export function renderMatrizComplexidade(g) {
  if (!g.analise_complexidade?.fatores) return '';

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

  const fatores = g.analise_complexidade.fatores;
  let htmlGrid = '<div class="complexity-matrix">';

  for (const [key, label] of Object.entries(labels)) {
    // Verifica camelCase ou snake_case
    const isActive = !!(
      fatores[key] ||
      fatores[key.replace(/_([a-z])/g, (_, x) => x.toUpperCase())]
    );
    htmlGrid += `<div class="comp-factor ${isActive ? 'active' : ''}"><div class="comp-dot"></div><span>${label}</span></div>`;
  }
  htmlGrid += '</div>';

  if (g.analise_complexidade.justificativa_dificuldade) {
    const safeJust = String(
      g.analise_complexidade.justificativa_dificuldade
    ).replace(/"/g, '&quot;');
    htmlGrid += `<div class="markdown-content" data-raw="${safeJust}" style="margin-top:10px; font-style:italic; font-size:0.85rem; color:var(--color-text-secondary);">${g.analise_complexidade.justificativa_dificuldade}</div>`;
  }

  return `<div class="q-res-section"><span class="q-res-label">Matriz de Dificuldade</span>${htmlGrid}</div>`;
}

export function renderBotaoScanGabarito(imgsOriginalG, jsonImgsG) {
  if (!imgsOriginalG || imgsOriginalG.length === 0) return '';
  return `<button class="btn-view-scan js-ver-scan" data-imgs="${jsonImgsG}">
                📸 Ver Scan Original do Gabarito
            </button>`;
}

export function renderPassosComDetalhes(g) {
  if (!g.explicacao || g.explicacao.length === 0) return '';

  const htmlPassos = g.explicacao
    .map((p, i) => {
      const origemLabel = (p.origem || '').includes('extraido')
        ? '📄 Material Original'
        : '🤖 Gerado por IA';
      const origemCor = (p.origem || '').includes('extraido')
        ? 'var(--color-success)'
        : 'var(--color-primary)';
      const estrutura = Array.isArray(p.estrutura)
        ? p.estrutura
        : [{ tipo: 'texto', conteudo: p.passo || '' }];

      // Contexto 'banco' para renderização limpa
      const htmlConteudo = renderizarEstruturaHTML(estrutura, [], 'banco');

      return `
            <div class="q-step-wrapper">
                <div class="q-step-header">
                    <div class="q-step-bullet">${i + 1}</div>
                    <div class="step-content-wrapper" style="flex:1; min-width:0;">${htmlConteudo}</div>
                </div>
                <details class="q-step-details">
                    <summary>Metadados</summary>
                    <div class="q-step-meta-box">
                        <div class="q-step-row"><span class="q-step-key">Origem:</span><span style="color:${origemCor}; font-weight:bold;">${origemLabel}</span></div>
                        ${p.fontematerial ? `<div class="q-step-row"><span class="q-step-key">Fonte:</span><span>${p.fontematerial}</span></div>` : ''}
                    </div>
                </details>
            </div>`;
    })
    .join('');

  return `
    <div class="q-res-section">
        <span class="q-res-label">Resolução Detalhada</span>
        <div style="display:flex; flex-direction:column; gap:0;">
            ${htmlPassos}
        </div>
    </div>`;
}

export function renderCreditosCompleto(g) {
  if (!g.creditos) return '';
  const c = g.creditos;

  const inst =
    c.autorouinstituicao ||
    c.autor_ou_instituicao ||
    c.autorOuInstituicao ||
    '—';
  const mat = c.material || c.nomeMaterial || c.nome_material || '—';
  const confianca = c.confiancaidentificacao
    ? Math.round(c.confiancaidentificacao * 100) + '%'
    : '—';

  return `
        <div class="q-res-section">
            <span class="q-res-label">Metadados & Créditos</span>
            <table class="credits-table">
                <tr><td>Instituição</td><td>${inst}</td></tr>
                <tr><td>Material</td><td>${mat}</td></tr>
                <tr><td>Ano</td><td>${c.ano || '—'}</td></tr>
                <tr><td>Confiança</td><td>${confianca}</td></tr>
            </table>
        </div>`;
}