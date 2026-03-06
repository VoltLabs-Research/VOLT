import { useState, useEffect, useCallback, useRef } from 'react';
import useTrajectoryUseCases from './use-trajectory-services';

interface UseTrajectoryPreviewParams{
    trajectoryId: string;
    version?: string;
    enabled?: boolean;
};

interface UseTrajectoryPreviewResult{
    previewBlobUrl: string | null;
    isLoading: boolean;
    error: boolean;
    retry: () => void;
};

const useTrajectoryPreview = (params: UseTrajectoryPreviewParams): UseTrajectoryPreviewResult => {
    const { trajectoryId, version, enabled = true } = params;
    const { trajectoryRepository } = useTrajectoryUseCases();
    const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(false);
    const activeRequestIdRef = useRef(0);

    const fetchPreview = useCallback(async () => {
        if(!trajectoryId || !enabled) return;

        const requestId = activeRequestIdRef.current + 1;
        activeRequestIdRef.current = requestId;

        setPreviewBlobUrl(null);
        setIsLoading(true);
        setError(false);

        try{
            const result = await trajectoryRepository.getPreview({ trajectoryId, version });

            if(requestId !== activeRequestIdRef.current){
                trajectoryRepository.invalidatePreviewCache(trajectoryId);
                return;
            }

            setPreviewBlobUrl(result.blobUrl);
        }catch{
            if(requestId !== activeRequestIdRef.current){
                return;
            }

            setPreviewBlobUrl(null);
            setError(true);
        }finally{
            if(requestId !== activeRequestIdRef.current){
                return;
            }

            setIsLoading(false);
        }
    }, [trajectoryId, version, enabled, trajectoryRepository]);

    useEffect(() => {
        if(!enabled || !trajectoryId){
            activeRequestIdRef.current += 1;
            setPreviewBlobUrl(null);
            setIsLoading(false);
            setError(false);
            return;
        }

        void fetchPreview();

        return () => {
            activeRequestIdRef.current += 1;
            trajectoryRepository.invalidatePreviewCache(trajectoryId);
        };
    }, [trajectoryId, enabled, fetchPreview, trajectoryRepository]);

    return { previewBlobUrl, isLoading, error, retry: fetchPreview };
};

export default useTrajectoryPreview;
