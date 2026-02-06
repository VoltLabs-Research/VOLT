import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark';

interface UseThemeReturn{
    theme: Theme;
    setTheme: (theme: Theme) => void;
};

const getSystemTheme = (): Theme => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getSavedTheme = (): Theme | null => {
    const saved = localStorage.getItem('theme');
    if(saved === 'light' || saved === 'dark'){
        return saved;
    }
    return null;
};

const applyTheme = (theme: Theme): void => {
    document.documentElement.setAttribute('data-theme', theme);
};

export const useTheme = (): UseThemeReturn => {
    const [theme, setThemeState] = useState<Theme>(() => {
        const saved = getSavedTheme();
        if(saved){
            return saved;
        }
        return getSystemTheme();
    });

    useEffect(() => {
        applyTheme(theme);
    }, [theme]);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    };

    return { theme, setTheme };
};
