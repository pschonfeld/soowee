/* ── Appearance: Light / Dark / Auto (Auto follows the system) ──
   The footer switch on every page. The inline script in Page.astro applies the stored choice before first paint. */
const THEME_KEY = 'soowee:theme';
const storedTheme = document.documentElement.dataset.theme ?? 'auto';
for (const input of document.querySelectorAll<HTMLInputElement>('input[name="theme"]')) {
  input.checked = input.value === storedTheme;
  input.addEventListener('change', () => {
    if (input.value === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = input.value;
    try {
      if (input.value === 'auto') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, input.value);
    } catch {
      /* The choice still applies for this visit. */
    }
  });
}
