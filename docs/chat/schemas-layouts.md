# Schemas de Layouts — Grid Templates de Injeção Visual da Maia IA

> 🤖 **Disclaimer**: Documentação gerada por IA e rigorosamente auditada. [📋 Reportar erro no Módulo Schemas de Layout](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+schemas-layouts&labels=docs)

## 1. Visão Geral e Contexto Histórico

O ecossistema `schemas.js` (`js/chat/schemas.js`) da Maia EDU transcende a mera limitação de "o que a IA pode dizer" (Os *Blocks*). Sua vocação de nível primário reside na definição global dos **Layouts**.

Na versão legada (V1) e em sistemas como o ChatGPT, o Front-end assume um controle "Linear" irredutível: o Chat desce de cima para baixo como um pergaminho egípcio infinito. A partir da V2, a plataforma incorporou um *Renderer Visual* que reage às Intenções Arquiteturais do Google Gemini. Se um professor pede `Compare a Revolução Russa de Lenin vs Trotsky`, a IA não deve cuspir dois parágrafos isolados. A IA da Maia entende a heurística corporativa, escolhe o "Layout Split Screen (Coluna Dupla)", insere o Parágrafo A no Slot Esquerdo, e o C no Slot Direito, orquestrando um render de painel duplo lado a lado (Side-By-Side Vue). 

Isso exige o Módulo Mestre de Schemas de Layout para amarrar os conectivos de Design (CSS) com o Prompt (JSON Model), eliminando quebras ou alucinações de layouts não desenhados pelo Software Engineer.

---

## 2. Arquitetura de Variáveis e State Management (Mapeamentos Estruturais)

A variável principal de restrição não é lógica iterativa, é Regra Estrita exportada via Tipagem Enumerable. Esta tabela ilustra os nós vitais:

| Módulo/Variável | Localização Lógica | Natureza Estrutural | Função Explícita |
|-----------------|--------------------|---------------------|------------------|
| `LAYOUT_TYPE` | Array Constante | Enum Validation | Coleira Algorítmica Global. Contém 12 estritos Arrays de design (`["two_column", "split_screen", "asymmetrical", "f_shape", "z_shape", "magazine", "interactive_carousel", "linear"]`). Isso é passado como `$ref` pro Payload Strict do LLM. |
| `LAYOUT_SLOTS` | Object Hash Map | Associação Filha | Associa cada Tipo (`id`) a suas Caixas ("Slots"). Se a IA atirar e escolher usar uma Magazine, ela FICA OBRIGADA pelo SCHEMA de devolver seu conteúdo dividido nos arrays dos chaves exclusivas: `[headline, featured, sidebar, feed]`. Não há fuga. |
| `LAYOUTS_INFO` | Array Objects | Zero-Shot Dictionary | Serve como Dicionário Educacional (Meta-Prompting). É iterado no SystemPrompt para ensinar à I.A *"quando brincar de qual"*. Ex: Ensina a IA a usar The Z-Shape Layout apenas para Storytelling. |

A integridade deste estado global previne um desastre no componente React `LayoutManager`, garantindo que chaves indefinidas (`params.extra_grid`) jamais surjam de maneira espontânea provindas do LLM.

---

## 3. Diagrama: O Fluxo de Engate de "Slots Múltiplos"

Todo o Raciocínio (Chain of Thought - CoT) do Gemini passa pelo filtro do "Em qual buraco eu coloco esse prego":

