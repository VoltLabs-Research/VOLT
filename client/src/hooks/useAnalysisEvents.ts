import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

export interface AnalysisEvent{
    trajectoryId: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    timestamp: string;
    workerId?: number;
    result?: any;
    error?: string;
}

interface QueueState{
    isLoading: boolean;
    error: string | null;
    events: AnalysisEvent[];
}

const useAnalysisEvents  = (userId: string | null): QueueState => {
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [events, setEvents] = useState<AnalysisEvent[]>([]);

    useEffect(() => {
        if(!userId){
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        const socket: Socket = io('http://0.0.0.0:8000', {
            query: { userId },
            reconnectionAttempts: 5,
            transports: ['websocket']
        });

        const onConnect = () => {
            console.log('[WS] Connected to the server');
            setIsLoading(false);
        };

        const onConnectError = (err: Error) => {
            console.error('[WS] Connection error:', err);
            setError('Cannot connect');
            setIsLoading(false);
        };

        const onAnalysisUpdate = (newEvent: AnalysisEvent) => {
            setEvents((prevEvents) => [newEvent, ...prevEvents]);
        };

        socket.on('connect', onConnect);
        socket.on('connect_error', onConnectError);
        socket.on('analysisUpdate', onAnalysisUpdate);

        return () => {
            console.log('[WS] Disconnecting...');
            socket.off('connect', onConnect);
            socket.off('connect_error', onConnectError);
            socket.off('analysisUpdate', onAnalysisUpdate);
            socket.disconnect();
        };
    }, [userId]);

    return { isLoading, error, events };
};

export default useAnalysisEvents;