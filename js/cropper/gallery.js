export function renderizarGaleriaModal() {
  const gallery = document.getElementById('cropPreviewGallery');
  const counter = document.getElementById('countImagens');

  gallery.innerHTML = ''; // Limpa anterior
  counter.textContent = window.__recortesAcumulados.length;

  window.__recortesAcumulados.forEach((imgSrc, index) => {
    // 1. Cria o container
    const wrap = document.createElement('div');
    wrap.className = 'gallery-item';

    // 2. Cria a imagem
    const img = document.createElement('img');
    img.src = imgSrc;

    // 3. Cria o botão
    const btn = document.createElement('button');
    btn.textContent = '✕';
    btn.title = 'Remover';

    // --- AQUI ESTÁ O EVENT LISTENER ---
    // O javascript "lembra" qual é o index correto para cada botão
    btn.addEventListener('click', () => {
      removerRecorte(index);
    });

    // 4. Monta tudo
    wrap.appendChild(img);
    wrap.appendChild(btn);
    gallery.appendChild(wrap);
  });
}

export function fecharModalConfirmacao() {
  const modal = document.getElementById('cropConfirmModal');
  if (modal) {
    modal.classList.remove('visible');
  }
}

export function removerRecorte(index) {
  window.__recortesAcumulados.splice(index, 1);
  renderizarGaleriaModal();
  if (window.__recortesAcumulados.length === 0) {
    fecharModalConfirmacao(); // Se apagar tudo, fecha
  }
}
