import React from 'react';
import { createRoot } from 'react-dom/client';
import { TabsManager } from './TabsManager'; // Ajuste o caminho conforme necessário

export function configurarTabs(container, gabarito) {
  // Verifica segurança básica
  if (!container) return;

  // Precisamos de um local único para montar o React sem destruir o conteúdo existente do container.
  // Procuramos se já existe um mount-point criado anteriormente.
  const mountId = 'react-tabs-controller-mount';
  let mountNode = container.querySelector(`.${mountId}`);

  // Se não existir, criamos uma div oculta e anexamos ao container.
  if (!mountNode) {
    mountNode = document.createElement('div');
    mountNode.className = mountId;
    mountNode.style.display = 'none'; // Garante que não afete o layout visual
    container.appendChild(mountNode);
  }

  // Verificamos se já foi renderizado para evitar recriar a root múltiplas vezes
  if (!mountNode.hasAttribute('data-react-initialized')) {
    const root = createRoot(mountNode);
    
    root.render(
      React.createElement(TabsManager, {
        container: container,
        hasGabarito: gabarito
      })
    );

    // Marca como inicializado
    mountNode.setAttribute('data-react-initialized', 'true');
  }
}