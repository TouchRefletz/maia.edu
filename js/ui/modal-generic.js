/**
 * Modal Genérico para exibição de conteúdo arbitrário
 */
export function showGenericModal({ title, content, maxWidth = "600px" }) {
    return new Promise((resolve) => {
        // Overlay
        const overlay = document.createElement("div");
        overlay.className = "modal-overlay custom-generic-overlay hidden";
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
            z-index: 10000; opacity: 0; transition: opacity 0.3s ease;
        `;

        // Content Container
        const container = document.createElement("div");
        container.className = "modal-content custom-generic-content";
        container.style.cssText = `
            background: var(--color-surface, #1e1e1e);
            border: 1px solid var(--color-border, rgba(255,255,255,0.1));
            border-radius: 16px;
            width: 90%;
            max-width: ${maxWidth};
            max-height: 85vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 40px rgba(0,0,0,0.4);
            transform: translateY(20px);
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            overflow: hidden;
        `;

        // Header
        const header = document.createElement("div");
        header.style.cssText = `
            padding: 20px 24px;
            border-bottom: 1px solid var(--color-border, rgba(255,255,255,0.1));
            display: flex;
            align-items: center;
            justify-content: space-between;
        `;
        header.innerHTML = `
            <h2 style="margin: 0; font-size: 1.25rem; font-weight: 600; color: var(--color-text, #fff);">${title}</h2>
            <button class="modal-close-btn" style="
                background: rgba(255,255,255,0.05); border: none; 
                width: 32px; height: 32px; border-radius: 50%;
                color: var(--color-text-secondary, #aaa); cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                transition: all 0.2s ease;
            ">✕</button>
        `;

        // Body
        const body = document.createElement("div");
        body.style.cssText = `
            padding: 24px;
            overflow-y: auto;
            flex: 1;
        `;
        
        if (typeof content === "string") {
            body.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            body.appendChild(content);
        }

        container.appendChild(header);
        container.appendChild(body);
        overlay.appendChild(container);
        document.body.appendChild(overlay);

        // Animação entrada
        requestAnimationFrame(() => {
            overlay.style.opacity = "1";
            container.style.transform = "translateY(0)";
            overlay.classList.remove("hidden");
        });

        // Utils
        const close = () => {
            overlay.style.opacity = "0";
            container.style.transform = "translateY(20px)";
            setTimeout(() => {
                if (document.body.contains(overlay)) {
                    document.body.removeChild(overlay);
                }
                resolve();
            }, 300);
        };

        // Listeners
        const closeBtn = header.querySelector(".modal-close-btn");
        closeBtn.onclick = close;
        closeBtn.onmouseenter = () => { closeBtn.style.background = "rgba(255,255,255,0.1)"; closeBtn.style.color = "#fff"; };
        closeBtn.onmouseleave = () => { closeBtn.style.background = "rgba(255,255,255,0.05)"; closeBtn.style.color = "#aaa"; };

        overlay.onclick = (e) => {
            if (e.target === overlay) close();
        };

        const keyHandler = (e) => {
            if (e.key === "Escape") {
                document.removeEventListener("keydown", keyHandler);
                close();
            }
        };
        document.addEventListener("keydown", keyHandler);
    });
}
