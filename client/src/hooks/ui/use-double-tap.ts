import { useRef, useCallback } from 'react';

interface UseDoubleTapProps {
    onDoubleTap: () => void;
    latency?: number;
}

const useDoubleTap = ({ onDoubleTap, latency = 300 }: UseDoubleTapProps) => {
    const tapTimeoutRef = useRef<number>(0);
    const tapCountRef = useRef(0);

    const handleInteraction = useCallback(() => {
        tapCountRef.current += 1;

        if(tapCountRef.current === 1){
            tapTimeoutRef.current = setTimeout(() => {
                tapCountRef.current = 0;
            }, latency);
        }else if(tapCountRef.current === 2){
            if(tapTimeoutRef.current){
                clearTimeout(tapTimeoutRef.current);
            }

            tapCountRef.current = 0;
            onDoubleTap();
        }
    }, [onDoubleTap, latency]);

    return { onMouseDown: handleInteraction };
};

export default useDoubleTap;