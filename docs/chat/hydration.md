# Camada de Hidratação Dinâmica (DOM Hydration Loader)

## O Problema Ancestral do "Single Page Application (SPA)"

A engenharia estrutural do `maia.edu` não é um site estático do século XX, mas um colosso dinâmico gerado majoritariamente em Single Page Applications (arquiteturas React/Solid). Quando os metadados do Chat IA trafegam pelo fluxo SSE (Server-Sent Events) no formato fragmentado de NDJSON streaming, os chunks aterrissam na máquina do aluno crus e não compilados visualmente.
Se a *engine* apenas colasse o código LaTeX das fórmulas (ex: `$\int x \, dx$`) dentro de um parágrafo React, a tela imprimiria estritamente a string seca do cifrão. Faltava no DOM a "tinta" interpretativa capaz de desenhar matematicamente aquela arte.

A solução na aurora da era moderna da Web era entupir o arquivo principal do site web — o famigerado JS Bandwidth Bundle Principal — com todas as bibliotecas existentes do planeta. O usuário para logar na Maia baixaria de soco inicial o D3.js (2 Megabytes pesados), o pacote Mermaid inteiro, o HighlightJS com 50 linguagens e o interpretador de SVG Matemático KáTeX, custando inacreditáveis dezenas megas de payload de rede. Num país com 4G intermitente como o Brasil, a requisição resultaria em evasão instantânea da plataforma ("Demorou 12 segundos num celular pra carregar um chat em branco").

O antídoto sistêmico chama-se **Hidratação Diferida Dinâmica (Asynchronous Hydration Engine)**, uma mágica reativa que carrega apenas o que vai ser usado, apenas quando for ser usado.

## A Arquitetura do Injector Assíncrono (`hydration.js / loader.tsx`)

O controle mestre da Hidratação atua escrutinando sorrateiramente o que a API recém processou no bloco lógico da GPU. Se a IA enviou um pacote puramente em prosa text-markdown, o loader permanece adormecido, bloqueando puxadas de rede.

Mas, se o JSON emitido pela *Stream* trouxer um array identificando `{ tipo: "codigo" }` ou as meta-intruções da pedagogia estrita de `{ tipo: "dual-coding" }` invocando Mermaids complexos, um "Hook Alarme" é disparado no componente.

A partir desse momento, um código de empacotamento diferido ataca a árvore nativa do *Browser* adicionando tags `<script>` na Header de modo efêmero via API promissificada:

```javascript
// Exemplo sintético da abstração da Lógica de Hidratação na Web API
export const hydrateMermaid = () => {
    return new Promise((resolve) => {
        // Trava para não atolar repasses do mesmo pacote mil vezes por segundo
        if (window.mermaidInstanceLoaded) return resolve();
        if (window.isHydratingMermaid) {
            // Se já engatilhou, insere na fila passiva
            const checker = setInterval(() => {
                if (window.mermaidInstanceLoaded) {
                  clearInterval(checker);
                  resolve();
                }
            }, 100);
            return;
        }

        window.isHydratingMermaid = true;

        // Injeção da Tag limpa por CDN ultraveloz ou servidor assíncrono interno
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js";
        script.onload = () => {
            window.mermaid.initialize({
                startOnLoad: false,  // Domamos a engine manualmente após parsear
                theme: 'forest',     // Condicionado ao darkMode user settings
                securityLevel: 'strict'  // Bloqueio preventivo de XSS injetivo
            });
            window.mermaidInstanceLoaded = true;
            resolve();
        };
        document.head.appendChild(script);
    });
}
```
Isso desestabiliza a tese de letargia web. O estudante só gasta tempo carregando a pesada e monstra biblioteca do Mermaid caso o *Gemma/Flash Model* deduzir ativamente que seu cenário pedagógico EXIGE um diagrama. Num segundo turno o bloco carrega instataneamente, sem recarregamentos por já estar cacheado no browser.

## Isolamento Baseado em Shadow-Dom e Regex Hooks

Mas a hidratação não esbarra somente no problema de peso, e sim no *"Conflito Cascata de Renderização"*. 

As engines de SVG dinâmicos como KaTeX ou Chart.JS têm o terrível costume de alterar propriedades globais do documento local. Para piorar, num mundo multi-chats, se você abrir uma aula de Físico-Química em paralelo a uma de Arquitetura de Software numa janela vizinha, os "Mermaids" vão lutar brutalmente pelo index de ID numérico na UI. 

A arquitetura contorna esse banho de sangue injetando e randomizando os componentes hidratáveis contidos nas classes delimitadoras do pai React, engarrafando em `<div id={"mermaid_box_" + uuid()}>`. 
Quando a string de Hidratação engatilhar o render final (*`mermaid.render(...)`*), os nodes injetados de CSS estendido se limitam àquele contêiner, varrendo perfeitamente os bugs da interface sem quebrar o componente da aba do irmão gêmeo vizinho.

## Prevenção a Ataques de Injeção Maléfica (XSS)

Como as pipelines empurram blocos estritamente controláveis por IA sem regulação humana prévia de um *"Editor Senior"*, permitir hidratadores globais como códigos SVG rodando arbitrariamente em blocos renderizados causaria o evento onde "A IA pudesse gerar SVG com tags onclick='roubarToken()'".
As rotinas de hidratação na via frontend interceptam a string via DOMPurify antes do repasse à engine crua das bibliotecas pesadas. Além de exigir nas flags diretivas o *securityLevel: strict*. A segurança, na edTech scale, nunca opera como "nice to have", e sim como prioridade número 1.

## Associações Conceituais Fortes
- [Como as Prompts ditam a escolha do Dual-Coding?](/chat/metodologias)
- [A Estrutura do Json Exigida pelas Interfaces de Grids Reativas](/chat/schemas-layouts)
- [A Árvore dos Componentes TSX de Renderização](/chat/render)
