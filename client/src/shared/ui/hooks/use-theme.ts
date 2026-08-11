import { useEffect, useState } from 'react';

export enum Theme {
    Light = 'light',
    Dark = 'dark',
    System = 'system'
};

export type VisualTheme = Theme.Light | Theme.Dark;

interface UseThemeReturn {
    
    theme: Theme;
    
    preference: Theme;
    setTheme: (theme: Theme) => void;
};

const THEME_STORAGE_KEY = 'theme';
const THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';

const getSystemTheme = (): Theme => {
    return window.matchMedia(THEME_MEDIA_QUERY).matches ? Theme.Dark : Theme.Light;
};

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

const getEffectiveTheme = (preference: Theme): Theme => {
    if (preference === Theme.System) {
        return getSystemTheme();
    }

    return preference;
};

const applyTheme = (theme: Theme): void => {
    document.documentElement.setAttribute('data-theme', theme);
};

const resolvePreference = (): Theme => {
    return getSavedTheme() ?? Theme.System;
};

const syncThemeColorMeta = (): void => {
    const backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();

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

const initializeTheme = (): void => {
    applyTheme(getEffectiveTheme(resolvePreference()));
};

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

    return {
        theme: effectiveTheme,
        preference,
        setTheme
    };
};
