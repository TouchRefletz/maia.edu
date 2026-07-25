/**
 * Gerador de Sugestões Dinâmicas usando Templates
 * Sistema leve e rápido, 100% local
 *
 * SISTEMA DE CONCORDÂNCIA:
 * Cada termo vem com seu artigo próprio para garantir concordância verbal correta.
 * Formato: { termo: "string", artigo: "o/a/os/as" }
 */

// ============================================================================
// MATÉRIAS COM CONCORDÂNCIA
// ============================================================================
const MATERIAS = [
  { termo: 'matemática', artigo: 'a' },
  { termo: 'física', artigo: 'a' },
  { termo: 'química', artigo: 'a' },
  { termo: 'biologia', artigo: 'a' },
  { termo: 'português', artigo: 'o' },
  { termo: 'literatura', artigo: 'a' },
  { termo: 'redação', artigo: 'a' },
  { termo: 'história', artigo: 'a' },
  { termo: 'geografia', artigo: 'a' },
  { termo: 'filosofia', artigo: 'a' },
  { termo: 'sociologia', artigo: 'a' },
  { termo: 'inglês', artigo: 'o' },
  { termo: 'espanhol', artigo: 'o' },
  { termo: 'artes', artigo: 'as' },
  { termo: 'educação física', artigo: 'a' },
];

