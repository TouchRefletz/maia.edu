import { sanitizeInlineMarkdown } from '../normalize/primitives.js';

export function limparResultadosAnteriores(sidebar) {
  if (!sidebar) return;

  // Remove resultado anterior (se houver)
  const oldResult = sidebar.querySelector('.extraction-result');
  if (oldResult) oldResult.remove();

  // Remove loader anterior (se houver)
  const oldLoader = sidebar.querySelector('.skeleton-wrapper');
  // O loader antigo fica dentro de um wrapper pai, removemos o pai
  if (oldLoader && oldLoader.parentElement) {
    oldLoader.parentElement.remove();
  }
}

export function construirSkeletonLoader(sidebar) {
  if (!sidebar) return null;

  const skeletonHTML = `
    <div id="ai-skeleton-loader" class="skeleton-wrapper" style="margin-top: 20px; border-top: 1px dashed #ccc; padding-top: 20px;">
        <div class="loading-status-area">
            <div class="spinner"></div>
            <div id="loading-text">Maia está pensando...</div>
        </div>

        <div id="maiaThoughts" class="maia-thoughts">
            <div class="maia-thought-card maia-thought-card--skeleton">
                <div class="maia-thought-logo-wrap">
                    <img src="logo.png" class="maia-thought-logo" alt="Maia" />
                </div>
                <div class="maia-thought-content">
                    <div class="skeleton-pulse maia-thought-title-skel"></div>
                    <div class="skeleton-pulse maia-thought-line-skel"></div>
                    <div class="skeleton-pulse maia-thought-line-skel short"></div>
                </div>
            </div>
        </div>
    </div>
    `;

  const loadingContainer = document.createElement('div');
  loadingContainer.id = 'maia-scroll-wrapper'; // ID explícito para scroll mobile
  loadingContainer.innerHTML = skeletonHTML;

  sidebar.appendChild(loadingContainer);

  // Retorna as referências para não precisarmos buscar com getElementById depois
  return {
    loadingContainer,
    thoughtListEl: document.getElementById('maiaThoughts'),
    textElement: document.getElementById('loading-text'),
  };
}

export function tentarExtrairTituloComRegex(raw) {
  // 1) Caso "**TITULO** resto"
  const mBold = raw.match(/^\s*\*\*(.+?)\*\*\s*(.*)$/s);
  if (mBold) {
    return {
      title: sanitizeInlineMarkdown(mBold[1]),
      body: sanitizeInlineMarkdown(mBold[2]),
    };
  }

  // 2) Caso com quebra de linha: 1ª linha = título
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length >= 2) {
    return {
      title: sanitizeInlineMarkdown(lines[0]),
      body: sanitizeInlineMarkdown(lines.slice(1).join('\n')),
    };
  }

  // 3) Caso "TITULO: corpo"
  const mColon = raw.match(/^(.{4,70}?):\s+(.+)$/s);
  if (mColon) {
    return {
      title: sanitizeInlineMarkdown(mColon[1]),
      body: sanitizeInlineMarkdown(mColon[2]),
    };
  }

  // 4) Caso "TITULO — corpo"
  const mDash = raw.match(/^(.{4,70}?)\s[—-]\s(.+)$/s);
  if (mDash) {
    return {
      title: sanitizeInlineMarkdown(mDash[1]),
      body: sanitizeInlineMarkdown(mDash[2]),
    };
  }

  // 5) Heurística de palavras-chave em inglês (I'm, I've, Now...)
  const mHeu = raw.match(
    /^(.{8,60}?)(?:\s+(I['’]m|I am|I've|I have|Now|Next|Then)\b)(.*)$/s
  );
  if (mHeu) {
    return {
      title: sanitizeInlineMarkdown(mHeu[1]),
      body: sanitizeInlineMarkdown((mHeu[2] + (mHeu[3] || '')).trim()),
    };
  }

  return null; // Nenhum padrão encontrado
}

export function splitThought(t) {
  const raw = String(t || '').trim();

  // Tenta encontrar algum padrão conhecido
  const resultado = tentarExtrairTituloComRegex(raw);

  // Se achou, retorna. Se não, usa o fallback.
  if (resultado) {
    return resultado;
  }

  // Fallback (Padrão genérico)
  return {
    title: 'Pensamento',
    body: sanitizeInlineMarkdown(raw),
  };
}

export function criarElementoCardPensamento(title, body) {
  const card = document.createElement('div');
  card.className = 'maia-thought-card';

  // Logo
  const logoWrap = document.createElement('div');
  logoWrap.className = 'maia-thought-logo-wrap';
  const logo = document.createElement('img');
  logo.className = 'maia-thought-logo';
  logo.src = 'logo.png';
  logo.alt = 'Maia';
  logoWrap.appendChild(logo);

  // Conteúdo
  const contentEl = document.createElement('div');
  contentEl.className = 'maia-thought-content';

  const titleEl = document.createElement('div');
  titleEl.className = 'maia-thought-title';
  titleEl.textContent = title || 'Pensamento';

  const bodyEl = document.createElement('div');
  bodyEl.className = 'maia-thought-body';
  bodyEl.textContent = body || '';

  contentEl.appendChild(titleEl);
  contentEl.appendChild(bodyEl);

  // Montagem final
  card.appendChild(logoWrap);
  card.appendChild(contentEl);

  return card;
}