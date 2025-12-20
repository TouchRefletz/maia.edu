import { gerarVisualizadorPDF } from '../viewer/events.js';

/**
 * 3. LÓGICA DO FORMULÁRIO
 * Lida com preenchimento inicial, checkbox e submit.
 */
export function setupFormLogic(elements, initialData) {
  const {
    titleInput,
    gabaritoCheck,
    gabaritoGroup,
    gabaritoInput,
    form,
    pdfInput,
  } = elements;

  // A. Lógica de Checkbox (Esconder/Mostrar Gabarito)
  const toggleGabarito = () => {
    if (gabaritoCheck.checked) {
      gabaritoGroup.style.display = 'none';
      gabaritoInput.value = '';
      gabaritoInput.required = false;
    } else {
      gabaritoGroup.style.display = 'block';
      gabaritoInput.required = true;
    }
  };
  gabaritoCheck.addEventListener('change', toggleGabarito);

  // B. Preenchimento de Dados Iniciais (Se houver)
  if (initialData) {
    titleInput.value = initialData.rawTitle || '';
    gabaritoCheck.checked = initialData.gabaritoNaProva;
    toggleGabarito(); // Aplica o estado visual

    const fileNameDisplay = document.getElementById('fileName');
    fileNameDisplay.textContent =
      '⚠️ Por favor, selecione o arquivo novamente.';
    fileNameDisplay.style.color = 'var(--color-warning)';
  }

  // C. Submit do Formulário
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const fileProva = pdfInput.files[0];
    const fileGabarito = gabaritoInput.files[0];

    if (!fileProva) {
      alert('Selecione a prova.');
      return;
    }

    gerarVisualizadorPDF({
      title: `(${titleInput.value})`,
      rawTitle: titleInput.value,
      fileProva,
      fileGabarito: gabaritoCheck.checked ? null : fileGabarito,
      gabaritoNaProva: gabaritoCheck.checked,
    });
  });
}