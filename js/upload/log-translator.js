/**
 * LogTranslator
 * Traduz logs técnicos do GitHub Actions/Docker/OpenHands em mensagens narrativas para a UI "Chain of Thought".
 */
export class LogTranslator {
  static translate(text) {
    if (!text) return null;

    const t = text.trim();

    // --- 1. SETUP & INFRASTRUCTURE (Runner, Git, Docker) ---
    if (t.includes("Runner Image Provisioner"))
      return {
        text: "Provisionando infraestrutura isolada de execução...",
        type: "system",
      };
    if (t.includes("Operating System") && t.includes("Ubuntu"))
      return {
        text: "Configurando sistema operacional (Ubuntu Linux)...",
        type: "system",
      };
    if (t.includes("GITHUB_TOKEN Permissions"))
      return {
        text: "Validando permissões de segurança do token...",
        type: "system",
      };

    if (t.includes("Syncing repository") || t.includes("Getting Git version"))
      return {
        text: "Sincronizando repositório de código fonte...",
        type: "system",
      };
    if (t.includes("Fetching the repository") || t.includes("git fetch"))
      return {
        text: "Baixando versão mais recente do código...",
        type: "system",
      };
    if (t.includes("Initializing the repository") || t.includes("git init"))
      return {
        text: "Inicializando controle de versão local...",
        type: "system",
      };
    if (t.includes("Checking out the ref"))
      return {
        text: "Checkpoint de código definido (Checkout)...",
        type: "system",
      };

    // Docker Image Pulling (Verbose)
    if (t.includes("Pulling fs layer"))
      return {
        text: "Baixando camadas da imagem Docker (Sistema de Arquivos)...",
        type: "loading",
      };
    if (t.includes("Verifying Checksum"))
      return {
        text: "Verificando integridade dos pacotes baixados...",
        type: "loading",
      };
    if (t.includes("Download complete"))
      return {
        text: "Download de componente concluído com sucesso.",
        type: "loading",
      };
    if (t.includes("Downloaded newer image"))
      return {
        text: "Imagem do ambiente atualizada e pronta.",
        type: "success",
      };
    if (t.includes("Status: Downloaded newer image for"))
      return {
        text: "Ambiente de execução OpenHands preparado.",
        type: "success",
      };

    // Docker Setup
    if (t.includes("Creating group with id"))
      return {
        text: "Configurando grupos de permissão no container...",
        type: "system",
      };
    if (t.includes("Running as enduser"))
      return {
        text: "Iniciando sandbox segura como usuário restrito...",
        type: "system",
      };
    if (t.includes("Starting OpenHands"))
      return {
        text: "Inicializando Núcleo de IA (OpenHands)...",
        type: "warning",
      };
    if (t.includes("Container started: openhands-runtime"))
      return { text: "Container de execução ativo.", type: "success" };

    // --- 2. AGENT INITIALIZATION & TOOLS ---
    if (t.includes("Registering service for agent"))
      return {
        text: "Carregando serviços cognitivos do agente...",
        type: "info",
      };
    if (t.includes("Loading user workspace microagents"))
      return {
        text: "Carregando micro-agentes especializados...",
        type: "info",
      };
    if (t.includes("Adding search engine to MCP config"))
      return {
        text: "Configurando motor de busca avançada (MCP)...",
        type: "info",
      };
    if (t.includes("Connected to server with tools"))
      return {
        text: "Ferramentas conectadas com sucesso (Browser, Code, Search).",
        type: "success",
      };
    if (t.includes("Setting") && t.includes("MCP tools for agent"))
      return {
        text: "Equipando agente com kit de ferramentas completo...",
        type: "success",
      };
    if (t.includes("AgentController") && t.includes("created new state"))
      return {
        text: "Sessão do agente criada. Pronto para iniciar.",
        type: "success",
      };

    // --- 3. EXECUTION FLOW (Thoughts & Actions) ---
    if (t.includes("AgentState.LOADING to AgentState.RUNNING"))
      return {
        text: "Agente iniciou a execução da tarefa.",
        type: "in_progress",
      };
    if (t.includes("AgentStateChangedObservation") && t.includes("running"))
      return {
        text: "Estado do agente atualizado: EM EXECUÇÃO.",
        type: "in_progress",
      };

    // User/Agent Dialogue
    if (t.includes("USER_ACTION")) return null; // Skip raw implementation details
    if (t.includes("MessageAction")) {
      if (t.includes("QUERY:"))
        return {
          text: "Recebendo query de pesquisa do usuário...",
          type: "info",
        };
      return { text: "Processando nova instrução...", type: "info" };
    }

    // Observations (Thoughts/Recalls)
    if (t.includes("RecallObservation"))
      return {
        text: "Acessando memória de longo prazo (Workspace Context)...",
        type: "info",
      };
    if (t.includes("OBSERVATION")) return null; // Generic tag, skip

    // Specific Tools logic (heuristic)
    if (t.includes("tavily") || t.includes("Search"))
      return {
        text: "Realizando pesquisa profunda na web (Tavily)...",
        type: "in_progress",
      };
    if (t.includes("browser") || t.includes("Browsing"))
      return {
        text: "Navegando e analisando conteúdo de página...",
        type: "in_progress",
      };
    if (t.includes("python") || t.includes("jupyter"))
      return {
        text: "Executando script de análise (Python)...",
        type: "in_progress",
      };
    if (t.includes("curl") || t.includes("wget"))
      return {
        text: "Realizando download de recursos identificados...",
        type: "in_progress",
      };

    // --- 4. DATA SAVING & CLEANUP ---
    if (t.includes("Copying artifacts from container"))
      return {
        text: "Persistindo artefatos e resultados gerados...",
        type: "success",
      };
    if (t.includes("docker rm"))
      return {
        text: "Limpando containers e recursos temporários...",
        type: "system",
      };
    if (t.includes("Disk space before cleanup"))
      return {
        text: "Iniciando limpeza de arquivos temporários e liberando espaço em disco...",
        type: "system",
      };
    if (t.includes("Disk space after cleanup"))
      return {
        text: "Limpeza de disco e integridade verificadas. Espaço liberado com sucesso.",
        type: "success",
      };
    if (t.includes("Job succeeded") || t.includes("Job finished"))
      return { text: "Pipeline finalizado com sucesso.", type: "success" };

    // --- 5. LOG ERRORS ---
    if (t.includes("Error:") || t.includes("Exception") || t.includes("Failed"))
      return {
        text: `Erro detectado: ${t.substring(0, 50)}...`,
        type: "error",
      };

    // --- 5. DATA SEARCH & SETUP ---
    if (t.includes("Verificando banco de dados por resultados existentes"))
      return {
        text: "Consultando base de dados por cache ou resultados prévios...",
        type: "info",
      };
    if (t.includes("Slug Canônico Gerado:"))
      return {
        text: t, // Mantém o original pois contém info dinâmica importante
        type: "success",
      };
    if (t.includes("Conectando ao canal:"))
      return {
        text: t, // Mantém o original
        type: "info",
      };

    return null;
  }
}
