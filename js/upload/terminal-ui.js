export class TerminalUI {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Terminal container ${containerId} not found`);
      return;
    }

    // State Enums
    this.MODES = {
      BOOT: "BOOT", // 0-10%
      EXEC: "EXEC", // 10-90%
      DONE: "DONE", // 100%
    };

    // Core State
    this.state = this.MODES.BOOT;
    this.tasks = [];
    this.logs = [];
    this.startTime = Date.now();
    this.completedTasks = 0;
    this.totalTasks = 1;

    // Log Batching State
    this.logQueue = [];
    this.isRendering = false;

    // Progress Logic 2.0 State
    this.currentVirtualProgress = 0;
    this.lastLogTime = Date.now();
    this.initialEstimatedDuration = 480; // ~8m
    this.currentEstimatedDuration = this.initialEstimatedDuration;
    this.lastEtaUpdate = 0;

    // Cancellation State
    this.runId = null;
    this.isCancelling = false;
    this.onRetry = null; // Callback for retry

    // UI Elements Reference
    this.el = {
      fill: null,
      eta: null,
      status: null,
      taskList: null,
      logStream: null,
      stepText: null,
      cancelBtn: null,
    };

    this.renderInitialStructure();

    // Global Ticker (1Hz)
    this.tickerInterval = setInterval(() => this.tick(), 1000);

    // Start Rendering Loop
    this.renderLoop();
  }

  renderInitialStructure() {
    this.container.innerHTML = `
      <div class="term-header">
        <div class="term-title">
          <span>>_</span> PESQUISA_AVANÇADA
        </div>
        <div class="term-status active">INICIANDO_SISTEMA...</div>
      </div>
      
      <div class="term-progress-container">
        <div class="term-bar-wrapper">
          <div class="term-bar-fill" style="width: 0%"></div>
        </div>
        <div class="term-meta">
          <span class="term-step-text">Inicializando ambiente de execução...</span>
          <span class="term-eta">TEMPO ESTIMADO: 08:00</span>
        </div>
      </div>

      <div class="term-tasks">
        <div class="term-task-item current">
          <span class="term-icon">⚡</span> 
          <span>Iniciando Executor OpenHands Cloud...</span>
        </div>
      </div>

      <div class="term-log-header" style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; border-bottom: 1px solid #333; padding-bottom: 5px;">
        <span class="term-label" style="margin: 0px 0px 0px 8px;">LOGS EM TEMPO REAL</span>
        <div style="display: flex; align-items: center; gap: 8px;">
            <button id="term-btn-retry" class="term-btn retry" style="display:none; background-color: var(--color-primary); color: #fff; border: none;">
                Tentar Novamente ↻
            </button>
            <button id="term-btn-cancel" class="term-btn cancel disabled" disabled>
                Cancelar
            </button>
            <a href="#" target="_blank" id="term-btn-logs" class="term-btn disabled">
                Ver Logs no GitHub ↗
            </a>
        </div>
      </div>
      <div class="term-logs" id="term-logs-stream"></div>
    `;

    this.el.fill = this.container.querySelector(".term-bar-fill");
    this.el.eta = this.container.querySelector(".term-eta");
    this.el.status = this.container.querySelector(".term-status");
    this.el.stepText = this.container.querySelector(".term-step-text");
    this.el.taskList = this.container.querySelector(".term-tasks");
    this.el.logStream = this.container.querySelector("#term-logs-stream");
    this.el.logBtn = this.container.querySelector("#term-btn-logs");
    this.el.cancelBtn = this.container.querySelector("#term-btn-cancel");
    this.el.retryBtn = this.container.querySelector("#term-btn-retry");

    // Bind Cancel Button
    if (this.el.cancelBtn) {
      this.el.cancelBtn.addEventListener("click", () => this.cancelJob());
    }

    // Bind Retry Button
    if (this.el.retryBtn) {
      this.el.retryBtn.addEventListener("click", () => {
        if (this.onRetry) this.onRetry();
      });
    }

    if (this.el.cancelBtn) {
      this.el.cancelBtn.innerText = "Cancelar";
    }
  }

  updateProgressBar() {
    if (!this.el.fill) return;
    const safePercent = Math.min(100, Math.max(0, this.currentVirtualProgress));
    this.el.fill.style.width = `${safePercent.toFixed(3)}%`;
  }

  // Called every 1s
  tick() {
    if (this.state === this.MODES.DONE) return;

    const now = Date.now();
    const elapsedSeconds = (now - this.startTime) / 1000;
    const timeSinceLastLog = now - this.lastLogTime;

    // --- Smart ETA Logic ---

    // 1. Idle Penalty
    if (timeSinceLastLog > 15000) {
      this.currentEstimatedDuration += 1.1;
    }

    // 2. Overshoot Logic
    if (elapsedSeconds > this.currentEstimatedDuration) {
      const progressFraction = Math.max(
        0.01,
        this.currentVirtualProgress / 100
      );
      const newEstimate = elapsedSeconds / progressFraction;
      if (newEstimate > this.currentEstimatedDuration) {
        this.currentEstimatedDuration = newEstimate;
      }
    }

    // Update Display every 5s
    if (now - this.lastEtaUpdate > 5000) {
      this.updateETADisplay(elapsedSeconds);
      this.lastEtaUpdate = now;
    }
  }

  updateETADisplay(elapsedSeconds) {
    let remaining = Math.max(0, this.currentEstimatedDuration - elapsedSeconds);

    // --- TIME LOCK LOGIC ---
    // Prevent time from dropping below a floor based on task progress.
    // Floor = InitialDuration * (1 - (completed + 1) / (total + 1))
    // Example: 480s, 0 completed, 1 total (10% done). floor = 480 * (1 - 1/2) = 240.
    // Example: 4 tasks. 0 completed. floor = 480 * (1 - 1/5) = 384s (6.4m).

    const floorRaw =
      this.initialEstimatedDuration *
      (1 - (this.completedTasks + 1) / (this.totalTasks + 1));
    const floor = Math.max(0, floorRaw);

    // If calculated remaining is LESS than floor, snap to floor.
    if (remaining < floor) {
      remaining = floor;
      // Optionally push actual estimate to match so it doesn't jump back
      // But for visual stability just clamping display is fine
    }

    const mins = Math.floor(remaining / 60);
    const secs = Math.floor(remaining % 60);
    this.el.eta.innerText = `TEMPO ESTIMADO: ${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  processLogLine(text, type = "info") {
    if (!text) return;

    // 1. PRIORITY: Control Messages Parsing (Before Split)
    // Handle multiple task lists (Standard Global Regex Loop)
    // Relaxed Regex: Capture [...] block, ignoring what follows (comma, space, etc)
    const taskListRegex = /task_list=(\[[\s\S]*?\])/g;
    let match;
    let foundTask = false;

    // Iterate all matches of task_list=[...]
    // We treat the text as potentially containing multiple distinct updates.
    while ((match = taskListRegex.exec(text)) !== null) {
      if (match[1]) {
        foundTask = true;
        this.parseTaskPlan(match[1]); // Parse the JSON part
      }
    }

    // 2. Check for Job URL
    if (text.includes("[SYSTEM_INFO] JOB_URL=")) {
      const urlPart = text.split("JOB_URL=")[1];
      const url = urlPart ? urlPart.split(/\s/)[0] : null; // Take until whitespace

      if (url) {
        // Extract Run ID using Regex to be safe against /job/ segments
        try {
          const matchId = url.match(/actions\/runs\/(\d+)/);
          if (matchId && matchId[1]) {
            this.runId = matchId[1];
            if (this.el.cancelBtn && this.state !== this.MODES.DONE) {
              this.el.cancelBtn.classList.remove("disabled");
              this.el.cancelBtn.disabled = false;
              this.el.cancelBtn.innerText = "Cancelar";
            }
          }
        } catch (e) {
          console.warn("Error parsing Run ID from URL:", url, e);
        }

        if (this.el.logBtn) {
          this.el.logBtn.href = url;
          this.el.logBtn.classList.remove("disabled");
          this.el.logBtn.style.color = "var(--color-primary)";
          this.el.logBtn.style.borderColor = "var(--color-primary)";
          this.el.logBtn.style.pointerEvents = "auto";
        }
        // Don't discard the line, let it log as info
      }
    }

    // 3. Prepare Display Text
    // If we found tasks, we strip them from the log to avoid giant JSON dumps
    let displayText = text;
    if (foundTask) {
      displayText = text
        .replace(taskListRegex, "[PLAN UPDATE RECEIVED]")
        .replace(/\n\s*\n/g, "\n"); // Clean up empty lines left behind
    }

    // 4. Update Activity
    this.lastLogTime = Date.now();

    // 5. Completion/Failure Checks
    this.checkStateTransitions(displayText);

    // 6. Log Batching (Split & Queue)
    if (displayText.includes("\n")) {
      const lines = displayText.split("\n");
      lines.forEach((line) => {
        const trimmed = line.trimEnd();
        if (trimmed) this.queueLog(trimmed, type);
      });
    } else {
      if (displayText.trim()) this.queueLog(displayText, type);
    }

    // --- Micro-Growth Logic ---
    this.updateVirtualProgress();
  }

  // New helper to handle progress ticks separately from log structure
  updateVirtualProgress() {
    // BOOT MODE: 0 -> 10%
    if (this.state === this.MODES.BOOT) {
      if (this.currentVirtualProgress < 10) {
        this.currentVirtualProgress += 0.05;
        this.updateProgressBar();
      }
    }
    // EXEC MODE: 10 -> 90%
    else if (this.state === this.MODES.EXEC) {
      const rangePerTask = 80 / (this.totalTasks || 1);
      const currentTaskIndex = this.completedTasks;
      const taskStartPercent = 10 + currentTaskIndex * rangePerTask;
      const softCap = taskStartPercent + rangePerTask * 0.9;

      if (
        this.currentVirtualProgress >= 90 &&
        this.currentVirtualProgress < 99.5
      ) {
        this.currentVirtualProgress += 0.0001;
        this.updateProgressBar();
      }

      if (this.currentVirtualProgress < softCap) {
        this.currentVirtualProgress += 0.0001;
        this.updateProgressBar();
      }
    }
  }

  checkStateTransitions(text) {
    try {
      if (text.includes("AgentAction") || text.includes("Observation")) {
        this.forceExecStart();
      } else if (
        text.includes("AgentFinishAction") ||
        text.includes("COMPLETED") ||
        text.includes("Fluxo de Trabalho Concluído") ||
        (text.includes("Job") &&
          (text.includes("succeeded") ||
            text.includes("finished") ||
            text.includes("completed")))
      ) {
        this.finish(true);
      } else if (text.includes("CANCELLED")) {
        this.cancelFinished();
      } else if (text.includes("Job failed") || text.includes("FAILED")) {
        this.fail("Job marcado como falho nos logs.");
      }
    } catch (err) {
      // ignore parse errors
    }
  }

  parseTaskPlan(jsonStr) {
    // 1. Python constants to JS
    // Replace Python-specific constants or None with JS equivalents
    let cleanStr = jsonStr
      .replace(/None/g, "null")
      .replace(/True/g, "true")
      .replace(/False/g, "false");

    // 2. JS Eval (Function constructor) handles single quotes validly
    // This parses [{ 'id': '1', ... }] which JSON.parse fails on.
    try {
      // eslint-disable-next-line
      const plan = new Function("return " + cleanStr)();
      if (Array.isArray(plan)) {
        this.updatePlan(plan);
      }
    } catch (e) {
      console.error("Failed to parse task plan:", e, jsonStr);
    }
  }

  updatePlan(newTasks) {
    // Transition BOOT -> EXEC
    if (this.state === this.MODES.BOOT) {
      this.state = this.MODES.EXEC;

      // Jump to 10% baseline immediately if we weren't there
      this.currentVirtualProgress = 10;
      this.updateProgressBar();

      this.el.status.innerText = "EXECUTANDO_PLANO";
      this.el.taskList.innerHTML = "";
    }

    this.tasks = newTasks;
    this.totalTasks = this.tasks.length;

    // Calculate completed count
    const completedCount = this.tasks.filter(
      (t) => t.status === "done" || t.status === "completed"
    ).length;

    // Did we finish a task?
    if (completedCount > this.completedTasks) {
      const rangePerTask = 80 / (this.totalTasks || 1);
      const newBaseline = 10 + completedCount * rangePerTask;

      // Force Jump if we are behind
      if (this.currentVirtualProgress < newBaseline) {
        this.currentVirtualProgress = newBaseline;
        this.updateProgressBar();
        // Visual feedback for jump
        this.queueLog(
          `[PROGRESSO] Tarefa concluída! Avançando para ${newBaseline.toFixed(1)}%`,
          "success"
        );
      }
    }

    this.completedTasks = completedCount;
    this.renderTaskList();
  }

  // --- Fallback: If we see AgentAct but no plan yet, assume we started EXEC ---
  forceExecStart() {
    if (this.state === this.MODES.BOOT) {
      this.state = this.MODES.EXEC;
      this.currentVirtualProgress = 10;
      this.updateProgressBar();
      this.el.status.innerText = "EXECUTANDO_PLANO";
    }
  }

  renderTaskList() {
    this.el.taskList.innerHTML = this.tasks
      .map((t) => {
        let icon = "○";
        let cls = "";

        if (t.status === "done" || t.status === "completed") {
          icon = "✔";
          cls = "done";
        } else if (t.status === "in_progress") {
          icon = "▶";
          cls = "current";
          this.el.stepText.innerText = `Executando: ${t.title}`;
        } else {
          icon = "·";
        }
        return `
        <div class="term-task-item ${cls}">
          <span class="term-icon">${icon}</span> 
          <span>${t.title}</span>
        </div>
      `;
      })
      .join("");

    this.el.taskList.scrollTop = this.el.taskList.scrollHeight;
  }

  queueLog(text, type) {
    // Clean text once
    const cleanText = text
      .replace(/\x1B\[[0-9;]*[mK]/g, "")
      .replace(/\[[0-9;]*m/g, "");

    this.logQueue.push({ text: cleanText, type });
  }

  renderLoop() {
    const render = () => {
      if (this.logQueue.length > 0) {
        // Render batch (up to 50 items to avoid blocking)
        const batchSize = Math.min(this.logQueue.length, 50);
        const fragment = document.createDocumentFragment();

        // Auto-scroll logic pre-check
        const isScrolledToBottom =
          this.el.logStream.scrollHeight - this.el.logStream.clientHeight <=
          this.el.logStream.scrollTop + 20; // 20px buffer

        for (let i = 0; i < batchSize; i++) {
          const item = this.logQueue.shift();
          const line = document.createElement("div");
          line.className = `term-log-line ${item.type}`;
          line.innerText = `> ${item.text}`;
          fragment.appendChild(line);
        }

        this.el.logStream.appendChild(fragment);

        if (isScrolledToBottom) {
          this.el.logStream.scrollTop = this.el.logStream.scrollHeight;
        }
      }

      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
  }

  // NOTE: removed direct 'appendLog' in favor of queueLog used internally

  finish(showRetry = false) {
    this.state = this.MODES.DONE;
    this.currentVirtualProgress = 100;
    this.updateProgressBar();
    clearInterval(this.tickerInterval);

    this.el.status.innerText = "MISSÃO_CONCLUÍDA";
    this.el.status.classList.remove("active");
    this.el.eta.innerText = "TEMPO: FINALIZADO";
    this.el.stepText.innerText =
      "Todas as tarefas foram concluídas com sucesso.";

    if (this.el.cancelBtn) {
      this.el.cancelBtn.classList.add("disabled");
      this.el.cancelBtn.disabled = true;
      this.el.cancelBtn.style.display = "none";
    }

    if (this.el.retryBtn) {
      if (showRetry) {
        this.el.retryBtn.style.display = "flex";
        this.el.retryBtn.style.alignItems = "center";
        this.el.retryBtn.style.height = "22px";
      } else {
        this.el.retryBtn.style.display = "none";
      }
    }
  }

  fail(reason = "Erro desconhecido") {
    this.state = this.MODES.DONE;
    // Don't force progress to 100 on fail, leave it where it died? Or red bar?
    // Let's make it red.
    if (this.el.fill) this.el.fill.style.backgroundColor = "var(--color-error)";

    clearInterval(this.tickerInterval);

    this.el.status.innerText = "FALHA_NA_EXECUÇÃO";
    this.el.status.classList.remove("active");
    this.el.status.style.color = "var(--color-error)";

    this.el.eta.innerText = "TEMPO: INTERROMPIDO";
    this.el.stepText.innerText = `Processo falhou: ${reason}`;
    this.el.stepText.style.color = "var(--color-error)";

    this.queueLog(`[ERRO CRÍTICO] ${reason}`, "error");

    if (this.el.cancelBtn) {
      this.el.cancelBtn.classList.add("disabled");
      this.el.cancelBtn.disabled = true;
      this.el.cancelBtn.style.display = "none";
    }

    if (this.el.retryBtn) {
      this.el.retryBtn.style.display = "flex";
      this.el.retryBtn.style.alignItems = "center";
      this.el.retryBtn.style.height = "22px";
    }
  }

  cancelFinished() {
    this.state = this.MODES.DONE;
    clearInterval(this.tickerInterval);

    this.el.status.innerText = "CANCELADO";
    this.el.status.classList.remove("active");
    this.el.status.style.color = "var(--color-warning)"; // Orange/Yellow

    this.el.eta.innerText = "TEMPO: CANCELADO";
    this.el.stepText.innerText = "Operação cancelada pelo usuário.";
    this.el.stepText.style.color = "var(--color-warning)"; // Orange/Yellow

    // Fill bar with warning color
    if (this.el.fill)
      this.el.fill.style.backgroundColor = "var(--color-warning)";

    this.queueLog(`[SISTEMA] Processo cancelado e encerrado.`, "warning");

    if (this.el.cancelBtn) {
      this.el.cancelBtn.innerText = "Cancelado";
      this.el.cancelBtn.classList.add("disabled");
      this.el.cancelBtn.disabled = true;
      this.el.cancelBtn.style.display = "none";
    }

    if (this.el.retryBtn) {
      this.el.retryBtn.style.display = "flex";
      this.el.retryBtn.style.alignItems = "center";
      this.el.retryBtn.style.height = "22px";
    }
  }

  async cancelJob() {
    if (!this.runId || this.isCancelling) return;

    if (!confirm("Tem certeza que deseja cancelar esta pesquisa?")) return;

    this.isCancelling = true;
    this.el.cancelBtn.innerText = "Cancelando...";
    this.el.cancelBtn.disabled = true;
    this.el.cancelBtn.style.opacity = "0.7";

    this.queueLog("Solicitando cancelamento do job...", "warning");

    try {
      const workerUrl =
        import.meta.env.VITE_WORKER_URL ||
        "https://maia-api-worker.touchreflexo.workers.dev"; // Fallback safe

      const response = await fetch(`${workerUrl}/cancel-deep-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: this.runId }),
      });

      const result = await response.json();

      if (result.success) {
        this.queueLog(
          "Cancelamento enviado com sucesso. Aguardando finalização...",
          "success"
        );
        this.el.status.innerText = "CANCELAMENTO_SOLICITADO";
      } else {
        throw new Error(result.error || "Falha ao solicitar cancelamento");
      }
    } catch (e) {
      this.queueLog(`Erro ao cancelar: ${e.message}`, "error");
      this.isCancelling = false;
      this.el.cancelBtn.innerText = "Cancelar";
      this.el.cancelBtn.disabled = false;
      this.el.cancelBtn.style.opacity = "1";
    }
  }
}
