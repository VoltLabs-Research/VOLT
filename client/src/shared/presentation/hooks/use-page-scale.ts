import { useEffect } from 'react';

const targetDesktopViewportWidth = 1800;
const targetDesktopViewportHeight = 960;
const desktopBreakpoint = 1024;
const minimumPageScale = 0.1;

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
    const pageWidthPercent = 100 / pageScale;
    const pageMinHeightVh = 100 / pageScale;

    document.documentElement.style.setProperty('--volt-page-scale', pageScale.toFixed(4));
    document.documentElement.style.setProperty('--volt-page-width', `${pageWidthPercent}%`);
    document.documentElement.style.setProperty('--volt-page-min-height', `${pageMinHeightVh}vh`);
};

const resetPageScale = () => {
    document.documentElement.style.removeProperty('--volt-page-scale');
    document.documentElement.style.removeProperty('--volt-page-width');
    document.documentElement.style.removeProperty('--volt-page-min-height');
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
        window.visualViewport?.addEventListener('resize', syncPageScale);

        return () => {
            if (frameReference) {
                cancelAnimationFrame(frameReference);
            }

            window.removeEventListener('resize', syncPageScale);
            window.visualViewport?.removeEventListener('resize', syncPageScale);
            resetPageScale();
        };
    }, []);
};
