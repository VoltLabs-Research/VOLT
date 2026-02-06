import { useCallback, useRef } from 'react';

const useThrottledCallback = <T extends (...args: any[]) => void>(callback: T, delay: number) => {
    const lastCallRef = useRef(0);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    return useCallback((...args: Parameters<T>) => {
        const now = Date.now();
        const elapsed = now - lastCallRef.current;

        if (elapsed >= delay) {
            lastCallRef.current = now;
            callback(...args);
            return;
        }

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            lastCallRef.current = Date.now();
            callback(...args);
        }, delay - elapsed);
    }, [callback, delay]);
};

export default useThrottledCallback;
