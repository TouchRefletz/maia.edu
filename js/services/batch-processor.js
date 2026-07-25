/**
 * BatchProcessor - Processamento Sequencial de Questões
 *
 * Gerencia a fila de questões para processamento via IA,
 * aguardando extração de imagens antes de avançar para a próxima.
 */

import { CropperState } from '../cropper/cropper-state.js';
import { salvarQuestaoEmLote } from '../cropper/save-handlers.js';
import { customAlert } from '../ui/GlobalAlertsLogic.tsx';

class BatchProcessorClass {
  constructor() {
    this.queue = []; // IDs dos grupos para processar
    this.isRunning = false;
    this.currentGroupId = null;
    this.currentTabId = null;
    this.pendingImageSlots = new Set(); // slots aguardando preenchimento
    this.processedCount = 0;
    this.totalCount = 0;

    // Bind event handlers
    this._onSlotFilled = this._onSlotFilled.bind(this);
    this._onQuestionComplete = this._onQuestionComplete.bind(this);
  }

  /**
   * Inicia o processamento batch de todos os grupos com tag "ia"
   */
  async start() {
    // Coletar grupos criados pela IA que ainda não foram processados
    const iaGroups = CropperState.groups.filter(
      (g) => g.tags && g.tags.includes('ia') && g.status !== 'sent' && g.status !== 'ready',
    );

    if (iaGroups.length === 0) {
      console.log('[BatchProcessor] Nenhum grupo para processar');

      // Mostra popup informando que nenhuma questão foi extraída
      customAlert(
        '⚠️ Nenhuma questão foi extraída automaticamente. Verifique se o PDF contém questões ou tente novamente.',
        5000,
      );

      // Finaliza o scanner (remove glow, reseta header)
      try {
        const { AiScanner } = await import('./ai-scanner.js');
        AiScanner.finish();
      } catch (e) {
        console.warn('[BatchProcessor] Erro ao finalizar AiScanner:', e);
      }

      return;
    }

    this.queue = iaGroups.map((g) => g.id);
    this.totalCount = this.queue.length;
    this.processedCount = 0;
    this.isRunning = true;

    console.log(`[BatchProcessor] Iniciando processamento de ${this.totalCount} questões`);

    // Registrar event listeners
    window.addEventListener('batch-slot-filled', this._onSlotFilled);
    window.addEventListener('question-processing-complete', this._onQuestionComplete);

    // Iniciar processamento da primeira questão
    await this.processNext();
  }

  /**
   * Processa a próxima questão da fila
   */
  async processNext() {
    if (this.queue.length === 0) {
      this.finish();
      return;
    }

    this.currentGroupId = this.queue.shift();
    this.pendingImageSlots.clear();

    const group = CropperState.groups.find((g) => g.id === this.currentGroupId);
    if (!group) {
      console.warn(`[BatchProcessor] Grupo ${this.currentGroupId} não encontrado, pulando`);
      await this.processNext();
      return;
    }

    console.log(
      `[BatchProcessor] Processando: ${group.label} (${this.totalCount - this.queue.length}/${this.totalCount})`,
    );

    // Atualiza status visual
    customAlert(
      `Processando ${group.label}... (${this.processedCount + 1}/${this.totalCount})`,
      3000,
    );

    // Dispara o processamento via IA
    // O salvarQuestaoEmLote cria a aba e chama confirmarEnvioIA
    try {
      const { createQuestionTab, updateTabStatus, addLogToQuestionTab } = await import(
        '../ui/sidebar-tabs.js'
      );

      // [BATCH FIX] Cria aba em BACKGROUND (autoActivate: false) para evitar que
      // o Hub perca foco e as abas anteriores sejam escondidas enquanto ainda renderizam.
      this.currentTabId = createQuestionTab(group.id, group.label, {
        autoActivate: false,
      });

      // Mantém Hub ativo e faz scroll para o card da questão

      // [BATCH FIX] Força re-render da sidebar para mostrar status "Em processamento" no card
      CropperState.notify();

      updateTabStatus(this.currentTabId, {
        status: 'processing',
        progress: 10,
      });
      addLogToQuestionTab(this.currentTabId, 'Iniciando processamento batch...');

      // Scroll para o card da questão no Hub (sidebar)
      this._scrollToQuestionCard(group.id);

      // Processa a questão
      await salvarQuestaoEmLote(group.id, this.currentTabId);
    } catch (err) {
      console.error(`[BatchProcessor] Erro ao processar ${group.label}:`, err);
      // Continua para a próxima mesmo com erro
      this.processedCount++;
      await this.processNext();
    }
  }

