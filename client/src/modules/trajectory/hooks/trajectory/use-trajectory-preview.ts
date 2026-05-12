import { publicTrajectoryPreviewQuery, trajectoryPreviewQuery } from './queries';
import { isApiError } from '@/shared/errors/core';
import { useEffect, useRef, useState } from 'react';

interface UseTrajectoryPreviewParams {
    trajectoryId: string;
    enabled?: boolean;
    isRasterReady?: boolean;
    allowPersistedPreviewFallback?: boolean;
    accessMode?: 'rbac' | 'public';
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
        allowPersistedPreviewFallback = false,
        accessMode = 'rbac'
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
            enabled: isPreviewQueryEnabled && accessMode === 'rbac'
        }
    );
    const {
        data: publicData,
        error: publicError,
        isLoading: isPublicLoading,
        isError: isPublicError,
        refetch: refetchPublic
    } = publicTrajectoryPreviewQuery(
        { trajectoryId },
        {
            enabled: isPreviewQueryEnabled && accessMode === 'public'
        }
    );
    const activeData = accessMode === 'public' ? publicData : data;
    const activeError = accessMode === 'public' ? publicError : error;
    const activeIsLoading = accessMode === 'public' ? isPublicLoading : isLoading;
    const activeIsError = accessMode === 'public' ? isPublicError : isError;
    const activeRefetch = accessMode === 'public' ? refetchPublic : refetch;

    useEffect(() => {
        if (!activeData?.blob) {
            if (previewBlobUrlRef.current) {
                URL.revokeObjectURL(previewBlobUrlRef.current);
                previewBlobUrlRef.current = null;
            }

            setPreviewBlobUrl(null);
            return;
        }

        const objectUrl = URL.createObjectURL(activeData.blob);
        const previousUrl = previewBlobUrlRef.current;

        previewBlobUrlRef.current = objectUrl;
        setPreviewBlobUrl(objectUrl);

        if (previousUrl) {
            URL.revokeObjectURL(previousUrl);
        }
    }, [activeData?.blob]);

    useEffect(() => {
        return () => {
            if (previewBlobUrlRef.current) {
                URL.revokeObjectURL(previewBlobUrlRef.current);
                previewBlobUrlRef.current = null;
            }
        };
    }, []);

    const hasNoPreviewYet = isApiError(activeError) && activeError.status === 404;

    return {
        previewBlobUrl,
        isLoading: activeIsLoading,
        error: activeIsError && !hasNoPreviewYet,
        retry: activeRefetch
    };
}
