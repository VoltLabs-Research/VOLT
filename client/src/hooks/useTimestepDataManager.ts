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
***************************************************************************** */

import { useState, useEffect, useRef } from 'react';

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
    positions: number[][];
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

const PRELOAD_AHEAD_COUNT = 5;

const useTimestepDataManager = ({ folderId, currentTimestep, timesteps }) => {
    const [cache, setCache] = useState(new Map());
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    
    const workerRef = useRef(null);
    const preloadQueueRef = useRef([]);
    const isPreloadingRef = useRef(false);

    const folderIdRef = useRef(null);

    useEffect(() => {
        folderIdRef.current = folderId;
    }, [folderId]);

    useEffect(() => {
        workerRef.current = new Worker(new URL('../workers/fetcher.worker.js', import.meta.url), {
            type: 'module'
        });

        const handleWorkerMessage = (event) => {
            const { status, data: workerData, error: workerError } = event.data;
            if(status !== 'success'){
                console.error('Worker returned an error:', workerError);
                setError(workerError);
                return;
            }

            const receivedTimestep = workerData.atoms_data.timestep;
            setCache((prevCache) => new Map(prevCache).set(receivedTimestep, workerData));
            if(isPreloadingRef.current && preloadQueueRef.current[0] === receivedTimestep){
                preloadQueueRef.current.shift();
                processPreloadQueue();
            }
        };

        workerRef.current.onmessage = handleWorkerMessage;

        return () => {
            workerRef.current?.terminate();
            workerRef.current = null;
        };
    }, []);

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

        console.log(`[Preload] Requesting background load for: ${timestepToPreload}`);
        workerRef.current.postMessage({ folderId: folderIdRef.current, timestep: timestepToPreload });
    };

    useEffect(() => {
        if(!folderId || currentTimestep === null || timesteps.length === 0){
            return;
        }

        if(cache.has(currentTimestep)){
            setData(cache.get(currentTimestep));
            setIsLoading(false);
        }else{
            setIsLoading(true);
            setData(null);
            workerRef.current?.postMessage({ folderId, timestep: currentTimestep });
        }
        
        const currentIndex = timesteps.indexOf(currentTimestep);
        if(currentIndex === -1) return;
        const nextTimestepsToPreload = [];
        for(let i = 1; i <= PRELOAD_AHEAD_COUNT; i++){
            const nextIndex = (currentIndex + 1) % timesteps.length;
            const nextTimestep = timesteps[nextIndex];
            if(!cache.has(nextTimestep) && !preloadQueueRef.current.includes(nextTimestep)){
                nextTimestepsToPreload.push(nextTimestep);
            }
        }
        preloadQueueRef.current.push(...nextTimestepsToPreload);
        if(!isPreloadingRef.current){
            processPreloadQueue();
        }
    }, [currentTimestep, folderId, cache, timesteps]);

    return { data, isLoading, error, cacheSize: cache.size, totalTimesteps: timesteps.length };
};

export default useTimestepDataManager;