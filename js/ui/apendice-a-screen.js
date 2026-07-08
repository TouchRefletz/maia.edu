import { ref, get } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { db, auth } from "../main.js";
import { customAlert } from "./GlobalAlertsLogic.tsx";
import { gerarTelaInicial } from "../app/telas.js";
import { verificarSeAdmin } from "./admin-panel.js";

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

  // Renderiza layout principal
  document.body.innerHTML = `
    <div class="admin-layout-wrapper" style="font-family: system-ui, sans-serif; background: var(--color-background); min-height: 100vh; padding: 20px; box-sizing: border-box; color: var(--color-text);">
      <div class="admin-panel" style="max-width: 1100px; margin: 0 auto; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 24px; box-shadow: var(--shadow-lg);">
        
        <div class="admin-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-border); padding-bottom: 16px; margin-bottom: 20px;">
          <h1 style="margin: 0; font-size: 1.8rem; display: flex; align-items: center; gap: 10px; color: var(--color-text-shine);">🧪 Apêndice A - Crossover de Modelos</h1>
          <button class="btn btn--sm btn--outline js-voltar-inicio" style="border: 1px solid var(--color-border); border-radius: 6px; padding: 8px 14px; background: none; color: var(--color-text); cursor: pointer;">← Voltar</button>
        </div>

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
    </div>
  `;

  // Setup Listeners
  const selectArea = document.getElementById("selectApendiceAArea");
  const btnRodar = document.getElementById("btnRodarSorteioApendiceA");
  const tableArea = document.getElementById("apendiceATableArea");

  btnRodar.addEventListener("click", async () => {
    const area = selectArea.value;
    tableArea.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 40px;">
        <div class="admin-spinner"></div>
        <p style="margin-top:15px; font-weight:500;">Lendo dados do experimento...</p>
      </div>
    `;

    try {
      // Carrega o arquivo JSON gerado a partir do excel
      const res = await fetch("../../experiments/questoes_experimento.json");
      if (!res.ok) throw new Error("Não foi possível carregar o arquivo JSON de questões.");
      const questoesAll = await res.json();

      // Filtra questões pela área
      // Normalização de chaves de área para busca
      let areaFilter = area;
      if (area === "Interdisciplinar FUVEST") {
        areaFilter = "FUVEST"; // Mapeia para o grupo/area no JSON
      }

      let questoesArea = questoesAll.filter(q => q.grupo === areaFilter || q.area === areaFilter);
      if (questoesArea.length === 0) {
        // Fallback para verificar se contém a palavra
        questoesArea = questoesAll.filter(q => {
          const gStr = String(q.grupo || "").toLowerCase();
          const aStr = String(q.area || "").toLowerCase();
          const fStr = areaFilter.toLowerCase();
          return gStr.includes(fStr) || aStr.includes(fStr);
        });
      }

      if (questoesArea.length === 0) {
        throw new Error(`Nenhuma questão encontrada para a área: ${area}`);
      }

      // Ordenar por ID para consistência antes de embaralhar
      questoesArea.sort((a, b) => a.id.localeCompare(b.id));

      // Sorteador baseado no seed 2026
      const rand = new SeededRandom(2026);

      // Algoritmo de Fisher-Yates Fisher-Yates shuffle com o seeded rand
      const shuffled = [...questoesArea];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rand.next() * (i + 1));
        const temp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = temp;
      }

      // Modelos Participantes
      const modelA = "Gemini 3.5 Flash";
      const modelB = "Gemma 4 31B IT";
      const modelC = "GPT-OSS-120B";

      // Alocação: 8 para cada um inicialmente
      const alocacoes = new Array(shuffled.length).fill(null);
      
      // Índices 0-7 -> Model A (8 questões)
      // Índices 8-15 -> Model B (8 questões)
      // Índices 16-23 -> Model C (8 questões)
      for (let idx = 0; idx < 8; idx++) alocacoes[idx] = modelA;
      for (let idx = 8; idx < 16; idx++) alocacoes[idx] = modelB;
      for (let idx = 16; idx < 24; idx++) alocacoes[idx] = modelC;

      // O 25º item (índice 24) é alocado aleatoriamente usando a semente
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

      // Mapeia de volta para o array original de questões para exibir na tabela ordenada pelo ID original
      const resultData = shuffled.map((q, idx) => ({
        ...q,
        modelo_sorteado: alocacoes[idx]
      }));

      // Ordena por ID final para fácil leitura na tabela
      resultData.sort((a, b) => a.id.localeCompare(b.id));

      // Monta as estatísticas de contagem
      const countA = resultData.filter(r => r.modelo_sorteado === modelA).length;
      const countB = resultData.filter(r => r.modelo_sorteado === modelB).length;
      const countC = resultData.filter(r => r.modelo_sorteado === modelC).length;

      // Renderiza a tabela
      tableArea.innerHTML = `
        <div style="display:flex; justify-content: space-between; align-items:center; background: rgba(255,255,255,0.02); border: 1px solid var(--color-border); padding: 12px 18px; border-radius: 8px; margin-bottom: 16px;">
          <div style="font-size: 0.9rem; font-weight: 500; color: var(--color-text-secondary);">
            Distribuição da área <strong>${area}</strong>: 
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

  const voltarBtn = document.querySelector(".js-voltar-inicio");
  voltarBtn?.addEventListener("click", () => {
    gerarTelaInicial();
  });
}
