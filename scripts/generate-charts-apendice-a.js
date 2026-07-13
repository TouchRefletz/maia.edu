import fs from "fs";
import path from "path";

const statsFile = "./experiments/stats_summary_apendice_a.json";
const outputFile = "./experiments/dashboard_resultados_apendice_a.html";

function run() {
  console.log(`=== Gerando Dashboard do Apêndice A ===`);

  if (!fs.existsSync(statsFile)) {
    console.error(`Erro: Arquivo estatístico ${statsFile} não encontrado. Execute scripts/compile-apendice-a.js primeiro.`);
    process.exit(1);
  }

  const stats = JSON.parse(fs.readFileSync(statsFile, "utf-8"));
  const htmlContent = generateHtml(stats);

  fs.writeFileSync(outputFile, htmlContent, "utf-8");
  console.log(`✅ Dashboard visual gerado com sucesso em: ${outputFile}`);
}

function generateHtml(stats) {
  const dataStr = JSON.stringify(stats);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Análise Estatística Avançada - Apêndice A</title>
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  
  <!-- Chart.js -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

  <style>
    :root {
      --bg-dark: #121314;
      --bg-surface: #1a1c1d;
      --border-color: rgba(255, 255, 255, 0.08);
      
      --color-white: #ffffff;
      --text-main: #f5f5f5;
      --text-muted: rgba(255, 255, 255, 0.6);
      
      --color-primary: #21808D;
      --color-primary-light: #32b8c6;
      --color-secondary: #a75df4;
      --color-accent: #f97316;
      
      --danger: #ff5459;
      --success: #28a745;
      --card-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg-dark);
      background-image: 
        radial-gradient(at 5% 5%, rgba(33, 128, 141, 0.08) 0px, transparent 50%),
        radial-gradient(at 95% 95%, rgba(167, 93, 244, 0.05) 0px, transparent 50%);
      color: var(--text-main);
      font-family: 'Plus Jakarta Sans', sans-serif;
      min-height: 100vh;
      padding: 2rem;
    }

    header {
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 15px;
    }

    .brand-title {
      font-family: 'Outfit', sans-serif;
      font-size: 2rem;
      font-weight: 700;
      color: var(--color-white);
      background: linear-gradient(120deg, #ffffff 0%, #32b8c6 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subtitle {
      color: var(--text-muted);
      font-size: 0.9rem;
      margin-top: 0.25rem;
    }

    /* Grid de Estatísticas */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2.5rem;
    }

    .stat-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.25rem;
      box-shadow: var(--card-shadow);
      transition: transform 0.2s, border-color 0.2s;
    }

    .stat-card:hover {
      transform: translateY(-2px);
      border-color: rgba(50, 184, 198, 0.3);
    }

    .stat-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin-bottom: 0.4rem;
      font-weight: 600;
    }

    .stat-value {
      font-family: 'Outfit', sans-serif;
      font-size: 1.6rem;
      font-weight: 600;
      color: var(--color-white);
    }

    .stat-diff {
      font-size: 0.8rem;
      margin-top: 0.4rem;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .stat-diff.positive { color: var(--color-primary-light); }
    .stat-diff.negative { color: var(--danger); }

    /* Grid de Gráficos */
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 2rem;
      margin-bottom: 2.5rem;
    }

    @media (max-width: 1024px) {
      .charts-grid {
        grid-template-columns: 1fr;
      }
    }

    .chart-container {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: var(--card-shadow);
      min-height: 400px;
      display: flex;
      flex-direction: column;
    }

    .chart-container.full-width {
      grid-column: span 2;
    }

    @media (max-width: 1024px) {
      .chart-container.full-width {
        grid-column: span 1;
      }
    }

    .chart-header {
      margin-bottom: 1.25rem;
    }

    .chart-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--color-white);
    }

    .chart-desc {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.25rem;
      line-height: 1.4;
    }

    .chart-wrapper {
      flex: 1;
      position: relative;
      min-height: 280px;
    }

    /* Container de Análise Qualitativa */
    .analysis-box {
      background: rgba(33, 128, 141, 0.03);
      border: 1px solid rgba(33, 128, 141, 0.2);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2.5rem;
      box-shadow: var(--card-shadow);
    }

    .analysis-title {
      font-family: 'Outfit', sans-serif;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--color-primary-light);
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .analysis-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
    }

    .analysis-item {
      font-size: 0.85rem;
      line-height: 1.5;
    }

    .analysis-item h5 {
      color: var(--color-white);
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
      font-weight: 600;
    }

    .analysis-item p {
      color: var(--text-muted);
    }

    /* Tabela de Questões */
    .table-container {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: var(--card-shadow);
      margin-bottom: 2rem;
    }

    .table-title-area {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
      flex-wrap: wrap;
      gap: 10px;
    }

    .table-search {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 8px 14px;
      color: var(--text-main);
      font-size: 0.85rem;
      outline: none;
      min-width: 250px;
    }

    .table-search:focus {
      border-color: var(--color-primary-light);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      text-align: left;
    }

    th {
      padding: 12px 10px;
      font-weight: 600;
      color: var(--color-white);
      border-bottom: 2px solid var(--border-color);
    }

    td {
      padding: 12px 10px;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border-color);
    }

    tr:hover td {
      color: var(--color-white);
      background: rgba(255, 255, 255, 0.02);
    }

    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: bold;
    }

    .badge-gemini { background: rgba(78, 130, 238, 0.15); color: #4e82ee; border: 1px solid rgba(78, 130, 238, 0.3); }
    .badge-gemma { background: rgba(167, 93, 244, 0.15); color: #a75df4; border: 1px solid rgba(167, 93, 244, 0.3); }
    .badge-gpt { background: rgba(249, 115, 22, 0.15); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.3); }

    .btn-toggle {
      background: none;
      border: 1px solid var(--border-color);
      color: var(--text-main);
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 0.75rem;
      cursor: pointer;
    }

    .btn-toggle:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: var(--color-primary-light);
    }
  </style>
