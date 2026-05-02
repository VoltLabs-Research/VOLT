import { trajectoryPreviewQuery } from './queries';
import { isApiError } from '@/shared/errors/core';
import { useEffect, useRef, useState } from 'react';

interface UseTrajectoryPreviewParams {
    trajectoryId: string;
    enabled?: boolean;
    isRasterReady?: boolean;
    allowPersistedPreviewFallback?: boolean;
}

interface UseTrajectoryPreviewResult {
    previewBlobUrl: string | null;
    isLoading: boolean;
    error: boolean;
    retry: () => void;
}

export default function useTrajectoryPreview(params: UseTrajectoryPreviewParams): UseTrajectoryPreviewResult {
    const {
        trajectoryId,
        enabled = true,
        isRasterReady = false,
        allowPersistedPreviewFallback = false
    } = params;
    const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
    const previewBlobUrlRef = useRef<string | null>(null);
    const hasPreviewReadinessSignal = isRasterReady || allowPersistedPreviewFallback;
    const isPreviewQueryEnabled = enabled && hasPreviewReadinessSignal && Boolean(trajectoryId);

    const {
        data,
        error,
        isLoading,
        isError,
        refetch
    } = trajectoryPreviewQuery(
        { trajectoryId },
        {
            enabled: isPreviewQueryEnabled
        }
    );

    useEffect(() => {
        if (!data?.blob) {
            if (previewBlobUrlRef.current) {
                URL.revokeObjectURL(previewBlobUrlRef.current);
                previewBlobUrlRef.current = null;
            }

            setPreviewBlobUrl(null);
            return;
        }

        const objectUrl = URL.createObjectURL(data.blob);
        const previousUrl = previewBlobUrlRef.current;

        previewBlobUrlRef.current = objectUrl;
        setPreviewBlobUrl(objectUrl);

        if (previousUrl) {
            URL.revokeObjectURL(previousUrl);
        }
    }, [data?.blob]);

    useEffect(() => {
        return () => {
            if (previewBlobUrlRef.current) {
                URL.revokeObjectURL(previewBlobUrlRef.current);
                previewBlobUrlRef.current = null;
            }
        };
    }, []);

    const hasNoPreviewYet = isApiError(error) && error.status === 404;

    return {
        previewBlobUrl,
        isLoading,
        error: isError && !hasNoPreviewYet,
        retry: refetch
    };
}
