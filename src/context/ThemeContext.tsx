import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  resetToSystemPreference: () => void;
}

const getSystemPreference = (): ThemeMode => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark';
};

const getInitialTheme = (): ThemeMode => {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('sedimec_theme') as ThemeMode | null;
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch {
      // ignore storage access errors
    }
    return getSystemPreference();
  }
  return 'dark';
};

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  isDark: true,
  toggleTheme: () => {},
  setTheme: () => {},
  resetToSystemPreference: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);

  // Apply theme class and data attributes to HTML root
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }
  }, [theme]);

  // Listen to OS system color scheme changes if user hasn't explicitly saved a preference
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      try {
        const savedPreference = localStorage.getItem('sedimec_theme');
        // Only automatically follow system changes if user has not stored an override
        if (!savedPreference) {
          setThemeState(e.matches ? 'dark' : 'light');
        }
      } catch {
        setThemeState(e.matches ? 'dark' : 'light');
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else if (mediaQuery.addListener) {
      // Fallback for older browser engines
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  const toggleTheme = () => {
    setThemeState((prev) => {
      const nextTheme: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('sedimec_theme', nextTheme);
      } catch {
        // ignore storage errors
      }
      return nextTheme;
    });
  };

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    try {
      localStorage.setItem('sedimec_theme', mode);
    } catch {
      // ignore storage errors
    }
  };

  const resetToSystemPreference = () => {
    try {
      localStorage.removeItem('sedimec_theme');
    } catch {
      // ignore
    }
    setThemeState(getSystemPreference());
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        toggleTheme,
        setTheme,
        resetToSystemPreference,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
