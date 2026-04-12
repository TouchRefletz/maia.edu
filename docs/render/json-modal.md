# JSON Modal — Visualizador de Dados Brutos

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+json-modal&labels=docs)

## Visão Geral

O **JSON Modal** é um componente de interface que exibe o JSON bruto completo de uma questão de vestibular num modal sobreposto com syntax highlighting, busca textual, e opção de copiar/editar. É uma ferramenta de debug e power user utilizada por administradores que precisam inspecionar ou corrigir dados de questões a nível estrutural.

## Motivação

Mesmo com a interface visual rica do [QuestaoTabs](/render/questao-tabs), há cenários onde é necessário ver/editar o JSON diretamente:
- **Debug**: "Por que a imagem do slot 3 não aparece?" → Inspecionar o array `imagensExternas`
- **Correção em massa**: Modificar campos que não têm UI dedicada (ex: `reviewStatus`)
- **Validação**: Verificar que a IA gerou o schema correto antes de salvar

## Anatomia do Modal

```mermaid
graph TD
    BTN[Botão "📋 Ver JSON"] --> M[Modal Overlay]
    M --> TB[Toolbar]
    TB --> CB[📋 Copiar JSON]
    TB --> SB[🔍 Buscar no JSON]
    TB --> FB[💾 Salvar Edição]
    TB --> XB[✖ Fechar]
    M --> ED[Editor: <pre><code> com syntax highlight]
    M --> ST[Status: "2.3 KB | 45 linhas"]
```

## Implementação

O modal é criado dinamicamente quando o botão "Ver JSON" é clicado:

```javascript
function abrirJsonModal(data, options = {}) {
  const overlay = document.createElement("div");
  overlay.className = "json-modal-overlay";

  const jsonString = JSON.stringify(data, null, 2);
  const highlighted = syntaxHighlight(jsonString);

  overlay.innerHTML = `
    <div class="json-modal-container">
      <div class="json-modal-toolbar">
        <button class="json-modal-btn js-copy-json">📋 Copiar</button>
        <input class="json-modal-search" placeholder="Buscar..." />
        ${options.editable ? '<button class="json-modal-btn js-save-json">💾 Salvar</button>' : ''}
        <button class="json-modal-btn js-close-json">✖</button>
      </div>
      <pre class="json-modal-code"><code>${highlighted}</code></pre>
      <div class="json-modal-status">${formatBytes(jsonString.length)} | ${jsonString.split('\n').length} linhas</div>
    </div>
  `;

  document.body.appendChild(overlay);
}
```

## Syntax Highlighting

O highlighting é feito via regex sobre o JSON stringificado:

```javascript
function syntaxHighlight(json) {
  return json
    .replace(/("[\w_]+")\s*:/g, '<span class="json-key">$1</span>:')       // Chaves
    .replace(/:\s*(".*?")/g, ': <span class="json-string">$1</span>')      // Strings
    .replace(/:\s*(\d+\.?\d*)/g, ': <span class="json-number">$1</span>')  // Números
    .replace(/:\s*(true|false)/g, ': <span class="json-bool">$1</span>')   // Booleanos
    .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>');         // Null
}
```

As cores usam design tokens do sistema de CSS:
- Chaves: `--color-primary` (cyan)
- Strings: `--color-success` (verde)
- Números: `--color-warning` (amarelo)
- Booleanos: `--color-info` (azul)

## Busca no JSON

O input de busca faz highlight de matches em tempo real com `mark` tags. É útil para encontrar campos específicos em JSONs de 500+ linhas (questões complexas com passos detalhados).

## Modo Editável

Quando `options.editable = true`, o `<pre>` é substituído por um `<textarea>` editável. O botão "💾 Salvar" parseia o JSON editado, valida com `JSON.parse`, e propaga a alteração via callback:

```javascript
saveBtn.addEventListener("click", () => {
  try {
    const edited = JSON.parse(textarea.value);
    options.onSave(edited);
    fecharModal();
  } catch (e) {
    alert("JSON inválido: " + e.message);
  }
});
```

## Referências Cruzadas

- [QuestaoTabs — Usa o JSON Modal na tab raw](/render/questao-tabs)
- [Card Template — Questões cujo JSON pode ser inspecionado](/banco/card-template)
- [Config IA — Schema que define a estrutura do JSON](/embeddings/config-ia)
