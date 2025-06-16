import { useState, useEffect, useRef, useCallback } from 'react';

export interface DislocationSegment {
    id: number;
    points: number[][];
    burgers_vector: number[];
    magnitude: number;
    length: number;
}

export interface AtomsData {
    positions: number[][];
    total_atoms: number;
    timestep: number;
    [key: string]: any;
}

export interface CombinedTimestepData {
    atoms_data: AtomsData;
    dislocation_data: DislocationSegment[];
}

interface UseTimestepDataManagerOptions {
    folderId: string | null;
    currentTimestep: number;
    timesteps: number[];
    preloadCount?: number;
    baseUrl?: string;
}

const useTimestepDataManager = ({
    folderId,
    currentTimestep,
    timesteps,
    preloadCount = 5,
    baseUrl = 'ws://127.0.0.1:8000/ws'
}: UseTimestepDataManagerOptions) => {
    const [cache, setCache] = useState<Map<number, CombinedTimestepData>>(new Map());
    const [data, setData] = useState<CombinedTimestepData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const activeSockets = useRef<Map<number, WebSocket>>(new Map());
    
    const currentTimestepRef = useRef(currentTimestep);
    useEffect(() => {
        currentTimestepRef.current = currentTimestep;
    }, [currentTimestep]);

    const fetchTimestep = useCallback((timestepId: number) => {
        if (!folderId || cache.has(timestepId) || activeSockets.current.has(timestepId)) {
            return;
        }

        const url = `${baseUrl}/timestep_data/${folderId}/${timestepId}`;
        const ws = new WebSocket(url);
        activeSockets.current.set(timestepId, ws);

        ws.onopen = () => {
            if (timestepId === currentTimestepRef.current) {
                setIsLoading(true);
            }
        };

        ws.onmessage = (event) => {
            try {
                const response = JSON.parse(event.data);
                if (response.status === 'success') {
                    const receivedData = response.data as CombinedTimestepData;
                    setCache(prevCache => new Map(prevCache).set(timestepId, receivedData));
                    
                    if (timestepId === currentTimestepRef.current) {
                        setData(receivedData);
                        setIsLoading(false);
                        setError(null);
                    }
                } else if (response.status === 'error') {
                    if (timestepId === currentTimestepRef.current) {
                        setError(response.data?.code || 'unhandled_exception');
                        setIsLoading(false);
                    }
                }
            } catch (err) {
                if (timestepId === currentTimestepRef.current) {
                    setError('malformed_response');
                    setIsLoading(false);
                }
            }
        };

        ws.onerror = () => {
            if (timestepId === currentTimestepRef.current) {
                setError('connection_error');
                setIsLoading(false);
            }
        };

        ws.onclose = () => {
            activeSockets.current.delete(timestepId);
        };

    }, [folderId, baseUrl]);

    useEffect(() => {
        if (!folderId || timesteps.length === 0) {
            setData(null);
            setCache(new Map());
            activeSockets.current.forEach(ws => ws.close());
            activeSockets.current.clear();
            return;
        }

        if (cache.has(currentTimestep)) {
            setData(cache.get(currentTimestep)!);
            setIsLoading(false);
            setError(null);
        } else {
            setData(null);
            setError(null);
            fetchTimestep(currentTimestep);
        }

        const currentIndex = timesteps.indexOf(currentTimestep);
        if (currentIndex !== -1) {
            for (let i = 1; i <= preloadCount; i++) {
                const nextIndex = currentIndex + i;
                if (nextIndex < timesteps.length) {
                    const nextTimestepId = timesteps[nextIndex];
                    fetchTimestep(nextTimestepId);
                }
            }
        }
        
    }, [currentTimestep, folderId, timesteps, fetchTimestep, preloadCount]);
    
    return { data, isLoading, error };
};

export default useTimestepDataManager;