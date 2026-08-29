# Primitivas e Utilitários de Texto (`js/normalize/primitives.js`)

## Arquivo-Fonte

| Propriedade | Valor |
|---|---|
| **Arquivo** | `js/normalize/primitives.js` |
| **Escopo** | Utilitários de sanitização de strings, unescape de HTML, normalização de caracteres e TeX/LaTeX |
| **Exports** | `cleanText()`, `unescapeHTML()`, `sanitizeLaTeX()`, `slugify()` |

---

## 🎯 Visão Geral e Arquitetura

O `js/normalize/primitives.js` reúne funções puras de manipulação de texto de baixo nível sem side effects. Essas primitivas são invocadas em todas as etapas da pipeline de normalização para sanitizar entradas brutas de OCR, evitar quebras em parsers de Markdown/LaTeX e padronizar slugs de busca.

---

## 🛠️ Funções Exportadas e Implementação

```javascript
/**
 * Limpa espaços em branco indevidos e remove caracteres de controle invisíveis.
 * @param {string} str - String a ser limpa.
 * @returns {string} String higienizada.
 */
export function cleanText(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F]/g, '') // Remove caracteres de controle ASCII
    .replace(/\r\n/g, '\n')                             // Normaliza quebras de linha Windows
    .replace(/[ \t]+/g, ' ')                           // Colapsa múltiplos espaços/tabs
    .trim();
}

/**
 * Converte entidades HTML escapadas em caracteres ASCII/UTF-8 puros.
 * @param {string} str - String com entidades HTML.
 * @returns {string} String com caracteres desescapados.
 */
export function unescapeHTML(str) {
  if (typeof str !== 'string') return '';
  const htmlEntities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' '
  };
  return str.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, match => htmlEntities[match] || match);
}

/**
 * Sanitiza expressões LaTeX para evitar erros de síntese no KaTeX.
 * @param {string} str - Texto contendo equações TeX.
 * @returns {string} Texto com equações TeX padronizadas.
 */
export function sanitizeLaTeX(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/\\text\s*\{\s*\}/g, '')                  // Remove tags \text{} vazias
    .replace(/\\begin\s*\{\s*align\*\s*\}/g, '\\[')     // Converte ambientes align não suportados
    .replace(/\\end\s*\{\s*align\*\s*\}/g, '\\]')
    .replace(/\$\$/g, '\n');                             // Substitui $$ por quebras limpas
}

/**
 * Gera um slug amigável para URLs e chaves a partir de um texto.
 * @param {string} text - Texto de origem (ex: "FUVEST 2024 Primeira Fase").
 * @returns {string} Slug canonizado (ex: "fuvest-2024-primeira-fase").
 */
export function slugify(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos e acentos
    .replace(/\s+/g, '-')            // Substitui espaços por hífens
    .replace(/[^\w\-]+/g, '')        // Remove caracteres especiais
    .replace(/\-\-+/g, '-')          // Colapsa hífens duplos
    .replace(/^-+/, '')              // Trim no início
    .replace(/-+$/, '');             // Trim no fim
}
```

---

## 📊 Matriz de Testes de Unidade das Primitivas

| Função | Entrada (`Input`) | Saída Esperada (`Output`) |
|---|---|---|
| `cleanText` | `"  Olá\r\n\tMundo!  \x07"` | `"Olá\nMundo!"` |
| `unescapeHTML` | `"10 &lt; 20 &amp;&amp; a &gt; b"` | `"10 < 20 && a > b"` |
| `sanitizeLaTeX` | `"$$\\text{} E = mc^2 $$"` | `"\n E = mc^2 \n"` |
| `slugify` | `"FUVEST 2024 (1ª Fase - Prova V)"` | `"fuvest-2024-1a-fase-prova-v"` |

---

## 🔗 Referências Cruzadas
- [Data Normalizer Pipeline](/normalizacao/data-normalizer)
- [Alternativas](/normalizacao/alternativas)
- [Creditos](/normalizacao/creditos)
