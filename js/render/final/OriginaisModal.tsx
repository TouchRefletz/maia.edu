import type React from 'react';
import { createRoot } from 'react-dom/client';
import { PdfEmbedRenderer } from '../../ui/PdfEmbedRenderer';

// 1. Definição de Tipos para as Variáveis Globais
// 1. Definição de Tipos para as Variáveis Globais
// Declarado em StructureRender.tsx ou main type definitions
// declare global { ... } removido para evitar conflito.

interface ImagensBackup {
  imgsQ: (string | any)[];
}

// 2. Lógica de Recuperação de Dados (Só Questão agora)
export function obterImagensBackup(): ImagensBackup {
  // 1. Tenta pegar a foto original DEFINITIVA da questão (Green Box)
  // 1. Tenta pegar a foto original DEFINITIVA da questão (Green Box)
  const questao = window.__ultimaQuestaoExtraida;

  // NOVO: Prioriza a lista de objetos (fotos_originais) se existir
  if (questao && Array.isArray(questao.fotos_originais) && questao.fotos_originais.length > 0) {
    return { imgsQ: questao.fotos_originais };
  }

  if (questao && questao.foto_original) {
    // Retorna como array de 1 item, pois a modal espera array
    return { imgsQ: [questao.foto_original] };
  }

  // 2. Fallback para backups parciais ou antigos
  const imgsQ =
    window.__BACKUP_IMGS_Q && window.__BACKUP_IMGS_Q.length > 0
      ? window.__BACKUP_IMGS_Q
      : window.__imagensLimpas?.questao_original || [];

  return { imgsQ };
}

// Sub-componente para renderizar a lista (Agora suporta PDF Embed)
const ListaImagens: React.FC<{ lista: (string | any)[] }> = ({ lista }) => {
  if (lista.length === 0) {
    return <div style={{ color: 'gray', padding: '10px' }}>Sem imagens</div>;
  }

  return (
    <>
      {lista.map((item, index) => {
        // Se for string (legado) renderiza img
        if (typeof item === 'string') {
          // Ignora se for a string "filled" sem dados, ou renderiza placeholder
          if (item === 'filled')
            return (
              <div key={index} style={{ color: 'gray' }}>
                Imagem sem dados de visualização
              </div>
            );
          return <img key={index} src={item} className="img-content" alt={`Imagem ${index}`} />;
        }

        // Se for objeto (novo sistema PDF), usa o PdfEmbedRenderer
        if (typeof item === 'object' && item !== null) {
          console.log('[OriginaisModal] Renderizando Item:', item);
          return (
            <PdfEmbedRenderer
              key={index}
              pdfUrl={item.pdf_url}
              pdf_page={item.pdf_page}
              pdf_zoom={item.pdf_zoom}
              pdf_left={item.pdf_left}
              pdf_top={item.pdf_top}
              pdf_width={item.pdf_width}
              pdf_height={item.pdf_height}
              pdfjs_source_w={item.pdfjs_source_w}
              pdfjs_source_h={item.pdfjs_source_h}
              pdfjs_x={item.pdfjs_x}
              pdfjs_y={item.pdfjs_y}
              pdfjs_crop_w={item.pdfjs_crop_w}
              pdfjs_crop_h={item.pdfjs_crop_h}
              scaleToFit={true} // Ajusta ao modal
              forceRenderMode="embed" // Inicia sempre em embed nativo
              readOnly={true} // DEBUG: Allow finding local file
            />
          );
        }

        return null;
      })}
    </>
  );
};

// 3. Componente do Modal (Refatorado para 1 coluna só)
const ModalOriginais: React.FC<{ onClose: () => void; imgsQ: (string | any)[] }> = ({
  onClose,
  imgsQ,
}) => {
  return (
    <>
      <div className="img-close-container">
        <button className="img-close-btn" onClick={onClose}>
          ✕ Fechar
        </button>
      </div>

      <div className="img-modal-body" style={{ flexDirection: 'column', alignItems: 'center' }}>
        <div className="img-col" style={{ width: '100%', maxWidth: '800px', borderRight: 'none' }}>
          <div className="img-title" style={{ color: '#00bfff', textAlign: 'center' }}>
            Questão Original ({imgsQ.length})
          </div>
          <ListaImagens lista={imgsQ} />
        </div>
      </div>
    </>
  );
};

// 4. Função Principal de Montagem (Substitui verImagensOriginais)
// 4. Função Principal de Montagem (Substitui verImagensOriginais)
export function exibirModalOriginais(imgsOverride?: any[]): void {
  // Verifica se já existe (mesma lógica para evitar duplicidade)
  if (document.querySelector('.img-overlay')) return;

  // Cria o container
  const overlay = document.createElement('div');
  overlay.className = 'img-overlay';
  document.body.appendChild(overlay);

  // Recupera dados: Usa override se existir, senão busca do backup
  let finalImgs: any[] = [];

  if (imgsOverride && Array.isArray(imgsOverride) && imgsOverride.length > 0) {
    console.log('[OriginaisModal] Usando dados passados via argumento:', imgsOverride);
    finalImgs = imgsOverride;
  } else {
    // Lógica padrão de fallback
    const { imgsQ } = obterImagensBackup();
    finalImgs = imgsQ;
  }

  // Cria a raiz React e renderiza
  const root = createRoot(overlay);

  const handleClose = () => {
    // Remove o componente e o elemento do DOM
    root.unmount();
    overlay.remove();
  };

  root.render(<ModalOriginais onClose={handleClose} imgsQ={finalImgs} />);
}
