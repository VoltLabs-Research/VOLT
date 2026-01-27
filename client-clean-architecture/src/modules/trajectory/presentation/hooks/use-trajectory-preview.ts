import { useState, useEffect, useCallback, useRef } from 'react';
import useLogger from '@/shared/presentation/hooks/core/use-logger';
import { getTrajectoryUseCases } from '../../application/registry';
import type { TrajectoryUseCases } from '../../application/registry';
import {
    buildTrajectoryPreviewCacheKey,
    clearTrajectoryPreviewCache,
    getTrajectoryPreviewBlobUrl
} from '../../application/selectors';

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

const resolveUseCases = (): TrajectoryUseCases => getTrajectoryUseCases();

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

    const getPreviewFromCacheOrServer = useCallback(async (
        trajId: string,
        updated: string
    ): Promise<string | null> => {
        const { getTrajectoryPreviewUseCase } = resolveUseCases();
        try {
            return await getTrajectoryPreviewBlobUrl({
                trajectoryId: trajId,
                updatedAt: updated,
                loadPreviewBase64: (id) => getTrajectoryPreviewUseCase.execute(id)
            });
        } catch (err: any) {
            logger.error('API Error loading preview', err);
            throw err;
        }
    }, [logger]);

    const cleanup = useCallback(() => {
        if (currentRequestRef.current) {
            currentRequestRef.current.abort();
            currentRequestRef.current = null;
        }
        setPreviewBlobUrl(null);
        setLastLoadedKey(null);
    }, []);

    const loadPreview = useCallback(async () => {
        if (!enabled) {
            setPreviewBlobUrl(null);
            setLastLoadedKey(null);
            setIsLoading(false);
            return;
        }

        const currentKey = buildTrajectoryPreviewCacheKey(trajectoryId, updatedAt);

        if (currentKey === lastLoadedKey && previewBlobUrl) {
            setIsLoading(false);
            return;
        }

        if (currentRequestRef.current) {
            currentRequestRef.current.abort();
        }

        const abortController = new AbortController();
        currentRequestRef.current = abortController;

        try {
            setIsLoading(true);
            setError(false);

            const blobUrl = await getPreviewFromCacheOrServer(trajectoryId, updatedAt);

            if (!mountedRef.current || abortController.signal.aborted) {
                return;
            }

            if (!blobUrl) {
                throw new Error('No preview URL returned');
            }

            setPreviewBlobUrl(blobUrl);
            setLastLoadedKey(currentKey);
        } catch (err: any) {
            if (err.name === 'CanceledError' || err.name === 'AbortError') {
                return;
            }

            setError(true);
            setPreviewBlobUrl(null);
            setLastLoadedKey(null);
        } finally {
            if (mountedRef.current) {
                setIsLoading(false);
            }
            if (currentRequestRef.current === abortController) {
                currentRequestRef.current = null;
            }
        }
    }, [enabled, trajectoryId, updatedAt, getPreviewFromCacheOrServer, previewBlobUrl, lastLoadedKey]);

    const loadPreviewRef = useRef(loadPreview);
    useEffect(() => {
        loadPreviewRef.current = loadPreview;
    }, [loadPreview]);

    const retry = useCallback(() => {
        setError(false);
        clearTrajectoryPreviewCache(trajectoryId);
        setLastLoadedKey(null);
        loadPreviewRef.current();
    }, [trajectoryId]);

    useEffect(() => {
        if (enabled && trajectoryId) {
            loadPreviewRef.current();
        }
    }, [updatedAt, enabled, trajectoryId]);

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
