import useSocket from './use-socket';
import { useEffect, useRef } from 'react';

interface UseSocketConnectionEffectOptions {
    runOnMount?: boolean;
};

const useSocketConnectionEffect = (
    callback: (connected: boolean) => void,
    options: UseSocketConnectionEffectOptions = {}
): void => {
    const { runOnMount = false } = options;
    const socketService = useSocket();
    const callbackRef = useRef(callback);

    callbackRef.current = callback;

    useEffect(() => {
        const unsubscribe = socketService.onConnectionChange((connected) => {
            callbackRef.current(connected);
        });

        if (runOnMount) {
            callbackRef.current(socketService.isConnected());
        }

        return unsubscribe;
    }, [socketService, runOnMount]);
};

export default useSocketConnectionEffect;
