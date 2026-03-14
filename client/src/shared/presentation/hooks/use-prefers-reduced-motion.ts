import { useEffect, useState } from 'react';

const REDUCED_MOTION_MEDIA_QUERY = '(prefers-reduced-motion: reduce)';

const getPrefersReducedMotion = (): boolean => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
    }

    return window.matchMedia(REDUCED_MOTION_MEDIA_QUERY).matches;
};

export const usePrefersReducedMotion = (): boolean => {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(getPrefersReducedMotion);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return;
        }

        const mediaQueryList = window.matchMedia(REDUCED_MOTION_MEDIA_QUERY);

        const handleChange = (event: MediaQueryListEvent) => {
            setPrefersReducedMotion(event.matches);
        };

        setPrefersReducedMotion(mediaQueryList.matches);
        mediaQueryList.addEventListener('change', handleChange);

        return () => {
            mediaQueryList.removeEventListener('change', handleChange);
        };
    }, []);

    return prefersReducedMotion;
};
