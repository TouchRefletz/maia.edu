# Pipelines de Avaliação e Benchmark (`docs/chat/benchmark-eval.md`)

Documentação das pipelines de teste cego, avaliação de apêndices e validação pedagógica via LLM-as-a-Judge.

---

## 🧪 Componentes de Benchmark

- **`apendice-a-pipeline.js`**: Execução de bateria de testes de acurácia com anonimização cega entre modelos (Gemini 3.5 vs GPT-5 vs Groq OSS 120B).
- **`apendice-b-pipeline.js`**: Análise heurística de complexidade e simulação de personas de estudantes.
- **`judge-prompt.js`**: Prompt padronizado para o modelo juiz pontuar clareza pedagógica e precisão matemática.
- **`guardrail-service.js`**: Serviço de sanitização e verificação de alucinações antes de respostas finais.

---

## 🔗 Referências Cruzadas
- [Motor de IA - Visão Geral](/chat/visao-geral)
- [Scripts Utilitários](/infra/scripts-utilitarios)
