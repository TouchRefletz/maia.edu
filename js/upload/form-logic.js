import { gerarVisualizadorPDF } from "../viewer/events.js";

/**
 * Helper: Upload to TmpFiles.org
 */
async function uploadToTmpFiles(file) {
  const formData = new FormData();
  formData.append("file", file);

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
              const modalEl = document.getElementById("upload-progress-modal");
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
      // 1. NEW FLOW: TmpFiles -> GitHub Hash -> Worker
      let remoteHashProva = null;
      let remoteHashGab = null;
      let tmpUrlProva = null;
      let tmpUrlGab = null;

      try {
        const timestampSlug = `manual-${Date.now()}`; // Temp slug for hash service channel

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

        // C. Request Hash from GitHub (via Worker Proxy)
        progress.setTarget(20, "Verificando Integridade");
        progress.addLog("Solicitando cálculo de hash seguro (GitHub)...");

        const WORKER_URL =
          "https://maia-api-worker.willian-campos-ismart.workers.dev";

        // Helper to request hash and wait for Pusher
        const getRemoteHash = async (url, tempSlug) => {
          // 1. Trigger
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
              reject(new Error("Timeout waiting for hash"));
            }, 600000); // 10m timeout

            channel.bind("hash_computed", (data) => {
              // data = { hash, exists, found_slug }
              clearTimeout(timeout);
              channel.unbind_all();
              pusher.unsubscribe(tempSlug);
              resolve(data);
            });
          });
        };

        if (tmpUrlProva) {
          progress.setTarget(25);
          progress.addLog("Calculando hash da Prova (Remoto)...");
          const result = await getRemoteHash(
            tmpUrlProva,
            timestampSlug + "-prova"
          );
          remoteHashProva = result.hash;
          console.log("[Manual] Hash Prova:", result);

          if (result.exists) {
            alert(
              `⚠️ Atenção: Esta prova já existe no sistema (Slug: ${result.found_slug}). O sistema usará a versão existente.`
            );
          }
        }

        if (tmpUrlGab) {
          progress.setTarget(30);
          progress.addLog("Calculando hash do Gabarito (Remoto)...");
          const result = await getRemoteHash(tmpUrlGab, timestampSlug + "-gab");
          remoteHashGab = result.hash;
          console.log("[Manual] Hash Gabarito:", result);
        }
      } catch (err) {
        console.warn("[Manual] Remote Hash Flow Failed:", err);
        progress.addLog("Erro no fluxo remoto. Abortando.", true);
        alert("Erro ao processar arquivo remotamente: " + err.message);
        return; // Stop here if we can't get hash
      }

      console.log("[Manual] Prepare to upload...");

      console.log("[Manual] Prepare to upload...");

      // Source URLs removed from UI
      const srcProvaVal = "";
      const srcGabVal = "";

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

        console.log(
          `[Manual] Naming Check (${type}): UI="${uiName}", Input="${fileInputName}"`
        );

        // Check if UI name is valid and NOT forbidden
        if (uiName && !forbidden.includes(uiName.toLowerCase())) {
          console.log(`[Manual] Using UI filename: ${uiName}`);
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
        const finalName = slug + suffix;
        console.log(
          `[Manual] Using Slug Fallback: ${finalName} (ORIGINAL WAS: ${fileInputName})`
        );
        return finalName;
      };

      const finalNameProva = getSafeName(fileProva.name, "prova", AUTO_TITLE);

      let finalNameGab = null;
      if (fileGabarito) {
        finalNameGab = getSafeName(fileGabarito.name, "gabarito", AUTO_TITLE);
      }
      // --- NEW NAMING LOGIC END ---

      const formData = new FormData();
      formData.append("title", AUTO_TITLE);

      if (srcProvaVal) formData.append("source_url_prova", srcProvaVal);
      if (srcGabVal) formData.append("source_url_gabarito", srcGabVal);

      // Pass the RENAMED file
      formData.append("fileProva", fileProva, finalNameProva);
      // EXPLICIT CUSTOM NAME FIELD FOR WORKER PRIORITY
      formData.append("pdf_custom_name", finalNameProva);

      if (fileGabarito && finalNameGab) {
        formData.append("fileGabarito", fileGabarito, finalNameGab);
        formData.append("gabarito_custom_name", finalNameGab);
      }

      if (remoteHashProva) formData.append("visual_hash", remoteHashProva);
      if (remoteHashGab) formData.append("visual_hash_gabarito", remoteHashGab);

      // Pass TmpURLs to Worker (to avoid re-uploading in backend)
      if (tmpUrlProva) formData.append("pdf_url_override", tmpUrlProva);
      if (tmpUrlGab) formData.append("gabarito_url_override", tmpUrlGab);

      // DEBUG LOGS (Moved to end)
      console.log("[Manual] --- FORM DATA PREVIEW ---");
      try {
        for (let [key, value] of formData.entries()) {
          if (value instanceof File) {
            console.log(
              `[Manual] Key: ${key} -> File: ${value.name} (${value.size} bytes)`
            );
          } else {
            console.log(`[Manual] Key: ${key} -> Value: "${value}"`);
          }
        }
      } catch (e) {
        console.log("[Manual] Error logging entries:", e);
      }
      console.log("[Manual] -------------------------");

      console.log("[Manual] FormData prepared. Dispatching to Worker...");
      progress.setTarget(40, "Processamento AI");
      progress.addLog("Enviando dados para worker de inteligência...");

      const WORKER_URL =
        "https://maia-api-worker.willian-campos-ismart.workers.dev";

      const res = await fetch(`${WORKER_URL}/manual-upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      console.log("[Manual] Worker Response:", data);

      if (data.ai_data) {
        console.log("[Manual] AI Data received:", data.ai_data);
      } else {
        console.warn("[Manual] No AI Data received in response!");
      }

      if (data.status === "conflict") {
        // --- VISUAL HASH SMART AUTO-RESOLUTION ---
        console.warn("[Manual] Conflict detected!", data);

        const items = Array.isArray(data.remote_manifest)
          ? data.remote_manifest
          : data.remote_manifest?.results || data.remote_manifest?.files || [];

        // Helper to find match
        const findMatch = (hash, typeFilter) => {
          if (!hash) return null;
          return items.find((item) => {
            if (item.visual_hash !== hash) return false;
            const iType = (item.tipo || item.type || "").toLowerCase();
            if (typeFilter === "gabarito") return iType.includes("gabarito");
            return !iType.includes("gabarito");
          });
        };

        const matchProva = findMatch(remoteHashProva, "prova");
        const matchGab = findMatch(remoteHashGab, "gabarito");

        // Helper to get Remote URL
        const getRemoteUrl = (item) => {
          if (!item) return null;
          if (item.url) return item.url;
          let path = item.path || item.filename;
          if (path && !path.startsWith("http")) {
            if (path.startsWith("files/")) path = path.replace("files/", "");
            return `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/output/${data.slug}/files/${path}`;
          }
          return null;
        };

        const remoteUrlProva = getRemoteUrl(matchProva);
        const remoteUrlGab = getRemoteUrl(matchGab);

        console.log("[Manual] Resolution Analysis:", {
          prova: matchProva ? "MATCH (Use Remote)" : "NO MATCH (Use Local)",
          gabarito: fileGabarito
            ? matchGab
              ? "MATCH (Use Remote)"
              : "NO MATCH (Use Local)"
            : "N/A",
        });

        // 1. FULL MATCH -> Use Remote Directly
        if (matchProva && (!fileGabarito || matchGab)) {
          progress.addLog(
            "Arquivos duplicados detectados. Usando versão da nuvem...",
            true
          );
          setTimeout(() => {
            progress.close();
            startPollingAndOpenViewer(
              remoteUrlProva,
              data.slug,
              data.ai_data || {
                institution: matchProva.instituicao,
                year: matchProva.ano,
              },
              remoteUrlGab // Pass Gabarito URL
            );
          }, 1000);
          return;
        }

        // 2. MIX & MATCH (Auto-Merge)
        console.log(
          "[Manual] Partial or No Match. Auto-merging differences..."
        );
        progress.addLog("Sincronizando diferenças com a nuvem...", true);

        // Simply auto-merge/overwrite whatever didn't match
        import("./search-logic.js").then((module) => {
          const newFormData = new FormData();
          newFormData.append("title", AUTO_TITLE);
          if (srcProvaVal) newFormData.append("source_url_prova", srcProvaVal);
          if (srcGabVal) newFormData.append("source_url_gabarito", srcGabVal);

          // FIX: Persist custom filenames in merge flow so Worker doesn't fallback to defaults
          newFormData.append("pdf_custom_name", finalNameProva);
          if (finalNameGab) {
            newFormData.append("gabarito_custom_name", finalNameGab);
          }

          // LOGIC:
          // If Prova Mismatch -> Send Local Temp URL
          if (!matchProva && data.temp_pdf_url) {
            newFormData.append("pdf_url_override", data.temp_pdf_url);
          }

          // If Gabarito Mismatch -> Send Local Temp URL
          if (fileGabarito && !matchGab && data.temp_gabarito_url) {
            newFormData.append("gabarito_url_override", data.temp_gabarito_url);
          }

          newFormData.append("confirm_override", "true");
          newFormData.append("mode", "update");

          fetch(`${WORKER_URL}/manual-upload`, {
            method: "POST",
            body: newFormData,
          })
            .then((r) => r.json())
            .then((d) => {
              if (d.success) {
                // Determine Gabarito URL from response (if provided) or construct it
                // Improved Gabarito URL derivation (matches main flow)
                let hfUrlGab = d.hf_url_gabarito;
                if (!hfUrlGab && d.gabarito_filename) {
                  hfUrlGab = `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/output/${d.slug}/files/${d.gabarito_filename}`;
                } else if (!hfUrlGab && fileGabarito) {
                  const gName = fileGabarito.name || "gabarito.pdf";
                  hfUrlGab = `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/output/${d.slug}/files/${gName}`;
                }

                startPollingAndOpenViewer(
                  d.hf_url_preview,
                  d.slug,
                  d.ai_data,
                  hfUrlGab
                );
              } else {
                progress.close();
                alert("Erro ao realizar fusão automática: " + d.error);
              }
            })
            .catch((err) => {
              progress.close();
              alert("Erro de fusão automática: " + err.message);
            });
        });

        return;
      }

      if (!data.success) {
        throw new Error(data.error || "Erro desconhecido no upload.");
      }

      // SUCCESS START
      const hfUrl = data.hf_url_preview;
      const slug = data.slug;

      // Determine Gabarito URL from response (need to be cleaner with filenames)
      // Worker currently returns only hf_url_preview.
      // We can infer it if we know the filename, OR we should update Worker to return it.
      // For now, let's construct it if we have metadata, otherwise default to gabarito.pdf logic?
      // Better: Use what we sent or got back from Worker.

      let hfUrlGab = data.hf_url_gabarito;
      if (!hfUrlGab && data.ai_data && data.ai_data.gabarito_filename) {
        hfUrlGab = `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/output/${slug}/files/${data.ai_data.gabarito_filename}`;
      } else if (!hfUrlGab && fileGabarito) {
        // Fallback guess
        const gName = fileGabarito.name || "gabarito.pdf";
        hfUrlGab = `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/output/${slug}/files/${gName}`;
      }

      // CHECK: Is Deduplicated? (Immediate Open)
      if (data.is_deduplicated) {
        progress.setTarget(100, "Concluído");
        progress.addLog(
          "✅ Arquivos já existentes encontrados! Abrindo...",
          true
        );
        setTimeout(() => {
          progress.close();
          openViewer(hfUrl, slug, data.ai_data, hfUrlGab);
        }, 1000);
      } else {
        // Normal Flow: Wait for Pusher
        startPollingAndOpenViewer(
          data.hf_url_preview,
          data.slug,
          data.ai_data,
          hfUrlGab
        );
      }
    } catch (e) {
      if (progress && progress.close) progress.close();
      console.error("[Manual] Error triggering upload:", e);
      alert("Erro no upload: " + e.message);
    }
  });
}
