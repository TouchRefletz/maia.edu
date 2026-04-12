# Pesquisa de Gabarito — Integração RAG de Acertos

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+gabarito-pesquisa&labels=docs)

## Visão Geral

A documentação conceitual de Busca em Gabaritos aborda a forma primária pela qual a Maia cruza uma questão fotográfica em PDF (Lida por OCR) e obtém sua Letra Certa Baseada num Grid de Gabaritos. Essa ponte lida desde Arrays básicos preenchidos por tabelas, até pesquisas Vetoriais Densas via RAG (Retrieval-Augmented Generation) atrelada aos datasets da HuggingFace.

Muitas vezes embutido em lógicas partilhadas (Como `Search Logic` e `Cloudflare Proxies`), a engine de Gabarito resolve a dicotomia do "Extrator Fantasma" sem que o usuário sofra no Input Box.

## RAG e Semantic Hash (Busca por Similaridade)

O maior erro dos sistemas clássicos educacionais na conversão PDF->Banco de Questões é depender unicamente do número físico impresso na lateral. Se a questão estiver no "Caderno Amarelo" é 45. Se for o "Azul" é 91. Isso quebra qualquer pipeline rígido.

A arquitetura da Maia que abandona o modelo tabular por um Cross-Check Semântico:

1. A IA Escalonadora (O Scanner/Editor Múltiplo IA) obtém as strings brutas do Enunciado e das 5 alternativas.
2. A Nuvem converte silenciosamente num Vetor de Embeddings de 768 dimensões com transformers ultraleves ou delega o "Text-Diff" heurístico.
3. Este hash semântico cruza The Source File do Gabarito (muitas vezes em txt plano ou json-lines salvo pela Cloudflare dentro de `[Slug]/manifest.json`).

Mesmo ignorando o número absoluto da prova impresso em tela, o Algoritmo "Locker" garante que a string *"Um trem bala de madri viaja"* cruze na base com o Target *"C"* e imprima o status "Correto".

## Fator de Corrigibilidade Autônoma (Fallback)

Para não poluir o Hub com Falsos Positivos, caso o nível de confiança (Confidence Interval) da Busca Semântica desça do threshold crítico (Configurado na engine de LLMs), ele abandona as adivinhações cegas. 
A aba lateral (Task Workflow) é mantida num Estado Persistente de `{ LetraCorreta: null }`, delegando o *Dever Humano*. O professor insere ao longo da UI visual do SideBar clicando com o mouse a resposta ("E") e preenchendo as nuances.

## Caching de Arquivo Integral

Sempre que a Extração carrega Prova e Gabarito (Upload Híbrido Simultâneo), o `pdf-hash` (Mapeamento Visual Identitário) os fundem nos diretórios provisórios (ex: `https://huggingface.co/../files/`). Diferente de antigamente, O GABARITO NÃO PEGA DOWNLOAD do Blob toda vez. O Extrator mantém o Manifesto do Gabarito pré-compilado na Heap de memória durante a inserção de todas as outras 40 questões, barateando acessos sequenciais do Worker em 100%.

## Referências Cruzadas

- [Editor Córner — Onde as caixas são sublinhadas fisicamente](/editor/modo-recorte)
- [Proxy Service — Mecanismo usado pela API RAG para busca profunda de Strings Semânticas](/api-worker/proxy-services)
- [Ai Image Extractor — A extração bruta de string que permite achar o Match com o Gabarito Textual](/api-worker/proxy-services)
