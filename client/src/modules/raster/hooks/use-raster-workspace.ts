import useCanvasUrlState from '@/modules/canvas/hooks/use-canvas-url-state';
import { RasterFrameScope } from '@/modules/raster/api/entities/raster';
import { useRasterFrame } from '@/modules/raster/hooks/use-raster-frame';
import { useRasterMetadata } from '@/modules/raster/hooks/use-raster-metadata';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { isApiError } from '@/shared/errors/core';

import type { RasterAnalysisMetadata, RasterSceneFrame } from '@/modules/raster/api/entities/raster';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';

interface RasterModelOption {
    value: string;
    title: string;
};

interface RasterWorkspaceSource {
    scope: RasterFrameScope;
    analysis: RasterAnalysisMetadata | null;
    title: string;
    description: string | null;
};

interface UseRasterWorkspaceParams {
    trajectoryId?: string;
    trajectory: Trajectory | null | undefined;
    analysisId?: string;
    currentTimestep?: number;
};

interface UseRasterWorkspaceResult {
    frame: RasterSceneFrame | null;
    modelOptions: RasterModelOption[];
    selectedModel: string | null;
    selectedModelTitle: string | null;
    sourceTitle: string;
    sourceDescription: string | null;
    isAnalysisSource: boolean;
    isLoading: boolean;
    error: Error | null;
    hasRasterData: boolean;
    isFrameMissing: boolean;
    isSelectionUnavailable: boolean;
    setSelectedModel: (model: string) => void;
    refetchMetadata: () => Promise<unknown>;
};

const getAnalysisTitle = (analysis: RasterAnalysisMetadata, trajectory: Trajectory | null | undefined): string => {
    const matchingAnalysis = trajectory?.analysis.find((entry) => entry._id === analysis.analysisId);
    if (matchingAnalysis?.plugin) {
        return matchingAnalysis.plugin;
    }

    return analysis.analysisId;
};

const getModelTitle = (model: string): string => {
    return model
        .split('_')
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
};

const getModelOptions = (analysis: RasterAnalysisMetadata | null): RasterModelOption[] => {
    if (!analysis) {
        return [];
    }

    const models = new Set<string>();
    analysis.frames.forEach((frame) => {
        frame.availableModels.forEach((model) => {
            models.add(model);
        });
    });

    return Array.from(models)
        .sort((leftModel, rightModel) => leftModel.localeCompare(rightModel))
        .map((model) => ({
            value: model,
            title: getModelTitle(model)
        }));
};

/** Resolves the raster source for the active canvas analysis and timestep. */
export const useRasterWorkspace = ({
    trajectoryId,
    trajectory,
    analysisId,
    currentTimestep
}: UseRasterWorkspaceParams): UseRasterWorkspaceResult => {
    const { rasterModel, setRasterModel } = useCanvasUrlState();
    const metadataQuery = useRasterMetadata({ trajectoryId, enabled: Boolean(trajectoryId) });
    const [requestKey, setRequestKey] = useState(0);
    const analyses = metadataQuery.metadata?.analyses ?? [];
    const hasTrajectoryRaster = Boolean(metadataQuery.metadata?.trajectory);

    const selectedAnalysis = useMemo(() => {
        if (!analysisId) {
            return null;
        }

        return analyses.find((entry) => entry.analysisId === analysisId) ?? null;
    }, [analyses, analysisId]);

    const source = useMemo<RasterWorkspaceSource | null>(() => {
        if (selectedAnalysis) {
            return {
                scope: RasterFrameScope.Analysis,
                analysis: selectedAnalysis,
                title: getAnalysisTitle(selectedAnalysis, trajectory),
                description: null
            };
        }

        if (hasTrajectoryRaster) {
            return {
                scope: RasterFrameScope.Trajectory,
                analysis: null,
                title: 'Trajectory raster',
                description: analysisId
                    ? 'Showing trajectory raster because the selected analysis does not have raster output yet.'
                    : null
            };
        }

        return null;
    }, [analysisId, hasTrajectoryRaster, selectedAnalysis, trajectory]);

    const modelOptions = useMemo(() => {
        return getModelOptions(source?.analysis ?? null);
    }, [source]);

    const selectedModel = useMemo(() => {
        if (source?.scope !== RasterFrameScope.Analysis || !modelOptions.length) {
            return null;
        }

        if (rasterModel && modelOptions.some((option) => option.value === rasterModel)) {
            return rasterModel;
        }

        return modelOptions[0].value;
    }, [modelOptions, rasterModel, source]);

    useEffect(() => {
        if (source?.scope !== RasterFrameScope.Analysis || !selectedModel) {
            if (rasterModel) {
                setRasterModel(undefined, { replace: true });
            }

            return;
        }

        if (selectedModel !== rasterModel) {
            setRasterModel(selectedModel, { replace: true });
        }
    }, [rasterModel, selectedModel, setRasterModel, source]);

    const isFrameEnabled = Boolean(
        trajectoryId
        && source
        && currentTimestep !== undefined
        && (source.scope === RasterFrameScope.Trajectory || (source.analysis?.analysisId && selectedModel))
    );

    const frameQuery = useRasterFrame({
        trajectoryId,
        timestep: currentTimestep,
        analysisId: source?.analysis?.analysisId,
        model: selectedModel ?? undefined,
        scope: source?.scope ?? RasterFrameScope.Trajectory,
        enabled: isFrameEnabled,
        requestKey
    });

    const selectedModelTitle = useMemo(() => {
        if (!selectedModel) {
            return null;
        }

        return modelOptions.find((option) => option.value === selectedModel)?.title ?? null;
    }, [modelOptions, selectedModel]);

    const setSelectedModel = useCallback((model: string) => {
        setRasterModel(model, { replace: true });
    }, [setRasterModel]);

    const refetchMetadata = useCallback(async () => {
        setRequestKey((currentValue) => currentValue + 1);
        return metadataQuery.refetch();
    }, [metadataQuery]);

    const hasRasterData = hasTrajectoryRaster || analyses.length > 0;
    const isSelectionUnavailable = !source && hasRasterData && Boolean(analysisId);

    let error: Error | null = null;
    if (metadataQuery.error instanceof Error) {
        error = metadataQuery.error;
    } else if (!frameQuery.isMissing && frameQuery.error instanceof Error) {
        error = frameQuery.error;
    } else if (isApiError(metadataQuery.error)) {
        error = metadataQuery.error;
    } else if (!frameQuery.isMissing && isApiError(frameQuery.error)) {
        error = frameQuery.error;
    }

    return {
        frame: frameQuery.frame,
        modelOptions,
        selectedModel,
        selectedModelTitle,
        sourceTitle: source?.title ?? 'Raster',
        sourceDescription: source?.description ?? null,
        isAnalysisSource: source?.scope === RasterFrameScope.Analysis,
        isLoading: metadataQuery.isLoading || frameQuery.isLoading,
        error,
        hasRasterData,
        isFrameMissing: frameQuery.isMissing,
        isSelectionUnavailable,
        setSelectedModel,
        refetchMetadata
    };
};
