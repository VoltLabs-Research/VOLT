import React, { useState, useEffect, useCallback } from 'react';
import ThemeSettings from '@/features/settings/components/molecules/ThemeSettings';

const ThemePage: React.FC = () => {
    const [currentTheme, setCurrentTheme] = useState('dark');

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        const theme = savedTheme || systemTheme;
        setCurrentTheme(theme);
    }, []);

    const handleThemeToggle = useCallback((theme: string) => {
        setCurrentTheme(theme);
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, []);

    return (
        <ThemeSettings
            currentTheme={currentTheme}
            onThemeChange={handleThemeToggle}
        />
    );
};

export default ThemePage;
