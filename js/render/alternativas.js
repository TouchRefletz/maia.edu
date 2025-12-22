// --- START OF FILE alternativas.js ---

import React from 'react';
import ReactDOMServer from 'react-dom/server';
// Nota: Dependendo da configuração do seu bundler (Vite/Webpack), 
// talvez você precise remover a extensão .tsx do import abaixo (ex: './Alternativas')
import { Alternativas } from './Alternativas.tsx';

export const renderAlternativas = (alts) => {
  // Como estamos em um arquivo .js puro, não podemos usar <Alternativas />.
  // Usamos React.createElement(Componente, Props) para fazer a mesma coisa.
  const elementoReact = React.createElement(Alternativas, { alts: alts });

  // Renderiza para string HTML estática
  return ReactDOMServer.renderToStaticMarkup(elementoReact);
};