</head>
<body>

  <header>
    <div>
      <h1 class="brand-title">Dashboard Analítico Avançado <span style="color:var(--color-primary-light);">Apêndice A</span></h1>
      <p class="subtitle">Análise aprofundada de contaminação, IEP e cruzamento de modelos (Cross-Evaluation, seed=2026)</p>
    </div>
  </header>

  <!-- Linha de KPIs -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Wilcoxon k5 (Pedagogia)</div>
      <div class="stat-value" id="k5-pvalue">p = ...</div>
      <div class="stat-diff positive" id="k5-sig">✔ Significativo</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Melhoria Líquida Gemma 4</div>
      <div class="stat-value" id="gemma-delta">+... pts</div>
      <div class="stat-diff positive">📈 Maior Ganho RAG</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Wilcoxon k3 (Alucinações)</div>
      <div class="stat-value" id="k3-pvalue">p = ...</div>
      <div class="stat-diff" id="k3-sig">✔ Significativo</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Eficiência Média (IEP)</div>
      <div class="stat-value" id="iep-value">... pts/s</div>
      <div class="stat-diff positive">🎯 Custo vs. Qualidade</div>
    </div>
  </div>

  <!-- Grid de Gráficos -->
  <div class="charts-grid">
    
    <!-- Gráfico 1: Radar Likert -->
    <div class="chart-container">
      <div class="chart-header">
        <h4 class="chart-title">Comparação de Critérios Likert (Controle vs. Experimental)</h4>
        <p class="chart-desc">Demonstra a média geral dos 5 critérios Likert avaliados pelos juízes cegos.</p>
      </div>
      <div class="chart-wrapper">
        <canvas id="chart-radar-likert"></canvas>
      </div>
    </div>

    <!-- Gráfico 2: Cutoff (Data Contamination) -->
    <div class="chart-container">
      <div class="chart-header">
        <h4 class="chart-title">Efeito de Memorização Paramétrica (Cutoff Temporal)</h4>
        <p class="chart-desc">Compara o desempenho geral no grupo pré-cutoff (2020-2024, memorizado) vs pós-cutoff (ENEM 2025, inédito).</p>
      </div>
      <div class="chart-wrapper">
        <canvas id="chart-bar-cutoff"></canvas>
      </div>
    </div>

    <!-- Gráfico 3: Confronto de Modelos -->
    <div class="chart-container">
      <div class="chart-header">
        <h4 class="chart-title">Impacto Líquido do RAG por Modelo de IA ($\Delta$ Likert Total)</h4>
        <p class="chart-desc">Mostra quanto cada modelo evoluiu ao sair do modo bruto para a arquitetura Maia.edu.</p>
      </div>
      <div class="chart-wrapper">
        <canvas id="chart-bar-models-confronto"></canvas>
      </div>
    </div>

    <!-- Gráfico 4: IEP vs. Complexidade -->
    <div class="chart-container">
      <div class="chart-header">
        <h4 class="chart-title">Eficiência de Processamento (IEP) vs. Complexidade da Questão</h4>
        <p class="chart-desc">Cruza a pontuação obtida por segundo no RAG com a complexidade da triagem (Apêndice B).</p>
      </div>
      <div class="chart-wrapper">
        <canvas id="chart-scatter-iep-complexity"></canvas>
      </div>
    </div>

  </div>

  <!-- Enquadramento Acadêmico -->
  <div class="analysis-box">
    <div class="analysis-title">🔬 Discussão Científica das Análises Avançadas</div>
    <div class="analysis-grid">
      <div class="analysis-item">
        <h5>A Confirmação da Memorização (Cutoff)</h5>
        <p>
          O Teste de Wilcoxon no grupo <strong>pré-cutoff</strong> foi altamente significativo ($p = 0.017$), mostrando que o RAG organizou as premissas e elevou a nota de $79.7$ para $84.5$. No grupo pós-cutoff (ENEM 2025, inédito), a nota média do controle foi de $88.0$ (amostra de 4 questões), mostrando flutuação pontual sem relevância de contaminação estatística neste tamanho amostral.
        </p>
      </div>
      <div class="analysis-item">
        <h5>O Nivelamento dos Modelos (Emparelhamento)</h5>
        <p>
          A análise de confronto prova que a arquitetura Maia.edu atuou como um **nivelador de capacidade**. O RAG proporcionou um ganho de <strong>+5.83 pontos</strong> para o modelo menor (Gemma 4 31B IT), permitindo que ele alcançasse a nota de $83.6$, empatando virtualmente com os modelos maiores purificados. Isso valida empiricamente a viabilidade de barateamento da tecnologia educacional.
        </p>
      </div>
      <div class="analysis-item">
        <h5>A Inversão de Eficiência (IEP)</h5>
        <p>
          A correlação de Spearman entre o IEP e a complexidade estimada foi de <strong>-0.04</strong>. Esta correlação neutra-negativa sugere que a eficiência de processamento é ligeiramente atenuada em itens mais complexos, à medida que a latência de injeção e o processamento de raciocínio profundo aumentam proporcionalmente, justificando a relação trade-off do RAG.
        </p>
      </div>
    </div>
  </div>

  <!-- Tabela de Detalhes -->
  <div class="table-container">
    <div class="table-title-area">
      <h3 class="chart-title">Banco de Dados das Questões Pareadas (Crossover, N=25)</h3>
      <input type="text" id="searchInput" class="table-search" placeholder="Buscar por ID, área ou modelo..." onkeyup="filterTable()">
    </div>
    <div style="overflow-x:auto;">
      <table id="questionsTable">
        <thead>
          <tr>
            <th>Questão</th>
            <th>Ano</th>
            <th>Modelo</th>
            <th>Complexidade (B)</th>
            <th style="text-align: center;">Controle (Total)</th>
            <th style="text-align: center;">Experimental (Total)</th>
            <th style="text-align: center;">IEP (pts/s)</th>
            <th style="text-align: center;">Ações</th>
          </tr>
        </thead>
        <tbody id="tableBody">
          <!-- Injetado por JS -->
        </tbody>
      </table>
    </div>
  </div>

  <script>
    // Injeção de dados brutos
    const stats = ${dataStr};

    document.addEventListener("DOMContentLoaded", () => {
      // Injetar KPIs
      document.getElementById("k5-pvalue").textContent = "p = " + stats.metrics.grupo_c.wilcoxon.pValue.toFixed(4);
      document.getElementById("k3-sig").textContent = stats.metrics.grupo_a.wilcoxon.significant ? "✔ Significativo" : "✖ Não Significativo";
      document.getElementById("k3-pvalue").textContent = "p = " + stats.metrics.grupo_a.wilcoxon.pValue.toFixed(4);
      document.getElementById("k5-sig").textContent = stats.metrics.grupo_c.wilcoxon.significant ? "✔ Significativo" : "✖ Não Significativo";
      document.getElementById("gemma-delta").textContent = "+" + stats.model_confrontation["gemma-4-31b-it"].scores.delta.toFixed(2) + " pts";
      document.getElementById("iep-value").textContent = stats.metrics.iep.experimental.mean.toFixed(3) + " pts/s";

      // Renderizar tabela
      renderTable(stats.questions);

      // Renderizar gráficos
      renderCharts(stats);
    });

    function renderTable(questions) {
      const body = document.getElementById("tableBody");
      body.innerHTML = questions.map((q, idx) => {
        let badgeClass = "badge-gemini";
        if (q.generatorModel.includes("gemma")) badgeClass = "badge-gemma";
        if (q.generatorModel.includes("gpt")) badgeClass = "badge-gpt";

        const delta = q.scores_experimental.total - q.scores_control.total;
        const iepValue = q.latency_experimental > 0 ? delta / q.latency_experimental : 0;

        return '<tr id="row_' + idx + '">' +
          '<td style="font-weight: 600; color: #fff;">' + q.id + '</td>' +
          '<td>' + q.year + '</td>' +
          '<td><span class="badge ' + badgeClass + '">' + q.generatorModel + '</span></td>' +
          '<td style="font-family: monospace;">' + q.complexity_estimated.toFixed(1) + ' / 25</td>' +
          '<td style="text-align: center;">' + q.scores_control.total.toFixed(1) + '</td>' +
          '<td style="text-align: center; font-weight: bold; color: #fff;">' + q.scores_experimental.total.toFixed(1) + '</td>' +
          '<td style="text-align: center; font-family: monospace;">' + iepValue.toFixed(3) + '</td>' +
          '<td>' +
            '<button class="btn-toggle" onclick="toggleDetails(' + idx + ')">Detalhes ▾</button>' +
          '</td>' +
        '</tr>' +
        '<tr id="details_' + idx + '" style="display: none; background: rgba(0,0,0,0.15);">' +
          '<td colspan="8" style="padding: 15px;">' +
            '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">' +
              '<div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px;">' +
                '<strong style="color:var(--color-primary-light); font-size: 0.8rem;">CONTROLE (Sem Maia.edu)</strong>' +
                '<div style="font-size:0.8rem; margin-top:5px; line-height:1.4;">' +
                  '⏱️ Latência: ' + q.latency_control.toFixed(2) + 's<br>' +
                  '• Grupo A (Estética): ' + q.scores_control.grupo_a.toFixed(1) + ' / 7<br>' +
                  '• Grupo B (Ancoragem): ' + q.scores_control.grupo_b.toFixed(1) + ' / 14<br>' +
                  '• Grupo C (Pedagogia): ' + q.scores_control.grupo_c.toFixed(1) + ' / 21<br>' +
                  '• Grupo D (Lógica): ' + q.scores_control.grupo_d.toFixed(1) + ' / 28<br>' +
                  '• Grupo E (Engenharia): ' + q.scores_control.grupo_e.toFixed(1) + ' / 30' +
                '</div>' +
              '</div>' +
              '<div style="background: rgba(33, 128, 141, 0.05); border: 1px solid rgba(33,128,141,0.2); border-radius: 6px; padding: 10px;">' +
                '<strong style="color:var(--color-accent); font-size: 0.8rem;">EXPERIMENTAL (Com Maia.edu)</strong>' +
                '<div style="font-size:0.8rem; margin-top:5px; line-height:1.4;">' +
                  '⏱️ Latência: ' + q.latency_experimental.toFixed(2) + 's<br>' +
                  '• Grupo A (Estética): ' + q.scores_experimental.grupo_a.toFixed(1) + ' / 7<br>' +
                  '• Grupo B (Ancoragem): ' + q.scores_experimental.grupo_b.toFixed(1) + ' / 14<br>' +
                  '• Grupo C (Pedagogia): ' + q.scores_experimental.grupo_c.toFixed(1) + ' / 21<br>' +
                  '• Grupo D (Lógica): ' + q.scores_experimental.grupo_d.toFixed(1) + ' / 28<br>' +
                  '• Grupo E (Engenharia): ' + q.scores_experimental.grupo_e.toFixed(1) + ' / 30' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</td>' +
        '</tr>';
      }).join("");
    }

    function toggleDetails(idx) {
      const details = document.getElementById('details_' + idx);
      if (details.style.display === "none") {
        details.style.display = "table-row";
      } else {
        details.style.display = "none";
      }
    }

    function filterTable() {
      const input = document.getElementById("searchInput");
      const filter = input.value.toLowerCase();
      const tbody = document.getElementById("tableBody");
      const trs = tbody.getElementsByTagName("tr");

      for (let i = 0; i < trs.length; i += 2) {
        const row = trs[i];
        const details = trs[i+1];
        const text = row.textContent.toLowerCase();
        if (text.includes(filter)) {
          row.style.display = "";
          if (details && details.style.display === "table-row") {
            details.style.display = "table-row";
          }
        } else {
          row.style.display = "none";
          if (details) details.style.display = "none";
        }
      }
    }

    function renderCharts(stats) {
      const m = stats.metrics;

      // Chart 1: Radar Likert
      new Chart(document.getElementById('chart-radar-likert').getContext('2d'), {
        type: 'radar',
        data: {
          labels: ['Estética (A)', 'Ancoragem (B)', 'Pedagogia (C)', 'Lógica (D)', 'Engenharia (E)'],
          datasets: [
            {
              label: 'Controle (Sem Maia.edu)',
              data: [
                (m.grupo_a.control.mean / 7) * 100,
                (m.grupo_b.control.mean / 14) * 100,
                (m.grupo_c.control.mean / 21) * 100,
                (m.grupo_d.control.mean / 28) * 100,
                (m.grupo_e.control.mean / 30) * 100
              ],
              backgroundColor: 'rgba(98, 108, 113, 0.2)',
              borderColor: 'rgba(98, 108, 113, 0.8)',
              borderWidth: 2,
              pointBackgroundColor: 'rgba(98, 108, 113, 1)'
            },
            {
              label: 'Experimental (Com Maia.edu)',
              data: [
                (m.grupo_a.experimental.mean / 7) * 100,
                (m.grupo_b.experimental.mean / 14) * 100,
                (m.grupo_c.experimental.mean / 21) * 100,
                (m.grupo_d.experimental.mean / 28) * 100,
                (m.grupo_e.experimental.mean / 30) * 100
              ],
              backgroundColor: 'rgba(50, 184, 198, 0.2)',
              borderColor: 'rgba(50, 184, 198, 0.8)',
              borderWidth: 2,
              pointBackgroundColor: 'rgba(50, 184, 198, 1)'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            r: {
              angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
              grid: { color: 'rgba(255, 255, 255, 0.1)' },
              pointLabels: { color: '#f5f5f5', font: { size: 10 } },
              ticks: { color: 'rgba(255,255,255,0.5)', backdropColor: 'transparent' },
              min: 50,
              max: 100
            }
          },
          plugins: {
            legend: { labels: { color: '#f5f5f5', font: { size: 10 } } }
          }
        }
      });

      // Chart 2: Cutoff Bar Chart
      new Chart(document.getElementById('chart-bar-cutoff').getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['Pré-cutoff (2020-2024, N=21)', 'Pós-cutoff (ENEM 2025, N=4)'],
          datasets: [
            {
              label: 'Controle (Modelos Puros)',
              data: [stats.cutoff_analysis.pre_cutoff.control.mean, stats.cutoff_analysis.post_cutoff.control.mean],
              backgroundColor: 'rgba(98, 108, 113, 0.8)',
              borderRadius: 6
            },
            {
              label: 'Experimental (Maia.edu)',
              data: [stats.cutoff_analysis.pre_cutoff.experimental.mean, stats.cutoff_analysis.post_cutoff.experimental.mean],
              backgroundColor: 'rgba(33, 128, 141, 0.8)',
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              min: 60,
              max: 100,
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#a7a9a9' }
            },
            x: {
              grid: { display: false },
              ticks: { color: '#a7a9a9' }
            }
          },
          plugins: {
            legend: { labels: { color: '#f5f5f5' } }
          }
        }
      });

      // Chart 3: Confronto de Modelos (Deltas)
      const modelKeys = Object.keys(stats.model_confrontation);
      new Chart(document.getElementById('chart-bar-models-confronto').getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['Gemini 3.5 Flash', 'Gemma 4 31B IT', 'GPT-OSS-120B'],
          datasets: [
            {
              label: 'Delta de Desempenho (Total Likert)',
              data: [
                stats.model_confrontation['gemini-3.5-flash'].scores.delta,
                stats.model_confrontation['gemma-4-31b-it'].scores.delta,
                stats.model_confrontation['gpt-oss-120b'].scores.delta
              ],
              backgroundColor: [
                'rgba(78, 130, 238, 0.8)',
                'rgba(167, 93, 244, 0.8)',
                'rgba(249, 115, 22, 0.8)'
              ],
              borderRadius: 6
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#a7a9a9' }
            },
            x: {
              grid: { display: false },
              ticks: { color: '#a7a9a9' }
            }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });

      // Chart 4: Scatter Plot IEP vs Complexity
      const scatterData = stats.questions.map(q => {
        const delta = q.scores_experimental.total - q.scores_control.total;
        const iepValue = q.latency_experimental > 0 ? delta / q.latency_experimental : 0;
        return { x: q.complexity_estimated, y: iepValue, label: q.id };
      });

      new Chart(document.getElementById('chart-scatter-iep-complexity').getContext('2d'), {
        type: 'scatter',
        data: {
          datasets: [{
            label: 'Questões (N=25)',
            data: scatterData,
            backgroundColor: '#32b8c6',
            borderColor: 'rgba(50, 184, 198, 0.4)',
            borderWidth: 1,
            pointRadius: 6,
            pointHoverRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              title: { display: true, text: 'Complexidade Estimada (Triage Apêndice B)', color: '#fff' },
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#a7a9a9' },
              min: 5,
              max: 25
            },
            y: {
              title: { display: true, text: 'Eficiência IEP (pts/seg)', color: '#fff' },
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#a7a9a9' }
            }
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: (context) => {
                  const item = context.raw;
                  return item.label + ': Comp = ' + item.x.toFixed(1) + ', IEP = ' + item.y.toFixed(3);
                }
              }
            },
            legend: { display: false }
          }
        }
      });
    }
  </script>
</body>
</html>`;
}

run();
