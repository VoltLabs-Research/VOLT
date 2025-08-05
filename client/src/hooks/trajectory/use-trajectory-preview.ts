import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/services/api';

interface UseTrajectoryPreviewOptions{
    trajectoryId: string;
    previewId?: string | null;
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

const useTrajectoryPreview = ({
    trajectoryId,
    previewId,
    updatedAt,
    enabled = true
}: UseTrajectoryPreviewOptions): UseTrajectoryPreviewReturn => {
    const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(false);
    const [lastPreviewId, setLastPreviewId] = useState<string | null>(null);

    const currentRequestRef = useRef<AbortController | null>(null);
    const mountedRef = useRef(true);

    const cleanup = useCallback(() => {
        // Cancel ongoing request
        if(currentRequestRef.current){
            currentRequestRef.current.abort();
            currentRequestRef.current = null;
        }

        // Cleanup blob url
        setPreviewBlobUrl((prev) => {
            console.log('Cleaning up preview blob URL:', prev);
            if(prev){
                URL.revokeObjectURL(prev);
            }
            return null;
        });

        setLastPreviewId(null);
    }, []);

    const loadPreview = useCallback(async () => {
        // Do not load if disabled or there is no preview
        if(!enabled || !previewId){
            setPreviewBlobUrl(null);
            setLastPreviewId(null);
            return;
        }

        // Skip if the preview ID has not changed
        if(previewId === lastPreviewId){
            console.log('Preview ID unchanged, skipping reload:', previewId);
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
            
            console.log('Loading preview for trajectory:', trajectoryId, 'previewId:', previewId);

            // Cleanup previous blob URL
            setPreviewBlobUrl((prev) => {
                if(prev){
                    URL.revokeObjectURL(prev);
                }
                return null;
            });

            // Cache busting, timestamp + previewId + updatedAt
            const cacheBuster = new URLSearchParams({
                t: Date.now().toString(),
                pid: previewId,
                updated: new Date(updatedAt).getTime().toString()
            }).toString();

            const response = await api.get(
                `/trajectories/${trajectoryId}/preview?${cacheBuster}`,
                {
                    responseType: 'blob',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    },
                    timeout: 10000
                }
            );

            // Check if component is still mounted and request wasn't cancelled
            if(!mountedRef.current || abortController.signal.aborted){
                return;
            }

            if(!response.data || response.data.size === 0){
                throw new Error('Empty or invalid image response');
            }

            const blobUrl = URL.createObjectURL(response.data);
            setPreviewBlobUrl(blobUrl);
            setLastPreviewId(previewId);

            console.log('Preview loaded successfully:', blobUrl);
        }catch(err: any){
            // Don't set error state if request was cancelled
            if(err.name === 'CanceledError' || err.name === 'AbortError'){
                console.log('Preview request cancelled');
                return;
            }

            console.error('Error loading preview:', err);
            setError(true);
            setPreviewBlobUrl(null);
            setLastPreviewId(null);
        }finally{
            if(mountedRef.current){
                setIsLoading(false);
            }

            if(currentRequestRef.current === abortController){
                currentRequestRef.current = null;
            }
        }
    }, [enabled, previewId, trajectoryId, updatedAt, lastPreviewId]);

    const retry = useCallback(() => {
        setError(false);
        // Force reload
        setLastPreviewId(null);
        loadPreview();
    }, [loadPreview]);

    useEffect(() => {
        loadPreview();
    }, [loadPreview]);

    useEffect(() => {
        mountedRef.current = true;

        return () => {
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

export default useTrajectoryPreview;