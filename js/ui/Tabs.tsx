import React, { useEffect, useState } from 'react';

interface TabsManagerProps {
  container: HTMLElement;
  hasGabarito: boolean;
}

export const TabsManager: React.FC<TabsManagerProps> = ({ container, hasGabarito }) => {
  // O estado agora é gerenciado pelo React
  const [activeTab, setActiveTab] = useState<'questao' | 'gabarito'>('questao');

  useEffect(() => {
    // Se não houver container ou gabarito, não faz nada (mesma lógica do original)
    if (!container || !hasGabarito) return;

    // Busca os elementos dentro do container
    const btnQ = container.querySelector('#btnTabQuestao') as HTMLElement;
    const btnG = container.querySelector('#btnTabGabarito') as HTMLElement;
    const qView = container.querySelector('#tabContentQuestao') as HTMLElement;
    const gView = container.querySelector('#tabContentGabarito') as HTMLElement;

    // 1. Sincronização do Estado Visual (View Update)
    const showQ = activeTab === 'questao';

    if (qView) qView.style.display = showQ ? 'block' : 'none';
    if (gView) gView.style.display = showQ ? 'none' : 'block';

    if (btnQ && btnG) {
      // Toggle de classes (Lógica original replicada)
      if (showQ) {
        btnQ.classList.add('btn--primary');
        btnQ.classList.remove('btn--secondary');
        btnG.classList.add('btn--secondary');
        btnG.classList.remove('btn--primary');
      } else {
        btnQ.classList.add('btn--secondary');
        btnQ.classList.remove('btn--primary');
        btnG.classList.add('btn--primary');
        btnG.classList.remove('btn--secondary');
      }
    }

    // 2. Definição dos Event Listeners (Controller)
    // Criamos as funções de handler que atualizam o estado do React
    const handleQClick = (e: Event) => {
        e.preventDefault(); 
        setActiveTab('questao');
    };
    const handleGClick = (e: Event) => { 
        e.preventDefault();
        setActiveTab('gabarito');
    };

    // Adiciona os eventos
    if (btnQ) btnQ.addEventListener('click', handleQClick);
    if (btnG) btnG.addEventListener('click', handleGClick);

    // Limpeza: Remove os eventos quando o componente desmontar ou o container mudar
    return () => {
      if (btnQ) btnQ.removeEventListener('click', handleQClick);
      if (btnG) btnG.removeEventListener('click', handleGClick);
    };

  }, [container, hasGabarito, activeTab]); // Re-executa se o estado mudar para atualizar as classes

  // Este componente não renderiza HTML novo, ele apenas gerencia o existente.
  return null;
};