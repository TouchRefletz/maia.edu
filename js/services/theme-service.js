/**
 * Service to handle Theme switching (Light/Dark)
 * Persists preference to localStorage and applies to document.documentElement
 */

const THEME_KEY = "maia_theme_preference";

/**
 * Gets the current theme (light or dark) based on storage or system preference
 * @returns {string} 'light' or 'dark'
 */
export function getTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) return saved;

  if (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

/**
 * Sets the theme explicitly
 * @param {string} theme 'light' or 'dark'
 */
export function setTheme(theme) {
  document.documentElement.setAttribute("data-color-scheme", theme);
  localStorage.setItem(THEME_KEY, theme);
  updateThemeIcon(theme);
}

/**
 * Toggles the current theme
 * @returns {string} The new theme
 */
export function toggleTheme() {
  const current = getTheme();
  const newTheme = current === "dark" ? "light" : "dark";
  setTheme(newTheme);
  return newTheme;
}

/**
 * Initializes the theme on application start
 */
export function initTheme() {
  const theme = getTheme();
  setTheme(theme);
}

/**
 * Updates all theme toggle buttons with the appropriate icon
 * @param {string} theme Current active theme
 */
export function updateThemeIcon(theme) {
  const buttons = document.querySelectorAll(".js-toggle-theme");
  buttons.forEach((btn) => {
    // If current is dark, show Sun (to switch to light)
    // If current is light, show Moon (to switch to dark)
    const isDark = theme === "dark";

    // Moon Icon (for Light Mode -> Switch to Dark)
    const moonIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

    // Sun Icon (for Dark Mode -> Switch to Light)
    const sunIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;

    btn.innerHTML = isDark ? sunIcon : moonIcon;
    btn.title = isDark ? "Mudar para modo claro" : "Mudar para modo escuro";
  });
}
