import { RasterFrameScope } from '@/modules/raster/api/entities/raster';
import { useRasterFrame } from '@/modules/raster/hooks/use-raster-frame';
import { useRasterMetadata } from '@/modules/raster/hooks/use-raster-metadata';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { isApiError } from '@/shared/errors/core';

import type { RasterAnalysisMetadata, RasterSceneFrame } from '@/modules/raster/api/entities/raster';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory/trajectory';

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
    model?: string;
    onModelChange?: (model?: string) => void;
};

interface UseRasterWorkspaceResult {
    frame: RasterSceneFrame | null;
    modelOptions: RasterModelOption[];
    selectedModel: string | null;
    displayTimestep?: number;
    sourceTitle: string;
    sourceDescription: string | null;
    isAnalysisSource: boolean;
    isLoading: boolean;
    error: Error | null;
    hasRasterData: boolean;
    isFrameMissing: boolean;
    isSelectionUnavailable: boolean;
    isModelUnavailable: boolean;
    refetchMetadata: () => Promise<unknown>;
};

const getAnalysisTitle = (analysis: RasterAnalysisMetadata, trajectory: Trajectory | null | undefined): string => {
    const matchingAnalysis = trajectory?.analysis?.find((entry) => entry._id === analysis.analysisId);
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

const getAvailableTimesteps = (source: RasterWorkspaceSource | null, metadataTrajectoryTimesteps: number[]): number[] => {
    if (!source) {
        return [];
    }

    if (source.scope === RasterFrameScope.Analysis) {
        return source.analysis?.availableTimesteps ?? [];
    }

    return metadataTrajectoryTimesteps;
};

/** Resolves the raster source for the active canvas analysis and timestep. */
export const useRasterWorkspace = ({
    trajectoryId,
    trajectory,
    analysisId,
    currentTimestep,
    model,
    onModelChange
}: UseRasterWorkspaceParams): UseRasterWorkspaceResult => {
    const metadataQuery = useRasterMetadata({ trajectoryId, enabled: Boolean(trajectoryId) });
    const [requestKey, setRequestKey] = useState(0);
    const hasResolvedMetadata = !metadataQuery.isLoading;
    const analyses = metadataQuery.metadata?.analyses ?? [];
    const hasTrajectoryRaster = Boolean(metadataQuery.metadata?.trajectory);
    const trajectoryAvailableTimesteps = metadataQuery.metadata?.trajectory?.availableTimesteps ?? [];

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

    const availableTimesteps = useMemo(() => {
        return getAvailableTimesteps(source, trajectoryAvailableTimesteps);
    }, [source, trajectoryAvailableTimesteps]);

    const isSourceUnavailable = hasResolvedMetadata && Boolean(analysisId) && !selectedAnalysis;
    const isModelUnavailable = useMemo(() => {
        if (!hasResolvedMetadata || source?.scope !== RasterFrameScope.Analysis || !model) {
            return false;
        }

        return !modelOptions.some((option) => option.value === model);
    }, [hasResolvedMetadata, model, modelOptions, source]);

    const displayTimestep = useMemo(() => {
        if (currentTimestep !== undefined && availableTimesteps.includes(currentTimestep)) {
            return currentTimestep;
        }

        return availableTimesteps[0];
    }, [availableTimesteps, currentTimestep]);

    const selectedModel = useMemo(() => {
        if (source?.scope !== RasterFrameScope.Analysis || !modelOptions.length) {
            return null;
        }

        if (isModelUnavailable) {
            return null;
        }

        if (model && modelOptions.some((option) => option.value === model)) {
            return model;
        }

        return modelOptions[0].value;
    }, [isModelUnavailable, model, modelOptions, source]);

    useEffect(() => {
        if (isSourceUnavailable || isModelUnavailable) {
            return;
        }

        if (source?.scope !== RasterFrameScope.Analysis || !selectedModel) {
            if (model) {
                onModelChange?.(undefined);
            }

            return;
        }

        if (selectedModel !== model) {
            onModelChange?.(selectedModel);
        }
    }, [isModelUnavailable, isSourceUnavailable, model, onModelChange, selectedModel, source]);

    const isFrameEnabled = Boolean(
        trajectoryId
        && source
        && displayTimestep !== undefined
        && (source.scope === RasterFrameScope.Trajectory || (source.analysis?.analysisId && selectedModel))
    );

    const frameQuery = useRasterFrame({
        trajectoryId,
        timestep: displayTimestep,
        analysisId: source?.analysis?.analysisId,
        model: selectedModel ?? undefined,
        scope: source?.scope ?? RasterFrameScope.Trajectory,
        enabled: isFrameEnabled,
        requestKey
    });

    const refetchMetadata = useCallback(async () => {
        setRequestKey((currentValue) => currentValue + 1);
        return metadataQuery.refetch();
    }, [metadataQuery]);

    const hasRasterData = hasTrajectoryRaster || analyses.length > 0;
    const isSelectionUnavailable = isSourceUnavailable;

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
        displayTimestep,
        sourceTitle: source?.title ?? 'Raster',
        sourceDescription: source?.description ?? null,
        isAnalysisSource: source?.scope === RasterFrameScope.Analysis,
        isLoading: metadataQuery.isLoading || frameQuery.isLoading,
        error,
        hasRasterData,
        isFrameMissing: frameQuery.isMissing,
        isSelectionUnavailable,
        isModelUnavailable,
        refetchMetadata
    };
};
