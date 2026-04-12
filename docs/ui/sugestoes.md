# Sugestões Dinâmicas (Overview Lexical)

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+sugestoes&labels=docs)

## Visão Geral Estrutural

O módulo de Sugestões (referenciado em código como `suggestion-generator.js`), listado na matriz de serviços sob a infraestrutura da UI, é um subsistema não-inteligente para predição humana. O Maia.edu não adivinha a matéria correta consumindo a API LLM do lado cliente para popular cards de preenchimento, pois a latência do primeiro ping (TTFB) de sugestões impactaria no TTI (Time to Interactive). Toda a rede referencial pedagógica do Brasil de `TOPICOS`, `MATERIAS` e `TEMAS` está encodada (hardcoded) estaticamente para milissegundos de performance sem banda de rede.

Com mais de 650 linhas locais, esse documento fornece arquitetura auxiliar para garantir as métricas operacionais sem fricção da inteligência artificial.

## Algoritmo Central: A Gramática Generativa em AST

O problema solucionado no motor não requeria inteligência, contudo ele transbordou a simples concatenação de preposições. Os templates:
```
"O que mais cai de {materia} no ENEM?"
"Me ensine {topico} do zero"
```
Precisavam de correções léxicas morfológicas acionáveis, visto que o motor geraria *“O que mais cai de a história no ENEM”* - uma abominação sintática terrível de ser enxergada no primeiro layout do usuário. 

Isto se assemelha a uma pequena árvore abstrata rudimentar e um Lexer, que busca e substitui strings de alta previsibilidade pelas conotações brasileiras puras: "da", "do", "das", "na", “no”. 

### Os Quatro Vetores de Sorteamento

Este sub-módulo gera quatro tipos textuais, chamados nos renderizadores:
- `generateSuggestions(count)`: Abastece os botões/pílulas rápidos no rodapé vazios baseados em `{SUGGESTION_TEMPLATES}`
- `generatePlaceholder()`: Abastece a string d'água invisível de dicas randômicas atrás da textarea do Chat baseados em `{PLACEHOLDER_TEMPLATES}` (focam no engajamento: *"Topa aprender {topico_art} agora?"*)
- `getRandomTopico()`: Injeta estresse granular de matrizes
- `getRandomTema()`: Especializa esferas de redação do ENEM ("inclusão digital", "saúde mental").

Isto livra que bibliotecas complexas como NextJS i18n fossem instaladas num esqueleto vitepress unicamente para gerir interpolamentos gramaticais. As regras puramente nativas do JavaScript (`string.replace(/\bde o\b/gi, "do")`) oferecem o *Zero Bundle Impact* desejado do projeto em VanillaJS.

## Referências Cruzadas

- [Suggestion Generator — Módulo completo da arquitetura léxica da Maia](/ui/suggestion-generator)
- [Chat UI — Área gráfica onde os lexemas preenchem blocos de UI (bolhas vazias)](/chat/chat-ui)
- [Chat Input — Área que aciona a mutação de placeholder a cada interação](/chat/chat-input)
