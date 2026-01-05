import { gerarVisualizadorPDF } from "../viewer/events.js";

/**
 * Helper: Upload to TmpFiles.org
 */
async function uploadToTmpFiles(file, customName = null) {
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
    console.error("TmpFiles Upload Error:", e);
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
async function downloadPdfFromUrl(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const blob = await res.blob();
    return blob;
  } catch (e) {
    console.warn("[Manual] Failed to download PDF from URL:", url, e);
    return null;
  }
}

export function setupFormLogic(elements, initialData) {
  const {
    yearInput,
    gabaritoCheck,
    gabaritoGroup,
    gabaritoInput,
    form,
    pdfInput,
  } = elements;

  // Title is now auto-detected, so we don't need the input binding.
  // We will send a placeholder "Auto-Detect" to satisfy backend requirements until refined.
  const AUTO_TITLE = "Auto-Detect";

  // A. Lógica de Checkbox (Esconder/Mostrar Gabarito)
  const toggleGabarito = () => {
    if (gabaritoCheck.checked) {
      gabaritoGroup.style.display = "none";
      gabaritoInput.value = "";
      gabaritoInput.required = false;
    } else {
      gabaritoGroup.style.display = "block";
      gabaritoInput.required = true;
    }
  };
  gabaritoCheck.addEventListener("change", toggleGabarito);

  // B. Preenchimento de Dados Iniciais (Se houver)
  if (initialData) {
    // titleInput removed
    gabaritoCheck.checked = initialData.gabaritoNaProva;
    toggleGabarito(); // Aplica o estado visual

    const fileNameDisplay = document.getElementById("fileName");
    fileNameDisplay.textContent =
      "⚠️ Por favor, selecione o arquivo novamente.";
    fileNameDisplay.style.color = "var(--color-warning)";
  }

  // C. Submit do Formulário
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fileProva = pdfInput.files[0];
    const fileGabarito = gabaritoInput.files[0];

    if (!fileProva) {
      alert("Selecione a prova.");
      return;
    }

    // Wrapped Upload Logic
    const executeUploadSequence = async () => {
      // 1. CLOUD-FIRST FLOW: Show Progress & Upload
      console.log("[Manual] Starting Cloud-First Upload Flow...");

      // Create/Show Progress Modal
      // Create/Show Progress Modal
      const showProgressModal = (initialStatus) => {
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
                <p style="margin:0; color:var(--color-text-secondary); font-size:0.9rem;">Tempo estimado: ~4 min (Cloud Sync)</p>
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
                background: #1e1e1e; 
                border-radius:8px; 
                padding:15px; 
                height:160px; 
                overflow-y:auto; 
                font-family: 'Fira Code', monospace; 
                font-size:0.75rem; 
                color:#d4d4d4; 
                border:1px solid rgba(255,255,255,0.1);
                display:flex; 
                flex-direction:column; 
                gap:4px;
                scroll-behavior: smooth;
            ">
                <div style="color:#6a9955;">// Log de processamento em tempo real</div>
                <div class="log-line">> ${initialStatus}</div>
            </div>

        </div>
      `;

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
          line.style.color = isSystem ? "#569cd6" : "#d4d4d4";
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

      const progress = showProgressModal(
        "Calculando identidade visual do arquivo..."
      );

      // Helper to Open Viewer (Reusable)
      const openViewer = (hfUrl, slug, aiData, hfUrlGabarito) => {
        const WORKER_URL =
          "https://maia-api-worker.willian-campos-ismart.workers.dev";
        const proxyUrl = `${WORKER_URL}/proxy-pdf?url=${encodeURIComponent(hfUrl)}`;

        let proxyGabUrl = null;
        if (hfUrlGabarito) {
          proxyGabUrl = `${WORKER_URL}/proxy-pdf?url=${encodeURIComponent(hfUrlGabarito)}`;
        }

        gerarVisualizadorPDF({
          title:
            aiData?.formatted_title_general ||
            (aiData?.institution
              ? `${aiData.institution} ${aiData.year || ""}`
              : "Processando..."),
          rawTitle: aiData?.formatted_title_general || "Documento",
          fileProva: proxyUrl,
          fileGabarito: proxyGabUrl || aiData?.gabarito_url || fileGabarito,
          gabaritoNaProva: gabaritoCheck.checked,
          isManualLocal: false,
          slug: slug,
        });
      };

      // Reusable Polling Function (Moved Up)
      // Reusable Pusher Listener
      const startPollingAndOpenViewer = async (
        hfUrl,
        slug,
        aiData,
        hfUrlGabarito
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
            alert("Erro ao carregar sistema de notificação em tempo real.");
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
              true
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
              true
            );

            // Unsubscribe & Disconnect
            channel.unbind_all();
            pusher.unsubscribe(slug);

            setTimeout(() => {
              try {
                const modalEl = document.getElementById(
                  "upload-progress-modal"
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
        let uploadGabarito = true;
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
          const blob = await downloadPdfFromUrl(linkProva);
          if (blob) {
            progress.addLog(
              "Download via link com sucesso! Enviando para TmpFiles..."
            );
            try {
              tmpUrlProvaLink = await uploadToTmpFiles(
                blob,
                "prova_link_temp.pdf"
              );
              console.log("[Manual] TmpUrl Prova (Link):", tmpUrlProvaLink);
              progress.addLog("✅ Link da prova processado.");
            } catch (err) {
              console.warn(
                "[Manual] Upload TmpFiles (Link Prova) Failed:",
                err
              );
            }
          } else {
            progress.addLog(
              "⚠️ Não foi possível baixar (CORS/Erro). O fluxo segue."
            );
          }
        }

        // 2. Gabarito Link Check
        if (linkGab) {
          progress.addLog(`Verificando link do gabarito...`);
          const blob = await downloadPdfFromUrl(linkGab);
          if (blob) {
            progress.addLog(
              "Download via link com sucesso! Enviando para TmpFiles..."
            );
            try {
              tmpUrlGabLink = await uploadToTmpFiles(
                blob,
                "gabarito_link_temp.pdf"
              );
              console.log("[Manual] TmpUrl Gabarito (Link):", tmpUrlGabLink);
              progress.addLog("✅ Link do gabarito processado.");
            } catch (err) {
              console.warn(
                "[Manual] Upload TmpFiles (Link Gabarito) Failed:",
                err
              );
            }
          }
        }
        // --------------------------------------

        // A. Upload Prova to TmpFiles
        if (fileProva) {
          progress.setTarget(10, "Upload Temporário");
          progress.addLog("Enviando prova para servidor temporário...");
          tmpUrlProva = await uploadToTmpFiles(fileProva);
          console.log("[Manual] TmpUrl Prova:", tmpUrlProva);
        }

        // B. Upload Gabarito to TmpFiles
        if (fileGabarito) {
          progress.setTarget(15);
          progress.addLog("Enviando gabarito para servidor temporário...");
          tmpUrlGab = await uploadToTmpFiles(fileGabarito);
          console.log("[Manual] TmpUrl Gabarito:", tmpUrlGab);
        }

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
          });

          if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = errorText;
            try {
              const errorJson = JSON.parse(errorText);
              if (errorJson.error) errorMessage = errorJson.error;
            } catch (e) {}
            throw new Error(
              `Worker Error (${response.status}): ${errorMessage}`
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
            `Iniciando cálculo de hash para ${hashTasks.length} itens...`
          );

          const promises = hashTasks.map((task) =>
            getRemoteHash(task.url, timestampSlug + task.suffix, task.label)
              .then((result) => ({ status: "fulfilled", result, task }))
              .catch((reason) => ({ status: "rejected", reason, task }))
          );

          const results = await Promise.all(promises);

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
          progress.addLog("Verificando existência prévia na nuvem...");

          try {
            // 1. Obter Slug Previsto (Preflight)
            const WORKER_URL =
              "https://maia-api-worker.willian-campos-ismart.workers.dev";

            // Usar nome do arquivo ou título para gerar slug
            const queryForSlug = fileProva
              ? fileProva.name.replace(".pdf", "")
              : AUTO_TITLE;

            // [FIX] Usar endpoint dedicado sugerido pelo user
            const slugRes = await fetch(`${WORKER_URL}/canonical-slug`, {
              method: "POST",
              body: JSON.stringify({ query: queryForSlug }),
            });

            const slugData = await slugRes.json();
            const predictedSlug = slugData.slug;

            if (predictedSlug) {
              targetSlug = predictedSlug;
              console.log(`[Manual] Slug Previsto: ${predictedSlug}`);

              // 2. Verificar Manifesto Existente
              const manifestUrl = `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/output/${predictedSlug}/manifest.json`;
              const manifestRes = await fetch(manifestUrl);

              if (manifestRes.ok) {
                const manifest = await manifestRes.json();
                const manifestItems = Array.isArray(manifest)
                  ? manifest
                  : manifest.results || manifest.files || [];

                console.log(
                  "[Manual] Manifesto encontrado. Comparando hashes...",
                  manifestItems
                );
                progress.addLog(
                  `Pasta '${predictedSlug}' encontrada. Comparando arquivos...`
                );

                // Helper de busca no manifesto
                const findInManifest = (hash, typeFilter) => {
                  if (!hash) return null;
                  return manifestItems.find((item) => {
                    // Verifica hash visual
                    if (item.visual_hash === hash) return true;
                    // Verifica nome do arquivo (fallback fraco, mas útil)
                    // if (item.filename === ...) return true;
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

                const gabaritoEnviadoPeloUser = !!fileGabarito;

                if (matchProva) {
                  console.log(
                    "[Manual] SKIPPING PROVA UPLOAD: Hash checked and found in cloud.",
                    matchProva
                  );
                  progress.addLog(
                    "✅ Prova já existe na nuvem (Hash idêntico)."
                  );
                  uploadProva = false;
                  remoteUrlProva = matchProva.url; // Só para referência, não usado no viewer
                } else {
                  progress.addLog("⚠️ Prova é nova e será enviada.");
                }

                if (gabaritoEnviadoPeloUser) {
                  if (matchGab) {
                    console.log(
                      "[Manual] SKIPPING GABARITO UPLOAD: Hash checked and found in cloud.",
                      matchGab
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
                      firstItem.friendly_name || firstItem.name,
                  };
                }
              } else {
                console.log(
                  "[Manual] Manifesto não encontrado (404). Upload completo necessário."
                );
              }
            }
          } catch (eChecks) {
            console.warn("[Manual] Erro nas verificações pré-upload:", eChecks);
            // Em caso de erro cheque, prossegue com upload completo por segurança
          }

          // --- REORDERED: INTEGRITY CHECK AFTER CLOUD CHECK ---
          if (uploadProva || uploadGabarito) {
            progress.addLog("Verificando consistência de origem (Links)...");

            // PROVA
            if (uploadProva) {
              if (!tmpUrlProvaLink) {
                progress.addLog(
                  "⚠️ Upload nuvem cancelado para Prova: Link obrigatório ausente.",
                  true
                );
                uploadProva = false;
              } else if (remoteHashProva && remoteHashProvaLink) {
                if (remoteHashProva !== remoteHashProvaLink) {
                  progress.addLog(
                    "❌ BLOQUEIO (Prova): Hash do arquivo difere do Link.",
                    true
                  );
                  uploadProva = false;
                } else {
                  progress.addLog(
                    "✅ Prova validada (Hash Link == Hash Arquivo)."
                  );
                }
              } else {
                if (!remoteHashProvaLink) {
                  progress.addLog(
                    "⚠️ Link da prova não processado corretamente. Cancelando upload."
                  );
                  uploadProva = false;
                }
              }
            }

            // GABARITO
            if (uploadGabarito) {
              if (!tmpUrlGabLink) {
                progress.addLog(
                  "⚠️ Upload nuvem cancelado para Gabarito: Link obrigatório ausente.",
                  true
                );
                uploadGabarito = false;
              } else if (remoteHashGab && remoteHashGabLink) {
                if (remoteHashGab !== remoteHashGabLink) {
                  progress.addLog(
                    "❌ BLOQUEIO (Gabarito): Hash do arquivo difere do Link.",
                    true
                  );
                  uploadGabarito = false;
                } else {
                  progress.addLog(
                    "✅ Gabarito validado (Hash Link == Hash Arquivo)."
                  );
                }
              } else {
                if (!remoteHashGabLink) {
                  progress.addLog(
                    "⚠️ Link do gabarito não processado. Cancelando upload."
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
                  model: "models/gemini-flash-latest", // Fast model
                  schema: {
                    type: "OBJECT",
                    properties: {
                      protected: { type: "BOOLEAN" },
                      reason: { type: "STRING" },
                      confidence: { type: "NUMBER" },
                    },
                    required: ["protected", "reason"],
                  },
                  files: [base64Data], // Send file
                }),
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
                      true
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
                `⚠️ Erro ao verificar copyright: ${e.message}. Permitindo...`
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
              "[Manual] ALL FILES EXIST IN CLOUD. Skipping upload flow completely."
            );
            progress.setTarget(100, "Concluído");
            progress.addLog(
              "Todos os arquivos já existem. Abrindo visualizador local..."
            );

            setTimeout(() => {
              progress.close();
              // ABRIR VIEWER LOCAL
              gerarVisualizadorPDF({
                title:
                  aiDataFromManifest?.formatted_title_general ||
                  "Documento Local",
                rawTitle:
                  aiDataFromManifest?.formatted_title_general ||
                  "Documento Local",
                fileProva: URL.createObjectURL(fileProva),
                fileGabarito: fileGabarito
                  ? URL.createObjectURL(fileGabarito)
                  : null,
                gabaritoNaProva: gabaritoCheck.checked,
                isManualLocal: true, // Força modo local
                slug: targetSlug || "local-preview",
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
              `Anexando visual_hash (Prova): ${hashP.substring(0, 10)}...`
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
              `Anexando visual_hash (Gabarito): ${hashG.substring(0, 10)}...`
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
        });
        const data = await res.json();
        console.log("[Manual] Worker Response:", data);

        // --- BYPASS DE CONFLITO PARA VIEWER LOCAL ---
        // Se der conflito ou sucesso, para o usuário o importante é abrir o arquivo que ele tem na mão.
        // A nuvem que se vire para resolver (ou o worker já resolveu).

        progress.addLog("Processamento inicial concluído!");

        if (data.status === "conflict") {
          progress.addLog(
            "⚠️ Aviso: Arquivos similares detectados no servidor."
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
            true
          );

          // Usar a mesma lógica de polling/pusher mas APENAS para saber quando terminar,
          // NÃO para pegar URL.

          // Reutilizar startPolling mas modificar para NÃO abrir com URL remota
          // Precisamos esperar o evento 'Cloud sync complete' ou similar.

          await new Promise(async (resolve) => {
            let PusherClass = window.Pusher;
            if (!PusherClass) {
              const module = await import("pusher-js");
              PusherClass = module.default;
            }
            const pusher = new PusherClass("6c9754ef715796096116", {
              cluster: "sa1",
            });
            const channel = pusher.subscribe(finalSlug);

            let done = false;
            const safeResolve = () => {
              if (!done) {
                done = true;
                channel.unbind_all();
                pusher.unsubscribe(finalSlug);
                resolve();
              }
            };

            // Timeout de segurança (se o worker for rápido demais e perdermos o ev, ou demorar)
            setTimeout(() => {
              progress.addLog(
                "⚠️ Tempo limite de sync atingido. Abrindo assim mesmo..."
              );
              safeResolve();
            }, 15000); // 15s max wait

            channel.bind("log", (d) => {
              const msg = d.message || "";
              console.log(`[Pusher Sync] ${msg}`);
              // progress.update(msg); // Opcional mostrar logs detalhados
              if (
                msg.includes("Cloud sync complete") ||
                msg.includes("Processamento concluído")
              ) {
                progress.addLog("✅ Sincronização confirmada!");
                safeResolve();
              }
            });

            // Se já veio sucesso imediato e não é async?
            // O manual-upload geralmente é async para coisas pesadas.
          });
        }

        progress.setTarget(100, "Abrindo");
        setTimeout(() => {
          progress.close();
          gerarVisualizadorPDF({
            title:
              data.ai_data?.formatted_title_general ||
              aiDataFromManifest?.formatted_title_general ||
              AUTO_TITLE,
            rawTitle: "Documento Local",
            fileProva: URL.createObjectURL(fileProva), // SEMPRE LOCAL
            fileGabarito: fileGabarito
              ? URL.createObjectURL(fileGabarito)
              : null, // SEMPRE LOCAL
            gabaritoNaProva: gabaritoCheck.checked,
            isManualLocal: true,
            slug: finalSlug,
          });
        }, 800);

        return;
      } catch (e) {
        if (progress && progress.close) progress.close();
        console.error("[Manual] Error triggering upload:", e);

        // Ensure viewer opens even on error
        setTimeout(() => {
          alert(
            "Erro na sincronização: " +
              e.message +
              "\nAbrindo modo visualização local."
          );
          gerarVisualizadorPDF({
            title: AUTO_TITLE || "Documento Local (Offline)",
            rawTitle: "Documento Local",
            fileProva: fileProva ? URL.createObjectURL(fileProva) : null,
            fileGabarito: fileGabarito
              ? URL.createObjectURL(fileGabarito)
              : null,
            gabaritoNaProva: gabaritoCheck.checked,
            isManualLocal: true,
            slug: "local-error-" + Date.now(),
          });
        }, 500);
      }
    }; // End executeUploadSequence

    // Check for Source Links
    const srcP = document.getElementById("sourceUrlProva")?.value.trim();
    const srcG = document.getElementById("sourceUrlGabarito")?.value.trim();

    if (!srcP && !srcG) {
      const m = document.getElementById("privacyConfirmModal");
      if (m) {
        m.style.display = "flex";

        const bYes = document.getElementById("btnConfirmUpload");
        const bNo = document.getElementById("btnCancelUpload");

        // Direct assignment to clean listeners
        bYes.onclick = () => {
          m.style.display = "none";
          executeUploadSequence();
        };
        bNo.onclick = () => {
          m.style.display = "none";
        };
        return; // Stop here, wait for click
      }
    }

    // If verification passed or no modal found
    executeUploadSequence();
  });
}
