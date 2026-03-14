import { useEffect, useState } from 'react';

/** Supported application themes. */
export enum Theme {
    Light = 'light',
    Dark = 'dark'
};

interface UseThemeReturn {
    theme: Theme;
    setTheme: (theme: Theme) => void;
};

const THEME_STORAGE_KEY = 'theme';
const THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';

/** Resolves the current OS-level theme preference. */
const getSystemTheme = (): Theme => {
    return window.matchMedia(THEME_MEDIA_QUERY).matches ? Theme.Dark : Theme.Light;
};

/** Returns the persisted user-selected theme when present. */
const getSavedTheme = (): Theme | null => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

    if (savedTheme === Theme.Light || savedTheme === Theme.Dark) {
        return savedTheme;
    }

    if (savedTheme !== null) {
        localStorage.removeItem(THEME_STORAGE_KEY);
    }

    return null;
};

/** Updates the document theme contract attribute. */
const applyTheme = (theme: Theme): void => {
    document.documentElement.setAttribute('data-theme', theme);
};

/** Resolves the active theme from persisted user preference or system preference. */
const resolveTheme = (): Theme => {
    const savedTheme = getSavedTheme();

    if (savedTheme) {
        return savedTheme;
    }

    return getSystemTheme();
};

/** Syncs browser chrome color with the active theme background token. */
const syncThemeColorMeta = (): void => {
    const backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim();

    if (!backgroundColor) {
        return;
    }

    let themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeColorMeta) {
        themeColorMeta = document.createElement('meta');
        themeColorMeta.setAttribute('name', 'theme-color');
        document.head.appendChild(themeColorMeta);
    }

    themeColorMeta.setAttribute('content', backgroundColor);
};

/** Applies the resolved theme contract during app bootstrap. */
export const initializeTheme = (): void => {
    applyTheme(resolveTheme());
};

/**
 * Initializes the document theme contract on app startup and keeps browser
 * chrome colors aligned with the active theme.
 */
export const useThemeInitialization = (): void => {
    useEffect(() => {
        initializeTheme();
        syncThemeColorMeta();

        const mediaQueryList = window.matchMedia(THEME_MEDIA_QUERY);

        const handleSystemThemeChange = (): void => {
            if (getSavedTheme()) {
                return;
            }

            applyTheme(getSystemTheme());
            syncThemeColorMeta();
        };

        mediaQueryList.addEventListener('change', handleSystemThemeChange);

        return () => {
            mediaQueryList.removeEventListener('change', handleSystemThemeChange);
        };
    }, []);
};

/**
 * Resolves and persists the active application theme while following OS theme
 * changes when no explicit user override is stored.
 */
export const useTheme = (): UseThemeReturn => {
    const [theme, setThemeState] = useState<Theme>(resolveTheme);

    useEffect(() => {
        applyTheme(theme);
        syncThemeColorMeta();
    }, [theme]);

    useEffect(() => {
        const mediaQueryList = window.matchMedia(THEME_MEDIA_QUERY);

        const handleSystemThemeChange = (event: MediaQueryListEvent): void => {
            if (getSavedTheme()) {
                return;
            }

            setThemeState(event.matches ? Theme.Dark : Theme.Light);
        };

        mediaQueryList.addEventListener('change', handleSystemThemeChange);

        return () => {
            mediaQueryList.removeEventListener('change', handleSystemThemeChange);
        };
    }, []);

    const setTheme = (newTheme: Theme): void => {
        setThemeState(newTheme);
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    };

    return { theme, setTheme };
};
