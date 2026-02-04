import { useEffect, useRef } from 'react';

const useAutoScroll = (dep: unknown) => {
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({
            behavior: 'smooth'
        });
    }, [dep]);

    return endRef;
};

export default useAutoScroll;
