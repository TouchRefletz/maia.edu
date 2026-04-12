# Glossário Técnico

Este glossário define todos os termos proprietários, acrônimos e conceitos técnicos utilizados ao longo da documentação e do código-fonte do maia.edu.

---

## A

### Alternativas Analisadas
Array de objetos que contém a análise detalhada de cada alternativa de uma questão objetiva. Cada item inclui a letra, o texto, se é correta, e uma justificativa de por que está certa ou errada. Gerado pelo pipeline de gabarito.

### AnchorData
Estrutura de dados que armazena as **coordenadas normalizadas** de um crop em relação à página do PDF. Contém `anchorPageNum`, `relativeLeft`, `relativeTop`, `unscaledW`, `unscaledH`. Essas coordenadas são independentes de zoom.

### Auto-Fit Zoom
Algoritmo do PDF Viewer que calcula automaticamente o nível de zoom ideal baseado na largura do container. Ativado em telas menores que 900px.

---

## B

### Batch Processor
Classe (`BatchProcessor`) responsável por processar **múltiplas questões sequencialmente** após o AI Scanner detectar crops. Executa: extração de texto → detecção de imagens → geração de gabarito → normalização → upload.

### Best-Effort Parsing
Estratégia de parsing que tenta extrair o máximo de dados possível de JSON parcial ou malformado. Utiliza a biblioteca `best-effort-json-parser`. Essencial para streaming de respostas da IA.

### Bottom Sheet
Padrão de UI mobile onde a sidebar aparece como um painel que sobe do fundo da tela (bottom), com drag handle para abrir/fechar. Implementado em `sidebar-mobile.js`.

### Bounding Box
Retângulo que delimita uma região de interesse em uma imagem/página. No maia.edu, bounding boxes são normalizados para escala 0-1000 no formato `[y1, x1, y2, x2]`.

---

## C

### Chain of Thought (CoT)
Técnica de prompt engineering onde o modelo é instruído a mostrar seus "pensamentos" antes de dar a resposta final. Visualizado na Terminal UI como nós de um grafo.

### Complexity Router
Módulo (`router.js`) que classifica a complexidade de uma mensagem do usuário em `BAIXA`, `ALTA` ou `SCAFFOLDING`, determinando qual pipeline de chat será usado.

### Constraint (Cropper)
Limites dentro dos quais um crop pode ser criado ou movido. Pode ser:
- **Page Constraint**: Crop limitado à área de uma página específica
- **Parent Constraint**: Em slot-mode, crop limitado à área do crop pai (questão)

### Crop / Cropping
Ato de selecionar uma região retangular em uma página do PDF. O sistema mantém crops organizados em **grupos**, onde cada grupo representa uma questão.

### CropperState
Store reativo centralizado (`cropper-state.js`) que gerencia todos os grupos de crops, undo/redo, e notifica subscribers quando o estado muda.

---

## D

### Deep Search
Funcionalidade que executa uma pesquisa aprofundada sobre uma questão. Consiste em 3 fases:
1. **Fase 1**: Consulta direta ao Pinecone (cache)
2. **Fase 2**: Se não encontrado, dispara um GitHub Action com agente de pesquisa
3. **Fase 3**: Validação dos resultados retornados

### dHash (Difference Hash)
Algoritmo de hash visual que gera uma impressão digital de uma imagem convertendo-a para grayscale, redimensionando para 64x64, e computando diferenças de luminância entre pixels adjacentes. Usado para deduplicação de PDFs.

### Dimming Mask
Overlay SVG semitransparente escuro que cobre toda a página do PDF, com "buracos" recortados para cada crop existente. Criado usando `fill-rule: evenodd` em SVG path.

### Double Buffering
Técnica de renderização do PDF onde um novo canvas é criado em memória, a página é renderizada nele, e só então o canvas antigo é substituído atomicamente. Evita flash de tela branca durante zoom.

### DPR (Device Pixel Ratio)
Razão entre pixels físicos e pixels CSS do dispositivo. Em telas retina (DPR=2), o canvas do PDF é renderizado com o dobro da resolução para nitidez.

---

## E

### Edge Computing
Modelo de computação onde o código roda em servidores próximos ao usuário final. O maia.edu utiliza Cloudflare Workers, que operam em 300+ edge locations globais.

### Embedding
Representação vetorial de um texto em um espaço de alta dimensão (768 dimensões no caso do maia.edu). Usado para busca semântica no Pinecone.

### EntityDB
Camada de abstração sobre IndexedDB que armazena entidades de memória do usuário (fatos atômicos). Possui TTL de 30 minutos com sync para Pinecone antes da expiração.

### Estrutura (Bloco)
Array de objetos que representa o conteúdo de uma questão, alternativa ou explicação. Cada bloco tem `tipo` (texto, imagem, equação, citação, etc.) e `conteudo`.

---

## F

### Fatos Atômicos
Unidades mínimas de informação extraídas das conversas do chat. Exemplos: "O usuário estuda para o ENEM", "O usuário tem dificuldade em log". Armazenados no Memory Service.

### Floating Header
Elemento de UI que flutua sobre o conteúdo quando o scroll atinge um certo ponto. Usado na Terminal UI e no Scanner UI para manter informações sempre visíveis.

---

## G

### Gap Detector
Módulo (`gap-detector.js`) que analisa conversas para detectar lacunas de conhecimento do estudante. Usa threshold de relevância de 0.85 e dispara workflows de extração.