// ============================================================================
// TÓPICOS POR MATÉRIA COM CONCORDÂNCIA
// ============================================================================
const TOPICOS = {
  matematica: [
    { termo: 'funções de 2º grau', artigo: 'as' },
    { termo: 'logaritmos', artigo: 'os' },
    { termo: 'geometria espacial', artigo: 'a' },
    { termo: 'probabilidade', artigo: 'a' },
    { termo: 'estatística', artigo: 'a' },
    { termo: 'trigonometria', artigo: 'a' },
    { termo: 'análise combinatória', artigo: 'a' },
    { termo: 'progressões aritméticas', artigo: 'as' },
    { termo: 'progressões geométricas', artigo: 'as' },
    { termo: 'matrizes', artigo: 'as' },
    { termo: 'determinantes', artigo: 'os' },
    { termo: 'sistemas lineares', artigo: 'os' },
    { termo: 'números complexos', artigo: 'os' },
    { termo: 'funções exponenciais', artigo: 'as' },
    { termo: 'geometria analítica', artigo: 'a' },
    { termo: 'cônicas', artigo: 'as' },
    { termo: 'polinômios', artigo: 'os' },
    { termo: 'equações do 1º grau', artigo: 'as' },
    { termo: 'inequações', artigo: 'as' },
    { termo: 'teorema de Pitágoras', artigo: 'o' },
    { termo: 'razão e proporção', artigo: 'a' },
    { termo: 'regra de três', artigo: 'a' },
    { termo: 'porcentagem', artigo: 'a' },
    { termo: 'juros simples e compostos', artigo: 'os' },
  ],
  fisica: [
    { termo: 'cinemática', artigo: 'a' },
    { termo: 'dinâmica', artigo: 'a' },
    { termo: 'termodinâmica', artigo: 'a' },
    { termo: 'óptica', artigo: 'a' },
    { termo: 'eletricidade', artigo: 'a' },
    { termo: 'ondas', artigo: 'as' },
    { termo: 'magnetismo', artigo: 'o' },
    { termo: 'gravitação universal', artigo: 'a' },
    { termo: 'mecânica dos fluidos', artigo: 'a' },
    { termo: 'calorimetria', artigo: 'a' },
    { termo: 'eletromagnetismo', artigo: 'o' },
    { termo: 'física moderna', artigo: 'a' },
    { termo: 'conservação de energia', artigo: 'a' },
    { termo: 'quantidade de movimento', artigo: 'a' },
    { termo: 'impulso', artigo: 'o' },
    { termo: 'movimento circular', artigo: 'o' },
    { termo: 'leis de Newton', artigo: 'as' },
    { termo: 'trabalho e potência', artigo: 'o' },
    { termo: 'acústica', artigo: 'a' },
    { termo: 'efeito Doppler', artigo: 'o' },
    { termo: 'refração da luz', artigo: 'a' },
    { termo: 'lentes e espelhos', artigo: 'as' },
    { termo: 'circuitos elétricos', artigo: 'os' },
    { termo: 'lei de Ohm', artigo: 'a' },
  ],
  quimica: [
    { termo: 'estequiometria', artigo: 'a' },
    { termo: 'ligações químicas', artigo: 'as' },
    { termo: 'reações orgânicas', artigo: 'as' },
    { termo: 'pH e soluções', artigo: 'o' },
    { termo: 'termoquímica', artigo: 'a' },
    { termo: 'eletroquímica', artigo: 'a' },
    { termo: 'química inorgânica', artigo: 'a' },
    { termo: 'química orgânica', artigo: 'a' },
    { termo: 'cinética química', artigo: 'a' },
    { termo: 'equilíbrio químico', artigo: 'o' },
    { termo: 'atomística', artigo: 'a' },
    { termo: 'tabela periódica', artigo: 'a' },
    { termo: 'modelos atômicos', artigo: 'os' },
    { termo: 'funções inorgânicas', artigo: 'as' },
    { termo: 'funções orgânicas', artigo: 'as' },
    { termo: 'isomeria', artigo: 'a' },
    { termo: 'polímeros', artigo: 'os' },
    { termo: 'separação de misturas', artigo: 'a' },
    { termo: 'diluição de soluções', artigo: 'a' },
    { termo: 'cálculo de fórmulas', artigo: 'o' },
    { termo: 'radioatividade', artigo: 'a' },
    { termo: 'oxidação e redução', artigo: 'a' },
    { termo: 'pilhas e baterias', artigo: 'as' },
    { termo: 'propriedades coligativas', artigo: 'as' },
  ],
  biologia: [
    { termo: 'genética', artigo: 'a' },
    { termo: 'ecologia', artigo: 'a' },
    { termo: 'citologia', artigo: 'a' },
    { termo: 'evolução', artigo: 'a' },
    { termo: 'fisiologia humana', artigo: 'a' },
    { termo: 'botânica', artigo: 'a' },
    { termo: 'zoologia', artigo: 'a' },
    { termo: 'microbiologia', artigo: 'a' },
    { termo: 'bioquímica', artigo: 'a' },
    { termo: 'anatomia', artigo: 'a' },
    { termo: 'sistema nervoso', artigo: 'o' },
    { termo: 'sistema circulatório', artigo: 'o' },
    { termo: 'sistema digestório', artigo: 'o' },
    { termo: 'sistema respiratório', artigo: 'o' },
    { termo: 'sistema imunológico', artigo: 'o' },
    { termo: 'divisão celular', artigo: 'a' },
    { termo: 'leis de Mendel', artigo: 'as' },
    { termo: 'DNA e RNA', artigo: 'o' },
    { termo: 'síntese proteica', artigo: 'a' },
    { termo: 'cadeia alimentar', artigo: 'a' },
    { termo: 'ciclos biogeoquímicos', artigo: 'os' },
    { termo: 'biomas brasileiros', artigo: 'os' },
    { termo: 'reprodução humana', artigo: 'a' },
    { termo: 'biotecnologia', artigo: 'a' },
  ],
  portugues: [
    { termo: 'interpretação de texto', artigo: 'a' },
    { termo: 'figuras de linguagem', artigo: 'as' },
    { termo: 'concordância verbal', artigo: 'a' },
    { termo: 'regência verbal', artigo: 'a' },
    { termo: 'orações subordinadas', artigo: 'as' },
    { termo: 'orações coordenadas', artigo: 'as' },
    { termo: 'análise sintática', artigo: 'a' },
    { termo: 'morfologia', artigo: 'a' },
    { termo: 'semântica', artigo: 'a' },
    { termo: 'pontuação', artigo: 'a' },
    { termo: 'acentuação gráfica', artigo: 'a' },
    { termo: 'crase', artigo: 'a' },
    { termo: 'colocação pronominal', artigo: 'a' },
    { termo: 'vozes verbais', artigo: 'as' },
    { termo: 'tipos de sujeito', artigo: 'os' },
    { termo: 'predicado', artigo: 'o' },
    { termo: 'coesão e coerência', artigo: 'a' },
    { termo: 'variação linguística', artigo: 'a' },
    { termo: 'gêneros textuais', artigo: 'os' },
    { termo: 'intertextualidade', artigo: 'a' },
    { termo: 'novo acordo ortográfico', artigo: 'o' },
    { termo: 'funções da linguagem', artigo: 'as' },
    { termo: 'denotação e conotação', artigo: 'a' },
    { termo: 'verbos irregulares', artigo: 'os' },
  ],
  literatura: [
    { termo: 'romantismo', artigo: 'o' },
    { termo: 'realismo', artigo: 'o' },
    { termo: 'modernismo', artigo: 'o' },
    { termo: 'barroco', artigo: 'o' },
    { termo: 'arcadismo', artigo: 'o' },
    { termo: 'parnasianismo', artigo: 'o' },
    { termo: 'simbolismo', artigo: 'o' },
    { termo: 'naturalismo', artigo: 'o' },
    { termo: 'quinhentismo', artigo: 'o' },
    { termo: 'semana de 22', artigo: 'a' },
    { termo: 'Machado de Assis', artigo: 'o' },
    { termo: 'Guimarães Rosa', artigo: 'o' },
    { termo: 'Clarice Lispector', artigo: 'a' },
    { termo: 'Fernando Pessoa', artigo: 'o' },
    { termo: 'Drummond', artigo: 'o' },
    { termo: 'poesia concreta', artigo: 'a' },
    { termo: 'tropicália', artigo: 'a' },
    { termo: 'literatura contemporânea', artigo: 'a' },
    { termo: 'literatura africana', artigo: 'a' },
    { termo: 'literatura marginal', artigo: 'a' },
  ],
  historia: [
    { termo: 'Era Vargas', artigo: 'a' },
    { termo: 'Revolução Industrial', artigo: 'a' },
    { termo: 'Guerra Fria', artigo: 'a' },
    { termo: 'Brasil Colônia', artigo: 'o' },
    { termo: 'Brasil Império', artigo: 'o' },
    { termo: 'Brasil República', artigo: 'o' },
    { termo: 'Idade Média', artigo: 'a' },
    { termo: 'Renascimento', artigo: 'o' },
    { termo: 'Iluminismo', artigo: 'o' },
    { termo: 'Revolução Francesa', artigo: 'a' },
    { termo: 'Primeira Guerra Mundial', artigo: 'a' },
    { termo: 'Segunda Guerra Mundial', artigo: 'a' },
    { termo: 'Nazismo', artigo: 'o' },
    { termo: 'Ditadura Militar', artigo: 'a' },
    { termo: 'Redemocratização', artigo: 'a' },
    { termo: 'Independência do Brasil', artigo: 'a' },
    { termo: 'Abolição da escravatura', artigo: 'a' },
    { termo: 'Inconfidência Mineira', artigo: 'a' },
    { termo: 'Revolução Russa', artigo: 'a' },
    { termo: 'Imperialismo', artigo: 'o' },
    { termo: 'Colonização da América', artigo: 'a' },
    { termo: 'Feudalismo', artigo: 'o' },
    { termo: 'absolutismo', artigo: 'o' },
    { termo: 'mercantilismo', artigo: 'o' },
    { termo: 'Guerra do Paraguai', artigo: 'a' },
    { termo: 'Revolução de 1930', artigo: 'a' },
    { termo: 'Estado Novo', artigo: 'o' },
    { termo: 'governos populistas', artigo: 'os' },
  ],
  geografia: [
    { termo: 'clima e vegetação', artigo: 'o' },
    { termo: 'urbanização', artigo: 'a' },
    { termo: 'geopolítica', artigo: 'a' },
    { termo: 'meio ambiente', artigo: 'o' },
    { termo: 'globalização', artigo: 'a' },
    { termo: 'industrialização', artigo: 'a' },
    { termo: 'migrações', artigo: 'as' },
    { termo: 'recursos hídricos', artigo: 'os' },
    { termo: 'energia', artigo: 'a' },
    { termo: 'agricultura', artigo: 'a' },
    { termo: 'relevo brasileiro', artigo: 'o' },
    { termo: 'biomas', artigo: 'os' },
    { termo: 'mudanças climáticas', artigo: 'as' },
    { termo: 'poluição', artigo: 'a' },
    { termo: 'sustentabilidade', artigo: 'a' },
    { termo: 'cartografia', artigo: 'a' },
    { termo: 'formação do território brasileiro', artigo: 'a' },
    { termo: 'conflitos mundiais', artigo: 'os' },
    { termo: 'blocos econômicos', artigo: 'os' },
    { termo: 'população brasileira', artigo: 'a' },
    { termo: 'desigualdade regional', artigo: 'a' },
    { termo: 'matriz energética', artigo: 'a' },
    { termo: 'agronegócio', artigo: 'o' },
    { termo: 'reforma agrária', artigo: 'a' },
  ],
  filosofia: [
    { termo: 'ética', artigo: 'a' },
    { termo: 'moral', artigo: 'a' },
    { termo: 'política', artigo: 'a' },
    { termo: 'conhecimento', artigo: 'o' },
    { termo: 'existencialismo', artigo: 'o' },
    { termo: 'racionalismo', artigo: 'o' },
    { termo: 'empirismo', artigo: 'o' },
    { termo: 'idealismo', artigo: 'o' },
    { termo: 'filosofia antiga', artigo: 'a' },
    { termo: 'filosofia moderna', artigo: 'a' },
    { termo: 'Sócrates', artigo: 'o' },
    { termo: 'Platão', artigo: 'o' },
    { termo: 'Aristóteles', artigo: 'o' },
    { termo: 'Descartes', artigo: 'o' },
    { termo: 'Kant', artigo: 'o' },
    { termo: 'Nietzsche', artigo: 'o' },
    { termo: 'Marx', artigo: 'o' },
    { termo: 'contrato social', artigo: 'o' },
    { termo: 'mito da caverna', artigo: 'o' },
    { termo: 'lógica', artigo: 'a' },
    { termo: 'metafísica', artigo: 'a' },
    { termo: 'estética', artigo: 'a' },
    { termo: 'filosofia da ciência', artigo: 'a' },
    { termo: 'teoria do conhecimento', artigo: 'a' },
  ],
  sociologia: [
    { termo: 'desigualdade social', artigo: 'a' },
    { termo: 'movimentos sociais', artigo: 'os' },
    { termo: 'trabalho', artigo: 'o' },
    { termo: 'cultura', artigo: 'a' },
    { termo: 'identidade', artigo: 'a' },
    { termo: 'classes sociais', artigo: 'as' },
    { termo: 'capitalismo', artigo: 'o' },
    { termo: 'socialismo', artigo: 'o' },
    { termo: 'ideologia', artigo: 'a' },
    { termo: 'poder', artigo: 'o' },
    { termo: 'Durkheim', artigo: 'o' },
    { termo: 'Weber', artigo: 'o' },
    { termo: 'Marx', artigo: 'o' },
    { termo: 'racismo estrutural', artigo: 'o' },
    { termo: 'gênero e sociedade', artigo: 'o' },
    { termo: 'cidadania', artigo: 'a' },
    { termo: 'estado e governo', artigo: 'o' },
    { termo: 'democracia', artigo: 'a' },
    { termo: 'mídia e sociedade', artigo: 'a' },
    { termo: 'violência urbana', artigo: 'a' },
    { termo: 'juventude', artigo: 'a' },
    { termo: 'estratificação social', artigo: 'a' },
    { termo: 'mobilidade social', artigo: 'a' },
    { termo: 'indústria cultural', artigo: 'a' },
  ],
};

