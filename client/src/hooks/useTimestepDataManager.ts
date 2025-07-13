import { useState, useEffect, useRef } from 'react';

export interface DislocationSegment {
    id: number;
    points: number[][];
    length: number;
    type: string;
    is_closed: boolean | null;
    burgers: {
        vector: number[];
        magnitude: number;
        fractional: string;
    };
}

export interface AtomsData {
    positions: number[][];
    total_atoms: number;
    timestep: number;
    [key: string]: any;
}

export interface DislocationResultsData {
    total_dislocations: number;
    total_length: number;
    density: number;
}

export interface CombinedTimestepData {
    atoms_data: AtomsData;
    dislocation_data: DislocationSegment[];
    dislocation_results: DislocationResultsData;
}

interface UseTimestepDataManagerOptions {
    folderId: string | null;
    currentTimestep: number;
    timesteps: number[];
    baseUrl?: string;
}

const useTimestepDataManager = ({
    folderId,
    currentTimestep,
    timesteps,
    baseUrl = 'ws://192.168.1.85:8000/ws'
}: UseTimestepDataManagerOptions) => {
    const [cache, setCache] = useState<Map<number, CombinedTimestepData>>(new Map());
    const [data, setData] = useState<CombinedTimestepData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    
    const streamSocketRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!folderId) return;

        if (cache.has(currentTimestep)) {
            setData(cache.get(currentTimestep)!);
            setIsLoading(false);
            setError(null);
        } else {
            setData(null);
            setIsLoading(true);
        }
    }, [currentTimestep, cache, folderId]);

    useEffect(() => {
        if (!folderId || timesteps.length === 0) {
            setCache(new Map());
            if (streamSocketRef.current) {
                streamSocketRef.current.close();
                streamSocketRef.current = null;
            }
            return;
        }
        
        if (streamSocketRef.current) return;

        const timestepsToLoad = timesteps.filter(t => !cache.has(t));
        if (timestepsToLoad.length === 0) return;

        const url = `${baseUrl}/stream_timesteps/${folderId}`;
        const ws = new WebSocket(url);
        streamSocketRef.current = ws;

        ws.onopen = () => {
            ws.send(JSON.stringify({
                action: 'request_timesteps',
                timesteps: timestepsToLoad
            }));
        };

        ws.onmessage = (event) => {
            const response = JSON.parse(event.data);
            if (response.status === 'success' && response.type === 'timestep_data') {
                const receivedData = response.data as CombinedTimestepData;
                const receivedTimestep = receivedData.atoms_data.timestep;
                setCache(prevCache => new Map(prevCache).set(receivedTimestep, receivedData));
            } else if (response.status === 'success' && response.type === 'stream_complete') {
                ws.close();
            } else {
                setError('stream_error');
            }
        };

        ws.onerror = () => setError('stream_connection_error');
        ws.onclose = () => streamSocketRef.current = null;

        return () => {
            if(ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)){
                ws.close();
            }
            streamSocketRef.current = null;
        };
    }, [folderId, timesteps, baseUrl]);
    
    return { data, isLoading, error, cacheSize: cache.size };
};

export default useTimestepDataManager;