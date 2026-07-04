'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
  syncFromProfile: (profileTheme: string | null | undefined) => void;
}>({
  theme: 'light',
  toggle: () => {},
  syncFromProfile: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme | null;
    const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const initial = saved || preferred;
    setTheme(initial);
    document.documentElement.classList.toggle('dark', initial === 'dark');
  }, []);

  function applyTheme(next: Theme) {
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  }

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light';
    applyTheme(next);
    // Persist to user profile so all devices stay in sync
    fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: next }),
    }).catch(() => {});
  }

  // Called once the user profile loads — syncs the saved preference to this device
  function syncFromProfile(profileTheme: string | null | undefined) {
    if (!profileTheme || profileTheme === theme) return;
    applyTheme(profileTheme as Theme);
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle, syncFromProfile }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
