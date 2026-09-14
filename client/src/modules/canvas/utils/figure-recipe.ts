import { Exporter } from '@volt/contracts/modules/plugin/enums';
import { AnalysisStatus, normalizeCanvasAnalysisStatus } from './analysis-status';
import { ANALYSIS_EXECUTION_METADATA_KEY } from './selected-timestep-analysis';
import {
    buildPluginScene,
    isRenderableSceneExporter,
    resolveExposureSceneRenderMetadata
} from './plugin-exposure-export';
import { getSceneKey } from '@/modules/fractal/utils/scene-utils';
import { isRecord } from '@/shared/utils/type-guards';
import { humanizeKey } from '../components/AnalysisTreeNode/config-values';

import { resolveRunLabel } from '../components/PipelineRunTreeNode/stage-labels';

import type { Analysis, AnalysisExpectedArtifact } from '@volt/contracts/modules/analysis/domain';
import type { PipelineRun } from '@volt/contracts/modules/plugin/pipeline-run';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';
import type { RenderableExposure } from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import type { PluginScene, SceneObjectType, SceneVisualOverride, SceneVisualOverrides } from '@/modules/fractal/contracts/scene';

export interface FigureLayerRecipe {
    exposureId: string;
    exporter?: string;
    label: string;
    override: SceneVisualOverride;
}

export interface FigureRecipe {
    layers: FigureLayerRecipe[];
}

export interface FigureCandidate {
    analysisId: string;
    pipelineId: string;
    label: string;
    ready: boolean;
    missingLayers: string[];
}

export interface FigurePipelineCandidate {
    pipelineId: string;
    label: string;
    analysisIds: string[];
}

export interface ComposedFigure {
    analysisId: string;
    label: string;
    filenameStem: string;
    scenes: PluginScene[];
    overrides: SceneVisualOverrides;
}

const EXPORT_ARGUMENT_PREFIX = 'export_';

const LAYER_SORT_ORDER: Record<string, number> = {
    [Exporter.ATOMISTIC]: 0,
    [Exporter.MESH]: 1,
    [Exporter.BOND]: 2,
    [Exporter.LINE]: 3
};

const formatScalar = (value: unknown): string | undefined => {
    if (typeof value === 'boolean') {
        return value ? 'yes' : 'no';
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
        return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
    }

    if (typeof value === 'string' && value.trim()) {
        return value.trim();
    }

    return undefined;
};

const flattenConfigTokens = (source: Record<string, unknown>): string[] => {
    return Object.entries(source).flatMap(([key, value]) => {
        if (key === ANALYSIS_EXECUTION_METADATA_KEY || key.startsWith(EXPORT_ARGUMENT_PREFIX)) {
            return [];
        }

        if (isRecord(value)) {
            return flattenConfigTokens(value);
        }

        const formatted = formatScalar(value);
        if (!formatted) {
            return [];
        }

        return [`${humanizeKey(key)} ${formatted}`];
    });
};

export const buildAnalysisFigureLabel = (analysis: Analysis): string => {
    const tokens = flattenConfigTokens(analysis.config);
    if (tokens.length === 0) {
        return analysis.pluginDisplayName;
    }

    return `${analysis.pluginDisplayName} · ${tokens.slice(0, 3).join(' · ')}`;
};

export const toFilenameStem = (value: string): string => {
    const stem = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);

    return stem || 'analysis';
};

const isReadyExposure = (analysis: Analysis, exposure: RenderableExposure): boolean => {
    const artifact = analysis.expectedArtifacts?.find((candidate) => candidate.exposureId === exposure.exposureId);
    return !artifact || artifact.status === 'ready';
};

const resolveExporter = (
    artifact: AnalysisExpectedArtifact | undefined,
    exposure: RenderableExposure
): string | undefined => {
    return exposure.export?.exporter ?? artifact?.exporter;
};

const listReadyExposures = (analysis: Analysis, exposures: RenderableExposure[]): RenderableExposure[] => {
    return exposures.filter((exposure) => {
        if (!isReadyExposure(analysis, exposure)) {
            return false;
        }

        const exporter = resolveExporter(
            analysis.expectedArtifacts?.find((artifact) => artifact.exposureId === exposure.exposureId),
            exposure
        );
        return isRenderableSceneExporter(exporter);
    });
};

const pickMatchingExposure = (
    analysis: Analysis,
    exposures: RenderableExposure[],
    layer: FigureLayerRecipe,
    claimed: Set<string>
): RenderableExposure | undefined => {
    const ready = listReadyExposures(analysis, exposures).filter((exposure) => !claimed.has(exposure.exposureId));
    const byId = ready.find((exposure) => exposure.exposureId === layer.exposureId);
    if (byId) {
        return byId;
    }

    if (!layer.exporter) {
        return undefined;
    }

    return ready.find((exposure) => {
        const exporter = resolveExporter(
            analysis.expectedArtifacts?.find((artifact) => artifact.exposureId === exposure.exposureId),
            exposure
        );
        return exporter === layer.exporter;
    });
};

