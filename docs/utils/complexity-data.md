# Complexity Data — O Dicionário de Algorítmica Pedagógica

> 🤖 **Disclaimer**: Documentação gerada por IA e pode conter imprecisões. [📋 Reportar erro](https://github.com/TouchRefletz/maia.api/issues/new?title=Erro+na+doc:+complexity-data&labels=docs)

## Visão Geral

O arquivo estático `complexity-data.js` (`js/utils/complexity-data.js`) é a espinha dorsal matemática do **Radar de Complexidade Botânica** da Maia. Diferente de plataformas que classificam questões de forma binária (Fácil, Médio, Difícil), o motor da Maia destrói os micro-fatores de uma questão em vetores independentes: Leitura, Conhecimento Prévio, Raciocínio, e Fator Operacional.

Embora o arquivo contenha apenas estáticas em JSON (~90 linhas), ele atua quase como um *Smart Contract* sociológico que padroniza pesos semânticos em um único lugar, alimentando os gráficos hexagonais de aranha que professores analisam.

## Categorias Radiais (`CFG`)

O objeto base mapeia os 4 eixos dos radares gerados pelo Recharts/Chart.js na UI:

| Eixo | Cor CSS | Ação Medida |
|---|---|---|
| Suporte e Leitura | `var(--color-info)` | Avalia a carga cognitiva visual e linguística |
| Conhecimento | `var(--color-primary)` | Quantifica o "Core Syllabus" necessário decorado |
| Raciocínio | `#9333ea` | Abstração matemática e deduções ilógicas aparentes |
| Operacional | `var(--color-warning)` | Quantas páginas de cálculo a questão exige |

## A Teia de FATORES_DEF

A exportação `FATORES_DEF` é um array com exatamente 14 objetos que pontuam e distribuem pesos (`peso: x`).
A API Worker (Gemini) analisa secretamente cada string HTML de uma Questão. Se a Inteligência Artificial decide que a questão requer *Interdisciplinaridade*, a Engine do Node lê a key `interdisciplinaridade` e injeta peso 4 dentro do Eixo `Conhecimento Prévio`.

### O Agravo de Sobrecarga Oculta
Observe o nó `{ key: "raciocinio_contra_intuitivo", cat: "raciocinio", peso: 5 }`. Ele possui o maior peso do sistema (Peso 5). Por design heurístico brasileiro, questões do ITA frequentemente enganam o candidato logicamente. A Maia pune severamente estas questões no Gráfico. Quando esse Fator ocorre, o radar esmaga imediatamente o lado esquerdo da tela graficamente, subindo de Médio para Impossível sem envolver cálculos intensos.

### Mutações UI Decorrentes

Sempre que a `ui/` pede um "Tooltip", ele itera sobre os Labels contidos nesse arquivo (`"Julgamento/Nuance"`, `"Dedução Lógica"`, etc.), desonerando totalmente os React Components da responsabilidade de saberem do que se trata as flags obscuras devolvidas pelos Endpoints JSON criados pelo Gemini na Cloudflare.

## Referências Cruzadas

- [Editor Múltiplo IA — Onde a Maia calcula a complexidade na extração](/editor/multiplo-ia)
- [Pdf Renderers — Módulo UI onde as tags de complexidade colorem a div](/ui/pdf-renderers)
- [Gabarito Pesquisa — Módulo que atrela esses índices às listagens completas](/utils/gabarito-pesquisa)
