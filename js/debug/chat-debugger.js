import { renderLatexIn } from "../libs/loader";
import { generateChatHtmlString } from "../render/ChatRender";
import { hydrateAllChatContent } from "../render/hydration.js";
import { updateChatFloatingHeader } from "../app/telas.js";
import { initCustomChatScrollbar } from "../ui/custom-chat-scrollbar.js";
import { initTopScrollSync } from "../ui/top-scroll-sync.js";

/**
 * Módulo de Debug para Chat - VERSÃO COMPLETA E COMPLEXA
 * Testa exaustivamente todos os LAYOUT_TYPES e CONTENT_BLOCK_TYPES
 * com coesão semântica e visual.
 *
 * Uso: window.debugChat(mode?)
 */

const MOCK_IMAGES = {
  space:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/FullMoon2010.jpg/1200px-FullMoon2010.jpg",
  tech: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Pyramids_of_Giza_seen_from_the_air.jpg/1200px-Pyramids_of_Giza_seen_from_the_air.jpg", // Placeholder
  nature:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Hopetoun_falls.jpg/1200px-Hopetoun_falls.jpg",
  chart: "https://via.placeholder.com/800x400.png?text=Chart+Visualization",
  portrait: "https://via.placeholder.com/300x400.png?text=Portrait",
  square: "https://via.placeholder.com/300x300.png?text=Square",
};

/**
 * Utilitários de Geração de Conteúdo
 */

const createTitle = (text) => ({ tipo: "titulo", conteudo: text });
const createSubtitle = (text) => ({ tipo: "subtitulo", conteudo: text });
const createText = (text) => ({ tipo: "texto", conteudo: text });
const createImage = (caption, url) => ({
  tipo: "imagem",
  conteudo: caption,
  props: { src: url },
});
const createQuote = (text) => ({ tipo: "citacao", conteudo: text });
const createCode = (code, lang = "javascript") => ({
  tipo: "codigo",
  conteudo: code,
  props: { language: lang },
});
const createList = (items) => ({
  tipo: "lista",
  conteudo: items.map((i) => `- ${i}`).join("\n"),
});
const createTable = (headers, rows) => {
  const headerStr = `| ${headers.join(" | ")} |\n| ${headers.map(() => "---").join(" | ")} |`;
  const rowsStr = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return { tipo: "tabela", conteudo: `${headerStr}\n${rowsStr}` };
};
const createEquation = (eq) => ({ tipo: "equacao", conteudo: eq });
const createHighlight = (text, icon = "💡") => ({
  tipo: "destaque",
  conteudo: `${icon} ${text}`,
});
const createSeparator = () => ({ tipo: "separador", conteudo: "" });
const createSource = (text) => ({ tipo: "fonte", conteudo: text });
const createQuestion = (query, props = {}) => ({
  tipo: "questao",
  conteudo: query,
  props: props,
});
const createScaffolding = (statement, props = {}) => ({
  tipo: "scaffolding",
  conteudo: statement,
  props: props,
});

/**
 * Cenários de Teste por Layout
 */

