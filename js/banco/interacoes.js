export function toggleGabarito(cardId) {
  const el = document.getElementById(cardId + '_res');
  if (!el) return;

  // Alterna entre mostrar e esconder
  if (el.style.display === 'none') {
    el.style.display = 'block';
    // Opcional: faz scroll suave até a resolução
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    el.style.display = 'none';
  }
}

export function verificarRespostaBanco(btn, cardId, letraEscolhida, letraCorreta) {
  const container = document.getElementById(cardId + '_opts');
  const resolution = document.getElementById(cardId + '_res');

  if (container.classList.contains('answered')) return;
  container.classList.add('answered');

  const todosBotoes = container.querySelectorAll('.q-opt-btn');
  letraCorreta = letraCorreta.trim().toUpperCase();
  letraEscolhida = letraEscolhida.trim().toUpperCase();

  todosBotoes.forEach((b) => {
    const letra = b
      .querySelector('.q-opt-letter')
      .innerText.replace(')', '')
      .trim();

    if (letra === letraCorreta) {
      b.classList.add('correct');
    }
    if (letra === letraEscolhida && letra !== letraCorreta) {
      b.classList.add('wrong');
    }
    b.style.cursor = 'default';
  });

  // Delay e Revelação
  setTimeout(() => {
    resolution.style.display = 'block';
    resolution.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 800);
}

// Abrir Scan Original
export function abrirScanOriginal(btn) {
  const jsonImgs = btn.dataset.imgs;
  if (!jsonImgs) return;

  try {
    const imgs = JSON.parse(jsonImgs);
    const content = document.getElementById('modalScanContent');
    const modal = document.getElementById('modalScanOriginal');

    content.innerHTML = imgs
      .map(
        (url) => `
            <img src="${url}" style="max-width:100%; margin-bottom:20px; border-radius:4px; border:1px solid #333;">
        `
      )
      .join('');

    modal.style.display = 'flex';
  } catch (e) {
    console.error('Erro ao abrir imagens originais', e);
  }
}
