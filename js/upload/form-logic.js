import { customAlert } from "../ui/GlobalAlertsLogic";
import { gerarVisualizadorPDF } from "../viewer/events.js";
import { getProxyPdfUrl } from "../api/worker.js";

/**
 * Helper: Upload to TmpFiles.org
 */
async function uploadToTmpFiles(file, customName = null, signal = null) {
  const formData = new FormData();
  if (customName) {
    formData.append("file", file, customName);
  } else if (file.name) {
    formData.append("file", file, file.name);
  } else {
    formData.append("file", file, "unknown_file.pdf");
  }

  try {
    const response = await fetch("https://tmpfiles.org/api/v1/upload", {
      method: "POST",
      body: formData,
      signal,
    });
    const data = await response.json();
    if (data.status === "success") {
      // Convert view URL to download URL
      // View: https://tmpfiles.org/12345/file.pdf
      // Download: https://tmpfiles.org/dl/12345/file.pdf
      let url = data.data.url;
      if (url.includes("tmpfiles.org/")) {
        url = url.replace("tmpfiles.org/", "tmpfiles.org/dl/");
        if (url.startsWith("http:")) {
          url = url.replace("http:", "https:");
        }
      }
      return url;
    }
    throw new Error("Upload failed");
  } catch (e) {
    if (e.name !== "AbortError") {
      console.error("TmpFiles Upload Error:", e);
    }
    throw e;
  }
}

/**
 * 3. LÓGICA DO FORMULÁRIO
 * Lida com preenchimento inicial, checkbox e submit.
 */
/**
 * Helper: Download PDF from URL (Blob)
 */
async function downloadPdfFromUrl(url, signal = null) {
  try {
    const res = await fetch(url, { signal });
    if (res.ok) {
      return await res.blob();
    }
    throw new Error(`Status ${res.status}`);
  } catch (e) {
    console.warn("[Manual] Failed to download PDF from URL directly, trying Puter fallback:", url, e);
    try {
      if (typeof window !== "undefined" && window.puter && window.puter.net && window.puter.net.fetch) {
        const res = await window.puter.net.fetch(url);
        if (!res.ok) throw new Error(`Puter HTTP ${res.status}`);
        const blob = await res.blob();
        return blob;
      }
    } catch (puterErr) {
      console.error("[Manual] Puter fallback fetch also failed:", puterErr);
    }
    return null;
  }
}

