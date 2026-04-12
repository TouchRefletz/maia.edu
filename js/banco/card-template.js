import { renderizar_estrutura_alternativa } from "../render/structure.js";
import { hydrateBankCard } from "./bank-hydration";
import { _calcularComplexidade } from "../render/ComplexityCard.tsx";
import {
  gerarHtmlCorpoQuestao,
  renderBotaoScanGabarito,
  renderCreditosCompleto,
  renderFontesExternas,
  renderMatrizComplexidade,
  renderPassosComDetalhes,
  renderRelatorioPesquisa,
} from "./card-partes.js";
import { prepararImagensVisualizacao } from "./imagens.js";

export function prepararElementoCard(idFirebase, q, g, meta) {
  // 1. Criação do elemento DOM
  const card = document.createElement("div");
  card.className = "q-card";
  card.id = `card_${idFirebase}`;

  // 2. Configuração dos Datasets (Para Filtros)
  card.dataset.materia = (q.materias_possiveis || []).join(" ");
  card.dataset.origem = meta.material_origem || "";

  // Concatena texto da estrutura ou do enunciado legado para busca
  const textoBusca = q.estrutura
    ? q.estrutura.map((b) => b.conteudo).join(" ")
    : q.enunciado || "";

  card.dataset.texto = (
    textoBusca +
    " " +
    (q.identificacao || "")
  ).toLowerCase();

  // 3. Geração do HTML das Alternativas
  const cardId = `q_${idFirebase}`;

  // Monta mapa de motivos por letra a partir de alternativas_analisadas
  const motivoMap = {};
  (g.alternativas_analisadas || []).forEach((aa) => {
    const letraKey = String(aa.letra || "")
      .trim()
      .toUpperCase();
    if (letraKey && aa.motivo) motivoMap[letraKey] = aa.motivo;
  });

  const isDissertativa = q.tipo_resposta === "dissertativa" || !q.alternativas || q.alternativas.length === 0;

  let htmlAlts = "";

  if (isDissertativa) {
    htmlAlts = `
      <div class="q-dissert-container">
        <textarea 
          class="q-dissert-input" 
          placeholder="Esboce ou rascunhe sua resposta dissertativa aqui para compará-la ao final..." 
          rows="4"
        ></textarea>
        
        <div class="q-dissert-actions">
          <button 
              class="q-dissert-btn q-dissert-btn-simple js-check-dissert-embedding" 
              data-card-id="${cardId}" 
              title="Correção rápida baseada na presença das palavras-chave esperadas"
          >
              <span class="btn-icon">🔑</span> Corrigir Simples (Palavras-Chave)
          </button>
          <button 
              class="q-dissert-btn q-dissert-btn-ai js-check-dissert-ai" 
              data-card-id="${cardId}" 
              title="Correção detalhada usando Inteligência Artificial (Gemini)"
          >
              <span class="btn-icon">🤖</span> Corrigir Completo (com IA)
          </button>
        </div>

        <!-- Reservatório para o feedback de avaliação -->
        <div id="${cardId}_feedback" class="q-dissert-feedback" style="display: none;"></div>
      </div>`;
  } else {
    htmlAlts = (q.alternativas || [])
      .map((alt) => {
        const letra = alt.letra.trim().toUpperCase();
        let conteudoHtml = "";

        if (alt.estrutura) {
          // MUDANÇA: Passa 'banco' como contexto para desabilitar edição
          // Assume que renderizar_estrutura_alternativa está no escopo global
          conteudoHtml = renderizar_estrutura_alternativa(
            alt.estrutura,
            letra,
            [],
            "banco",
          );
        } else {
          conteudoHtml = alt.texto || "";
        }

        // Escapa o motivo para uso seguro no atributo data
        const motivoRaw = motivoMap[letra] || "";
        const motivoEscapado = motivoRaw
          .replace(/"/g, "&quot;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

        // Gera o botão interativo
        return `
          <button 
              class="q-opt-btn js-verificar-resp" 
              data-card-id="${cardId}" 
              data-letra="${letra}" 
              data-correta="${g.alternativa_correta}"
              data-motivo="${motivoEscapado}"
          >
              <span class="q-opt-letter">${letra})</span>
              <div class="q-opt-content">${conteudoHtml}</div>
              <div class="q-opt-motivo" style="display:none;"></div>
          </button>`;
      })
      .join("");
  }

  return { card, htmlAlts, cardId };
}

/**
 * Gera o cabeçalho do card com ID e origem.
 */
/**
 * Gera o cabeçalho do card com ID, origem, instituição e status.
 */
export function gerarHtmlHeader(id, fullData) {
  const meta = fullData.meta || {};
  const q = fullData.dados_questao || {};
  const g = fullData.dados_gabarito || {};
  const cred = g.creditos || {};

  // 1. Origem (IA vs Original)
  let origemLabel = "Material Original";
  let origemIcon = "📄";
  const origemRaw = (
    cred.origemresolucao ||
    cred.origem_resolucao ||
    ""
  ).toLowerCase();

  if (
    origemRaw.includes("gerado") ||
    origemRaw.includes("artificial") ||
    origemRaw === "ia"
  ) {
    origemLabel = "Gerada com IA";
    origemIcon = "🤖";
  }

  // 2. Instituição e Prova
  const instituicao =
    cred.autorouinstituicao || cred.autor_ou_instituicao || "";
  const prova = meta.material_origem || "Banco Geral";

  // Monta label composto: "Instituição - Prova" ou só "Prova"
  let tituloPrincipal = prova;
  if (instituicao && !prova.includes(instituicao)) {
    tituloPrincipal = `${prova} - ${instituicao}`;
  }

  // 3. Status
  const statusRaw = (fullData.reviewStatus || "não revisada").toLowerCase();
  const statusMap = {
    "não revisada": { label: "Não Revisada", color: "#6c757d", icon: "⚪" },
    revisada: { label: "Revisada", color: "#28a745", icon: "🟢" },
    verificada: { label: "Verificada", color: "#17a2b8", icon: "🔵" },
    sinalizada: { label: "Sinalizada", color: "#ffc107", icon: "🟡" },
    invalidada: { label: "Invalidada", color: "#dc3545", icon: "🔴" },
  };
  const statusInfo = statusMap[statusRaw] || statusMap["não revisada"];

  // 4. Dificuldade (badge compacto)
  let diffBadgeHtml = "";
  const calc = _calcularComplexidade(g.analise_complexidade);
  if (calc) {
    // Mapeia nível para hex concreto (var() não funciona com sufixo de opacidade)
    const diffColorMap = {
      FÁCIL: { hex: "#28a745", icon: "🟢" },
      MÉDIA: { hex: "#ffc107", icon: "🟡" },
      DIFÍCIL: { hex: "#fd7e14", icon: "🟠" },
      DESAFIO: { hex: "#dc3545", icon: "🔴" },
    };
    const dc = diffColorMap[calc.nivel.texto] || diffColorMap["MÉDIA"];
    diffBadgeHtml = `
                    <!-- Badge Dificuldade -->
                    <span style="
                        background: ${dc.hex}20;
                        color: ${dc.hex};
                        border: 1px solid ${dc.hex}40;
                        padding: 3px 8px;
                        border-radius: 4px;
                        display:flex; align-items:center; gap:5px; font-weight:600;
                    ">
                        <span>${dc.icon}</span> ${calc.nivel.texto}
                    </span>`;
  }

  return `
        <div class="q-header">
            <div style="display:flex; align-items:center; gap:15px; flex-wrap:wrap;">
                
                <!-- ID Badge -->
                <span class="q-id-badge">${id}</span>
                
                <!-- Título (Inst e Prova) -->
                <span style="font-weight:bold; color:var(--color-text); font-size:0.95rem;">
                    ${tituloPrincipal}
                </span>

                <div style="flex:1;"></div>

                <!-- Badges de Metadados -->
                <div style="display:flex; gap:8px; align-items:center; font-size:0.8rem;">
                    
                    <!-- Badge Origem -->
                    <span style="
                        background: rgba(255,255,255,0.05); 
                        padding: 3px 8px; 
                        border-radius: 4px; 
                        border: 1px solid var(--color-border);
                        color: var(--color-text-secondary);
                        display:flex; align-items:center; gap:5px;
                    ">
                        <span>${origemIcon}</span> ${origemLabel}
                    </span>

                    ${diffBadgeHtml}

                    <!-- Badge Status -->
                    <span style="
                        background: ${statusInfo.color}20; 
                        color: ${statusInfo.color};
                        border: 1px solid ${statusInfo.color}40;
                        padding: 3px 8px; 
                        border-radius: 4px;
                        display:flex; align-items:center; gap:5px; font-weight:600;
                    ">
                        <span>${statusInfo.icon}</span> ${statusInfo.label}
                    </span>
                </div>

            </div>
        </div>`;
}

/**
 * Gera a seção de tags (matérias e palavras-chave).
 */
export function gerarHtmlTags(questao, cardId = "card_unknown") {
  const materias = (questao.materias_possiveis || [])
    .map((m) => `<span class="q-tag highlight">${m}</span>`)
    .join("");

  const isDissertativa = questao.tipo_resposta === "dissertativa" || !questao.alternativas || questao.alternativas.length === 0;
  const rawKeywords = questao.palavras_chave || [];
  
  let keywordsHtml = "";

  if (rawKeywords.length > 0) {
    if (isDissertativa) {
        const keywordsBody = rawKeywords.map((t) => `<span class="q-tag">${t}</span>`).join("");
        keywordsHtml = `
            <div style="display: inline-flex; align-items: center; gap: 8px;">
                <button class="q-tag js-toggle-kw-dissert" data-card-id="${cardId}" style="cursor: pointer; border: 1px dashed var(--color-border); background: transparent; font-weight: bold;" title="Mostrar palavras-chave">
                    👁️ Mostrar Palavras-Chave
                </button>
                <div id="${cardId}_keywords" style="display: none; align-items: center; gap: 8px;">
                    ${keywordsBody}
                </div>
            </div>
        `;
    } else {
        keywordsHtml = rawKeywords.map((t) => `<span class="q-tag">${t}</span>`).join("");
    }
  }

  return `
        <div class="q-tags">
            ${materias}
            ${keywordsHtml}
        </div>`;
}

/**
 * Gera o bloco de resolução (gabarito, justificativa, passos, etc) que inicia oculto.
 */
export function gerarHtmlResolucao(cardId, gabarito, rawImgsG, jsonImgsG) {
  const confianca = Math.round((gabarito.confianca || 0) * 100);
  const justificativa = gabarito.justificativa_curta || "Sem justificativa.";

  return `
        <div id="${cardId}_res" class="q-resolution" style="display:none;">
            <div class="q-res-header">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="q-res-badge">Gabarito: ${gabarito.alternativa_correta || "Dissertativa"}</span>
                    <span style="font-size:0.8rem; color:var(--color-text-secondary);">
                        Confiança IA: ${confianca}%
                    </span>
                </div>
            </div>
            
          ${(() => {
              const resModeloRaw = gabarito.resposta_modelo || gabarito.respostaModelo;
              if (!resModeloRaw) return "";
              
              let padronizado = String(resModeloRaw)
                .replace(/```[a-zA-Z]*\n?/g, '')
                .replace(/```/g, '');
              padronizado = padronizado.split('\n').map(l => l.trimStart()).join('\n').trim();

              const safeDataRaw = padronizado
                .replace(/"/g, "&quot;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");

              return `
                <div class="q-res-section static-render-target">
                    <span class="q-res-label">Resposta Modelo Esperada</span>
                    <div class="markdown-content" data-raw="${safeDataRaw}" style="margin:0; line-height:1.5; padding: 10px; background: rgba(34,197,94,0.05); border-left: 3px solid var(--color-success); border-radius: 4px;">
                    </div>
                </div>
              `;
            })()}

            <div class="q-res-section static-render-target">
                <span class="q-res-label">Justificativa Base</span>
                <p class="markdown-content" style="margin:0; line-height:1.5;">${justificativa}</p>
            </div>
            
            ${renderRelatorioPesquisa(gabarito)}
            ${renderFontesExternas(gabarito)}

            ${renderPassosComDetalhes(gabarito)}
            ${renderMatrizComplexidade(gabarito)}
            ${renderBotaoScanGabarito(rawImgsG, jsonImgsG)}
            ${renderCreditosCompleto(gabarito)}
        </div>`;
}

/**
 * Gera o rodapé com botões de ação (Ver Original, Ver Gabarito).
 */
export function gerarHtmlFooter(cardId, imgsOriginalQ, jsonImgsQ, sourceUrl) {
  const btnScan =
    imgsOriginalQ.length > 0
      ? `<button class="q-action-link js-ver-scan" data-imgs="${jsonImgsQ}">📄 Ver Original (Enunciado)</button>`
      : "";

  const btnSource = sourceUrl
    ? `<button onclick="window.open('${sourceUrl}', '_blank')" class="q-action-link" title="Abrir Prova Original">🔗 Ver Fonte Original</button>`
    : "";

  return `
        <div class="q-footer">
            ${btnScan}
            ${btnSource}
            <button class="q-action-link js-toggle-gabarito" data-card-id="${cardId}" title="Ver/Esconder Gabarito">
                👁️ Ver/Esconder Gabarito
            </button>
        </div>`;
}

/**
 * Função principal que orquestra a criação do card técnico.
 */
export function criarCardTecnico(idFirebase, fullData) {
  // Desestrutura os dados necessários
  const q = fullData.dados_questao || {};
  const g = fullData.dados_gabarito || {};
  const meta = fullData.meta || {};

  // 1. Prepara imagens e suporte visual
  const {
    jsonImgsQ,
    jsonImgsG,
    htmlImgsSuporte,
    rawImgsQ: imgsOriginalQ,
    rawImgsG,
  } = prepararImagensVisualizacao(fullData);

  // 2. Prepara o conteúdo do corpo da questão
  const htmlCorpoQuestao = gerarHtmlCorpoQuestao(
    q,
    imgsOriginalQ,
    htmlImgsSuporte,
  );

  // 3. Cria o elemento base do card e gera o HTML das alternativas
  // Nota: Assumo que 'prepararElementoCard' já cria o div container e gera o ID único
  const { card, htmlAlts, cardId } = prepararElementoCard(
    idFirebase,
    q,
    g,
    meta,
  );

  // 4. Monta o HTML final juntando as partes modularizadas
  // ALTERADO: Passa fullData para gerarHtmlHeader
  card.innerHTML = [
    gerarHtmlHeader(idFirebase, fullData),
    gerarHtmlTags(q, cardId),
    `<div class="q-body">${htmlCorpoQuestao}</div>`,
    `<div class="q-options" id="${cardId}_opts">${htmlAlts}</div>`,
    gerarHtmlResolucao(cardId, g, rawImgsG, jsonImgsG),
    gerarHtmlFooter(cardId, imgsOriginalQ, jsonImgsQ, meta.source_url),
  ].join("");

  // 5. Hidratação dos componentes React (Questão e Passos)
  hydrateBankCard(card, {
    q,
    g,
    imgsOriginalQ,
    jsonImgsG,
  });

  return card;
}
