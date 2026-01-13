// js/cropper/cropper-state.js

export const CropperState = {
  groups: [], // { id, label, crops: [], status: 'draft'|'sent' }
  activeGroupId: null,
  nextId: 1,

  // Listeners para reatividade simples
  listeners: [],

  // UNDO/REDO SYSTEM
  historyStack: [], // Stack de estados anteriores para undo
  redoStack: [], // Stack de estados para redo
  maxHistorySize: 50, // Limite de histórico para evitar memory leak
  editingSnapshot: null, // Snapshot do estado quando entrou no modo edição

  // PALETA DE CORES VIBRANTES PARA QUESTÕES (16 cores)
  colorPalette: [
    "#00BCD4", // Cyan (Default - Q1)
    "#E91E63", // Pink (Q2)
    "#4CAF50", // Green (Q3)
    "#FF9800", // Orange (Q4)
    "#9C27B0", // Purple (Q5)
    "#3F51B5", // Indigo (Q6)
    "#FFEB3B", // Yellow (Q7 - Text needs contrast? Use darker border)
    "#795548", // Brown (Q8)
    "#F44336", // Red (Q9)
    "#607D8B", // Blue Grey (Q10)
    "#009688", // Teal (Q11)
    "#673AB7", // Deep Purple (Q12)
    "#FF5722", // Deep Orange (Q13)
    "#8BC34A", // Light Green (Q14)
    "#03A9F4", // Light Blue (Q15)
    "#CDDC39", // Lime (Q16)
  ],

  getGroupColor(group) {
    if (!group) return "#00BCD4"; // Default
    // Removed draft check to allow color variation during creation/draft

    // Fix: Force distinct color for Slot Mode (consistent UX)
    if (group.tags && group.tags.includes("slot-mode")) {
      return "#ff00f2ff"; // Pink
    }

    // Se tiver externalId (IA), tenta usar o número da questão para cor consistente
    // Se for Manual, usa o ID interno do grupo
    let index = 0;
    if (group.externalId && /^\d+$/.test(group.externalId)) {
      index = parseInt(group.externalId, 10);
    } else {
      index = group.id;
    }

    // Ajusta indice (0-based)
    if (index > 0) index = index - 1;

    return this.colorPalette[index % this.colorPalette.length];
  },

  subscribe(callback) {
    this.listeners.push(callback);
    return () =>
      (this.listeners = this.listeners.filter((cb) => cb !== callback));
  },

  notify() {
    this.listeners.forEach((cb) => cb(this));
  },

  // --- UNDO/REDO METHODS ---

  // Salva o estado atual no histórico (chamado antes de modificações)
  saveHistory() {
    const snapshot = this._createSnapshot();
    this.historyStack.push(snapshot);

    // Limita tamanho do histórico
    if (this.historyStack.length > this.maxHistorySize) {
      this.historyStack.shift();
    }

    // Limpa redo stack quando nova ação é feita
    this.redoStack = [];
  },

  // Cria uma cópia profunda do estado atual
  _createSnapshot() {
    return {
      groups: JSON.parse(JSON.stringify(this.groups)),
      activeGroupId: this.activeGroupId,
      nextId: this.nextId,
    };
  },

  // Restaura um snapshot
  _restoreSnapshot(snapshot) {
    this.groups = JSON.parse(JSON.stringify(snapshot.groups));
    this.activeGroupId = snapshot.activeGroupId;
    this.nextId = snapshot.nextId;
  },

  // Desfaz última ação
  undo() {
    if (this.historyStack.length === 0) return false;

    // Salva estado atual no redo stack
    this.redoStack.push(this._createSnapshot());

    // Restaura estado anterior
    const previousState = this.historyStack.pop();
    this._restoreSnapshot(previousState);

    this.notify();
    return true;
  },

  // Refaz ação desfeita
  redo() {
    if (this.redoStack.length === 0) return false;

    // Salva estado atual no history stack
    this.historyStack.push(this._createSnapshot());

    // Restaura próximo estado
    const nextState = this.redoStack.pop();
    this._restoreSnapshot(nextState);

    this.notify();
    return true;
  },

  canUndo() {
    return this.historyStack.length > 0;
  },

  canRedo() {
    return this.redoStack.length > 0;
  },

  // Salva snapshot ao entrar no modo edição (para Reverter)
  saveEditingSnapshot() {
    this.editingSnapshot = this._createSnapshot();
    // Limpa histórico anterior para começar "limpo" na edição
    this.historyStack = [];
    this.redoStack = [];
  },

  // Reverte para o estado quando entrou no modo edição
  revert() {
    if (!this.editingSnapshot) return false;

    this._restoreSnapshot(this.editingSnapshot);
    this.historyStack = [];
    this.redoStack = [];

    this.notify();
    return true;
  },

  // Limpa snapshot ao sair do modo edição
  clearEditingSnapshot() {
    this.editingSnapshot = null;
    this.historyStack = [];
    this.redoStack = [];
  },

  // Actions
  createGroup(options = {}) {
    const id = this.nextId++;
    // O Label será ajustado pelo renumberGroups, mas definimos um inicial
    const newGroup = {
      id,
      label: `Questão`, // Placeholder
      crops: [],
      tags: options.tags || [], // New: Tags support (manual, ia, revisada)
      externalId: options.externalId || null, // ID externo (ex: do JSON da IA) para merging
      tipo: options.tipo || "questao_completa", // Guarda se nasceu como parte ou completa
      // Visual Status: 'draft' (default/gray) | 'verified' (cyan) | 'sent' (final)
      status: options.status || "draft",
    };
    this.groups.push(newGroup);
    this.renumberGroups(); // Garante o número correto sequencial
    this.activeGroupId = id;
    this.notify();
    return newGroup;
  },

  // Remove groups from a specific page that match a status (e.g., clear drafts)
  removeGroupsByPageAndStatus(pageNum, status) {
    // Filter out groups that match conditions
    const initialLength = this.groups.length;
    this.groups = this.groups.filter((g) => {
      // Check if group belongs to page (based on its first crop anchor)
      if (g.crops.length === 0) return true; // Keep empty groups? Or remove? Let's keep for now unless explicit.

      const firstCrop = g.crops[0];
      if (
        firstCrop.anchorData.anchorPageNum === pageNum &&
        g.status === status
      ) {
        return false; // Remove
      }
      return true; // Keep
    });

    if (this.groups.length !== initialLength) {
      if (
        this.activeGroupId &&
        !this.groups.find((g) => g.id === this.activeGroupId)
      ) {
        this.activeGroupId = null;
      }
      this.renumberGroups();
      this.notify();
    }
  },

  renumberGroups() {
    this.groups.forEach((group, index) => {
      group.label = `Questão ${index + 1}`;
    });
  },

  setActiveGroup(id) {
    // Se passar null, fecha o modo de edição
    if (id === null && this.activeGroupId !== null) {
      // Saindo do modo edição - limpa snapshot
      this.clearEditingSnapshot();
    } else if (id !== null && this.activeGroupId === null) {
      // Entrando no modo edição - salva snapshot
      this.saveEditingSnapshot();
    }

    this.activeGroupId = id;
    this.notify();
  },

  addCropToActiveGroup(cropData) {
    if (!this.activeGroupId) return;
    const group = this.groups.find((g) => g.id === this.activeGroupId);
    if (group) {
      this.saveHistory(); // Salva estado para undo

      // 'slot-mode' special behavior: Only one crop allowed per group (uni-crop).
      // If the group is in slot mode, clear any existing crops before adding the new one.
      if (group.tags && group.tags.includes("slot-mode")) {
        group.crops = [];
      }

      // Gera um ID único para o crop caso precisemos referenciar individualmente
      cropData.id = Date.now() + Math.random();
      group.crops.push(cropData);
      this.notify();
    }
  },

  addCropToGroup(groupId, cropData) {
    const group = this.groups.find((g) => g.id === groupId);
    if (group) {
      cropData.id = Date.now() + Math.random();
      group.crops.push(cropData);
      this.notify();
    }
  },

  findGroupByExternalId(externalId) {
    if (!externalId) return null;

    // Helper to normalize IDs (e.g. "06" -> "6")
    const normalize = (val) => {
      if (val == null) return "";
      const s = String(val).trim();
      // If purely numeric, convert to integer string to remove leading zeros
      if (/^\d+$/.test(s)) {
        return String(parseInt(s, 10));
      }
      return s;
    };

    const searchId = String(externalId);

    // 1. Try exact match
    const exact = this.groups.find((g) => g.externalId === searchId);
    if (exact) return exact;

    // 2. Try normalized match
    const searchNorm = normalize(searchId);

    return this.groups.find((g) => normalize(g.externalId) === searchNorm);
  },

  removeLastCropFromActiveGroup() {
    if (!this.activeGroupId) return;
    const group = this.groups.find((g) => g.id === this.activeGroupId);
    if (group && group.crops.length > 0) {
      this.saveHistory(); // Salva estado para undo
      group.crops.pop();
      this.notify();
    }
  },

  updateCrop(cropId, newAnchorData) {
    if (!this.activeGroupId) return;
    const group = this.groups.find((g) => g.id === this.activeGroupId);
    if (group) {
      const cropIndex = group.crops.findIndex((c) => c.id === cropId);
      if (cropIndex !== -1) {
        this.saveHistory(); // Salva estado para undo
        group.crops[cropIndex].anchorData = newAnchorData;
        this.notify();
      }
    }
  },

  deleteGroup(id) {
    this.groups = this.groups.filter((g) => g.id !== id);
    if (this.activeGroupId === id) {
      this.activeGroupId = null;
    }
    this.renumberGroups(); // Reajusta os números após exclusão
    this.notify();
  },

  getActiveGroup() {
    return this.groups.find((g) => g.id === this.activeGroupId);
  },

  getAllCrops() {
    // Retorna flat list de todos os crops para renderização
    // active: booleano para style
    return this.groups.flatMap((g) => {
      const color = this.getGroupColor(g);
      return g.crops.map((c) => ({
        ...c,
        groupId: g.id,
        status: g.status, // Propagate group status to crop
        tipo: c.tipo || g.tipo || "questao_completa", // Propagate type (from crop specific or group default)
        color, // Propagate calculated color
        isActiveGroup: g.id === this.activeGroupId,
      }));
    });
  },

  // Constraints
  pageConstraint: null, // { pageNum: number } or null

  setPageConstraint(pageNum) {
    this.pageConstraint = pageNum ? { pageNum } : null;
    // Não necessariamente notifica, pois isso afeta a lógica de interação (pointer logic), não o render dos crops existentes.
    // Mas se quisermos limpar crops fora da página, seria aqui. Por enquanto, só restrição de NOVA criação.
  },
};
