import { createRoot } from 'react-dom/client';
import { AlternativeStructure, MainStructure } from '../render/StructureRender';

export function hydrateBankCard(cardElement: HTMLElement, data: { q: any, g: any, imgsOriginalQ: string[], jsonImgsG: string }) {
  if (!cardElement) return;

  // 1. Hydrate Question Body
  const qBodyContainer = cardElement.querySelector('.js-react-q-body');
  if (qBodyContainer && data.q) {
     const root = createRoot(qBodyContainer);
     root.render(
        <MainStructure 
            estrutura={data.q.estrutura} 
            imagensExternas={data.imgsOriginalQ} 
            contexto="banco_q" 
            isReadOnly={true}
        />
     );
  }

  // 2. Hydrate Explanation Steps
  if (data.g && Array.isArray(data.g.explicacao)) {
      data.g.explicacao.forEach((passo: any, idx: number) => {
          const stepContainer = cardElement.querySelector(`.js-react-step-${idx}`);
          if (stepContainer) {
              const root = createRoot(stepContainer);
              const estrutura = Array.isArray(passo.estrutura) ? passo.estrutura : [{ tipo: 'texto', conteudo: passo.passo || '' }];
              
              root.render(
                  <MainStructure 
                      estrutura={estrutura}
                      imagensExternas={[]} 
                      contexto={`banco_step_${idx}`}
                      isReadOnly={true}
                  />
              );
          }
      });
  }

  // 3. Hydrate Alternative Options
  if (data.q && Array.isArray(data.q.alternativas)) {
    data.q.alternativas.forEach((alt: any) => {
      const letra = String(alt?.letra || '').trim().toUpperCase();
      if (!letra) return;
      const optContent = cardElement.querySelector(`.q-opt-btn[data-letra="${letra}"] .q-opt-content`);
      if (optContent && Array.isArray(alt.estrutura) && alt.estrutura.length > 0) {
        try {
          const root = createRoot(optContent);
          root.render(
            <AlternativeStructure
              estrutura={alt.estrutura}
              letra={letra}
              imagensExternas={data.imgsOriginalQ || []}
              contexto="banco"
            />
          );
        } catch (e) {
          console.error(`[bank-hydration] Erro ao hidratar alternativa ${letra}:`, e);
        }
      }
    });
  }
}
