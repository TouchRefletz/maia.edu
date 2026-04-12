# PDF Visual Hash — Identidade Algebrica Imutável

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+pdf-hash&labels=docs)

## Visão Geral

O módulo `pdf-hash.js` e sua camada partilhada `shared-hash-logic.js` formam a linha de frente do Ecossistema Caching Distribuído da Maia. Eles não constroem um Hash SHA-256 baseado no Data Binary stream cru do arquivo `.pdf`. Um bit modificado em metadados estragaria o HASH cru. 
Em vez disso, a Maia computa um **Hash Visual**: ela processa o canvas renderizado oculto de N páginas chaves e converte os Pixels para string, gerando a "Digital Ótica Irrefutável" sobre aquele simulado físico, provando com 100% de garantia semântica se uma Prova em São Paulo é exatamente a idêntica enviada no Tocantins.

## Wrappers Específicos por Arquitetura

Como a Maia opera em Isomorfismo Severo via Node (Edge Cloudflare) e Chromium (Local Browser), o módulo base do Shared Hash é polimórfico, pedindo na raiz injeção de dependência de instâncias nativas da Fábrica de Canvas.

No arquivo Front-End, a fábrica provida via `require` manual em parâmetros é o motor interno de HTML5:
```javascript
const browserCanvasFn = (w, h) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return {
    canvas,
    context: canvas.getContext("2d", { willReadFrequently: true })
  };
};
```
O parâmetro de V8 Optimization `willReadFrequently` acelera a renderização matemática massivamente, sinalizando a Memory Access Tree que exigiremos puxar a matriz binária via `.getImageData()` imediatamente, escapando dos repasses ociosos de Memória GPU.

## SHA256 WebCrypto

Outro bypass vital injetado nesta camada utilitária é a conversão dos Buffers usando AES Nativos (Isentos de empacotar o NodeJS Crypto que inflaria o Bundle React):
```javascript
const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
const hashArray = Array.from(new Uint8Array(hashBuffer));
return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
```

Tudo flui da base global instanciada nativamente pela Mozzila (O PDFjsLib) que lê até no máximo o Limite Crítico de Páginas determinado na heurística do Shared File. 

## Vantagens no Domínio do Deep Search

Como o módulo extrai o Canvas da Capa (A Página 1) em pouca resolução e converte em Hash Visual alfanumérico, o *Form Loader* dispara o **Hash Preflight**. Em milissegundos o Worker da rede checa *"Nós temos um dataset no servidor com id visual ax42b"*. 

Qualquer anomalia que gere modificações mínimas de marcação no PDF por estudantes que rabiscaram o PDF em tablets não ativará match visual, garantindo isolamento clínico perfeito da Fonte Original Limpa para treinamento dos alunos.

## Referências Cruzadas

- [Form Logic — Componente que dispara esta lógica na etapa inicial (Pre-Flight) de Cache](/upload/form-logic)
- [Proxy Services — O Worker reativo na Digital Ocean que assina este Hash](/api-worker/proxy-services)
