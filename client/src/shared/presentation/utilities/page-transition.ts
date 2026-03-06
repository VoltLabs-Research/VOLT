const TRANSITION_DURATION = 400; // ms

let overlay: HTMLDivElement | null = null;

const getOverlay = (): HTMLDivElement => {
    if (overlay && document.body.contains(overlay)) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'page-transition-overlay';
    Object.assign(overlay.style, {
        position: 'fixed',
        inset: '0',
        background: '#000',
        zIndex: '99999',
        opacity: '0',
        pointerEvents: 'none',
        transition: `opacity ${TRANSITION_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`,
    });
    document.body.appendChild(overlay);
    return overlay;
};

/**
 * Fade the screen to black, then call `onComplete`.
 * Returns a promise that resolves when the fade-in-to-black is done.
 */
export const fadeToBlack = (): Promise<void> => {
    return new Promise((resolve) => {
        const el = getOverlay();
        el.style.pointerEvents = 'all';

        // Force reflow so transition triggers
        void el.offsetHeight;
        el.style.opacity = '1';

        setTimeout(resolve, TRANSITION_DURATION);
    });
};

/**
 * Fade from black back to visible content.
 * Call this on the destination page mount.
 */
export const fadeFromBlack = (): void => {
    const el = getOverlay();

    // Small delay so the new page has rendered
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            el.style.opacity = '0';

            setTimeout(() => {
                el.style.pointerEvents = 'none';
            }, TRANSITION_DURATION);
        });
    });
};
