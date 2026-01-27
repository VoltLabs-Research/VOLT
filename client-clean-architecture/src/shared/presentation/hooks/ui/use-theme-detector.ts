import { useState, useEffect } from 'react';

interface UseThemeDetectorOptions {
    /**
     * Callback function to execute when theme changes
     */
    onThemeChange?: (isLight: boolean) => void;
}

/**
 * Hook to detect and observe theme changes via data-theme attribute.
 * Uses MutationObserver to watch for theme attribute changes on document root.
 */
const useThemeDetector = (options: UseThemeDetectorOptions = {}) => {
    const { onThemeChange } = options;

    const [isLight, setIsLight] = useState(() => {
        if (typeof document === 'undefined') return false;
        return document.documentElement.getAttribute('data-theme') === 'light';
    });

    useEffect(() => {
        if (typeof document === 'undefined') return;

        const root = document.documentElement;

        const update = () => {
            const isLightTheme = root.getAttribute('data-theme') === 'light';
            setIsLight(isLightTheme);
            onThemeChange?.(isLightTheme);
        };

        // Initial update
        update();

        // Observe theme changes
        const observer = new MutationObserver(update);
        observer.observe(root, {
            attributes: true,
            attributeFilter: ['data-theme']
        });

        return () => observer.disconnect();
    }, [onThemeChange]);

    return { isLight, isDark: !isLight };
};

export default useThemeDetector;
