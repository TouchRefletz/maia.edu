# Controlador Gráfico de Chat (Block Renderer UI)

## A Implosão do Markdown Monolítico

Nos meandros da arquitetura Web convencional (e nos clones padrão de aplicações calcadas baseadas em OpenAI Models), quando a *engine* recebe a string mastigada de conversação, o ato de desenhá-la no navegador limitava-se primitivamente a injetá-la dentro de um empacotador de `ReactMarkdown`. Tudo orbitava o texto. Havia pouco para nada de estado iterativo rico; tudo colapsava num oceano brutal de tags HTML rasas (`<p>`, `<h1>`, `<blockquote>`).

O sistema da *maia.edu* revolucionou essa premissa primata criando a camada isolada que transfigura Objetos Json Estritos em Árvores Complexas de Componentes Interativos (`Block Render Hierarchy`). Aqui reside o manual descritivo de como a tela final do aluno lê, entende e transforma os pacotes matemáticos do [Schema OpenAPI](/chat/schemas-blocks) em elementos clicáveis em milissegundos.

## O Switch/Case Gigante do React (The Block Factory)

Se todo modelo LLM jorra um ou múltiplos `layouts` (com seus arrays designados em iteradores nativos contendo blocos heterogêneos), torna-se o papel exclusivo da Fábrica de Renderização mapear a raiz tipada para um componente `.tsx` purista.

Esse mapeador global (`ChatRender.tsx` ou análogos no ecossistema frontal puro) importa exaustivamente sub-arquivos menores altamente testados, e delega o DOM isolado:

```javascript
// Exemplo sintético da Fábrica Lógica de Renderização
import EquacaoBlock from './blocks/EquacaoBlock.tsx';
import ScaffoldingCard from './blocks/ScaffoldingCard.tsx';
import MermaidEngine from './blocks/MermaidEngine.tsx';

const RenderBlock = ({ data }) => {
  switch (data.tipo) {
    case 'equacao':
      // Invoca KaTeX asíncrono
      return <EquacaoBlock content={data.conteudo} />;
      
    case 'codigo':
      // Hydrata Highlight.js ou Prism
      return <CodeFenceBlock language={data.props?.language} content={data.conteudo} />;
      
    case 'scaffolding':
      // O Santo Grau da Interatividade State-Bound
      return <ScaffoldingCard stateObject={data} />;
      
    case 'destaque':
      // Divisórias semânticas de callout
      return <AlertCallout variant={data.props?.color}>{data.conteudo}</AlertCallout>;

    case 'tabela':
      // Invoca um Wrapper flexível que previne a quebra em viewport menor mobile
      return <FlexibleTable markdownString={data.conteudo} />;
      
    default:
      // O Fallback inevitável (Markdown Limpo)
      return <MarkdownRenderer content={data.conteudo} />;
  }
}
```

O isolamento componentizado assegura que as importações pesadíssimas de bibliotecas não contaminem todos os módulos indiscriminadamente (O Princípio de _Code-Splitting_ Lógico). Se uma div do chat inteiro não usar "mermaid", o pacote JavaScript de 3 Megabytes do D3/Mermaid jamáis entupirá e drenará os dados da franquia de rede de um dispositivo 3G do estudante na escola pública.

## Interatividade Protegida Pelo Estado Mutável

A grandeza desta abstração visual repousa no poder da interatividade local no Browser que seria virtualmente inatingível via string bruta devolvida por ChatGPTs:

### A) Componente de Scaffolding Blindado
Imagine o `case 'scaffolding'`. Ao esbarrar neste bloco, o `ScaffoldingCard` cria Hooks do *React* (`useState`) que englobam a tentativa de resposta do estudante num mini-questionário interativo com dois botões gigantes "Verdadeiro" ou "Falso".

O LLM terminou de gerar a stream, ele não controla mais a máquina. O Estudante pressiona `"Verdadeiro"`. Imediatamente, sem bater rede em servidor algum, o React renderiza internamente uma *div* laranja resgatando o `feedback_v` recebido dentro do JSON, mostrando que ele vacilou. Apenas se e quando o aluno avançar todos os blocos, que o motor devolve o log pra API subir no histórico. A economia térmica pra API e o fluxo cognitivo do estudante é indescritivelmente absurdo de eficiente.

### B) Motor KaTeX Auto-Excludente
Modelos LLM geram equações e fecham parênteses errados rotineiramente (mesmo atrelados no CoT duro). Um renderizador Markdown comum quebraria o post. O bloco específico isolado passa um Scanner RegEx de tolerância falhosa antes da `div` bater em tela, impedindo poluição do DOM de vizinhos alocados próximos.

## Animação em Cascata (UX Transparente)

Sistemas Streamados baseados em SSE (Server Sent Events) sofrem de uma terrível anomalia chamada "efeito Máquina de Escrever", em que a UI pipoca saltitando na tela enquanto a div readapta a altura para caber textos. 

Como nós empacotamos os envios via JSON e os blocos já anunciam previamente a *tag* inicial (ele joga o `{tipo: 'equacao'}` milissegundos antes da string começar a ser parida nas entranhas processuais), a interface constrói de forma elegante a borda cinza preenchida em "skeleton" piscante do bloco enquanto aguarda o conteúdo ser populado. Assim o estudante visualmente entende que a caixa da matriz gráfica já reservou o espaço.

## O Controle Absoluto de Layouts Direcionais (A Casca)

Antes que um bloco caia na tela, ele deve ser abraçado por um pai controlador, que é regido pelas amarras estritas no sistema OpenAPI. 
Se a predição da engrenagem jogar a malha em `'split_screen'` listado, o front criará as FlexBoxes rígidas `<div className="w-1/2 flex border-r">` direcionando precisamente os Arrays designados, formando painéis assustadoramente interativos.

## Amarrações Teóricas Associadas
- [Engine das Prompts de Layout e Modais Específicos](/chat/schemas-layouts)
- [A Classificadora Analítica Socrática de Background](/chat/scaffolding-service)
- [Hidratação Dinâmica do DOM (Módulos Ocultos)](/chat/hydration)
