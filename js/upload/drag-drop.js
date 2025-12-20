/**
 * 2. UTILITÁRIO DE DRAG & DROP
 * Função genérica para ativar o arrastar e soltar em qualquer elemento.
 */
export function setupDragAndDrop(dropZone, inputElement, displayElement) {
  const events = ['dragenter', 'dragover', 'dragleave', 'drop'];

  // Prevenir padrão
  events.forEach((evt) => {
    dropZone.addEventListener(
      evt,
      (e) => {
        e.preventDefault();
        e.stopPropagation();
      },
      false
    );
  });

  // Efeitos visuais
  ['dragenter', 'dragover'].forEach((evt) =>
    dropZone.addEventListener(
      evt,
      () => dropZone.classList.add('drag-over'),
      false
    )
  );
  ['dragleave', 'drop'].forEach((evt) =>
    dropZone.addEventListener(
      evt,
      () => dropZone.classList.remove('drag-over'),
      false
    )
  );

  // Lógica do Drop
  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      if (files[0].type !== 'application/pdf') {
        alert('Por favor, solte apenas arquivos PDF.');
        return;
      }
      inputElement.files = files; // Atribui ao input
      displayElement.textContent = files[0].name;
      displayElement.style.color = 'var(--color-text-secondary)';
    }
  });

  // Lógica do Input Change (clique normal)
  inputElement.addEventListener('change', (e) => {
    displayElement.textContent =
      e.target.files[0]?.name || 'Nenhum arquivo selecionado';
    if (e.target.files[0])
      displayElement.style.color = 'var(--color-text-secondary)';
  });
}
