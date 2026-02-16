import { FATORES_DEF, CFG } from "../utils/complexity-data.js";
import { _calcularComplexidade } from "../render/ComplexityCard.tsx";

export function gerarHtmlCorpoQuestao(q, imgsOriginalQ, htmlImgsSuporte) {
  let htmlFinal = "";

  // 1. Gera o corpo principal (React Hydration Target para Estrutura)
  if (q.estrutura && Array.isArray(q.estrutura)) {
    // Retornamos apenas o container para hidratação React
    htmlFinal = `<div class="js-react-q-body" style="min-height: 50px;"></div>`;
  } else {
    // Lógica de Fallback Legado (Texto Simples / Imagens à moda antiga)
    const imgsHtml =
      imgsOriginalQ.length > 0
        ? imgsOriginalQ
            .map(
              (url) =>
                `<img src="${url}" class="structure-img" style="margin-bottom:10px;">`,
            )
            .join("")
        : "";

    htmlFinal =
      imgsHtml +
      `<div class="structure-text">${(q.enunciado || "").replace(/\n/g, "<br>")}</div>`;
  }

  // 2. Adiciona Imagens de Suporte (se houver)
  if (htmlImgsSuporte) {
    htmlFinal += `<div style="margin-top:15px; border-top:1px dashed var(--color-border); padding-top:10px;"><small style="color:gray;">Figuras de Suporte:</small>${htmlImgsSuporte}</div>`;
  }

  return htmlFinal;
}

export function renderMatrizComplexidade(g) {
  const calc = _calcularComplexidade(g.analise_complexidade);
  if (!calc) return "";

  const { pct, nivel, grupos } = calc;

  // Header com badge e barra de progresso
  const htmlHeader = `
    <div class="comp-header">
      <div class="comp-badge" style="color:${nivel.cor}; border-color:${nivel.cor};">
        ${nivel.texto} — ${pct}%
      </div>
      <div class="comp-bar-track">
        <div class="comp-bar-fill" style="width:${pct}%; background:${nivel.cor};"></div>
      </div>
    </div>`;

  // Grid de fatores agrupado por categoria
  let htmlGrid = '<div class="complexity-matrix">';
  for (const [catKey, catCfg] of Object.entries(CFG)) {
    const itens = grupos[catKey] || [];
    htmlGrid += `<div class="comp-cat-group">`;
    htmlGrid += `<div class="comp-cat-label" style="color:${catCfg.color};">${catCfg.label}</div>`;
    for (const item of itens) {
      htmlGrid += `<div class="comp-factor ${item.ativo ? "active" : ""}"><div class="comp-dot" style="${item.ativo ? `background:${catCfg.color}; box-shadow:0 0 5px ${catCfg.color};` : ""}"></div><span>${item.label}</span></div>`;
    }
    htmlGrid += `</div>`;
  }
  htmlGrid += "</div>";

  // Justificativa da IA
  let htmlJust = "";
  if (g.analise_complexidade.justificativa_dificuldade) {
    const safeJust = String(
      g.analise_complexidade.justificativa_dificuldade,
    ).replace(/"/g, "&quot;");
    htmlJust = `<div class="markdown-content" data-raw="${safeJust}" style="margin-top:10px; font-style:italic; font-size:0.85rem; color:var(--color-text-secondary);">${g.analise_complexidade.justificativa_dificuldade}</div>`;
  }

  return `<div class="q-res-section static-render-target"><span class="q-res-label">Matriz de Dificuldade</span>${htmlHeader}${htmlGrid}${htmlJust}</div>`;
}

export function renderBotaoScanGabarito(imgsOriginalG, jsonImgsG) {
  if (!imgsOriginalG || imgsOriginalG.length === 0) return "";
  return `<button class="btn-view-scan js-ver-scan" data-imgs="${jsonImgsG}">
                📸 Ver Scan Original do Gabarito
            </button>`;
}

export function renderPassosComDetalhes(g) {
  if (!g.explicacao || g.explicacao.length === 0) return "";

  const htmlPassos = g.explicacao
    .map((p, i) => {
      const origemLabel = (p.origem || "").includes("extraido")
        ? "📄 Material Original"
        : "🤖 Gerado por IA";
      const origemCor = (p.origem || "").includes("extraido")
        ? "var(--color-success)"
        : "var(--color-primary)";
      const estrutura = Array.isArray(p.estrutura)
        ? p.estrutura
        : [{ tipo: "texto", conteudo: p.passo || "" }];

      // Contexto 'banco' para renderização limpa
      // Mudança: Container para React Hydration
      const htmlConteudo = `<div class="js-react-step-${i}" style="min-height:20px;"></div>`;

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
                        ${p.fontematerial ? `<div class="q-step-row"><span class="q-step-key">Fonte:</span><span>${p.fontematerial}</span></div>` : ""}
                    </div>
                </details>
            </div>`;
    })
    .join("");

  return `
    <div class="q-res-section">
        <span class="q-res-label">Resolução Detalhada</span>
        <div style="display:flex; flex-direction:column; gap:0;">
            ${htmlPassos}
        </div>
    </div>`;
}

export function renderCreditosCompleto(g) {
  if (!g.creditos) return "";
  const c = g.creditos;

  const inst =
    c.autorouinstituicao ||
    c.autor_ou_instituicao ||
    c.autorOuInstituicao ||
    "—";
  const mat = c.material || c.nomeMaterial || c.nome_material || "—";
  const confianca = c.confiancaidentificacao
    ? Math.round(c.confiancaidentificacao * 100) + "%"
    : "—";

  return `
        <div class="q-res-section">
            <span class="q-res-label">Metadados & Créditos</span>
            <table class="credits-table">
                <tr><td>Instituição</td><td>${inst}</td></tr>
                <tr><td>Material</td><td>${mat}</td></tr>
                <tr><td>Ano</td><td>${c.ano || "—"}</td></tr>
                <tr><td>Confiança</td><td>${confianca}</td></tr>
            </table>
        </div>`;
}

// --- NOVAS FUNÇÕES PARA O USER_REQUEST ---

export function renderRelatorioPesquisa(g) {
  if (!g.texto_referencia) return "";

  // Escapa aspas para não quebrar o atributo data-raw
  const safeText = String(g.texto_referencia).replace(/"/g, "&quot;");

  return `
  <div class="q-res-section static-render-target" style="border:1px solid var(--color-border); border-radius:6px; overflow:hidden; margin-bottom:10px;">
    <details>
      <summary style="padding:10px; background:var(--color-bg-2); cursor:pointer; font-weight:600; font-size:0.9rem;">
        📄 Relatório Técnico da Pesquisa
      </summary>
      <div 
         class="markdown-content relatorio-content" 
         data-raw="${safeText}" 
         style="padding:15px; max-height:300px; overflow-y:auto; background:var(--color-background); border-top:1px solid var(--color-border);">
         ${g.texto_referencia}
      </div>
    </details>
  </div>`;
}

export function renderFontesExternas(g) {
  if (!g.fontes_externas || g.fontes_externas.length === 0) return "";

  const lis = g.fontes_externas
    .map(
      (f) => `
    <li>
      <a href="${f.uri}" target="_blank" rel="noopener noreferrer" style="color:var(--color-primary); text-decoration:none; font-size:0.85rem;">
        ${f.title || f.uri} ↗
      </a>
    </li>
  `,
    )
    .join("");

  return `
  <div class="q-res-section">
      <span class="q-res-label">📚 Fontes Externas</span>
      <ul style="list-style:none; padding:0; margin:5px 0 0 0; display:flex; flex-direction:column; gap:6px;">
        ${lis}
      </ul>
  </div>`;
}
