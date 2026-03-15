import rasterService from '@/modules/raster/api/service';
import { RasterFrameScope } from '@/modules/raster/api/entities/raster';
import { isApiError } from '@/shared/errors/core';
import { useEffect, useState } from 'react';
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

export const useRasterFrame = ({
    trajectoryId,
    timestep,
    analysisId,
    model,
    scope,
    enabled = true,
    requestKey
}: UseRasterFrameParams): UseRasterFrameResult => {
    const [frame, setFrame] = useState<RasterSceneFrame | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<ApiError | Error | null>(null);
    const [isMissing, setIsMissing] = useState(false);

    useEffect(() => {
        let cancelled = false;
        let objectUrl: string | null = null;
        const requiresAnalysisFrame = scope === RasterFrameScope.Analysis;

        if (!enabled || !trajectoryId || timestep === undefined || (requiresAnalysisFrame && (!analysisId || !model))) {
            setFrame(null);
            setIsLoading(false);
            setError(null);
            setIsMissing(false);
            return undefined;
        }

        const loadFrame = async () => {
            setIsLoading(true);
            setError(null);
            setIsMissing(false);

            try {
                const blob = requiresAnalysisFrame
                    ? await rasterService.getFrame({
                        trajectoryId,
                        timestep,
                        analysisId,
                        model
                    })
                    : await rasterService.getTrajectoryFrame({
                        trajectoryId,
                        timestep
                    });

                if (cancelled) {
                    return;
                }

                objectUrl = URL.createObjectURL(blob);
                setFrame({
                    frame: timestep,
                    model: model ?? null,
                    analysisId: analysisId ?? null,
                    scope,
                    imageUrl: objectUrl,
                    isUnavailable: false
                });
            } catch (requestError) {
                if (cancelled) {
                    return;
                }

                let resolvedError: ApiError | Error;
                if (requestError instanceof Error || isApiError(requestError)) {
                    resolvedError = requestError;
                } else {
                    resolvedError = new Error('Failed to load raster frame');
                }

                const nextIsMissing = isApiError(resolvedError) && resolvedError.status === 404;
                setError(resolvedError);
                setIsMissing(nextIsMissing);
                setFrame({
                    frame: timestep,
                    model: model ?? null,
                    analysisId: analysisId ?? null,
                    scope,
                    imageUrl: null,
                    isUnavailable: true
                });
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        loadFrame();

        return () => {
            cancelled = true;
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [analysisId, enabled, model, requestKey, scope, timestep, trajectoryId]);

    return {
        frame,
        isLoading,
        error,
        isMissing
    };
};
