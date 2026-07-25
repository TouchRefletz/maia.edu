/**
 * Logica de Hidratação do Carousel Iterativo
 * Transforma o HTML estático gerado pelo ChatRender em um componente interativo
 */

export function hydrateCarousels(container) {
  if (!container) return;
  const roots = container.querySelectorAll('.carousel-root');
  roots.forEach(initCarousel);
}

function initCarousel(root) {
  // Evita dupla inicialização
  if (root.dataset.hydrated) return;
  root.dataset.hydrated = 'true';

  const track = root.querySelector('.carousel-track');
  const slides = Array.from(track.querySelectorAll('.carousel-slide'));
  const nextBtn = root.querySelector('.carousel-next');
  const prevBtn = root.querySelector('.carousel-prev');
  const dots = Array.from(root.querySelectorAll('.carousel-dot'));

  if (slides.length === 0) return;

  let currentIndex = 0;
  const totalSlides = slides.length;

  function update() {
    // 1. Move o track (assumindo slides de largura 100%)
    track.style.transform = `translateX(-${currentIndex * 100}%)`;

    // 2. Atualiza Dots
    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === currentIndex);
      dot.setAttribute('aria-current', idx === currentIndex ? 'true' : 'false');
    });

    // 3. Atualiza estado dos botões (Loop: false conforme exemplo do usuário)
    if (prevBtn) {
      prevBtn.disabled = currentIndex === 0;
      prevBtn.style.opacity = currentIndex === 0 ? '0.3' : '1';
      prevBtn.style.cursor = currentIndex === 0 ? 'not-allowed' : 'pointer';
    }

    if (nextBtn) {
      nextBtn.disabled = currentIndex === totalSlides - 1;
      nextBtn.style.opacity = currentIndex === totalSlides - 1 ? '0.3' : '1';
      nextBtn.style.cursor = currentIndex === totalSlides - 1 ? 'not-allowed' : 'pointer';
    }
  }

  // Inicializa estado
  update();

  // Event Listeners
  nextBtn?.addEventListener('click', (e) => {
    e.stopPropagation(); // Evita bolha se tiver clique na mensagem
    if (currentIndex < totalSlides - 1) {
      currentIndex++;
      update();
    }
  });

  prevBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (currentIndex > 0) {
      currentIndex--;
      update();
    }
  });

  dots.forEach((dot) => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(dot.dataset.index, 10);
      if (!isNaN(idx)) {
        currentIndex = idx;
        update();
      }
    });
  });

  // (Opcional) Swipe Touch Support
  let touchStartX = 0;
  let touchEndX = 0;

  track.addEventListener(
    'touchstart',
    (e) => {
      touchStartX = e.changedTouches[0].screenX;
    },
    { passive: true },
  );

  track.addEventListener(
    'touchend',
    (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    },
    { passive: true },
  );

  function handleSwipe() {
    const threshold = 50;
    if (touchEndX < touchStartX - threshold) {
      // Swipe Left -> Next
      if (currentIndex < totalSlides - 1) {
        currentIndex++;
        update();
      }
    }
    if (touchEndX > touchStartX + threshold) {
      // Swipe Right -> Prev
      if (currentIndex > 0) {
        currentIndex--;
        update();
      }
    }
  }
}
