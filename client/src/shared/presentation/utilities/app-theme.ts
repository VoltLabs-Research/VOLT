import { Theme } from '@/shared/presentation/hooks/use-theme';

type VisualTheme = Theme.Light | Theme.Dark;

/** Returns the active application theme from the global theme contract (always Light or Dark). */
export const getActiveAppTheme = (): VisualTheme => {
    const theme = document.documentElement.getAttribute('data-theme');

    if (theme === Theme.Light) {
        return Theme.Light;
    }

    return Theme.Dark;
};

/** Subscribes to document-level theme contract changes. */
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
