import { useEffect, useState } from 'react';

const NARROW_MEDIA_QUERY = '(max-width: 1199px)';

const getInitialMatch = (): boolean => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
    }
    return window.matchMedia(NARROW_MEDIA_QUERY).matches;
};

const useViewportNarrow = (): boolean => {
    const [isNarrow, setIsNarrow] = useState<boolean>(getInitialMatch);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return;
        }

        const mediaQueryList = window.matchMedia(NARROW_MEDIA_QUERY);
        const handleChange = (event: MediaQueryListEvent) => setIsNarrow(event.matches);

        setIsNarrow(mediaQueryList.matches);
        mediaQueryList.addEventListener('change', handleChange);

        return () => mediaQueryList.removeEventListener('change', handleChange);
    }, []);

    return isNarrow;
};

export default useViewportNarrow;