const SCENARIOS = {
  // 1. SPLIT SCREEN: Code vs Preview
  split_screen: {
    id: "split_screen",
    description: "Ambiente de Desenvolvimento (Code + Preview)",
    data: {
      layout: { id: "split_screen" },
      slots: {
        left: [
          createTitle("DataAnalysis.py"),
          createText(
            "Script Python para análise exploratória de dados utilizando Pandas e Matplotlib.",
          ),
          createCode(
            `import pandas as pd\nimport matplotlib.pyplot as plt\n\ndf = pd.read_csv('data.csv')\n\n# Calculate moving average\ndf['MA'] = df['value'].rolling(window=7).mean()\n\nplt.figure(figsize=(10,6))\nplt.plot(df['date'], df['value'], label='Original')\nplt.plot(df['date'], df['MA'], color='red', label='7-Day MA')\nplt.title('Sales Trends')\nplt.show()`,
            "python",
          ),
          createHighlight(
            "Certifique-se de instalar as dependências: `pip install pandas matplotlib`",
          ),
          createQuestion("Questão sobre Python Data Science", {
            subject: "Programação",
          }),
        ],
        right: [createTitle("Output Preview")],
        right: [
          createTitle("Output Preview"),
          createImage("Gráfico Gerado", MOCK_IMAGES.chart),
          createSubtitle("Análise Estatística"),
          createTable(
            ["Metric", "Value", "Delta"],
            [
              ["Mean", "145.2", "+2.4%"],
              ["Median", "142.0", "-0.1%"],
              ["Std Dev", "12.5", "N/A"],
            ],
          ),
          createQuote(
            "A tendência de alta é confirmada pela média móvel de 7 dias.",
          ),
          createSource("Fonte: Dados internos Q3 2025"),
        ],
      },
    },
  },

  // 2. TWO COLUMN: Documentation
  two_column: {
    id: "two_column",
    description: "Documentação Técnica (Nav + Content)",
    data: {
      layout: { id: "two_column" },
      slots: {
        sidebar: [
          createSubtitle("Navegação"),
          createList([
            "Introdução",
            "**Autenticação**",
            "Endpoints",
            "Erros Comuns",
          ]),
          createSeparator(),
          createHighlight("Versão: v2.4.0", "📌"),
          createSource("Docs oficiais"),
        ],
        main: [
          createTitle("Autenticação API"),
          createText(
            "A autenticação é feita via **Bearer Token** no header de cada requisição.",
          ),
          createCode(
            `curl -X GET https://api.exemplo.com/v1/user \\
  -H "Authorization: Bearer <seu_token>"`,
            "bash",
          ),
          createSubtitle("Parâmetros de Requisição"),
          createTable(
            ["Campo", "Tipo", "Obrigatório", "Descrição"],
            [
              ["client_id", "String", "Sim", "ID único da aplicação"],
              ["scope", "String", "Não", "Permissões solicitadas"],
              ["redirect_uri", "Url", "Sim", "Callback URL"],
            ],
          ),
          createHighlight("**Atenção:** Tokens expiram após 60 minutos.", "⚠️"),
          createImage(
            "Fluxo OAuth2",
            "https://via.placeholder.com/800x300.png?text=OAuth2+Flow",
          ),
        ],
      },
    },
  },

  // 3. MAGAZINE: Editorial Content
  magazine: {
    id: "magazine",
    description: "Revista/Blog (Layout Complexo)",
    data: {
      layout: { id: "magazine" },
      slots: {
        headline: [
          createTitle("O Futuro da Exploração Espacial"),
          createText(
            "Novas tecnologias de propulsão prometem reduzir o tempo de viagem a Marte pela metade, abrindo portas para a colonização humana ainda nesta década.",
          ),
        ],
        featured: [
          createImage("Super Heavy Booster", MOCK_IMAGES.space),
          createQuote(
            "A Terra é o berço da humanidade, mas não se pode viver no berço para sempre.",
          ),
          createSource("Konstantin Tsiolkovsky"),
        ],
        sidebar: [
          createSubtitle("Em Alta"),
          createList([
            "NASA confirma missão a Europa",
            "China completa estação espacial",
            "Telescópio James Webb descobre exoplaneta",
          ]),
          createSeparator(),
          createHighlight("Live às 14h: Lançamento Starship", "🔴"),
        ],
        feed: [
          createSubtitle("Últimas Notícias"),
          createText(
            "**SpaceX:** Teste de ignição estática bem sucedido no Texas.",
          ),
          createSeparator(),
          createText(
            "**ESA:** Agência Europeia anuncia novos astronautas para 2026.",
          ),
          createSeparator(),
          createText(
            "**Blue Origin:** Novo foguete New Glenn chega à plataforma.",
          ),
        ],
      },
    },
  },

  // 4. THREE COLUMN: Pricing/Comparison
  three_column: {
    id: "three_column",
    description: "Comparativo de Preços",
    data: {
      layout: { id: "three_column" },
      slots: {
        col1: [
          createSubtitle("Starter"),
          createEquation("R\\$ 0,00"),
          createText("Para projetos pessoais."),
          createList(["1 Usuário", "5 Projetos", "Suporte da Comunidade"]),
          createHighlight("Grátis para sempre"),
        ],
        col2: [
          createSubtitle("Pro"),
          createEquation("R\\$ 49,00"),
          createText("Para profissionais."),
          createList([
            "5 Usuários",
            "Projetos Ilimitados",
            "Suporte Prioritário",
            "Analytics Avançado",
          ]),
          createHighlight("Mais Popular", "⭐"),
        ],
        col3: [
          createSubtitle("Enterprise"),
          createEquation("\\text{Sob Consulta}"),
          createText("Para grandes times."),
          createList([
            "SSO",
            "SLA Garantido",
            "Gerente de Conta",
            "Audit Logs",
          ]),
          createHighlight("Fale com Vendas"),
        ],
      },
    },
  },

  // 5. ASYMMETRICAL: Biography/Profile
  asymmetrical: {
    id: "asymmetrical",
    description: "Biografia (Main + Aside)",
    data: {
      layout: { id: "asymmetrical" },
      slots: {
        main: [
          createTitle("Alan Turing"),
          createText(
            "Alan Mathison Turing (Londres, 23 de junho de 1912 — Wilmslow, 7 de junho de 1954) foi um matemático, cientista da computação, lógico, criptoanalista, filósofo e biólogo teórico britânico.",
          ),
          createQuote(
            "Nós só podemos ver uma curta distância à frente, mas podemos ver muito do que precisa ser feto.",
          ),
          createText(
            "Turing foi altamente influente no desenvolvimento da ciência da computação teórica, proporcionando uma formalização dos conceitos de algoritmo e computação com a máquina de Turing, que pode ser considerada um modelo de um computador de uso geral.",
          ),
          createEquation("P \\neq NP \\text{ (Problema em aberto)}"),
        ],
        aside: [
          createImage("Alan Turing", MOCK_IMAGES.portrait),
          createSubtitle("Nascimento"),
          createText("23 de junho de 1912"),
          createSubtitle("Morte"),
          createText("7 de junho de 1954"),
          createSubtitle("Conhecido por"),
          createList(["Máquina de Turing", "Teste de Turing", "Enigma"]),
        ],
      },
    },
  },

  // 6. F-SHAPE: Dashboard
  f_shape: {
    id: "f_shape",
    description: "Dashboard Analítico",
    data: {
      layout: { id: "f_shape" },
      slots: {
        header: [
          createTitle("System Performance Monitor"),
          createText("Status global da infraestrutura em tempo real."),
        ],
        sidebar: [
          createSubtitle("Servers"),
          createList([
            "US-East-1 (Active)",
            "EU-West-2 (Active)",
            "SA-East-1 (Warning)",
          ]),
          createSeparator(),
          createSubtitle("Services"),
          createList(["Database", "Cache", "Workers", "API Gateway"]),
        ],
        content: [
          createSubtitle("Visão Geral de Recursos"),
          createText(
            "O consumo de CPU está estável, mas a memória no cluster SA-East-1 apresenta picos.",
          ),
          // Nested Layout Inside Content!
          {
            tipo: "layout_section",
            layout: { id: "three_column" },
            slots: {
              col1: [createHighlight("CPU: 42%", "🟢")],
              col2: [createHighlight("Mem: 89%", "🟠")],
              col3: [createHighlight("Disk: 30%", "🟢")],
            },
          },
          createImage("Load Graph", MOCK_IMAGES.chart),
          createTable(
            ["Node", "Uptime", "Load"],
            [
              ["worker-01", "14d 2h", "0.45"],
              ["worker-02", "12h 10m", "1.20"],
              ["db-primary", "45d", "0.80"],
            ],
          ),
        ],
      },
    },
  },

  // 7. Z-SHAPE: Journey/Process
  z_shape: {
    id: "z_shape",
    description: "Jornada do Usuário (Passo a Passo)",
    data: {
      layout: { id: "z_shape" },
      slots: {
        step_1: [
          createTitle("1. Descoberta"),
          createText(
            "O usuário encontra o produto através de canais de marketing ou busca orgânica. O foco aqui é gerar interesse imediato.",
          ),
          createHighlight("Touchpoint: Redes Sociais"),
        ],
        step_2: [
          createTitle("2. Consideração"),
          createImage("Comparativo", MOCK_IMAGES.square),
          createText(
            "O usuário compara funcionalidades e preços. Avalia depoimentos e busca validação social.",
          ),
        ],
        step_3: [
          createTitle("3. Decisão"),
          createText(
            "A conversão ocorre. O onboarding deve ser imediato e sem atritos.",
          ),
          createCode("user.convert()", "javascript"),
          createHighlight("Meta: < 3 cliques"),
        ],
      },
    },
  },

  // 8. MASONRY: Moodboard
  masonry: {
    id: "masonry",
    description: "Galeria / Moodboard",
    data: {
      layout: { id: "masonry" },
      slots: {
        content: [
          createImage("Natureza", MOCK_IMAGES.nature),
          createQuote("A simplicidade é o último grau de sofisticação."),
          createText("Texto curto de enchimento."),
          createImage("Espaço", MOCK_IMAGES.space),
          createHighlight("Destaque Importante"),
          createCode("const art = true;", "js"),
          createImage("Tech", MOCK_IMAGES.tech),
          createList(["Azul", "Verde", "Roxo"]),
          createTable(
            ["Cor", "Hex"],
            [
              ["Red", "#F00"],
              ["Blue", "#00F"],
            ],
          ),
        ],
      },
    },
  },

  // 9. FEATURED MEDIA: Video Lesson
  featured_media: {
    id: "featured_media",
    description: "Aula em Vídeo",
    data: {
      layout: { id: "featured_media" },
      slots: {
        media: [
          createImage("Video Thumbnail", MOCK_IMAGES.tech), // Simulate video with image
          createSource("Duração: 14:20"),
        ],
        content: [
          createTitle("Aula 4: Redes Neurais Convolucionais"),
          createText(
            "Nesta aula vamos desmistificar como as CNNs processam imagens.",
          ),
          createSubtitle("Tópicos Abordados"),
          createList([
            "Camadas de Convolução",
            "Pooling",
            "Flattening",
            "Full Connection",
          ]),
          createHighlight("Exercício Disponível no GitHub", "📝"),
          createCode("model.add(Conv2D(32, (3, 3)))", "python"),
        ],
      },
    },
  },

  // 10. CARD BLOCK: Quiz
  card_block: {
    id: "card_block",
    description: "Flashcards / Opções",
    data: {
      layout: { id: "card_block" },
      slots: {
        content: [
          {
            ...createSubtitle("Opção A"),
            ...createText("Renderização Server-Side"),
          },
          {
            ...createSubtitle("Opção B"),
            ...createText("Renderização Client-Side"),
          },
          {
            ...createSubtitle("Opção C"),
            ...createText("Geração Estática (SSG)"),
          },
          {
            ...createSubtitle("Opção D"),
            ...createText("Incremental Static Regen"),
          },
        ],
      },
    },
  },

  // 11. INTERACTIVE CAROUSEL: Wizard
  interactive_carousel: {
    id: "interactive_carousel",
    description: "Carousel / Wizard",
    data: {
      layout: { id: "interactive_carousel" },
      slots: {
        slides: [
          {
            ...createTitle("Bem-vindo"),
            ...createText("Vamos configurar seu ambiente."),
          },
          {
            ...createTitle("Passo 1"),
            ...createText("Instale o CLI."),
            ...createCode("npm install -g cli"),
          },
          {
            ...createTitle("Passo 2"),
            ...createText("Faça login."),
            ...createCode("cli login"),
          },
          {
            ...createTitle("Pronto!"),
            ...createHighlight("Você está pronto para começar."),
          },
        ],
      },
    },
  },

  // 12. LINEAR: Fallback & Standard
  linear: {
    id: "linear",
    description: "Chat Linear Padrão",
    data: {
      layout: { id: "linear" },
      slots: {
        content: [
          createTitle("Resposta Padrão"),
          createText(
            "Esta é uma resposta linear padrão do chat, sem layouts complexos, mas com formatação rica.",
          ),
          createList(["Item 1", "Item 2"]),
          createEquation("x = y^2"),
          createQuote("Citação simples no fluxo."),
          createSource("Fonte: Chatbot"),
        ],
      },
    },
  },

  // 13. QUESTION SIMULATION
  question_demo: {
    id: "question_demo",
    description: "Simulação de Questão (Hydration)",
    data: {
      layout: { id: "linear" },
      slots: {
        content: [
          createTitle("Questão do Banco"),
          createText("Abaixo uma questão carregada dinamicamente via Service:"),
          createQuestion("Questão sobre química ENEM", {
            institution: "ENEM",
            subject: "Química",
          }),
          createHighlight("A questão acima foi hidratada em tempo real."),
          createQuestion("Questão Inexistente Fallback 123", {
            subject: "Desconhecido",
          }),
        ],
      },
    },
  },

  // 14. SCAFFOLDING DEMO (WITH QUESTION CONTEXT)
  scaffolding_demo: {
    id: "scaffolding_demo",
    description: "Demonstração de Treino Interativo (Questão + Scaffolding)",
    data: {
      layout: { id: "linear" },
      slots: {
        content: [
          createTitle("Modo de Treino Ativo"),
          createText(
            "Detectei que esta é uma questão complexa de Biologia. Vamos quebrar em partes menores antes de resolver a questão principal.",
          ),
          // 1. A Questão Principal (Contexto)
          createQuestion("Questão sobre Citologia (Mitocôndria)", {
            institution: "ENEM",
            subject: "Biologia",
            // Adicionar ID real ou simulado se necessário para hydration
            force_hydration: true,
          }),

          createSeparator(),

          createText("**Vamos praticar os conceitos fundamentais primeiro:**"),

          // 2. O Scaffolding (Primeiro Passo)
          createScaffolding(
            "A mitocôndria é a organela responsável pela produção de energia (ATP) através da respiração celular.",
            {
              gabarito: true,
              explicacao:
                "Exato! A mitocôndria é a 'usina de força' da célula. A fotossíntese ocorre nos cloroplastos.",
              contexto: { disciplina: "Biologia", topico: "Organelas" },
              tempo_ideal: 15,
              status: "em_andamento",
            },
          ),
          createHighlight(
            "Responda a este passo para liberar a explicação e avançar.",
            "🤖",
          ),
        ],
      },
    },
  },

  // 15. REPRO: Interactive Carousel Bug
  carousel_bug_repro: {
    id: "carousel_bug_repro",
    description: "Reproduction of Carousel Rendering Bug (Nested Content)",
    data: {
      layout: { id: "interactive_carousel" },
      slots: {
        slides: [
          {
            content: [
              {
                tipo: "destaque",
                conteudo:
                  "Vamos começar nossa jornada em Química Orgânica! O scaffolding vai te guiar passo a passo.",
              },
            ],
          },
          {
            content: [
              {
                tipo: "texto",
                conteudo:
                  "A Química Orgânica estuda os compostos que contêm **carbono**, geralmente ligado a hidrogênio, oxigênio, nitrogênio, entre outros. O carbono é especial por sua capacidade de formar quatro ligações covalentes.",
              },
            ],
          },
          {
            content: [
              {
                tipo: "texto",
                conteudo:
                  "Para começar, você se lembra dos principais tipos de ligação que o carbono pode fazer? (Simples, Dupla, Tripla)",
              },
            ],
          },
        ],
      },
    },
  },
};

