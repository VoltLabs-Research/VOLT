import { useEffect, useRef } from 'react';
import useSocket from './use-socket';

interface UseSocketEventOptions{
    enabled?: boolean;
}

const useSocketEvent = <T = unknown>(
    event: string,
    callback: (data: T) => void,
    options: UseSocketEventOptions = {}
): void => {
    const { enabled = true } = options;
    const socketService = useSocket();
    const callbackRef = useRef(callback);

    callbackRef.current = callback;

    useEffect(() => {
        if(!enabled) {
            return;
        }

        const handler = (data: T): void => {
            callbackRef.current(data);
        };

        const unsubscribe = socketService.on(event, handler as (...args: unknown[]) => void);

        return () => {
            unsubscribe();
        };
    }, [event, enabled, socketService]);
};

export default useSocketEvent;
