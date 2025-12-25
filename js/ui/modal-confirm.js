/**
 * Exibe um modal de confirmação para edição do título da prova.
 * @param {string} currentTitle - O título atual da prova.
 * @returns {Promise<string|null>} - Retorna o novo título se confirmado, ou null se cancelado.
 */
export function showTitleConfirmationModal(currentTitle) {
    return new Promise((resolve) => {
        // Criação do Overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay custom-confirm-overlay hidden'; // Reusing base modal-overlay + custom class + hidden for animation

        // Criação do Content
        const content = document.createElement('div');
        content.className = 'modal-content custom-confirm-content'; // Reusing base modal-content + custom class

        // Header
        const header = document.createElement('div');
        header.className = 'modal-header';
        header.innerHTML = `<h2>Confirmar Título</h2>`;

        // Body
        const body = document.createElement('div');
        body.className = 'modal-body';

        const desc = document.createElement('p');
        desc.innerText = "Verifique se o título e a versão da prova estão corretos. Você pode editar se necessário.";

        const inputGroup = document.createElement('div');
        inputGroup.className = 'form-group';

        const label = document.createElement('label');
        label.className = 'form-label';
        label.innerText = 'Título da Prova';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control';
        input.value = currentTitle;
        // Auto-select text on focus
        setTimeout(() => input.select(), 100);

        inputGroup.appendChild(label);
        inputGroup.appendChild(input);
        body.appendChild(desc);
        body.appendChild(inputGroup);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'modal-footer';
        footer.style.display = 'flex';
        footer.style.justifyContent = 'flex-end';
        footer.style.gap = '10px';

        const btnCancel = document.createElement('button');
        btnCancel.className = 'btn btn--outline';
        btnCancel.innerText = 'Cancelar';

        const btnConfirm = document.createElement('button');
        btnConfirm.className = 'btn btn--primary';
        btnConfirm.innerText = 'Confirmar e Extrair';

        footer.appendChild(btnCancel);
        footer.appendChild(btnConfirm);

        // Montagem
        content.appendChild(header);
        content.appendChild(body);
        content.appendChild(footer);
        overlay.appendChild(content);
        document.body.appendChild(overlay);

        // Animação de entrada
        requestAnimationFrame(() => {
            overlay.classList.remove('hidden'); // Assuming modal-overlay might start hidden or we handle opacity
            // Se baseando no modal.css original, ele tem opacity:1 por padrão e hidden opcional.
            // Vamos garantir que ele apareça.
        });

        // Handlers
        const close = (value) => {
            overlay.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(overlay)) {
                    document.body.removeChild(overlay);
                }
                resolve(value);
            }, 300); // Wait for transition
        };

        btnCancel.onclick = () => close(null);

        btnConfirm.onclick = () => {
            const newTitle = input.value.trim();
            if (!newTitle) {
                input.classList.add('error'); // Simple visual feedback
                return;
            }
            close(newTitle);
        };

        // Close on click outside
        overlay.onclick = (e) => {
            if (e.target === overlay) close(null);
        };

        // Enter key to confirm
        input.onkeyup = (e) => {
            if (e.key === 'Enter') btnConfirm.click();
            if (e.key === 'Escape') btnCancel.click();
        };
    });
}
