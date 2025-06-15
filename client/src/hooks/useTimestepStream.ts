import { useState } from 'react';
import useWebSocket from './useWebSocket';

interface TimestepData{
    positions: number[][];
    total_atoms: number;
    timestep: number;
}

interface UseTimestepStreamOptions{
    folderId: string;
    timestepId: number;
    baseUrl?: string;
}

const useTimestepStream = ({ folderId, timestepId, baseUrl = 'ws://127.0.0.1:8000/ws' }: UseTimestepStreamOptions) => {
    const [data, setData] = useState<TimestepData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const { status, connect, disconnect, isConnected } = useWebSocket({
        url: `${baseUrl}/timesteps/${folderId}/${timestepId}`,
        autoConnect: true,
        onMessage: (event) => {
            try{
                const response = JSON.parse(event.data);
                if(response.status === 'success'){
                    setData(response.data);
                }else if(response.status === 'error'){
                    setError(response.data?.code || 'unhandled_exception');
                }
            }catch(err){
                setError('malformed_response');
            }
        },
        onError: () => {
            setError('connection_error');
        }
    });

    return {
        data,
        error,
        status,
        isConnected,
        reconnect: connect,
        disconnect
    }
};

export default useTimestepStream;