export function configurarTabs(container, gabarito) {
  if (gabarito) {
    const btnQ = container.querySelector('#btnTabQuestao');
    const btnG = container.querySelector('#btnTabGabarito');
    const qView = container.querySelector('#tabContentQuestao');
    const gView = container.querySelector('#tabContentGabarito');

    const setActive = (active) => {
      const showQ = active === 'questao';
      if (qView) qView.style.display = showQ ? 'block' : 'none';
      if (gView) gView.style.display = showQ ? 'none' : 'block';

      if (btnQ && btnG) {
        btnQ.classList.toggle('btn--primary', showQ);
        btnQ.classList.toggle('btn--secondary', !showQ);
        btnG.classList.toggle('btn--primary', !showQ);
        btnG.classList.toggle('btn--secondary', showQ);
      }
    };

    if (btnQ) btnQ.onclick = () => setActive('questao');
    if (btnG) btnG.onclick = () => setActive('gabarito');
  }
}
