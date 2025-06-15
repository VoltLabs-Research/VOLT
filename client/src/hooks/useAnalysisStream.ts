import { useEffect, useState } from 'react';
import useWebSocket from './useWebSocket';

interface UseAnalysisStreamOptions{
    folderId: string;
    timestep: number;
    baseUrl?: string;
}

const useAnalysisStream = ({ folderId, timestep, baseUrl = 'ws://127.0.0.1:8000/ws' }: UseAnalysisStreamOptions) => {
    const [data, setData] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [url, setUrl] = useState<string | null>(null);

    const { status, connect, disconnect, isConnected } = useWebSocket({
        // TODO: duplicated code
        url: url ?? '',
        autoConnect: true,
        onMessage: (event) => {
            try{
                const response = JSON.parse(event.data);
                if(response.status === 'success'){
                    // dislocations
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

    useEffect(() => {
        if(!folderId || timestep == null) return;
        const newUrl = `${baseUrl}/analysis/${folderId}/${timestep}`;
        setUrl(newUrl);
        disconnect();
    }, [folderId, timestep]);

    useEffect(() => {
        if(url){
            connect();
        }
    }, [url]);

    return {
        data,
        error,
        status,
        isConnected,
        reconnect: connect,
        disconnect
    }
};

export default useAnalysisStream;