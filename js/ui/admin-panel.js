import { ref, remove, get, set, update } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { db, auth } from "../main.js";
import { clearAllPineconeVectors, deletePineconeRecordWorker } from "../api/worker.js";
import { customAlert } from "./GlobalAlertsLogic.tsx";
import { gerarTelaInicial } from "../app/telas.js";
import { sanitizarID } from "../ia/envio-textos.js";

/**
 * Cache local de provas -> array de IDs de questões
 * { "ENEM_2023": ["Q_01", "Q_02"], ... }
 */
let cacheProvasQuestoes = {};

/**
 * Helper para escapar HTML e prevenir XSS e falhas de formatação
 */
function escapeHtml(str) {
  if (typeof str !== "string") return String(str || "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Sanitiza strings para uso seguro em caminhos do Firebase Realtime Database
 * (Remove caracteres proibidilíssimos: ., #, $, /, [, ])
 */
function sanitizarKeyFirebase(key) {
  if (!key) return "";
  return key.trim().replace(/[.#$/[\]]/g, "_");
}

/**
 * Normaliza e valida um JSON de Apêndice B para salvamento no Firebase
 */
export function normalizarJsonApendiceB(parsedJson) {
  if (!parsedJson || (typeof parsedJson !== "object" && typeof parsedJson !== "string")) {
    throw new Error("O conteúdo fornecido não é um objeto ou JSON válido.");
  }

  if (typeof parsedJson === "string") {
    let clean = parsedJson.trim();
    if (clean.startsWith("```")) {
      clean = clean.replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```$/, "").trim();
    }
    parsedJson = JSON.parse(clean);
  }

  if (Array.isArray(parsedJson)) {
    if (parsedJson.length > 0) {
      return normalizarJsonApendiceB(parsedJson[0]);
    } else {
      throw new Error("O JSON fornecido é uma lista vazia.");
    }
  }

  let finalObj = {};

  if (parsedJson.response_text && typeof parsedJson.response_text === "object") {
    finalObj = { ...parsedJson };
  } else if (parsedJson.pontuacao_final_complexidade || parsedJson.criterios || parsedJson.classificacao_dificuldade) {
    finalObj = {
      timestamp: parsedJson.timestamp || Date.now(),
      latency_sec: parsedJson.latency_sec || 0,
      response_text: parsedJson
    };
  } else if (parsedJson.data && typeof parsedJson.data === "object") {
    return normalizarJsonApendiceB(parsedJson.data);
  } else {
    finalObj = {
      timestamp: Date.now(),
      latency_sec: 0,
      response_text: parsedJson
    };
  }

  if (!finalObj.timestamp) finalObj.timestamp = Date.now();

  const resp = finalObj.response_text || {};
  const pontuacao = resp.pontuacao_final_complexidade ?? resp.pontuacao ?? null;
  const classificacao = resp.classificacao_dificuldade ?? resp.classificacao ?? "Importado";

  const statusData = {
    status: "rodado",
    timestamp: finalObj.timestamp,
    pontuacao: pontuacao,
    classificacao: classificacao,
    origem: "importado_manual"
  };

  return { finalObj, statusData };
}

/**
 * Lê um arquivo .json usando FileReader e retorna a Promise com o JSON parseado
 */
export function lerArquivoJson(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("Nenhum arquivo fornecido."));
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        resolve(json);
      } catch (err) {
        reject(new Error("O arquivo selecionado não contém um JSON válido: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo selecionado."));
    reader.readAsText(file);
  });
}

/**
 * Verifica se o usuário logado possui a role admin no banco de dados.
 */
export async function verificarSeAdmin(uid) {
  if (!uid) return false;
  try {
    const adminRef = ref(db, `admins/${uid}`);
    const snapshot = await get(adminRef);
    return snapshot.exists() && snapshot.val() === true;
  } catch (error) {
    console.error("Erro ao verificar role admin:", error);
    return false;
  }
}

/**
 * Inicializa a tela do Painel do Administrador.
 */
export async function iniciarModoAdmin() {
  const user = auth.currentUser;
  if (!user) {
    customAlert("⚠️ Faça login primeiro.");
    gerarTelaInicial();
    return;
  }

  // Feedback de carregamento
  document.body.innerHTML = `
    <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; background:var(--color-bg); color:var(--color-text);">
      <div class="admin-spinner" style="width: 40px; height: 40px; border-width: 4px;"></div>
      <p style="margin-top:15px; font-weight:500;">Verificando permissões de administrador...</p>
    </div>
  `;

  const isAdmin = await verificarSeAdmin(user.uid);
  if (!isAdmin) {
    customAlert("⛔ Acesso negado: Você não possui privilégios de administrador.");
    gerarTelaInicial();
    return;
  }

  // Renderiza layout do Painel do Administrador com Navegação por Abas
  document.body.innerHTML = `
    <div class="admin-layout-wrapper">
      <div class="admin-panel">
        <div class="admin-header">
          <h1>🛠️ Painel do Administrador</h1>
          <button class="btn btn--sm btn--outline js-voltar-inicio">← Voltar</button>
        </div>

        <!-- Navegação de Abas -->
        <div class="admin-tabs">
          <button class="admin-tab-btn active" data-tab="tab-deletar-unica">
            <span>🎯</span> Excluir Questão Específica
          </button>
          <button class="admin-tab-btn" data-tab="tab-vincular-apendice">
            <span>🧪</span> Vincular JSON Apêndice B
          </button>
          <button class="admin-tab-btn" data-tab="tab-limpeza-massa">
            <span>📦</span> Limpeza em Massa (Tudo)
          </button>
          <button class="admin-tab-btn" data-tab="tab-auditoria">
            <span>🔍</span> Auditoria & Correção
          </button>
          <button class="admin-tab-btn" data-tab="tab-restaurar-link">
            <span>🔗</span> Link Prova Original (PDF)
          </button>
        </div>

        <!-- CONTEÚDO DA ABA 1: EXCLUIR QUESTÃO ESPECÍFICA -->
        <div id="tab-deletar-unica" class="admin-tab-content active">
          <div class="admin-section">
            <h2>🎯 Deletar Questão Específica</h2>
            <p class="admin-desc">Exclua cirurgicamente uma questão individual sem afetar as demais. Esta ação remove a questão no Firebase Realtime Database, apaga seu histórico de revisões e deleta seu vetor semântico no Pinecone.</p>

            <div style="display:flex; flex-direction:column; gap:16px; margin-bottom:20px;">
              
              <!-- Modo 1: Seleção por Dropdown -->
              <div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 8px; border: 1px solid var(--color-border);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                  <h3 style="margin:0; font-size:1rem; display:flex; align-items:center; gap:8px;">
                    <span>📋</span> Selecionar do Banco de Dados
                  </h3>
                  <button class="btn btn--sm btn--outline js-btn-recarregar-lista" style="font-size:0.8rem; padding:4px 10px;">🔄 Recarregar Banco</button>
                </div>
                
                <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
                  <div style="flex:1; min-width:220px;">
                    <label style="display:block; font-size:0.85rem; font-weight:bold; margin-bottom:6px;">1. Prova / Material:</label>
                    <select id="selectProvaAdmin" class="apendice-select" style="width:100%;">
                      <option value="">-- Carregando provas... --</option>
                    </select>
                  </div>
                  
                  <div style="flex:1; min-width:220px;">
                    <label style="display:block; font-size:0.85rem; font-weight:bold; margin-bottom:6px;">2. Questão:</label>
                    <select id="selectQuestaoAdmin" class="apendice-select" style="width:100%;" disabled>
                      <option value="">-- Selecione uma prova primeiro --</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Modo 2: Entrada Manual -->
              <div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 8px; border: 1px solid var(--color-border);">
                <h3 style="margin-top:0; margin-bottom:12px; font-size:1rem; display:flex; align-items:center; gap:8px;">
                  <span>✏️</span> Ou Informe os IDs Manualmente
                </h3>
                <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end;">
                  <div style="flex:1; min-width:180px;">
                    <label style="display:block; font-size:0.85rem; font-weight:bold; margin-bottom:6px;">Chave da Prova (provaKey):</label>
                    <input type="text" id="inputManualProva" class="admin-input-confirm" style="max-width:100%; margin-bottom:0;" placeholder="Ex: ENEM_2023" />
                  </div>
                  <div style="flex:1; min-width:180px;">
                    <label style="display:block; font-size:0.85rem; font-weight:bold; margin-bottom:6px;">ID da Questão (questaoKey):</label>
                    <input type="text" id="inputManualQuestao" class="admin-input-confirm" style="max-width:100%; margin-bottom:0;" placeholder="Ex: QUESTÃO_01" />
                  </div>
                  <div>
                    <button id="btnVerificarManual" class="btn btn--secondary" style="padding:10px 16px;">🔍 Carregar Questão</button>
                  </div>
                </div>
              </div>

            </div>

            <!-- Preview Card da Questão -->
            <div id="containerPreviewQuestao" style="display:none; margin-bottom:20px; background: rgba(56, 189, 248, 0.05); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; padding: 16px;">
              <h3 style="margin-top:0; color:#38bdf8; font-size:1.1rem; display:flex; align-items:center; gap:8px;">
                <span>ℹ️</span> Detalhes da Questão Selecionada
              </h3>
              <div id="conteudoPreviewQuestao" style="font-size:0.9rem; line-height:1.6; color:var(--color-text);">
              </div>
            </div>

            <!-- Botão de Exclusão Única -->
            <div class="admin-actions" style="margin-top:20px;">
              <button id="btnDeletarQuestaoUnica" class="btn btn--danger" style="background:var(--color-error, #ff4444); color:white; border:none; padding:12px 24px; font-weight:bold;" disabled>
                🗑️ Excluir Esta Questão Específica
              </button>
            </div>
          </div>
        </div>

        <!-- CONTEÚDO DA ABA 2: VINCULAR JSON APÊNDICE B -->
        <div id="tab-vincular-apendice" class="admin-tab-content">
          <div class="admin-section">
            <h2>🧪 Vincular JSON do Apêndice B a uma Questão</h2>
            <p class="admin-desc">Importe um arquivo .json de Apêndice B previamente gerado ou cole o texto JSON diretamente para associá-lo a uma questão sem precisar re-executar a inteligência artificial.</p>

            <div style="display:flex; flex-direction:column; gap:16px; margin-bottom:20px;">
              
              <!-- Seleção da Questão Target -->
              <div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 8px; border: 1px solid var(--color-border);">
                <h3 style="margin-top:0; margin-bottom:12px; font-size:1rem; display:flex; align-items:center; gap:8px;">
                  <span>📋</span> 1. Selecionar Questão Alvo
                </h3>
                
                <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
                  <div style="flex:1; min-width:220px;">
                    <label style="display:block; font-size:0.85rem; font-weight:bold; margin-bottom:6px;">Prova / Material:</label>
                    <select id="selectProvaVincular" class="apendice-select" style="width:100%;">
                      <option value="">-- Carregando provas... --</option>
                    </select>
                  </div>
                  
                  <div style="flex:1; min-width:220px;">
                    <label style="display:block; font-size:0.85rem; font-weight:bold; margin-bottom:6px;">Questão:</label>
                    <select id="selectQuestaoVincular" class="apendice-select" style="width:100%;" disabled>
                      <option value="">-- Selecione uma prova primeiro --</option>
                    </select>
                  </div>
                </div>

                <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:12px; align-items:flex-end;">
                  <div style="flex:1; min-width:180px;">
                    <label style="display:block; font-size:0.85rem; font-weight:bold; margin-bottom:4px;">Ou Chave da Prova Manual:</label>
                    <input type="text" id="inputManualProvaVincular" class="admin-input-confirm" style="max-width:100%; margin-bottom:0;" placeholder="Ex: ENEM_2023" />
                  </div>
                  <div style="flex:1; min-width:180px;">
                    <label style="display:block; font-size:0.85rem; font-weight:bold; margin-bottom:4px;">Ou ID da Questão Manual:</label>
                    <input type="text" id="inputManualQuestaoVincular" class="admin-input-confirm" style="max-width:100%; margin-bottom:0;" placeholder="Ex: QUESTÃO_01" />
                  </div>
                </div>
              </div>

              <!-- Upload / Entrada de JSON -->
              <div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 8px; border: 1px solid var(--color-border);">
                <h3 style="margin-top:0; margin-bottom:12px; font-size:1rem; display:flex; align-items:center; gap:8px;">
                  <span>📂</span> 2. Conteúdo do JSON do Apêndice B
                </h3>

                <div style="margin-bottom:14px;">
                  <label style="display:block; font-size:0.85rem; font-weight:bold; margin-bottom:6px;">Carregar arquivo .json:</label>
                  <input type="file" id="fileJsonApendiceB" accept=".json,application/json" style="background:var(--color-surface); color:var(--color-text); padding:8px; border:1px solid var(--color-border); border-radius:6px; width:100%;" />
                </div>

                <div>
                  <label style="display:block; font-size:0.85rem; font-weight:bold; margin-bottom:6px;">Ou cole o conteúdo JSON bruto aqui:</label>
                  <textarea id="textareaJsonApendiceB" rows="7" style="width:100%; background:var(--color-surface); color:var(--color-text); border:1px solid var(--color-border); border-radius:6px; padding:10px; font-family:monospace; font-size:0.85rem; box-sizing:border-box;" placeholder='{\n  "pontuacao_final_complexidade": 18,\n  "classificacao_dificuldade": "Alta",\n  "criterios": { ... }\n}'></textarea>
                </div>
              </div>

            </div>

            <div class="admin-actions">
              <button id="btnSalvarVincularApendice" class="btn btn--primary" style="background:#38bdf8; color:#0f172a; border:none; padding:12px 24px; font-weight:bold;">
                💾 Salvar & Vincular Apêndice B
              </button>
            </div>
          </div>
        </div>

        <!-- CONTEÚDO DA ABA 3: LIMPEZA EM MASSA -->
        <div id="tab-limpeza-massa" class="admin-tab-content">
          <div class="admin-section">
            <h2>📦 Banco de Questões (Firebase)</h2>
            <p class="admin-desc">Exclua permanentemente todos os nós de questões do Firebase Realtime Database.</p>
            <div class="admin-actions">
              <button id="btnLimparQuestoes" class="btn btn--secondary btn--outline">Limpar TODAS as Questões (Firebase)</button>
            </div>
          </div>

          <div class="admin-section">
            <h2>📝 Histórico de Revisões (Firebase)</h2>
            <p class="admin-desc">Exclua permanentemente o progresso e estatísticas de todas as revisões feitas por usuários.</p>
            <div class="admin-actions">
              <button id="btnLimparRevisoes" class="btn btn--secondary btn--outline">Limpar TODAS as Revisões (Firebase)</button>
            </div>
          </div>

          <div class="admin-section">
            <h2>🌲 Busca Semântica (Pinecone)</h2>
            <p class="admin-desc">Limpa todos os vetores indexados no banco de vetores Pinecone.</p>
            <div class="admin-actions">
              <button id="btnLimparPinecone" class="btn btn--secondary btn--outline">Limpar TODOS os Vetores (Pinecone)</button>
            </div>
          </div>

          <div class="admin-section admin-danger-zone">
            <h2>🚨 Zona de Perigo: Reset Geral Conjunto</h2>
            <p class="admin-desc">Executa todas as limpezas em massa (Questões + Revisões no Firebase + Vetores no Pinecone) de uma única vez em paralelo. Esta operação é irreversível.</p>
            
            <div style="margin-bottom: 15px;">
              <label style="display:block; margin-bottom:8px; font-weight:bold; font-size:0.9rem;">Para confirmar, digite exatamente "DELETAR TUDO":</label>
              <input type="text" id="confirmInput" class="admin-input-confirm" placeholder="Escreva aqui..." autocomplete="off">
            </div>

            <div class="admin-actions">
              <button id="btnResetGeral" class="btn btn--danger" style="background:var(--color-error, #ff4444); color:white; border:none;" disabled>Excluir Tudo Permanentemente</button>
            </div>
          </div>
        </div>

        <!-- CONTEÚDO DA ABA 4: AUDITORIA & CORREÇÃO -->
        <div id="tab-auditoria" class="admin-tab-content">
          <div class="admin-section">
            <h2>🔍 Auditoria Pós-Envio & Correção de Questões</h2>
            <p class="admin-desc">Selecione uma questão do Firebase, anexe a foto da prova original, audite incoerências com IA e grave as correções permanentemente no banco.</p>
            <div class="admin-actions">
              <button id="btnAbrirVerificacao" class="btn btn--primary" style="background:#38bdf8; color:#0f172a; border:none; font-weight:bold;">🔍 Abrir Verificar Questões</button>
            </div>
          </div>
        </div>

        <!-- CONTEÚDO DA ABA 5: RESTAURAR LINK DA PROVA ORIGINAL -->
        <div id="tab-restaurar-link" class="admin-tab-content">
          <div class="admin-section">
            <h2>🔗 Gerenciador / Restaurador do Link da Prova Original (PDF)</h2>
            <p class="admin-desc">Defina ou restaure o link oficial da prova original em PDF para exibir o botão <strong>"🔗 Ver Fonte Original"</strong> nos cards de questões do banco.</p>
            
            <div style="display:flex; flex-direction:column; gap:16px; margin-bottom:20px;">
              
              <!-- Modo 1: Seleção por Dropdown -->
              <div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 8px; border: 1px solid var(--color-border);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                  <h3 style="margin:0; font-size:1rem; display:flex; align-items:center; gap:8px;">
                    <span>📋</span> Selecionar do Banco de Dados
                  </h3>
                  <button class="btn btn--sm btn--outline js-btn-recarregar-lista" style="font-size:0.8rem; padding:4px 10px;">🔄 Recarregar Banco</button>
                </div>
                
                <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
                  <div style="flex:1; min-width:220px;">
                    <label style="display:block; font-size:0.85rem; font-weight:bold; margin-bottom:6px;">1. Prova / Material:</label>
                    <select id="selectProvaRestaurarLink" class="apendice-select" style="width:100%;">
                      <option value="">-- Carregando provas... --</option>
                    </select>
                  </div>
                  
                  <div style="flex:1; min-width:220px;">
                    <label style="display:block; font-size:0.85rem; font-weight:bold; margin-bottom:6px;">2. Questão (Opcional):</label>
                    <select id="selectQuestaoRestaurarLink" class="apendice-select" style="width:100%;" disabled>
                      <option value="">-- Selecione uma prova primeiro --</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Modo 2: Entrada Manual / Edição de Link -->
              <div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 8px; border: 1px solid var(--color-border);">
                <h3 style="margin-top:0; margin-bottom:12px; font-size:1rem; display:flex; align-items:center; gap:8px;">
                  <span>✏️</span> Ou Digite a Chave Manualmente e Insira o Link Oficial
                </h3>
                
                <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:14px;">
                  <div style="flex:1; min-width:180px;">
                    <label style="display:block; font-size:0.85rem; font-weight:bold; margin-bottom:6px;">Chave da Prova (provaKey):</label>
                    <input type="text" id="inputProvaRestaurarLink" class="admin-input-confirm" style="max-width:100%; margin-bottom:0;" placeholder="Ex: ENEM_2023 ou FUVEST_2024" />
                  </div>
                  <div style="flex:1; min-width:180px;">
                    <label style="display:block; font-size:0.85rem; font-weight:bold; margin-bottom:6px;">ID Questão (Deixe em branco para toda a prova):</label>
                    <input type="text" id="inputQuestaoRestaurarLink" class="admin-input-confirm" style="max-width:100%; margin-bottom:0;" placeholder="Ex: QUESTÃO_01 (Opcional)" />
                  </div>
                </div>

                <div>
                  <label style="display:block; font-size:0.85rem; font-weight:bold; margin-bottom:6px;">Link Oficial da Prova em PDF (source_url):</label>
                  <input type="url" id="inputUrlRestaurarLink" class="admin-input-confirm" style="max-width:100%; margin-bottom:0;" placeholder="https://exemplo.com/provas/prova_oficial.pdf" />
                </div>
              </div>

            </div>

            <div class="admin-actions">
              <button id="btnSalvarLinkOriginalAdmin" class="btn btn--primary" style="background:#38bdf8; color:#0f172a; border:none; font-weight:bold; padding:12px 24px; cursor:pointer;">
                💾 Salvar & Restaurar Link da Prova
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  // Configura Listeners
  setupListeners();

  // Carrega lista inicial de provas nos dropdowns
  carregarTodasInstanciasProvas();
}

function setupListeners() {
  // Voltar
  const btnVoltar = document.querySelector(".js-voltar-inicio");
  if (btnVoltar) {
    btnVoltar.addEventListener("click", () => {
      gerarTelaInicial();
    });
  }

  // Controle de Navegação de Abas
  const tabButtons = document.querySelectorAll(".admin-tab-btn");
  const tabContents = document.querySelectorAll(".admin-tab-content");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTabId = btn.dataset.tab;
      
      tabButtons.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      btn.classList.add("active");
      const targetContent = document.getElementById(targetTabId);
      if (targetContent) targetContent.classList.add("active");
    });
  });

  // Dropdown Aba 1: Deletar
  const selectProva = document.getElementById("selectProvaAdmin");
  const selectQuestao = document.getElementById("selectQuestaoAdmin");

  if (selectProva && selectQuestao) {
    selectProva.addEventListener("change", (e) => {
      const provaKey = e.target.value;
      if (!provaKey || !cacheProvasQuestoes[provaKey]) {
        selectQuestao.innerHTML = '<option value="">-- Selecione uma prova primeiro --</option>';
        selectQuestao.disabled = true;
        ocultarPreview();
        return;
      }

      const qKeys = [...cacheProvasQuestoes[provaKey]].sort();
      let html = '<option value="">-- Selecione uma questão --</option>';
      for (const qKey of qKeys) {
        html += `<option value="${escapeHtml(qKey)}">${escapeHtml(qKey)}</option>`;
      }
      selectQuestao.innerHTML = html;
      selectQuestao.disabled = false;
      ocultarPreview();
    });

    selectQuestao.addEventListener("change", (e) => {
      const provaKey = selectProva.value;
      const questaoKey = e.target.value;
      if (provaKey && questaoKey) {
        carregarPreviewQuestao(provaKey, questaoKey);
      } else {
        ocultarPreview();
      }
    });
  }

  // Dropdown Aba 2: Vincular Apêndice B
  const selectProvaVincular = document.getElementById("selectProvaVincular");
  const selectQuestaoVincular = document.getElementById("selectQuestaoVincular");

  if (selectProvaVincular && selectQuestaoVincular) {
    selectProvaVincular.addEventListener("change", (e) => {
      const provaKey = e.target.value;
      if (!provaKey || !cacheProvasQuestoes[provaKey]) {
        selectQuestaoVincular.innerHTML = '<option value="">-- Selecione uma prova primeiro --</option>';
        selectQuestaoVincular.disabled = true;
        return;
      }

      const qKeys = [...cacheProvasQuestoes[provaKey]].sort();
      let html = '<option value="">-- Selecione uma questão --</option>';
      for (const qKey of qKeys) {
        html += `<option value="${escapeHtml(qKey)}">${escapeHtml(qKey)}</option>`;
      }
      selectQuestaoVincular.innerHTML = html;
      selectQuestaoVincular.disabled = false;
    });
  }

  // Botões de Recarregar Banco
  const btnsRecarregar = document.querySelectorAll(".js-btn-recarregar-lista");
  btnsRecarregar.forEach((btn) => {
    btn.addEventListener("click", () => {
      carregarTodasInstanciasProvas();
    });
  });

  // Listener para Busca Manual Deletar
  const btnVerificarManual = document.getElementById("btnVerificarManual");
  const inputManualProva = document.getElementById("inputManualProva");
  const inputManualQuestao = document.getElementById("inputManualQuestao");

  if (inputManualProva) inputManualProva.addEventListener("input", ocultarPreview);
  if (inputManualQuestao) inputManualQuestao.addEventListener("input", ocultarPreview);

  if (btnVerificarManual && inputManualProva && inputManualQuestao) {
    btnVerificarManual.addEventListener("click", () => {
      const provaKey = sanitizarKeyFirebase(inputManualProva.value);
      const questaoKey = sanitizarKeyFirebase(inputManualQuestao.value);
      if (!provaKey || !questaoKey) {
        customAlert("⚠️ Preencha o nome da prova e o ID da questão com caracteres válidos.");
        return;
      }
      carregarPreviewQuestao(provaKey, questaoKey);
    });
  }

  // File Upload para Vincular Apêndice B
  const fileJsonInput = document.getElementById("fileJsonApendiceB");
  const textareaJson = document.getElementById("textareaJsonApendiceB");

  if (fileJsonInput && textareaJson) {
    fileJsonInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const jsonObj = await lerArquivoJson(file);
        textareaJson.value = JSON.stringify(jsonObj, null, 2);
      } catch (err) {
        customAlert(`❌ ${err.message}`);
      }
    });
  }

  // Ação de Salvar e Vincular Apêndice B
  const btnSalvarVincularApendice = document.getElementById("btnSalvarVincularApendice");
  if (btnSalvarVincularApendice) {
    btnSalvarVincularApendice.addEventListener("click", async () => {
      const inputManualP = document.getElementById("inputManualProvaVincular");
      const inputManualQ = document.getElementById("inputManualQuestaoVincular");
      
      let provaKey = selectProvaVincular?.value || "";
      let questaoKey = selectQuestaoVincular?.value || "";

      if (inputManualP?.value.trim()) provaKey = sanitizarKeyFirebase(inputManualP.value);
      if (inputManualQ?.value.trim()) questaoKey = sanitizarKeyFirebase(inputManualQ.value);

      if (!provaKey || !questaoKey) {
        customAlert("⚠️ Selecione ou informe a Prova e o ID da Questão alvo.");
        return;
      }

      const rawJsonText = textareaJson?.value.trim();
      if (!rawJsonText) {
        customAlert("⚠️ Selecione um arquivo .json ou cole o texto do JSON de Apêndice B.");
        return;
      }

      setLoadingState(btnSalvarVincularApendice, true, "Vinculando Apêndice B...");

      try {
        const { finalObj, statusData } = normalizarJsonApendiceB(rawJsonText);

        await Promise.all([
          set(ref(db, `experimentos_apendice_b_status/${provaKey}/${questaoKey}`), statusData),
          set(ref(db, `experimentos_apendice_b/${provaKey}/${questaoKey}`), finalObj)
        ]);

        window.bancoState = window.bancoState || {};
        window.bancoState.apendiceBStatusMap = window.bancoState.apendiceBStatusMap || {};
        window.bancoState.apendiceBStatusMap[`${provaKey}/${questaoKey}`] = true;

        customAlert(`✅ Apêndice B vinculado com sucesso à questão "${provaKey} / ${questaoKey}"!`);
        if (textareaJson) textareaJson.value = "";
        if (fileJsonInput) fileJsonInput.value = "";
      } catch (err) {
        console.error("Erro ao vincular Apêndice B:", err);
        customAlert(`❌ Falha ao vincular Apêndice B: ${err.message}`);
      } finally {
        setLoadingState(btnSalvarVincularApendice, false, "💾 Salvar & Vincular Apêndice B");
      }
    });
  }

  // Listener do Botão de Exclusão Única
  const btnDeletarQuestaoUnica = document.getElementById("btnDeletarQuestaoUnica");
  if (btnDeletarQuestaoUnica) {
    btnDeletarQuestaoUnica.addEventListener("click", async () => {
      const provaKey = btnDeletarQuestaoUnica.dataset.prova;
      const questaoKey = btnDeletarQuestaoUnica.dataset.questao;
      const idPinecone = btnDeletarQuestaoUnica.dataset.pineconeId;

      if (!provaKey || !questaoKey) {
        customAlert("⚠️ Nenhuma questão válida selecionada.");
        return;
      }

      const msgConfirm = `ATENÇÃO: Você tem certeza que deseja excluir APENAS a questão "${questaoKey}" da prova "${provaKey}"?\n\nEsta operação é cirúrgica e removerá:\n- Nó no Firebase: /questoes/${provaKey}/${questaoKey}\n- Nó de revisões: /revisoes/${provaKey}/${questaoKey}\n- Status de apêndice B (se houver)\n- Vetor no Pinecone: ${idPinecone}`;

      if (!confirm(msgConfirm)) return;

      setLoadingState(btnDeletarQuestaoUnica, true, "Excluindo questão...");

      try {
        // 1. Apaga do Firebase RTDB (questoes, revisoes, experimentos_apendice_b_status)
        await Promise.all([
          remove(ref(db, `questoes/${provaKey}/${questaoKey}`)),
          remove(ref(db, `revisoes/${provaKey}/${questaoKey}`)),
          remove(ref(db, `revisoes/${provaKey}_${questaoKey}`)),
          remove(ref(db, `experimentos_apendice_b_status/${provaKey}/${questaoKey}`))
        ]);

        // 2. Apaga vetor no Pinecone (target default = questoes)
        if (idPinecone) {
          await deletePineconeRecordWorker(idPinecone, "default").catch(err => {
            console.warn("⚠️ Aviso Pinecone Delete:", err);
          });
          // Fallback com questaoKey puro
          await deletePineconeRecordWorker(questaoKey, "default").catch(() => {});
        }

        customAlert(`✅ Questão "${provaKey} / ${questaoKey}" excluída e limpa com sucesso!`);

        ocultarPreview();

        // Recarrega o dropdown de provas e questões
        carregarTodasInstanciasProvas();
      } catch (err) {
        console.error("Erro ao excluir questão:", err);
        customAlert(`❌ Erro ao excluir questão: ${err.message}`);
      } finally {
        setLoadingState(btnDeletarQuestaoUnica, false, "🗑️ Excluir Esta Questão Específica");
      }
    });
  }

  // Abrir Verificar Questões
  const btnAbrirVerificacao = document.getElementById("btnAbrirVerificacao");
  if (btnAbrirVerificacao) {
    btnAbrirVerificacao.addEventListener("click", () => {
      import("./verificar-questoes-screen.tsx").then(({ iniciarModoVerificacaoQuestoes }) => {
        iniciarModoVerificacaoQuestoes();
      });
    });
  }

  // Dropdown Aba 5: Restaurar Link Prova
  const selectProvaLink = document.getElementById("selectProvaRestaurarLink");
  const selectQuestaoLink = document.getElementById("selectQuestaoRestaurarLink");
  const inputProvaLink = document.getElementById("inputProvaRestaurarLink");
  const inputQuestaoLink = document.getElementById("inputQuestaoRestaurarLink");
  const inputUrlLink = document.getElementById("inputUrlRestaurarLink");

  if (selectProvaLink && selectQuestaoLink) {
    selectProvaLink.addEventListener("change", async (e) => {
      const provaKey = e.target.value;
      if (inputProvaLink) inputProvaLink.value = provaKey;

      if (!provaKey || !cacheProvasQuestoes[provaKey]) {
        selectQuestaoLink.innerHTML = '<option value="">-- Selecione uma prova primeiro --</option>';
        selectQuestaoLink.disabled = true;
        if (inputQuestaoLink) inputQuestaoLink.value = "";
        return;
      }

      const qKeys = [...cacheProvasQuestoes[provaKey]].sort();
      let html = '<option value="">-- Aplicar em TODAS as questões da prova --</option>';
      for (const qKey of qKeys) {
        html += `<option value="${escapeHtml(qKey)}">${escapeHtml(qKey)}</option>`;
      }
      selectQuestaoLink.innerHTML = html;
      selectQuestaoLink.disabled = false;
      if (inputQuestaoLink) inputQuestaoLink.value = "";

      try {
        const snap = await get(ref(db, `questoes/${provaKey}`));
        if (snap.exists()) {
          const qDataMap = snap.val();
          for (const k in qDataMap) {
            const foundUrl = qDataMap[k]?.meta?.source_url || qDataMap[k]?.meta?.source_url_prova || qDataMap[k]?.dados_questao?.source_url;
            if (foundUrl && inputUrlLink) {
              inputUrlLink.value = foundUrl;
              break;
            }
          }
        }
      } catch (err) {
        console.warn("Erro ao buscar link existente:", err);
      }
    });

    selectQuestaoLink.addEventListener("change", async (e) => {
      const qKey = e.target.value;
      const provaKey = selectProvaLink ? selectProvaLink.value : "";
      if (inputQuestaoLink) inputQuestaoLink.value = qKey;

      if (provaKey && qKey) {
        try {
          const snap = await get(ref(db, `questoes/${provaKey}/${qKey}`));
          if (snap.exists() && inputUrlLink) {
            const val = snap.val();
            const foundUrl = val?.meta?.source_url || val?.meta?.source_url_prova || val?.dados_questao?.source_url || "";
            if (foundUrl) inputUrlLink.value = foundUrl;
          }
        } catch (err) {
          console.warn("Erro ao buscar link da questão:", err);
        }
      }
    });
  }

  // Salvar & Restaurar Link da Prova Original (Aba 5)
  const btnSalvarLink = document.getElementById("btnSalvarLinkOriginalAdmin");
  if (btnSalvarLink) {
    btnSalvarLink.addEventListener("click", async () => {
      const provaKey = (document.getElementById("inputProvaRestaurarLink")?.value || "").trim();
      const questaoKey = (document.getElementById("inputQuestaoRestaurarLink")?.value || "").trim();
      const urlValue = (document.getElementById("inputUrlRestaurarLink")?.value || "").trim();

      if (!provaKey || !urlValue) {
        customAlert("⚠️ Preencha a Chave da Prova e o Link (URL) da Prova em PDF.");
        return;
      }

      try {
        btnSalvarLink.disabled = true;
        btnSalvarLink.innerText = "⏳ Salvando link no Firebase...";

        if (questaoKey) {
          // Atualiza apenas uma questão
          const targetRef = ref(db, `questoes/${provaKey}/${questaoKey}/meta/source_url`);
          await set(targetRef, urlValue);
          customAlert(`✅ Link da fonte original salvo para ${provaKey} / ${questaoKey}!`);
        } else {
          // Atualiza todas as questões da prova no nó questoes/${provaKey}
          const provaRef = ref(db, `questoes/${provaKey}`);
          const snap = await get(provaRef);
          if (!snap.exists()) {
            customAlert("❌ Prova não encontrada no Firebase.");
            return;
          }

          const qMap = snap.val();
          let count = 0;
          const updates = {};
          for (const qId in qMap) {
            updates[`questoes/${provaKey}/${qId}/meta/source_url`] = urlValue;
            count++;
          }
          await update(ref(db), updates);
          customAlert(`🎉 Link da fonte original restaurado em TODAS as ${count} questões da prova ${provaKey}!`);
        }
      } catch (err) {
        console.error("Erro ao salvar link da fonte:", err);
        customAlert("❌ Erro ao salvar link: " + (err.message || err));
      } finally {
        btnSalvarLink.disabled = false;
        btnSalvarLink.innerText = "💾 Salvar & Restaurar Link da Prova";
      }
    });
  }

  // Inputs e Botões das Limpezas em Massa
  const confirmInput = document.getElementById("confirmInput");
  const btnResetGeral = document.getElementById("btnResetGeral");
  const btnLimparQuestoes = document.getElementById("btnLimparQuestoes");
  const btnLimparRevisoes = document.getElementById("btnLimparRevisoes");
  const btnLimparPinecone = document.getElementById("btnLimparPinecone");

  if (confirmInput && btnResetGeral) {
    confirmInput.addEventListener("input", (e) => {
      btnResetGeral.disabled = e.target.value !== "DELETAR TUDO";
    });
  }

  if (btnLimparQuestoes) {
    btnLimparQuestoes.addEventListener("click", async () => {
      if (!confirm("Tem certeza que deseja apagar TODAS as questões no Firebase?")) return;
      setLoadingState(btnLimparQuestoes, true, "Excluindo...");
      try {
        await remove(ref(db, "questoes"));
        customAlert("✅ Questões limpas no Firebase com sucesso!");
      } catch (e) {
        console.error(e);
        customAlert("❌ Erro ao limpar questões: " + e.message);
      } finally {
        setLoadingState(btnLimparQuestoes, false, "Limpar TODAS as Questões (Firebase)");
      }
    });
  }

  if (btnLimparRevisoes) {
    btnLimparRevisoes.addEventListener("click", async () => {
      if (!confirm("Tem certeza que deseja apagar TODAS as revisões no Firebase?")) return;
      setLoadingState(btnLimparRevisoes, true, "Excluindo...");
      try {
        await remove(ref(db, "revisoes"));
        customAlert("✅ Revisões limpas no Firebase com sucesso!");
      } catch (e) {
        console.error(e);
        customAlert("❌ Erro ao limpar revisões: " + e.message);
      } finally {
        setLoadingState(btnLimparRevisoes, false, "Limpar TODAS as Revisões (Firebase)");
      }
    });
  }

  if (btnLimparPinecone) {
    btnLimparPinecone.addEventListener("click", async () => {
      if (!confirm("Tem certeza que deseja apagar TODOS os vetores no Pinecone?")) return;
      setLoadingState(btnLimparPinecone, true, "Limpando Pinecone...");
      try {
        await clearAllPineconeVectors("default");
        customAlert("✅ Vetores limpos no Pinecone com sucesso!");
      } catch (e) {
        console.error(e);
        customAlert("❌ Erro ao limpar Pinecone: " + e.message);
      } finally {
        setLoadingState(btnLimparPinecone, false, "Limpar TODOS os Vetores (Pinecone)");
      }
    });
  }

  if (btnResetGeral) {
    btnResetGeral.addEventListener("click", async () => {
      if (confirmInput.value !== "DELETAR TUDO") return;
      if (!confirm("ATENÇÃO MÁXIMA: Você vai apagar permanentemente as Questões, Revisões E Vetores de Busca. Confirmar?")) return;

      setLoadingState(btnResetGeral, true, "Resetando Geral...");
      disableOtherButtons(true);

      try {
        await Promise.all([
          remove(ref(db, "questoes")),
          remove(ref(db, "revisoes")),
          clearAllPineconeVectors("default")
        ]);

        customAlert("💥 Reset Geral Concluído! Tudo foi excluído.");
        confirmInput.value = "";
        btnResetGeral.disabled = true;
      } catch (e) {
        console.error(e);
        customAlert("❌ Ocorreu um erro no Reset Geral: " + e.message);
      } finally {
        setLoadingState(btnResetGeral, false, "Excluir Tudo Permanentemente");
        disableOtherButtons(false);
      }
    });
  }

  function setLoadingState(button, isLoading, text) {
    if (!button) return;
    button.disabled = isLoading;
    if (isLoading) {
      button.innerHTML = `<span class="admin-spinner"></span> ${text}`;
    } else {
      button.innerHTML = text;
    }
  }

  function disableOtherButtons(disabled) {
    if (btnLimparQuestoes) btnLimparQuestoes.disabled = disabled;
    if (btnLimparRevisoes) btnLimparRevisoes.disabled = disabled;
    if (btnLimparPinecone) btnLimparPinecone.disabled = disabled;
    if (confirmInput) confirmInput.disabled = disabled;
  }
}

