import { trajectoryPreviewQuery } from './queries';
import { useEffect, useRef, useState } from 'react';

interface UseTrajectoryPreviewParams {
    trajectoryId: string;
    version?: string;
    enabled?: boolean;
};

interface UseTrajectoryPreviewResult {
    previewBlobUrl: string | null;
    isLoading: boolean;
    error: boolean;
    retry: () => void;
};

export default function useTrajectoryPreview(params: UseTrajectoryPreviewParams): UseTrajectoryPreviewResult {
    const { trajectoryId, version, enabled = true } = params;
    const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
    const previewBlobUrlRef = useRef<string | null>(null);

    const {
        data,
        isLoading,
        isError,
        refetch
    } = trajectoryPreviewQuery(
        {
            trajectoryId,
            version
        },
        {
            enabled: enabled && Boolean(trajectoryId)
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

    return {
        previewBlobUrl,
        isLoading,
        error: isError,
        retry: refetch
    };
}
