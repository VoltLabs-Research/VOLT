import { useState, useEffect, useCallback } from 'react';
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

    const fetchPreview = useCallback(async () => {
        if(!trajectoryId || !enabled) return;

        setIsLoading(true);
        setError(false);

        try{
            const result = await trajectoryRepository.getPreview({ trajectoryId, version });
            setPreviewBlobUrl(result.blobUrl);
        }catch{
            setError(true);
        }finally{
            setIsLoading(false);
        }
    }, [trajectoryId, version, enabled, trajectoryRepository]);

    useEffect(() => {
        fetchPreview();
    }, [fetchPreview]);

    return { previewBlobUrl, isLoading, error, retry: fetchPreview };
};

export default useTrajectoryPreview;
