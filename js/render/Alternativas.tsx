// --- Alternativas.tsx ---
import React from 'react';
// Importamos a função legada. O TS pode reclamar se não houver tipagem, 
// mas funcionará no build se o bundler permitir JS + TS.
// @ts-ignore
import { renderizar_estrutura_alternativa } from './structure.js';

interface EstruturaItem {
  tipo: string;
  conteudo: string;
}

interface Alternativa {
  letra?: string;
  estrutura?: EstruturaItem[];
  texto?: string;
}

interface AlternativasProps {
  alts: Alternativa[];
}

export const Alternativas: React.FC<AlternativasProps> = ({ alts }) => {
  if (!alts || alts.length === 0) {
    return <div className="data-box">Sem alternativas</div>;
  }

  return (
    <>
      {alts.map((a, index) => {
        const letra = String(a?.letra ?? '')
          .trim()
          .toUpperCase();

        const estrutura = Array.isArray(a?.estrutura)
          ? a.estrutura
          : [{ tipo: 'texto', conteudo: String(a?.texto ?? '') }];

        // Mantém a chamada da função original que gera o HTML interno
        // e acessa window.__imagensLimpas conforme descrito
        const htmlEstr = renderizar_estrutura_alternativa(estrutura, letra);

        return (
          <div className="alt-row" key={`${letra}-${index}`}>
            <span className="alt-letter">{letra}</span>
            {/* Injetamos o HTML gerado pela função legada dentro da div */}
            <div 
              className="alt-content" 
              dangerouslySetInnerHTML={{ __html: htmlEstr }} 
            />
          </div>
        );
      })}
    </>
  );
};