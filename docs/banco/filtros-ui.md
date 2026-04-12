# Filtros UI — Interface Visual de Filtragem

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+filtros-ui&labels=docs)

## Visão Geral

O `filtros-ui.js` (`js/banco/filtros-ui.js`) é o módulo responsável por construir e gerenciar a interface visual de filtragem do Banco de Questões. Enquanto o [filtros-dinamicos.js](/banco/filtros-dinamicos) cuida da lógica de matching, este módulo cuida da **apresentação**: renderiza checkboxes, dropdowns, inputs de busca, sliders de dificuldade, e badges de contagem — tudo com animações suaves e responsividade mobile.

Com 17.918 bytes, é o maior arquivo de UI do módulo de banco, refletindo a complexidade de construir uma interface de filtragem que seja poderosa para power users mas intuitiva para estudantes de 15 anos.

## Anatomia da Sidebar de Filtros

```mermaid
graph TD
    Sidebar[Sidebar de Filtros] --> Search[🔍 Input de Busca Textual]
    Sidebar --> MateryGroup[📚 Grupo: Matérias]
    MateryGroup --> CB1[☑️ Física (42)]
    MateryGroup --> CB2[☑️ Matemática (38)]
    MateryGroup --> CB3[☐ História (15)]
    
    Sidebar --> InstGroup[🏫 Grupo: Instituição]
    InstGroup --> DD[Dropdown: ENEM, FUVEST, UNICAMP...]
    
    Sidebar --> DiffGroup[📊 Grupo: Dificuldade]
    DiffGroup --> Slider[Range: Fácil ←→ Desafio]
    
    Sidebar --> Actions[Ações]
    Actions --> Clear[🗑️ Limpar Filtros]
    Actions --> Count[Badge: "Exibindo 42 de 200"]
```

## Geração Dinâmica de Checkboxes

Os checkboxes de matéria não são hardcoded no HTML — são gerados dinamicamente conforme questões são carregadas. Quando o módulo de paginação entrega um novo batch de cards, o `filtros-ui.js` faz scan:

```javascript
function atualizarCheckboxesMaterias(cards) {
  const contagem = {};

  cards.forEach(card => {
    const materias = (card.dataset.materia || "").split(" ");
    materias.forEach(m => {
      if (m) contagem[m] = (contagem[m] || 0) + 1;
    });
  });

  // Ordena por contagem decrescente (matérias mais frequentes primeiro)
  const sorted = Object.entries(contagem).sort((a, b) => b[1] - a[1]);

  const container = document.getElementById("filtro-materias-container");
  container.innerHTML = "";

  sorted.forEach(([materia, count]) => {
    const checkbox = criarCheckboxEstilizado(materia, count);
    container.appendChild(checkbox);
  });
}
```

### Checkboxes Estilizados

Cada checkbox é um componente visual customizado (não o nativo do browser) com:
- Ícone animado de check (transição CSS de scale 0 → 1)
- Badge de contagem ao lado ("Física (42)")
- Hover effect com highlight sutil
- Acessibilidade: `role="checkbox"`, `aria-checked`, suporte a teclado

```javascript
function criarCheckboxEstilizado(materia, count) {
  const wrapper = document.createElement("label");
  wrapper.className = "filtro-checkbox-label";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "filtro-checkbox-input";
  input.dataset.materia = materia;

  const visual = document.createElement("span");
  visual.className = "filtro-checkbox-visual";

  const texto = document.createElement("span");
  texto.textContent = `${materia} (${count})`;

  wrapper.append(input, visual, texto);

  input.addEventListener("change", () => {
    aplicarFiltros(); // Trigger re-filtragem global
  });

  return wrapper;
}
```

## Input de Busca Textual

O campo de busca ocupa o topo da sidebar com ícone de lupa e botão de limpar (X). Implementa debounce de 300ms para evitar re-filtragens a cada keystroke:

```javascript
let debounceTimer = null;

inputBusca.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    aplicarFiltros();
  }, 300);
});
```

O placeholder é contextual: "Buscar por palavra-chave, enunciado, ou ID..." — guia o aluno sobre o que pode buscar.

## Responsividade Mobile

Em telas < 768px, a sidebar de filtros se transforma num drawer lateral deslizante:
- Ícone de funil (🔍) fixo no canto da tela
- Toque abre o drawer com animação de slide-in
- Backdrop semi-transparente para fechar
- Filtros ativos exibidos como chips compactos acima dos cards

Este comportamento é gerenciado inteiramente por este módulo via media queries e event listeners de touch.

## Integração com Scroll Infinito

Quando novas questões são carregadas via paginação, o módulo:
1. Recalcula contagens de matéria (um novo batch pode trazer matérias nunca vistas)
2. Adiciona novos checkboxes se necessário (sem duplicar existentes)
3. Aplica filtros ativos nos novos cards imediatamente
4. Atualiza o badge de contagem ("Exibindo X de Y")

## Acessibilidade

- Todos os inputs possuem `aria-label` descritivo
- Navegação por Tab funciona sequencialmente pelos filtros
- Checkboxes respondem a Espaço e Enter
- Contraste de cores validado para WCAG AA
- Focus ring visível em todos os elementos interativos

## Referências Cruzadas

- [Filtros Dinâmicos — Lógica de matching por dataset](/banco/filtros-dinamicos)
- [Paginação — Carregamento lazy que alimenta os filtros](/banco/paginacao)
- [Card Template — Origem dos dataset attributes](/banco/card-template)
- [Visão Geral do Banco](/banco/visao-geral)
