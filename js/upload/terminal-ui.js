import { LogTranslator } from "./log-translator.js";

export class TerminalUI {
  constructor(containerIdOrElement, options = {}) {
    // State Enums (Define FIRST to prevent partial initialization errors)
    this.MODES = {
      BOOT: "BOOT", // 0-10%
      EXEC: "EXEC", // 10-90%
      VERIFY: "VERIFY", // 90-99%
      DONE: "DONE", // 100%
    };

    // Resolve Container
    if (typeof containerIdOrElement === "string") {
      this.container = document.getElementById(containerIdOrElement);
    } else {
      this.container = containerIdOrElement;
    }

    if (!this.container) {
      console.error(`Terminal container not found`, containerIdOrElement);
      // We must still initialize state to prevent crashes
      this.state = this.MODES.BOOT;
      this.tasks = [];
      this.logs = [];
      return; // Return but at least 'this.MODES' exists
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
      <div class="term-tasks-body">
         <div class="term-floating-header" id="term-floating-header">
             <!-- Tasks Icons will be rendered here -->
         </div>
         <div class="term-chain-stream" id="term-chain-stream">
             <!-- Initial Greeting Node -->
             <div class="term-chain-node system">
                 <strong>🚀 Sistema Inicializado</strong>
                 Aguardando instruções de pesquisa...
             </div>
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
        /* Floating Mode CSS - LEFT SIDE */
        .term-floating {
           position: fixed !important;
           bottom: 20px !important;
           left: 20px !important; /* Left side */
           right: auto !important;
           width: 90vw !important; /* Grandão */
           max-width: 600px !important;
           height: auto !important;
           max-height: 80vh !important;
           z-index: 99999 !important;
           border-radius: 12px !important;
           box-shadow: 0 10px 30px rgba(0,0,0,0.5) !important;
           background: var(--color-surface, #1e1e2e) !important;
           transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
           overflow: hidden !important;
           display: flex;
           flex-direction: column;
        }

        /* MINIMIZED STATE (Button with Ring) */
        .term-floating.term-minimized {
            width: 60px !important;
            height: 60px !important;
            min-height: 60px !important; /* Force reset */
            max-height: 60px !important; /* Force reset */
            border-radius: 50% !important;
            padding: 0 !important;
            overflow: hidden !important;
            cursor: pointer !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            background: var(--color-surface, #1e1e2e) !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
            transition: transform 0.2s ease, box-shadow 0.2s ease !important;
        }
        
        .term-floating.term-minimized:hover {
            transform: scale(1.1);
        }

        /* Hide internal elements when minimized */
        .term-floating.term-minimized > *:not(.term-minimized-btn) {
            display: none !important;
        }

        /* The Toggle Button (only visible when minimized) */
        .term-minimized-btn {
            display: none;
            width: 100%;
            height: 100%;
            align-items: center;
            justify-content: center;
            position: relative;
        }

        .term-floating.term-minimized .term-minimized-btn {
            display: flex;
        }

        /* Spinner Ring */
        .term-ring-spinner {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            border: 4px solid transparent;
            border-top-color: var(--color-primary, #00d2ff);
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin { 100% { transform: rotate(360deg); } }

        /* SUCCESS STATE */
        .term-floating.term-status-success .term-ring-spinner {
            border: 4px solid #4caf50 !important;
            animation: none !important;
        }
        .term-floating.term-status-success .term-minimized-btn span {
             display: none; /* Hide computer icon */
        }
        .term-floating.term-status-success .term-minimized-btn::after {
             content: '✔';
             color: #4caf50;
             font-size: 1.5rem;
             font-weight: bold;
        }

        /* ERROR STATE */
        .term-floating.term-status-error .term-ring-spinner {
            border: 4px solid #f44336 !important;
            animation: none !important;
        }
        .term-floating.term-status-error .term-minimized-btn span {
             display: none;
        }
        .term-floating.term-status-error .term-minimized-btn::after {
             content: '✖';
             color: #f44336;
             font-size: 1.5rem;
             font-weight: bold;
        }

        .term-floating .term-logs {
            /* In expanded floating mode, we show logs but maybe smaller? User said "aparece todo o terminal" */
             display: block !important;
             flex: 1; /* Fill space */
             max-height: 300px;
             overflow-y: auto;
        }
        
        .term-floating .term-header {
            cursor: pointer;
            padding: 12px 16px !important;
        }
        
        .term-floating:hover {
            transform: translateY(-2px);
        }

        .term-floating .term-tasks {
            max-height: 60px;
            overflow: hidden;
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
        
        .term-btn-float-minimize {
             background: transparent;
             border: none;
             color: var(--color-text-secondary);
             cursor: pointer;
             font-size: 1.2rem;
             padding: 4px 8px;
             border-radius: 4px;
             display: none; /* Only show in float mode */
        }
        .term-btn-float-minimize:hover {
             background: rgba(255,255,255,0.1);
             color: var(--color-text);
        }
        
        .term-floating .term-btn-float-minimize {
             display: block !important;
        }
        .term-floating.term-minimized .term-btn-float-minimize {
             display: none !important;
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
            <button id="term-btn-float-minimize" class="term-btn-float-minimize" title="Minimizar">
                _
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

      <!-- New Split View -->
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
      
      <!-- Minimized Toggle Button -->
      <div class="term-minimized-btn">
          <div class="term-ring-spinner"></div>
          <span style="font-size: 1.2rem; z-index: 2;">💻</span>
      </div>
    `;

    this.el.fill = this.container.querySelector(".term-bar-fill");
    this.el.eta = this.container.querySelector(".term-eta");
    this.el.status = this.container.querySelector(".term-status");
    this.el.stepText = this.container.querySelector(".term-step-text");
    this.el.objectivesHeader = this.container.querySelector(
      ".term-objectives-header"
    );
    this.el.tasksBody = this.container.querySelector(".term-tasks-body");
    this.el.floatingHeader = this.container.querySelector(
      "#term-floating-header"
    );
    this.el.chainStream = this.container.querySelector("#term-chain-stream");

    // Old ref for safety if needed, though we use new ones now
    this.el.taskList = this.el.tasksBody;
    this.el.logStream = this.container.querySelector("#term-logs-stream");
    this.el.logBtn = this.container.querySelector("#term-btn-logs");
    this.el.cancelBtn = this.container.querySelector("#term-btn-cancel");
    this.el.retryBtn = this.container.querySelector("#term-btn-retry");

    // Bind Cancel Button
    if (this.el.cancelBtn) {
      this.el.cancelBtn.addEventListener("click", () => this.cancelJob());
    }

    // Bind Float Minimize Button
    const minBtn = this.container.querySelector("#term-btn-float-minimize");
    if (minBtn) {
      minBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // Don't trigger expand
        this.container.classList.add("term-minimized");
      });
    }

    // Global Click Outside Listener
    // We bind this once. It checks if click is outside AND we are floating/expanded.
    document.addEventListener("click", (e) => {
      if (!this.container) return;
      if (!document.body.contains(this.container)) return; // Detached

      const isFloating = this.container.classList.contains("term-floating");
      const isMinimized = this.container.classList.contains("term-minimized");

      // Only intervene if floating AND expanded
      if (isFloating && !isMinimized) {
        // Check if click origin is outside container
        if (!this.container.contains(e.target)) {
          this.container.classList.add("term-minimized");
        }
      }
    });

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
      this.el.notifyBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent float expansion when clicking notify
        this.toggleNotification();
      });
    }

    // Float Mode Expansion Click (Toggle Minimized)
    this.container.addEventListener("click", (e) => {
      if (this.container.classList.contains("term-floating")) {
        // Logic: If minimized, expand.
        // If expanded, do nothing (click events bubble unless stopped, handled by controls)

        const isMinimized = this.container.classList.contains("term-minimized");
        if (isMinimized) {
          this.container.classList.remove("term-minimized");
        }
      }
    });
  }

  setFloatMode(isFloating) {
    if (isFloating) {
      this.container.classList.add("term-floating");
      // Default to minimized when floating starts
      this.container.classList.add("term-minimized");
    } else {
      this.container.classList.remove("term-floating");
      this.container.classList.remove("term-minimized");
    }
  }

  // --- Notification State Management ---
  getNotificationState() {
    return this.notifyEnabled;
  }

  setNotificationState(enabled) {
    this.notifyEnabled = !!enabled;
    this.updateNotificationUI();
  }

  toggleNotification() {
    this.notifyEnabled = !this.notifyEnabled;
    this.updateNotificationUI();

    // Play sound on toggle for feedback
    // if (this.notifyEnabled) this.playSound("success");
  }

  updateNotificationUI() {
    const btn = this.el.notifyBtn;
    if (!btn) return;

    if (this.notifyEnabled) {
      btn.classList.remove("inactive");
      btn.classList.add("active");
      btn.innerHTML = `<span class="icon">🔔</span>`;
      btn.title = "Notificações Ativas";
    } else {
      btn.classList.remove("active");
      btn.classList.add("inactive");
      btn.innerHTML = `<span class="icon">🔕</span>`;
      btn.title = "Notificar ao concluir";
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
    if (!text) return;

    // Find the currently active task
    const activeTask =
      this.tasks.find((t) => t.status === "in_progress") || this.tasks[0];

    if (activeTask && this.el.tasksBody) {
      // Append text to the notes of the active card in DOM directly for real-time feel
      // We also ideally update state 'notes' but that might cause re-render flicker.
      // Let's find the card element by some ID we will generate (or index).

      // Strategy: Find the active card DOM element
      const activeCard = this.el.tasksBody.querySelector(
        ".term-task-card.active"
      );
      if (activeCard) {
        const noteEl = activeCard.querySelector(".term-task-notes");
        if (noteEl) {
          // Append new line if not duplicate
          if (!noteEl.innerText.includes(text)) {
            noteEl.innerText += `\n> ${text}`;
            noteEl.scrollTop = noteEl.scrollHeight;
          }
        }
      }
    }
    // Also update legacy/fallback if needed (hidden by CSS now)
    if (this.el.stepText) this.el.stepText.innerText = text;
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
      // Auto-add task if it looks like one and doesn't exist?
      // For now, let's just log it if not found, or maybe add it to end?
    }
  }

  processLogLine(text, type = "info") {
    if (!text) return;

    // 1. Raw Log (Console) - Always append raw text
    this.queueLog(text, type);

    // 2. Translate to Chain of Thought
    // Only attempt translation for info/system/success logs to avoid cluttering with errors unless critical
    // With new aggressive translator, we try to match almost everything relevant.
    // 2. Translate to Chain of Thought
    // Only attempt translation for info/system/success logs to avoid cluttering with errors unless critical
    // With new aggressive translator, we try to match almost everything relevant.
    const translation = LogTranslator.translate(text);

    if (translation) {
      this.appendChainThought(translation.text, translation.type);
    }

    // 3. HYBRID STRATEGY: Server Event + Log Parsing Fallback
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

    // Explicit Backend "Thought" override (if we want to force a node from backend without translator)
    if (text.match(/^\d+\.\s+⚡/)) {
      this.appendChainThought(text.replace(/^\d+\.\s+/, ""), "in_progress");
    }

    // 0. STRICT ERROR DETECTION
    const upperText = text.toUpperCase();

    // Git / Network Specific Failures that should HALT the flow
    if (
      text.includes("RPC failed; HTTP 503") ||
      text.includes("the remote end hung up unexpectedly") ||
      (text.includes("git push") && text.includes("error:"))
    ) {
      this.fail(`Falha de Conexão Git: ${text}`);
      return;
    }

    if (
      upperText.includes("FALHA FATAL") ||
      upperText.includes("ERRO CRÍTICO") ||
      upperText.includes("FATAL ERROR") ||
      (upperText.includes("CRITICAL ERROR") &&
        !upperText.includes("NON-CRITICAL"))
    ) {
      this.fail(text);
      return;
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
    let displayText = formattedText; // For backwards compat, though mostly we use queueLog(raw) + ChainStream(translated)
    if (foundTask) {
      displayText = "[PLAN UPDATE RECEIVED]";
    }

    // 4. Update Activity
    this.lastLogTime = Date.now();
    this.bumpProgress(false);

    // 5. Completion/Failure Checks
    this.checkStateTransitions(displayText);

    // Note: queueLog is already called at step 1. No need to call it again at end.
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
      this.el.objectivesHeader.innerHTML = "";
      this.el.tasksBody.innerHTML = "";
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
    if (!this.el.floatingHeader) return;

    let headerHtml = "";

    this.tasks.forEach((t, index) => {
      const isDone = t.status === "done" || t.status === "completed";
      const isProgress = t.status === "in_progress";

      // Card Logic (Horizontal)
      let cardClass = "term-task-card"; // Reusing styles if they fit, or new
      // Actually we are aiming for just ICONS in the header per plan

      let iconHtml = "";
      let statusColor = "var(--color-text-secondary)";
      let borderColor = "transparent";
      let bg = "rgba(255,255,255,0.05)";

      if (isProgress) {
        iconHtml = `<img src="/logo.png" class="term-obj-img spinning" alt="Active" style="width:20px; height:20px;">`;
        statusColor = "var(--color-primary)";
        borderColor = "var(--color-primary)";
        bg = "rgba(0, 210, 255, 0.1)";
      } else if (isDone) {
        iconHtml = `<div class="term-obj-check" style="color:var(--color-success)">✔</div>`;
        statusColor = "var(--color-success)";
      } else {
        iconHtml = `<span style="font-size:1.2rem; opacity:0.5;">○</span>`;
      }

      // Simple Chip Style
      headerHtml += `
         <div class="term-task-chip" style="
            display:flex; 
            align-items:center; 
            gap:8px; 
            background:${bg}; 
            padding:6px 10px; 
            border-radius:20px; 
            border:1px solid ${borderColor};
            white-space:nowrap;
            font-size:0.75rem;
            color:${statusColor};
         ">
             ${iconHtml}
             <span>${t.title}</span>
         </div>
       `;
    });

    this.el.floatingHeader.innerHTML = headerHtml;
  }

  appendChainThought(text, type = "info") {
    if (!this.el.chainStream) return;

    const node = document.createElement("div");
    node.className = `term-chain-node ${type}`;

    // Ensure bold title logic if not present
    let htmlContent = text;
    if (!text.includes("<strong>")) {
      htmlContent = `<strong>${text}</strong>`;
    }

    node.innerHTML = htmlContent;
    this.el.chainStream.appendChild(node);

    // Auto-scroll chain
    this.el.chainStream.scrollTop = this.el.chainStream.scrollHeight;
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

  finish(isSuccess = true, showRetry = true) {
    this.state = this.MODES.DONE;
    this.currentVirtualProgress = 100;
    this.updateProgressBar();
    clearInterval(this.tickerInterval);

    if (isSuccess) {
      this.el.status.innerText = "CONCLUÍDO";
      this.el.status.classList.add("success");
      this.el.status.classList.remove("active");

      // Update Minimized Status
      this.container.classList.remove("term-status-error");
      this.container.classList.add("term-status-success");

      this.el.eta.innerText = "TEMPO: FINALIZADO";
      this.updateStepText("Todos os processos finalizados com sucesso.");

      if (this.config.sounds.success) {
        new Audio(this.config.sounds.success).play().catch(() => {});
      }

      if (this.notifyEnabled) {
        new Notification("Processo Concluído", {
          body: "A busca e verificação foram finalizadas com sucesso.",
        });
      }
    } else {
      // Fallback for non-success finish if needed (e.g. cancelled)
      this.el.status.innerText = "FINALIZADO";
      this.el.status.classList.remove("active");
    }

    // Button Logic Support (Restored)
    if (this.el.cancelBtn) {
      this.el.cancelBtn.classList.add("disabled");
      this.el.cancelBtn.disabled = true;
      this.el.cancelBtn.style.display = "none";
    }

    if (this.el.retryBtn) {
      // Logic decoupled: We show retry if showRetry is true, regardless of success result.
      // (Although typically we only retry on success if we want to re-run, or on fail)
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
    // Treat cancellation as a FAILURE per user request
    this.fail("Operação cancelada manualmente pelo usuário.");

    // Override status text specifically for clarity
    this.el.status.innerText = "CANCELADO";
    this.el.status.style.color = "var(--color-error)"; // Reuse error red
    this.el.eta.innerText = "TEMPO: CANCELADO";

    // Ensure minimized button is RED (fail does this, but being explicit doesn't hurt)
    this.container.classList.remove("term-status-success");
    this.container.classList.add("term-status-error");

    // Additional UI Cleanup specific to toggle
    if (this.el.cancelBtn) {
      this.el.cancelBtn.classList.add("disabled");
      this.el.cancelBtn.disabled = true;
      this.el.cancelBtn.innerText = "Cancelado";
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
