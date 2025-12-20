export function gerarHtmlModalScanOriginal() {
  return `
    <div id="modalScanOriginal" class="final-modal-overlay" style="display:none; z-index:99999;" onclick="this.style.display='none'">
        <div class="final-modal-content" style="max-width:900px; height:90vh; padding:0; background:transparent; border:none; box-shadow:none; display:flex; justify-content:center; align-items:center;" onclick="event.stopPropagation()">
             <div style="background:var(--color-surface); padding:20px; border-radius:8px; max-height:100%; width:100%; display:flex; flex-direction:column; box-shadow:0 10px 50px rgba(0,0,0,0.8);">
                <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px solid var(--color-border); padding-bottom:10px;">
                    <h3 style="margin:0; color:var(--color-text);">Scan Original</h3>
                    <button onclick="document.getElementById('modalScanOriginal').style.display='none'" style="border:none; background:transparent; font-size:16px; cursor:pointer; color:var(--color-text);">✕</button>
                </div>
                <div id="modalScanContent"></div>
             </div>
        </div>
    </div>`;
}
