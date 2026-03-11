import { useEffect } from 'react';

const targetDesktopViewportWidth = 1800;
const targetDesktopViewportHeight = 960;
const desktopBreakpoint = 1024;
const defaultRootFontSize = 16;
const minimumPageScale = 0.75;

const getNormalizedPageScale = () => {
    if (window.innerWidth < desktopBreakpoint) {
        return 1;
    }

    const normalizedScale = Math.min(
        window.innerWidth / targetDesktopViewportWidth,
        window.innerHeight / targetDesktopViewportHeight,
        1
    );

    return Number.isFinite(normalizedScale) ? Math.max(normalizedScale, minimumPageScale) : 1;
};

const applyPageScale = () => {
    const pageScale = getNormalizedPageScale();

    document.documentElement.style.setProperty('--volt-root-font-size', `${(defaultRootFontSize * pageScale).toFixed(2)}px`);
};

const resetPageScale = () => {
    document.documentElement.style.removeProperty('--volt-root-font-size');
};

export const usePageScale = () => {
    useEffect(() => {
        let frameReference = 0;

        const syncPageScale = () => {
            if (frameReference) {
                cancelAnimationFrame(frameReference);
            }

            frameReference = window.requestAnimationFrame(() => {
                applyPageScale();
                frameReference = 0;
            });
        };

        syncPageScale();
        window.addEventListener('resize', syncPageScale);

        return () => {
            if (frameReference) {
                cancelAnimationFrame(frameReference);
            }

            window.removeEventListener('resize', syncPageScale);
            resetPageScale();
        };
    }, []);
};
