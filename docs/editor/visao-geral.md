# Módulo de Edição de Questões (`docs/editor/visao-geral.md`)

O Módulo de Edição (`js/editor/*`) é a suíte de curadoria e correção manual de questões extraídas via OCR ou IA.

---

## ⚙️ Componentes da Suíte de Edição

- **`structure-editor.js`**: Editor WYSIWYG de enunciados, citações e inclusão de blocos de imagem.
- **`alternativas.js`**: Ajuste fino dos textos e imagens de opções de múltipla escolha (A-E).
- **`gabarito-save.js` & `questao-save.js`**: Handlers de validação e persistência das alterações no Firestore.
- **`passos.js` & `steps-ui.js`**: Interface de edição e adição de passos explicativos de resolução comentada.

---

## 🔗 Referências Cruzadas
- [Normalização de Dados](/normalizacao/data-normalizer)
- [Modais e Telas Admin](/ui/admin-modals-screens)