export const captureFigureRecipe = (
    activeScenes: SceneObjectType[],
    sceneVisualOverrides: SceneVisualOverrides
): FigureRecipe | null => {
    const layers: FigureLayerRecipe[] = [];

    activeScenes.forEach((scene) => {
        if (scene.source !== 'plugin') {
            return;
        }

        const exporter = scene.sceneRenderMetadata?.exporter;
        if (exporter && !isRenderableSceneExporter(exporter)) {
            return;
        }

        layers.push({
            exposureId: scene.exposureId,
            exporter,
            label: scene.sceneRenderMetadata?.exporter
                ? humanizeKey(scene.sceneRenderMetadata.exporter.replace(/Exporter$/, ''))
                : humanizeKey(scene.exposureId),
            override: sceneVisualOverrides[getSceneKey(scene)] ?? {}
        });
    });

    if (layers.length === 0) {
        return null;
    }

    return { layers };
};

export const listFigureCandidates = (
    analyses: Analysis[],
    exposuresByAnalysisId: Map<string, RenderableExposure[]>,
    recipe: FigureRecipe | null
): FigureCandidate[] => {
    if (!recipe) {
        return [];
    }

    return analyses
        .filter((analysis) => normalizeCanvasAnalysisStatus(analysis.status) === AnalysisStatus.Completed)
        .map((analysis) => {
            const claimed = new Set<string>();
            const missingLayers = recipe.layers.flatMap((layer) => {
                const match = pickMatchingExposure(
                    analysis,
                    exposuresByAnalysisId.get(analysis._id) ?? [],
                    layer,
                    claimed
                );
                if (!match) {
                    return [layer.label];
                }

                claimed.add(match.exposureId);
                return [];
            });

            return {
                analysisId: analysis._id,
                pipelineId: analysis.pipelineRunId ?? `analysis:${analysis._id}`,
                label: buildAnalysisFigureLabel(analysis),
                ready: missingLayers.length === 0,
                missingLayers
            };
        });
};

export const listFigurePipelineCandidates = (
    candidates: FigureCandidate[],
    pipelineRuns: PipelineRun[]
): FigurePipelineCandidate[] => {
    const ready = candidates.filter((candidate) => candidate.ready);
    const grouped = new Map<string, string[]>();

    ready.forEach((candidate) => {
        const analysisIds = grouped.get(candidate.pipelineId) ?? [];
        analysisIds.push(candidate.analysisId);
        grouped.set(candidate.pipelineId, analysisIds);
    });

    return Array.from(grouped.entries()).map(([pipelineId, analysisIds]) => {
        const run = pipelineRuns.find((candidate) => candidate._id === pipelineId);
        const label = run
            ? resolveRunLabel(run, run.stages.map((stage) => ({
                kind: 'analysis',
                stage
            })))
            : (ready.find((candidate) => candidate.pipelineId === pipelineId)?.label ?? 'Pipeline');

        return {
            pipelineId,
            label,
            analysisIds
        };
    });
};

export const composeFigureForAnalysis = (
    analysis: Analysis,
    exposures: RenderableExposure[],
    recipe: FigureRecipe,
    plugin?: Plugin
): ComposedFigure | null => {
    const scenes: PluginScene[] = [];
    const overrides: SceneVisualOverrides = {};
    const claimed = new Set<string>();

    const orderedLayers = [...recipe.layers].sort((left, right) => {
        const leftOrder = LAYER_SORT_ORDER[left.exporter ?? ''] ?? 10;
        const rightOrder = LAYER_SORT_ORDER[right.exporter ?? ''] ?? 10;
        return leftOrder - rightOrder;
    });

    for (const layer of orderedLayers) {
        const exposure = pickMatchingExposure(analysis, exposures, layer, claimed);
        if (!exposure) {
            return null;
        }

        claimed.add(exposure.exposureId);
        const scene = buildPluginScene({
            analysisId: analysis._id,
            exposureId: exposure.exposureId,
            sceneRenderMetadata: resolveExposureSceneRenderMetadata({
                exposureId: exposure.exposureId,
                exposureExport: exposure.export,
                plugin
            })
        });
        scenes.push(scene);
        overrides[getSceneKey(scene)] = { ...layer.override };
    }

    const label = buildAnalysisFigureLabel(analysis);
    return {
        analysisId: analysis._id,
        label,
        filenameStem: toFilenameStem(label),
        scenes,
        overrides
    };
};
