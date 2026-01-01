import { gerarVisualizadorPDF } from "../viewer/events.js";

/**
 * 3. LÓGICA DO FORMULÁRIO
 * Lida com preenchimento inicial, checkbox e submit.
 */
export function setupFormLogic(elements, initialData) {
  const {
    titleInput,
    yearInput,
    gabaritoCheck,
    gabaritoGroup,
    gabaritoInput,
    form,
    pdfInput,
  } = elements;

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
    titleInput.value = initialData.rawTitle || "";
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
          backgroundColor: "rgba(0,0,0,0.85)",
          zIndex: 12000,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(5px)",
          color: "white",
          fontFamily: "var(--font-primary)",
        });
        document.body.appendChild(modal);
      }

      modal.innerHTML = `
        <div style="background:var(--color-surface); padding:40px; border-radius:16px; width:90%; max-width:400px; text-align:center; box-shadow:0 10px 40px rgba(0,0,0,0.5); border:1px solid var(--color-border);">
            <div class="spinner" style="margin:0 auto 20px; width:40px; height:40px; border:4px solid var(--color-border); border-top-color:var(--color-primary); border-radius:50%; animation:spin 1s linear infinite;"></div>
            <h3 style="margin-bottom:10px; color:var(--color-text);">Processando</h3>
            <p id="upload-status-text" style="color:var(--color-text-secondary); margin-bottom:0;">${initialStatus}</p>
        </div>
        <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
      `;
      return {
        update: (text) => {
          const el = document.getElementById("upload-status-text");
          if (el) el.innerText = text;
        },
        close: () => {
          if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
        },
      };
    };

    const progress = showProgressModal(
      "Calculando identidade visual do arquivo..."
    );

    // Reusable Polling Function (Moved Up)
    // Reusable Pusher Listener
    const startPollingAndOpenViewer = async (
      hfUrl,
      slug,
      aiData,
      hfUrlGabarito
    ) => {
      progress.update("Iniciando conexão com o servidor de logs...");
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

      channel.bind("log", (data) => {
        // data can be wrapped or direct
        const msg = data.message || (data.data && data.data.message) || "";
        console.log(`[Pusher] ${msg}`);

        // Update UI
        progress.update(msg);

        // Check for success
        if (msg && msg.includes("Cloud sync complete")) {
          progress.update("Sincronização concluída! Abrindo visualizador...");

          // Unsubscribe & Disconnect
          channel.unbind_all();
          pusher.unsubscribe(slug);

          setTimeout(() => {
            try {
              const modalEl = document.getElementById("upload-progress-modal");
              if (modalEl) modalEl.remove();
            } catch (e) {}

            // USE PROXY
            const WORKER_URL =
              "https://maia-api-worker.willian-campos-ismart.workers.dev";
            const proxyUrl = `${WORKER_URL}/proxy-pdf?url=${encodeURIComponent(hfUrl)}`;

            // Prepare Gabarito URL
            let proxyGabUrl = null;
            if (hfUrlGabarito) {
              proxyGabUrl = `${WORKER_URL}/proxy-pdf?url=${encodeURIComponent(hfUrlGabarito)}`;
            }

            gerarVisualizadorPDF({
              title: aiData?.institution
                ? `${aiData.institution} ${aiData.year}` // Simplified Title Logic
                : titleInput.value,
              rawTitle: titleInput.value,
              fileProva: proxyUrl,
              fileGabarito: proxyGabUrl || aiData?.gabarito_url || null,
              gabaritoNaProva: gabaritoCheck.checked,
              isManualLocal: false,
              slug: slug,
            });
          }, 1500);
        }
      });

      // Fallback Safety for "already done" or "missed event"?
      // If we subscribed too late, we might wait forever.
      // Strategy: Check HEAD once at start just in case it's ALREADY there.
      // But usually we are calling this right after dispatch.
    };

    try {
      // 1. Calculate Visual Hash Local
      let localHashProva = null;
      let localHashGab = null;

      try {
        // Import dynamic to avoid top-level await issues if bundle not ready
        const { computePdfHash } = await import("../utils/pdf-hash.js");

        if (fileProva) {
          localHashProva = await computePdfHash(fileProva, (status) => {
            progress.update("Prova: " + status);
          });
          console.log("[Manual] Local Prova Hash:", localHashProva);
        }

        if (fileGabarito) {
          localHashGab = await computePdfHash(fileGabarito, (status) => {
            progress.update("Gabarito: " + status);
          });
          console.log("[Manual] Local Gabarito Hash:", localHashGab);
        }
      } catch (err) {
        console.warn("[Manual] Failed to compute hash:", err);
        progress.update("Erro no hash. Prosseguindo...");
      }

      progress.update("Enviando para análise...");

      const srcProvaVal = document.getElementById("sourceUrlProva").value;
      const srcGabVal = document.getElementById("sourceUrlGabarito").value;

      const formData = new FormData();
      formData.append("title", titleInput.value);
      if (srcProvaVal) formData.append("source_url_prova", srcProvaVal);
      if (srcGabVal) formData.append("source_url_gabarito", srcGabVal);

      formData.append("fileProva", fileProva);
      if (fileGabarito) formData.append("fileGabarito", fileGabarito);

      if (localHashProva) formData.append("visual_hash", localHashProva);
      if (localHashGab) formData.append("visual_hash_gabarito", localHashGab);

      const WORKER_URL =
        "https://maia-api-worker.willian-campos-ismart.workers.dev";

      const res = await fetch(`${WORKER_URL}/manual-upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

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

        const matchProva = findMatch(localHashProva, "prova");
        const matchGab = findMatch(localHashGab, "gabarito");

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
          progress.update(
            "Arquivos duplicados detectados. Usando versão da nuvem..."
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
        progress.update("Sincronizando diferenças com a nuvem...");

        // Simply auto-merge/overwrite whatever didn't match
        import("./search-logic.js").then((module) => {
          const newFormData = new FormData();
          newFormData.append("title", titleInput.value);
          if (srcProvaVal) newFormData.append("source_url_prova", srcProvaVal);
          if (srcGabVal) newFormData.append("source_url_gabarito", srcGabVal);

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
                const hfUrlGab =
                  d.hf_url_gabarito ||
                  (d.gabarito_filename
                    ? `https://huggingface.co/datasets/toquereflexo/maia-deep-search/resolve/main/output/${d.slug}/files/${d.gabarito_filename}`
                    : null);

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

      startPollingAndOpenViewer(
        data.hf_url_preview,
        data.slug,
        data.ai_data,
        hfUrlGab
      );
    } catch (e) {
      if (progress && progress.close) progress.close();
      console.error("[Manual] Error triggering upload:", e);
      alert("Erro no upload: " + e.message);
    }
  });
}