  /**
   * Registra slots pendentes de preenchimento e inicia extração automática com IA
   * Chamado após renderização da questão
   */
  registerPendingSlots(slotIds) {
    if (!this.isRunning) return;

    slotIds.forEach((id) => this.pendingImageSlots.add(id));
    console.log(`[BatchProcessor] ${slotIds.length} image slots pendentes`);

    // [BATCH FIX] Inicia extração automática de imagem para cada slot
    // Isso substitui a dependência do componente React que só monta quando a aba está ativa
    this._triggerAutoImageExtraction(slotIds);
  }

  /**
   * [BATCH FIX] Dispara extração automática de imagem para slots vazios
   * usando IA, sem depender do componente React estar montado
   */
  async _triggerAutoImageExtraction(slotIds) {
    const group = CropperState.groups.find((g) => g.id === this.currentGroupId);
    if (!group || !group.crops || group.crops.length === 0) {
      console.log('[BatchProcessor] Sem bounds de questão para extração de imagem');
      return;
    }

    try {
      const { extractImagesFromRegion } = await import('./ai-image-extractor.js');

      // Pega a primeira página dos crops como base
      const firstCrop = group.crops[0];
      const pageNum = firstCrop.anchorData?.anchorPageNum || 1;

      // Calcula bounds normalizados (0-1000)
      const wrapper = document.getElementById(`page-wrapper-${pageNum}`);
      if (!wrapper) {
        console.log('[BatchProcessor] Page wrapper não encontrado');
        return;
      }

      const currentScale = window.viewerState?.pdfScale || 1.0;
      const wrapperWidth = wrapper.offsetWidth / currentScale;
      const wrapperHeight = wrapper.offsetHeight / currentScale;

      const anchorData = firstCrop.anchorData;
      const questionBounds = {
        x: Math.round((anchorData.relativeLeft / wrapperWidth) * 1000),
        y: Math.round((anchorData.relativeTop / wrapperHeight) * 1000),
        w: Math.round((anchorData.unscaledW / wrapperWidth) * 1000),
        h: Math.round((anchorData.unscaledH / wrapperHeight) * 1000),
      };

      console.log(`[BatchProcessor] Iniciando extração automática de imagem (página ${pageNum})`);

      const result = await extractImagesFromRegion(pageNum, questionBounds, {
        onStatus: (msg) => console.log(`[BatchProcessor AI] ${msg}`),
        onThought: (thought) =>
          console.log(`[BatchProcessor AI] Pensando: ${thought.slice(0, 50)}...`),
      });

      if (result.success && result.crops && result.crops.length > 0) {
        // Preenche os slots com as imagens encontradas
        for (let i = 0; i < Math.min(slotIds.length, result.crops.length); i++) {
          const slotId = slotIds[i];
          const crop = result.crops[i];

          console.log(`[BatchProcessor] Preenchendo slot ${slotId} com imagem detectada`);

          // Usa a função global para preencher o slot
          if (window.confirmAISlotDirectly) {
            await window.confirmAISlotDirectly(slotId, pageNum, crop);
          }
        }
      } else {
        console.log(
          `[BatchProcessor] Nenhuma imagem encontrada: ${result.error || 'desconhecido'}`,
        );
        // Se não encontrou imagens, remove os slots pendentes e continua
        slotIds.forEach((id) => this.pendingImageSlots.delete(id));
      }
    } catch (err) {
      console.error('[BatchProcessor] Erro na extração de imagem:', err);
      // Em caso de erro, remove os slots pendentes para não travar
      slotIds.forEach((id) => this.pendingImageSlots.delete(id));
    }
  }

