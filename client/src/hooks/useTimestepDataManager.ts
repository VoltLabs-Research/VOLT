/* *****************************************************************************
 *
 * Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 **************************************************************************** */

import { useState, useEffect, useRef } from 'react';

// --- Interfaces de Tipos ---
export interface DislocationSegment{
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

export interface AtomsData{
    positions: Float32Array;
    ids: Uint32Array;
    lammps_types: Uint8Array; 
    total_atoms: number;
    timestep: number;
    [key: string]: any;
}

export interface DislocationResultsData{
    total_dislocations: number;
    total_length: number;
    density: number;
}

export interface CombinedTimestepData{
    atoms_data: AtomsData;
    dislocation_data: DislocationSegment[];
    dislocation_results: DislocationResultsData;
}

interface UseTimestepDataManagerProps {
    folderId: string | null;
    currentTimestep: number;
    timesteps: number[];
    refreshKey?: number;
}

const PRELOAD_AHEAD_COUNT = 5;

const useTimestepDataManager = ({ folderId, currentTimestep, timesteps, refreshKey = 0 }: UseTimestepDataManagerProps) => {
    const [cache, setCache] = useState(new Map<number, CombinedTimestepData>());
    const [data, setData] = useState<CombinedTimestepData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const workerRef = useRef<Worker | null>(null);
    const preloadQueueRef = useRef<number[]>([]);
    const isPreloadingRef = useRef(false);

    const folderIdRef = useRef<string | null>(null);

    const lastRefreshKeyRef = useRef(0);

    useEffect(() => {
        folderIdRef.current = folderId;
    }, [folderId]);

    useEffect(() => {
        workerRef.current = new Worker(new URL('../workers/fetcher.worker.js', import.meta.url), {
            type: 'module'
        });

        const handleWorkerMessage = (event: MessageEvent) => {
            const { status, data: workerData, error: workerError, timestep: messageTimestep } = event.data;
            if (status === 'success') {
                const receivedTimestep = workerData.atoms_data.timestep;
                
                setCache((prevCache) => {
                    const newCache = new Map(prevCache);
                    newCache.set(receivedTimestep, workerData);
                    return newCache;
                });

                if (receivedTimestep === currentTimestep) {
                    setData(workerData);
                    setIsLoading(false);
                    setError(null);
                }

                if (isPreloadingRef.current && preloadQueueRef.current[0] === receivedTimestep) {
                    preloadQueueRef.current.shift();
                    processPreloadQueue();
                }
            } else { 
                console.error('Worker returned an error for timestep', messageTimestep, ':', workerError);
                if (messageTimestep === currentTimestep) {
                    setError(workerError);
                    setIsLoading(false);
                    setData(null);
                }
                if (isPreloadingRef.current && preloadQueueRef.current[0] === messageTimestep) {
                    preloadQueueRef.current.shift();
                    processPreloadQueue();
                }
            }
        };

        workerRef.current.onmessage = handleWorkerMessage;

        return () => {
            workerRef.current?.terminate();
            workerRef.current = null;
        };
    }, [currentTimestep]); 

    const processPreloadQueue = () => {
        if(!workerRef.current || preloadQueueRef.current.length === 0 || !folderIdRef.current){
            isPreloadingRef.current = false;
            return;
        }

        isPreloadingRef.current = true;
        const timestepToPreload = preloadQueueRef.current[0];

        if(cache.has(timestepToPreload)){
            preloadQueueRef.current.shift();
            processPreloadQueue(); 
            return;
        }

        console.log(`[useTimestepDataManager] [Preload] Requesting background load for: ${timestepToPreload}`);
        workerRef.current.postMessage({ 
            folderId: folderIdRef.current, 
            timestep: timestepToPreload, 
            forceRefresh: false
        });
    };

    useEffect(() => {
        if(!folderId || currentTimestep === null || timesteps.length === 0){
            setData(null);
            setIsLoading(false);
            setError(null);
            return;
        }
        const shouldForceRefresh = refreshKey !== lastRefreshKeyRef.current;
        lastRefreshKeyRef.current = refreshKey;

        if (shouldForceRefresh || !cache.has(currentTimestep)) {
            console.log(`[useTimestepDataManager] ${shouldForceRefresh ? 'Force-loading' : 'Loading'} timestep ${currentTimestep}.`);
            setIsLoading(true);
            setError(null);
            setData(null); 
            
            workerRef.current?.postMessage({ 
                folderId, 
                timestep: currentTimestep, 
                forceRefresh: shouldForceRefresh 
            });
        } else {
            console.log(`[useTimestepDataManager] Cache hit for timestep ${currentTimestep}.`);
            setData(cache.get(currentTimestep));
            setIsLoading(false);
            setError(null);
        }
        
        const currentIndex = timesteps.indexOf(currentTimestep);
        if(currentIndex === -1) {
            preloadQueueRef.current = []; 
            return;
        }

        const newPreloadQueue: number[] = [];
        for(let i = 1; i <= PRELOAD_AHEAD_COUNT; i++){
            const nextIndex = (currentIndex + i) % timesteps.length; 
            const nextTimestep = timesteps[nextIndex];
            
            if(!cache.has(nextTimestep) && !newPreloadQueue.includes(nextTimestep) && !preloadQueueRef.current.includes(nextTimestep) && nextTimestep !== currentTimestep){
                newPreloadQueue.push(nextTimestep);
            }
        }
        preloadQueueRef.current.push(...newPreloadQueue);

        if(!isPreloadingRef.current){
            processPreloadQueue();
        }
    }, [currentTimestep, folderId, timesteps, refreshKey, cache]); 

    return { data, isLoading, error, cacheSize: cache.size, totalTimesteps: timesteps.length };
};

export default useTimestepDataManager;