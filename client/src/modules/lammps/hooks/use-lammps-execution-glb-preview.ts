import { http } from '@/app/core/http/utilities/create-client';
import { isApiError } from '@/shared/errors/core';
import { useEffect, useRef, useState } from 'react';
import type { HttpRequest } from '@voltstack/voltclient';

interface UseLammpsExecutionGlbPreviewInput {
    teamId?: string;
    executionId?: string | null;
    timestep?: number | null;
    enabled?: boolean;
}

interface UseLammpsExecutionGlbPreviewResult {
    previewGlbUrl: string | null;
    isLoading: boolean;
    errorMessage: string | null;
    retry: () => void;
}

type GlbPreviewRequest = HttpRequest & {
    timeoutMs: number;
};

const isAbortLike = (error: unknown): boolean => {
    if (error instanceof DOMException && error.name === 'AbortError') {
        return true;
    }

    if (!(error instanceof Error)) {
        return false;
    }

    const maybeAbortError = error as Error & {
        code?: string;
        __CANCEL__?: boolean;
    };

    return error.name === 'AbortError'
        || error.name === 'CanceledError'
        || maybeAbortError.code === 'ERR_CANCELED'
        || maybeAbortError.__CANCEL__ === true;
};

const useLammpsExecutionGlbPreview = ({
    teamId,
    executionId,
    timestep,
    enabled = true
}: UseLammpsExecutionGlbPreviewInput): UseLammpsExecutionGlbPreviewResult => {
    const [previewGlbUrl, setPreviewGlbUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [retryNonce, setRetryNonce] = useState(0);
    const previewGlbUrlRef = useRef<string | null>(null);
    const requestVersionRef = useRef(0);
    const canFetch = enabled
        && Boolean(teamId)
        && Boolean(executionId)
        && typeof timestep === 'number'
        && Number.isFinite(timestep);

    useEffect(() => {
        if (canFetch) {
            return;
        }

        requestVersionRef.current += 1;

        if (previewGlbUrlRef.current) {
            URL.revokeObjectURL(previewGlbUrlRef.current);
            previewGlbUrlRef.current = null;
        }

        setPreviewGlbUrl(null);
        setIsLoading(false);
        setErrorMessage(null);
    }, [canFetch]);

    useEffect(() => {
        if (!canFetch || !teamId || !executionId || typeof timestep !== 'number') {
            return;
        }

        const abortController = new AbortController();
        const requestVersion = requestVersionRef.current + 1;
        requestVersionRef.current = requestVersion;

        setIsLoading(true);
        setErrorMessage(null);

        void (async () => {
            try {
                const blob = await http.request<Blob>({
                    method: 'GET',
                    url: `/lammps/${teamId}/executions/${executionId}/dumps/${timestep}/glb`,
                    responseType: 'blob',
                    signal: abortController.signal,
                    timeoutMs: 0
                } as GlbPreviewRequest);

                if (abortController.signal.aborted || requestVersionRef.current !== requestVersion) {
                    return;
                }

                const nextUrl = URL.createObjectURL(blob);
                const previousUrl = previewGlbUrlRef.current;

                previewGlbUrlRef.current = nextUrl;
                setPreviewGlbUrl(nextUrl);
                setIsLoading(false);
                setErrorMessage(null);

                if (previousUrl && previousUrl !== nextUrl) {
                    URL.revokeObjectURL(previousUrl);
                }
            } catch (error: unknown) {
                if (isAbortLike(error) || requestVersionRef.current !== requestVersion) {
                    return;
                }

                if (previewGlbUrlRef.current) {
                    URL.revokeObjectURL(previewGlbUrlRef.current);
                    previewGlbUrlRef.current = null;
                }

                setPreviewGlbUrl(null);
                setIsLoading(false);

                const hasNoPreviewYet = isApiError(error) && error.status === 404;
                setErrorMessage(hasNoPreviewYet
                    ? null
                    : error instanceof Error
                        ? error.message
                        : 'Failed to load the selected dump preview.');
            }
        })();

        return () => {
            abortController.abort();
        };
    }, [canFetch, executionId, retryNonce, teamId, timestep]);

    useEffect(() => {
        return () => {
            if (previewGlbUrlRef.current) {
                URL.revokeObjectURL(previewGlbUrlRef.current);
                previewGlbUrlRef.current = null;
            }
        };
    }, []);

    return {
        previewGlbUrl,
        isLoading,
        errorMessage,
        retry: () => {
            setRetryNonce((current) => current + 1);
        }
    };
};

export default useLammpsExecutionGlbPreview;
