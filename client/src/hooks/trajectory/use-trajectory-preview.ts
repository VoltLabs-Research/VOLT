/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import Logger from '@/services/logger';
import useLogger from '@/hooks/core/use-logger';
import trajectoryApi from '@/services/api/trajectory';

interface UseTrajectoryPreviewOptions {
    trajectoryId: string;
    updatedAt: string;
    enabled?: boolean;
}

interface UseTrajectoryPreviewReturn {
    previewBlobUrl: string | null;
    isLoading: boolean;
    error: boolean;
    retry: () => void;
    cleanup: () => void;
}

// Local cache using Map + timestamps for invalidation by updatedAt
const previewCache = new Map<string, {
    blobUrl: string;
    updatedAt: string;
    timestamp: number;
}>();

const loadingPromises = new Map<string, Promise<string | null>>();

const CACHE_MAX_AGE = 30 * 60 * 1000;
setInterval(() => {
    const now = Date.now();
    for(const [key, value] of previewCache.entries()) {
        if(now - value.timestamp > CACHE_MAX_AGE){
            URL.revokeObjectURL(value.blobUrl);
            previewCache.delete(key);
        }
    }
}, 10 * 60 * 1000);

const useTrajectoryPreview = ({
    trajectoryId,
    updatedAt,
    enabled = true
}: UseTrajectoryPreviewOptions): UseTrajectoryPreviewReturn => {
    const logger = useLogger('use-trajectory-preview');
    const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);
    const [lastLoadedKey, setLastLoadedKey] = useState<string | null>(null);

    const currentRequestRef = useRef<AbortController | null>(null);
    const mountedRef = useRef(true);

    const getCacheKey = useCallback((trajId: string, updated: string) => {
        return `${trajId}:${new Date(updated).getTime()}`;
    }, []);

    const getPreviewFromCacheOrServer = useCallback(async(
        trajId: string,
        updated: string
    ): Promise<string | null> =>{
        const cacheKey = getCacheKey(trajId, updated);

        const cached = previewCache.get(cacheKey);
        if(cached && cached.updatedAt === updated){
            logger.log('Using cached preview:', cacheKey);
            return cached.blobUrl;
        }

        if(loadingPromises.has(cacheKey)) {
            logger.log('Waiting for existing load:', cacheKey);
            const existingPromise = loadingPromises.get(cacheKey);
            return existingPromise || null;
        }

        for(const [key, value] of previewCache.entries()) {
            if(key.startsWith(`${trajId}:`)) {
                logger.log('Cleaning old cache for trajectory:', key);
                URL.revokeObjectURL(value.blobUrl);
                previewCache.delete(key);
            }
        }

        const loadPromise = (async(): Promise<string | null> =>{
            try{
                logger.log('Loading preview from server(cache-busted):', cacheKey);
                const cacheBuster = new URLSearchParams({
                    t: Date.now().toString(),
                    updated: new Date(updated).getTime().toString(),
                    r: Math.random().toString(36)
                }).toString();

                const endpoint = `/trajectories/${trajId}/preview?${cacheBuster}`;
                logger.log('Requesting preview endpoint:', { endpoint, trajectoryId: trajId, updatedAt: updated });

                const base64Data = await trajectoryApi.getPreview(trajId, {
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0',
                        'If-None-Match': '',
                        'If-Modified-Since': 'Thu, 01 Jan 1970 00:00:00 GMT'
                    },
                    timeout: 15000
                });

                if(!base64Data || typeof base64Data !== 'string'){
                    throw new Error('Invalid base64 response from server');
                }

                const base64Content = base64Data.includes(',')
                    ? base64Data.split(',')[1]
                    : base64Data;

                const binaryString = atob(base64Content);
                const bytes = new Uint8Array(binaryString.length);
                for(let i = 0; i < binaryString.length; i++){
                    bytes[i] = binaryString.charCodeAt(i);
                }

                const blob = new Blob([bytes], { type: 'image/png' });
                if(blob.size === 0){
                    throw new Error('Empty or invalid image data');
                }

                const blobUrl = URL.createObjectURL(blob);
                previewCache.set(cacheKey, {
                    blobUrl,
                    updatedAt: updated,
                    timestamp: Date.now()
                });

                return blobUrl;
            }catch(err: any){
                logger.error('API Error loading preview');
                throw err;
            }finally{
                loadingPromises.delete(cacheKey);
            }
        })();

        loadingPromises.set(cacheKey, loadPromise);
        return loadPromise;
    }, [getCacheKey]);

    const cleanup = useCallback(() => {
        // Cancel ongoing request
        if(currentRequestRef.current){
            currentRequestRef.current.abort();
            currentRequestRef.current = null;
        }

        setPreviewBlobUrl(null);
        setLastLoadedKey(null);
    }, []);

    const loadPreview = useCallback(async() => {
        // Do not load if disabled
        if(!enabled){
            setPreviewBlobUrl(null);
            setLastLoadedKey(null);
            setIsLoading(false);
            return;
        }

        const currentKey = getCacheKey(trajectoryId, updatedAt);

        if(currentKey === lastLoadedKey && previewBlobUrl){
            setIsLoading(false);
            return;
        }

        // Cancel any ongoing request
        if(currentRequestRef.current){
            currentRequestRef.current.abort();
        }

        const abortController = new AbortController();
        currentRequestRef.current = abortController;

        try{
            setIsLoading(true);
            setError(false);

            const blobUrl = await getPreviewFromCacheOrServer(trajectoryId, updatedAt);

            // Check if component is still mounted and request wan't cancelled
            if(!mountedRef.current || abortController.signal.aborted){
                return;
            }

            if(!blobUrl){
                throw new Error('No preview URL returned');
            }

            setPreviewBlobUrl(blobUrl);
            setLastLoadedKey(currentKey);

        }catch(err: any){
            // Don't set error state if request was cancelled
            if(err.name === 'CanceledError' || err.name === 'Aborterror'){
                logger.log('Preview request cancelled', { trajectoryId, updatedAt });
                return;
            }

            logger.error('Fatal error in loadPreview');
            setError(true);
            setPreviewBlobUrl(null);
            setLastLoadedKey(null);
        }finally{
            if(mountedRef.current){
                setIsLoading(false);
            }

            if(currentRequestRef.current === abortController){
                currentRequestRef.current = null;
            }
        }
    }, [enabled, trajectoryId, updatedAt, getCacheKey, getPreviewFromCacheOrServer]);

    const loadPreviewRef = useRef(loadPreview);
    useEffect(() => {
        loadPreviewRef.current = loadPreview;
    }, [loadPreview]);

    const retry = useCallback(() => {
        setError(false);

        const currentKey = getCacheKey(trajectoryId, updatedAt);
        const cached = previewCache.get(currentKey);
        if(cached){
            logger.log('Force retry: clearing cache for', currentKey);
            URL.revokeObjectURL(cached.blobUrl);
            previewCache.delete(currentKey);
        }

        setLastLoadedKey(null);
        loadPreviewRef.current();
    }, [trajectoryId, updatedAt, getCacheKey]);

    // Detectar cambios en updatedAt y recargar preview
    useEffect(() => {
        logger.log('useTrajectoryPreview effect - updatedAt changed:', { updatedAt, enabled, trajectoryId });
        if(enabled && trajectoryId){
            logger.log('Triggering preview reload for updatedAt:', updatedAt);
            loadPreviewRef.current();
        }
    }, [updatedAt, enabled, trajectoryId]);

    useEffect(() => {
        mountedRef.current = true;

        return() => {
            mountedRef.current = false;
            cleanup();
        };
    }, [cleanup]);

    return {
        previewBlobUrl,
        isLoading,
        error,
        retry,
        cleanup
    };
};

export const clearTrajectoryPreviewCache = (trajectoryId: string) => {
    const logger = new Logger('clear-trajectory-preview-cache');
    logger.log('Clearing cache for trajectory:', trajectoryId);
    for(const [key, value] of previewCache.entries()) {
        if(key.startsWith(`${trajectoryId}:`)) {
            URL.revokeObjectURL(value.blobUrl);
            previewCache.delete(key);
        }
    }
};

export default useTrajectoryPreview;
