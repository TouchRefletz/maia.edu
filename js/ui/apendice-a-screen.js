import { ref, get } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { db, auth } from "../main.js";
import { customAlert } from "./GlobalAlertsLogic.tsx";
import { gerarTelaInicial } from "../app/telas.js";
import { verificarSeAdmin } from "./admin-panel.js";
import { openAddQuestionsModal } from "./add-questions-modal.js";
import { criarCardTecnico } from "../banco/card-template.js";
import { renderLatexIn } from "../libs/loader.tsx";

/**
 * 2026 Seeded LCG Random Number Generator
 */
class SeededRandom {
  constructor(seed) {
    this.seed = seed;
  }
  next() {
    // LCG parameters
    const m = 0x80000000; // 2**31
    const a = 1103515245;
    const c = 12345;
    this.seed = (a * this.seed + c) % m;
    return this.seed / (m - 1);
  }
}

// State for Cross-Evaluation
const state = {
  selectedQuestion: null,
  uploadedJSON: null,
  uploadedModel: null
};

/**
 * Inicializa a tela dedicada do Apêndice A.
 */
export async function iniciarModoApendiceA() {
  const user = auth.currentUser;
  if (!user) {
    customAlert("⚠️ Faça login primeiro.");
    gerarTelaInicial();
    return;
  }

  // Feedback de carregamento
  document.body.innerHTML = `
    <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; background:var(--color-bg); color:var(--color-text); font-family: system-ui, sans-serif;">
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

  // Reset state
  state.selectedQuestion = null;
  state.uploadedJSON = null;
  state.uploadedModel = null;

  // Renderiza layout principal com barra de abas integradas (estilo Maia.edu)
  document.body.innerHTML = `
    <div class="admin-layout-wrapper" style="font-family: system-ui, sans-serif; background: var(--color-background); min-height: 100vh; padding: 20px; box-sizing: border-box; color: var(--color-text);">
      <div class="admin-panel" style="max-width: 1100px; margin: 0 auto; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 24px; box-shadow: var(--shadow-lg);">
        
        <div class="admin-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-border); padding-bottom: 16px; margin-bottom: 20px;">
          <h1 style="margin: 0; font-size: 1.8rem; display: flex; align-items: center; gap: 10px; color: var(--color-text-shine);">🧪 Apêndice A - Crossover de Modelos</h1>
          <button class="btn btn--sm btn--outline js-voltar-inicio" style="border: 1px solid var(--color-border); border-radius: 6px; padding: 8px 14px; background: none; color: var(--color-text); cursor: pointer;">← Voltar</button>
        </div>

        <!-- Barra de Navegação Interna (Tabs) -->
        <div class="apendice-tabs-nav" style="display: flex; gap: 10px; border-bottom: 1px solid var(--color-border); padding-bottom: 12px; margin-bottom: 24px;">
          <button id="tabApendiceASorteio" class="nav-tab-btn active" style="flex: 1; border: 1px solid var(--color-border); border-radius: 6px; padding: 10px; background: var(--color-primary); color: var(--color-btn-primary-text); cursor: pointer; font-weight: bold; transition: all 0.2s;">
            🎲 Sorteio Crossover (seed=2026)
          </button>
          <button id="tabApendiceAAvaliacao" class="nav-tab-btn" style="flex: 1; border: 1px solid var(--color-border); border-radius: 6px; padding: 10px; background: none; color: var(--color-text-secondary); cursor: pointer; font-weight: bold; transition: all 0.2s;">
            ⚖️ Avaliação Cruzada (Individual)
          </button>
        </div>

        <!-- CONTAINER 1: Sorteio Crossover -->
        <div id="containerApendiceASorteio" style="display: block;">
          <div style="margin-bottom: 24px;">
            <p style="margin: 0 0 16px 0; color: var(--color-text-secondary); font-size: 0.95rem; line-height: 1.5;">
              Selecione a área acadêmica das 25 questões e clique no botão para gerar o sorteio e divisão de modelos do crossover experimental utilizando a semente fixa <strong>seed = 2026</strong>.
            </p>
            
            <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 0.8rem; font-weight: bold; color: var(--color-text-secondary);">Área Acadêmica:</label>
                <select id="selectApendiceAArea" class="apendice-select">
                  <option value="Linguagens">Linguagens (25 questões)</option>
                  <option value="Matemática">Matemática (25 questões)</option>
                  <option value="Ciências da Natureza">Ciências da Natureza (25 questões)</option>
                  <option value="Ciências Humanas">Ciências Humanas (25 questões)</option>
                  <option value="Interdisciplinar FUVEST">Interdisciplinar FUVEST (25 questões)</option>
                </select>
              </div>
              
              <button id="btnRodarSorteioApendiceA" class="btn btn--primary" style="margin-top: 20px; background: var(--color-primary); color: var(--color-btn-primary-text); border: none; padding: 12px 24px; font-weight: bold; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                🎲 Sortear Modelos (seed=2026)
              </button>
            </div>
          </div>

          <!-- Tabela de Resultados do Sorteio -->
          <div id="apendiceATableArea" style="margin-top: 20px;">
            <div style="border: 2px dashed var(--color-border); border-radius: 8px; padding: 40px; text-align: center; color: var(--color-text-secondary);">
              Escolha uma área e clique em "Sortear Modelos" para visualizar o Crossover.
            </div>
          </div>
        </div>

        <!-- CONTAINER 2: Avaliação Cruzada (Individual) -->
        <div id="containerApendiceAAvaliacao" style="display: none;">
          <div style="display: flex; flex-direction: column; gap: 20px;">
            
            <!-- Linha superior de seletores -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
              
              <!-- Coluna A: Seleção de Questão -->
              <div style="border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; background: rgba(255,255,255,0.01); display: flex; flex-direction: column; gap: 12px;">
                <h3 style="margin: 0; font-size: 1rem; color: var(--color-text-shine); display: flex; align-items: center; gap: 6px;">🔑 1. Gabarito Oficial (Questão de Referência)</h3>
                <button id="btnSelectQuestionApendiceA" class="btn btn--primary" style="background: var(--color-primary); color: var(--color-btn-primary-text); border: none; padding: 10px 16px; font-weight: bold; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.9rem;">
                  ➕ Selecionar Questão
                </button>
                <div id="apendiceAQuestionPreview" style="margin-top: 5px;">
                  <div style="border: 1px dashed var(--color-border); border-radius: 6px; padding: 20px; text-align: center; color: var(--color-text-secondary); font-size: 0.85rem;">
                    Nenhuma questão selecionada como gabarito oficial.
                  </div>
                </div>
              </div>

              <!-- Coluna B: Upload de Resposta -->
              <div style="border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; background: rgba(255,255,255,0.01); display: flex; flex-direction: column; gap: 12px;">
                <h3 style="margin: 0; font-size: 1rem; color: var(--color-text-shine); display: flex; align-items: center; gap: 6px;">📥 2. Enviar Resposta (Log JSON)</h3>
                <div id="dropZoneApendiceA" style="border: 2px dashed var(--color-border); border-radius: 8px; padding: 24px; text-align: center; color: var(--color-text-secondary); cursor: pointer; transition: border-color 0.2s, background-color 0.2s; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 8px; min-height: 120px; box-sizing: border-box;">
                  <span style="font-size: 1.8rem;">📄</span>
                  <span id="dropZoneLabel" style="font-size: 0.85rem; font-weight: 500;">Arraste o arquivo JSON ou clique para procurar</span>
                  <input type="file" id="fileInputApendiceA" accept=".json" style="display: none;" />
                </div>
                <div id="uploadMetadataArea" style="display: none; flex-direction: column; gap: 8px; background: rgba(0,0,0,0.15); border: 1px solid var(--color-border); border-radius: 6px; padding: 12px; font-size: 0.8rem; font-family: monospace;">
                  <!-- Detalhes do JSON carregado -->
                </div>
              </div>

            </div>

            <!-- Seção de Configuração e Modelos Juízes -->
            <div id="evaluationConfigArea" style="border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; background: rgba(255,255,255,0.01); display: none; flex-direction: column; gap: 14px;">
              <h3 style="margin: 0; font-size: 1rem; color: var(--color-text-shine);">⚙️ 3. Configurações da Avaliação</h3>
              
              <div style="display: flex; flex-direction: column; gap: 10px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.9rem; font-weight: 500; color: var(--color-text);">
                  <input type="checkbox" id="checkMaiaApendiceA" style="width: 16px; height: 16px; cursor: pointer;" />
                  Com Arquitetura Maia.edu (Muda sufixo do debug baixado)
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.9rem; font-weight: 500; color: var(--color-text);">
                  <input type="checkbox" id="checkInterdisciplinaryApendiceA" style="width: 16px; height: 16px; cursor: pointer;" />
                  Avaliar Critério Interdisciplinar FUVEST (K6)
                </label>
              </div>

              <div style="display: flex; flex-direction: column; gap: 8px; border-top: 1px dashed var(--color-border); padding-top: 12px;">
                <label style="font-size: 0.85rem; font-weight: bold; color: var(--color-text-secondary);">Escolha o Modelo Juiz (Faltante):</label>
                <select id="selectJudgeApendiceA" class="apendice-select" style="min-width: 250px; background: var(--color-surface); color: var(--color-text); border: 1px solid var(--color-border); border-radius: 6px; padding: 8px; margin-top: 4px;">
                  <!-- Opções geradas dinamicamente -->
                </select>
              </div>

              <!-- Botão de execução -->
              <div style="margin-top: 8px;">
                <button id="btnRunEvaluationApendiceA" class="btn btn--primary" style="width: 100%; padding: 12px; font-weight: bold; background: var(--color-primary); color: white; display: flex; align-items: center; justify-content: center; gap: 8px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.95rem;">
                  🚀 Executar Avaliação Cruzada
                </button>
              </div>
            </div>

            <!-- Console de Execução / Status / Streaming -->
            <div id="evaluationConsoleArea" style="border: 1px solid var(--color-border); border-radius: 8px; padding: 16px; background: rgba(0,0,0,0.15); display: none; flex-direction: column; gap: 12px; font-family: monospace;">
              <div id="evaluationProgressHeader" style="font-size: 0.85rem; color: var(--color-text-secondary); display: flex; align-items: center; gap: 8px;">
                <span id="evaluationStatusMsg">Iniciando avaliações...</span>
              </div>
              
              <div style="display: flex; flex-direction: column; gap: 6px;">
                <span style="font-size: 0.75rem; color: var(--color-primary); font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">💭 Cadeia de Raciocínio do Juiz (Thoughts)</span>
                <div id="evaluationThoughts" style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 10px; height: 180px; overflow-y: auto; font-size: 0.8rem; white-space: pre-wrap; color: var(--color-text-secondary); line-height: 1.4;"></div>
              </div>
              
              <div style="display: flex; flex-direction: column; gap: 6px;">
                <span style="font-size: 0.75rem; color: var(--color-success); font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">📊 Resposta da Avaliação (JSON)</span>
                <pre id="evaluationJSONResponse" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 10px; margin: 0; height: 180px; overflow-y: auto; font-size: 0.8rem; color: #a9ffaf; line-height: 1.4; white-space: pre-wrap;"></pre>
              </div>

              <!-- Painel de Resultados Consolidados -->
              <div id="evaluationResultsPanel" style="display: none; background: rgba(50, 184, 198, 0.1); border: 1px solid rgba(50, 184, 198, 0.3); border-radius: 6px; padding: 12px; flex-direction: column; gap: 8px;">
                <span style="font-size: 0.8rem; font-weight: bold; color: var(--color-primary); display: flex; align-items: center; gap: 6px;">🎯 Pontuação Consolidada (Weight Blinding)</span>
                <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem; color: var(--color-text);">
                  <div style="display: flex; justify-content: space-between; font-weight: bold; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 4px; margin-bottom: 4px;">
                    <span>Pontuação Total:</span>
                    <span id="resTotalScore" style="color: var(--color-primary); font-size: 0.9rem;">0 / 100</span>
                  </div>
                  <div id="resGroupsList" style="display: flex; flex-direction: column; gap: 2px;">
                    <!-- Notas por grupo injetadas aqui -->
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  `;

  // Setup Listeners das Abas
  const tabSorteio = document.getElementById("tabApendiceASorteio");
  const tabAvaliacao = document.getElementById("tabApendiceAAvaliacao");
  const cSorteio = document.getElementById("containerApendiceASorteio");
  const cAvaliacao = document.getElementById("containerApendiceAAvaliacao");

  tabSorteio.addEventListener("click", () => {
    tabSorteio.style.background = "var(--color-primary)";
    tabSorteio.style.color = "var(--color-btn-primary-text)";
    tabSorteio.classList.add("active");
    
    tabAvaliacao.style.background = "none";
    tabAvaliacao.style.color = "var(--color-text-secondary)";
    tabAvaliacao.classList.remove("active");
    
    cSorteio.style.display = "block";
    cAvaliacao.style.display = "none";
  });

  tabAvaliacao.addEventListener("click", () => {
    tabAvaliacao.style.background = "var(--color-primary)";
    tabAvaliacao.style.color = "var(--color-btn-primary-text)";
    tabAvaliacao.classList.add("active");
    
    tabSorteio.style.background = "none";
    tabSorteio.style.color = "var(--color-text-secondary)";
    tabSorteio.classList.remove("active");
    
    cSorteio.style.display = "none";
    cAvaliacao.style.display = "block";
  });

  // Setup Listeners do Sorteio
  const selectArea = document.getElementById("selectApendiceAArea");
  const btnRodar = document.getElementById("btnRodarSorteioApendiceA");
  const tableArea = document.getElementById("apendiceATableArea");

  btnRodar.addEventListener("click", async () => {
    tableArea.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 40px;">
        <div class="admin-spinner"></div>
        <p style="margin-top:15px; font-weight:500;">Lendo dados do experimento...</p>
      </div>
    `;

    try {
      const res = await fetch("../../experiments/questoes_experimento.json");
      if (!res.ok) throw new Error("Não foi possível carregar o arquivo JSON de questões.");
      const questoesAll = await res.json();

      let areaFilter = selectArea.value;
      if (areaFilter === "Interdisciplinar FUVEST") {
        areaFilter = "FUVEST";
      }

      let questoesArea = questoesAll.filter(q => q.grupo === areaFilter || q.area === areaFilter);
      if (questoesArea.length === 0) {
        questoesArea = questoesAll.filter(q => {
          const gStr = String(q.grupo || "").toLowerCase();
          const aStr = String(q.area || "").toLowerCase();
          const fStr = areaFilter.toLowerCase();
          return gStr.includes(fStr) || aStr.includes(fStr);
        });
      }

      if (questoesArea.length === 0) {
        throw new Error(`Nenhuma questão encontrada para a área: ${selectArea.value}`);
      }

      questoesArea.sort((a, b) => a.id.localeCompare(b.id));
      const rand = new SeededRandom(2026);

      const shuffled = [...questoesArea];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rand.next() * (i + 1));
        const temp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = temp;
      }

      const modelA = "Gemini 3.5 Flash";
      const modelB = "Gemma 4 31B IT";
      const modelC = "GPT-OSS-120B";

      const alocacoes = new Array(shuffled.length).fill(null);
      for (let idx = 0; idx < 8; idx++) alocacoes[idx] = modelA;
      for (let idx = 8; idx < 16; idx++) alocacoes[idx] = modelB;
      for (let idx = 16; idx < 24; idx++) alocacoes[idx] = modelC;

      const extraRand = rand.next();
      let extraModel = modelA;
      if (extraRand < 1/3) {
        extraModel = modelA;
      } else if (extraRand < 2/3) {
        extraModel = modelB;
      } else {
        extraModel = modelC;
      }
      alocacoes[24] = extraModel;

      const resultData = shuffled.map((q, idx) => ({
        ...q,
        modelo_sorteado: alocacoes[idx]
      }));

      resultData.sort((a, b) => a.id.localeCompare(b.id));

      const countA = resultData.filter(r => r.modelo_sorteado === modelA).length;
      const countB = resultData.filter(r => r.modelo_sorteado === modelB).length;
      const countC = resultData.filter(r => r.modelo_sorteado === modelC).length;

      tableArea.innerHTML = `
        <div style="display:flex; justify-content: space-between; align-items:center; background: rgba(255,255,255,0.02); border: 1px solid var(--color-border); padding: 12px 18px; border-radius: 8px; margin-bottom: 16px;">
          <div style="font-size: 0.9rem; font-weight: 500; color: var(--color-text-secondary);">
            Distribuição da área <strong>${selectArea.value}</strong>: 
            <span style="margin-left: 10px; color: #4e82ee;">🤖 ${modelA}: <strong>${countA}</strong></span> |
            <span style="margin-left: 10px; color: #a75df4;">🤖 ${modelB}: <strong>${countB}</strong></span> |
            <span style="margin-left: 10px; color: #f97316;">🤖 ${modelC}: <strong>${countC}</strong></span>
          </div>
          <div style="font-size: 0.8rem; background: rgba(var(--color-primary-rgb), 0.1); color: var(--color-primary); padding: 4px 10px; border-radius: 20px; font-weight: bold; border: 1px solid rgba(var(--color-primary-rgb), 0.2);">
            Semente: 2026
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem; border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: rgba(255,255,255,0.03); border-bottom: 1px solid var(--color-border);">
              <th style="padding: 12px; font-weight: bold; color: var(--color-text);">Questão</th>
              <th style="padding: 12px; font-weight: bold; color: var(--color-text);">Ano</th>
              <th style="padding: 12px; font-weight: bold; color: var(--color-text);">Gabarito</th>
              <th style="padding: 12px; font-weight: bold; color: var(--color-text);">Dificuldade (TRI)</th>
              <th style="padding: 12px; font-weight: bold; color: var(--color-text);">Faixa</th>
              <th style="padding: 12px; font-weight: bold; color: var(--color-text); text-align: center;">Modelo Alocado (Crossover)</th>
            </tr>
          </thead>
          <tbody>
            ${resultData.map(r => {
              let modelBadgeBg = "rgba(78, 130, 238, 0.15)";
              let modelBadgeColor = "#4e82ee";
              let modelBadgeBorder = "rgba(78, 130, 238, 0.3)";

              if (r.modelo_sorteado === modelB) {
                modelBadgeBg = "rgba(167, 93, 244, 0.15)";
                modelBadgeColor = "#a75df4";
                modelBadgeBorder = "rgba(167, 93, 244, 0.3)";
              } else if (r.modelo_sorteado === modelC) {
                modelBadgeBg = "rgba(249, 115, 22, 0.15)";
                modelBadgeColor = "#f97316";
                modelBadgeBorder = "rgba(249, 115, 22, 0.3)";
              }

              return `
                <tr style="border-bottom: 1px solid var(--color-border); transition: background 0.2s;">
                  <td style="padding: 12px; font-weight: 500;">${r.id}</td>
                  <td style="padding: 12px; color: var(--color-text-secondary);">${r.ano}</td>
                  <td style="padding: 12px;"><span style="background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 4px; font-weight: bold;">${r.gabarito}</span></td>
                  <td style="padding: 12px; color: var(--color-text-secondary); font-family: monospace;">${(r.dificuldade_pct)}%</td>
                  <td style="padding: 12px; color: var(--color-text-secondary);">${r.faixa}</td>
                  <td style="padding: 12px; text-align: center;">
                    <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: bold; background: ${modelBadgeBg}; color: ${modelBadgeColor}; border: 1px solid ${modelBadgeBorder};">
                      🤖 ${r.modelo_sorteado}
                    </span>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      `;
    } catch (err) {
      console.error(err);
      tableArea.innerHTML = `
        <div style="border: 1px solid rgba(220, 53, 69, 0.3); background: rgba(220, 53, 69, 0.08); border-radius: 8px; padding: 24px; text-align: center; color: #dc3545;">
          ⚠️ <strong>Erro ao gerar crossover:</strong> ${err.message}
        </div>
      `;
    }
  });

  // Setup Listeners da Avaliação Individual
  const btnSelectQuestion = document.getElementById("btnSelectQuestionApendiceA");
  const dropZone = document.getElementById("dropZoneApendiceA");
  const fileInput = document.getElementById("fileInputApendiceA");
  const btnRunEval = document.getElementById("btnRunEvaluationApendiceA");

  btnSelectQuestion.addEventListener("click", () => {
    openAddQuestionsModal();
  });

  dropZone.addEventListener("click", () => {
    fileInput.click();
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "var(--color-primary)";
    dropZone.style.backgroundColor = "rgba(var(--color-primary-rgb), 0.05)";
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.style.borderColor = "var(--color-border)";
    dropZone.style.backgroundColor = "transparent";
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "var(--color-border)";
    dropZone.style.backgroundColor = "transparent";
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleJsonFile(files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      handleJsonFile(files[0]);
    }
  });

  async function handleJsonFile(file) {
    const label = document.getElementById("dropZoneLabel");
    const metaArea = document.getElementById("uploadMetadataArea");
    
    label.textContent = `Carregando ${file.name}...`;
    metaArea.style.display = "none";

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed.model || !parsed.response_text) {
        throw new Error("JSON inválido: chaves 'model' ou 'response_text' ausentes.");
      }

      // Validar modelo
      const mLower = String(parsed.model).toLowerCase();
      let canonicalModel = null;
      let modelLabel = "";

      if (mLower.includes("gemma-4-31b") || mLower.includes("gemma 4 31b")) {
        canonicalModel = "models/gemma-4-31b-it";
        modelLabel = "Gemma 4 31B IT";
      } else if (mLower.includes("gemini-3.5-flash") || mLower.includes("gemini 3.5 flash")) {
        canonicalModel = "models/gemini-3.5-flash";
        modelLabel = "Gemini 3.5 Flash";
      } else if (mLower.includes("gpt-oss-120b") || mLower.includes("gpt oss 120b")) {
        canonicalModel = "groq/gpt-oss-120b";
        modelLabel = "GPT-OSS-120B";
      }

      if (!canonicalModel) {
        throw new Error(`Modelo "${parsed.model}" não é suportado pelo teste Crossover (Gemma 4 31B IT, GPT-OSS-120B, Gemini 3.5 Flash).`);
      }

      state.uploadedJSON = parsed;
      state.uploadedModel = canonicalModel;

      label.textContent = `✅ ${file.name} carregado`;
      
      const excerpt = typeof parsed.response_text === "string" 
        ? parsed.response_text.substring(0, 150) + "..." 
        : JSON.stringify(parsed.response_text).substring(0, 150) + "...";
      
      metaArea.innerHTML = `
        <div><strong>Modelo:</strong> ${modelLabel}</div>
        <div><strong>Latência:</strong> ${parsed.latency_ms || parsed.latency_sec * 1000 || 0} ms</div>
        <div><strong>Arquitetura original:</strong> ${parsed.use_maia_architecture ? "Com Maia" : "Sem Maia"}</div>
        <div style="margin-top: 4px; color: var(--color-text-secondary); white-space: pre-wrap; font-size: 0.75rem;"><strong>Resposta:</strong> ${excerpt}</div>
      `;
      metaArea.style.display = "flex";

      const checkMaia = document.getElementById("checkMaiaApendiceA");
      checkMaia.checked = parsed.use_maia_architecture === true;

      populateJudgeDropdown(canonicalModel);
      checkInputsAndShowConfig();

    } catch (err) {
      console.error(err);
      label.textContent = "❌ Falha no carregamento";
      customAlert(`⚠️ Erro ao ler JSON: ${err.message}`);
      state.uploadedJSON = null;
      state.uploadedModel = null;
      checkInputsAndShowConfig();
    }
  }

  function populateJudgeDropdown(excludeModel) {
  const select = document.getElementById("selectJudgeApendiceA");
  if (!select) return;

  // Duas opções dedicadas para o Gemini 3.5 Flash com IDs de roteamento diferentes
  const judges = [
    { id: "models/gemini-3.5-flash", label: "Gemini 3.5 Flash (Google AI Studio)" },
    { id: "vertex/gemini-3.5-flash", label: "Gemini 3.5 Flash (Vertex AI)" },
    { id: "models/gemma-4-31b-it", label: "Gemma 4 31B IT" },
    { id: "groq/gpt-oss-120b", label: "GPT-OSS-120B" }
  ].filter(m => m.id !== excludeModel);

  select.innerHTML = judges.map(j => `
    <option value="${j.id}">${j.label}</option>
  `).join("");
}

  function checkInputsAndShowConfig() {
    const configArea = document.getElementById("evaluationConfigArea");
    if (!configArea) return;

    if (state.selectedQuestion && state.uploadedJSON) {
      configArea.style.display = "flex";
    } else {
      configArea.style.display = "none";
    }
  }

  function renderQuestionPreview() {
    const preview = document.getElementById("apendiceAQuestionPreview");
    if (!preview || !state.selectedQuestion) return;

    preview.innerHTML = "";
    
    const { id, prova, fullData } = state.selectedQuestion;
    if (!fullData.meta) fullData.meta = {};
    if (!fullData.meta.material_origem) {
      fullData.meta.material_origem = prova.replace(/_/g, " ");
    }

    const card = criarCardTecnico(id, fullData);
    preview.appendChild(card);
    
    if (typeof renderLatexIn === "function") {
      renderLatexIn(card);
    }
  }

  const handleSelectedQuestionApendiceA = async (e) => {
    const questions = e.detail?.questions;
    if (questions && questions.length > 0) {
      const selected = questions[0];
      state.selectedQuestion = selected;
      renderQuestionPreview();
      
      const checkInter = document.getElementById("checkInterdisciplinaryApendiceA");
      if (checkInter) {
        const isFuvest = String(selected.prova || "").toUpperCase().includes("FUVEST") ||
                         String(selected.area || "").toUpperCase().includes("FUVEST") ||
                         String(selected.id || "").toUpperCase().includes("FUVEST");
        checkInter.checked = isFuvest;
      }
      
      checkInputsAndShowConfig();
    }
  };

  window.removeEventListener("questions-selected", window._currentApendiceAListener);
  window._currentApendiceAListener = handleSelectedQuestionApendiceA;
  window.addEventListener("questions-selected", handleSelectedQuestionApendiceA);

  btnRunEval.addEventListener("click", () => {
    runCrossEvaluation();
  });

  async function runCrossEvaluation() {
    const consoleArea = document.getElementById("evaluationConsoleArea");
    const statusMsg = document.getElementById("evaluationStatusMsg");
    const thoughtsBox = document.getElementById("evaluationThoughts");
    const responseBox = document.getElementById("evaluationJSONResponse");

    const judgeSelect = document.getElementById("selectJudgeApendiceA");
    if (!judgeSelect || !judgeSelect.value) {
      customAlert("⚠️ Selecione um modelo juiz para a avaliação.");
      return;
    }

    const judgeId = judgeSelect.value;
    // Define o nome amigável que vai aparecer na tela durante a avaliação
    const judgeLabel = judgeId === "vertex/gemini-3.5-flash" ? "Gemini 3.5 Flash (Vertex)" :
                      judgeId === "models/gemini-3.5-flash" ? "Gemini 3.5 Flash (AI Studio)" :
                      judgeId.includes("gemma") ? "Gemma 4 31B IT" : "GPT-OSS-120B";

    consoleArea.style.display = "flex";
    thoughtsBox.textContent = "";
    responseBox.textContent = "";

    const btnRun = document.getElementById("btnRunEvaluationApendiceA");
    const btnSelect = document.getElementById("btnSelectQuestionApendiceA");
    const dropZone = document.getElementById("dropZoneApendiceA");
    
    btnRun.disabled = true;
    btnSelect.disabled = true;
    dropZone.style.pointerEvents = "none";
    dropZone.style.opacity = "0.5";

    try {
      const qObj = state.selectedQuestion.fullData.dados_questao || {};
      const gObj = state.selectedQuestion.fullData.dados_gabarito || {};
      
      const enunciado = qObj.estrutura
        ? qObj.estrutura.map((b) => b.conteudo || "").join(" ")
        : qObj.enunciado || "";
      const gabaritoTexto = gObj.explicacao
        ? gObj.explicacao.flatMap((b) => (b.estrutura ? b.estrutura.map((i) => i.conteudo) : [])).join(" ")
        : gObj.justificativa_curta || "";
      const correctOption = gObj.alternativa_correta ? `Alternativa Correta: ${gObj.alternativa_correta}` : "";
      const fullGabaritoRef = `${correctOption}\n${gabaritoTexto}`;

      const respostaIA = state.uploadedJSON.response_text || "";
      
      const checkInter = document.getElementById("checkInterdisciplinaryApendiceA");
      const isInterdisciplinary = checkInter ? checkInter.checked : false;

      statusMsg.innerHTML = `<span class="spinner-sm" style="display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.1); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite; margin-right: 8px;"></span> Avaliando com ${judgeLabel}...`;
      
      const panel = document.getElementById("evaluationResultsPanel");
      if (panel) panel.style.display = "none";
      
      thoughtsBox.textContent = `=== CADEIA DE RACIOCÍNIO DO JUIZ (${judgeLabel}) ===\n\n`;
      responseBox.textContent = `=== RESPOSTA ESTRUTURADA DA AVALIAÇÃO (${judgeLabel}) ===\n\n`;

      const handlers = {
        onStatus: (msg) => {
          console.log(`[Juiz ${judgeLabel}] Status:`, msg);
        },
        onThought: (thought) => {
          thoughtsBox.textContent += thought;
          thoughtsBox.scrollTop = thoughtsBox.scrollHeight;
        },
        onReset: () => {
          if (panel) panel.style.display = "none";
          thoughtsBox.textContent = `=== CADEIA DE RACIOCÍNIO DO JUIZ (${judgeLabel}) ===\n\n`;
          responseBox.textContent = `=== RESPOSTA ESTRUTURADA DA AVALIAÇÃO (${judgeLabel}) ===\n\n`;
        },
        onAnswerDelta: (delta) => {
          responseBox.textContent += delta;
          responseBox.scrollTop = responseBox.scrollHeight;
        }
      };

      const isMultiPartJudge = judgeId.toLowerCase().includes("gemma") || 
                               judgeId.toLowerCase().includes("gpt-oss-120b") ||
                               judgeId.toLowerCase().includes("gpt oss 120b");

      let result;
      if (isMultiPartJudge) {
        const { executarAvaliacaoGemmaEmPartes } = await import("../chat/apendice-a-pipeline.js");
        
        let controlContainer = document.getElementById("gemmaControlContainer");
        if (!controlContainer) {
          controlContainer = document.createElement("div");
          controlContainer.id = "gemmaControlContainer";
          controlContainer.style.display = "none";
          controlContainer.style.gap = "10px";
          controlContainer.style.marginTop = "10px";
          consoleArea.appendChild(controlContainer);
        }

        const onPartAction = (partNumber, status, errorMsg, partResult, latencyMs, systemInstruction, promptOriginal) => {
          return new Promise((resolve) => {
            const isLast = partNumber === 4;
            controlContainer.style.display = "flex";
            
            if (status === "success") {
              statusMsg.innerHTML = `<span style="color: var(--color-success); font-weight: bold;">✅ Parte ${partNumber}/4 concluída com sucesso!</span>`;
              controlContainer.innerHTML = `
                <button id="btnRetryPart" class="btn btn--outline" style="padding: 6px 12px; font-size: 0.8rem; border: 1px solid var(--color-border); background: none; color: var(--color-text); border-radius: 4px; cursor: pointer;">🔄 Gerar Novamente Parte ${partNumber}</button>
                <button id="btnNextPart" class="btn btn--primary" style="padding: 6px 12px; font-size: 0.8rem; background: var(--color-primary); color: white; border: none; border-radius: 4px; cursor: pointer;">
                  ${isLast ? "🏁 Concluir Avaliação" : `Avançar para Parte ${partNumber + 1} →`}
                </button>
              `;
              
              document.getElementById("btnRetryPart").onclick = () => {
                controlContainer.style.display = "none";
                statusMsg.innerHTML = `<span class="spinner-sm" style="display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.1); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite; margin-right: 8px;"></span> Repetindo Parte ${partNumber}...`;
                resolve("retry");
              };
              document.getElementById("btnNextPart").onclick = () => {
                controlContainer.style.display = "none";
                statusMsg.innerHTML = `<span class="spinner-sm" style="display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.1); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite; margin-right: 8px;"></span> Salvando e carregando próxima etapa...`;
                resolve("next");
              };
            } else {
              statusMsg.innerHTML = `<span style="color: var(--color-error); font-weight: bold;">❌ Erro na Parte ${partNumber}/4: ${errorMsg}</span>`;
              controlContainer.innerHTML = `
                <button id="btnRetryPart" class="btn btn--primary" style="padding: 6px 12px; font-size: 0.8rem; background: var(--color-primary); color: white; border: none; border-radius: 4px; cursor: pointer;">🔄 Tentar Novamente Parte ${partNumber}</button>
                <button id="btnSkipPart" class="btn btn--outline" style="padding: 6px 12px; font-size: 0.8rem; border: 1px solid var(--color-border); background: none; color: var(--color-text); border-radius: 4px; cursor: pointer;">
                  ${isLast ? "🏁 Concluir com Erro" : `Pular para Parte ${partNumber + 1} →`}
                </button>
              `;
              
              document.getElementById("btnRetryPart").onclick = () => {
                controlContainer.style.display = "none";
                statusMsg.innerHTML = `<span class="spinner-sm" style="display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.1); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite; margin-right: 8px;"></span> Repetindo Parte ${partNumber}...`;
                resolve("retry");
              };
              document.getElementById("btnSkipPart").onclick = () => {
                controlContainer.style.display = "none";
                statusMsg.innerHTML = `<span class="spinner-sm" style="display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.1); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite; margin-right: 8px;"></span> Pulando Parte ${partNumber}...`;
                resolve("next");
              };
            }
          });
        };

        result = await executarAvaliacaoGemmaEmPartes(
          judgeId,
          enunciado,
          fullGabaritoRef,
          respostaIA,
          isInterdisciplinary,
          handlers,
          onPartAction
        );
      } else {
        const { executarAvaliacaoApendiceA } = await import("../chat/apendice-a-pipeline.js");
        result = await executarAvaliacaoApendiceA(
          judgeId,
          enunciado,
          fullGabaritoRef,
          respostaIA,
          isInterdisciplinary,
          handlers
        );
      }

      const useMaia = document.getElementById("checkMaiaApendiceA").checked;
      const modelKey = judgeId.includes("gemini") ? "gemini_3_5_flash" :
                       judgeId.includes("gemma") ? "gemma_4_31b_it" : "o1";

      let debugLog;
      if (isMultiPartJudge) {
        debugLog = [];
        // Add 4 individual generation items
        for (let i = 0; i < 4; i++) {
          const detail = (result.part_details || result.gemma_part_details)[i];
          debugLog.push({
            session_id: state.uploadedJSON.session_id || "nova_sessao",
            timestamp: new Date().toISOString(),
            use_maia_architecture: useMaia,
            model: judgeId,
            prompt_original: detail.prompt_original,
            prompt_compiled: detail.prompt_compiled,
            images_attached: 0,
            latency_ms: detail.latency_ms,
            routing_details: null,
            rag_details: null,
            search_details: null,
            response_text: detail.response_text
          });
        }
        // Add 5th summary item
        debugLog.push({
          total_latency_ms: result.latency_ms,
          avaliacao_juiz: {
            [modelKey]: {
              pontuacao_total: result.avaliacao_juiz.pontuacao_total,
              notas_grupo: result.avaliacao_juiz.notas_grupo
            }
          }
        });
      } else {
        debugLog = {
          session_id: state.uploadedJSON.session_id || "nova_sessao",
          timestamp: new Date().toISOString(),
          use_maia_architecture: useMaia,
          model: judgeId,
          prompt_original: result.prompt_original,
          prompt_compiled: result.prompt_compiled,
          images_attached: 0,
          latency_ms: result.latency_ms,
          routing_details: null,
          rag_details: null,
          search_details: null,
          response_text: result.response_text,
          avaliacao_juiz: {
            [modelKey]: {
              pontuacao_total: result.avaliacao_juiz.pontuacao_total,
              notas_grupo: result.avaliacao_juiz.notas_grupo
            }
          }
        };
      }

      window.chatDebugLogs = window.chatDebugLogs || [];
      const msgIndex = window.chatDebugLogs.length + 1;
      if (Array.isArray(debugLog)) {
        for (const item of debugLog) {
          item.msgIndex = msgIndex;
        }
        window.chatDebugLogs.push(...debugLog);
      } else {
        debugLog.msgIndex = msgIndex;
        window.chatDebugLogs.push(debugLog);
      }

      const seen = new WeakSet();
      const safeJson = JSON.stringify(debugLog, (key, value) => {
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) return "[Circular]";
          seen.add(value);
        }
        return value;
      }, 2);
      
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(safeJson);
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      
      const formattedTime = new Date().toISOString().replace(/[:.]/g, "-");
      const judgeSlug = judgeId === "vertex/gemini-3.5-flash" ? "gemini_3_5_flash_vertex" :
                        judgeId === "models/gemini-3.5-flash" ? "gemini_3_5_flash_aistudio" :
                        judgeId.includes("gemma") ? "gemma_4_31b_it" : "gpt_oss_120b";
      const filename = `maia_debug_${useMaia ? 'com' : 'sem'}_arq_${state.selectedQuestion.id}_${judgeSlug}_${formattedTime}.json`;
      downloadAnchor.setAttribute("download", filename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      statusMsg.innerHTML = `✅ Avaliação com ${judgeLabel} concluída e baixada com sucesso!`;

      // Renderiza as notas consolidadas na interface do usuário
      if (result.avaliacao_juiz) {
        const totalScoreEl = document.getElementById("resTotalScore");
        const groupsListEl = document.getElementById("resGroupsList");
        
        const maxScore = isInterdisciplinary ? 150 : 100;
        totalScoreEl.textContent = `${result.avaliacao_juiz.pontuacao_total} / ${maxScore}`;
        
        const notas = result.avaliacao_juiz.notas_grupo || {};
        let html = "";
        
        const labels = {
          grupo_a: "Grupo A - Estética Básica (Máx: 7)",
          grupo_b: "Grupo B - Factual e Interpretação (Máx: 14)",
          grupo_c: "Grupo C - Didática e Pedagogia (Máx: 21)",
          grupo_d: "Grupo D - Lógica e Eliminação (Máx: 28)",
          grupo_e: "Grupo E - Engenharia Resolução (Máx: 30)"
        };
        
        if (isInterdisciplinary) {
          labels.grupo_f = "Grupo F - Interdisciplinar FUVEST (Máx: 50)";
        }
        
        for (const key of Object.keys(labels)) {
          const score = notas[key] !== undefined ? notas[key] : 0;
          html += `
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; opacity: 0.9; margin-top: 2px;">
              <span style="color: var(--color-text-secondary);">${labels[key]}:</span>
              <span style="font-weight: bold; color: var(--color-text);">${score}</span>
            </div>
          `;
        }
        groupsListEl.innerHTML = html;
        if (panel) panel.style.display = "flex";
      }

    } catch (error) {
      console.error("Erro na avaliação cruzada:", error);
      statusMsg.innerHTML = `❌ Erro: ${error.message}`;
    } finally {
      btnRun.disabled = false;
      btnSelect.disabled = false;
      dropZone.style.pointerEvents = "auto";
      dropZone.style.opacity = "1";
    }
  }

  // Voltar ao início
  const voltarBtn = document.querySelector(".js-voltar-inicio");
  voltarBtn?.addEventListener("click", () => {
    // Limpa listener
    window.removeEventListener("questions-selected", window._currentApendiceAListener);
    gerarTelaInicial();
  });
}
