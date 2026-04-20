import canvasService from '@/modules/canvas/api/services/canvas';
import { RasterFrameScope } from '@/modules/raster/api/entities/raster';
import { isApiError } from '@/shared/errors/core';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { ApiError } from '@voltstack/voltclient';
import type { RasterSceneFrame } from '@/modules/raster/api/entities/raster';

interface UseRasterFrameParams {
    trajectoryId?: string;
    timestep?: number;
    analysisId?: string;
    model?: string;
    scope: RasterFrameScope;
    enabled?: boolean;
    requestKey?: number;
};

interface UseRasterFrameResult {
    frame: RasterSceneFrame | null;
    isLoading: boolean;
    error: ApiError | Error | null;
    isMissing: boolean;
};

type RasterFrameQueryKey = readonly [
    'raster',
    'frame',
    RasterFrameScope,
    string | undefined,
    number | undefined,
    string | undefined,
    string | undefined,
    number | undefined
];

const buildRasterFrameQueryKey = (
    params: Pick<UseRasterFrameParams, 'scope' | 'trajectoryId' | 'timestep' | 'analysisId' | 'model' | 'requestKey'>
): RasterFrameQueryKey => [
    'raster',
    'frame',
    params.scope,
    params.trajectoryId,
    params.timestep,
    params.analysisId,
    params.model,
    params.requestKey
];

const resolveRasterFrameError = (error: unknown): ApiError | Error => {
    if (error instanceof Error || isApiError(error)) {
        return error;
    }

    return new Error('Failed to load raster frame');
};

const isAbortError = (error: unknown): error is DOMException => {
    return error instanceof DOMException && error.name === 'AbortError';
};

export const useRasterFrame = ({
    trajectoryId,
    timestep,
    analysisId,
    model,
    scope,
    enabled = true,
    requestKey
}: UseRasterFrameParams): UseRasterFrameResult => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const requiresAnalysisFrame = scope === RasterFrameScope.Analysis;
    const canFetchFrame = enabled
        && Boolean(trajectoryId)
        && timestep !== undefined
        && (!requiresAnalysisFrame || Boolean(analysisId && model));

    const frameQuery = useQuery<Blob, ApiError | Error>({
        queryKey: buildRasterFrameQueryKey({ scope, trajectoryId, timestep, analysisId, model, requestKey }),
        enabled: canFetchFrame,
        retry: false,
        queryFn: async ({ signal }) => {
            const blob = requiresAnalysisFrame
                ? await canvasService.getAnalysisRasterFrame({
                    trajectoryId: trajectoryId!,
                    timestep: timestep!,
                    analysisId: analysisId!,
                    model: model!
                })
                : await canvasService.getRasterFrame({
                    trajectoryId: trajectoryId!,
                    timestep: timestep!
                });

            if (signal.aborted) {
                throw new DOMException('The raster frame request was aborted', 'AbortError');
            }

            return blob;
        },
        throwOnError: false,
        meta: {
            requestKey
        }
    });

    useEffect(() => {
        if (!frameQuery.data) {
            setImageUrl(null);
            return undefined;
        }

        const nextImageUrl = URL.createObjectURL(frameQuery.data);
        setImageUrl(nextImageUrl);

        return () => {
            URL.revokeObjectURL(nextImageUrl);
        };
    }, [frameQuery.data]);

    const error = canFetchFrame && frameQuery.error && !isAbortError(frameQuery.error)
        ? resolveRasterFrameError(frameQuery.error)
        : null;
    const isMissing = Boolean(error && isApiError(error) && error.status === 404);

    const frame = useMemo<RasterSceneFrame | null>(() => {
        if (!canFetchFrame) {
            return null;
        }

        if (!frameQuery.data && !error) {
            return null;
        }

        return {
            frame: timestep!,
            model: model ?? null,
            analysisId: analysisId ?? null,
            scope,
            imageUrl,
            isUnavailable: Boolean(error)
        };
    }, [analysisId, canFetchFrame, error, frameQuery.data, imageUrl, model, scope, timestep]);

    return {
        frame,
        isLoading: frameQuery.isLoading || frameQuery.isFetching,
        error,
        isMissing
    };
};
