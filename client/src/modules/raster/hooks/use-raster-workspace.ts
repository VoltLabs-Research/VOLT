import { RasterFrameScope } from '@volt/contracts/modules/raster/domain';
import { useRasterFrame } from '@/modules/raster/hooks/use-raster-frame';
import { rasterMetadataQuery } from '@/modules/raster/hooks/queries';
import { useEffect, useMemo, useState } from 'react';

import type { RasterAnalysisMetadata } from '@volt/contracts/modules/raster/domain';

interface RasterWorkspaceSource {
    scope: RasterFrameScope;
    analysis: RasterAnalysisMetadata | null;
    description: string | null;
};

interface UseRasterWorkspaceParams {
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
    model?: string;
    onModelChange?: (model?: string) => void;
};

interface UseRasterWorkspaceResult {
    imageUrl: string | null;
    displayTimestep?: number;
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

const getAvailableModels = (analysis: RasterAnalysisMetadata | null): string[] => {
    if (!analysis) {
        return [];
    }

    const models = new Set<string>();
    analysis.frames.forEach((frame) => {
        frame.availableModels.forEach((model) => {
            models.add(model);
        });
    });

    return Array.from(models).sort((leftModel, rightModel) => leftModel.localeCompare(rightModel));
};

export const useRasterWorkspace = ({
    trajectoryId,
    analysisId,
    currentTimestep,
    model,
    onModelChange
}: UseRasterWorkspaceParams): UseRasterWorkspaceResult => {
    const metadataQuery = rasterMetadataQuery(
        { trajectoryId: trajectoryId || '' },
        { enabled: Boolean(trajectoryId) }
    );
    const [requestKey, setRequestKey] = useState(0);
    const hasResolvedMetadata = !metadataQuery.isLoading;
    const analyses = metadataQuery.data?.metadata?.analyses ?? [];
    const hasTrajectoryRaster = Boolean(metadataQuery.data?.metadata?.trajectory);
    const trajectoryAvailableTimesteps = metadataQuery.data?.metadata?.trajectory?.availableTimesteps ?? [];
    const selectedAnalysis = analysisId
        ? analyses.find((entry) => entry.analysisId === analysisId) ?? null
        : null;

    const source = useMemo<RasterWorkspaceSource | null>(() => {
        if (selectedAnalysis) {
            return {
                scope: RasterFrameScope.Analysis,
                analysis: selectedAnalysis,
                description: null
            };
        }

        if (hasTrajectoryRaster) {
            return {
                scope: RasterFrameScope.Trajectory,
                analysis: null,
                description: analysisId
                    ? 'Showing trajectory raster because the selected analysis does not have raster output yet.'
                    : null
            };
        }

        return null;
    }, [analysisId, hasTrajectoryRaster, selectedAnalysis]);

    const isAnalysisSource = source?.scope === RasterFrameScope.Analysis;
    const availableModels = useMemo(() => getAvailableModels(source?.analysis ?? null), [source]);
    const availableTimesteps = (isAnalysisSource ? source?.analysis?.availableTimesteps : trajectoryAvailableTimesteps) ?? [];
    const displayTimestep = currentTimestep !== undefined && availableTimesteps.includes(currentTimestep)
        ? currentTimestep
        : availableTimesteps[0];

    const isSourceUnavailable = hasResolvedMetadata && Boolean(analysisId) && !selectedAnalysis;
    const isModelUnavailable = hasResolvedMetadata && isAnalysisSource && !!model && !availableModels.includes(model);
    const selectedModel = !isAnalysisSource || isModelUnavailable || !availableModels.length
        ? null
        : model && availableModels.includes(model) ? model : availableModels[0];

    useEffect(() => {
        if (isSourceUnavailable || isModelUnavailable) {
            return;
        }

        if (!isAnalysisSource || !selectedModel) {
            if (model) {
                onModelChange?.(undefined);
            }

            return;
        }

        if (selectedModel !== model) {
            onModelChange?.(selectedModel);
        }
    }, [isAnalysisSource, isModelUnavailable, isSourceUnavailable, model, onModelChange, selectedModel]);

    const frameQuery = useRasterFrame({
        trajectoryId,
        timestep: displayTimestep,
        analysisId: source?.analysis?.analysisId,
        model: selectedModel ?? undefined,
        scope: source?.scope ?? RasterFrameScope.Trajectory,
        requestKey
    });

    return {
        imageUrl: frameQuery.imageUrl,
        displayTimestep,
        sourceDescription: source?.description ?? null,
        isAnalysisSource,
        isLoading: metadataQuery.isLoading || frameQuery.isLoading,
        error: metadataQuery.error ?? (frameQuery.isMissing ? null : frameQuery.error),
        hasRasterData: hasTrajectoryRaster || analyses.length > 0,
        isFrameMissing: frameQuery.isMissing,
        isSelectionUnavailable: isSourceUnavailable,
        isModelUnavailable,
        refetchMetadata: () => {
            setRequestKey((currentValue) => currentValue + 1);
            return metadataQuery.refetch();
        }
    };
};