  /**
   * Handler: quando um ImageSlot é preenchido
   */
  _onSlotFilled(event) {
    if (!this.isRunning) return;

    const { slotId } = event.detail || {};
    if (slotId === undefined || slotId === null) return;

    // [FIX] O slotId pode vir como número (0, 1, 2) ou como string prefixada ("questao_img_0")
    // Tentamos remover ambos os formatos para garantir compatibilidade
    const numericId =
      typeof slotId === 'number' ? slotId : parseInt(String(slotId).match(/(\d+)$/)?.[1] || slotId);
    const prefixedId = `questao_img_${numericId}`;

    // Remove o que estiver no Set
    this.pendingImageSlots.delete(slotId);
    this.pendingImageSlots.delete(String(slotId));
    this.pendingImageSlots.delete(numericId);
    this.pendingImageSlots.delete(String(numericId));
    this.pendingImageSlots.delete(prefixedId);

    console.log(
      `[BatchProcessor] Slot ${slotId} preenchido. Restantes: ${this.pendingImageSlots.size}`,
    );

    // [FIX] Quando todos os slots foram preenchidos, avança para a próxima questão
    if (this.pendingImageSlots.size === 0) {
      console.log('[BatchProcessor] Todos os slots preenchidos! Avançando...');
      // skipWait=true porque já esperamos pelo preenchimento dos slots
      this._markCurrentAsReady(true);
    }
  }

  /**
   * Handler: quando a questão termina o processamento inicial da IA
   */
  _onQuestionComplete(event) {
    if (!this.isRunning) return;

    const { tabId, hasImageSlots, slotIds } = event.detail || {};

    if (tabId !== this.currentTabId) return;

    console.log(`[BatchProcessor] Questão processada. hasImageSlots: ${hasImageSlots}`);

    if (hasImageSlots && slotIds && slotIds.length > 0) {
      // Tem slots pendentes, registrar e aguardar
      this.registerPendingSlots(slotIds);
    } else {
      // Não tem slots, marcar como pronto e avançar
      this._markCurrentAsReady();
    }
  }

  /**
   * Scroll para o card da questão no Hub (sidebar)
   */
  _scrollToQuestionCard(groupId) {
    // Aguarda um pouco para o card ser renderizado
    setTimeout(() => {
      // Busca o card pelo groupId no DOM
      const allCards = document.querySelectorAll('.cropper-group-item');
      const group = CropperState.groups.find((g) => g.id === groupId);

      if (!group) return;

      for (const card of allCards) {
        // Encontra o card baseado no label do grupo
        if (card.textContent.includes(group.label)) {
          // Abre a página que contém o card
          const parentDetails = card.closest('.page-details-group');
          if (parentDetails) {
            parentDetails.open = true;
          }

          // Scroll para centralizar o card
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          break;
        }
      }
    }, 300);
  }

  /**
   * Marca a questão atual como pronta para envio
   * @param {boolean} skipWait - Se true, pula a espera (chamado quando slots já preenchidos)
   */
  async _markCurrentAsReady(skipWait = false) {
    const group = CropperState.groups.find((g) => g.id === this.currentGroupId);
    if (group) {
      group.status = 'ready';
      CropperState.notify(); // Dispara re-render da sidebar
    }

    // Se não pular espera E tiver slots pendentes, aguarda dinamicamente
    if (!skipWait && this.pendingImageSlots.size > 0) {
      console.log(
        `[BatchProcessor] Aguardando ${this.pendingImageSlots.size} slots serem preenchidos...`,
      );
      await this._waitForAllSlots();
    } else if (!skipWait) {
      // Sem slots pendentes, apenas um delay curto para UI
      await new Promise((r) => setTimeout(r, 3000));
    }

    console.log(`[BatchProcessor] Questão ${group?.label} pronta! Avançando...`);

    // Scroll para o card da próxima questão (se houver)
    if (this.queue.length > 0) {
      this._scrollToQuestionCard(this.queue[0]);
    }

    this.processedCount++;
    this.currentGroupId = null;
    this.currentTabId = null;

    // Próxima questão
    await new Promise((r) => setTimeout(r, 500));
    await this.processNext();
  }

