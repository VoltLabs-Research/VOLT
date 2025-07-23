import { useRef, useCallback } from 'react';

const useThrottledCallback = (callback: () => void, delay: number) => {
    const timeoutRef = useRef<number>(0);
    const lastCallRef = useRef(0);

    return useCallback(() => {
        const now = Date.now();
        const timeSinceLastCall = now - lastCallRef.current;

        if(timeSinceLastCall >= delay){
            callback();
            lastCallRef.current = now;
        }else{
            if(timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                callback();
                lastCallRef.current = Date.now();
            }, delay - timeSinceLastCall);
        }
    }, [callback, delay]);
};

export default useThrottledCallback;