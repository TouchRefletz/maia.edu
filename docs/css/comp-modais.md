# Estilização de Modais e Overlays (`css/comp-modais.md`)

O arquivo `css/comp-modais.css` define os estilos de caixas de diálogo, overlays semitransparentes, modais de seleção de modelos (`ModelSelectorModal`) e janelas de confirmação.

---

## 🎨 Classes Principais e Design Tokens

- `.modal-backdrop`: Overlay fixo com efeito de desfoque de fundo (`backdrop-filter: blur(8px)`).
- `.modal-card`: Container centralizado com cantos arredondados (`border-radius: var(--radius-lg)`), fundo adaptável ao tema Claro/Escuro.
- `.modal-header`, `.modal-body`, `.modal-footer`: Estruturação interna em Flexbox/Grid com espaçamento padronizado.

---

## 🌓 Suporte a Temas (Light & Dark Mode)

```css
/* Exemplo de adaptação de tema para Modais */
[data-color-scheme="dark"] .modal-card {
  background-color: var(--bg-surface-dark);
  border: 1px solid var(--border-subtle-dark);
  color: var(--text-primary-dark);
}

[data-color-scheme="light"] .modal-card {
  background-color: var(--bg-surface-light);
  border: 1px solid var(--border-subtle-light);
  color: var(--text-primary-light);
}
```

---

## 🔗 Referências Cruzadas
- [Design Tokens](/css/design-tokens)
- [Modais UI](/ui/modais)
