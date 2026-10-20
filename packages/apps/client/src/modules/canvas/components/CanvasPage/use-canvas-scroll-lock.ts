import { useEffect } from 'react';

const lockStyles = (element: HTMLElement, styles: Record<string, string>): (() => void) => {
    const previous = Object.keys(styles).map((property) => [property, element.style.getPropertyValue(property)] as const);

    for (const [property, value] of Object.entries(styles)) {
        element.style.setProperty(property, value);
    }

    return () => {
        for (const [property, value] of previous) {
            element.style.setProperty(property, value);
        }
    };
};

const useCanvasScrollLock = (enabled: boolean) => {
    useEffect(() => {
        if (!enabled) {
            return;
        }

        const scrollY = window.scrollY;
        const release = [
            lockStyles(document.body, {
                position: 'fixed',
                top: `-${scrollY}px`,
                left: '0',
                right: '0',
                width: '100%',
                overflow: 'hidden',
                'overscroll-behavior': 'none'
            }),
            lockStyles(document.documentElement, {
                overflow: 'hidden',
                'overscroll-behavior': 'none'
            })
        ];

        return () => {
            for (const restore of release) {
                restore();
            }

            window.scrollTo(0, scrollY);
        };
    }, [enabled]);
};

export default useCanvasScrollLock;
