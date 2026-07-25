export class SearchToaster {
  static element = null;
  static timeoutId = null;

  static init() {
    if (SearchToaster.element) return;

    // Create container
    SearchToaster.element = document.createElement('div');
    SearchToaster.element.className = 'undo-toast'; // Reuse undo-toast styles (top center, nice look)
    SearchToaster.element.style.display = 'none';
    SearchToaster.element.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    SearchToaster.element.style.opacity = '0';
    SearchToaster.element.style.transform = 'translate(-50%, -20px)'; // Start slightly above

    // Inner HTML structure
    SearchToaster.element.innerHTML = `
      <div class="spinner" style="
          width: 16px; 
          height: 16px; 
          border: 2px solid var(--color-text-secondary); 
          border-top-color: var(--color-primary); 
          border-radius: 50%; 
          animation: spin 1s linear infinite;
          margin-right: 8px;
          display: none;
      "></div>
      <span class="undo-msg" style="font-weight: 500;"></span>
      <span class="toaster-detail" style="
          margin-left: 8px; 
          font-size: 0.85em; 
          color: var(--color-text-secondary); 
          border-left: 1px solid var(--color-border);
          padding-left: 8px;
          display: none;
      "></span>
    `;

    // Inject checkmark icon style for success state if needed, or just use text/emoji
    // Ensuring 'spin' keyframes exist in global CSS (animations.css usually has it).
    // If not, we can assume it exists or the spinner will just be static which is fine for now.

    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);

    document.body.appendChild(SearchToaster.element);
  }

  /**
   * Updates the state of the toaster
   * @param {string} status - 'loading', 'success', 'error', 'idle'
   * @param {string} message - Main text
   * @param {string} detail - Secondary text (optional)
   */
  static updateState(status = 'loading', message, detail) {
    if (!SearchToaster.element) SearchToaster.init();

    const spinner = SearchToaster.element.querySelector('.spinner');
    const msgEl = SearchToaster.element.querySelector('.undo-msg');
    const detailEl = SearchToaster.element.querySelector('.toaster-detail');

    // Show/Hide Spinner based on status
    if (status === 'loading') {
      spinner.style.display = 'block';
      spinner.style.borderColor = 'var(--color-text-secondary)';
      spinner.style.borderTopColor = 'var(--color-primary)';
    } else if (status === 'success') {
      spinner.style.display = 'block';
      spinner.style.borderColor = 'var(--color-success)'; // Green ring
      spinner.style.borderTopColor = 'var(--color-success)';
      spinner.style.animation = 'none'; // Stop spinning
    } else {
      spinner.style.display = 'none';
    }

    if (message) {
      msgEl.innerText = message;
    } else if (!msgEl.innerText.trim()) {
      msgEl.innerText = 'Processando...';
    }

    if (detail) {
      detailEl.innerText = detail;
      detailEl.style.display = 'inline-block';
    } else {
      detailEl.style.display = 'none';
    }

    SearchToaster.show();

    // Auto-hide if not loading
    if (status !== 'loading') {
      if (SearchToaster.timeoutId) clearTimeout(SearchToaster.timeoutId);
      SearchToaster.timeoutId = setTimeout(() => {
        SearchToaster.hide();
      }, 4000);
    }
  }

  static show() {
    if (!SearchToaster.element) SearchToaster.init();
    SearchToaster.element.style.display = 'flex';
    // Trigger reflow
    void SearchToaster.element.offsetWidth;
    SearchToaster.element.style.opacity = '1';
    SearchToaster.element.style.transform = 'translate(-50%, 0)';
  }

  static hide() {
    if (!SearchToaster.element) return;
    SearchToaster.element.style.opacity = '0';
    SearchToaster.element.style.transform = 'translate(-50%, -20px)';

    setTimeout(() => {
      if (SearchToaster.element.style.opacity === '0') {
        SearchToaster.element.style.display = 'none';
      }
    }, 300);
  }
}