/**
 * Carrega a árvore de provas em todos os dropdowns de seleção
 */
async function carregarTodasInstanciasProvas() {
  const selectsProva = [
    document.getElementById("selectProvaAdmin"),
    document.getElementById("selectProvaVincular"),
    document.getElementById("selectProvaRestaurarLink")
  ].filter(Boolean);

  const selectsQuestao = [
    document.getElementById("selectQuestaoAdmin"),
    document.getElementById("selectQuestaoVincular"),
    document.getElementById("selectQuestaoRestaurarLink")
  ].filter(Boolean);

  selectsProva.forEach(s => s.innerHTML = '<option value="">⏳ Carregando provas...</option>');
  selectsQuestao.forEach(s => {
    s.innerHTML = '<option value="">-- Selecione uma prova primeiro --</option>';
    s.disabled = true;
  });
  ocultarPreview();

  try {
    const snapshot = await get(ref(db, "questoes"));
    if (!snapshot.exists()) {
      selectsProva.forEach(s => s.innerHTML = '<option value="">(Nenhuma prova encontrada)</option>');
      cacheProvasQuestoes = {};
      return;
    }

    const val = snapshot.val();
    cacheProvasQuestoes = {};

    let html = '<option value="">-- Selecione uma prova --</option>';
    const provaKeys = Object.keys(val).sort();

    for (const provaKey of provaKeys) {
      const qMap = val[provaKey] || {};
      const qKeys = typeof qMap === "object" ? Object.keys(qMap) : [];
      cacheProvasQuestoes[provaKey] = qKeys;
      html += `<option value="${escapeHtml(provaKey)}">${escapeHtml(provaKey)} (${qKeys.length} questões)</option>`;
    }

    selectsProva.forEach(s => s.innerHTML = html);
  } catch (err) {
    console.error("Erro ao carregar provas no admin:", err);
    selectsProva.forEach(s => s.innerHTML = '<option value="">❌ Erro ao carregar provas do banco</option>');
  }
}