// ============================================================================
// TEMAS DE REDAÇÃO COM CONCORDÂNCIA
// ============================================================================
const TEMAS_REDACAO = [
  { termo: 'saúde mental dos jovens', artigo: 'a' },
  { termo: 'impactos da tecnologia na educação', artigo: 'os' },
  { termo: 'desigualdade social no Brasil', artigo: 'a' },
  { termo: 'preservação ambiental', artigo: 'a' },
  { termo: 'cultura digital e relações sociais', artigo: 'a' },
  { termo: 'violência contra a mulher', artigo: 'a' },
  { termo: 'crise hídrica', artigo: 'a' },
  { termo: 'fake news e desinformação', artigo: 'as' },
  { termo: 'racismo no Brasil', artigo: 'o' },
  { termo: 'mobilidade urbana', artigo: 'a' },
  { termo: 'inclusão de pessoas com deficiência', artigo: 'a' },
  { termo: 'evasão escolar', artigo: 'a' },
  { termo: 'acessibilidade', artigo: 'a' },
  { termo: 'consumismo', artigo: 'o' },
  { termo: 'envelhecimento da população', artigo: 'o' },
  { termo: 'preconceito linguístico', artigo: 'o' },
  { termo: 'intolerância religiosa', artigo: 'a' },
  { termo: 'direitos LGBTQIA+', artigo: 'os' },
  { termo: 'trabalho infantil', artigo: 'o' },
  { termo: 'superexposição nas redes sociais', artigo: 'a' },
  { termo: 'cyberbullying', artigo: 'o' },
  { termo: 'polarização política', artigo: 'a' },
  { termo: 'sustentabilidade', artigo: 'a' },
  { termo: 'inteligência artificial na sociedade', artigo: 'a' },
  { termo: 'crise climática', artigo: 'a' },
  { termo: 'desmatamento na Amazônia', artigo: 'o' },
  { termo: 'sistema prisional brasileiro', artigo: 'o' },
  { termo: 'valorização da cultura afro-brasileira', artigo: 'a' },
  { termo: 'educação financeira', artigo: 'a' },
  { termo: 'doação de órgãos', artigo: 'a' },
];

