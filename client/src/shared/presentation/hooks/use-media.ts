import { useEffect, useState } from 'react';

const supportsMatchMedia = (): boolean => {
    return typeof window.matchMedia === 'function';
};

const getInitialMatch = (query: string): boolean => {
    if (!supportsMatchMedia()) {
        return false;
    }
    return window.matchMedia(query).matches;
};

/** Subscribes to a CSS media query and returns whether it currently matches. */
const useMedia = (query: string): boolean => {
    const [matches, setMatches] = useState<boolean>(() => getInitialMatch(query));

    useEffect(() => {
        if (!supportsMatchMedia()) {
            return;
        }

        const mediaQueryList = window.matchMedia(query);
        const handleChange = (event: MediaQueryListEvent) => setMatches(event.matches);

        setMatches(mediaQueryList.matches);
        mediaQueryList.addEventListener('change', handleChange);

        return () => mediaQueryList.removeEventListener('change', handleChange);
    }, [query]);

    return matches;
};

export default useMedia;
