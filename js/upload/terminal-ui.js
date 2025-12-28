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

    // UI Elements Reference
    this.el = {
      fill: null,
      eta: null,
      status: null,
      taskList: null,
      logStream: null,
      stepText: null,
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
        <a href="#" target="_blank" id="term-btn-logs" class="term-btn disabled" style="font-size: 0.75rem; text-decoration: none; padding: 2px 8px; border: 1px solid #444; border-radius: 4px; color: #666; pointer-events: none; transition: all 0.2s; margin: 0px 8px 4px 0px;">
            Ver Logs no GitHub ↗
        </a>
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
    // 1. Detect Job URL System Message
    if (text.includes("[SYSTEM_INFO] JOB_URL=")) {
      const url = text.split("JOB_URL=")[1].trim();
      if (url && this.el.logBtn) {
        this.el.logBtn.href = url;
        this.el.logBtn.classList.remove("disabled");
        this.el.logBtn.style.color = "#4CAF50"; // Green to show active
        this.el.logBtn.style.borderColor = "#4CAF50";
        this.el.logBtn.style.pointerEvents = "auto";
        // Optional: Don't show this system line in the UI to keep it clean,
        // or show it as a meta info. Let's hide it from the stream.
        return;
      }
    }

    // Update Activity
    this.lastLogTime = Date.now();
    this.appendLog(text, type);

    // --- Micro-Growth Logic ---
    // BOOT MODE: 0 -> 10%
    if (this.state === this.MODES.BOOT) {
      // Allow logs to push boot forward significantly
      if (this.currentVirtualProgress < 10) {
        this.currentVirtualProgress += 0.05; // Slower boot crawl
        this.updateProgressBar();
      }
    }
    // EXEC MODE: 10 -> 90%
    else if (this.state === this.MODES.EXEC) {
      // We are in the 10% -> 90% range.
      // We divide this 80% chunk by the total tasks.
      // Example: 4 tasks. Each task gets 20% of the bar.
      // Task 1: 10% -> 30%
      // Task 2: 30% -> 50%
      // etc.

      const rangePerTask = 80 / (this.totalTasks || 1);
      const currentTaskIndex = this.completedTasks; // 0-indexed index of task we are working on

      // Calculate the start and end % for the CURRENT task
      const taskStartPercent = 10 + currentTaskIndex * rangePerTask;
      const taskEndPercent = taskStartPercent + rangePerTask;

      // We implement a "Soft Cap" for logs:
      // Logs can only push us up to 90% of the CURRENT TASK'S range.
      // The final 10% of the task range is reserved for the "DONE" event jump.
      const softCap = taskStartPercent + rangePerTask * 0.9;

      // --- FINAL STRETCH LOGIC (90% -> 99.5%) ---
      // If we are capped at 90% (all tasks done), or just high up, allow slow crawl to 99%
      if (
        this.currentVirtualProgress >= 90 &&
        this.currentVirtualProgress < 99.5
      ) {
        this.currentVirtualProgress += 0.0001; // Crawl to the finish line
        this.updateProgressBar();
      }

      if (this.currentVirtualProgress < softCap) {
        // Micro-increment: 0.0001% per log (Back to VERY slow)
        this.currentVirtualProgress += 0.0001;

        this.updateProgressBar();
      }
    }

    // Parsing Logic
    try {
      if (text.includes("TaskTrackingAction") && text.includes("task_list=[")) {
        this.parseTaskPlan(text);
      } else if (text.includes("AgentAction") || text.includes("Observation")) {
        // If we see actions but missed the plan, ensure we leave boot
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
    const jsonMatch = text.match(/task_list=(\[\{.*\}\])/);
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
        // partial json
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
    const cleanText = text.replace(/\x1B\[[0-9;]*[mK]/g, "");
    line.innerText = `> ${cleanText}`;

    this.el.logStream.appendChild(line);

    // Keep DOM light
    if (this.el.logStream.children.length > 500) {
      this.el.logStream.removeChild(this.el.logStream.firstChild);
    }
    this.el.logStream.scrollTop = this.el.logStream.scrollHeight;
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
  }
}
