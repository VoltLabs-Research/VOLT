import { useEffect, useState } from 'react';
import useWebSocket from './useWebSocket';

interface UseAnalysisStreamOptions{
    folderId: string;
    timestep: number;
    baseUrl?: string;
}

export interface DislocationSegment{
    id: number;
    points: number[][];
    burgers_vector: number[];
    magnitude: number;
    length: number;
}

const useAnalysisStream = ({ folderId, timestep, baseUrl = 'ws://127.0.0.1:8000/ws' }: UseAnalysisStreamOptions) => {
    const [data, setData] = useState<DislocationSegment[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [url, setUrl] = useState<string | null>(null);

    const { status, connect, disconnect, isConnected } = useWebSocket({
        // TODO: duplicated code
        url: url ?? '',
        autoConnect: true,
        onMessage: (event) => {
            try{
                const response = JSON.parse(event.data);
                console.log(response)
                if(response.status === 'success'){
                    const rawSegments = response.data;
                    console.log(rawSegments)
                    console.log(`OpenDXA [DEBUG]: useAnalysisTream hook (${folderId}/${timestep}) ${rawSegments.length} dislocations`)
                    const segments: DislocationSegment[] = rawSegments.map((s: any, i: number) => ({
                        id: s.index ?? i,
                        points: s.points,
                        burgers_vector: s.burgers?.vector ?? [0, 0, 0],
                        magnitude: s.burgers?.magnitude ?? 0,
                        length: s.length
                    }));
                    console.log(segments)
                    setData(segments);
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
        if(url) connect();
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