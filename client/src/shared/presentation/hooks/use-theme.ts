import { useEffect, useState } from 'react';

/** Supported application themes. */
export enum Theme {
    Light = 'light',
    Dark = 'dark',
    System = 'system'
};

interface UseThemeReturn {
    /** Effective theme applied to the document (always Light or Dark). */
    theme: Theme;
    /** User preference stored in localStorage (Light, Dark, or System). */
    preference: Theme;
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

    if (savedTheme === Theme.Light || savedTheme === Theme.Dark || savedTheme === Theme.System) {
        return savedTheme;
    }

    if (savedTheme !== null) {
        localStorage.removeItem(THEME_STORAGE_KEY);
    }

    return null;
};

/** Resolves a theme preference into the concrete theme to apply (Light or Dark). */
const getEffectiveTheme = (preference: Theme): Theme => {
    if (preference === Theme.System) {
        return getSystemTheme();
    }

    return preference;
};

/** Updates the document theme contract attribute. */
const applyTheme = (theme: Theme): void => {
    document.documentElement.setAttribute('data-theme', theme);
};

/** Returns the user preference, defaulting to System on first launch. */
const resolvePreference = (): Theme => {
    return getSavedTheme() ?? Theme.System;
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
    applyTheme(getEffectiveTheme(resolvePreference()));
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
            const preference = getSavedTheme() ?? Theme.System;

            if (preference !== Theme.System) {
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
 * changes when the System preference is active.
 */
export const useTheme = (): UseThemeReturn => {
    const [preference, setPreferenceState] = useState<Theme>(resolvePreference);
    const [effectiveTheme, setEffectiveTheme] = useState<Theme>(() => getEffectiveTheme(preference));

    useEffect(() => {
        const effective = getEffectiveTheme(preference);
        setEffectiveTheme(effective);
        applyTheme(effective);
        syncThemeColorMeta();
    }, [preference]);

    useEffect(() => {
        if (preference !== Theme.System) {
            return;
        }

        const mediaQueryList = window.matchMedia(THEME_MEDIA_QUERY);

        const handleSystemThemeChange = (event: MediaQueryListEvent): void => {
            const newEffective = event.matches ? Theme.Dark : Theme.Light;
            setEffectiveTheme(newEffective);
            applyTheme(newEffective);
            syncThemeColorMeta();
        };

        mediaQueryList.addEventListener('change', handleSystemThemeChange);

        return () => {
            mediaQueryList.removeEventListener('change', handleSystemThemeChange);
        };
    }, [preference]);

    const setTheme = (newTheme: Theme): void => {
        setPreferenceState(newTheme);
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    };

    return { theme: effectiveTheme, preference, setTheme };
};
