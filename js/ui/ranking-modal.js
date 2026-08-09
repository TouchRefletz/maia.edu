/**
 * ranking-modal.js
 * Modal do Ranking de Maestria do Vestibulando para Maia.edu
 */
import { getEloRankTier, getEloState } from '../services/elo-service.js';
import { SVG_ICONS, getTierSvgIcon } from '../utils/svg-icons.js';

export function openRankingModal() {
  const existing = document.getElementById('rankingModalContainer');
  if (existing) existing.remove();

  const state = getEloState();
  const theta = state.user?.theta || 1500;
  const currentTier = getEloRankTier(theta);
  const allTiers = currentTier.allTiers || [];

  const modalHtml = `
    <div id="rankingModalContainer" class="perfil-modal-overlay fade-in" style="z-index: 99999;">
      <div class="perfil-modal-card skill-progression-modal">
        <button class="perfil-modal-close" id="closeRankingModal" aria-label="Fechar">&times;</button>
        
        <div class="skill-progression-header">
          <div class="skill-progression-title-group">
            <span class="skill-trophy-icon">${SVG_ICONS.trophy}</span>
            <h2>RANKING DE MAESTRIA DO VESTIBULANDO</h2>
          </div>
          <p class="skill-progression-subtitle">
            Evolua seu Elo resolvendo questões no Banco e suba na hierarquia de proficiência acadêmica!
          </p>
        </div>

        <!-- ELO PROGRESSION LADDER -->
        <div class="skill-ladder-wrapper">
          <div class="skill-ladder-container">
            ${allTiers
              .map((t) => {
                const isActive = t.tier === currentTier.tier;
                const iconSvg = getTierSvgIcon(t.iconKey || 'bronze', 24, 24);
                return `
                <div class="skill-tier-column ${isActive ? 'active-ladder-tier' : ''}" style="--tier-color: ${t.color}">
                  
                  ${
                    isActive
                      ? `
                    <div class="skill-player-pin">
                      <div class="skill-pin-score">${theta} ELO</div>
                      <div class="skill-pin-arrow"></div>
                    </div>
                  `
                      : ''
                  }

                  <div class="skill-tier-crest" style="background: ${t.color}">
                    <span class="skill-crest-icon">${iconSvg}</span>
                  </div>

                  <div class="skill-tier-track">
                    <div class="skill-tier-fill" style="height: ${isActive ? currentTier.progressPct : theta > t.min ? 100 : 0}%; background: ${t.color}"></div>
                  </div>

                  <div class="skill-tier-footer">
                    <span class="skill-tier-name">${escapeHtml(t.label.toUpperCase())}</span>
                    <span class="skill-tier-range">${t.min}+ ELO</span>
                  </div>
                </div>
              `;
              })
              .join('')}
          </div>
        </div>

        <div class="skill-modal-footer">
          <div class="skill-footer-stats">
            <span>Seu Nível Atual: <strong style="color:var(--color-primary);">${currentTier.tier}</strong> (${theta} ELO)</span>
            <span>${currentTier.nextTier ? `Próxima promoção: <strong>${currentTier.nextTier}</strong> (${currentTier.nextMin - theta} ELO restante)` : 'Nível Máximo Conquistado!'}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const container = document.getElementById('rankingModalContainer');
  const btnClose = document.getElementById('closeRankingModal');
  btnClose?.addEventListener('click', () => container.remove());
  container?.addEventListener('click', (e) => {
    if (e.target === container) container.remove();
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default openRankingModal;
