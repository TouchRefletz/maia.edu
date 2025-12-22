import React from 'react';
import { createRoot } from 'react-dom/client';

// 1. Definição de Tipos para as Variáveis Globais
declare global {
  interface Window {
    __BACKUP_IMGS_Q?: string[];
    __BACKUP_IMGS_G?: string[];
    __imagensLimpas?: {
      questao_original?: string[];
      gabarito_original?: string[];
      alternativas?: {
        questao?: Record<string, string[]>;
      };
    };
  }
}

interface ImagensBackup {
  imgsQ: string[];
  imgsG: string[];
}

// 2. Lógica de Recuperação de Dados (Mesma lógica do passo 1 original)
export function obterImagensBackup(): ImagensBackup {
  const imgsQ =
    window.__BACKUP_IMGS_Q && window.__BACKUP_IMGS_Q.length > 0
      ? window.__BACKUP_IMGS_Q
      : window.__imagensLimpas?.questao_original || [];

  const imgsG =
    window.__BACKUP_IMGS_G && window.__BACKUP_IMGS_G.length > 0
      ? window.__BACKUP_IMGS_G
      : window.__imagensLimpas?.gabarito_original || [];

  return { imgsQ, imgsG };
}

// Sub-componente para renderizar a lista (Substitui gerarHtmlListaImagens)
const ListaImagens: React.FC<{ lista: string[] }> = ({ lista }) => {
  if (lista.length === 0) {
    return <div style={{ color: 'gray', padding: '10px' }}>Sem imagens</div>;
  }

  return (
    <>
      {lista.map((src, index) => (
        <img key={index} src={src} className="img-content" alt={`Imagem ${index}`} />
      ))}
    </>
  );
};

// 3. Componente do Modal (Substitui construirHtmlModalOriginais)
const ModalOriginais: React.FC<{ onClose: () => void; imgsQ: string[]; imgsG: string[] }> = ({
  onClose,
  imgsQ,
  imgsG,
}) => {
  return (
    <>
      <div className="img-close-container">
        <button className="img-close-btn" onClick={onClose}>
          ✕ Fechar
        </button>
      </div>

      <div className="img-modal-body">
        <div className="img-col">
          <div className="img-title" style={{ color: '#00bfff' }}>
            Questão Original ({imgsQ.length})
          </div>
          <ListaImagens lista={imgsQ} />
        </div>

        <div className="img-divider"></div>

        <div className="img-col">
          <div className="img-title" style={{ color: '#ffaa00' }}>
            Gabarito Original ({imgsG.length})
          </div>
          <ListaImagens lista={imgsG} />
        </div>
      </div>
    </>
  );
};

// 4. Função Principal de Montagem (Substitui verImagensOriginais)
export function exibirModalOriginais(): void {
  // Verifica se já existe (mesma lógica para evitar duplicidade)
  if (document.querySelector('.img-overlay')) return;

  // Cria o container
  const overlay = document.createElement('div');
  overlay.className = 'img-overlay';
  document.body.appendChild(overlay);

  // Recupera dados
  const { imgsQ, imgsG } = obterImagensBackup();

  // Cria a raiz React e renderiza
  const root = createRoot(overlay);

  const handleClose = () => {
    // Remove o componente e o elemento do DOM
    root.unmount();
    overlay.remove();
  };

  root.render(
    <ModalOriginais onClose={handleClose} imgsQ={imgsQ} imgsG={imgsG} />
  );
}