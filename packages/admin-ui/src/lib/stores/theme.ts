import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark' | 'system';

function getSystemTheme(): 'light' | 'dark' {
  if (!browser) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getInitialTheme(): Theme {
  if (!browser) return 'system';
  const stored = localStorage.getItem('theme') as Theme | null;
  return stored || 'system';
}

function createThemeStore() {
  const { subscribe, set, update } = writable<Theme>(getInitialTheme());

  // Track system preference
  const systemPreference = writable<'light' | 'dark'>(getSystemTheme());

  if (browser) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      systemPreference.set(e.matches ? 'dark' : 'light');
    });
  }

  // Resolved theme (actual light/dark value)
  const resolvedTheme = derived(
    [{ subscribe }, systemPreference],
    ([$theme, $systemPreference]) => {
      if ($theme === 'system') return $systemPreference;
      return $theme;
    }
  );

  // Apply theme to document
  function applyTheme(resolved: 'light' | 'dark') {
    if (!browser) return;
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(resolved);
  }

  // Subscribe to resolved theme changes
  if (browser) {
    resolvedTheme.subscribe(applyTheme);
  }

  return {
    subscribe,
    resolvedTheme,

    setTheme(theme: Theme) {
      set(theme);
      if (browser) {
        localStorage.setItem('theme', theme);
      }
    },

    toggleTheme() {
      update((current) => {
        const resolved = get(resolvedTheme);
        const newTheme: Theme = resolved === 'dark' ? 'light' : 'dark';
        if (browser) {
          localStorage.setItem('theme', newTheme);
        }
        return newTheme;
      });
    }
  };
}

export const theme = createThemeStore();
export const resolvedTheme = theme.resolvedTheme;
