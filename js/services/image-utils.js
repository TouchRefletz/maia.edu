
/**
 * Converte um Canvas para Blob (Promise)
 * @param {HTMLCanvasElement} canvas 
 * @param {string} mimeType 
 * @param {number} quality 
 * @returns {Promise<Blob>}
 */
export function canvasToBlob(canvas, mimeType = 'image/png', quality = 1.0) {
    return new Promise((resolve, reject) => {
        try {
            canvas.toBlob((blob) => {
                if (!blob) reject(new Error('Falha ao criar Blob do canvas'));
                else resolve(blob);
            }, mimeType, quality);
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Converte uma URL (Blob ou HTTP) para Base64.
 * Útil para enviar para APIs que exigem Base64.
 * @param {string} url 
 * @returns {Promise<string>}
 */
export async function urlToBase64(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