  /**
   * Espera TODOS os slots serem preenchidos (via eventos batch-slot-filled)
   * Timeout máximo de 2 minutos por segurança
   */
  _waitForAllSlots() {
    const TIMEOUT_MS = 120000; // 2 minutos máximo

    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkSlots = () => {
        // Todos preenchidos?
        if (this.pendingImageSlots.size === 0) {
          console.log('[BatchProcessor] Todos os slots preenchidos!');
          resolve();
          return;
        }

        // Timeout?
        if (Date.now() - startTime >= TIMEOUT_MS) {
          console.log(
            `[BatchProcessor] Timeout! ${this.pendingImageSlots.size} slots ainda pendentes.`,
          );
          resolve();
          return;
        }

        // Continua verificando a cada 1s
        setTimeout(checkSlots, 1000);
      };

      // Inicia verificação após 5s (espera countdown da extração automática)
      setTimeout(checkSlots, 5000);
    });
  }

  /**
   * Finaliza o processamento batch
   */
  async finish() {
    this.isRunning = false;

    // Remove listeners
    window.removeEventListener('batch-slot-filled', this._onSlotFilled);
    window.removeEventListener('question-processing-complete', this._onQuestionComplete);

    console.log(`[BatchProcessor] Concluído! ${this.processedCount} questões processadas`);

    // [IMPORTANTE] Finaliza o AiScanner (remove glow, reseta header, etc)
    try {
      const { AiScanner } = await import('./ai-scanner.js');
      AiScanner.finish();
    } catch (err) {
      console.error('[BatchProcessor] Erro ao finalizar AiScanner:', err);
    }

    // Mostra popup de conclusão
    this._showCompletionModal();
  }

  /**
   * Mostra modal explicando que deve revisar e enviar individualmente
   */
  _showCompletionModal() {
    // Criar modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'batch-completion-modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.3s ease;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: var(--color-surface, #1e1e2e);
      border: 1px solid var(--border-color, #333);
      border-radius: 12px;
      padding: 32px;
      max-width: 480px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
      animation: slideUp 0.3s ease;
    `;

    modal.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
      <h2 style="color: var(--color-text-primary, #fff); margin: 0 0 12px 0; font-size: 1.5rem;">
        Extração Concluída!
      </h2>
      <p style="color: var(--color-text-secondary, #a0aec0); margin: 0 0 8px 0; font-size: 1rem;">
        <strong>${this.processedCount}</strong> questões foram processadas automaticamente.
      </p>
      <div style="
        background: rgba(251, 191, 36, 0.1);
        border: 1px solid rgba(251, 191, 36, 0.3);
        border-radius: 8px;
        padding: 16px;
        margin: 20px 0;
        text-align: left;
      ">
        <div style="color: #fbbf24; font-weight: 600; margin-bottom: 8px;">
          ⚠️ Atenção
        </div>
        <ul style="color: var(--color-text-secondary, #a0aec0); margin: 0; padding-left: 20px; font-size: 0.9rem; line-height: 1.6;">
          <li>Revise cada questão <strong>individualmente</strong></li>
          <li>Verifique se o resultado da IA está correto</li>
          <li>Envie cada questão <strong>manualmente</strong> para o banco</li>
        </ul>
      </div>
      <button id="batch-completion-ok-btn" style="
        background: var(--color-primary, #6366f1);
        color: white;
        border: none;
        padding: 12px 32px;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      ">
        Entendi
      </button>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Fechar ao clicar no botão
    document.getElementById('batch-completion-ok-btn').onclick = () => {
      overlay.style.animation = 'fadeOut 0.2s ease';
      setTimeout(() => overlay.remove(), 200);
    };

    // Fechar ao clicar fora
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.style.animation = 'fadeOut 0.2s ease';
        setTimeout(() => overlay.remove(), 200);
      }
    };
  }

  /**
   * Cancela o processamento batch
   */
  cancel() {
    if (!this.isRunning) return;

    console.log('[BatchProcessor] Cancelado pelo usuário');
    this.queue = [];
    this.isRunning = false;

    window.removeEventListener('batch-slot-filled', this._onSlotFilled);
    window.removeEventListener('question-processing-complete', this._onQuestionComplete);

    customAlert('Processamento batch cancelado', 2000);
  }
}

// Singleton export
export const BatchProcessor = new BatchProcessorClass();
