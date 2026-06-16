# Limitações da IA e Precisão das Informações

A plataforma **Maia.edu** utiliza modelos de Inteligência Artificial de última geração, como os modelos da família Google Gemini e Gemma, integrados a pipelines de processamento vetorial, reconhecimento óptico de caracteres (OCR) e busca semântica em tempo real. Embora essas tecnologias acelerem expressivamente a rotina de estudos e a criação de simulados, elas possuem restrições arquiteturais inerentes.

Esta documentação detalha os aspectos técnicos e práticos das limitações de cada recurso da plataforma, oferecendo transparência sobre onde a tecnologia pode falhar e como mitigar esses problemas.

## 1. Funcionamento do Chat e Alucinações de Linguagem

Os chatbots baseados em LLMs (Large Language Models), como o chat integrado na tela inicial da Maia, são construídos sobre arquiteturas de redes neurais do tipo Transformer. Em sua essência matemática, um LLM opera por meio da predição do próximo token (sílaba ou palavra) estatisticamente mais provável, com base no histórico da conversa e no contexto fornecido.

### O Fenômeno da Alucinação
Por se basearem em probabilidade estatística de associação de palavras e não em um banco de fatos indexados de forma absoluta, os modelos de IA podem gerar sentenças gramaticalmente impecáveis, mas conceitualmente falsas. Esse comportamento é denominado alucinação de dados.
* **Erros Conceituais Sutis:** A IA pode confundir regras físicas específicas (como a direção de vetores em campos eletromagnéticos) ou atribuir fórmulas erradas a problemas mecânicos complexos, mantendo um tom confiante e didático.
* **Acurácia em Ciências Exatas:** Embora os LLMs modernos usem cadeias de raciocínio passo a passo (Chain of Thought), eles ainda cometem falhas aritméticas e erros de álgebra básica ao realizar deduções matemáticas longas sem assistência de interpretadores de código externos.
* **Dados Históricos e Citações:** O modelo pode fundir passagens de autores diferentes, criar citações fictícias para fundamentar teorias literárias ou inventar datas históricas aproximadas.

### Como Estudar de Forma Segura
A recomendação pedagógica é tratar o chat da Maia como um tutor que propõe hipóteses e explica caminhos de raciocínio, e não como uma enciclopédia definitiva. Quando estiver revisando tópicos de alta relevância (como fórmulas específicas para o vestibular ou fatos históricos cruciais), sempre cruze as explicações geradas com apostilas tradicionais e as resoluções de livros recomendados.

## 2. Correção de Respostas Dissertativas
{#correcao-dissertativa}

A avaliação automática de respostas dissertativas no Banco de Questões e na área de Simulados é uma tarefa de extrema complexidade. A plataforma implementa duas abordagens para realizar essa análise:

### Abordagem A: Simetria Semântica (Embeddings)
O sistema transforma o rascunho do aluno e o gabarito oficial em vetores de alta dimensão (geralmente usando modelos de representação de texto como o Transformers.js localmente ou APIs de embeddings na nuvem). Em seguida, calcula a similaridade de cosseno entre esses dois vetores para determinar o nível de aderência.
* **Falso Negativo por Estilo:** Se a sua resposta estiver conceitualmente correta, mas escrita com vocabulário muito diferente ou em uma ordem não tradicional, a distância vetorial pode ser alta, resultando em uma nota injustamente baixa.
* **Falso Positivo por Proximidade Léxica:** Uma resposta que use termos corretos do gabarito, mas os ordene de forma a expressar um conceito totalmente errado, ainda pode obter alta similaridade matemática devido à sobreposição de palavras e proximidade vetorial.

### Abordagem B: Correção Completa via LLM (Rubrica de IA)
Neste modo, a resposta do aluno e os critérios de correção são enviados a um modelo de IA configurado para avaliar a completude técnica da resposta.
* **Desafio dos Sinônimos:** A IA pode falhar em entender sinônimos ou simplificações válidas feitas por estudantes de nível médio, penalizando respostas que não utilizaram jargões acadêmicos pesados.
* **Problema da Rigidez:** Em questões de exatas, a IA pode considerar incorreta uma linha de raciocínio alternativa que chegue ao resultado esperado se a rubrica oficial descrever apenas o método padrão.
* **Variações de Temperatura:** A inferência probabilística da IA possui uma "temperatura", o que significa que correções consecutivas da mesma resposta podem resultar em pequenos desvios nas notas atribuídas e no feedback textual.

Portanto, considere os resultados e as notas geradas como estimativas informais. A leitura atenta da Resposta Modelo fornecida no Gabarito da Questão continua sendo a ferramenta mais eficaz para julgar a qualidade do seu rascunho.

## 3. Pesquisa Assistida por IA
{#pesquisa-por-ia}

A Pesquisa com IA varre portais externos, repositórios públicos de exames e bases de dados para tentar localizar cadernos de provas, correspondências de questões e resoluções completas na web.

### Desafios de Indexação e Mapeamento
* **Desalinhamento de Gabaritos:** Muitas fontes de gabarito na internet contêm erros materiais, digitações incorretas ou misturam a ordem das respostas de cadernos diferentes (ENEM Caderno Azul vs. Caderno Amarelo). A IA pode ler essas tabelas confusas e vincular uma resolução falsa ou gabarito trocado a uma questão do banco.
* **Fragmentação do Enunciado:** Se o buscador recolher trechos de sites que cortaram partes do texto de apoio ou ocultaram as alternativas da questão original, a IA pode tentar complementar o enunciado adivinhando o restante, o que corrompe o exercício.
* **Instabilidade de Links Externos:** Os resultados de busca podem retornar links que sofreram alteração estrutural ou cuja segurança impede a coleta direta por parte de nossos agentes automatizados.

## 4. Extração de PDFs e Leitura Visual (OCR)
{#extracao-de-pdfs}

O pipeline de Upload Manual e Extração de PDFs converte as páginas do arquivo PDF da prova em imagens e utiliza algoritmos de processamento visual (OCR e Visão Computacional) para segmentar enunciados e alternativas.

### Gargalos do Reconhecimento Óptico de Caracteres (OCR)
* **Figuras e Gráficos:** A visão computacional detecta blocos de imagens, mas a extração estruturada não consegue extrair com precisão tabelas estatísticas longas, infográficos coloridos, esquemas elétricos ou diagramas biológicos complexos. Esses blocos são rotulados como imagem e dependem da criação de recortes visuais manuais pelo usuário.
* **Fórmulas e Notações Científicas:** Equações químicas complexas, representações tridimensionais de moléculas orgânicas e símbolos matemáticos avançados (como integrais, matrizes ou somatórios) raramente são convertidos para texto sem sofrer corrupção de caracteres. Eles costumam aparecer na extração final como sequências ilegíveis ou códigos desconexos.
* **Erros de Diagramação:** Provas organizadas em duas colunas (como o ENEM) ou com textos de suporte compartilhados entre múltiplas questões frequentemente causam desvios no fluxo de leitura da IA, fazendo com que trechos de enunciados diferentes sejam colados na mesma questão.

### O papel da Tela de Revisão
A extração por IA é projetada para economizar tempo de digitação, e não para funcionar de forma 100% autônoma. É indispensável revisar cada questão extraída na tela de **Revisão de Questões** antes de publicá-la ou salvá-la definitivamente. Use a ferramenta de recorte para capturar as imagens ausentes e corrigir os caracteres especiais corrompidos durante o processamento inicial.
