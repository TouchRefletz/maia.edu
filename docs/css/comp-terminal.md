# Estilização do Terminal de Logs (`css/comp-terminal.md`)

O `css/comp-terminal.css` estiliza a janela do terminal de streaming de logs e feedback visual da extração de dados e chamadas de API.

---

## 🎨 Elementos Visuais

- **Fonte Monoespaçada**: Utiliza a pilha `font-family: var(--font-mono)` (Fira Code, JetBrains Mono, Consolas).
- **Esquema Dark High-Contrast**: Fundo escuro profundo (`#0d1117`), com destaques de sintaxe (logs de aviso em amarelo, erros em vermelho neon, conexões concluídas em verde emerald).
- **Auto-Scroll Smooth**: Container com rola suave acoplado às novas linhas de log inseridas pelo `LogTranslator`.

---

## 🔗 Referências Cruzadas
- [Terminal UI - Arquitetura](/upload/terminal-ui)
- [Design Tokens](/css/design-tokens)