```mermaid
flowchart TD
    Init[Vertex AI Gera o Abstract Tree] --> EscolhaLayout{Seleciona o ID de Layout}
    
    EscolhaLayout -->|'linear'| CargaLinear[Carrega Objeto em 'conteudo']
    EscolhaLayout -->|'split_screen'| CargaSplit[Engata Objeto de "slots" invés de "conteúdo"]
    EscolhaLayout -->|'magazine'| CargaHardcore[Acorda Multi-Arrays]
    
    CargaSplit --> LoopSplitEsquerda[Gera Array pro Slot: 'left']
    CargaSplit --> LoopSplitDireita[Gera Array pro Slot: 'right']
    
    LoopSplitEsquerda --> BlocosEsquerda[Blocks Padrão (Titulos, Textos)]
    LoopSplitDireita --> BlocosDireita[Blocks Code (Listas, Equações)]
    
    CargaHardcore --> EngataHeadline[Array: 'headline']
    CargaHardcore --> EngataSidebar[Array: 'sidebar']
    
    BlocosEsquerda --> Unificacao[Retorna Unified JSON Array na String HTTP]
    BlocosDireita --> Unificacao
    EngataHeadline --> Unificacao
    
    Unificacao --> ParserFront[Maia UI Renderer. Renderiza CSS Grids dinâmicos em tela.]
```

Os Loops acima representam o momento Cognitivo do Google Gemini decidindo, antes mesmo do primeiro bit ir pra Internet, o design estético da página baseada na pedagogia envolvida no input do estudante.

---

## 4. Snippets de Código "Deep Dive" (O Schema de Formatação Estrita - Strict Formatter)

Aqui, expomos a engenharia de precisão presente no código-fonte, forçando Arrays Paralelos aninhados: a "Nested Objects Architecture" (Objeto Aninhado). 

```javascript
/* Trecho Isolado do Layout Layout_config && Layout_structure de Schemas.js */

layout_structure: {
  type: "object",
  properties: {
    layout: { $ref: "#/definitions/layout_config" },
    
    // A Complexidade se encontra AQUI. A IA ignora o "conteúdo" linear 
    // e deve montar Map Arrays DENTRO de nomes de Slots Livres mas mapeados.
    slots: {
      type: "object",
      description: "Map de slots para layouts estruturados (ex: split_screen com left e right).",
      // A chave (left) é flexivel, mas o Valor deve ser SEMPRE um Array de Blocos Estritos.
      additionalProperties: {
         type: "array",
         items: { $ref: "#/definitions/block" }
      }
    },
    
    // Fallback: Se for "linear", desonera o objeto pesado de Slots.
    conteudo: {
      type: "array",
      description: "Lista linear de blocos. Usado primariamente pelo layout 'linear'.",
      items: { $ref: "#/definitions/block" }
    }
  },
  required: ["layout"], // Ao menos a IA tem que devolver o ID do layout q pediu.
  additionalProperties: false
}
```

### Prompt Educacional de Design (A IA Lendo HTML Sem Ver)

O Módulo não confia na IA para decorar regras semânticas complexas. O dicionário abaixo, renderizado dentro do código estrito via `Array.prototype.map`, compila ativamente a educação visual para o LLM.

```javascript
export const LAYOUTS_INFO = [
  {
    id: "f_shape",
    name: "F-Shape Layout",
    description: "Segue o padrão cognitivo global de leitura Web-Design. Topo denso + Coluna esquerda (Lista). Ideal para Dashboards complexos com muita informação relacional em Tópicos Extremos."
  },
  {
    id: "interactive_carousel",
    name: "Interactive Layout",
    description: "Bloco central isolado com micro-controles de navegação temporal (setas esquerda/direita). O padrão de excelência Ouro para Wizards, Guided-Tours Educacionais (passo-a-passo linear focado) ou revisões de questão únicas com foco total."
  }
];
```

Essa instrução textual converte-se num "Designer Virtual" para o ChatGPT e Gemini, instigando o modelo generativo a assumir nuances de Product Designer / UI/UX Designer antes de redigir a resposta sobre Estequiometria.

---

## 5. Integração Prática no Front-End CSS Grids

O Layout não funciona em vão. O JSON validado por este arquivo deságua no Componente Front-end que, se ler uma formatação de colunas, chama instâncias estritas do Flexbox ou CSS Grid da seguinte mandeira (CSS Simplificado Mapeado):

