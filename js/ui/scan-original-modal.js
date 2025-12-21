import React from 'react';
import { createRoot } from 'react-dom/client';
import { ScanOriginalModal } from './ScanOriginalModal'; // Ajuste o caminho conforme necessário

export function gerarHtmlModalScanOriginal() {
  const mountId = 'react-mount-scan-original';

  // Usa setTimeout para agendar a renderização do React para logo após
  // o código legado inserir a string retornada abaixo no DOM.
  setTimeout(() => {
    const mountNode = document.getElementById(mountId);
    
    // Verifica se o elemento existe e se já não foi renderizado (segurança)
    if (mountNode && !mountNode.hasAttribute('data-react-rendered')) {
      const root = createRoot(mountNode);
      root.render(React.createElement(ScanOriginalModal));
      
      // Marca como renderizado para evitar duplicidade se a função for chamada múltiplas vezes
      mountNode.setAttribute('data-react-rendered', 'true');
    }
  }, 0);

  // Retorna um container onde o React será montado.
  // Isso satisfaz o código legado que espera uma string HTML.
  return `<div id="${mountId}"></div>`;
}