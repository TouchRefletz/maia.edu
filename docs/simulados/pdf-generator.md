# Gerador de PDFs de Simulados (`js/simulados/pdf-generator.js`)

O `js/simulados/pdf-generator.js` é o motor client-side de exportação que diagramação e compila cadernos de prova completos em formato PDF prontos para impressão.

---

## ⚙️ Especificações de Diagramação

- **Quebra de Página Inteligente**: Impede que enunciados de questões ou alternativas sejam cortados entre duas páginas.
- **Renderização de Equações**: Converte expressões LaTeX para imagens vetoriais SVG de alta resolução antes da montagem do PDF.
- **Layout de Prova Oficial**: Gera cabeçalho personalizável com nome da instituição, instruções da prova, folha de respostas (cartão-resposta) e gabarito destacado ao final.

---

## 🔗 Referências Cruzadas
- [Módulo de Simulados - Visão Geral](/simulados/visao-geral)
