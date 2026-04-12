# Card Partes — Submódulos de Renderização

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+card-partes&labels=docs)

## Visão Geral

O `card-partes.js` (`js/banco/card-partes.js`) contém todas as funções auxiliares de renderização HTML que o [Card Template](/banco/card-template) invoca para montar as seções internas de um card de questão. Este módulo exporta "fábricas de HTML" para cada componente visual: corpo da questão, créditos, matriz de complexidade, passos de resolução, fontes externas e relatório de pesquisa.

A separação em submódulo evita que o `card-template.js` cresça além de limites manuseáveis. Cada função é pura (input → HTML string, sem side-effects) e testável isoladamente.

## Funções Exportadas

### `gerarHtmlCorpoQuestao(questao, imgsOriginalQ, htmlImgsSuporte)`

Gera o corpo principal da questão — o enunciado que o aluno lê. Suporta dois formatos de dados:

**Formato Estruturado (`questao.estrutura`)**: Array de blocos tipados (texto, imagem, tabela, equação) gerados pelo pipeline de OCR/IA:

```javascript
if (questao.estrutura) {
  return questao.estrutura.map(bloco => {
    switch (bloco.tipo) {
      case "texto": return `<p class="q-text">${bloco.conteudo}</p>`;
      case "imagem": return `<img src="${bloco.url}" class="q-img" />`;
      case "tabela": return renderTable(bloco.conteudo);
      case "equacao": return `<div class="q-math math-block">${bloco.conteudo}</div>`;
      default: return `<p>${bloco.conteudo}</p>`;
    }
  }).join("");
}
```

**Formato Legado (`questao.enunciado`)**: String de texto simples, usado em questões importadas antes da implementação do formato estruturado:

```javascript
return `<p class="q-text">${questao.enunciado}</p>`;
```

Imagens de suporte (figuras referenciadas no enunciado) são appendadas ao final do corpo.

### `renderCreditosCompleto(gabarito)`

Monta a seção de créditos acadêmicos da resolução: autor/instituição, ano, origem da resolução (IA vs. humano), editores que revisaram, e data de última atualização.

```html
<div class="q-credits">
  <span>Resolução: 🤖 Gerada com IA (Gemini)</span>
  <span>Instituição: ENEM</span>
  <span>Ano: 2023</span>
  <span>Última revisão: 15/04/2026</span>
</div>
```

### `renderMatrizComplexidade(gabarito)`

Renderiza uma tabela visual mostrando a análise de complexidade da questão por competência BNCC. Cada competência recebe uma pontuação de 0-5 com barra de progresso colorida:

```html
<div class="q-complexity-matrix">
  <div class="q-complexity-row">
    <span>Interpretação Textual</span>
    <div class="q-complexity-bar" style="width: 60%"></div>
    <span>3/5</span>
  </div>
  <!-- ... mais competências -->
</div>
```

O cálculo vem do módulo `ComplexityCard.tsx` que analisa `gabarito.analise_complexidade`.

### `renderPassosComDetalhes(gabarito)`

Para questões com resolução passo-a-passo (comum em Matemática e Física), gera uma lista colapsável de passos:

```html
<div class="q-steps">
  <details class="q-step">
    <summary>Passo 1: Identificar as variáveis</summary>
    <div class="q-step-content markdown-content">
      Dado: v₀ = 10 m/s, a = 2 m/s²...
    </div>
  </details>
  <!-- ... mais passos -->
</div>
```

Cada `<details>` é colapsável nativamente pelo browser, sem JavaScript. O conteúdo interno é marcado com `markdown-content` para hydration posterior.

### `renderRelatorioPesquisa(gabarito)`

Quando o gabarito foi gerado pelo [Deep Search](/infra/deep-search) (busca em fontes externas), esta função renderiza um relatório detalhado mostrando:
- Fontes consultadas (URLs)
- Nível de confiança da resposta
- Discrepâncias encontradas entre fontes
- Justificativa para a resposta escolhida

### `renderFontesExternas(gabarito)`

Lista as URLs de fontes externas usadas na resolução, com links clicáveis e favicon de cada domínio.

### `renderBotaoScanGabarito(rawImgsG, jsonImgsG)`

Se existem imagens escaneadas do gabarito original (além do enunciado), renderiza um botão "📄 Ver Original (Gabarito)" que abre o modal de visualização de scan.

## Princípios de Design

1. **Funções Puras**: Toda função recebe dados e retorna string HTML. Zero side-effects, zero dependência de DOM global.
2. **Defensive Coding**: Cada campo é acessado com fallback (`|| ""`, `|| []`), pois dados de OCR/IA podem vir incompletos.
3. **Separação de Concerns**: Card-partes gera HTML estático. A interatividade (cliques, animações) é responsabilidade do [interacoes.js](/banco/interacoes).
4. **Escapamento XSS**: Strings vindas do banco são escapadas antes de inserção em atributos HTML.

## Referências Cruzadas

- [Card Template — Orquestrador que invoca estas funções](/banco/card-template)
- [Hydration — Componentes React hidratados após renderização](/banco/hydration)
- [Render Structure — Renderização de blocos de questão](/render/structure)
- [Visão Geral do Banco](/banco/visao-geral)
