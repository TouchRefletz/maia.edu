import React from 'react';

export const ScanOriginalModal: React.FC = () => {
  // Função para fechar o modal, replicando a lógica original:
  // this.style.display='none' ou document.getElementById...style.display='none'
  const handleClose = () => {
    const modal = document.getElementById('modalScanOriginal');
    if (modal) {
      modal.style.display = 'none';
    }
  };

  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      id="modalScanOriginal"
      className="final-modal-overlay"
      style={{
        display: 'none', // O código legado vai alterar isso para 'block' ou 'flex'
        zIndex: 99999,
      }}
      onClick={handleClose}
    >
      <div
        className="final-modal-content"
        style={{
          maxWidth: '900px',
          height: '90vh',
          padding: 0,
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
        onClick={handleContentClick}
      >
        <div
          style={{
            background: 'var(--color-surface)',
            padding: '20px',
            borderRadius: '8px',
            maxHeight: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 10px 50px rgba(0,0,0,0.8)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '15px',
              borderBottom: '1px solid var(--color-border)',
              paddingBottom: '10px',
            }}
          >
            <h3 style={{ margin: 0, color: 'var(--color-text)' }}>
              Scan Original
            </h3>
            <button
              onClick={handleClose}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '16px',
                cursor: 'pointer',
                color: 'var(--color-text)',
              }}
            >
              ✕
            </button>
          </div>
          
          {/* 
            Mantemos este ID vazio. 
            O código legado provavelmente faz:
            document.getElementById('modalScanContent').innerHTML = ... 
          */}
          <div id="modalScanContent"></div>
        </div>
      </div>
    </div>
  );
};