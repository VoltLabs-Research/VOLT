import { useState, useEffect } from 'react';
import useSocket from './use-socket';

interface UseSocketConnectionResult{
    isConnected: boolean;
    connect: () => Promise<void>;
    disconnect: () => void;
};

const useSocketConnection = (): UseSocketConnectionResult => {
    const socketService = useSocket();
    const [isConnected, setIsConnected] = useState(() => socketService.isConnected());

    useEffect(() => {
        const unsubscribe = socketService.onConnectionChange((connected) => {
            setIsConnected(connected);
        });

        setIsConnected(socketService.isConnected());

        return () => {
            unsubscribe();
        };
    }, [socketService]);

    return {
        isConnected,
        connect: () => socketService.connect(),
        disconnect: () => socketService.disconnect()
    };
};

export default useSocketConnection;
