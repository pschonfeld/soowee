/* ── Appearance: Light / Dark / Auto (Auto follows the system) ──
   The footer switch on every page. The inline script in Page.astro applies the stored choice before first paint. */
const THEME_KEY = 'soowee:theme';

/**
 * Pages with one browser-bar colour per scheme (the home page) pin the chosen one while the switch overrides the
 * system, and hand back to prefers-color-scheme on Auto. Pages with a single colour have no data-scheme and are
 * left alone.
 */
function applyThemeColor(theme: string) {
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"][data-scheme]')) {
    const scheme = meta.dataset.scheme;
    meta.media = theme === 'auto' ? `(prefers-color-scheme: ${scheme})` : scheme === theme ? 'all' : 'not all';
  }
}

const storedTheme = document.documentElement.dataset.theme ?? 'auto';
for (const input of document.querySelectorAll<HTMLInputElement>('input[name="theme"]')) {
  input.checked = input.value === storedTheme;
  input.addEventListener('change', () => {
    if (input.value === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = input.value;
    applyThemeColor(input.value);
    try {
      if (input.value === 'auto') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, input.value);
    } catch {
      /* The choice still applies for this visit. */
    }
  });
}