export function setupFormLogic(elements, initialData) {
  const { yearInput, form, pdfInput } = elements;

  // Title is now auto-detected, so we don't need the input binding.
  // We will send a placeholder "Auto-Detect" to satisfy backend requirements until refined.
  const AUTO_TITLE = "Auto-Detect";

  // B. Preenchimento de Dados Iniciais (Se houver)
  if (initialData) {
    const fileNameDisplay = document.getElementById("fileName");
    fileNameDisplay.textContent =
      "⚠️ Por favor, selecione o arquivo novamente.";
    fileNameDisplay.style.color = "var(--color-warning)";
  }

  // C. Submit do Formulário
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const userTitle = document.getElementById("pdfTitleInput")?.value.trim();
    const fileProva = pdfInput.files[0];
    const fileGabarito = null; // Fix ReferenceError

    if (!fileProva) {
      customAlert(
        "O arquivo da prova é obrigatório. Por favor, selecione um PDF.",
      );
      return;
    }

    // Wrapped Upload Logic
    const executeUploadSequence = async () => {
      // 1. CLOUD-FIRST FLOW: Show Progress & Upload
      console.log("[Manual] Starting Cloud-First Upload Flow...");

      // Create/Show Progress Modal
      // Create/Show Progress Modal
      const showProgressModal = (initialStatus, onCancel) => {
        let modal = document.getElementById("upload-progress-modal");
        if (!modal) {
          modal = document.createElement("div");
          modal.id = "upload-progress-modal";
          Object.assign(modal.style, {
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.9)",
            zIndex: 12000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(10px)",
            color: "white",
            fontFamily: "var(--font-primary)",
          });
          document.body.appendChild(modal);
        }

        modal.innerHTML = `
        <div style="background:var(--color-surface); padding:30px; border-radius:16px; width:90%; max-width:480px; box-shadow:0 20px 60px rgba(0,0,0,0.6); border:1px solid var(--color-border); display:flex; flex-direction:column; gap:20px;">
            
            <div style="text-align:center;">
                <h3 style="margin:0 0 5px 0; color:var(--color-text); font-size:1.2rem;">Processando Arquivos</h3>
                <p style="margin:0; color:var(--color-text-secondary); font-size:0.9rem;">Tempo estimado: ~2 min (Sincronização com a nuvem)</p>
            </div>

            <!-- Progress Bar Container -->
            <div style="display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--color-text-secondary);">
                    <span id="progress-percent">0%</span>
                    <span id="progress-stage">Iniciando...</span>
                </div>
                <div style="width:100%; height:8px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden;">
                    <div id="upload-progress-bar" style="width:0%; height:100%; background:linear-gradient(90deg, var(--color-primary) 0%, #4facfe 100%); transition: width 0.5s ease-out;"></div>
                </div>
            </div>

            <!-- Log Terminal -->
            <div id="upload-log-terminal" style="
                background: var(--color-surface, #1e1e1e); 
                border-radius:8px; 
                padding:15px; 
                height:160px; 
                overflow-y:auto; 
                font-family: 'Fira Code', monospace; 
                font-size:0.75rem; 
                color: var(--color-text, #d4d4d4); 
                border:1px solid var(--color-border, rgba(255,255,255,0.1));
                display:flex; 
                flex-direction:column; 
                gap:4px;
                scroll-behavior: smooth;
            ">
                <div style="color: var(--color-success, #6a9955);">// Log de processamento em tempo real</div>
                <div class="log-line">> ${initialStatus}</div>
            </div>

            <button id="btn-cancel-upload-process" style="
                margin-top: 10px;
                background: rgba(220, 53, 69, 0.1);
                color: #ff6b6b;
                border: 1px solid rgba(220, 53, 69, 0.3);
                padding: 10px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.9rem;
                transition: all 0.2s;
            " onmouseover="this.style.background='rgba(220, 53, 69, 0.2)'" onmouseout="this.style.background='rgba(220, 53, 69, 0.1)'">
                Cancelar Envio
            </button>

        </div>
      `;

        const btnCancel = document.getElementById("btn-cancel-upload-process");
        if (btnCancel && onCancel) {
          btnCancel.onclick = onCancel;
        }

        const progressBar = document.getElementById("upload-progress-bar");
        const progressPercent = document.getElementById("progress-percent");
        const progressStage = document.getElementById("progress-stage");
        const terminal = document.getElementById("upload-log-terminal");

        // Auto-increment logic (visual only, capped by stage)
        // Stages: 0-33% (Hash), 33-66% (Worker), 66-95% (Sync)
        let currentProgress = 0;
        let targetProgress = 5; // Start small
        let currentStageName = "Preparando...";

        const interval = setInterval(() => {
          if (currentProgress < targetProgress) {
            currentProgress += (targetProgress - currentProgress) * 0.1;
            if (Math.abs(targetProgress - currentProgress) < 0.5)
              currentProgress = targetProgress;
          }

          // Update UI
          if (progressBar) progressBar.style.width = `${currentProgress}%`;
          if (progressPercent)
            progressPercent.textContent = `${Math.round(currentProgress)}%`;
        }, 200);

        const addLog = (text, isSystem = false) => {
          if (!terminal) return;
          const line = document.createElement("div");
          line.className = "log-line";
          line.style.color = isSystem
            ? "var(--color-primary, #569cd6)"
            : "inherit";
          line.textContent = `> ${text}`;
          terminal.appendChild(line);
          terminal.scrollTop = terminal.scrollHeight;
        };

        return {
          setTarget: (percent, stageName) => {
            if (percent > targetProgress) targetProgress = percent;
            if (stageName) {
              progressStage.textContent = stageName;
              currentStageName = stageName;
            }
          },
          addLog: addLog, // Expose plain log adder
          update: (text) => addLog(text), // Alias for backward compatibility
          close: () => {
            clearInterval(interval);
            if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
          },
        };
      };

      const abortController = new AbortController();
      const signal = abortController.signal;

      const progress = showProgressModal(
        "Calculando identidade visual do arquivo...",
        () => {
          const confirmModal = document.getElementById(
            "cancelUploadConfirmModal",
          );
          const btnKeep = document.getElementById("btnKeepUploading");
          const btnConfirm = document.getElementById("btnConfirmCancel");

          if (confirmModal) {
            confirmModal.style.display = "flex";

            // Setup Listeners
            const close = () => {
              confirmModal.style.display = "none";
            };

            btnKeep.onclick = close;

            btnConfirm.onclick = () => {
              close();
              abortController.abort();
              progress.addLog(
                "Cancelando nuvem... Abrindo visualização local.",
                true,
              );

              // Define o arquivo local globalmente para o PdfEmbedRenderer usar se precisar (fallback de qualidade)
              window.__pdfLocalFile = fileProva;
              // [FIX] Dispara evento para notificar componentes React
              window.dispatchEvent(new CustomEvent("pdfLocalFileLoaded"));

              setTimeout(() => {
                progress.close();

                // Inicia visualizador em modo local
                gerarVisualizadorPDF({
                  title: userTitle || fileProva.name,
                  rawTitle: userTitle || fileProva.name,
                  fileProva: fileProva,
                  gabaritoNaProva: false,
                  isManualLocal: true,
                  slug: "local-" + Date.now(),
                  originalPdfUrl: document.getElementById("sourceUrlProva")?.value.trim() || null,
                });
              }, 800);
            };
          } else {
            // Fallback if modal is missing for some reason
            if (confirm("Deseja realmente cancelar o upload?")) {
              abortController.abort();
              progress.close();
            }
          }
        },
      );

      // Helper to Open Viewer (Reusable)
      const openViewer = (hfUrl, slug, aiData, hfUrlGabarito) => {
        const proxyUrl = getProxyPdfUrl(hfUrl);
        const proxyGabUrl = hfUrlGabarito ? getProxyPdfUrl(hfUrlGabarito) : null;
        const linkProva = document.getElementById("sourceUrlProva")?.value.trim();

        gerarVisualizadorPDF({
          title:
            aiData?.formatted_title_general ||
            (aiData?.institution
              ? `${aiData.institution} ${aiData.year || ""}`
              : userTitle || fileProva.name),
          rawTitle:
            aiData?.formatted_title_general || userTitle || fileProva.name,
          fileProva: proxyUrl,
          fileGabarito: proxyGabUrl || aiData?.gabarito_url || null,
          gabaritoNaProva: false,
          isManualLocal: false,
          slug: slug,
          originalPdfUrl: linkProva || aiData?.source_url_prova || hfUrl || null,
        });
      };

      // Reusable Polling Function (Moved Up)
      // Reusable Pusher Listener
      const startPollingAndOpenViewer = async (
        hfUrl,
        slug,
        aiData,
        hfUrlGabarito,
      ) => {
        progress.addLog("Iniciando conexão com o servidor de logs...", true);
        console.log(`[Manual] Subscribing to Pusher channel: ${slug}`);

        // 1. Load Pusher
        let PusherClass = window.Pusher;
        if (!PusherClass) {
          try {
            const module = await import("pusher-js");
            PusherClass = module.default;
          } catch (e) {
            console.warn("Failed to load Pusher, falling back to polling?", e);
            // Fallback or Alert? For now just alert.
            customAlert(
              "Erro ao carregar sistema de notificação em tempo real.",
            );
            return;
          }
        }

        const pusherKey = "6c9754ef715796096116";
        const pusherCluster = "sa1";

        const pusher = new PusherClass(pusherKey, {
          cluster: pusherCluster,
        });

        const channel = pusher.subscribe(slug);
        let eventReceived = false;

        // SAFETY TIMEOUT: Warn if no events for a while
        const safetyTimeout = setTimeout(() => {
          if (!eventReceived) {
            progress.addLog(
              "⚠️ O processo está demorando mais que o normal ou não iniciou.",
              true,
            );
            console.warn("[Manual] No Pusher events received in 20s.");
            // We don't close yet, just warn.
          }
        }, 20000);

        channel.bind("log", (data) => {
          eventReceived = true;
          clearTimeout(safetyTimeout);

          // data can be wrapped or direct
          const msg = data.message || (data.data && data.data.message) || "";
          console.log(`[Pusher] ${msg}`);

          // Update UI handled inside startPolling via Translator now
          // progress.update(msg);

          // Check for success
          if (msg && msg.includes("Cloud sync complete")) {
            progress.addLog(
              "Sincronização concluída! Abrindo visualizador...",
              true,
            );

            // Unsubscribe & Disconnect
            channel.unbind_all();
            pusher.unsubscribe(slug);

            setTimeout(() => {
              try {
                const modalEl = document.getElementById(
                  "upload-progress-modal",
                );
                if (modalEl) modalEl.remove();
              } catch (e) {}

              openViewer(hfUrl, slug, aiData, hfUrlGabarito);
            }, 1500);
          }
        });

        // Fallback Safety for "already done" or "missed event"?
        // If we subscribed too late, we might wait forever.
        // Strategy: Check HEAD once at start just in case it's ALREADY there.
        // But usually we are calling this right after dispatch.
      };

      try {
        let remoteHashProva = null;
        let remoteHashGab = null;
        let remoteHashProvaLink = null;
        let remoteHashGabLink = null;
        let tmpUrlProva = null;
        let tmpUrlGab = null;

        let skipUpload = false;
        let uploadProva = true;
        let uploadGabarito = false;
        let targetSlug = null;
        let aiDataFromManifest = null;
        let remoteUrlProva = null;
        let remoteUrlGab = null;

        const timestampSlug = `manual-${Date.now()}`; // Temp slug for hash service channel

        // --- INDEPENDENT URL DOWNLOAD LOGIC ---
        let tmpUrlProvaLink = null;
        let tmpUrlGabLink = null;

        const linkProva = document
          .getElementById("sourceUrlProva")
          ?.value.trim();
        const linkGab = document
          .getElementById("sourceUrlGabarito")
          ?.value.trim();

        // 1. Prova Link Check
        if (linkProva) {
          progress.addLog(`Verificando link da prova: ${linkProva}...`);
          const blob = await downloadPdfFromUrl(linkProva, signal);
          if (blob) {
            progress.addLog(
              "Download via link com sucesso! Enviando para TmpFiles...",
            );
            try {
              tmpUrlProvaLink = await uploadToTmpFiles(
                blob,
                "prova_link_temp.pdf",
                signal,
              );
              console.log("[Manual] TmpUrl Prova (Link):", tmpUrlProvaLink);
              progress.addLog("✅ Link da prova processado.");
            } catch (err) {
              console.warn(
                "[Manual] Upload TmpFiles (Link Prova) Failed:",
                err,
              );
            }
          } else {
            progress.addLog(
              "⚠️ Não foi possível baixar (CORS/Erro). O fluxo segue.",
            );
          }
        }

        // 2. Gabarito Link Check
        if (linkGab) {
          progress.addLog(`Verificando link do gabarito...`);
          const blob = await downloadPdfFromUrl(linkGab, signal);
          if (blob) {
            progress.addLog(
              "Download via link com sucesso! Enviando para TmpFiles...",
            );
            try {
              tmpUrlGabLink = await uploadToTmpFiles(
                blob,
                "gabarito_link_temp.pdf",
                signal,
              );
              console.log("[Manual] TmpUrl Gabarito (Link):", tmpUrlGabLink);
              progress.addLog("✅ Link do gabarito processado.");
            } catch (err) {
              console.warn(
                "[Manual] Upload TmpFiles (Link Gabarito) Failed:",
                err,
              );
            }
          }
        }
        // --------------------------------------

        // A. Upload Prova to TmpFiles
        if (fileProva) {
          progress.setTarget(10, "Upload Temporário");
          progress.addLog("Enviando prova para servidor temporário...");
          tmpUrlProva = await uploadToTmpFiles(fileProva, null, signal);
          console.log("[Manual] TmpUrl Prova:", tmpUrlProva);
        }

        // B. Upload Gabarito to TmpFiles - REMOVIDO (gabarito não é mais suportado)
        // fileGabarito não existe mais

        // C. Request Hash from GitHub (via Worker Proxy) (PARALLEL EXECUTION)
        progress.setTarget(20, "Verificando Integridade");
        progress.addLog("Solicitando cálculo de hash seguro (GitHub)...");

        const WORKER_URL =
          "https://maia-api-worker.willian-campos-ismart.workers.dev";

        // Helper to request hash and wait for Pusher
        const getRemoteHash = async (url, tempSlug, label) => {
          // 1. Trigger
          console.log(`[Manual] Requesting Hash for ${label}...`);
          const response = await fetch(`${WORKER_URL}/compute-hash`, {
            method: "POST",
            body: JSON.stringify({ url, slug: tempSlug }),
            signal,
          });

          if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = errorText;
            try {
              const errorJson = JSON.parse(errorText);
              if (errorJson.error) errorMessage = errorJson.error;
            } catch (e) {}
            throw new Error(
              `Worker Error (${response.status}): ${errorMessage}`,
            );
          }

          // 2. Wait for Pusher
          return new Promise(async (resolve, reject) => {
            let PusherClass = window.Pusher;
            if (!PusherClass) {
              const module = await import("pusher-js");
              PusherClass = module.default;
            }
            const pusher = new PusherClass("6c9754ef715796096116", {
              cluster: "sa1",
            });
            const channel = pusher.subscribe(tempSlug);

            const timeout = setTimeout(() => {
              pusher.unsubscribe(tempSlug);
              reject(new Error(`Timeout waiting for hash (${label})`));
            }, 600000); // 10m timeout

            channel.bind("hash_computed", (data) => {
              // data = { hash, exists, found_slug }
              clearTimeout(timeout);
              channel.unbind_all();
              pusher.unsubscribe(tempSlug);
              resolve({ ...data, label });
            });
          });
        };

        // Prepare parallel tasks
        const hashTasks = [];

        // 1. Local Prova
        if (tmpUrlProva) {
          hashTasks.push({
            url: tmpUrlProva,
            suffix: "-prova",
            label: "Prova (Arquivo)",
            isLink: false,
            isProva: true,
          });
        }

        // 2. Local Gabarito
        if (tmpUrlGab) {
          hashTasks.push({
            url: tmpUrlGab,
            suffix: "-gab",
            label: "Gabarito (Arquivo)",
            isLink: false,
            isProva: false,
          });
        }

        // 3. Link Prova (Just for logs)
        if (tmpUrlProvaLink) {
          hashTasks.push({
            url: tmpUrlProvaLink,
            suffix: "-prova-link",
            label: "Prova (Link Externo)",
            isLink: true,
            isProva: true,
          });
        }

        // 4. Link Gabarito (Just for logs)
        if (tmpUrlGabLink) {
          hashTasks.push({
            url: tmpUrlGabLink,
            suffix: "-gab-link",
            label: "Gabarito (Link Externo)",
            isLink: true,
            isProva: false,
          });
        }

        if (hashTasks.length > 0) {
          progress.setTarget(25);
          progress.addLog(
            `Iniciando cálculo de hash para ${hashTasks.length} itens...`,
          );

          const promises = hashTasks.map((task) =>
            getRemoteHash(task.url, timestampSlug + task.suffix, task.label)
              .then((result) => ({ status: "fulfilled", result, task }))
              .catch((reason) => ({ status: "rejected", reason, task })),
          );

          const results = await Promise.all(promises);

          if (signal.aborted) {
            throw new Error("Cancelado pelo usuário");
          }

          for (const outcome of results) {
            const { task } = outcome;
            if (outcome.status === "fulfilled") {
              const data = outcome.result;
              console.log(`[Manual] Hash Success [${task.label}]:`, data);

              // EXTRACT HASH ROBUSTLY & LOG
              const validHash = data.hash || data.visual_hash;
              const displayHash = validHash
                ? validHash.substring(0, 15) + "..."
                : "(VAZIO/NULL)";
              progress.addLog(`Hash recebido [${task.label}]: ${displayHash}`);

              if (!task.isLink) {
                if (task.isProva) remoteHashProva = validHash;
                else remoteHashGab = validHash;
              } else {
                // CAPTURAR HASH DE LINK
                if (task.isProva) remoteHashProvaLink = validHash;
                else remoteHashGabLink = validHash;
              }
            }
          }
          progress.addLog("Cálculo de hashes finalizado.");

          // Was Integrity Check - Moved to after cloud check

          // --- ETAPA PRIMORDIAL: VERIFICAÇÃO DE EXISTÊNCIA NA NUVEM ---
          progress.setTarget(30, "Verificando Nuvem");
          progress.addLog("Buscando no banco de dados...");

          try {
            const WORKER_URL =
              "https://maia-api-worker.willian-campos-ismart.workers.dev";

            // Usar nome fornecido pelo usuário (Prioridade) ou nome do arquivo
            const queryForSlug = userTitle
              ? userTitle
              : fileProva
                ? fileProva.name.replace(".pdf", "")
                : AUTO_TITLE;

            // NOVO: Usa /trigger-deep-search em modo PREFLIGHT
            // Isso faz busca Pinecone direta e só usa IA se não encontrar match forte
            const preflightRes = await fetch(
              `${WORKER_URL}/trigger-deep-search`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  query: queryForSlug,
                  confirm: false, // Modo preflight - só busca, não dispara action
                }),
                signal,
              },
            );

            const preflightData = await preflightRes.json();
            const predictedSlug = preflightData.canonical_slug;

            console.log("[Manual] Preflight result:", preflightData);

            if (predictedSlug) {
              targetSlug = predictedSlug;

              // 2. Verificar Manifesto Existente
              const manifestUrl = `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/output/${predictedSlug}/manifest.json`;
              const manifestRes = await fetch(manifestUrl, { signal });

              if (manifestRes.ok) {
                const manifest = await manifestRes.json();
                const manifestItems = Array.isArray(manifest)
                  ? manifest
                  : manifest.results || manifest.files || [];

                console.log(
                  "[Manual] Manifesto encontrado. Comparando hashes...",
                  manifestItems,
                );
                progress.addLog(
                  `Pasta '${predictedSlug}' encontrada. Comparando arquivos...`,
                );

                // Helper de busca no manifesto
                const findInManifest = (hash, typeFilter) => {
                  if (!hash || hash === "null" || hash === "undefined") return null;
                  return manifestItems.find((item) => {
                    const itemHash = item.visual_hash || item.hash;
                    if (!itemHash || itemHash === "null" || itemHash === "undefined") return false;
                    // Verifica hash visual
                    if (itemHash === hash) return true;
                    return false;
                  });
                };

                const matchProva = remoteHashProva
                  ? findInManifest(remoteHashProva, "prova")
                  : null;
                const matchGab = remoteHashGab
                  ? findInManifest(remoteHashGab, "gabarito")
                  : null;

                // Lógica de Decisão (Tabela de Verdade)
                // Prova Existente? | Gabarito Existente? | Ação
                // -----------------|---------------------|-------
                // SIM              | SIM (ou N/A)        | Skip Tudo (Upload = false)
                // SIM              | NÃO (e user enviou) | Upload SÓ Gabarito
                // NÃO              | SIM                 | Upload SÓ Prova
                // NÃO              | NÃO                 | Upload Tudo (Padrão)

                const gabaritoEnviadoPeloUser = !!tmpUrlGab; // Usa tmpUrlGab como indicador

                if (matchProva) {
                  console.log(
                    "[Manual] SKIPPING PROVA UPLOAD: Hash checked and found in cloud.",
                    matchProva,
                  );
                  progress.addLog(
                    "✅ Prova já existe na nuvem (Hash idêntico).",
                  );
                  uploadProva = false;
                  // [FIX] Priorizar link_origem (URL oficial) sobre url (HuggingFace)
                  remoteUrlProva = matchProva.link_origem || matchProva.url;
                  // [NEW] Persistir link para envio ao Firebase
                  window.__pdfOriginalUrl = remoteUrlProva;
                } else {
                  progress.addLog("⚠️ Prova é nova e será enviada.");
                }

                if (gabaritoEnviadoPeloUser) {
                  if (matchGab) {
                    console.log(
                      "[Manual] SKIPPING GABARITO UPLOAD: Hash checked and found in cloud.",
                      matchGab,
                    );
                    progress.addLog("✅ Gabarito já existe na nuvem.");
                    uploadGabarito = false;
                    remoteUrlGab = matchGab.url;
                  } else {
                    progress.addLog("⚠️ Gabarito é novo e será enviado.");
                  }
                } else {
                  uploadGabarito = false; // Não tem o que enviar
                }

                // Configurar AI Data do manifesto para o viewer
                // Tenta pegar do primeiro item ou da raiz
                const firstItem = matchProva || matchGab || manifestItems[0];
                if (firstItem) {
                  aiDataFromManifest = {
                    institution: firstItem.instituicao || firstItem.institution,
                    year: firstItem.ano || firstItem.year,
                    formatted_title_general:
                      firstItem.nome ||
                      firstItem.friendly_name ||
                      firstItem.name,
                    // Captura source_url_prova para sistema de imagens via PDF
                    source_url_prova:
                      firstItem.source_url_prova ||
                      manifestItems.find((i) => i.source_url_prova)
                        ?.source_url_prova ||
                      null,
                  };
                }
              } else {
                console.log(
                  "[Manual] Manifesto não encontrado (404). Upload completo necessário.",
                );
              }
            }
          } catch (eChecks) {
            console.warn("[Manual] Erro nas verificações pré-upload:", eChecks);
            // Em caso de erro cheque, prossegue com upload completo por segurança
          }

          // [NEW] Garantir que o link fornecido manualmente seja salvo se não houver match na nuvem
          if (!window.__pdfOriginalUrl && linkProva) {
            window.__pdfOriginalUrl = linkProva;
          }

          // --- REORDERED: INTEGRITY CHECK AFTER CLOUD CHECK ---
          if (uploadProva || uploadGabarito) {
            progress.addLog("Verificando consistência de origem (Links)...");

            // PROVA
            // PROVA
            if (uploadProva) {
              if (!tmpUrlProvaLink) {
                progress.addLog(
                  "ℹ️ Modo Manual (Sem Link): Hash de integridade não verificado.",
                  false,
                );
                // Permite upload sem link
              } else if (remoteHashProva && remoteHashProvaLink) {
                if (remoteHashProva !== remoteHashProvaLink) {
                  progress.addLog(
                    "❌ BLOQUEIO (Prova): Hash do arquivo difere do Link.",
                    true,
                  );
                  uploadProva = false;
                } else {
                  progress.addLog(
                    "✅ Prova validada (Hash Link == Hash Arquivo).",
                  );
                }
              } else {
                if (!remoteHashProvaLink) {
                  // Se tem link mas não processou, avisa mas não bloqueia necessariamente se for falha de download
                  // Mas aqui assumimos que se o user botou link, ele quer validar.
                  // Mantendo log de aviso.
                  progress.addLog(
                    "⚠️ Link da prova não processado. Prosseguindo com upload manual.",
                  );
                }
              }
            }

            // GABARITO
            if (uploadGabarito) {
              if (!tmpUrlGabLink) {
                progress.addLog(
                  "⚠️ Upload nuvem cancelado para Gabarito: Link obrigatório ausente.",
                  true,
                );
                uploadGabarito = false;
              } else if (remoteHashGab && remoteHashGabLink) {
                if (remoteHashGab !== remoteHashGabLink) {
                  progress.addLog(
                    "❌ BLOQUEIO (Gabarito): Hash do arquivo difere do Link.",
                    true,
                  );
                  uploadGabarito = false;
                } else {
                  progress.addLog(
                    "✅ Gabarito validado (Hash Link == Hash Arquivo).",
                  );
                }
              } else {
                if (!remoteHashGabLink) {
                  progress.addLog(
                    "⚠️ Link do gabarito não processado. Cancelando upload.",
                  );
                  uploadGabarito = false;
                }
              }
            }
          }
          // ----------------------------------------------------

          // --- COPYRIGHT CHECK (GEMINI) ---
          const checkCopyright = async (file, typeLabel) => {
            if (!file) return true; // Skip if no file
            progress.addLog(`Verificando direitos autorais (${typeLabel})...`);

            try {
              // 1. Convert to Base64
              const toBase64 = (f) =>
                new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.readAsDataURL(f);
                  reader.onload = () => resolve(reader.result); // Includes data: prefix
                  reader.onerror = (error) => reject(error);
                });

              const base64Data = await toBase64(file);

              const prompt = `Analise este arquivo PDF. Verifique se ele é um material didático PRIVADO protegidos por direitos autorais estritos (ex: Apostilas Poliedro, Bernoulli, SAS, Anglo, materiais exclusivos de cursinhos pagos). 
                     Provas oficiais de vestibulares (ENEM, FUVEST, UNICAMP, ITA, IME) e gabaritos oficiais SÃO PERMITIDOS e devem retornar false.
                     Responda estritamente em JSON: { "protected": boolean, "reason": "string curta", "confidence": number }`;

              const WORKER_GEN_URL =
                "https://maia-api-worker.willian-campos-ismart.workers.dev/generate";

              const response = await fetch(WORKER_GEN_URL, {
                method: "POST",
                body: JSON.stringify({
                  texto: prompt,
                  model: "models/gemma-4-31b-it", // Use Gemma for verification
                  schema: {
                    type: "object",
                    properties: {
                      protected: { type: "boolean" },
                      reason: { type: "string" },
                      confidence: { type: "number" },
                    },
                    required: ["protected", "reason"],
                  },
                  files: [base64Data], // Send file
                }),
                signal,
              });

              if (!response.ok)
                throw new Error("Erro na verificação de copyright.");

              // Helper to read NDJSON stream or JSON
              // Worker /generate returns NDJSON stream usually, but sometimes simple JSON if short?
              // Wait, /generate logic in index.js returns NDJSON stream. We need to parse it.
              // ACTUALLY, checking index.js, /generate returns NDJSON.

              const reader = response.body.getReader();
              const decoder = new TextDecoder();
              let finalResult = null;

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split("\n");
                for (const line of lines) {
                  if (!line.trim()) continue;
                  try {
                    const msg = JSON.parse(line);
                    if (msg.type === "answer" && msg.text) {
                      // It might be streaming partial text, so we accumulate?
                      // The Worker /generate streams parts. We need to accumulate text and then parse JSON.
                      // OR, since we passed a schema, Gemini might output the JSON structure directly.
                      // BUT `msg.text` will be parts of the JSON string.
                      if (!finalResult) finalResult = "";
                      finalResult += msg.text;
                    }
                  } catch (e) {}
                }
              }

              if (finalResult) {
                try {
                  const json = JSON.parse(finalResult);
                  if (json.protected) {
                    progress.addLog(
                      `❌ BLOQUEIO COPYRIGHT (${typeLabel}): ${json.reason}`,
                      true,
                    );
                    return false; // BLOCKED
                  }
                  progress.addLog(`✅ Copyright OK (${typeLabel}).`);
                  return true; // OK
                } catch (e) {
                  console.warn("Manual Copyright Valid Parse Error", e);
                  return true; // Fail open if invalid response
                }
              }
              return true; // Fail open
            } catch (e) {
              console.error("Copyright Check Error:", e);
              progress.addLog(
                `⚠️ Erro ao verificar copyright: ${e.message}. Permitindo...`,
              );
              return true; // Fail open
            }
          };

          if (uploadProva) {
            const allowed = await checkCopyright(fileProva, "Prova");
            if (!allowed) uploadProva = false;
          }
          if (uploadGabarito) {
            const allowed = await checkCopyright(fileGabarito, "Gabarito");
            if (!allowed) uploadGabarito = false;
          }

          // ----------------------------------------------------

          // --- PREPARAÇÃO FINAL ---
          skipUpload = !uploadProva && !uploadGabarito;

          if (skipUpload) {
            console.log(
              "[Manual] ALL FILES EXIST IN CLOUD. Skipping upload flow completely.",
            );
            progress.setTarget(100, "Concluído");
            progress.addLog(
              "Todos os arquivos já existem. Abrindo visualizador local...",
            );

            setTimeout(() => {
              progress.close();

              // Capturar source_url_prova do manifesto existente se disponível
              const manifestProvaUrl =
                aiDataFromManifest?.source_url_prova || linkProva || null;
              if (manifestProvaUrl) {
                window.__pdfOriginalUrl = manifestProvaUrl;
                window.__pdfDownloadUrl = manifestProvaUrl;
              }

              // ABRIR VIEWER LOCAL (gabarito não é mais suportado)
              gerarVisualizadorPDF({
                title:
                  aiDataFromManifest?.formatted_title_general ||
                  userTitle ||
                  fileProva.name,
                rawTitle:
                  aiDataFromManifest?.formatted_title_general ||
                  userTitle ||
                  fileProva.name,
                fileProva: remoteUrlProva || URL.createObjectURL(fileProva),
                fileGabarito: null, // Gabarito não é mais suportado
                gabaritoNaProva: false,
                isManualLocal: true, // Força modo local
                slug: targetSlug || "local-preview",
                originalPdfUrl:
                  remoteUrlProva || linkProva || aiDataFromManifest?.source_url_prova || null,
              });
            }, 1000);
            return; // FIM DO PROCESSO
          }
        }
        console.log("[Manual] Prepare to upload...", {
          uploadProva,
          uploadGabarito,
        });

        // Source URLs captured from DOM
        const srcProvaVal =
          document.getElementById("sourceUrlProva")?.value.trim() || "";
        const srcGabVal =
          document.getElementById("sourceUrlGabarito")?.value.trim() || "";

        // --- NEW NAMING LOGIC START ---
        // --- NEW NAMING LOGIC START ---
        const getSafeName = (fileInputName, type, fallbackTitle) => {
          const forbidden = [
            "prova.pdf",
            "gabarito.pdf",
            "nenhum arquivo selecionado",
            "",
          ];

          // 1. Try to get from UI display element if available
          let uiName = "";
          if (type === "prova") {
            const el = document.getElementById("fileName");
            if (el) uiName = el.textContent.trim();
          } else if (type === "gabarito") {
            const el = document.getElementById("gabaritoFileName");
            if (el) uiName = el.textContent.trim();
          }

          // Check if UI name is valid and NOT forbidden
          if (uiName && !forbidden.includes(uiName.toLowerCase())) {
            return uiName;
          }

          // 2. If generic or missing, use Slugified Title
          const slug = fallbackTitle
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Remove accents
            .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanum with dash
            .replace(/^-+|-+$/g, ""); // Trim dashes

          const suffix = type === "gabarito" ? "-gabarito.pdf" : ".pdf";
          return slug + suffix;
        };

        const finalNameProva = getSafeName(fileProva.name, "prova", AUTO_TITLE);

        let finalNameGab = null;
        if (fileGabarito) {
          finalNameGab = getSafeName(fileGabarito.name, "gabarito", AUTO_TITLE);
        }
        // --- NEW NAMING LOGIC END ---

        const formData = new FormData();
        formData.append("title", AUTO_TITLE);
        if (targetSlug) formData.append("slug_codinome", targetSlug); // Enviar slug se já soubermos

        if (srcProvaVal) formData.append("source_url_prova", srcProvaVal);
        if (srcGabVal) formData.append("source_url_gabarito", srcGabVal);

        // CONDITIONAL APPEND based on Checks
        if (uploadProva) {
          formData.append("fileProva", fileProva, finalNameProva);
          formData.append("pdf_custom_name", finalNameProva);
          if (tmpUrlProva) formData.append("pdf_url_override", tmpUrlProva);

          const hashP = remoteHashProva || remoteHashProvaLink;
          if (hashP) {
            formData.append("visual_hash", hashP);
            progress.addLog(
              `Anexando visual_hash (Prova): ${hashP.substring(0, 10)}...`,
            );
          } else {
            progress.addLog(`⚠️ visual_hash (Prova) está vazio!`);
          }
        } else {
          console.log("[Manual] Pulando upload da Prova (já existe).");
        }

        if (uploadGabarito) {
          // Relaxed check to allow Link-only Gabarito
          if (fileGabarito && finalNameGab) {
            formData.append("fileGabarito", fileGabarito, finalNameGab);
            formData.append("gabarito_custom_name", finalNameGab);
          }
          if (tmpUrlGab) formData.append("gabarito_url_override", tmpUrlGab);

          const hashG = remoteHashGab || remoteHashGabLink;
          if (hashG) {
            formData.append("visual_hash_gabarito", hashG);
            progress.addLog(
              `Anexando visual_hash (Gabarito): ${hashG.substring(0, 10)}...`,
            );
          }
        } else if (!uploadGabarito && fileGabarito) {
          console.log("[Manual] Pulando upload do Gabarito (já existe).");
        }

        // DEBUG LOGS (Moved to end)
        console.log("[Manual] --- FORM DATA PREVIEW ---");
        try {
          for (let [key, value] of formData.entries()) {
            if (value instanceof File)
              console.log(`[Manual] Key: ${key} -> File: ${value.name}`);
            else console.log(`[Manual] Key: ${key} -> Value: "${value}"`);
          }
        } catch (e) {}

        console.log("[Manual] FormData prepared. Dispatching to Worker...");
        progress.setTarget(40, "Processamento AI");
        progress.addLog("Enviando arquivos novos para a nuvem...");

        const WORKER_URL_UPLOAD =
          "https://maia-api-worker.willian-campos-ismart.workers.dev";

        const res = await fetch(`${WORKER_URL_UPLOAD}/manual-upload`, {
          method: "POST",
          body: formData,
          signal,
        });
        const data = await res.json();
        console.log("[Manual] Worker Response:", data);

        // --- BYPASS DE CONFLITO PARA VIEWER LOCAL ---
        // Se der conflito ou sucesso, para o usuário o importante é abrir o arquivo que ele tem na mão.
        // A nuvem que se vire para resolver (ou o worker já resolveu).

        progress.addLog("Processamento inicial concluído!");

        if (data.status === "conflict") {
          progress.addLog(
            "⚠️ Aviso: Arquivos similares detectados no servidor.",
          );
          // Não incomodamos o usuário com modal de conflito aqui, pois a regra é:
          // "Só cancela, não usa mais o arquivo da nuvem nem nada, porque agora vai abrir SOMENTE com os arquivos locais"
        }

        const finalSlug = data.slug || targetSlug || "temp-slug";

        // Se enviamos arquivos, podemos esperar uma confirmação via Pusher se quisermos ser chiques,
        // mas para "abrir somente local", podemos ser imediatos se o worker já retornou OK.
        // O worker retorna rápido? Geralmente sim, a parte demorada é o deep search (que não é esse endpoint).
        // Esse endpoint manual-upload dispara o processamento async.

        // Se enviamos apenas PROVA ou apenas GABARITO, o ideal seria esperar o processamento desse item?
        // O user disse: "espera o gabarito fazer o que tem que fazer e abre entendeu?"

        if (uploadProva || uploadGabarito) {
          progress.addLog(
            "Aguardando confirmação de processamento (Sync)...",
            true,
          );

          // Usar a mesma lógica de polling/pusher mas APENAS para saber quando terminar,
          // NÃO para pegar URL.

          // Reutilizar startPolling mas modificar para NÃO abrir com URL remota
          // Precisamos esperar o evento 'Cloud sync complete' ou similar.

          await new Promise(async (resolve, reject) => {
            if (signal.aborted)
              return reject(new DOMException("Aborted", "AbortError"));

            let PusherClass = window.Pusher;
            if (!PusherClass) {
              const module = await import("pusher-js");
              PusherClass = module.default;
            }
            const pusher = new PusherClass("6c9754ef715796096116", {
              cluster: "sa1",
            });
            const channel = pusher.subscribe(finalSlug);

            // Handle Abort
            const onAbort = () => {
              if (pusher) {
                try {
                  pusher.unsubscribe(finalSlug);
                  // channel.unbind_all() is handled by garbage collection or explicit close,
                  // but good practice to unbind if we keep the instance.
                  // However, for immediate cancel:
                  pusher.disconnect();
                } catch (e) {}
              }
              reject(
                new DOMException("Upload Cancelled by User", "AbortError"),
              );
            };
            signal.addEventListener("abort", onAbort);

            let done = false;
            const safeResolve = () => {
              if (!done) {
                done = true;
                signal.removeEventListener("abort", onAbort);
                channel.unbind_all();
                pusher.unsubscribe(finalSlug);
                resolve();
              }
            };

            // Timeout de segurança (se o worker for rápido demais e perdermos o ev, ou demorar)
            setTimeout(() => {
              if (signal.aborted) return;
              progress.addLog(
                "⚠️ Tempo limite de sync atingido. Abrindo assim mesmo...",
              );
              safeResolve();
            }, 15000); // 15s max wait

            channel.bind("log", (d) => {
              if (signal.aborted) return;
              const msg = d.message || "";
              console.log(`[Pusher Sync] ${msg}`);
              if (
                msg.includes("Cloud sync complete") ||
                msg.includes("Processamento concluído")
              ) {
                progress.addLog("✅ Sincronização confirmada!");
                safeResolve();
              }
            });
          });
        }

        progress.setTarget(100, "Abrindo");
        setTimeout(() => {
          progress.close();
          gerarVisualizadorPDF({
            title:
              data.ai_data?.formatted_title_general ||
              aiDataFromManifest?.formatted_title_general ||
              userTitle ||
              fileProva.name,
            rawTitle:
              data.ai_data?.formatted_title_general ||
              aiDataFromManifest?.formatted_title_general ||
              userTitle ||
              fileProva.name,
            fileProva: URL.createObjectURL(fileProva), // SEMPRE LOCAL
            fileGabarito: fileGabarito
              ? URL.createObjectURL(fileGabarito)
              : null, // SEMPRE LOCAL
            gabaritoNaProva: false,
            isManualLocal: true,
            slug: finalSlug,
            originalPdfUrl:
              remoteUrlProva || linkProva || data.hf_url_preview || aiDataFromManifest?.source_url_prova || null, // Garante que o contexto receba a URL oficial
          });
        }, 800);

        return;
      } catch (e) {
        if (progress && progress.close) progress.close();

        // Check if it's a user cancellation
        const isAbort =
          e.name === "AbortError" ||
          (e.message &&
            (e.message.includes("AbortError") ||
              e.message.includes("Cancelado"))) ||
          signal.aborted;

        if (isAbort) {
          console.log("[Manual] Upload cancelled by user. Stopping sequence.");
          return; // STOP HERE
        } else {
          console.error("[Manual] Error triggering upload:", e);
          customAlert(
            "Erro na sincronização: " +
              e.message +
              "\nAbrindo modo visualização local.",
          );
        }

        // Ensure viewer opens ONLY on error (fallback), NOT on cancel
        setTimeout(() => {
          gerarVisualizadorPDF({
            title: userTitle || fileProva.name || AUTO_TITLE,
            rawTitle: userTitle || fileProva.name,
            fileProva: fileProva ? URL.createObjectURL(fileProva) : null,
            gabaritoNaProva: false,
            isManualLocal: true,
            slug: "local-" + "error" + "-" + Date.now(),
            originalPdfUrl: linkProva || null,
          });
        }, 500);
      }
    }; // End executeUploadSequence

    // --- MODAL ORCHESTRATION START ---

    const srcP = document.getElementById("sourceUrlProva")?.value.trim();
    const srcG = document.getElementById("sourceUrlGabarito")?.value.trim();
    const hasAnyLink = !!srcP || !!srcG;

    // Helper to show Processing/Safety Modal
    const showProcessingConfirmation = () => {
      const modal = document.getElementById("processingConfirmModal");
      const checkboxContainer = document.getElementById(
        "copyrightCheckContainer",
      );
      const checkbox = document.getElementById("checkCopyrightPublic");
      const btnStart = document.getElementById("btnStartProcessing");
      const btnCancel = document.getElementById("btnCancelProcessing");
      const warningText = document.getElementById("copyrightWarningText");

      if (!modal) {
        executeUploadSequence(); // Fallback if modal missing
        return;
      }

      modal.style.display = "flex";

      // Reset State
      if (checkbox) checkbox.checked = false;

      // Conditional Logic
      if (hasAnyLink) {
        checkboxContainer.style.display = "flex";
        btnStart.disabled = true;
        btnStart.style.opacity = "0.5";
        btnStart.style.cursor = "not-allowed";

        if (warningText) warningText.style.display = "none"; // Checkbox acts as warning
      } else {
        checkboxContainer.style.display = "none";
        btnStart.disabled = false;
        btnStart.style.opacity = "1";
        btnStart.style.cursor = "pointer";

        if (warningText) warningText.style.display = "block";
      }

      // Checkbox Listener
      if (checkbox) {
        // Clone to remove old listeners
        const newCheckbox = checkbox.cloneNode(true);
        checkbox.parentNode.replaceChild(newCheckbox, checkbox);

        newCheckbox.addEventListener("change", (e) => {
          if (e.target.checked) {
            btnStart.disabled = false;
            btnStart.style.opacity = "1";
            btnStart.style.cursor = "pointer";
          } else {
            btnStart.disabled = true;
            btnStart.style.opacity = "0.5";
            btnStart.style.cursor = "not-allowed";
          }
        });
      }

      // Button Listeners (One-off)
      btnCancel.onclick = () => {
        modal.style.display = "none";
      };

      btnStart.onclick = () => {
        modal.style.display = "none";
        executeUploadSequence();
      };
    };

    // Step 1: Privacy/Missing Link Check
    if (!hasAnyLink) {
      const privacyModal = document.getElementById("privacyConfirmModal");
      if (privacyModal) {
        privacyModal.style.display = "flex";

        const bBack = document.getElementById("btnCancelUpload");
        const bContinue = document.getElementById("btnConfirmUpload");

        // Clean previous listeners
        const newBack = bBack.cloneNode(true);
        bBack.parentNode.replaceChild(newBack, bBack);

        const newContinue = bContinue.cloneNode(true);
        bContinue.parentNode.replaceChild(newContinue, bContinue);

        newBack.textContent = "Voltar"; // Ensure correct text
        newBack.onclick = () => {
          privacyModal.style.display = "none";
        };

        newContinue.onclick = () => {
          privacyModal.style.display = "none";
          // Proceed to Step 2
          showProcessingConfirmation();
        };
        return; // Wait for user interaction
      }
    }

    // Step 2: Immediate Processing Confirmation (if links present or Step 1 passed)
    showProcessingConfirmation();

    // executeUploadSequence(); // Only called by modals now
  });
}
