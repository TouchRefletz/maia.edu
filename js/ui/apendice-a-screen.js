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

let evaluationAbortController = null;
let userExited = false;
let activePartActionResolve = null;

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
          <button id="tabApendiceAResultados" class="nav-tab-btn" style="flex: 1; border: 1px solid var(--color-border); border-radius: 6px; padding: 10px; background: none; color: var(--color-text-secondary); cursor: pointer; font-weight: bold; transition: all 0.2s;">
            📊 Resultados Consolidados
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
              <div style="display: flex; gap: 10px; margin-top: 8px;">
                <button id="btnRunEvaluationApendiceA" class="btn btn--primary" style="flex: 1; padding: 12px; font-weight: bold; background: var(--color-primary); color: white; display: flex; align-items: center; justify-content: center; gap: 8px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.95rem;">
                  🚀 Executar Avaliação Cruzada
                </button>
                <button id="btnAbortEvaluationApendiceA" class="btn" style="display: none; padding: 12px; font-weight: bold; background: #dc3545; color: white; align-items: center; justify-content: center; gap: 8px; border: none; border-radius: 6px; cursor: pointer; font-size: 0.95rem;">
                  🛑 Interromper Geração
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

        <!-- CONTAINER 3: Resultados Consolidados -->
        <div id="containerApendiceAResultados" style="display: none;">
          <div id="dashboardLoader" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px;">
            <div class="admin-spinner" style="width: 40px; height: 40px; border-width: 4px;"></div>
            <p style="margin-top: 15px; font-weight: 500; color: var(--color-text-secondary);">Carregando estatísticas e cruzamentos...</p>
          </div>
          <div id="dashboardContent" style="display: none; flex-direction: column; gap: 24px;">
            <!-- Resultados renderizados aqui -->
          </div>
        </div>

      </div>
    </div>
  `;

  // Setup Listeners das Abas
  const tabSorteio = document.getElementById("tabApendiceASorteio");
  const tabAvaliacao = document.getElementById("tabApendiceAAvaliacao");
  const tabResultados = document.getElementById("tabApendiceAResultados");
  const cSorteio = document.getElementById("containerApendiceASorteio");
  const cAvaliacao = document.getElementById("containerApendiceAAvaliacao");
  const cResultados = document.getElementById("containerApendiceAResultados");

  tabSorteio.addEventListener("click", () => {
    userExited = true;
    evaluationAbortController?.abort();
    if (activePartActionResolve) {
      activePartActionResolve("cancel");
      activePartActionResolve = null;
    }
    tabSorteio.style.background = "var(--color-primary)";
    tabSorteio.style.color = "var(--color-btn-primary-text)";
    tabSorteio.classList.add("active");
    
    tabAvaliacao.style.background = "none";
    tabAvaliacao.style.color = "var(--color-text-secondary)";
    tabAvaliacao.classList.remove("active");

    tabResultados.style.background = "none";
    tabResultados.style.color = "var(--color-text-secondary)";
    tabResultados.classList.remove("active");
    
    cSorteio.style.display = "block";
    cAvaliacao.style.display = "none";
    cResultados.style.display = "none";
  });

  tabAvaliacao.addEventListener("click", () => {
    tabAvaliacao.style.background = "var(--color-primary)";
    tabAvaliacao.style.color = "var(--color-btn-primary-text)";
    tabAvaliacao.classList.add("active");
    
    tabSorteio.style.background = "none";
    tabSorteio.style.color = "var(--color-text-secondary)";
    tabSorteio.classList.remove("active");

    tabResultados.style.background = "none";
    tabResultados.style.color = "var(--color-text-secondary)";
    tabResultados.classList.remove("active");
    
    cSorteio.style.display = "none";
    cAvaliacao.style.display = "block";
    cResultados.style.display = "none";
  });

  tabResultados.addEventListener("click", () => {
    userExited = true;
    evaluationAbortController?.abort();
    if (activePartActionResolve) {
      activePartActionResolve("cancel");
      activePartActionResolve = null;
    }
    tabResultados.style.background = "var(--color-primary)";
    tabResultados.style.color = "var(--color-btn-primary-text)";
    tabResultados.classList.add("active");
    
    tabSorteio.style.background = "none";
    tabSorteio.style.color = "var(--color-text-secondary)";
    tabSorteio.classList.remove("active");

    tabAvaliacao.style.background = "none";
    tabAvaliacao.style.color = "var(--color-text-secondary)";
    tabAvaliacao.classList.remove("active");
    
    cSorteio.style.display = "none";
    cAvaliacao.style.display = "none";
    cResultados.style.display = "block";

    carregarDashboardApendiceA();
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
        areaFilter = "Interdisciplinar";
      } else if (areaFilter === "Matemática") {
        areaFilter = "Matematica";
      } else if (areaFilter === "Ciências da Natureza") {
        areaFilter = "Natureza";
      } else if (areaFilter === "Ciências Humanas") {
        areaFilter = "Humanas";
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
      
      let seed = 2026;
      if (selectArea.value === "Matemática") {
        seed = 2027;
      } else if (selectArea.value === "Ciências da Natureza") {
        seed = 2028;
      } else if (selectArea.value === "Ciências Humanas") {
        seed = 2029;
      } else if (selectArea.value === "Interdisciplinar FUVEST") {
        seed = 2030;
      }

      const rand = new SeededRandom(seed);
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

      // Para evitar viés de avaliação cruzada (onde os mesmos modelos sempre avaliam as mesmas posições),
      // embaralhamos a lista de alocação de modelos usando o mesmo gerador aleatório semeado,
      // exceto para a área de Linguagens (para manter compatibilidade com o sorteio original histórico).
      if (selectArea.value !== "Linguagens") {
        for (let i = alocacoes.length - 1; i > 0; i--) {
          const j = Math.floor(rand.next() * (i + 1));
          const temp = alocacoes[i];
          alocacoes[i] = alocacoes[j];
          alocacoes[j] = temp;
        }
      }

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
            Semente: ${seed}
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
  const btnAbort = document.getElementById("btnAbortEvaluationApendiceA");

  btnSelectQuestion.addEventListener("click", () => {
    openAddQuestionsModal();
  });

  btnAbort?.addEventListener("click", () => {
    evaluationAbortController?.abort();
    btnAbort.style.display = "none";
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
    const btnAbort = document.getElementById("btnAbortEvaluationApendiceA");
    
    userExited = false;
    activePartActionResolve = null;
    evaluationAbortController = new AbortController();
    const abortSignal = evaluationAbortController.signal;
    
    btnRun.disabled = true;
    btnSelect.disabled = true;
    dropZone.style.pointerEvents = "none";
    dropZone.style.opacity = "0.5";
    if (btnAbort) {
      btnAbort.style.display = "flex";
    }

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

      const evaluationHandlers = {
        ...handlers,
        signal: abortSignal,
        isExited: () => userExited
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
        } else {
          controlContainer.style.display = "none";
        }

        const onPartAction = (partNumber, status, errorMsg, partResult, latencyMs, systemInstruction, promptOriginal) => {
          return new Promise((resolve) => {
            activePartActionResolve = resolve;
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
                evaluationAbortController = new AbortController();
                evaluationHandlers.signal = evaluationAbortController.signal;
                const btnAbort = document.getElementById("btnAbortEvaluationApendiceA");
                if (btnAbort) btnAbort.style.display = "flex";
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
                evaluationAbortController = new AbortController();
                evaluationHandlers.signal = evaluationAbortController.signal;
                const btnAbort = document.getElementById("btnAbortEvaluationApendiceA");
                if (btnAbort) btnAbort.style.display = "flex";
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
          evaluationHandlers,
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
          evaluationHandlers,
          abortSignal
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
      if (error.message === "USER_CANCELLED") {
        return;
      }
      console.error("Erro na avaliação cruzada:", error);
      if (error.name === "AbortError" || abortSignal?.aborted || evaluationAbortController?.signal?.aborted) {
        statusMsg.innerHTML = `🛑 Geração interrompida pelo usuário.`;
      } else {
        statusMsg.innerHTML = `❌ Erro: ${error.message}`;
      }
    } finally {
      btnRun.disabled = false;
      btnSelect.disabled = false;
      dropZone.style.pointerEvents = "auto";
      dropZone.style.opacity = "1";
      if (btnAbort) {
        btnAbort.style.display = "none";
      }
    }
  }

  // Voltar ao início
  const voltarBtn = document.querySelector(".js-voltar-inicio");
  voltarBtn?.addEventListener("click", () => {
    userExited = true;
    evaluationAbortController?.abort();
    if (activePartActionResolve) {
      activePartActionResolve("cancel");
      activePartActionResolve = null;
    }
    // Limpa listener
    window.removeEventListener("questions-selected", window._currentApendiceAListener);
    gerarTelaInicial();
  });
}

// -------------------------------------------------------------
// NOVO CONTAINER: DASHBOARD DE RESULTADOS (Interativo com Chart.js & Plotly.js)
// -------------------------------------------------------------
let dashboardCarregado = false;

async function carregarDashboardApendiceA() {
  if (dashboardCarregado) return; // Carrega apenas uma vez por inicialização da tela
  
  const loader = document.getElementById("dashboardLoader");
  const content = document.getElementById("dashboardContent");
  
  try {
    // 1. Carrega Chart.js e Plotly.js de forma assíncrona se não estiverem disponíveis
    await Promise.all([
      new Promise((resolve, reject) => {
        if (window.Chart) return resolve();
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/chart.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      }),
      new Promise((resolve, reject) => {
        if (window.Plotly) return resolve();
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/plotly.js-dist-min";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      })
    ]);

    // 2. Carrega estatísticas compiladas do arquivo JSON
    const response = await fetch("../../experiments/stats_summary_apendice_a.json");
    if (!response.ok) {
      throw new Error(`Não foi possível ler as estatísticas de validação (../../experiments/stats_summary_apendice_a.json).`);
    }
    const stats = await response.json();

    // 3. Oculta loader e renderiza esqueleto do Dashboard
    loader.style.display = "none";
    content.style.display = "flex";
    
    renderDashboardUIApendiceA(content, stats);
    dashboardCarregado = true;
    
  } catch (error) {
    console.error("Erro ao iniciar dashboard do Apêndice A:", error);
    loader.innerHTML = `
      <div style="background: rgba(220, 53, 69, 0.08); border: 1px solid rgba(220, 53, 69, 0.3); border-radius: 8px; padding: 16px; color: var(--color-error); text-align: center; max-width: 500px;">
        <span style="font-size: 1.5rem; display:block; margin-bottom:10px;">⚠️ Falha no Carregamento</span>
        <p style="margin: 0; font-size: 0.85rem; line-height:1.4;">${error.message}</p>
        <button class="btn btn--outline" onclick="window.location.reload()" style="margin-top:15px; border-color: var(--color-border); color: var(--color-text);">Recarregar Página</button>
      </div>
    `;
  }
}

function renderDashboardUIApendiceA(container, stats) {
  // Gerar esqueleto com cabeçalho de abas e os containers de conteúdo
  container.innerHTML = `
    <!-- Estilos Premium Inline -->
    <style>
      .ap-tabs-header {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        border-bottom: 2px solid var(--color-border);
        margin-bottom: 20px;
        padding-bottom: 8px;
      }
      .ap-tab-btn {
        background: none;
        border: none;
        padding: 10px 18px;
        color: var(--color-text-secondary);
        font-weight: 500;
        font-size: 0.9rem;
        cursor: pointer;
        border-bottom: 3px solid transparent;
        transition: all 0.2s ease-in-out;
        border-radius: 4px 4px 0 0;
      }
      .ap-tab-btn:hover {
        background: rgba(255, 255, 255, 0.03);
        color: var(--color-text-shine);
      }
      .ap-tab-btn.active {
        color: var(--color-primary);
        font-weight: bold;
        border-bottom-color: var(--color-primary);
        background: rgba(var(--color-primary-rgb), 0.05);
      }
      .ap-tab-content {
        animation: fadeIn 0.3s ease-in-out;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .charts-grid-2 {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(460px, 1fr));
        gap: 20px;
        margin-bottom: 20px;
      }
      .chart-card-full {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        margin-bottom: 20px;
      }
      .chart-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        padding: 16px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .chart-card h4 {
        margin: 0 0 12px 0;
        font-size: 0.95rem;
        color: var(--color-text-shine);
        border-left: 3px solid var(--color-primary);
        padding-left: 8px;
      }
      .chart-canvas-container {
        height: 260px;
        position: relative;
        width: 100%;
      }
      .stats-card-kpi {
        background: linear-gradient(135deg, rgba(var(--color-primary-rgb), 0.04) 0%, rgba(167, 93, 244, 0.04) 100%);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        padding: 15px;
        text-align: center;
      }
      .stats-card-kpi .kpi-val {
        font-size: 1.8rem;
        font-weight: bold;
        color: var(--color-text-shine);
        margin: 5px 0;
      }
      .stats-table-compact {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
        margin-top: 10px;
      }
      .stats-table-compact th, .stats-table-compact td {
        padding: 8px;
        border-bottom: 1px solid var(--color-border);
      }
      .stats-table-compact th {
        color: var(--color-text-shine);
        font-weight: 600;
        text-align: left;
        background: rgba(255,255,255,0.02);
      }
    </style>

    <!-- Cabeçalho de Ações e Sub-Abas -->
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; flex-wrap: wrap; gap: 15px; border-bottom: 2px solid var(--color-border); padding-bottom: 2px;">
      <div class="ap-tabs-header" style="margin-bottom: 0; padding-bottom: 0; border-bottom: none;">
        <button class="ap-tab-btn active" data-tab="gerais">📈 Estatísticas Gerais</button>
        <button class="ap-tab-btn" data-tab="criterios">📋 Critérios & Conformidade</button>
        <button class="ap-tab-btn" data-tab="modelos">🤖 Modelos & Juízes</button>
        <button class="ap-tab-btn" data-tab="latencias">⏱️ Latência & Performance</button>
      </div>
      <button id="btn-export-html-static" class="btn btn--outline" style="display: inline-flex; align-items: center; gap: 8px; font-weight: bold; border-color: var(--color-success); color: var(--color-success); padding: 8px 16px; border-radius: 6px; font-size: 0.85rem; background: none; cursor: pointer; transition: all 0.2s; margin-bottom: 8px;">
        📥 Exportar Relatório Científico (HTML Estático)
      </button>
    </div>

    <!-- Conteúdos das Sub-Abas -->
    <div id="tab-content-container">
      
      <!-- Sub-Aba 1: Estatísticas Gerais -->
      <div class="ap-tab-content" id="ap-tab-gerais" style="display: block;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 20px;">
          <div class="stats-card-kpi">
            <div style="font-size:0.75rem; text-transform:uppercase; color:var(--color-primary); font-weight:bold;">Amostras Totais (N)</div>
            <div class="kpi-val">${stats.n_total} questões pareadas</div>
            <div style="font-size:0.7rem; color:var(--color-text-secondary);">150 auditorias processadas</div>
          </div>
          <div class="stats-card-kpi">
            <div style="font-size:0.75rem; text-transform:uppercase; color:#a75df4; font-weight:bold;">Ganho Médio Likert</div>
            <div class="kpi-val" style="color: var(--color-success);">+${(stats.metrics.total.experimental.mean - stats.metrics.total.control.mean).toFixed(2)} pts</div>
            <div style="font-size:0.7rem; color:var(--color-text-secondary);">Evolução absoluta total</div>
          </div>
          <div class="stats-card-kpi">
            <div style="font-size:0.75rem; text-transform:uppercase; color:#f97316; font-weight:bold;">Kruskal-Wallis p</div>
            <div class="kpi-val" style="color: ${stats.kruskal_wallis.pValue < 0.05 ? 'var(--color-success)' : 'var(--color-text)'};">${stats.kruskal_wallis.pValue.toFixed(4)}</div>
            <div style="font-size:0.7rem; color:var(--color-text-secondary);">${stats.kruskal_wallis.pValue < 0.05 ? 'Variabilidade estatisticamente real' : 'Sem variabilidade real'}</div>
          </div>
        </div>

        <div class="charts-grid-2">
          <div class="chart-card">
            <h4>1. Distribuição de Notas Totais (Boxplot)</h4>
            <div id="chart-boxplot-total" style="height: 260px;"></div>
          </div>
          <div class="chart-card">
            <h4>2. Densidade de Probabilidade de Notas (Violin)</h4>
            <div id="chart-violin-total" style="height: 260px;"></div>
          </div>
        </div>

        <div class="charts-grid-2">
          <div class="chart-card">
            <h4>3. Aproveitamento Médio por Grupo de Critérios (%)</h4>
            <div class="chart-canvas-container"><canvas id="chart-radar-grupos"></canvas></div>
          </div>
          <div class="chart-card">
            <h4>4. Integral Acumulada de Ganhos Pedagógicos</h4>
            <div class="chart-canvas-container"><canvas id="chart-linha-acumulada"></canvas></div>
          </div>
        </div>

        <div class="chart-card-full">
          <h4>8. Agrupamento de Questões por Nota e Latência (K-Means Clustering)</h4>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; align-items:start;">
            <div id="chart-kmeans-scatter" style="height: 280px;"></div>
            <div>
              <span style="font-size: 0.8rem; color: var(--color-text-secondary); display:block; margin-bottom:10px;">
                O K-Means agrupa as 25 questões da amostra com base em seu desempenho (nota total) e custo temporal (segundos de latência) para identificar perfis operacionais de questões.
              </span>
              <table class="stats-table-compact">
                <thead>
                  <tr>
                    <th>Cluster</th>
                    <th>Centroide (Latência / Nota)</th>
                    <th>Itens</th>
                  </tr>
                </thead>
                <tbody>
                  ${stats.kmeans_clusters.map(c => `
                    <tr>
                      <td><strong>Cluster ${c.id + 1}</strong></td>
                      <td>${c.centroid.x.toFixed(1)}s / ${c.centroid.y.toFixed(1)} pts</td>
                      <td><span style="font-family:monospace; font-size:0.75rem;">${c.points_count} itens</span></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="chart-card-full">
          <h4>5, 6 e 7. Resultados Wilcoxon Pareado e Kruskal-Wallis</h4>
          <table class="stats-table-compact">
            <thead>
              <tr>
                <th>Dimensão Likert</th>
                <th>Média Controle</th>
                <th>Média Experimental</th>
                <th>Delta (Δ)</th>
                <th>Wilcoxon p-value</th>
                <th>Significância</th>
              </tr>
            </thead>
            <tbody>
              ${Object.keys(stats.metrics).filter(k => k !== "iep").map(k => {
                const m = stats.metrics[k];
                const delta = m.experimental.mean - m.control.mean;
                const sig = m.wilcoxon.significant ? "✔️ Significativo (p < 0.05)" : "Não Significativo";
                return `
                  <tr>
                    <td><strong>${m.label}</strong></td>
                    <td>${m.control.mean.toFixed(2)}</td>
                    <td>${m.experimental.mean.toFixed(2)}</td>
                    <td style="font-weight:bold; color: ${delta > 0 ? 'var(--color-success)' : delta < 0 ? 'var(--color-error)' : 'inherit'};">${delta >= 0 ? "+" : ""}${delta.toFixed(2)}</td>
                    <td>${m.wilcoxon.pValue !== null ? m.wilcoxon.pValue.toFixed(4) : "N/A"}</td>
                    <td style="color:${m.wilcoxon.significant ? 'var(--color-success)' : 'inherit'}">${sig}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Sub-Aba 2: Critérios & Conformidade -->
      <div class="ap-tab-content" id="ap-tab-criterios" style="display: none;">
        <div class="chart-card-full">
          <h4>9. Taxa de Conformidade do Checklist (Controle vs. Experimental)</h4>
          <div style="height: 400px; position:relative;">
            <canvas id="chart-checklist-conformity"></canvas>
          </div>
        </div>

        <div class="charts-grid-2">
          <div class="chart-card">
            <h4>10. Matriz de Ganho Líquido por Subcritério (Transition Matrix)</h4>
            <div id="chart-transicao-heatmap" style="height:260px;"></div>
          </div>
          <div class="chart-card">
            <h4>23. Correlação de Spearman entre Grupos de Notas</h4>
            <div id="chart-spearman-heatmap" style="height:260px;"></div>
          </div>
        </div>

        <div class="charts-grid-2">
          <div class="chart-card">
            <h4>11. Desempenho Pedagógico Avançado (%)</h4>
            <div class="chart-canvas-container"><canvas id="chart-pedagogia-avancada"></canvas></div>
          </div>
          <div class="chart-card">
            <h4>12. Taxa de Erro no Grupo B (Ancoragem Factual)</h4>
            <div class="chart-canvas-container"><canvas id="chart-ancoragem-erros"></canvas></div>
          </div>
        </div>

        <div class="charts-grid-2">
          <div class="chart-card">
            <h4>13. Taxa de Redundância e Concisão (Ausência de Enrolação)</h4>
            <div class="chart-canvas-container"><canvas id="chart-con-redundancia"></canvas></div>
          </div>
          <div class="chart-card">
            <h4>14. Desconstrução Conceitual de Pegadinhas nos Distratores</h4>
            <div class="chart-canvas-container"><canvas id="chart-des-pegadinhas"></canvas></div>
          </div>
        </div>

        <div class="charts-grid-2">
          <div class="chart-card">
            <h4>15. Robustez de Formatação (Ausência de Tags Quebradas)</h4>
            <div class="chart-canvas-container"><canvas id="chart-tags-quebradas"></canvas></div>
          </div>
          <div class="chart-card">
            <h4>16. Refutação de Distratores por Alternativa</h4>
            <div class="chart-canvas-container"><canvas id="chart-distratores-refutacao"></canvas></div>
          </div>
        </div>

        <div class="charts-grid-2">
          <div class="chart-card">
            <h4>17. Aplicação Nominal de Arcabouço Teórico</h4>
            <div class="chart-canvas-container"><canvas id="chart-arcabouco-nominal"></canvas></div>
          </div>
          <div class="chart-card">
            <h4>18. Clareza de Gabarito (Indicação da Letra)</h4>
            <div class="chart-canvas-container"><canvas id="chart-clareza-gabarito"></canvas></div>
          </div>
        </div>

        <div class="charts-grid-2">
          <div class="chart-card">
            <h4>19. Distribuição de Notas no Grupo D (Lógica Dedutiva e Eliminação)</h4>
            <div id="chart-violino-grupo-d" style="height:260px;"></div>
          </div>
          <div class="chart-card">
            <h4>20. Engajamento Visual (Uso de Recursos Didáticos Especiais)</h4>
            <div class="chart-canvas-container"><canvas id="chart-recursos-didaticos-visuais"></canvas></div>
          </div>
        </div>

        <div class="charts-grid-2">
          <div class="chart-card">
            <h4>21. Explicação Conceitual de Termos-Chave</h4>
            <div class="chart-canvas-container"><canvas id="chart-definicao-termos"></canvas></div>
          </div>
          <div class="chart-card">
            <h4>22. Cadeia Explicativa e Ausência de Saltos Lógicos</h4>
            <div class="chart-canvas-container"><canvas id="chart-ausencia-saltos"></canvas></div>
          </div>
        </div>
      </div>

      <!-- Sub-Aba 3: Modelos & Juízes -->
      <div class="ap-tab-content" id="ap-tab-modelos" style="display: none;">
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:15px; margin-bottom:20px;">
          <div class="stats-card-kpi" style="background: rgba(78, 130, 238, 0.04);">
            <div style="font-size:0.75rem; text-transform:uppercase; color:#4e82ee; font-weight:bold;">Juiz Gemini 3.5 Flash</div>
            <div style="font-size: 0.85rem; margin-top:5px; color:var(--color-text);">Concordância Inter-rater</div>
            <div class="kpi-val" style="color:var(--color-primary);">${(stats.inter_rater_agreement.percent_agreement * 100).toFixed(1)}%</div>
          </div>
          <div class="stats-card-kpi" style="background: rgba(167, 93, 244, 0.04);">
            <div style="font-size:0.75rem; text-transform:uppercase; color:#a75df4; font-weight:bold;">Juiz Gemma 4 31B IT</div>
            <div style="font-size: 0.85rem; margin-top:5px; color:var(--color-text);">Fleiss' Kappa (Reliability)</div>
            <div class="kpi-val" style="color:#a75df4;">${stats.inter_rater_agreement.fleiss_kappa.toFixed(3)}</div>
          </div>
          <div class="stats-card-kpi" style="background: rgba(249, 115, 22, 0.04);">
            <div style="font-size:0.75rem; text-transform:uppercase; color:#f97316; font-weight:bold;">Juiz GPT-OSS-120B</div>
            <div style="font-size: 0.85rem; margin-top:5px; color:var(--color-text);">Consistência da Auditoria</div>
            <div class="kpi-val" style="color:#f97316;">Moderada/Limiar</div>
          </div>
        </div>

        <div class="charts-grid-2">
          <div class="chart-card">
            <h4>24. Variabilidade e Rigor dos Juízes (Pontuação Dada)</h4>
            <div id="chart-boxplot-juizes" style="height:260px;"></div>
          </div>
          <div class="chart-card">
            <h4>26. Dispersão de Latência de Geração por Modelo</h4>
            <div id="chart-scatter-latencia-modelos" style="height:260px;"></div>
          </div>
        </div>

        <div class="charts-grid-2">
          <div class="chart-card">
            <h4>28. Densidade de Palavras e Justificativas de Auditoria (Evidências)</h4>
            <div id="chart-word-density-evidencia" style="height:260px;"></div>
          </div>
          <div class="chart-card">
            <h4>27. Projeção Financeira e Custo por 1.000 Requisições</h4>
            <div>
              <span style="font-size:0.75rem; color:var(--color-text-secondary); display:block; margin-bottom:8px;">
                Simulação financeira baseada nos preços por milhão de tokens de input/output da Artificial Analysis.
              </span>
              <table class="stats-table-compact">
                <thead>
                  <tr>
                    <th>Modelo</th>
                    <th>Custo Input (M)</th>
                    <th>Custo Output (M)</th>
                    <th>Custo / 1K Req Est.</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Gemini 3.5 Flash</strong></td>
                    <td>$0.075</td>
                    <td>$0.30</td>
                    <td><strong>$0.45</strong></td>
                  </tr>
                  <tr>
                    <td><strong>Gemma 4 31B IT (Open)</strong></td>
                    <td>$0.030</td>
                    <td>$0.12</td>
                    <td><strong>$0.18</strong></td>
                  </tr>
                  <tr>
                    <td><strong>GPT-OSS-120B</strong></td>
                    <td>$0.600</td>
                    <td>$2.40</td>
                    <td><strong>$3.60</strong></td>
                  </tr>
                </tbody>
              </table>
              <span style="font-size:0.7rem; color:var(--color-success); display:block; margin-top:8px; font-weight:bold;">
                * Gemma 4 sob Maia.edu gera economia de até 95% em relação ao GPT-OSS com performance alinhada!
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Sub-Aba 4: Latência & Performance -->
      <div class="ap-tab-content" id="ap-tab-latencias" style="display: none;">
        <div class="charts-grid-2">
          <div class="chart-card">
            <h4>29. Pizza de Divisão de Latência (Desdobramento)</h4>
            <div class="chart-canvas-container"><canvas id="chart-pie-latencias"></canvas></div>
          </div>
          <div class="chart-card">
            <h4>30. Dispersão: Tempo de Rota vs. Tempo de Geração</h4>
            <div id="chart-scatter-rota-geracao" style="height:260px;"></div>
          </div>
        </div>

        <div class="charts-grid-2">
          <div class="chart-card">
            <h4>31. Estabilidade de Latência ao Longo das Rodadas</h4>
            <div class="chart-canvas-container"><canvas id="chart-latencia-sessao"></canvas></div>
          </div>
          <div class="chart-card">
            <h4>32. Velocidade de Escrita e Geração (Caracteres/ms)</h4>
            <div class="chart-canvas-container"><canvas id="chart-velocidade-escrita"></canvas></div>
          </div>
        </div>

        <div class="charts-grid-2">
          <div class="chart-card">
            <h4>33. Tempo de Recuperação de Memória vs. Sucesso Paramétrico</h4>
            <div id="chart-memory-vs-independence" style="height:260px;"></div>
          </div>
          <div class="chart-card">
            <h4>34. Estruturação Semântica Otimizada para Interfaces</h4>
            <div class="chart-canvas-container"><canvas id="chart-interface-efficiency"></canvas></div>
          </div>
        </div>

        <div class="charts-grid-2">
          <div class="chart-card">
            <h4>35. Flutuação de Latência ao Longo do Dia</h4>
            <div class="chart-canvas-container"><canvas id="chart-latencia-horario"></canvas></div>
          </div>
          <div class="chart-card">
            <h4>36. Tendência: Nota Final vs. Latência Total da Requisição</h4>
            <div id="chart-score-vs-total-latency" style="height:260px;"></div>
          </div>
        </div>

        <div class="chart-card-full">
          <h4>37. Dispersão de Eficiência de Processamento Pura (IEP por item)</h4>
          <div id="chart-iep-pure-scatter" style="height:280px;"></div>
        </div>
      </div>

    </div>
  `;

  // Inicializar controle de cliques das abas
  const tabButtons = container.querySelectorAll(".ap-tab-btn");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const tabName = btn.dataset.tab;
      showTab(tabName, container, stats);
    });
  });

  // Inicializar botão de exportação
  container.querySelector("#btn-export-html-static").addEventListener("click", () => {
    exportStaticHTMLReport(stats);
  });

  // Renderizar a primeira aba imediatamente (Lazy Render para o resto)
  showTab("gerais", container, stats);
}

// Handler de controle e Lazy Rendering por aba
const renderedTabs = { gerais: false, criterios: false, modelos: false, latencias: false };

function showTab(tabName, container, stats) {
  container.querySelectorAll(".ap-tab-content").forEach(el => el.style.display = "none");
  container.querySelectorAll(".ap-tab-btn").forEach(el => el.classList.remove("active"));
  
  container.querySelector(`#ap-tab-${tabName}`).style.display = "block";
  container.querySelector(`[data-tab="${tabName}"]`).classList.add("active");

  if (!renderedTabs[tabName]) {
    renderTabCharts(tabName, container, stats);
    renderedTabs[tabName] = true;
  }
}

function renderTabCharts(tabName, container, stats) {
  const isDark = document.body.classList.contains("dark-mode") || true; 
  const textColor = isDark ? "#cccccc" : "#333333";
  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

  const plotlyLayoutBase = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: textColor, size: 10 },
    margin: { t: 40, b: 40, l: 45, r: 25 },
    xaxis: { gridcolor: gridColor, zerolinecolor: gridColor },
    yaxis: { gridcolor: gridColor, zerolinecolor: gridColor }
  };

  const qData = stats.questions;
  const models = ["gemini-3.5-flash", "gemma-4-31b-it", "gpt-oss-120b"];

  const getMean = (arr) => {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  };

  // Global helper functions inside renderTabCharts
  const getRateCtrl = (key) => (qData.reduce((sum, q) => sum + (q.criterios_control[key]?.presence_rate || 0), 0) / stats.n_total) * 100;
  const getRateExp = (key) => (qData.reduce((sum, q) => sum + (q.criterios_experimental[key]?.presence_rate || 0), 0) / stats.n_total) * 100;

  // Helper simples para plotar barras comparativas
  const drawSimpleBar = (canvasId, labelCtrl, valCtrl, labelExp, valExp) => {
    new Chart(document.getElementById(canvasId).getContext("2d"), {
      type: "bar",
      data: {
        labels: [labelCtrl, labelExp],
        datasets: [{
          data: [valCtrl, valExp],
          backgroundColor: ["rgba(98, 104, 113, 0.8)", "rgba(33, 128, 141, 0.8)"]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: textColor } },
          y: { min: 0, max: 100, ticks: { color: textColor } }
        },
        plugins: { legend: { display: false } }
      }
    });
  };

  if (tabName === "gerais") {
    // 1. Boxplot Total (Plotly)
    const ctrlScores = qData.map(q => q.scores_control.total);
    const expScores = qData.map(q => q.scores_experimental.total);

    Plotly.newPlot("chart-boxplot-total", [
      { y: ctrlScores, type: "box", name: "Controle", marker: { color: "#626871" } },
      { y: expScores, type: "box", name: "Maia.edu", marker: { color: "#21808d" } }
    ], { ...plotlyLayoutBase }, { responsive: true });

    // 2. Violin Total (Plotly)
    Plotly.newPlot("chart-violin-total", [
      { y: ctrlScores, type: "violin", name: "Controle", marker: { color: "#626871" }, box: { visible: true }, meanline: { visible: true } },
      { y: expScores, type: "violin", name: "Maia.edu", marker: { color: "#21808d" }, box: { visible: true }, meanline: { visible: true } }
    ], { ...plotlyLayoutBase }, { responsive: true });

    // 3. Radar Grupos (Chart.js)
    const met = stats.metrics;
    new Chart(document.getElementById("chart-radar-grupos").getContext("2d"), {
      type: "radar",
      data: {
        labels: ["Estética (A)", "Ancoragem (B)", "Pedagogia (C)", "Lógica (D)", "Engenharia (E)"],
        datasets: [
          {
            label: "Controle (Modelos Puros)",
            data: [
              (met.grupo_a.control.mean / 7) * 100,
              (met.grupo_b.control.mean / 14) * 100,
              (met.grupo_c.control.mean / 21) * 100,
              (met.grupo_d.control.mean / 28) * 100,
              (met.grupo_e.control.mean / 30) * 100
            ],
            backgroundColor: "rgba(98, 104, 113, 0.2)",
            borderColor: "rgba(98, 104, 113, 0.85)",
            borderWidth: 1.5
          },
          {
            label: "Experimental (Maia.edu)",
            data: [
              (met.grupo_a.experimental.mean / 7) * 100,
              (met.grupo_b.experimental.mean / 14) * 100,
              (met.grupo_c.experimental.mean / 21) * 100,
              (met.grupo_d.experimental.mean / 28) * 100,
              (met.grupo_e.experimental.mean / 30) * 100
            ],
            backgroundColor: "rgba(33, 128, 141, 0.2)",
            borderColor: "rgba(33, 128, 141, 0.85)",
            borderWidth: 1.5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            angleLines: { color: gridColor },
            grid: { color: gridColor },
            pointLabels: { color: textColor, font: { size: 9 } },
            ticks: { display: false },
            suggestedMin: 50,
            suggestedMax: 100
          }
        },
        plugins: {
          legend: { labels: { color: textColor, font: { size: 9 } } }
        }
      }
    });

    // 4. Linha Cumulativa (Chart.js)
    let cumulative = 0;
    const cumGains = qData.map(q => {
      cumulative += (q.scores_experimental.total - q.scores_control.total);
      return cumulative;
    });

    new Chart(document.getElementById("chart-linha-acumulada").getContext("2d"), {
      type: "line",
      data: {
        labels: qData.map((_, idx) => `Q${idx+1}`),
        datasets: [{
          label: "Ganho Cumulativo Likert (Σ Δ)",
          data: cumGains,
          borderColor: "#a75df4",
          backgroundColor: "rgba(167, 93, 244, 0.08)",
          fill: true,
          tension: 0.1,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 8 } } },
          y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 9 } } }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });

    // 8. K-Means Scatter Plot (Plotly)
    const traces = stats.kmeans_clusters.map(cluster => {
      const pts = cluster.points.map(ptId => qData.find(q => q.id === ptId));
      return {
        x: pts.map(p => p.latencies_experimental.total_ms / 1000),
        y: pts.map(p => p.scores_experimental.total),
        mode: "markers",
        type: "scatter",
        name: `Cluster ${cluster.id + 1} (N=${cluster.points_count})`,
        text: cluster.points.map(id => id.replace("enem ", "")),
        marker: { size: 8 }
      };
    });

    Plotly.newPlot("chart-kmeans-scatter", traces, {
      ...plotlyLayoutBase,
      xaxis: { title: "Latência (s)", gridcolor: gridColor, zerolinecolor: gridColor },
      yaxis: { title: "Pontuação Total (Máx 100)", gridcolor: gridColor, zerolinecolor: gridColor }
    }, { responsive: true });
  }

  else if (tabName === "criterios") {
    const cKeys = Object.keys(qData[0].criterios_control);
    const cLabels = cKeys.map(k => k.replace(/_/g, " ").replace(/\b(a|b|c|d|e)\b/g, m => m.toUpperCase()));

    const ratesCtrl = cKeys.map(key => getRateCtrl(key));
    const ratesExp = cKeys.map(key => getRateExp(key));

    // 9. Checklist Conformity (Chart.js - Horizontal)
    new Chart(document.getElementById("chart-checklist-conformity").getContext("2d"), {
      type: "bar",
      data: {
        labels: cLabels,
        datasets: [
          {
            label: "Controle (%)",
            data: ratesCtrl,
            backgroundColor: "rgba(98, 104, 113, 0.7)"
          },
          {
            label: "Experimental (Maia.edu %)",
            data: ratesExp,
            backgroundColor: "rgba(33, 128, 141, 0.7)"
          }
        ]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { min: 0, max: 100, grid: { color: gridColor }, ticks: { color: textColor } },
          y: { grid: { display: false }, ticks: { color: textColor, font: { size: 8 } } }
        },
        plugins: {
          legend: { position: "top", labels: { color: textColor, font: { size: 10 } } }
        }
      }
    });

    // 10. Heatmap de Ganho Líquido (Plotly)
    const transitionGains = ratesExp.map((val, idx) => val - ratesCtrl[idx]);
    Plotly.newPlot("chart-transicao-heatmap", [{
      z: [transitionGains.slice(0, 17), transitionGains.slice(17, 34)],
      x: cLabels.slice(0, 17),
      y: ["Parte A", "Parte B"],
      type: "heatmap",
      colorscale: "Viridis"
    }], {
      ...plotlyLayoutBase,
      xaxis: { ticks: "", showgrid: false, zeroline: false },
      yaxis: { ticks: "", showgrid: false, zeroline: false }
    }, { responsive: true });

    // 23. Spearman Matrix Heatmap (Plotly)
    const groupsList = ["grupo_a", "grupo_b", "grupo_c", "grupo_d", "grupo_e"];
    const zValues = groupsList.map(g1 => groupsList.map(g2 => stats.spearman_matrix[g1][g2]));

    Plotly.newPlot("chart-spearman-heatmap", [{
      z: zValues,
      x: ["Estética (A)", "Ancoragem (B)", "Pedagogia (C)", "Lógica (D)", "Engenharia (E)"],
      y: ["Estética (A)", "Ancoragem (B)", "Pedagogia (C)", "Lógica (D)", "Engenharia (E)"],
      type: "heatmap",
      colorscale: "Bluered"
    }], {
      ...plotlyLayoutBase,
      xaxis: { ticks: "", showgrid: false, zeroline: false },
      yaxis: { ticks: "", showgrid: false, zeroline: false }
    }, { responsive: true });

    // 11. Pedagogia Avançada
    new Chart(document.getElementById("chart-pedagogia-avancada").getContext("2d"), {
      type: "bar",
      data: {
        labels: ["Analogia Avançada", "Metodologia Resolução"],
        datasets: [
          {
            label: "Controle",
            data: [getRateCtrl("recurso_didatico_avancado_analogia"), getRateCtrl("metodologia_de_resolucao_explicita")],
            backgroundColor: "rgba(98, 104, 113, 0.7)"
          },
          {
            label: "Maia.edu",
            data: [getRateExp("recurso_didatico_avancado_analogia"), getRateExp("metodologia_de_resolucao_explicita")],
            backgroundColor: "rgba(33, 128, 141, 0.7)"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: textColor } },
          y: { min:0, max:100, ticks: { color: textColor } }
        },
        plugins: { legend: { labels: { color: textColor } } }
      }
    });

    // 12. Erros de Ancoragem (Falso/Negativo no Grupo B)
    const ancKeys = ["citacao_direta_texto_apoio", "mencao_ao_comando_pergunta", "isolamento_dados_quantitativos", "ausencia_extrapolacao_hipotetica", "parafrase_fiel_das_premissas", "mencao_a_fontes_ou_rodape", "leitura_de_elementos_visuais"];
    const errRates = ancKeys.map(k => (1 - (qData.reduce((sum, q) => sum + (q.criterios_experimental[k]?.presence_rate || 0), 0) / stats.n_total)) * 100);

    new Chart(document.getElementById("chart-ancoragem-erros").getContext("2d"), {
      type: "bar",
      data: {
        labels: ancKeys.map(k => k.replace(/_/g, " ")),
        datasets: [{
          label: "Taxa de Erro (%)",
          data: errRates,
          backgroundColor: "rgba(220, 53, 69, 0.75)"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: textColor, font: { size: 7.5 } } },
          y: { min:0, max:100, ticks: { color: textColor } }
        },
        plugins: { legend: { display: false } }
      }
    });

    // 13. Rosca Redundância
    const conRate = getRateExp("ausencia_de_redundancia_vazia");
    new Chart(document.getElementById("chart-con-redundancia").getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["Direta/Concisas", "Redundantes"],
        datasets: [{
          data: [conRate, 100 - conRate],
          backgroundColor: ["#21808d", "rgba(220, 53, 69, 0.45)"]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: textColor } } }
      }
    });

    // 14. Desconstrução Conceitual
    drawSimpleBar("chart-des-pegadinhas", "Controle", getRateCtrl("mecanismo_do_erro_nos_distratores"), "Maia.edu", getRateExp("mecanismo_do_erro_nos_distratores"));

    // 15. Formatação
    const formatRate = getRateExp("ausencia_de_tags_corrompidas");
    new Chart(document.getElementById("chart-tags-quebradas").getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["Formatação Válida", "Tags Corrompidas"],
        datasets: [{
          data: [formatRate, 100 - formatRate],
          backgroundColor: ["#21808d", "rgba(220, 53, 69, 0.45)"]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: textColor } } }
      }
    });

    // 16. Refutação de Distratores
    new Chart(document.getElementById("chart-distratores-refutacao").getContext("2d"), {
      type: "bar",
      data: {
        labels: ["A", "B", "C", "Outros"],
        datasets: [
          {
            label: "Controle",
            data: [getRateCtrl("analise_isolada_distrator_A"), getRateCtrl("analise_isolada_distrator_B"), getRateCtrl("analise_isolada_distrator_C"), getRateCtrl("analise_isolada_distrator_restante")],
            backgroundColor: "rgba(98, 104, 113, 0.7)"
          },
          {
            label: "Maia.edu",
            data: [getRateExp("analise_isolada_distrator_A"), getRateExp("analise_isolada_distrator_B"), getRateExp("analise_isolada_distrator_C"), getRateExp("analise_isolada_distrator_restante")],
            backgroundColor: "rgba(33, 128, 141, 0.7)"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: textColor } },
          y: { min:0, max:100, ticks: { color: textColor } }
        },
        plugins: { legend: { labels: { color: textColor } } }
      }
    });

    // 17. Arcabouço Nominal
    drawSimpleBar("chart-arcabouco-nominal", "Controle", getRateCtrl("aplicacao_nominal_arcabouco_teorico"), "Maia.edu", getRateExp("aplicacao_nominal_arcabouco_teorico"));

    // 18. Clareza Gabarito
    const gabRate = getRateExp("declaracao_gabarito_indica_letra");
    new Chart(document.getElementById("chart-clareza-gabarito").getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["Gabarito Declarado", "Indireto/Omitido"],
        datasets: [{
          data: [gabRate, 100 - gabRate],
          backgroundColor: ["#21808d", "rgba(220, 53, 69, 0.45)"]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: textColor } } }
      }
    });

    // 19. Violino Grupo D (Plotly)
    const scoresDCtrl = qData.map(q => q.scores_control.grupo_d);
    const scoresDExp = qData.map(q => q.scores_experimental.grupo_d);
    Plotly.newPlot("chart-violino-grupo-d", [
      { y: scoresDCtrl, type: "violin", name: "Controle", marker: { color: "#626871" }, box: { visible: true } },
      { y: scoresDExp, type: "violin", name: "Maia.edu", marker: { color: "#21808d" }, box: { visible: true } }
    ], { ...plotlyLayoutBase }, { responsive: true });

    // 20. Recursos Visuais
    drawSimpleBar("chart-recursos-didaticos-visuais", "Controle", getRateCtrl("recurso_visual_de_destaque"), "Maia.edu", getRateExp("recurso_visual_de_destaque"));

    // 21. Definição Termos
    drawSimpleBar("chart-definicao-termos", "Controle", getRateCtrl("definicao_de_termos_chave"), "Maia.edu", getRateExp("definicao_de_termos_chave"));

    // 22. Cadeia Explicativa
    drawSimpleBar("chart-ausencia-saltos", "Controle", getRateCtrl("ausencia_de_saltos_logicos"), "Maia.edu", getRateExp("ausencia_de_saltos_logicos"));
  }

  else if (tabName === "modelos") {
    // 24. Rigor dos Juízes (Plotly Boxplot)
    const geminiDada = [];
    const gemmaDada = [];
    const gptDada = [];

    qData.forEach(q => {
      q.raw_evaluations.experimental.forEach(e => {
        if (e.judge === "gemini-3.5-flash") geminiDada.push(e.total);
        if (e.judge === "gemma-4-31b-it") gemmaDada.push(e.total);
        if (e.judge === "gpt-oss-120b") gptDada.push(e.total);
      });
    });

    Plotly.newPlot("chart-boxplot-juizes", [
      { y: geminiDada, type: "box", name: "Gemini 3.5 Flash", marker: { color: "#4e82ee" } },
      { y: gemmaDada, type: "box", name: "Gemma 4 31B IT", marker: { color: "#a75df4" } },
      { y: gptDada, type: "box", name: "GPT-OSS-120B", marker: { color: "#f97316" } }
    ], { ...plotlyLayoutBase }, { responsive: true });

    // 26. Dispersão de Latência por Modelo
    const scatterTraces = models.map(m => {
      const pts = qData.filter(q => q.generatorModel === m);
      return {
        x: pts.map(p => p.id.replace("enem ", "")),
        y: pts.map(p => p.latencies_experimental.total_ms / 1000),
        mode: "markers",
        type: "scatter",
        name: m,
        marker: { size: 9 }
      };
    });

    Plotly.newPlot("chart-scatter-latencia-modelos", scatterTraces, {
      ...plotlyLayoutBase,
      xaxis: { title: "Itens Pareados", gridcolor: gridColor },
      yaxis: { title: "Tempo de Execução (s)", gridcolor: gridColor }
    }, { responsive: true });

    // 28. Word density in justifications (Plotly Violin)
    const trueLengths = [];
    const falseLengths = [];
    qData.forEach(q => {
      Object.keys(q.criterios_experimental).forEach(k => {
        const c = q.criterios_experimental[k];
        if (c.presence_rate === 1.0) {
          trueLengths.push(c.evidencia_length);
        } else if (c.presence_rate === 0.0) {
          falseLengths.push(c.evidencia_length);
        }
      });
    });

    Plotly.newPlot("chart-word-density-evidencia", [
      { y: trueLengths, type: "violin", name: "Marcados como Presentes", marker: { color: "#21808d" } },
      { y: falseLengths, type: "violin", name: "Marcados como Ausentes", marker: { color: "#dc3545" } }
    ], { ...plotlyLayoutBase }, { responsive: true });
  }

  else if (tabName === "latencias") {
    // 29. Pizza Latência (Chart.js)
    const avgGen = getMean(qData.map(q => q.latencies_experimental.generation_ms)) / 1000;
    const avgMem = getMean(qData.map(q => q.latencies_experimental.memory_ms)) / 1000;
    const avgRot = getMean(qData.map(q => q.latencies_experimental.router_ms)) / 1000;

    new Chart(document.getElementById("chart-pie-latencias").getContext("2d"), {
      type: "pie",
      data: {
        labels: ["Geração do Output (s)", "Memory/RAG (s)", "Roteador Inteligente (s)"],
        datasets: [{
          data: [avgGen, avgMem, avgRot],
          backgroundColor: ["#21808d", "#a75df4", "#f97316"]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "right", labels: { color: textColor } } }
      }
    });

    // 30. Rota vs Geração
    const ptsRouter = qData.map(q => q.latencies_experimental.router_ms / 1000);
    const ptsGen = qData.map(q => q.latencies_experimental.generation_ms / 1000);

    Plotly.newPlot("chart-scatter-rota-geracao", [{
      x: ptsRouter,
      y: ptsGen,
      mode: "markers",
      type: "scatter",
      marker: { color: "#21808d", size: 8 },
      text: qData.map(q => q.id)
    }], {
      ...plotlyLayoutBase,
      xaxis: { title: "Roteador (s)", gridcolor: gridColor },
      yaxis: { title: "Geração (s)", gridcolor: gridColor }
    }, { responsive: true });

    // 31. Latência Sessão (Chart.js)
    const latenciesAlongSession = qData.map(q => q.latencies_experimental.total_ms / 1000);
    new Chart(document.getElementById("chart-latencia-sessao").getContext("2d"), {
      type: "line",
      data: {
        labels: qData.map((_, idx) => `Q${idx+1}`),
        datasets: [{
          label: "Latência Maia.edu (s)",
          data: latenciesAlongSession,
          borderColor: "#21808d",
          fill: false,
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: textColor } },
          y: { ticks: { color: textColor } }
        },
        plugins: { legend: { display: false } }
      }
    });

    // 32. Velocidade de escrita (caracteres/ms)
    const speedsCtrl = qData.map(q => q.char_count_control / (q.latencies_control.total_ms || 1));
    const speedsExp = qData.map(q => q.char_count_experimental / (q.latencies_experimental.generation_ms || 1));

    new Chart(document.getElementById("chart-velocidade-escrita").getContext("2d"), {
      type: "bar",
      data: {
        labels: ["Controle", "Maia.edu (Geração)"],
        datasets: [{
          data: [getMean(speedsCtrl) * 1000, getMean(speedsExp) * 1000],
          backgroundColor: ["rgba(98, 104, 113, 0.8)", "rgba(33, 128, 141, 0.8)"]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: textColor } },
          y: { title: { display: true, text: "Caracteres por segundo", color: textColor }, ticks: { color: textColor } }
        },
        plugins: { legend: { display: false } }
      }
    });

    // 33. Memória vs Indep. Paramétrica
    const memoryTimes = qData.map(q => q.latencies_experimental.memory_ms / 1000);
    const indepSuccess = qData.map(q => q.criterios_experimental.independencia_da_memoria_parametrica?.presence_rate || 0);

    Plotly.newPlot("chart-memory-vs-independence", [{
      x: memoryTimes,
      y: indepSuccess,
      mode: "markers",
      type: "scatter",
      marker: { color: "#a75df4", size: 8 }
    }], {
      ...plotlyLayoutBase,
      xaxis: { title: "Tempo Memória (s)", gridcolor: gridColor },
      yaxis: { title: "Conformidade (0 a 1)", gridcolor: gridColor }
    }, { responsive: true });

    // 34. Estruturação Semântica
    const rateSemCom = getRateExp("otimizacao_semantica_para_interface");
    const rateSemSem = getRateCtrl("otimizacao_semantica_para_interface");
    drawSimpleBar("chart-interface-efficiency", "Controle", rateSemSem, "Maia.edu", rateSemCom);

    // 35. Flutuação por Horário (Chart.js)
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const latByHour = hours.map(h => {
      const items = qData.filter(q => q.hourOfDay === h);
      return items.length > 0 ? getMean(items.map(q => q.latencies_experimental.total_ms / 1000)) : null;
    });

    new Chart(document.getElementById("chart-latencia-horario").getContext("2d"), {
      type: "line",
      data: {
        labels: hours.map(h => `${h}:00`),
        datasets: [{
          label: "Latência Média (s)",
          data: latByHour,
          borderColor: "#f97316",
          spanGaps: true,
          tension: 0.2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: textColor, font: { size: 8 } } },
          y: { ticks: { color: textColor } }
        },
        plugins: { legend: { display: false } }
      }
    });

    // 36. Nota vs Latência total
    const totLats = qData.map(q => q.latencies_experimental.total_ms / 1000);
    const totScores = qData.map(q => q.scores_experimental.total);

    // Linha de tendência
    const reg = stats.linear_regression;
    const trendX = [Math.min(...totLats), Math.max(...totLats)];
    const trendY = trendX.map(x => reg.slope * x + reg.intercept);

    Plotly.newPlot("chart-score-vs-total-latency", [
      { x: totLats, y: totScores, mode: "markers", type: "scatter", name: "Questões", marker: { color: "#21808d" } },
      { x: trendX, y: trendY, mode: "lines", name: `Tendência (R²=${reg.r2.toFixed(3)})`, line: { color: "#dc3545", dash: "dash" } }
    ], {
      ...plotlyLayoutBase,
      xaxis: { title: "Latência Total (s)", gridcolor: gridColor },
      yaxis: { title: "Pontuação Final", gridcolor: gridColor }
    }, { responsive: true });

    // 37. IEP Pure Scatter Plot (Plotly)
    const iepValues = qData.map(q => {
      const delta = q.scores_experimental.total - q.scores_control.total;
      return q.latencies_experimental.total_ms > 0 ? delta / (q.latencies_experimental.total_ms / 1000) : 0;
    });

    Plotly.newPlot("chart-iep-pure-scatter", [{
      x: qData.map(q => q.id.replace("enem ", "")),
      y: iepValues,
      mode: "markers+lines",
      type: "scatter",
      marker: { color: "#a75df4", size: 8 }
    }], {
      ...plotlyLayoutBase,
      xaxis: { gridcolor: gridColor, tickfont: { size: 8 } },
      }, { responsive: true });
  }
}

