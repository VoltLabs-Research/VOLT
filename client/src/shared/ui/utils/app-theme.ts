import { Theme } from '@/shared/ui/hooks/use-theme';
import type { VisualTheme } from '@/shared/ui/hooks/use-theme';

export const getActiveAppTheme = (): VisualTheme => {
    const theme = document.documentElement.getAttribute('data-theme');

    if (theme === Theme.Light) {
        return Theme.Light;
    }

    return Theme.Dark;
};

export const subscribeToAppTheme = (listener: (theme: VisualTheme) => void): (() => void) => {
    let currentTheme = getActiveAppTheme();
    listener(currentTheme);

    const observer = new MutationObserver(() => {
        const nextTheme = getActiveAppTheme();

        if (nextTheme === currentTheme) {
            return;
        }

        currentTheme = nextTheme;
        listener(nextTheme);
    });

    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
    });

    return () => {
        observer.disconnect();
    };
};
