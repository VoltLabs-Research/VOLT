import { useMedia } from '@/shared/ui/hooks/use-media';
import { readStoredString, removeStoredValue, writeStoredString } from '@/shared/utils/local-storage';
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
    const savedTheme = readStoredString(THEME_STORAGE_KEY);

    if (savedTheme === Theme.Light || savedTheme === Theme.Dark || savedTheme === Theme.System) {
        return savedTheme;
    }

    if (savedTheme !== null) {
        removeStoredValue(THEME_STORAGE_KEY);
    }

    return null;
};

export const resolveEffectiveTheme = (preference: Theme): Theme => {
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

export const useThemeInitialization = (): void => {
    const systemPrefersDark = useMedia(THEME_MEDIA_QUERY);

    useEffect(() => {
        const preference = resolvePreference();

        applyTheme(preference === Theme.System
            ? (systemPrefersDark ? Theme.Dark : Theme.Light)
            : preference);
        syncThemeColorMeta();
    }, [systemPrefersDark]);
};

export const useTheme = (): UseThemeReturn => {
    const [preference, setPreferenceState] = useState<Theme>(resolvePreference);
    const systemPrefersDark = useMedia(THEME_MEDIA_QUERY);
    const effectiveTheme = preference === Theme.System
        ? (systemPrefersDark ? Theme.Dark : Theme.Light)
        : preference;

    useEffect(() => {
        applyTheme(effectiveTheme);
        syncThemeColorMeta();
    }, [effectiveTheme]);

    const setTheme = (newTheme: Theme): void => {
        setPreferenceState(newTheme);
        writeStoredString(THEME_STORAGE_KEY, newTheme);
    };

    return {
        theme: effectiveTheme,
        preference,
        setTheme
    };
};