function exportStaticHTMLReport(stats) {
  const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório Científico Maia.edu - Apêndice A (Crossover)</title>
  <!-- Bibliotecas de Visualização via CDN -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/plotly.js-dist-min"><\/script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      padding: 30px;
      line-height: 1.6;
    }
    h1, h2, h3, h4 { color: #58a6ff; margin-top: 35px; }
    .container { max-width: 1400px; margin: 0 auto; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px; margin-bottom: 25px; }
    .kpi-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 25px; }
    .kpi-card { background: #21262d; border: 1px solid #30363d; padding: 15px; border-radius: 6px; text-align: center; }
    .kpi-val { font-size: 1.8rem; font-weight: bold; color: #58a6ff; margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.9rem; }
    th, td { border: 1px solid #30363d; padding: 10px; text-align: left; }
    th { background: #161b22; color: #f0f6fc; }
    .chart-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(600px, 1fr)); gap: 25px; margin-top: 20px; }
    .chart-container { height: 360px; background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 15px; position: relative; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔬 Relatório Científico Maia.edu - Resultados Apêndice A (Crossover)</h1>
    <p>Este relatório contém os dados e visualizações consolidados das 25 questões pareadas do Apêndice A (Grupo I Controle vs. Grupo II Experimental sob arquitetura de dados do ecossistema).</p>

    <!-- Bloco de dados JSON para processamento automático de IA -->
    <script id="raw-stats-data" type="application/json">
${JSON.stringify(stats, null, 2)}
    <\/script>

    <div class="card" style="background: rgba(88, 166, 255, 0.05); border-color: rgba(88, 166, 255, 0.2);">
      <h3>🤖 Instruções para Análise por IA (GPT / Claude / Gemini)</h3>
      <p>Este arquivo HTML é autossuficiente e "IA-Ready". Para que um modelo de IA analise esses resultados:</p>
      <ul>
        <li>Faça o upload deste arquivo HTML diretamente no chat do seu assistente de IA.</li>
        <li>A IA poderá ler o bloco JSON embutido na tag <code>&lt;script id="raw-stats-data" type="application/json"&gt;</code> acima.</li>
        <li>Isso garante acesso imediato a todas as latências, notas Likert por grupo, transições de checklist e resultados estatísticos exatos (Wilcoxon, Kruskal-Wallis, Fleiss' Kappa, K-Means e coeficientes de regressão).</li>
      </ul>
    </div>

    <div class="kpi-container">
      <div class="kpi-card">
        <div>Amostras Pareadas (N)</div>
        <div class="kpi-val">${stats.n_total}</div>
      </div>
      <div class="kpi-card">
        <div>Ganho Likert Médio (Δ)</div>
        <div class="kpi-val" style="color: #2ea043;">+${(stats.metrics.total.experimental.mean - stats.metrics.total.control.mean).toFixed(2)} pts</div>
      </div>
      <div class="kpi-card">
        <div>Kruskal-Wallis p-value</div>
        <div class="kpi-val" style="color: ${stats.kruskal_wallis.pValue < 0.05 ? '#2ea043' : 'inherit'};">${stats.kruskal_wallis.pValue.toFixed(4)}</div>
      </div>
      <div class="kpi-card">
        <div>Fleiss' Kappa (Agreement)</div>
        <div class="kpi-val">${stats.inter_rater_agreement.fleiss_kappa.toFixed(3)}</div>
      </div>
    </div>

    <!-- Tabela Wilcoxon -->
    <h2>📉 Resumo das Dimensões e Validação Pareada (Wilcoxon)</h2>
    <div class="card">
      <table>
        <thead>
          <tr>
            <th>Métrica</th>
            <th>Média Controle</th>
            <th>Média Experimental</th>
            <th>Diferença (Δ)</th>
            <th>Wilcoxon p-value</th>
            <th>Significativo (p < 0.05)</th>
          </tr>
        </thead>
        <tbody>
          ${Object.keys(stats.metrics).filter(k => k !== "iep").map(k => {
            const m = stats.metrics[k];
            const delta = m.experimental.mean - m.control.mean;
            const sig = m.wilcoxon.significant ? "✔️ Sim" : "Não";
            return `
              <tr>
                <td><strong>${m.label}</strong></td>
                <td>${m.control.mean.toFixed(2)}</td>
                <td>${m.experimental.mean.toFixed(2)}</td>
                <td style="font-weight:bold; color: ${delta > 0 ? '#2ea043' : delta < 0 ? '#f85149' : 'inherit'};">${delta >= 0 ? "+" : ""}${delta.toFixed(2)}</td>
                <td>${m.wilcoxon.pValue !== null ? m.wilcoxon.pValue.toFixed(4) : "N/A"}</td>
                <td>${sig}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>

    <!-- Seção 1: Estatísticas Gerais -->
    <h2>📈 Seção 1: Estatísticas Gerais (Gráficos 1 a 8)</h2>
    <div class="chart-grid">
      <div class="chart-container">
        <h3>1. Boxplot Total de Notas</h3>
        <div id="chart-boxplot-total" style="height: 270px;"></div>
      </div>
      <div class="chart-container">
        <h3>2. Violin de Notas Distribuição</h3>
        <div id="chart-violin-total" style="height: 270px;"></div>
      </div>
      <div class="chart-container">
        <h3>3. Radar de Aproveitamento por Dimensão (%)</h3>
        <canvas id="chart-radar-grupos"></canvas>
      </div>
      <div class="chart-container">
        <h3>4. Ganho Cumulativo Likert (Σ Δ)</h3>
        <canvas id="chart-linha-acumulada"></canvas>
      </div>
      <div class="chart-container" style="grid-column: span 2;">
        <h3>8. K-Means Clustering (Tempo vs. Nota)</h3>
        <div id="chart-kmeans-scatter" style="height: 270px;"></div>
      </div>
    </div>

    <!-- Seção 2: Critérios & Conformidade -->
    <h2>📋 Seção 2: Critérios & Conformidade (Gráficos 9 a 23)</h2>
    <div class="chart-grid">
      <div class="chart-container" style="height: 650px; grid-column: span 2;">
        <h3>9. Checklist Conformity (34 Critérios Binários)</h3>
        <canvas id="chart-checklist-conformity"></canvas>
      </div>
      <div class="chart-container">
        <h3>10. Heatmap de Ganho Líquido de Conformidade</h3>
        <div id="chart-transicao-heatmap" style="height: 270px;"></div>
      </div>
      <div class="chart-container">
        <h3>23. Spearman Matrix Heatmap</h3>
        <div id="chart-spearman-heatmap" style="height: 270px;"></div>
      </div>
      <div class="chart-container">
        <h3>11. Pedagogia Avançada (Analogia & Metodologia)</h3>
        <canvas id="chart-pedagogia-avancada"></canvas>
      </div>
      <div class="chart-container">
        <h3>12. Erros de Ancoragem (Falso/Negativo no Grupo B)</h3>
        <canvas id="chart-ancoragem-erros"></canvas>
      </div>
      <div class="chart-container">
        <h3>13. Rosca de Redundância (Concisas vs. Redundantes)</h3>
        <canvas id="chart-con-redundancia"></canvas>
      </div>
      <div class="chart-container">
        <h3>14. Desconstrução Conceitual (Mecanismo de Erro nos Distratores)</h3>
        <canvas id="chart-des-pegadinhas"></canvas>
      </div>
      <div class="chart-container">
        <h3>15. Formatação Limpa (Ausência de Tags Corrompidas)</h3>
        <canvas id="chart-tags-quebradas"></canvas>
      </div>
      <div class="chart-container">
        <h3>16. Refutação de Distratores por Letra</h3>
        <canvas id="chart-distratores-refutacao"></canvas>
      </div>
      <div class="chart-container">
        <h3>17. Arcabouço Nominal (Aplicação Arcabouço Teórico)</h3>
        <canvas id="chart-arcabouco-nominal"></canvas>
      </div>
      <div class="chart-container">
        <h3>18. Clareza de Gabarito Declarado</h3>
        <canvas id="chart-clareza-gabarito"></canvas>
      </div>
      <div class="chart-container">
        <h3>19. Violino de Aproveitamento - Grupo D</h3>
        <div id="chart-violino-grupo-d" style="height: 270px;"></div>
      </div>
      <div class="chart-container">
        <h3>20. Recursos Visuais de Destaque</h3>
        <canvas id="chart-recursos-didaticos-visuais"></canvas>
      </div>
      <div class="chart-container">
        <h3>21. Definição de Termos Chave</h3>
        <canvas id="chart-definicao-termos"></canvas>
      </div>
      <div class="chart-container">
        <h3>22. Cadeia Explicativa (Ausência de Saltos Lógicos)</h3>
        <canvas id="chart-ausencia-saltos"></canvas>
      </div>
    </div>

    <!-- Seção 3: Modelos & Juízes -->
    <h2>🤖 Seção 3: Modelos & Juízes (Gráficos 24 a 28)</h2>
    <div class="chart-grid">
      <div class="chart-container">
        <h3>24. Rigor dos Juízes (Distribuição de Notas por Juiz)</h3>
        <div id="chart-boxplot-juizes" style="height: 270px;"></div>
      </div>
      <div class="chart-container">
        <h3>26. Dispersão de Latência por Modelo Gerador</h3>
        <div id="chart-scatter-latencia-modelos" style="height: 270px;"></div>
      </div>
      <div class="chart-container" style="grid-column: span 2;">
        <h3>28. Densidade de Palavras nas Justificativas por Status do Critério</h3>
        <div id="chart-word-density-evidencia" style="height: 270px;"></div>
      </div>
    </div>

    <!-- Seção 4: Latência & Performance -->
    <h2>⏱️ Seção 4: Latência & Performance (Gráficos 29 a 37)</h2>
    <div class="chart-grid">
      <div class="chart-container">
        <h3>29. Desdobramento de Latência (Geração vs. Router vs. Memory)</h3>
        <canvas id="chart-pie-latencias"></canvas>
      </div>
      <div class="chart-container">
        <h3>30. Rota vs Geração (Tempo em Segundos)</h3>
        <div id="chart-scatter-rota-geracao" style="height: 270px;"></div>
      </div>
      <div class="chart-container">
        <h3>31. Latência por Item ao Longo da Sessão</h3>
        <canvas id="chart-latencia-sessao"></canvas>
      </div>
      <div class="chart-container">
        <h3>32. Velocidade de Escrita (Caracteres/Segundo)</h3>
        <canvas id="chart-velocidade-escrita"></canvas>
      </div>
      <div class="chart-container">
        <h3>33. Tempo de Memória vs. Conformidade de Independência Paramétrica</h3>
        <div id="chart-memory-vs-independence" style="height: 270px;"></div>
      </div>
      <div class="chart-container">
        <h3>34. Estruturação Semântica para Interfaces</h3>
        <canvas id="chart-interface-efficiency"></canvas>
      </div>
      <div class="chart-container">
        <h3>35. Latência Média por Horário da Geração</h3>
        <canvas id="chart-latencia-horario"></canvas>
      </div>
      <div class="chart-container">
        <h3>36. Correlação Notas vs. Latência Total (Tendência R²)</h3>
        <div id="chart-score-vs-total-latency" style="height: 270px;"></div>
      </div>
      <div class="chart-container" style="grid-column: span 2;">
        <h3>37. IEP Pure Scatter Plot (Pontos Likert / Segundo)</h3>
        <div id="chart-iep-pure-scatter" style="height: 270px;"></div>
      </div>
    </div>

  </div>

  <script>
    const stats = JSON.parse(document.getElementById("raw-stats-data").textContent);
    const qData = stats.questions;
    const models = ["gemini-3.5-flash", "gemma-4-31b-it", "gpt-oss-120b"];

    const getMean = (arr) => {
      if (!arr || arr.length === 0) return 0;
      return arr.reduce((a, b) => a + b, 0) / arr.length;
    };

    const getRateCtrl = (key) => (qData.reduce((sum, q) => sum + (q.criterios_control[key]?.presence_rate || 0), 0) / stats.n_total) * 100;
    const getRateExp = (key) => (qData.reduce((sum, q) => sum + (q.criterios_experimental[key]?.presence_rate || 0), 0) / stats.n_total) * 100;

    const drawSimpleBar = (canvasId, labelCtrl, valCtrl, labelExp, valExp) => {
      new Chart(document.getElementById(canvasId).getContext("2d"), {
        type: "bar",
        data: {
          labels: [labelCtrl, labelExp],
          datasets: [{
            data: [valCtrl, valExp],
            backgroundColor: ["rgba(98, 104, 113, 0.8)", "rgba(33, 128, 141, 0.8)"]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { ticks: { color: "#ccc" } },
            y: { min: 0, max: 100, ticks: { color: "#ccc" } }
          },
          plugins: { legend: { display: false } }
        }
      });
    };

    const textColor = "#cccccc";
    const gridColor = "rgba(255,255,255,0.08)";
    const plotlyLayoutBase = {
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: textColor, size: 10 },
      margin: { t: 40, b: 40, l: 45, r: 25 },
      xaxis: { gridcolor: gridColor, zerolinecolor: gridColor },
      yaxis: { gridcolor: gridColor, zerolinecolor: gridColor }
    };

    // 1. Boxplot Total
    const ctrlScores = qData.map(q => q.scores_control.total);
    const expScores = qData.map(q => q.scores_experimental.total);
    Plotly.newPlot("chart-boxplot-total", [
      { y: ctrlScores, type: "box", name: "Controle", marker: { color: "#626871" } },
      { y: expScores, type: "box", name: "Maia.edu", marker: { color: "#21808d" } }
    ], plotlyLayoutBase);

    // 2. Violin Total
    Plotly.newPlot("chart-violin-total", [
      { y: ctrlScores, type: "violin", name: "Controle", marker: { color: "#626871" }, box: { visible: true }, meanline: { visible: true } },
      { y: expScores, type: "violin", name: "Maia.edu", marker: { color: "#21808d" }, box: { visible: true }, meanline: { visible: true } }
    ], plotlyLayoutBase);

    // 3. Radar Grupos
    const met = stats.metrics;
    new Chart(document.getElementById("chart-radar-grupos").getContext("2d"), {
      type: "radar",
      data: {
        labels: ["Estética (A)", "Ancoragem (B)", "Pedagogia (C)", "Lógica (D)", "Engenharia (E)"],
        datasets: [
          {
            label: "Controle",
            data: [
              (met.grupo_a.control.mean / 7) * 100,
              (met.grupo_b.control.mean / 14) * 100,
              (met.grupo_c.control.mean / 21) * 100,
              (met.grupo_d.control.mean / 28) * 100,
              (met.grupo_e.control.mean / 30) * 100
            ],
            backgroundColor: "rgba(98, 104, 113, 0.2)",
            borderColor: "rgba(98, 104, 113, 0.85)"
          },
          {
            label: "Maia.edu",
            data: [
              (met.grupo_a.experimental.mean / 7) * 100,
              (met.grupo_b.experimental.mean / 14) * 100,
              (met.grupo_c.experimental.mean / 21) * 100,
              (met.grupo_d.experimental.mean / 28) * 100,
              (met.grupo_e.experimental.mean / 30) * 100
            ],
            backgroundColor: "rgba(88, 166, 255, 0.2)",
            borderColor: "rgba(88, 166, 255, 0.85)"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            angleLines: { color: gridColor },
            grid: { color: gridColor },
            pointLabels: { color: textColor, font: { size: 9 } },
            ticks: { display: false }
          }
        }
      }
    });

    // 4. Linha Cumulativa
    let cumulative = 0;
    const cumGains = qData.map(q => {
      cumulative += (q.scores_experimental.total - q.scores_control.total);
      return cumulative;
    });
    new Chart(document.getElementById("chart-linha-acumulada").getContext("2d"), {
      type: "line",
      data: {
        labels: qData.map((_, idx) => 'Q' + (idx+1)),
        datasets: [{
          label: "Ganho Cumulativo Likert (Σ Δ)",
          data: cumGains,
          borderColor: "#a75df4",
          backgroundColor: "rgba(167, 93, 244, 0.08)",
          fill: true,
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: textColor } },
          y: { grid: { color: gridColor }, ticks: { color: textColor } }
        }
      }
    });

    // 8. K-Means Scatter
    const kmeansTraces = stats.kmeans_clusters.map(cluster => {
      const pts = cluster.points.map(ptId => qData.find(q => q.id === ptId));
      return {
        x: pts.map(p => p.latencies_experimental.total_ms / 1000),
        y: pts.map(p => p.scores_experimental.total),
        mode: "markers",
        type: "scatter",
        name: "Cluster " + (cluster.id + 1)
      };
    });
    Plotly.newPlot("chart-kmeans-scatter", kmeansTraces, plotlyLayoutBase);

    // 9. Checklist Conformity
    const cKeys = Object.keys(qData[0].criterios_control);
    const cLabels = cKeys.map(k => k.replace(/_/g, " ").replace(/\b(a|b|c|d|e)\b/g, m => m.toUpperCase()));
    new Chart(document.getElementById("chart-checklist-conformity").getContext("2d"), {
      type: "bar",
      data: {
        labels: cLabels,
        datasets: [
          { label: "Controle (%)", data: cKeys.map(key => getRateCtrl(key)), backgroundColor: "rgba(98, 104, 113, 0.7)" },
          { label: "Maia.edu (%)", data: cKeys.map(key => getRateExp(key)), backgroundColor: "rgba(33, 128, 141, 0.7)" }
        ]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { min: 0, max: 100, grid: { color: gridColor }, ticks: { color: textColor } },
          y: { grid: { display: false }, ticks: { color: textColor, font: { size: 8 } } }
        }
      }
    });

    // 10. Heatmap de Ganho Líquido
    const transitionGains = cKeys.map(key => getRateExp(key) - getRateCtrl(key));
    Plotly.newPlot("chart-transicao-heatmap", [{
      z: [transitionGains.slice(0, 17), transitionGains.slice(17, 34)],
      x: cLabels.slice(0, 17),
      y: ["Parte A", "Parte B"],
      type: "heatmap",
      colorscale: "Viridis"
    }], plotlyLayoutBase);

    // 23. Spearman Matrix Heatmap
    const groupsList = ["grupo_a", "grupo_b", "grupo_c", "grupo_d", "grupo_e"];
    const zValues = groupsList.map(g1 => groupsList.map(g2 => stats.spearman_matrix[g1][g2]));
    Plotly.newPlot("chart-spearman-heatmap", [{
      z: zValues,
      x: ["Estética (A)", "Ancoragem (B)", "Pedagogia (C)", "Lógica (D)", "Engenharia (E)"],
      y: ["Estética (A)", "Ancoragem (B)", "Pedagogia (C)", "Lógica (D)", "Engenharia (E)"],
      type: "heatmap",
      colorscale: "Bluered"
    }], plotlyLayoutBase);

    // 11. Pedagogia Avançada
    new Chart(document.getElementById("chart-pedagogia-avancada").getContext("2d"), {
      type: "bar",
      data: {
        labels: ["Analogia Avançada", "Metodologia Resolução"],
        datasets: [
          { label: "Controle", data: [getRateCtrl("recurso_didatico_avancado_analogia"), getRateCtrl("metodologia_de_resolucao_explicita")], backgroundColor: "rgba(98, 104, 113, 0.7)" },
          { label: "Maia.edu", data: [getRateExp("recurso_didatico_avancado_analogia"), getRateExp("metodologia_de_resolucao_explicita")], backgroundColor: "rgba(33, 128, 141, 0.7)" }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: textColor } },
          y: { min:0, max:100, ticks: { color: textColor } }
        }
      }
    });

    // 12. Erros de Ancoragem
    const ancKeys = ["citacao_direta_texto_apoio", "mencao_ao_comando_pergunta", "isolamento_dados_quantitativos", "ausencia_extrapolacao_hipotetica", "parafrase_fiel_das_premissas", "mencao_a_fontes_ou_rodape", "leitura_de_elementos_visuais"];
    const errRates = ancKeys.map(k => (1 - (qData.reduce((sum, q) => sum + (q.criterios_experimental[k]?.presence_rate || 0), 0) / stats.n_total)) * 100);
    new Chart(document.getElementById("chart-ancoragem-erros").getContext("2d"), {
      type: "bar",
      data: {
        labels: ancKeys.map(k => k.replace(/_/g, " ")),
        datasets: [{ label: "Taxa de Erro (%)", data: errRates, backgroundColor: "rgba(220, 53, 69, 0.75)" }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: textColor, font: { size: 8 } } },
          y: { min:0, max:100, ticks: { color: textColor } }
        }
      }
    });

    // 13. Rosca Redundância
    const conRate = getRateExp("ausencia_de_redundancia_vazia");
    new Chart(document.getElementById("chart-con-redundancia").getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["Direta/Concisas", "Redundantes"],
        datasets: [{ data: [conRate, 100 - conRate], backgroundColor: ["#21808d", "rgba(220, 53, 69, 0.45)"] }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    // 14. Desconstrução Conceitual
    drawSimpleBar("chart-des-pegadinhas", "Controle", getRateCtrl("mecanismo_do_erro_nos_distratores"), "Maia.edu", getRateExp("mecanismo_do_erro_nos_distratores"));

    // 15. Formatação
    const formatRate = getRateExp("ausencia_de_tags_corrompidas");
    new Chart(document.getElementById("chart-tags-quebradas").getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["Formatação Válida", "Tags Corrompidas"],
        datasets: [{ data: [formatRate, 100 - formatRate], backgroundColor: ["#21808d", "rgba(220, 53, 69, 0.45)"] }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    // 16. Refutação de Distratores
    new Chart(document.getElementById("chart-distratores-refutacao").getContext("2d"), {
      type: "bar",
      data: {
        labels: ["A", "B", "C", "Outros"],
        datasets: [
          { label: "Controle", data: [getRateCtrl("analise_isolada_distrator_A"), getRateCtrl("analise_isolada_distrator_B"), getRateCtrl("analise_isolada_distrator_C"), getRateCtrl("analise_isolada_distrator_restante")], backgroundColor: "rgba(98, 104, 113, 0.7)" },
          { label: "Maia.edu", data: [getRateExp("analise_isolada_distrator_A"), getRateExp("analise_isolada_distrator_B"), getRateExp("analise_isolada_distrator_C"), getRateExp("analise_isolada_distrator_restante")], backgroundColor: "rgba(33, 128, 141, 0.7)" }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: textColor } },
          y: { min:0, max:100, ticks: { color: textColor } }
        }
      }
    });

    // 17. Arcabouço Nominal
    drawSimpleBar("chart-arcabouco-nominal", "Controle", getRateCtrl("aplicacao_nominal_arcabouco_teorico"), "Maia.edu", getRateExp("aplicacao_nominal_arcabouco_teorico"));

    // 18. Clareza Gabarito
    const gabRate = getRateExp("declaracao_gabarito_indica_letra");
    new Chart(document.getElementById("chart-clareza-gabarito").getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["Gabarito Declarado", "Indireto/Omitido"],
        datasets: [{ data: [gabRate, 100 - gabRate], backgroundColor: ["#21808d", "rgba(220, 53, 69, 0.45)"] }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    // 19. Violino Grupo D
    const scoresDCtrl = qData.map(q => q.scores_control.grupo_d);
    const scoresDExp = qData.map(q => q.scores_experimental.grupo_d);
    Plotly.newPlot("chart-violino-grupo-d", [
      { y: scoresDCtrl, type: "violin", name: "Controle", marker: { color: "#626871" }, box: { visible: true } },
      { y: scoresDExp, type: "violin", name: "Maia.edu", marker: { color: "#21808d" }, box: { visible: true } }
    ], plotlyLayoutBase);

    // 20. Recursos Visuais
    drawSimpleBar("chart-recursos-didaticos-visuais", "Controle", getRateCtrl("recurso_visual_de_destaque"), "Maia.edu", getRateExp("recurso_visual_de_destaque"));

    // 21. Definição Termos
    drawSimpleBar("chart-definicao-termos", "Controle", getRateCtrl("definicao_de_termos_chave"), "Maia.edu", getRateExp("definicao_de_termos_chave"));

    // 22. Cadeia Explicativa
    drawSimpleBar("chart-ausencia-saltos", "Controle", getRateCtrl("ausencia_de_saltos_logicos"), "Maia.edu", getRateExp("ausencia_de_saltos_logicos"));

    // 24. Rigor dos Juízes
    const geminiDada = [];
    const gemmaDada = [];
    const gptDada = [];
    qData.forEach(q => {
      q.raw_evaluations.experimental.forEach(e => {
        if (e.judge === "gemini-3.5-flash") geminiDada.push(e.total);
        if (e.judge === "gemma-4-31b-it") gemmaDada.push(e.total);
        if (e.judge === "gpt-oss-120b") gptDada.push(e.total);
      });
    });
    Plotly.newPlot("chart-boxplot-juizes", [
      { y: geminiDada, type: "box", name: "Gemini 3.5 Flash", marker: { color: "#4e82ee" } },
      { y: gemmaDada, type: "box", name: "Gemma 4 31B IT", marker: { color: "#a75df4" } },
      { y: gptDada, type: "box", name: "GPT-OSS-120B", marker: { color: "#f97316" } }
    ], plotlyLayoutBase);

    // 26. Dispersão de Latência por Modelo
    const scatterTraces = models.map(m => {
      const pts = qData.filter(q => q.generatorModel === m);
      return {
        x: pts.map(p => p.id.replace("enem ", "")),
        y: pts.map(p => p.latencies_experimental.total_ms / 1000),
        mode: "markers",
        type: "scatter",
        name: m,
        marker: { size: 9 }
      };
    });
    Plotly.newPlot("chart-scatter-latencia-modelos", scatterTraces, plotlyLayoutBase);

    // 28. Word density
    const trueLengths = [];
    const falseLengths = [];
    qData.forEach(q => {
      Object.keys(q.criterios_experimental).forEach(k => {
        const c = q.criterios_experimental[k];
        if (c.presence_rate === 1.0) trueLengths.push(c.evidencia_length);
        else if (c.presence_rate === 0.0) falseLengths.push(c.evidencia_length);
      });
    });
    Plotly.newPlot("chart-word-density-evidencia", [
      { y: trueLengths, type: "violin", name: "Presentes", marker: { color: "#21808d" } },
      { y: falseLengths, type: "violin", name: "Ausentes", marker: { color: "#dc3545" } }
    ], plotlyLayoutBase);

    // 29. Pizza Latência
    const avgGen = getMean(qData.map(q => q.latencies_experimental.generation_ms)) / 1000;
    const avgMem = getMean(qData.map(q => q.latencies_experimental.memory_ms)) / 1000;
    const avgRot = getMean(qData.map(q => q.latencies_experimental.router_ms)) / 1000;
    new Chart(document.getElementById("chart-pie-latencias").getContext("2d"), {
      type: "pie",
      data: {
        labels: ["Geração (s)", "Memory/RAG (s)", "Router (s)"],
        datasets: [{ data: [avgGen, avgMem, avgRot], backgroundColor: ["#21808d", "#a75df4", "#f97316"] }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    // 30. Rota vs Geração
    Plotly.newPlot("chart-scatter-rota-geracao", [{
      x: qData.map(q => q.latencies_experimental.router_ms / 1000),
      y: qData.map(q => q.latencies_experimental.generation_ms / 1000),
      mode: "markers",
      type: "scatter",
      marker: { color: "#21808d", size: 8 }
    }], plotlyLayoutBase);

    // 31. Latência Sessão
    new Chart(document.getElementById("chart-latencia-sessao").getContext("2d"), {
      type: "line",
      data: {
        labels: qData.map((_, idx) => 'Q' + (idx+1)),
        datasets: [{ label: "Latência (s)", data: qData.map(q => q.latencies_experimental.total_ms / 1000), borderColor: "#21808d" }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    // 32. Velocidade de escrita
    const speedsCtrl = qData.map(q => q.char_count_control / (q.latencies_control.total_ms || 1));
    const speedsExp = qData.map(q => q.char_count_experimental / (q.latencies_experimental.generation_ms || 1));
    new Chart(document.getElementById("chart-velocidade-escrita").getContext("2d"), {
      type: "bar",
      data: {
        labels: ["Controle", "Maia.edu"],
        datasets: [{ data: [getMean(speedsCtrl) * 1000, getMean(speedsExp) * 1000], backgroundColor: ["rgba(98, 104, 113, 0.8)", "rgba(33, 128, 141, 0.8)"] }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    // 33. Memória vs Indep. Paramétrica
    Plotly.newPlot("chart-memory-vs-independence", [{
      x: qData.map(q => q.latencies_experimental.memory_ms / 1000),
      y: qData.map(q => q.criterios_experimental.independencia_da_memoria_parametrica?.presence_rate || 0),
      mode: "markers",
      type: "scatter",
      marker: { color: "#a75df4", size: 8 }
    }], plotlyLayoutBase);

    // 34. Estruturação Semântica
    drawSimpleBar("chart-interface-efficiency", "Controle", getRateCtrl("otimizacao_semantica_para_interface"), "Maia.edu", getRateExp("otimizacao_semantica_para_interface"));

    // 35. Flutuação por Horário
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const latByHour = hours.map(h => {
      const items = qData.filter(q => q.hourOfDay === h);
      return items.length > 0 ? getMean(items.map(q => q.latencies_experimental.total_ms / 1000)) : null;
    });
    new Chart(document.getElementById("chart-latencia-horario").getContext("2d"), {
      type: "line",
      data: {
        labels: hours.map(h => h + ":00"),
        datasets: [{ label: "Latência Média (s)", data: latByHour, borderColor: "#f97316", spanGaps: true }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

    // 36. Nota vs Latência total
    const totLats2 = qData.map(q => q.latencies_experimental.total_ms / 1000);
    const totScores2 = qData.map(q => q.scores_experimental.total);
    const reg2 = stats.linear_regression;
    const trendX2 = [Math.min(...totLats2), Math.max(...totLats2)];
    const trendY2 = trendX2.map(x => reg2.slope * x + reg2.intercept);
    Plotly.newPlot("chart-score-vs-total-latency", [
      { x: totLats2, y: totScores2, mode: "markers", type: "scatter", name: "Questões", marker: { color: "#21808d" } },
      { x: trendX2, y: trendY2, mode: "lines", name: "Tendência", line: { color: "#dc3545", dash: "dash" } }
    ], plotlyLayoutBase);

    // 37. IEP Pure Scatter Plot
    const iepValues2 = qData.map(q => {
      const delta = q.scores_experimental.total - q.scores_control.total;
      return q.latencies_experimental.total_ms > 0 ? delta / (q.latencies_experimental.total_ms / 1000) : 0;
    });
    Plotly.newPlot("chart-iep-pure-scatter", [{
      x: qData.map(q => q.id.replace("enem ", "")),
      y: iepValues2,
      mode: "markers+lines",
      type: "scatter",
      marker: { color: "#a75df4", size: 8 }
    }], plotlyLayoutBase);
  <\/script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "relatorio_cientifico_maia_apendice_a.html";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


