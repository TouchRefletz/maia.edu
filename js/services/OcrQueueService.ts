import Tesseract from 'tesseract.js';
import { customAlert } from '../ui/GlobalAlertsLogic';

interface OcrTask {
    id: string;
    imageBlobUrl: string;
    elementId: string;
    status: 'pending' | 'processing' | 'done' | 'error';
    result?: string;
}

class OcrQueueService {
    private queue: OcrTask[] = [];
    private processing: boolean = false;

    public addToQueue(imageBlobUrl: string, elementId: string) {
        const task: OcrTask = {
            id: Math.random().toString(36).substr(2, 9),
            imageBlobUrl,
            elementId,
            status: 'pending',
        };
        this.queue.push(task);
        this.notifyStatus(task, 'Fila: Aguardando processamento...');
        this.processQueue();
    }

    private async processQueue() {
        if (this.processing || this.queue.length === 0) return;

        this.processing = true;
        const task = this.queue.shift();

        if (task) {
            await this.runOcr(task);
            // Process next
            this.processing = false;
            this.processQueue();
        } else {
            this.processing = false;
        }
    }

    private async runOcr(task: OcrTask) {
        task.status = 'processing';
        this.notifyStatus(task, 'Processando OCR...');

        try {
            // Update UI to show spinner or text
            this.updateFieldStatus(task.elementId, '⏳ Lendo imagem...');

            const result = await Tesseract.recognize(
                task.imageBlobUrl,
                'por', // Portuguese
                {
                    logger: (m) => {
                        if (m.status === 'recognizing text') {
                            this.updateFieldStatus(task.elementId, `⏳ Lendo: ${Math.round(m.progress * 100)}%`);
                        }
                    }
                }
            );

            task.result = result.data.text;
            task.status = 'done';

            this.applyResult(task);

            customAlert('✅ OCR Concluído para o campo!', 3000);
        } catch (error) {
            console.error('OCR Error:', error);
            task.status = 'error';
            this.updateFieldStatus(task.elementId, '❌ Erro no OCR');
            customAlert('❌ Erro ao processar OCR.', 3000);
        }
    }

    private updateFieldStatus(elementId: string, statusText: string) {
        // Find the input or its container and add/update a status indicator
        // Strategy: look for a status span next to the input, or create one.
        const input = document.getElementById(elementId);
        if (!input) {
            // Fallback context aware search?
            return;
        }

        let statusSpan = document.getElementById(elementId + '_status');
        if (!statusSpan) {
            statusSpan = document.createElement('span');
            statusSpan.id = elementId + '_status';
            statusSpan.style.fontSize = '11px';
            statusSpan.style.color = '#666';
            statusSpan.style.marginLeft = '10px';

            // Insert after the input (or its wrapper)
            // For structure items, the input might be inside a wrapper.
            input.parentNode?.insertBefore(statusSpan, input.nextSibling);
        }
        statusSpan.innerText = statusText;
    }

    private applyResult(task: OcrTask) {
        const input = document.getElementById(task.elementId) as HTMLInputElement | HTMLTextAreaElement;
        if (input) {
            // Preserve existing content if specifically asked, or append? 
            // User said "regenerate the field". Usually implies replacement or filling empty.
            // Let's replace for now, or maybe append if not empty? 
            // "Regenerar" implies overwrite. 
            // But maybe user cropped a PART. 
            // Let's overwite.

            input.value = task.result || '';

            // Trigger change event for React or legacy listeners
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));

            this.updateFieldStatus(task.elementId, ''); // Clear status
        }
    }

    private notifyStatus(task: OcrTask, msg: string) {
        console.log(`[OCR Task ${task.id}] ${msg}`);
    }
}

export const ocrService = new OcrQueueService();
