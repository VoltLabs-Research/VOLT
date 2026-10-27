import { useEffect, useState } from 'react';

export const useScrolledPast = (pixels: number): boolean => {
    const [isPast, setPast] = useState(false);

    useEffect(() => {
        const update = () => setPast(window.scrollY > pixels);
        update();
        window.addEventListener('scroll', update, { passive: true });
        return () => window.removeEventListener('scroll', update);
    }, [pixels]);

    return isPast;
};