// ============================================================================
// TEMPLATES DE SUGESTÕES
// Placeholders: {materia}, {materia_art}, {topico}, {topico_art}, {tema}, {tema_art}
// _art = com artigo definido
// ============================================================================
const SUGGESTION_TEMPLATES = [
  // Questões e exercícios
  'Me ajude a resolver uma questão de {materia} do ENEM',
  'Explique passo a passo essa questão de {materia}',
  'Preciso entender como resolver exercícios de {materia}',
  'Quero treinar questões de {materia} do vestibular',
  'Me mostre questões comentadas de {materia}',
  'Como resolver problemas de {topico}?',
  'Me ajude com exercícios sobre {topico_art}',
  'Quero praticar {topico} para o ENEM',

  // Conceitos
  'Quero aprender sobre {topico_art}',
  'Me explique o conceito de {topico}',
  'Preciso entender {topico} para a prova',
  'O que é {topico} e como funciona?',
  'Faça uma explicação simples sobre {topico_art}',
  'Me ensine {topico} do zero',
  'Quais são os principais conceitos de {topico}?',
  'Explique {topico_art} de forma didática',

  // Redação
  'Me ajude a estruturar uma redação sobre {tema_art}',
  'Como fazer uma boa introdução de redação?',
  'Dicas para argumentação na redação do ENEM',
  'Quero treinar redação sobre {tema_art}',
  'Me dê um repertório para redação sobre {tema}',
  'Como desenvolver uma tese sobre {tema_art}?',
  'Corrija minha redação sobre {tema}',
  'Me ajude com a conclusão de uma redação sobre {tema_art}',
  'Quais conectivos usar na redação?',
  'Como não zerar na redação do ENEM?',

  // Revisão
  'Preciso revisar {materia} para o vestibular',
  'Faça um resumo sobre {topico_art}',
  'Quais os pontos mais importantes de {materia}?',
  'Me faça uma revisão rápida de {materia}',
  'Resumo completo sobre {topico}',
  'O que mais cai de {materia} no ENEM?',
  'Revisão de última hora de {materia}',
  'Mapa mental sobre {topico_art}',

  // Dúvidas gerais
  'Tenho dúvida sobre {topico_art}',
  'Não entendi {topico}, pode explicar?',
  'Avalie meu conhecimento em {materia}',
  'Qual a diferença entre {topico} e outros conceitos?',
  'Por que {topico_art} é importante?',
  'Quando devo usar {topico}?',

  // Estratégias de estudo
  'Como estudar {materia} de forma eficiente?',
  'Qual a melhor forma de aprender {topico}?',
  'Cronograma de estudos para {materia}',
  'Dicas de memorização para {materia}',
  'Técnicas de estudo para {topico}',
  'Como não esquecer {topico_art}?',

  // Atualidades
  'Quais são as atualidades sobre {tema}?',
  'Notícias recentes sobre {tema_art}',
  'Como {tema_art} pode cair no ENEM?',

  // Comparações e relações
  'Qual a relação entre {topico} e outros temas de {materia}?',
  'Compare diferentes abordagens de {topico}',
  'Como {topico_art} se conecta com a atualidade?',

  // Fórmulas e macetes
  'Quais são as fórmulas de {topico}?',
  'Macetes para decorar {topico}',
  'Atalhos para resolver questões de {topico}',

  // Análise de provas
  'Como {materia} costuma cair no ENEM?',
  'Análise de questões anteriores de {topico}',
  'Padrões de questões de {materia} no vestibular',
];