```css
/* Quando a resposta vem Atrelada a ID 'split_screen' */
.layout-split_screen {
   display: grid;
   grid-template-columns: 1fr 1fr; /* Exact 50/50 division as requested by the schema */
   gap: 2rem;
   align-items: start;
}

@media(max-width: 768px) {
   .layout-split_screen {
      /* Degradação graciosa em telas de celulares para Linear System Defaults */
      grid-template-columns: 1fr;
   }
}

/* Quando a resposta enganta num ID 'asymmetrical' */
.layout-asymmetrical {
   display: grid;
   grid-template-columns: 7fr 3fr; /* Respeitando a promessa de 70/30 Asymmetrical */
   gap: 2rem;
}
```
Isso mostra uma co-dependência total. Se o arquivo `Schemas.js` resolver criar um layout novo e renomear para `"circular_wheel"`, e isso bater no App sem que a classe de mesmo nome base global `.layout-circular_wheel` esteja programada nos arquivos globais de design primitive, a Interface se despedaça ou retorna para um colapso em Display block empilhado.

---

## 6. Manejo Psicológico e Crítico de Edge Cases Místicos de IAs

A imprevisibilidade generativa, quando colidimos uma string aberta com Layouts que forçam CSS Hardcoded, precisa de blindagem extrema contra Hallucinations Visuais.

| Ataque/Anomalia Aleatória na Resposta | Regra Mitigadora Arquitetada | Efeito de Resiliência na UX Final |
|---------------------------------------|------------------------------|-----------------------------------|
| A Inteligência Artificial decide mandar conteúdo *dentro* da Tag `Main` em um Layout do Tipo "Magazine", mas o Schema da Magazine obriga: `[headline, featured, sidebar, feed]`. | No pré-processamento de coerção Google-Side, um erro de sub-propriedade invalida o Payload. No Client Side Front, varremos as chaves enviadas. | Qualquer chave (Slot Name) emitido pela I.A que fuja dos parâmetros previstos quebra silenciosamente para array Linear ou ignora a Div não mapeada CSS, impedindo Poluição no Container. |
| A IA tenta colocar um `Three_Column` usando "Col1, Col2, Col3 e Col4" | O Strict Mode Configuration `additionalProperties: false` das sub-árvores previne The Injection. | O servidor barrará a emissão excedente que torceria as matrizes de CSS. Garante-se o renderizado visual em 3 esmagadoras colunas limpas. |
| Perda de Fio Cognitivo (O famoso: 'Tio, me ensina raiz, mas num Split Screen'). A I.A fica maluca entre obedecer o aluno ou o Sistema. | O System Prompt hierarquizado dita The Priority Master, enquanto o Schema dita as Borders. | Pela lei de Strict Json, o sistema prioriza o Design Limpo. Caso o LLM force uma quebra, cai na reparação manual do JSON e é renderizado Linearmente sem pânico de tela branca. |

---

## 7. Referências Cruzadas Completas

A complexidade e ramificação que regem a estética fluída baseada em IA de Layouts em vez de textos estão pulverizadas nestas teias analíticas:

- [Chat System Prompts (As Restrições Mentais da I.A) — Utiliza este Dicionário como um Cardápio para subornar o Modelo LLM durante a Ingestão do Texto Base enviando o "getLayoutsDescription()".](/chat/system-prompts)
- [Content Blocks (Schemas Básicos) — Os irmãos Siameses deste Schema de Layouts. Sem blocos pra encher os \`slots\`, os Grid Molds de Colunas Vias continuam vazios na renderização final.](/chat/schemas-blocks)
- [Router Prompt (Engine de Classificação Inicial) — O Orquestrador primário que julga quais instâncias devem nascer antes do Design tomar forma na Thread Central.](/chat/router-prompt)
- [Configurações Globais (.Vite Config / App) — De onde puxamos recursos de Layout e definimos os arquivos Estáticos Primários Base CSS para segurar isso de pé.](/infra/vite-config)
