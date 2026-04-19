/**
 * Catálogo Central de Metodologias Pedagógicas
 * 13 abordagens catalogadas na taxonomia Bloom e métodos acadêmicos
 *
 * Cada metodologia contém:
 * - id: Código interno de referência
 * - label: Nome exibido na UI
 * - description: Descrição curta para menus
 * - icon: Emoji representativo
 * - category: Agrupador para o menu cascading
 * - systemPromptInjection: Texto injetado no system prompt da IA geradora
 * - requiresMermaid: Se a metodologia exige diagramas Mermaid
 */

export function getMetodologiaCategories() {
  return [
    {
      id: "cognitivas",
      label: "Cognitivas",
      icon: "🧠",
    },
    {
      id: "pratica",
      label: "Prática",
      icon: "📝",
    },
    {
      id: "criativas",
      label: "Criativas",
      icon: "🎨",
    },
  ];
}

export function getMetodologiasData() {
  return [
    // === COGNITIVAS ===
    {
      id: "socratico",
      label: "Socrático",
      description: "Aprendizado por perguntas reflexivas",
      icon: "🏛️",
      category: "cognitivas",
      requiresMermaid: false,
      systemPromptInjection: `[METODOLOGIA ATIVA: SOCRÁTICO (Maiêutica)]
DIRETRIZ PEDAGÓGICA OBRIGATÓRIA — Aplique esta lente em 100% da resposta:
- Nunca entregue gabaritos ou respostas prontas diretamente.
- Use perguntas reflexivas e charadas como 80% do conteúdo.
- Os 20% restantes devem ser dicas de amparo para guiar o raciocínio.
- Destrua certezas absolutas do estudante, guiando-o até que ele monte os "Legos" do raciocínio solitariamente.
- Use blocos "destaque" para as perguntas reflexivas chave.
- Termine cada seção com uma pergunta provocativa que force o aluno a pensar.`,
    },
    {
      id: "feynman",
      label: "Feynman",
      description: "Explicar como se fosse para uma criança",
      icon: "🔬",
      category: "cognitivas",
      requiresMermaid: false,
      systemPromptInjection: `[METODOLOGIA ATIVA: TÉCNICA DE FEYNMAN]
DIRETRIZ PEDAGÓGICA OBRIGATÓRIA — Aplique esta lente em 100% da resposta:
- Reescreva TODOS os termos técnicos usando analogias do cotidiano.
- Use metáforas que uma criança de 12 anos entenderia sem pestanejar.
- Desça da torre de marfim acadêmica: zero jargões sem explicação.
- Exemplo de didatismo: Tratar buracos negros como "lençóis estendidos com uma bola de boliche no centro".
- Se usar uma fórmula, explique cada símbolo como se fosse a primeira vez que o aluno vê.
- Use blocos "destaque" para as analogias mais poderosas.`,
    },
    {
      id: "dual-coding",
      label: "Dual Coding",
      description: "Texto + diagramas visuais Mermaid",
      icon: "🎨",
      category: "cognitivas",
      requiresMermaid: true,
      systemPromptInjection: `[METODOLOGIA ATIVA: DUAL CODING (Paivio, 1971)]
DIRETRIZ PEDAGÓGICA OBRIGATÓRIA — Aplique esta lente em 100% da resposta:
- Você DEVE associar cada conceito textual com um estímulo visual.
- Para TODAS as interconexões teóricas, GERE blocos de código com linguagem "mermaid".
- Use diagramas Mermaid (graph TD, flowchart, mindmap, sequenceDiagram) para representar relações entre conceitos.
- O bloco deve ter tipo "codigo", props.language = "mermaid", e o conteúdo é o código Mermaid raw.
- Alterne entre texto explicativo e diagramas visuais a cada 2-3 parágrafos.
- A proporção ideal é 40% texto, 40% diagramas, 20% destaques.
- Exemplo de bloco Mermaid: { "tipo": "codigo", "conteudo": "graph TD\\n  A[Conceito] --> B[Sub-conceito]", "props": { "language": "mermaid" } }`,
    },
    {
      id: "elaboracao",
      label: "Elaboração",
      description: "Ancoragem em conhecimento prévio",
      icon: "🔗",
      category: "cognitivas",
      requiresMermaid: false,
      systemPromptInjection: `[METODOLOGIA ATIVA: ELABORAÇÃO INTEGRADA]
DIRETRIZ PEDAGÓGICA OBRIGATÓRIA — Aplique esta lente em 100% da resposta:
- NÃO avance para o próximo conceito sem ancorar o atual em algo que o estudante já conheça.
- Force amarrações com regras, conceitos ou experiências prévias.
- Use perguntas como "Lembra quando estudamos X? Isso se conecta com Y porque..."
- Cada novo tópico deve começar com uma ponte ao anterior.
- Use blocos "destaque" para as conexões inter-conceituais mais importantes.
- Na conclusão, faça um mapa de conexões entre TODOS os conceitos abordados.`,
    },
    {
      id: "metacognicao",
      label: "Metacognição",
      description: "Ensinar a pensar sobre o pensamento",
      icon: "🪞",
      category: "cognitivas",
      requiresMermaid: false,
      systemPromptInjection: `[METODOLOGIA ATIVA: CONSCIÊNCIA METACOGNITIVA]
DIRETRIZ PEDAGÓGICA OBRIGATÓRIA — Aplique esta lente em 100% da resposta:
- Ensine o aluno a "pensar sobre o pensamento" (transição de tutela).
- Após cada explicação, pergunte: "Qual parte desta explicação lhe trouxe um travamento cognitivo?"
- Inclua blocos de auto-avaliação: "De 1 a 5, quanto você sente que domina isso agora?"
- Explique POR QUE certos conceitos são difíceis (metacognição sobre a dificuldade).
- Na conclusão, force uma reflexão: "O que você aprendeu sobre COMO você aprende este tipo de conteúdo?"
- Use blocos "destaque" para os momentos de reflexão metacognitiva.`,
    },

    // === PRÁTICA ===
    {
      id: "pratica-distribuida",
      label: "Prática Espaçada",
      description: "Revisão intercalada contra esquecimento",
      icon: "📅",
      category: "pratica",
      requiresMermaid: false,
      systemPromptInjection: `[METODOLOGIA ATIVA: PRÁTICA ESPAÇADA (Ebbinghaus)]
DIRETRIZ PEDAGÓGICA OBRIGATÓRIA — Aplique esta lente em 100% da resposta:
- Traga de volta frações de conceitos de mensagens anteriores no meio da nova resposta como "teste surpresa".
- Intercale revisão de conteúdo antigo com conteúdo novo.
- Use blocos de pergunta rápida para testar retenção de conceitos já ensinados.
- Marque explicitamente os momentos de revisão com "🔄 REVISÃO ESPAÇADA".
- O objetivo é furar a Curva do Esquecimento forçando recall ativo.`,
    },
    {
      id: "intercalacao",
      label: "Intercalação",
      description: "Misturar tópicos para raciocínio heurístico",
      icon: "🔀",
      category: "pratica",
      requiresMermaid: false,
      systemPromptInjection: `[METODOLOGIA ATIVA: MÉTODO DE INTERCALAÇÃO]
DIRETRIZ PEDAGÓGICA OBRIGATÓRIA — Aplique esta lente em 100% da resposta:
- Embaralhe as lógicas para criar raciocínio heurístico puro.
- Alterne exercícios de diferentes sub-tópicos na mesma resposta.
- Exemplo: Misture Física Atômica com Geometria pura na mesma folha-teste para forçar mudança de chave cognitiva.
- Cada bloco de conteúdo deve exigir uma "troca de marcha mental".
- Use blocos "destaque" para sinalizar as transições de domínio.`,
    },
    {
      id: "teste-memoria",
      label: "Active Recall",
      description: "Teste direto de retenção de memória",
      icon: "🧪",
      category: "pratica",
      requiresMermaid: false,
      systemPromptInjection: `[METODOLOGIA ATIVA: ACTIVE RECALL (Teste de Retenção)]
DIRETRIZ PEDAGÓGICA OBRIGATÓRIA — Aplique esta lente em 100% da resposta:
- Obrigar o aluno a cuspir informações que estudou via estímulo frontal direto.
- Esconda nomenclaturas principais preenchendo com "___", exigindo que o aluno memorize a regra e complete.
- Use blocos com lacunas para preenchimento (estilo cloze test).
- Exemplo: "A lei de _____ (cientista) afirma que F = m × _____"
- Após cada bloco de lacunas, forneça a resposta em um bloco "destaque" colapsável.`,
    },

    // === CRIATIVAS ===
    {
      id: "analogias",
      label: "Analogias Profundas",
      description: "Equiparação de sistemas completos",
      icon: "🔄",
      category: "criativas",
      requiresMermaid: false,
      systemPromptInjection: `[METODOLOGIA ATIVA: ANALOGIAS PROFUNDAS EXTENSAS]
DIRETRIZ PEDAGÓGICA OBRIGATÓRIA — Aplique esta lente em 100% da resposta:
- Deduza o tema inteiro usando um sistema analógico completo do mundo real.
- Não use analogias pontuais — construa uma analogia-mestre que percorra TODA a explicação.
- Exemplo: Deduzir toda a política Econômica Europeia usando o ecossistema de um Aquário de Peixes fechado.
- Cada conceito deve ter seu equivalente no sistema analógico.
- Use blocos "destaque" para mapear: "No nosso aquário, X equivale a Y no tema real".`,
    },
    {
      id: "mapas-mentais",
      label: "Mapas Mentais",
      description: "Topologia radial visual com Mermaid",
      icon: "🗺️",
      category: "criativas",
      requiresMermaid: true,
      systemPromptInjection: `[METODOLOGIA ATIVA: TOPOLOGIA RADIAL (Tony Buzan)]
DIRETRIZ PEDAGÓGICA OBRIGATÓRIA — Aplique esta lente em 100% da resposta:
- Reduza longos blocos de parágrafos em ramificações visuais.
- Gere OBRIGATORIAMENTE diagramas Mermaid do tipo mindmap ou graph para cada conceito.
- O bloco deve ter tipo "codigo", props.language = "mermaid", e o conteúdo é o código Mermaid raw.
- Priorize tópicos-filhos em hierarquia radial.
- Ignore prosa longa — cada conceito deve ser uma frase curta numa ramificação visual.
- Exemplo: { "tipo": "codigo", "conteudo": "mindmap\\n  root((Tema Central))\\n    Subtema A\\n      Detalhe 1\\n    Subtema B", "props": { "language": "mermaid" } }`,
    },
    {
      id: "gamificacao",
      label: "Gamificação",
      description: "Engajamento lúdico com progressão",
      icon: "🎮",
      category: "criativas",
      requiresMermaid: false,
      systemPromptInjection: `[METODOLOGIA ATIVA: ENGAJAMENTO LÚDICO (Gamificação)]
DIRETRIZ PEDAGÓGICA OBRIGATÓRIA — Aplique esta lente em 100% da resposta:
- Foco na retenção dopaminérgica do estudante.
- Distribua elogios apoteóticos a cada acerto ("🏆 Level UP!", "⚡ COMBO x3!").
- Destrave jargões de RPG e narre a resolução como uma grande arena épica.
- Use emojis abundantemente para criar sensação de progressão.
- Crie "fases" e "chefões" para os conceitos mais difíceis.
- No final, dê um "XP Report" resumindo o que foi conquistado.`,
    },
    {
      id: "pbl",
      label: "PBL",
      description: "Aprendizagem via problemas reais",
      icon: "🏢",
      category: "criativas",
      requiresMermaid: false,
      systemPromptInjection: `[METODOLOGIA ATIVA: APRENDIZAGEM VIA PROBLEMAS (PBL)]
DIRETRIZ PEDAGÓGICA OBRIGATÓRIA — Aplique esta lente em 100% da resposta:
- Resolução guiada por escopo Real-World. Abomina a teoria isolada.
- Traga um cenário corporativo/real do Brasil contemporâneo.
- Coloque o aluno como protagonista (diretor, cientista, engenheiro) e o faça deduzir a regra a partir do problema.
- NÃO apresente teoria primeiro — apresente o PROBLEMA e faça a teoria emergir da solução.
- Use blocos "destaque" para os momentos "Eureka" onde a teoria emerge.`,
    },
    {
      id: "storytelling",
      label: "Storytelling",
      description: "Trilha narrativa em primeira pessoa",
      icon: "📖",
      category: "criativas",
      requiresMermaid: false,
      systemPromptInjection: `[METODOLOGIA ATIVA: TRILHA NARRATIVA (Joseph Campbell)]
DIRETRIZ PEDAGÓGICA OBRIGATÓRIA — Aplique esta lente em 100% da resposta:
- Construya toda a explanação como uma narrativa em primeira pessoa.
- Exemplo: "Você é um glóbulo vermelho percorrendo as artérias; vá descrevendo as moléculas que você cumprimenta."
- Use arco narrativo: Chamado à Aventura → Provação → Retorno com Conhecimento.
- O estudante é o herói da jornada. Os conceitos são aliados/inimigos encontrados no caminho.
- Use blocos "citacao" para os diálogos narrativos.
- Ideal para matérias maçantes de cronologia ou decoreba.`,
    },
  ];
}

export function getMetodologiaIds() {
  return getMetodologiasData().map((m) => m.id);
}

/**
 * Busca uma metodologia pelo ID
 * @param {string} id
 * @returns {object|null}
 */
export function getMetodologia(id) {
  return getMetodologiasData().find((m) => m.id === id) || null;
}

/**
 * Retorna metodologias agrupadas por categoria
 * @returns {Array<{category: object, items: Array}>}
 */
export function getMetodologiasByCategory() {
  const categories = getMetodologiaCategories();
  const data = getMetodologiasData();
  
  return categories.map((cat) => ({
    category: cat,
    items: data.filter((m) => m.category === cat.id),
  }));
}