/**
 * Esconde o card de preview
 */
function ocultarPreview() {
  const containerPreview = document.getElementById("containerPreviewQuestao");
  const btnDeletar = document.getElementById("btnDeletarQuestaoUnica");

  if (containerPreview) containerPreview.style.display = "none";
  if (btnDeletar) {
    btnDeletar.disabled = true;
    delete btnDeletar.dataset.prova;
    delete btnDeletar.dataset.questao;
    delete btnDeletar.dataset.pineconeId;
  }
}

/**
 * Busca e exibe metadados de preview da questão selecionada
 */
async function carregarPreviewQuestao(provaKey, questaoKey) {
  if (!provaKey || !questaoKey) return;

  const containerPreview = document.getElementById("containerPreviewQuestao");
  const conteudoPreview = document.getElementById("conteudoPreviewQuestao");
  const btnDeletar = document.getElementById("btnDeletarQuestaoUnica");

  if (!containerPreview || !conteudoPreview || !btnDeletar) return;

  containerPreview.style.display = "block";
  conteudoPreview.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px;">
      <span class="admin-spinner"></span> Buscando dados de <strong>${escapeHtml(provaKey)} / ${escapeHtml(questaoKey)}</strong>...
    </div>
  `;

  const idPineconeCalculado = `${sanitizarID(provaKey)}--${sanitizarID(questaoKey)}`;

  try {
    const [qSnap, rSnap, rSnapAlt, statusSnap] = await Promise.all([
      get(ref(db, `questoes/${provaKey}/${questaoKey}`)),
      get(ref(db, `revisoes/${provaKey}/${questaoKey}`)),
      get(ref(db, `revisoes/${provaKey}_${questaoKey}`)),
      get(ref(db, `experimentos_apendice_b_status/${provaKey}/${questaoKey}`))
    ]);

    const temQuestao = qSnap.exists();
    const temRevisao = rSnap.exists() || rSnapAlt.exists();
    const temStatus = statusSnap.exists();

    let qData = temQuestao ? qSnap.val() : null;

    // Extrair texto do enunciado
    let enunciado = "";
    if (qData) {
      if (qData.questaoFinal?.estrutura) {
        enunciado = qData.questaoFinal.estrutura.map(i => i.conteudo || "").join(" ");
      } else if (qData.dados_questao?.estrutura) {
        enunciado = qData.dados_questao.estrutura.map(i => i.conteudo || "").join(" ");
      } else if (qData.estrutura) {
        enunciado = Array.isArray(qData.estrutura) ? qData.estrutura.map(i => i.conteudo || "").join(" ") : String(qData.estrutura);
      } else if (qData.enunciado) {
        enunciado = qData.enunciado;
      }
    }

    if (enunciado.length > 250) {
      enunciado = enunciado.substring(0, 250) + "...";
    }

    const materiaRaw = qData?.dados_questao?.materia || qData?.materia || qData?.dados_questao?.disciplina || "Não informada";
    const materiaStr = Array.isArray(materiaRaw) ? materiaRaw.join(", ") : String(materiaRaw);
    const anoStr = String(qData?.dados_gabarito?.creditos?.ano || qData?.dados_questao?.ano || qData?.ano || "N/A");

    conteudoPreview.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-bottom:12px;">
        <div><strong>Prova:</strong> ${escapeHtml(provaKey)}</div>
        <div><strong>ID Questão:</strong> ${escapeHtml(questaoKey)}</div>
        <div><strong>Matéria:</strong> ${escapeHtml(materiaStr)}</div>
        <div><strong>Ano:</strong> ${escapeHtml(anoStr)}</div>
      </div>

      <div style="margin-bottom:12px;">
        <strong>ID Vector (Pinecone):</strong> <code style="background:rgba(0,0,0,0.3); padding:2px 6px; border-radius:4px; font-size:0.8rem;">${escapeHtml(idPineconeCalculado)}</code>
      </div>

      <div style="margin-bottom:12px;">
        <strong>Status de Componentes Encontrados:</strong>
        <div style="display:flex; gap:8px; margin-top:6px; flex-wrap:wrap;">
          <span class="admin-badge ${temQuestao ? 'admin-badge--success' : 'admin-badge--warning'}">
            ${temQuestao ? '✅ Firebase Questão' : '⚠️ Não encontrada em /questoes'}
          </span>
          <span class="admin-badge ${temRevisao ? 'admin-badge--info' : 'admin-badge--warning'}">
            ${temRevisao ? '✅ Possui Revisão' : '⚪ Sem Revisão'}
          </span>
          <span class="admin-badge ${temStatus ? 'admin-badge--info' : 'admin-badge--warning'}">
            ${temStatus ? '✅ Status Apêndice B' : '⚪ Sem Status Apêndice B'}
          </span>
          <span class="admin-badge admin-badge--info">
            🌲 Alvo Pinecone (questoes)
          </span>
        </div>
      </div>

      ${enunciado ? `<div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; font-style:italic; margin-top:8px;">"${escapeHtml(enunciado)}"</div>` : ''}
    `;

    btnDeletar.disabled = false;
    btnDeletar.dataset.prova = provaKey;
    btnDeletar.dataset.questao = questaoKey;
    btnDeletar.dataset.pineconeId = idPineconeCalculado;

  } catch (err) {
    console.error("Erro ao carregar preview da questão:", err);
    conteudoPreview.innerHTML = `<div style="color:var(--color-error, #ff4444);">❌ Erro ao buscar dados da questão: ${escapeHtml(err.message)}</div>`;
    btnDeletar.disabled = false;
    btnDeletar.dataset.prova = provaKey;
    btnDeletar.dataset.questao = questaoKey;
    btnDeletar.dataset.pineconeId = idPineconeCalculado;
  }
}
