/**
 * UploadLogTranslator
 * Traduz logs técnicos do processo de upload manual para mensagens amigáveis na UI.
 */
export class UploadLogTranslator {
  static translate(message) {
    if (!message) return null;

    const msg = message.trim();

    // --- STAGE 1: HASH & PRE-PROCESS (0-33%) ---
    if (msg.includes("Calculando indentidade visual"))
      return { percent: 5, text: "Iniciando análise do arquivo..." };
    if (msg.includes("Enviando prova para servidor temporário"))
      return { percent: 10, text: "Preparando arquivo da prova..." };
    if (msg.includes("Enviando gabarito para servidor temporário"))
      return { percent: 15, text: "Preparando arquivo do gabarito..." };
    if (msg.includes("Solicitando cálculo de hash"))
      return { percent: 20, text: "Verificando integridade e duplicidade..." };
    if (msg.includes("Calculando hash da Prova"))
      return { percent: 25, text: "Analisando estrutura visual da prova..." };
    if (msg.includes("Calculando hash do Gabarito"))
      return {
        percent: 30,
        text: "Analisando estrutura visual do gabarito...",
      };
    if (msg.includes("Validando integridade visual")) {
      // Extract percentage if available in the log? For now just generic.
      return { percent: 25, text: "Validando integridade visual detalhada..." };
    }

    // --- STAGE 2: WORKER & AI (33-66%) ---
    if (msg.includes("FormData prepared"))
      return {
        percent: 35,
        text: "Enviando dados para processamento inteligente...",
      };
    if (msg.includes("Worker Response"))
      return { percent: 50, text: "Resposta do servidor recebida." };
    if (msg.includes("Iniciando conexão com o servidor de logs"))
      return {
        percent: 60,
        text: "Estabelecendo canal seguro de comunicação...",
      };
    if (msg.includes("Subscribing to Pusher"))
      return { percent: 65, text: "Conectado. Aguardando sincronização..." };

    // --- STAGE 3: CLOUD SYNC (66-95%) ---
    // Logs coming from GitHub Actions via Pusher
    if (msg.includes("Request received"))
      return {
        percent: 70,
        text: "Requisição aceita. Iniciando pipeline na nuvem...",
      };
    if (msg.includes("Syncing to standard dataset"))
      return { percent: 72, text: "Organizando estrutura do dataset..." };
    if (
      msg.includes("Clone Hugging Face Repo") ||
      msg.includes("Baixando base de dados")
    )
      return { percent: 75, text: "Sincronizando com repositório global..." };

    if (
      msg.includes("Download Files") ||
      msg.includes("Baixando arquivos processados")
    )
      return { percent: 80, text: "Adicionando novos arquivos ao acervo..." };
    if (msg.includes("Collision resolved"))
      return { text: "Resolvendo conflito de nomes automaticamente..." }; // Keep percent

    if (
      msg.includes("Compute Visual Hashes") ||
      msg.includes("Validando integridade visual")
    )
      return {
        percent: 85,
        text: "Revalidando integridade dos dados na nuvem...",
      };

    if (
      msg.includes("Generate Thumbnails") ||
      msg.includes("Generating thumbnails")
    )
      return { percent: 90, text: "Gerando pré-visualizações e miniaturas..." };

    if (
      msg.includes("Push to Hugging Face") ||
      msg.includes("Salvando alterações")
    )
      return { percent: 92, text: "Finalizando persistência de dados..." };

    if (msg.includes("Update Semantic Cache"))
      return { percent: 94, text: "Atualizando índice de busca semântica..." };

    // --- COMPLETION ---
    if (
      msg.includes("Cloud sync complete") ||
      msg.includes("Files and Thumbnails are live")
    ) {
      return { percent: 100, text: "Sincronização concluída com sucesso!" };
    }

    // Fallback: Return text as is, no percent update
    return { text: msg };
  }
}
