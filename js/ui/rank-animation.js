/**
 * rank-animation.js
 * Animação e Overlay de Celebração de Mudança de Rank Tier (Rank Up / Rank Down)
 */

export function triggerRankTransitionIfAny(resultadoElo) {
  if (!resultadoElo || !resultadoElo.user || !resultadoElo.user.rankChange) return;
  showRankTransitionOverlay(resultadoElo.user.rankChange);
}

export function showRankTransitionOverlay({ type = 'up', oldTier, newTier, thetaNew, thetaOld }) {
  const existing = document.getElementById('rankTransitionOverlay');
  if (existing) existing.remove();

  const isUp = type === 'up';
  const titleText = isUp ? '🎉 SUBIU DE TIER!' : '⚡ MUDANÇA DE TIER';
  const subtitleText = isUp
    ? `Parabéns! Sua constância no aprendizado desbloqueou o nível ${newTier.tier}.`
    : `Seu nível recalibrou para ${newTier.tier}. Ajustes fazem parte do processo de evolução!`;

  const badgeGlow = newTier.glow || 'rgba(99, 102, 241, 0.6)';
  const badgeColor = newTier.color || 'linear-gradient(135deg, #6366f1, #a855f7)';

  const overlayHtml = `
    <div id="rankTransitionOverlay" class="rank-transition-overlay fade-in">
      <canvas id="rankConfettiCanvas" class="rank-confetti-canvas"></canvas>

      <div class="rank-transition-card ${isUp ? 'rank-up-card' : 'rank-down-card'} zoom-in">
        <div class="rank-transition-header">
          <span class="rank-transition-type-badge ${isUp ? 'type-up' : 'type-down'}">
            ${isUp ? 'PROMOÇÃO DE MAESTRIA' : 'REAJUSTE DE NÍVEL'}
          </span>
          <h1 class="rank-transition-title">${titleText}</h1>
          <p class="rank-transition-sub">${subtitleText}</p>
        </div>

        <div class="rank-badges-transition-container">
          <div class="rank-badge-box old-tier-box">
            <span class="rank-box-label">Tier Anterior</span>
            <div class="rank-badge-preview old-badge" style="background: ${oldTier.color}">
              ${oldTier.badge}
            </div>
            <span class="rank-box-elo">${thetaOld || oldTier.min} ELO</span>
          </div>

          <div class="rank-transition-arrow">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </div>

          <div class="rank-badge-box new-tier-box pulse-glow" style="--glow-color: ${badgeGlow}">
            <span class="rank-box-label">Novo Tier Conquistado</span>
            <div class="rank-badge-preview new-badge" style="background: ${badgeColor}; box-shadow: 0 0 25px ${badgeGlow}">
              ${newTier.badge}
            </div>
            <span class="rank-box-elo highlight-elo">${thetaNew || newTier.min} ELO</span>
          </div>
        </div>

        <div class="rank-transition-footer">
          <button id="closeRankOverlayBtn" class="rank-continue-btn">
            ${isUp ? 'Continuar Evoluindo 🚀' : 'Continuar Praticando 🎯'}
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', overlayHtml);
  const overlay = document.getElementById('rankTransitionOverlay');
  const closeBtn = document.getElementById('closeRankOverlayBtn');

  // Trigger synth audio cue
  playAudioCue(isUp);

  // Trigger confetti particle animation if Rank Up
  if (isUp) {
    initConfettiAnimation();
  }

  const closeFn = () => {
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.remove(), 300);
  };

  closeBtn?.addEventListener('click', closeFn);
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) closeFn();
  });
}

function playAudioCue(isUp) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (isUp) {
      // Major triad arpeggio (C5 - E5 - G5 - C6)
      const freqs = [523.25, 659.25, 783.99, 1046.5];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, ctx.currentTime + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.09 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.09);
        osc.stop(ctx.currentTime + idx * 0.09 + 0.4);
      });
    } else {
      // Soft minor interval (E4 - C4)
      const freqs = [329.63, 261.63];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.15 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.15);
        osc.stop(ctx.currentTime + idx * 0.15 + 0.45);
      });
    }
  } catch (e) {
    // Ignore audio autoplay policy errors
  }
}

function initConfettiAnimation() {
  const canvas = document.getElementById('rankConfettiCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#6366f1', '#a855f7', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#32b8c6'];

  for (let i = 0; i < 90; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2 - 50,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 0.7) * 14,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rSpeed: (Math.random() - 0.5) * 8,
      alpha: 1,
    });
  }

  let animationFrame;
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let active = false;

    particles.forEach((p) => {
      if (p.alpha <= 0) return;
      active = true;

      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25; // gravity
      p.rotation += p.rSpeed;
      p.alpha -= 0.012;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });

    if (active) {
      animationFrame = requestAnimationFrame(render);
    }
  }

  render();
}

export default triggerRankTransitionIfAny;
