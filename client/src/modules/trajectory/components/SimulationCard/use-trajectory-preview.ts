import { publicTrajectoryPreviewQuery, trajectoryPreviewQuery } from '../../hooks/trajectory/queries';
import { isApiError } from '@/shared/errors/core/report-error';
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

    const rbacPreviewQuery = trajectoryPreviewQuery(
        { trajectoryId },
        {
            enabled: isPreviewQueryEnabled && accessMode === 'rbac'
        }
    );
    const publicPreviewQuery = publicTrajectoryPreviewQuery(
        { trajectoryId },
        {
            enabled: isPreviewQueryEnabled && accessMode === 'public'
        }
    );
    const activeQuery = accessMode === 'public' ? publicPreviewQuery : rbacPreviewQuery;

    useEffect(() => {
        if (!activeQuery.data?.blob) {
            if (previewBlobUrlRef.current) {
                URL.revokeObjectURL(previewBlobUrlRef.current);
                previewBlobUrlRef.current = null;
            }

            setPreviewBlobUrl(null);
            return;
        }

        const objectUrl = URL.createObjectURL(activeQuery.data.blob);
        const previousUrl = previewBlobUrlRef.current;

        previewBlobUrlRef.current = objectUrl;
        setPreviewBlobUrl(objectUrl);

        if (previousUrl) {
            URL.revokeObjectURL(previousUrl);
        }
    }, [activeQuery.data?.blob]);

    useEffect(() => {
        return () => {
            if (previewBlobUrlRef.current) {
                URL.revokeObjectURL(previewBlobUrlRef.current);
                previewBlobUrlRef.current = null;
            }
        };
    }, []);

    const hasNoPreviewYet = isApiError(activeQuery.error) && activeQuery.error.status === 404;

    return {
        previewBlobUrl,
        isLoading: activeQuery.isLoading,
        error: activeQuery.isError && !hasNoPreviewYet,
        retry: activeQuery.refetch
    };
}