// ============================================================================
// TEMPLATES DE PLACEHOLDERS (textos provocadores para o input)
// ============================================================================
const PLACEHOLDER_TEMPLATES = [
  // Provocações sobre dúvidas
  'Aquela dúvida que você tinha sobre {topico_art}...',
  'Sabe aquele conceito de {topico} que nunca entendeu?',
  'Lembra daquela questão difícil de {materia}?',
  'E aquela matéria chata de {materia}?',
  'Aquele assunto que você sempre pula: {topico}...',

  // Inspiração para estudar
  'E se você dominasse {topico} hoje?',
  'Imagina entender {topico_art} de uma vez por todas...',
  'E aquele assunto de {materia} que você adia estudar?',
  'Que tal finalmente aprender {topico}?',
  'Hoje é dia de vencer {materia}...',
  'Bora dominar {topico_art}?',

  // Desafios provocadores
  'Será que você manja mesmo de {materia}?',
  'Tem coragem de resolver uma questão de {topico}?',
  'Bora testar seus conhecimentos em {materia}?',
  'Consegue explicar {topico} pra alguém?',
  'Aceita o desafio de estudar {materia}?',
  'Topa aprender {topico_art} agora?',

  // Reflexões sobre estudo
  'O que te impede de entender {topico_art}?',
  'Qual parte de {materia} ainda te confunde?',
  'Onde você trava quando estuda {topico}?',
  'Por que {topico_art} parece tão difícil?',
  'O que falta para você gostar de {materia}?',

  // Convites suaves
  'Algo em {materia} que você quer dominar...',
  'Uma dúvida sobre {topico} talvez...',
  'Aquele conteúdo de {materia} que precisa revisar...',
  'Sua próxima conquista: {topico}...',
  'O próximo passo: estudar {materia}...',

  // Sobre redação
  'Aquela redação sobre {tema_art}...',
  'Precisa de argumentos sobre {tema}?',
  'Bora treinar redação sobre {tema_art}?',
  'Já pensou em escrever sobre {tema}?',

  // Genéricos inspiradores
  'O que você quer aprender agora?',
  'Qual conhecimento está faltando?',
  'O próximo passo nos seus estudos...',
  'Sua dúvida de hoje pode ser...',
  'Me conta, o que te travou hoje?',
  'Pergunte qualquer coisa...',
  'No que posso te ajudar?',
  'Qual sua maior dificuldade?',
  'Vamos estudar juntos?',
  'Tá preparado pro ENEM?',
];

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Capitaliza a primeira letra (respeitando acentos)
 */
