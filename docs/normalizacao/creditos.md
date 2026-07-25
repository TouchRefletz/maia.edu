# Normalização de Créditos e Bancas (`js/normalize/creditos.js`)

## Arquivo-Fonte

| Propriedade | Valor |
|---|---|
| **Arquivo** | [`js/normalize/creditos.js`](file:///c:/Users/jcamp/Downloads/maia.api/js/normalize/creditos.js) |
| **Escopo** | Canonização de metadados de atribuição, instituições, bancas de exames, anos e origem de resolução |
| **Funções Principais** | `normalizarCreditos()`, `canonicalizarInstituicao()`, `extrairAno()`, `validarOrigemResolucao()` |

---

## 🎯 Visão Geral e Arquitetura

No contexto de vestibulares e exames acadêmicos no Brasil, um dos maiores desafios de indexação de dados é a incoerência dos metadados de atribuição. Por exemplo, a Fundação Universitária para o Vestibular pode aparecer como `FUVEST`, `Fuvest`, `FUVEST - 1ª Fase`, `FUVEST 2024` ou `Fundação Universitária p/ o Vestibular`.

O arquivo `js/normalize/creditos.js` resolve esse problema de taxonomia aplicando um dicionário de equivalência de marcas educacionais brasileiras, extração determinística de anos por expressão regular e atestação de confiança da fonte.

---

## ⚙️ Regras de Canonização

### 1. Dicionário de Instituições e Bancas Reconhecidas
O módulo mantém um mapa interno de equivalências para converter variações textuais na chave primária da instituição:

```javascript
const MAPA_INSTITUICOES = {
  'FUVEST': ['FUVEST', 'FUVESTE', 'FUNDACAO UNIVERSITARIA PARA O VESTIBULAR'],
  'UNICAMP': ['UNICAMP', 'COMVEST', 'UNIVERSIDADE ESTADUAL DE CAMPINAS'],
  'ENEM': ['ENEM', 'INEP', 'EXAME NACIONAL DO ENSINO MEDIO'],
  'UNESP': ['UNESP', 'VUNESP', 'UNIVERSIDADE ESTADUAL PAULISTA'],
  'ITA': ['ITA', 'INSTITUTO TECNOLOGICO DE AERONAUTICA'],
  'IME': ['IME', 'INSTITUTO MILITAR DE ENGENHARIA'],
  'UERJ': ['UERJ', 'UNIVERSIDADE DO ESTADO DO RIO DE JANEIRO'],
  'UFRJ': ['UFRJ', 'UNIVERSIDADE FEDERAL DO RIO DE JANEIRO'],
  'UFMG': ['UFMG', 'UNIVERSIDADE FEDERAL DE MINAS GERAIS'],
  'UFPR': ['UFPR', 'UNIVERSIDADE FEDERAL DO PARANA'],
  'UFRGS': ['UFRGS', 'UNIVERSIDADE FEDERAL DO RIO GRANDE DO SUL']
};
```

### 2. Extração Regex de Ano (`extrairAno`)
Para prevenir erros onde o modelo confunde números de questão ou páginas com o ano da prova, aplica-se uma checagem de intervalo plausível `[1970 - 2030]`:

```javascript
// Captura 4 dígitos consecutivos no intervalo válido de anos de exames
const ANO_REGEX = /\b(19[7-9]\d|20[0-3]\d)\b/;
```

### 3. Validação de Origem da Resolução (`origemresolucao`)
Mapeia se a explicação associada veio diretamente do caderno oficial de gabaritos ou se foi sintetizada via LLM:
- `"extraido_do_material"`: A resolução é a chave oficial fornecida pela banca examinadora.
- `"gerado_pela_ia"`: A resolução foi elaborada via raciocínio pedagógico do Gemini 3.5 Flash.

---

## 🛠️ Implementação do Código

```javascript
import { cleanText } from './primitives.js';

/**
 * Canoniza o nome da instituição examinadora.
 * @param {string} rawName - Nome bruto retornado pela IA.
 * @returns {string} Nome padronizado da instituição.
 */
export function canonicalizarInstituicao(rawName) {
  if (!rawName || typeof rawName !== 'string') return 'Desconhecida';
  
  const textNormalized = rawName
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  for (const [canonical, aliases] of Object.entries(MAPA_INSTITUICOES)) {
    if (aliases.some(alias => textNormalized.includes(alias))) {
      return canonical;
    }
  }

  return cleanText(rawName);
}

/**
 * Normaliza o objeto de créditos do gabarito.
 * @param {Object} creditosRaw - Objeto de créditos bruto.
 * @returns {Object} Objeto de créditos padronizado.
 */
export function normalizarCreditos(creditosRaw = {}) {
  const autorOuInst = creditosRaw.autorouinstituicao || creditosRaw.autor_ou_instituicao || creditosRaw.banca || '';
  const anoBruto = creditosRaw.ano || creditosRaw.ano_prova || '';

  // Extração do ano
  const matchAno = String(anoBruto).match(/\b(19[7-9]\d|20[0-3]\d)\b/);
  const anoFinal = matchAno ? matchAno[1] : (creditosRaw.ano ? String(creditosRaw.ano) : null);

  // Canonização da banca
  const bancaFinal = canonicalizarInstituicao(autorOuInst);

  return {
    ano: anoFinal,
    autorouinstituicao: bancaFinal,
    material: cleanText(creditosRaw.material || creditosRaw.prova || 'Caderno de Questões'),
    confiancaidentificacao: typeof creditosRaw.confiancaidentificacao === 'number' ? creditosRaw.confiancaidentificacao : 1,
    materialidentificado: Boolean(creditosRaw.materialidentificado ?? true),
    origemresolucao: creditosRaw.origemresolucao === 'extraido_do_material' ? 'extraido_do_material' : 'gerado_pela_ia'
  };
}
```

---

## 📊 Tabela de Schema de Créditos

| Campo | Tipo | Nulável | Descrição | Exemplo |
|---|---|---|---|---|
| `ano` | `string` | Sim | Ano de realização da prova com 4 dígitos | `"2024"` |
| `autorouinstituicao` | `string` | Não | Nome canonizado da banca ou vestibular | `"FUVEST"` |
| `material` | `string` | Não | Nome ou identificador do caderno/etapa | `"1ª Fase - Caderno V"` |
| `confiancaidentificacao` | `number` | Não | Score de certeza da atribuição `[0 - 1]` | `1` |
| `materialidentificado` | `boolean` | Não | Flag que atesta se a prova foi confirmada | `true` |
| `origemresolucao` | `string` | Não | Enum (`"extraido_do_material"` \| `"gerado_pela_ia"`) | `"gerado_pela_ia"` |

---

## 🔗 Referências Cruzadas
- [Data Normalizer Pipeline](/normalizacao/data-normalizer)
- [Payload Principal](/normalizacao/payload)
- [Estrutura de Dados no Firebase](/firebase/estrutura-rtdb)
