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

    // 1. INSTANT VIEW: Load local file immediately for UX
    console.log("[Manual] Opening local viewer immediately...");

    // We pass the File object directly. Viewer needs to handle File or URL.
    // If viewer only takes URL, we create Blob URL.
    const localPdfUrl = URL.createObjectURL(fileProva);
    const localGabUrl = fileGabarito ? URL.createObjectURL(fileGabarito) : null;

    gerarVisualizadorPDF({
      title: `(Local) ${titleInput.value}`,
      rawTitle: titleInput.value,
      fileProva: localPdfUrl, // Pass Blob URL
      fileGabarito: localGabUrl, // Pass Blob URL
      gabaritoNaProva: gabaritoCheck.checked,
      isManualLocal: true, // Flag to show "Syncing..." UI in Viewer if possible
    });

    // 2. BACKGROUND UPLOADS
    // We don't await this to block the UI, but we should notify the user.
    // Ideally, we'd use a toaster. For now, let's log and maybe trigger a "Syncing" toast if available.

    try {
      const srcProvaVal = document.getElementById("sourceUrlProva").value;
      const srcGabVal = document.getElementById("sourceUrlGabarito").value;

      // Validation simplified: Title is handled by 'required' attribute on input, but we can double check if needed.
      // Files are checked below.

      const formData = new FormData();
      formData.append("title", titleInput.value);
      // Removed: year, institution, phase
      if (srcProvaVal) formData.append("source_url_prova", srcProvaVal);
      if (srcGabVal) formData.append("source_url_gabarito", srcGabVal);

      formData.append("fileProva", fileProva);
      if (fileGabarito) formData.append("fileGabarito", fileGabarito);

      // Get Worker URL from config or environment (hardcoded or global for now)
      const WORKER_URL =
        "https://maia-api-worker.willian-campos-ismart.workers.dev";

      // Assuming there's a global toaster or we just fire and forget for this MVP
      if (window.SearchToaster) {
        window.SearchToaster.add(
          "info",
          "Iniciando sincronização com a nuvem...",
          5000
        );
      }

      fetch(`${WORKER_URL}/manual-upload`, {
        method: "POST",
        body: formData,
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.status === "conflict") {
            // CONFLICT HANDLING: Delegate to Search Logic (Conflict Modal)
            console.warn("[Manual] Conflict detected!", data);

            // Dynamic import to avoid circular dependency issues if possible, or assume global
            import("./search-logic.js").then((module) => {
              module.showConflictResolutionModal(data, (overrideData) => {
                // RE-SUBMIT WITH OVERRIDE
                const newFormData = new FormData();
                // Copy original simple fields
                newFormData.append("title", titleInput.value);
                if (srcProvaVal)
                  newFormData.append("source_url_prova", srcProvaVal);
                if (srcGabVal)
                  newFormData.append("source_url_gabarito", srcGabVal);

                // Add Confirm Flag
                newFormData.append("confirm_override", "true");

                // Pass RESOLVED URLs (from selection)
                if (overrideData.pdfUrl)
                  newFormData.append("final_pdf_url", overrideData.pdfUrl);
                if (overrideData.gabUrl)
                  newFormData.append("final_gabarito_url", overrideData.gabUrl);

                // Pass original files again?
                // Actually, if we selected LOCAL, we need to upload them.
                // But the Worker "Duplicate Check" returned temp_pdf_url and temp_gabarito_url
                // which are already uploaded to tmpfiles.org!
                // So we just need to pass those URLs if we chose "Local".

                // Wait, for robust implementation, let's just re-upload the file object if needed
                // OR use the returned temp URLs.
                // Using returned temp URLs is safer and saves bandwidth.

                // If overrideData says "use local", we use the temp url returned by the conflict response.
                // If overrideData says "use remote", we use the remote url.

                // --- SELECTIVE URL LOGIC (MERGE/UPDATE) ---
                // If overrideData is provided, it means user made a choice.

                // 1. Check if we have LOCAL files selected
                const hasLocalPdf =
                  overrideData.pdfUrl &&
                  overrideData.pdfUrl.includes("tmpfiles.org");
                const hasLocalGab =
                  overrideData.gabUrl &&
                  overrideData.gabUrl.includes("tmpfiles.org");

                // 2. If BOTH are Remote (or null/empty and not local), we stop. nothing to upload diff
                // Actually, if user selected "Remote", the URL passed back might be the HF one or null depending on modal logic.
                // But simplified: if it's NOT a tmpfiles URL, we assume it's remote or keep-as-is.

                // We send "mode: 'update'" to tell backend/action to merge.
                newFormData.append("mode", "update");

                if (hasLocalPdf) {
                  newFormData.append("pdf_url_override", overrideData.pdfUrl);
                }
                // If NOT local (Remote selected), we do NOT append pdf_url_override.
                // The worker will see it's missing and won't send it to Action.

                if (hasLocalGab) {
                  newFormData.append(
                    "gabarito_url_override",
                    overrideData.gabUrl
                  );
                }

                // If NOTHING is local, we essentially just want to "confirm" the existence?
                // Or maybe just show success?
                // If the user selected everything REMOTE, then we don't need to do anything.
                if (!hasLocalPdf && !hasLocalGab) {
                  if (window.SearchToaster) {
                    window.SearchToaster.add(
                      "success",
                      "Nada a atualizar. Mantendo arquivos da nuvem.",
                      4000
                    );
                  }
                  return; // Stop here.
                }

                // Call worker again
                fetch(`${WORKER_URL}/manual-upload`, {
                  method: "POST",
                  body: newFormData,
                })
                  .then((r) => r.json())
                  .then((d) => {
                    if (d.success) {
                      if (window.SearchToaster)
                        window.SearchToaster.add(
                          "success",
                          "Conflito resolvido! Upload em andamento.",
                          5000
                        );
                    } else {
                      if (window.SearchToaster)
                        window.SearchToaster.add(
                          "error",
                          "Erro ao resolver conflito."
                        );
                    }
                  });
              });
            });
            return;
          }

          if (data.success) {
            console.log("[Manual] Sync started:", data);
            if (window.SearchToaster) {
              window.SearchToaster.add(
                "success",
                "Sincronização iniciada! O link será permanente em breve.",
                5000
              );
            }
          } else {
            console.error("[Manual] Sync failed:", data);
            if (window.SearchToaster)
              window.SearchToaster.add(
                "error",
                "Falha ao sincronizar: " + (data.error || "Erro desconhecido")
              );
          }
        })
        .catch((err) => {
          console.error("[Manual] Network error:", err);
          if (window.SearchToaster)
            window.SearchToaster.add(
              "error",
              "Erro de conexão na sincronização."
            );
        });
    } catch (e) {
      console.error("[Manual] Error triggering upload:", e);
    }
  });
}
