import { useState, useEffect, useCallback } from 'react';
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

    const cleanup = useCallback(() => {
        if(previewBlobUrl){
            console.log('Cleaning up preview blob URL:', previewBlobUrl);
            URL.revokeObjectURL(previewBlobUrl);
            setPreviewBlobUrl(null);
        }

        setLastPreviewId(null);
    }, [previewBlobUrl]);

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

        try{
            setIsLoading(true);
            setError(false);
            
            console.log('Loading preview for trajectory:', trajectoryId, 'previewId:', previewId);

            // Cleanup previous blob URL
            if(previewBlobUrl){
                URL.revokeObjectURL(previewBlobUrl);
                setPreviewBlobUrl(null);
            }

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

            if(!response.data || response.data.size === 0){
                throw new Error('Empty or invalid image response');
            }

            const blobUrl = URL.createObjectURL(response.data);
            setPreviewBlobUrl(blobUrl);
            setLastPreviewId(previewId);

            console.log('Preview loaded successfully:', blobUrl);
        }catch(err){
            console.error('Error loading preview:', error);
            setError(true);
            setPreviewBlobUrl(null);
            setLastPreviewId(null);
        }finally{
            setIsLoading(false);
        }
    }, [enabled, previewId, trajectoryId, updatedAt, lastPreviewId, previewBlobUrl]);

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
        return cleanup;
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