/**
 * Força a transição da UI para o modo chat
 */
const forceEnterChatMode = () => {
  const container = document.querySelector(".maia-ai-container");
  if (!container) return null;

  let messagesContainer = document.getElementById("chatMessages");
  if (messagesContainer) return messagesContainer;

  console.log("🐛 [Debug] Forçando transição UI...");
  container.classList.add("chat-mode");

  const brandHeader = document.getElementById("brandHeader");
  if (brandHeader) brandHeader.remove();

  const footer = document.querySelector(".maia-ai-footer");
  if (footer) footer.remove();

  messagesContainer = document.createElement("div");
  messagesContainer.className = "chat-messages";
  messagesContainer.id = "chatMessages";

  const inputWrapper = document.getElementById("chatInputWrapper");
  if (inputWrapper) {
    inputWrapper.parentNode.insertBefore(messagesContainer, inputWrapper);
  } else {
    container.appendChild(messagesContainer);
  }

  return messagesContainer;
};

/**
 * Função Principal de Debug
 */
window.debugChat = async (targetId = null) => {
  console.log("🐛 INICIANDO DEBUG COMPLEXO DE CHAT...");
  console.table(SCENARIOS);

  const messagesContainer = forceEnterChatMode();
  if (!messagesContainer) {
    console.error("❌ Não foi possível inicializar o container de chat.");
    return;
  }

  // Define o título do header durante o debug
  updateChatFloatingHeader("Modo de Debug 🐛");

  // Initialize custom scrollbars for mobile and horizontal sync (debug mode)
  setTimeout(() => {
    initCustomChatScrollbar();
    initTopScrollSync();
  }, 100);

  // Se targetId for fornecido, filtra. Senão, usa o teste padrão solicitado (Questão + Scaffolding).
  // Ordem específica para testes visuais agradáveis
  const keys = targetId ? [targetId] : Object.keys(SCENARIOS);

  // Limpa mensagens anteriores se estiver rodando tudo
  if (!targetId) {
    messagesContainer.innerHTML = "";
    const welcome = document.createElement("div");
    welcome.className = "chat-message chat-message--system visible";
    welcome.innerHTML = `<div class="chat-message-content" style="text-align:center">
        <h2>🧪 Suite de Testes de UI/UX</h2>
        <p>Injetando cenários complexos para validação de design.</p>
     </div>`;
    messagesContainer.appendChild(welcome);
  }

  for (const key of keys) {
    const scenario = SCENARIOS[key];
    if (!scenario) {
      console.warn(`⚠️ Cenário ${key} não encontrado.`);
      continue;
    }

    console.log(`RENDERIZANDO: ${scenario.description}`);

    // Cria wrapper da mensagem
    const aiMessageDiv = document.createElement("div");
    aiMessageDiv.className = "chat-message chat-message--ai visible";

    // Adiciona label de debug acima da mensagem
    const debugLabel = document.createElement("div");
    debugLabel.style.fontSize = "10px";
    debugLabel.style.opacity = "0.5";
    debugLabel.style.marginBottom = "4px";
    debugLabel.style.marginLeft = "16px";
    debugLabel.innerText = `[DEBUG] Layout: ${scenario.id.toUpperCase()} | ${scenario.description}`;
    messagesContainer.appendChild(debugLabel);

    const contentDiv = document.createElement("div");
    contentDiv.className = "chat-message-content";
    aiMessageDiv.appendChild(contentDiv);

    try {
      // Gera HTML
      const html = generateChatHtmlString(scenario.data);
      console.log(`[Debug] HTML Generated for ${key}:`, html.length, "chars");
      contentDiv.innerHTML = html;

      // Pós-processamento (Latex e Syntax Highlight)
      await renderLatexIn(contentDiv);

      // MOVED: Append immediately so layout/placeholder is visible while hydrating
      messagesContainer.appendChild(aiMessageDiv);
      messagesContainer.scrollTo({
        top: messagesContainer.scrollHeight,
        behavior: "smooth",
      });

      // Delay para permitir renderização e "respiro" visual entre blocos
      await new Promise((r) => setTimeout(r, 800));

      // HYDRATION CENTRALIZADA (Carousel, Scaffolding, Questões)
      await hydrateAllChatContent(contentDiv);
    } catch (e) {
      console.error(`❌ Erro no cenário ${key}:`, e);
      contentDiv.innerHTML = `<div style="background:#ffcccc; color:#990000; padding:10px; border-radius:8px;">
            <strong>Erro de Renderização (${key}):</strong><br>${e.message}
        </div>`;
      messagesContainer.appendChild(aiMessageDiv);
    }
  }

  const done = document.createElement("div");
  done.className = "chat-message chat-message--system visible";
  done.innerHTML = `<div class="chat-message-content" style="text-align:center">✅ Todos os cenários renderizados.</div>`;
  messagesContainer.appendChild(done);

  console.log("🐛 Debug finalizado com sucesso.");
};

console.log("🔧 Chat Debugger Pro carregado. window.debugChat()");
