# Suíte de Scripts Utilitários (`docs/infra/scripts-utilitarios.md`)

O repositório inclui uma suíte de 9 scripts na pasta `scripts/` para automação de tarefas estatísticas, testes de correlação e compilação de benchmarks de IA.

---

## 📜 Lista de Scripts

1. **`calculate-spearman-correlation.js`**: Calcula o coeficiente de correlação de Spearman entre os scores de dificuldade preditos pela IA e o desempenho real de estudantes.
2. **`calculate-stats.js`**: Gera estatísticas descritivas (média, mediana, desvio padrão, percentis) dos tempos de resposta e métricas de certeza.
3. **`compile-apendice-a.js`**: Compila os resultados brutos da bateria de testes cego do Apêndice A em JSONs unificados.
4. **`analisar-apendice-b.py`**: Script em Python para análise de dados do experimento de personas do Apêndice B.
5. **`compute-hash.js`**: Utilitário de geração de hashes sha256 para checagem de duplicidade de arquivos PDF de vestibulares.
6. **`evaluate-with-judge.js`**: Orquestra chamadas ao LLM-as-a-Judge para atribuição automática de notas aos modelos avaliados.
7. **`generate-charts-apendice-a.js` & `generate-charts.js`**: Geração automatizada de gráficos em SVG/PNG para relatórios acadêmicos.
8. **`test-stats-reliability.js`**: Avalia a confiabilidade estatística (Alfa de Cronbach / concordância inter-juízes).

---

## 🔗 Referências Cruzadas
- [Avaliação e Benchmark](/chat/benchmark-eval)
- [Visão Geral de Infraestrutura](/infra/visao-geral)
