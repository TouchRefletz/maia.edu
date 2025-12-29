export class TerminalUI {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Terminal container ${containerId} not found`);
      return;
    }

    // Options
    this.options = Object.assign(
      {
        mode: "full", // 'full' | 'simple'
        initialDuration: 480,
      },
      options
    );

    // Sound Config
    this.config = {
      sounds: {
        success: "/sounds/success.mp3",
        error: "/sounds/error.mp3",
      },
    };
    this.notifyEnabled = false;

    // State Enums
    this.MODES = {
      BOOT: "BOOT", // 0-10%
      EXEC: "EXEC", // 10-90%
      VERIFY: "VERIFY", // 90-99%
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
    this.initialEstimatedDuration = this.options.initialDuration;
    this.estimatedRemainingTime = this.initialEstimatedDuration; // Dynamic ETA

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
    // Conditional Task Block
    const tasksBlock =
      this.options.mode === "simple"
        ? ""
        : `
      <div class="term-tasks">
        <div class="term-task-item current">
          <span class="term-icon">⚡</span> 
          <span>Iniciando Executor OpenHands Cloud...</span>
        </div>
      </div>
    `;

    // Adjust height for simple mode if needed via CSS class or inline
    const simpleClass =
      this.options.mode === "simple" ? "term-mode-simple" : "";

    const styles = `
      <style>
        @keyframes term-pulse-gold {
          0% { box-shadow: 0 0 0 0 rgba(255, 193, 7, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(255, 193, 7, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 193, 7, 0); }
        }
        .term-btn-notify {
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
          padding: 8px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text);
        }
        .term-btn-notify.active {
          color: #ffc107;
          background: rgba(255, 193, 7, 0.1); /* Subtle yellow background */
          animation: term-pulse-gold 2s infinite;
        }
        .term-btn-notify.inactive {
          opacity: 0.4;
          filter: grayscale(100%);
          color: #666;
        }
        .term-btn-notify:hover {
          background: rgba(255, 255, 255, 0.05);
        }
      </style>
    `;

    this.container.innerHTML = `
      ${styles}
      <div class="term-header ${simpleClass}">
        <div class="term-title">
          <span>>_</span> ${this.options.mode === "simple" ? "SISTEMA_LIMPEZA" : "PESQUISA_AVANÇADA"}
        </div>
        <div class="term-status-group" style="display:flex; align-items:center; gap:12px;">
            <div class="term-status active">INICIANDO_SISTEMA...</div>
             <button id="term-btn-notify" class="term-btn-notify inactive" title="Notificar ao concluir">
                <span class="icon">🔕</span>
            </button>
        </div>
      </div>
      
      <div class="term-progress-container ${simpleClass}">
        <div class="term-bar-wrapper">
          <div class="term-bar-fill" style="width: 0%"></div>
        </div>
        <div class="term-meta">
          <span class="term-step-text">Inicializando ambiente de execução...</span>
          <span class="term-eta">TEMPO ESTIMADO: ${this.options.mode === "simple" ? "00:15" : "08:00"}</span>
        </div>
      </div>

      ${tasksBlock}

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
      <div class="term-logs ${simpleClass}" id="term-logs-stream"></div>
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

    // Bind Notification Toggle
    this.el.notifyBtn = this.container.querySelector("#term-btn-notify");
    if (this.el.notifyBtn) {
      this.el.notifyBtn.addEventListener("click", () =>
        this.toggleNotification()
      );
    }
  }

  updateProgressBar() {
    if (!this.el.fill) return;
    const safePercent = Math.min(100, Math.max(0, this.currentVirtualProgress));
    this.el.fill.style.width = `${safePercent.toFixed(3)}%`;
  }

  // Helper to calculate current strict limit of the bar
  getCurrentHardCap() {
    let maxAllowed = 0;
    if (this.state === this.MODES.BOOT) {
      maxAllowed = 10;
    } else if (this.state === this.MODES.EXEC) {
      const rangePerTask = 80 / (this.totalTasks || 1);
      maxAllowed = 10 + (this.completedTasks + 1) * rangePerTask;

      if (this.completedTasks + 1 === this.totalTasks) {
        maxAllowed = Math.min(maxAllowed, 99);
      }
    } else if (this.state === this.MODES.VERIFY) {
      return 99;
    } else if (this.state === this.MODES.DONE) {
      return 100;
    }
    return Math.max(0, maxAllowed - 1.0); // 1% buffer
  }

  // Called every 1s
  tick() {
    if (this.state === this.MODES.DONE) return;

    // --- Visual Drift ---
    this.bumpProgress(true);

    // --- Time-to-Progress P-Controller (Breathing Logic) ---
    const now = Date.now();
    const idleSeconds = (now - this.lastLogTime) / 1000;

    // 1. Calculate Target Time based on Bar Position
    // If Bar is at 50%, Time should be 50% of 480s = 240s
    const pct = Math.max(0, Math.min(100, this.currentVirtualProgress));
    const targetRemaining = this.initialEstimatedDuration * (1 - pct / 100);

    // 2. Determine State based on Error
    // "ahead" means Estimated < Target (e.g. 7m vs 7m10s).
    // "behind" means Estimated > Target (e.g. 7m20s vs 7m10s).
    const isAheadOrAtTarget =
      this.estimatedRemainingTime <= targetRemaining + 2; // 2s buffer

    let change = 0;

    if (isAheadOrAtTarget) {
      // We are at the limit (stuck).
      change = +0.3; // Base rising speed when stuck
    } else {
      // We are behind the target (have room to drop).
      // NORMAL MODE: -1.0
      // FAST MODE (Duration < 60s): Drop much faster to catch up
      if (this.initialEstimatedDuration < 60) {
        // Logic: Drop 1s per second normally.
        change = -1.0;
      } else {
        change = -1.0;
      }
    }

    // 3. Log Activity Factor ("Não retira o de log não, faz ele coexistir")
    const isActive = idleSeconds < 5;
    if (isActive) {
      if (this.initialEstimatedDuration < 60) {
        // TURBO MODE for short tasks
        // e.g. -5s per tick?
        change -= 5.0;
      } else {
        // Standard Turbo
        change -= 1.0;
      }
    }

    // Apply
    this.estimatedRemainingTime += change;
    this.estimatedRemainingTime = Math.max(
      0,
      Math.min(9999, this.estimatedRemainingTime)
    );

    this.updateETADisplay();
  }

  updateETADisplay() {
    // Just render the current state
    const remaining = Math.max(0, Math.floor(this.estimatedRemainingTime));
    const mins = Math.floor(remaining / 60);
    const secs = Math.floor(remaining % 60);
    this.el.eta.innerText = `TEMPO ESTIMADO: ${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  updateStepText(text) {
    if (this.el.stepText) {
      this.el.stepText.innerText = text;
      // Reset color to default or based on context if needed
      // this.el.stepText.style.color = "var(--color-text)";
    }
  }

  /**
   * Called by external event listener when a structured task update is received.
   * @param {Array} tasks - Array of task objects {id, title, status}
   */
  updateTaskFromEvent(tasks) {
    if (Array.isArray(tasks)) {
      this.updatePlan(tasks);
      this.queueLog(
        `[SYSTEM] Lista de tarefas sincronizada (${tasks.length} itens)`,
        "success"
      );
    }
  }

  updateTaskStateByName(title, newStatus, notes = null) {
    // Fuzzy match title
    const task = this.tasks.find((t) => t.title.trim() === title.trim());
    if (task) {
      let changed = false;
      if (task.status !== newStatus) {
        task.status = newStatus;
        changed = true;
      }
      if (notes && task.notes !== notes) {
        task.notes = notes;
        changed = true;
      }

      if (changed) {
        this.updatePlan(this.tasks); // Trigger Re-render
      }
    } else {
      // Optional: Add new task if not exists?
    }
  }

  processLogLine(text, type = "info") {
    if (!text) return;

    // 1. HYBRID STRATEGY: Server Event + Log Parsing Fallback
    // We try to detect standard task formats:
    // Format A: "- [x] Title | Notes: ..."
    // Format B: "1. ⏳ Title"

    let foundTask = false;

    // Cleaning: Remove common prefixes like "> ", "- ", "* "
    const cleanLine = text.trim().replace(/^[\-\*\>]\s+/, "");

    // Regex A: [x] Title | Notes: ...
    const matchA = cleanLine.match(
      /^\[([ xX/])\]\s+([^|]+)(?:\|\s*Notes:\s*(.*))?/i
    );
    // Regex B: 1. ⏳ Title
    const matchB = cleanLine.match(/^\d+\.\s+(?:([^\w\s]+)\s+)?(.*)/);

    if (matchA) {
      foundTask = true;
      const statusChar = matchA[1].toLowerCase();
      const taskTitle = matchA[2].trim();
      const notes = matchA[3] ? matchA[3].trim() : "";

      let status = "todo";
      if (statusChar === "x") status = "completed";
      if (statusChar === "/") status = "in_progress";

      this.updateTaskStateByName(taskTitle, status, notes);
    } else if (matchB) {
      foundTask = true;
      const icon = matchB[1] || "";
      const taskTitle = matchB[2].trim();

      let status = "todo";
      if (icon) {
        if (["✅", "✔", "☑", "☑️"].some((c) => icon.includes(c)))
          status = "completed";
        else if (["⏳"].some((c) => icon.includes(c)))
          status = "todo"; // User requested override
        else if (["▶", "🏃", "🚧"].some((c) => icon.includes(c)))
          status = "in_progress";
        else if (["❌", "🚫"].some((c) => icon.includes(c))) status = "failed";
      }

      this.updateTaskStateByName(taskTitle, status);
    }

    if (text.includes("IPythonRunCellAction")) {
      this.el.stepText.innerText = "Executando script de automação Python...";
      this.el.stepText.style.color = "var(--color-primary)";
    } else if (text.includes("CmdRunAction")) {
      this.el.stepText.innerText = "Executando comando no sistema...";
      this.el.stepText.style.color = "var(--color-text)";
    } else if (text.includes("MCPAction") || text.includes("tavily")) {
      this.el.stepText.innerText = "Consultando fontes externas...";
      this.el.stepText.style.color = "var(--color-warning)";
    } else if (text.includes("Browser")) {
      this.el.stepText.innerText = "Navegando na web...";
    }

    // 2. Check for Job URL
    if (text.includes("[SYSTEM_INFO] JOB_URL=")) {
      const urlPart = text.split("JOB_URL=")[1];
      const url = urlPart ? urlPart.split(/\s/)[0] : null;

      if (url) {
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
      }
    }

    // 3. Prepare Display Text
    let displayText = text;
    if (foundTask) {
      displayText = "[PLAN UPDATE RECEIVED]";
    }

    // 4. Update Activity
    this.lastLogTime = Date.now();

    // --- Progress Bump on Activity ---
    this.bumpProgress(false);

    // --- ETA Bonus on Activity ---
    // Moved to tick() P-Controller logic
    // We just mark activity time here.

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
  }

  // --- New Aggressive Progress Logic with Strict Limits ---
  bumpProgress(isDrift = false) {
    if (this.state === this.MODES.DONE) return;

    // 1. Get Hard Cap
    const hardCap = this.getCurrentHardCap();

    // 2. Calculate Potential Progress
    let bump = 0;
    if (isDrift) {
      bump = 0.05;
    } else {
      bump = 0.5;
    }

    let newProgress = this.currentVirtualProgress + bump;

    // 3. Time-Based Minimum
    const elapsed = (Date.now() - this.startTime) / 1000;
    const timeProjected = (elapsed / this.initialEstimatedDuration) * 100;

    if (newProgress < timeProjected) {
      newProgress = Math.min(newProgress + 0.1, timeProjected);
    }

    // 4. Apply Strict Cap
    this.currentVirtualProgress = Math.min(newProgress, hardCap);

    this.updateProgressBar();
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
      } else if (
        text.includes("Copying artifacts from container to host") ||
        text.includes("Starting upload to Hugging Face") ||
        text.includes("Updating Semantic Cache")
      ) {
        this.lockForSaving();
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

      // Calculate where we SHOULD be structurally
      const newCalculatedBaseline = 10 + completedCount * rangePerTask;

      // Drop nicely to the new correct state.
      this.currentVirtualProgress = newCalculatedBaseline;
      this.updateProgressBar();

      this.queueLog(
        `[SISTEMA] Sincronizando progresso: ${newCalculatedBaseline.toFixed(1)}%`,
        "success"
      );
    }

    // --- MILESTONE SYNC FOR TIME ---
    // Not strictly needed with P-Controller but good for immediate snap
    const remainingFraction = 1 - this.currentVirtualProgress / 100;
    this.estimatedRemainingTime =
      this.initialEstimatedDuration * remainingFraction;
    this.updateETADisplay();

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

        const noteHtml = t.notes
          ? `<div style="font-size: 0.8rem; opacity: 0.7; margin-left: 24px;">${t.notes}</div>`
          : "";

        return `
        <div class="term-task-item ${cls}">
          <div style="display:flex; align-items:center;">
              <span class="term-icon">${icon}</span> 
              <span>${t.title}</span>
          </div>
          ${noteHtml}
        </div>
      `;
      })
      .join("");

    this.el.taskList.scrollTop = this.el.taskList.scrollHeight;
  }

  setVerifyMode() {
    this.state = this.MODES.VERIFY;
    this.bumpProgress(true);
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

  toggleNotification() {
    if (!("Notification" in window)) {
      alert("Este navegador não suporta notificações de área de trabalho.");
      return;
    }

    if (Notification.permission === "granted") {
      this.notifyEnabled = !this.notifyEnabled;
      this.updateNotifyUI();
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          this.notifyEnabled = true;
          this.updateNotifyUI();
          new Notification("Notificações Ativadas", {
            body: "Você será avisado quando a tarefa terminar.",
          });
        }
      });
    }
  }

  updateNotifyUI() {
    if (!this.el.notifyBtn) return;
    if (this.notifyEnabled) {
      this.el.notifyBtn.className = "term-btn-notify active";
      this.el.notifyBtn.innerHTML = '<span class="icon">🔔</span>';
    } else {
      this.el.notifyBtn.className = "term-btn-notify inactive";
      this.el.notifyBtn.innerHTML = '<span class="icon">🔕</span>';
    }
  }

  triggerNotification(title, body, isError = false) {
    if (!this.notifyEnabled) return;

    if (Notification.permission === "granted") {
      try {
        new Notification(title, {
          body: body,
          // icon: isError ? "/error.png" : "/success.png" // Optional path
        });

        const soundUrl = isError
          ? this.config.sounds.error
          : this.config.sounds.success;
        const audio = new Audio(soundUrl);
        audio
          .play()
          .catch((e) => console.error("Error playing notification sound:", e));
      } catch (e) {
        console.warn("Notification failed:", e);
      }
    }
  }

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

    this.triggerNotification(
      "Tarefa Concluída!",
      "O processo foi finalizado com sucesso."
    );

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

    this.triggerNotification(
      "Falha na Tarefa",
      `O processo falhou: ${reason}`,
      true
    );

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

    this.triggerNotification(
      "Tarefa Cancelada",
      "O processo foi cancelado manualmente."
    );

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

  lockForSaving() {
    if (this.state === this.MODES.DONE) return;

    // Visual feedback
    if (this.el.cancelBtn) {
      this.el.cancelBtn.innerText = "Salvando...";
      this.el.cancelBtn.classList.add("disabled");
      this.el.cancelBtn.disabled = true;
      this.el.cancelBtn.style.cursor = "not-allowed";
      this.el.cancelBtn.title =
        "Não é possível cancelar durante o salvamento de dados";
    }

    this.queueLog(
      "[SISTEMA] Iniciando preservação de dados. Cancelamento desativado.",
      "system" // Using 'system' or 'info' depending on CSS. Let's stick to info or just standard queueLog default.
    );

    // Create 'system' class if not exists, or just use info.
    // Actually, queueLog takes (text, type). Existing types: 'info', 'error', 'warning', 'success'.
    // Let's use 'warning' to make it visible or 'info'.
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
