import canvasService from '@/modules/canvas/api/services/canvas-service';
import { RasterFrameScope } from '@volt/contracts/modules/raster/domain';
import { isAbortError, isApiError } from '@/shared/errors/core/report-error';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { ApiError } from '@voltstack/voltclient';

interface UseRasterFrameParams {
    trajectoryId?: string;
    timestep?: number;
    analysisId?: string;
    model?: string;
    scope: RasterFrameScope;
    requestKey?: number;
};

interface UseRasterFrameResult {
    imageUrl: string | null;
    isLoading: boolean;
    error: ApiError | Error | null;
    isMissing: boolean;
};

export const useRasterFrame = ({
    trajectoryId,
    timestep,
    analysisId,
    model,
    scope,
    requestKey
}: UseRasterFrameParams): UseRasterFrameResult => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const requiresAnalysisFrame = scope === RasterFrameScope.Analysis;
    const canFetchFrame = Boolean(trajectoryId)
        && timestep !== undefined
        && (!requiresAnalysisFrame || Boolean(analysisId && model));

    const frameQuery = useQuery<Blob, ApiError | Error>({
        queryKey: ['raster', 'frame', scope, trajectoryId, timestep, analysisId, model, requestKey],
        enabled: canFetchFrame,
        retry: false,
        throwOnError: false,
        queryFn: () => canvasService.getRasterFrame({
            trajectoryId: trajectoryId!,
            timestep: timestep!,
            analysisId: requiresAnalysisFrame ? analysisId : undefined,
            model: requiresAnalysisFrame ? model : undefined
        })
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
        ? frameQuery.error
        : null;

    return {
        imageUrl: canFetchFrame ? imageUrl : null,
        isLoading: frameQuery.isLoading || frameQuery.isFetching,
        error,
        isMissing: Boolean(error && isApiError(error) && error.status === 404)
    };
};
