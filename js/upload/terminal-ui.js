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

    // Progress Logic 2.0 State
    this.currentVirtualProgress = 0;
    this.lastLogTime = Date.now();
    this.initialEstimatedDuration = 480; // ~8m
    this.currentEstimatedDuration = this.initialEstimatedDuration;
    this.lastEtaUpdate = 0;

    // Cancellation State
    this.runId = null;
    this.isCancelling = false;

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
        <div style="display: flex; align-items: center;">
            <button id="term-btn-cancel" class="term-btn" style="font-size: 0.75rem; background: transparent; border: 1px solid #d32f2f; color: #d32f2f; padding: 2px 8px; border-radius: 4px; cursor: pointer; margin: 0px 8px 4px 0px; display: none; transition: all 0.2s;">
                Cancelar
            </button>
            <a href="#" target="_blank" id="term-btn-logs" class="term-btn disabled" style="font-size: 0.75rem; text-decoration: none; padding: 2px 8px; border: 1px solid #444; border-radius: 4px; color: #666; pointer-events: none; transition: all 0.2s; margin: 0px 8px 4px 0px;">
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

    // Bind Cancel Button
    if (this.el.cancelBtn) {
      this.el.cancelBtn.addEventListener("click", () => this.cancelJob());
    }

    // Boot Animator REMOVED (User request: No time-based progress)
    // Progress will only move when logs or plan updates arrive.
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

    // 0. Handle Batched Logs (Split newlines)
    if (text.includes("\n")) {
      const lines = text.split("\n");
      lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed) {
          this.processLogLine(trimmed, type);
        }
      });
      return;
    }

    // 1. Detect Job URL System Message
    if (text.includes("[SYSTEM_INFO] JOB_URL=")) {
      const url = text.split("JOB_URL=")[1].trim();
      if (url) {
        // Extract Run ID using Regex to be safe against /job/ segments
        try {
          // Matches .../actions/runs/12345... or .../actions/runs/12345/job/6789...
          // We want the 12345 part.
          const match = url.match(/actions\/runs\/(\d+)/);
          if (match && match[1]) {
            const runId = match[1];
            this.runId = runId;
            // Enable Cancel Button if we have a Run ID and not done
            if (this.el.cancelBtn && this.state !== this.MODES.DONE) {
              this.el.cancelBtn.style.display = "inline-block";
            }
          } else {
            console.warn("Could not match Run ID in URL:", url);
          }
        } catch (e) {
          console.warn("Error parsing Run ID from URL:", url, e);
        }

        if (this.el.logBtn) {
          this.el.logBtn.href = url;
          this.el.logBtn.classList.remove("disabled");
          this.el.logBtn.style.color = "var(--color-primary)"; // Green to show active
          this.el.logBtn.style.borderColor = "var(--color-primary)";
          this.el.logBtn.style.pointerEvents = "auto";
        }
        return;
      }
    }

    // Update Activity
    this.lastLogTime = Date.now();
    this.appendLog(text, type);

    // --- Micro-Growth Logic ---
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

    // Parsing Logic
    try {
      if (text.includes("task_list=[")) {
        this.parseTaskPlan(text);
      } else if (text.includes("AgentAction") || text.includes("Observation")) {
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
        this.finish();
      } else if (
        text.includes("Job failed") ||
        text.includes("Job failed") ||
        text.includes("FAILED")
      ) {
        this.fail("Job marcado como falho nos logs.");
      }
    } catch (err) {
      // ignore parse errors
    }
  }

  parseTaskPlan(text) {
    // Regex improved to capture list content more reliably
    const jsonMatch = text.match(/task_list=(\[.*\])/);
    if (jsonMatch && jsonMatch[1]) {
      let jsonStr = jsonMatch[1]
        .replace(/'/g, '"')
        .replace(/None/g, "null")
        .replace(/True/g, "true")
        .replace(/False/g, "false");
      try {
        const plan = JSON.parse(jsonStr);
        this.updatePlan(plan);
      } catch (e) {
        // partial json or parse error
      }
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
        this.appendLog(
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

  appendLog(text, type) {
    const line = document.createElement("div");
    line.className = `term-log-line ${type}`;
    // eslint-disable-next-line
    const cleanText = text
      .replace(/\x1B\[[0-9;]*[mK]/g, "")
      .replace(/\[[0-9;]*m/g, "");
    line.innerText = `> ${cleanText}`;

    // Auto-scroll logic improvement
    const isScrolledToBottom =
      this.el.logStream.scrollHeight - this.el.logStream.clientHeight <=
      this.el.logStream.scrollTop + 10;

    this.el.logStream.appendChild(line);

    if (isScrolledToBottom) {
      this.el.logStream.scrollTop = this.el.logStream.scrollHeight;
    }
  }

  finish() {
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
      this.el.cancelBtn.style.display = "none";
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

    this.appendLog(`[ERRO CRÍTICO] ${reason}`, "error");

    if (this.el.cancelBtn) {
      this.el.cancelBtn.style.display = "none";
    }
  }

  async cancelJob() {
    if (!this.runId || this.isCancelling) return;

    if (!confirm("Tem certeza que deseja cancelar esta pesquisa?")) return;

    this.isCancelling = true;
    this.el.cancelBtn.innerText = "Cancelando...";
    this.el.cancelBtn.disabled = true;
    this.el.cancelBtn.style.opacity = "0.7";

    this.appendLog("Solicitando cancelamento do job...", "warning");

    try {
      // PROD_WORKER_URL is not available here directly, so we need to pass it or rely on a global config
      // Assuming global variable or import (which we imported in search-logic.js but not here)
      // Let's rely on the module import context or similar way.
      // Actually, PROD_WORKER_URL is defined in search-logic.js scope, not here.
      // We can use relative path if on same domain or hardcoded for now, BUT
      // better approach: pass PROD_WORKER_URL to constructor or use import.meta.env

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
        this.appendLog(
          "Cancelamento enviado com sucesso. Aguardando finalização...",
          "success"
        );
        this.el.status.innerText = "CANCELAMENTO_SOLICITADO";
      } else {
        throw new Error(result.error || "Falha ao solicitar cancelamento");
      }
    } catch (e) {
      this.appendLog(`Erro ao cancelar: ${e.message}`, "error");
      this.isCancelling = false;
      this.el.cancelBtn.innerText = "Cancelar";
      this.el.cancelBtn.disabled = false;
      this.el.cancelBtn.style.opacity = "1";
    }
  }
}