### GREEDY BOX
Princípio de detecção do AI Scanner: a bounding box de uma questão deve incluir **tudo** que pertence a ela (enunciado, imagens, fontes, alternativas). É melhor pecar pelo excesso do que cortar conteúdo.

### Grounding Metadata
Dados retornados pelo Google Search quando usado via Gemini. Contém `groundingChunks` com URIs e títulos das fontes consultadas.

---

## H

### Hydration
Processo pós-renderização que ativa funcionalidades dinâmicas em conteúdo HTML estático:
- **MathJax**: Renderiza equações LaTeX
- **Mermaid**: Renderiza diagramas
- **Highlight.js**: Coloriza blocos de código

---

## I

### ImgBB
Serviço de hosting de imagens utilizado para armazenar recortes das questões. O upload é feito via Worker para manter a API key segura.

### IndexedDB
API de banco de dados NoSQL do browser. O maia.edu usa para armazenar conversas do chat e entidades de memória localmente.

---

## L

### Lazy Loading (PDF)
Estratégia onde apenas as páginas visíveis do PDF são renderizadas. Usa `IntersectionObserver` com margem de 400px para pré-carregar páginas próximas.

### Layout (Chat)
Estrutura de nível superior de uma resposta do chat. Tipos: `standard` (blocos livres), `question` (questão com alternativas), `scaffolding` (tutoria passo-a-passo).

---

## M

### Methodology Badge
Badge visual exibido em cada resposta do chat indicando a metodologia pedagógica utilizada (ex: "Aprendizagem Ativa", "Método Socrático", "Dual Coding").

### Mode (Chat)
Modo de operação do chat: `automatico` (router decide), `rapido` (respostas ágeis), `raciocinio` (thinking mode), `scaffolding` (tutoria).

---

## N

### NDJSON (Newline-Delimited JSON)
Formato de streaming onde cada linha é um objeto JSON independente. Usado para comunicação em tempo real entre Worker e Browser. Cada linha termina com `\n`.

### Normalização
Processo de higienização e padronização dos dados extraídos pela IA. Inclui: typing coercion, fallback de campos, injeção de imagens, clonagem segura.

---

## P

### Page Dominance
Algoritmo do PDF Viewer que determina qual página está "dominante" (mais visível) calculando a altura visível de cada página e selecionando a com maior intersecção.

### Pick Function
Utilitário que implementa null coalescing: `pick(a, b, c)` retorna o primeiro valor que não é `null`, `undefined` ou `""`. Extensivamente usado na normalização.

### Pipeline (Chat)
Sequência de passos para gerar uma resposta do chat. Três pipelines disponíveis: Rápido, Raciocínio e Scaffolding. Cada um injeta prompts e configurações diferentes.

### Pinecone
Banco de dados vetorial usado para busca semântica. O maia.edu mantém 4 indexes separados (deep-search, filter, memory, default).

### Proficiency Score
Pontuação calculada pelo Scaffolding Service que estima o nível de domínio do estudante em um tópico. Baseada em acertos/erros nas interações do scaffolding.

---

## R

### RECITATION
Código de erro do Gemini indicando que o modelo tentou reproduzir conteúdo protegido por copyright. O Worker trata isso com retry automático usando modelos alternativos.

### Render Block
Unidade atômica de renderização no chat. Tipos: `text`, `heading`, `list`, `code`, `equation`, `mermaid`, `quote`, `image`, `table`.

---

## S

### Scaffolding
Metodologia pedagógica onde o tutor guia o estudante passo-a-passo através de perguntas de verdadeiro/falso, adaptando a dificuldade baseada no desempenho.

### Slot Mode
Modo especial do cropper usado para preencher **slots de imagem** dentro de uma questão. Crops são limitados à área do crop pai (questão) e apenas um crop é permitido por vez.

### Smart Align
Comportamento do PDF Viewer onde clicar em "próxima página" primeiro alinha o topo da página atual (se desalinhado) antes de navegar.

### Slug Canônico
Identificador único gerado para uma questão via Gemini, usado para deduplicação. Formato: string normalizada que identifica univocamente uma questão independente da prova de origem.

---

## T

### Terminal UI
Componente visual que exibe o progresso de operações longas (deep search, batch processing) em formato de terminal hacker. Inclui barra de progresso virtual, ETA, chain of thought e logs em tempo real.

### Thinking Mode
Modo de geração do Gemini onde o modelo exibe seus "pensamentos intermediários" antes da resposta final. Ativado via `thinkingConfig: { includeThoughts: true }`.

### TTL (Time To Live)
Tempo de vida de dados no cache local. No maia.edu, dados do IndexedDB expiram após 30 minutos.

---

## V

### ViewerState
Objeto global que mantém o estado do PDF Viewer: documento PDF carregado, página atual, nível de zoom.

### Visual Hash
Impressão digital visual de um PDF, gerada pelo algoritmo dHash. Usada para identificar se dois PDFs são visualmente iguais sem comparar byte a byte.

---

## Z

### ZPD (Zone of Proximal Development)
Conceito pedagógico de Vygotsky implementado no Scaffolding Service. Representa a faixa entre o que o estudante sabe e o que pode aprender com ajuda.

### Z-Index Layers
Sistema organizado de camadas de sobreposição CSS:

| Layer | Z-Index | Uso |
|-------|---------|-----|
| Base | 1-10 | Conteúdo normal |
| Overlays | 100-999 | Selection boxes, dimming |
| Sidebar | 1000-9999 | Sidebar, resizer |
| Modais | 10000-99999 | Modais, dialogs |
| Alerts | 100000+ | Alertas globais |