function capitalize(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Obtém um item aleatório de um array
 */
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Obtém uma matéria aleatória
 */
function getRandomMateria() {
  return randomItem(MATERIAS);
}

/**
 * Obtém um tópico aleatório de qualquer matéria
 */
function getRandomTopico() {
  const materiaKeys = Object.keys(TOPICOS);
  const materiaKey = randomItem(materiaKeys);
  return randomItem(TOPICOS[materiaKey]);
}

/**
 * Obtém um tema de redação aleatório
 */
function getRandomTema() {
  return randomItem(TEMAS_REDACAO);
}

/**
 * Aplica contrações gramaticais do português
 * Exemplos: "de a" → "da", "de o" → "do", "em a" → "na", etc.
 */
function applyContractions(text) {
  return (
    text
      // Contrações com "de"
      .replace(/\bde a\b/gi, 'da')
      .replace(/\bde o\b/gi, 'do')
      .replace(/\bde as\b/gi, 'das')
      .replace(/\bde os\b/gi, 'dos')
      // Contrações com "em"
      .replace(/\bem a\b/gi, 'na')
      .replace(/\bem o\b/gi, 'no')
      .replace(/\bem as\b/gi, 'nas')
      .replace(/\bem os\b/gi, 'nos')
      // Contrações com "por" (arcaico, mas ainda usado)
      .replace(/\bpor a\b/gi, 'pela')
      .replace(/\bpor o\b/gi, 'pelo')
      .replace(/\bpor as\b/gi, 'pelas')
      .replace(/\bpor os\b/gi, 'pelos')
      // Contrações com "a" (preposição + artigo = crase, mas aqui mantemos "à")
      .replace(/\ba a\b/gi, 'à')
      .replace(/\ba as\b/gi, 'às')
      // Contrações com "para" (informal: pra/pro, mas mantemos formal)
      // Não contraímos "para a" → "pra" pois é mais informal
      // Contrações com "com" (arcaico)
      .replace(/\bcom a\b/gi, 'com a') // mantém
      .replace(/\bcom o\b/gi, 'com o')
  ); // mantém
}

/**
 * Substitui todos os placeholders em um template
 *
 * Placeholders suportados:
 * - {materia} - nome da matéria sem artigo
 * - {materia_art} - nome da matéria com artigo (ex: "a matemática")
 * - {topico} - nome do tópico sem artigo
 * - {topico_art} - nome do tópico com artigo (ex: "a revolução industrial")
 * - {tema} - tema de redação sem artigo
 * - {tema_art} - tema de redação com artigo
 *
 * Automaticamente aplica contrações: "de a" → "da", "de o" → "do", etc.
 */
function fillTemplate(template) {
  let result = template;

  // Processa matéria
  if (result.includes('{materia}') || result.includes('{materia_art}')) {
    const materia = getRandomMateria();
    result = result.replace(/{materia_art}/g, `${materia.artigo} ${materia.termo}`);
    result = result.replace(/{materia}/g, materia.termo);
  }

  // Processa tópico
  if (result.includes('{topico}') || result.includes('{topico_art}')) {
    const topico = getRandomTopico();
    result = result.replace(/{topico_art}/g, `${topico.artigo} ${topico.termo}`);
    result = result.replace(/{topico}/g, topico.termo);
  }

  // Processa tema de redação
  if (result.includes('{tema}') || result.includes('{tema_art}')) {
    const tema = getRandomTema();
    result = result.replace(/{tema_art}/g, `${tema.artigo} ${tema.termo}`);
    result = result.replace(/{tema}/g, tema.termo);
  }

  // Aplica contrações gramaticais (de a → da, de o → do, etc.)
  result = applyContractions(result);

  return result;
}

// ============================================================================
// FUNÇÕES EXPORTADAS
// ============================================================================

/**
 * Gera sugestões usando templates + variação
 * Funciona mesmo sem o modelo IA carregado (fallback)
 */
export function generateSuggestions(count = 3) {
  const suggestions = [];
  const usedTemplates = new Set();

  while (suggestions.length < count && usedTemplates.size < SUGGESTION_TEMPLATES.length) {
    // Escolhe template aleatório não repetido
    let templateIndex;
    do {
      templateIndex = Math.floor(Math.random() * SUGGESTION_TEMPLATES.length);
    } while (usedTemplates.has(templateIndex));

    usedTemplates.add(templateIndex);
    const template = SUGGESTION_TEMPLATES[templateIndex];

    // Preenche o template com valores aleatórios
    const suggestion = fillTemplate(template);
    suggestions.push(suggestion);
  }

  return suggestions;
}

/**
 * Gera um placeholder provocador/inspirador
 * Usa templates com substituição dinâmica
 */
export function generatePlaceholder() {
  const template = randomItem(PLACEHOLDER_TEMPLATES);
  return fillTemplate(template);
}

/**
 * Obtém todas as matérias disponíveis (para uso externo)
 */
export function getMaterias() {
  return MATERIAS.map((m) => m.termo);
}

/**
 * Obtém todos os tópicos de uma matéria específica
 */
export function getTopicosForMateria(materiaKey) {
  const topicos =
    TOPICOS[
      materiaKey
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    ];
  return topicos ? topicos.map((t) => t.termo) : [];
}

/**
 * Obtém todos os temas de redação disponíveis
 */
export function getTemasRedacao() {
  return TEMAS_REDACAO.map((t) => t.termo);
}
