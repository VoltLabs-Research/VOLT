import { useAnalysesByTrajectoryQuery } from '@/modules/analysis/hooks/queries';
import { useEditorStore } from '@/modules/canvas/store/editor';
import { useScreenshotStore } from '@/modules/canvas/store/use-screenshot-store';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { usePipelineRunsQuery } from '@/modules/plugin/hooks/plugin/queries';
import { getSceneKey } from '@/modules/fractal/utils/scene-utils';
import {
    captureFigureRecipe,
    composeFigureForAnalysis,
    listFigureCandidates,
    listFigurePipelineCandidates
} from '../utils/figure-recipe';
import { buildScreenshotFilename } from '../utils/screenshot-filename';
import { isRenderableSceneExport } from '../utils/plugin-exposure-export';
import { useSceneArtifactsQueries } from '@/modules/trajectory/hooks/scene-artifacts/queries';
import { sileo } from 'sileo';
import { useCallback, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type { ComposedFigure, FigureCandidate, FigureRecipe } from '../utils/figure-recipe';
import type { RenderableExposure } from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import type { ListSceneArtifactsInput, RenderableExposurePayload } from '@/modules/trajectory/api/services/scene-artifacts-service';
import type { ScreenshotSettings } from '../utils/screenshot';
import type { SceneObjectType, SceneVisualOverrides } from '@/modules/fractal/contracts/scene';
import type { ModelDragOffset } from '@/modules/fractal/contracts/editor/scene-types';

interface UseFigureBatchParams {
    trajectoryId?: string;
}

interface SceneSnapshot {
    activeScene: SceneObjectType;
    activeScenes: SceneObjectType[];
    sceneVisualOverrides: SceneVisualOverrides;
    sceneMergeGroups: Record<string, string>;
    modelDragOffsets: Record<string, ModelDragOffset>;
}

const SCENE_READY_TIMEOUT_MS = 45_000;
const SCENE_READY_POLL_MS = 80;
let activeBatchAbort: AbortController | null = null;

export const abortFigureBatch = () => {
    activeBatchAbort?.abort();
    activeBatchAbort = null;
};

const buildExposureParams = (trajectoryId: string, analysisId: string): ListSceneArtifactsInput => ({
    trajectoryId,
    analysisId,
    sourceType: 'plugin-exposure',
    projection: 'renderable-exposures',
    page: 1,
    limit: 1000
});

const toRenderableExposures = (page: { data?: RenderableExposurePayload[] } | undefined): RenderableExposure[] => {
    return ((page?.data ?? []) as RenderableExposure[]).filter((exposure) => isRenderableSceneExport(exposure.export));
};

const snapshotScene = (): SceneSnapshot => {
    const state = useEditorStore.getState();
    return {
        activeScene: state.activeScene,
        activeScenes: [...state.activeScenes],
        sceneVisualOverrides: { ...state.sceneVisualOverrides },
        sceneMergeGroups: { ...state.sceneMergeGroups },
        modelDragOffsets: { ...state.modelDragOffsets }
    };
};

const restoreScene = (snapshot: SceneSnapshot) => {
    useEditorStore.setState({
        activeScene: snapshot.activeScene,
        activeScenes: snapshot.activeScenes,
        sceneVisualOverrides: snapshot.sceneVisualOverrides,
        sceneMergeGroups: snapshot.sceneMergeGroups,
        modelDragOffsets: snapshot.modelDragOffsets
    });
};

const wait = (ms: number) => new Promise((resolve) => {
    window.setTimeout(resolve, ms);
});

const waitForScenesReady = async (sceneKeys: string[], signal: AbortSignal) => {
    const startedAt = Date.now();

    while (Date.now() - startedAt < SCENE_READY_TIMEOUT_MS) {
        if (signal.aborted) {
            throw new Error('Figure batch cancelled.');
        }

        const { sceneLoadStates } = useEditorStore.getState();
        const failed = sceneKeys.find((sceneKey) => sceneLoadStates[sceneKey]?.error);
        if (failed) {
            throw new Error(sceneLoadStates[failed]?.error || 'Failed to load a figure layer.');
        }

        const states = sceneKeys.map((sceneKey) => sceneLoadStates[sceneKey]);
        const ready = states.every((state) => (
            state !== undefined
            && !state.isLoading
            && !state.error
            && state.progress === 100
        ));
        if (ready) {
            await wait(160);
            return;
        }

        await wait(SCENE_READY_POLL_MS);
    }

    throw new Error('Timed out waiting for figure layers to load.');
};

const applyComposedFigure = (figure: ComposedFigure) => {
    const editor = useEditorStore.getState();
    const pendingLoadStates = { ...editor.sceneLoadStates };
    figure.scenes.forEach((scene) => {
        pendingLoadStates[getSceneKey(scene)] = {
            isLoading: true,
            progress: 0,
            error: null
        };
    });
    useEditorStore.setState({ sceneLoadStates: pendingLoadStates });
    editor.setComposedScenes(figure.scenes);
    Object.entries(figure.overrides).forEach(([sceneKey, override]) => {
        editor.applySceneVisualOverride(sceneKey, override);
    });
};

const runWithoutHistory = async (callback: () => Promise<void>) => {
    const temporal = useEditorStore.temporal.getState();
    temporal.pause();
    try {
        await callback();
    } finally {
        temporal.resume();
    }
};

const useFigureBatch = ({ trajectoryId }: UseFigureBatchParams) => {
    const { pluginsById } = usePluginSelectors();
    const selectedAnalysisIds = useScreenshotStore((state) => state.selectedFigureAnalysisIds);
    const progress = useScreenshotStore((state) => state.figureBatchProgress);

    const {
        activeScenes,
        sceneVisualOverrides
    } = useEditorStore(useShallow((state) => ({
        activeScenes: state.activeScenes,
        sceneVisualOverrides: state.sceneVisualOverrides
    })));
    const isCapturing = useScreenshotStore((state) => state.isCapturing);
    const isBatching = useScreenshotStore((state) => state.isFigureBatchActive);

    const analysesQuery = useAnalysesByTrajectoryQuery(
        {
            trajectoryId: trajectoryId ?? '',
            page: 1,
            limit: 100
        },
        { enabled: Boolean(trajectoryId) }
    );
    const analyses = useMemo(() => analysesQuery.data?.data ?? [], [analysesQuery.data?.data]);
    const currentTimestep = useEditorStore((state) => state.currentTimestep);
    const pipelineRunsQuery = usePipelineRunsQuery(
        {
            trajectoryId: trajectoryId ?? '',
            page: 1,
            limit: 50
        },
        { enabled: Boolean(trajectoryId) }
    );
    const pipelineRuns = useMemo(() => pipelineRunsQuery.data?.data ?? [], [pipelineRunsQuery.data?.data]);

    const recipe = useMemo<FigureRecipe | null>(() => {
        return captureFigureRecipe(activeScenes, sceneVisualOverrides);
    }, [activeScenes, sceneVisualOverrides]);

    const exposureParams = useMemo(() => {
        if (!trajectoryId) {
            return [] as ListSceneArtifactsInput[];
        }

        return analyses.map((analysis) => buildExposureParams(trajectoryId, analysis._id));
    }, [analyses, trajectoryId]);
    const exposureQueries = useSceneArtifactsQueries(exposureParams);

    const exposuresByAnalysisId = useMemo(() => {
        const map = new Map<string, RenderableExposure[]>();
        analyses.forEach((analysis, index) => {
            map.set(analysis._id, toRenderableExposures(exposureQueries[index]?.data as { data?: RenderableExposurePayload[] } | undefined));
        });
        return map;
    }, [analyses, exposureQueries]);

    const candidates = useMemo<FigureCandidate[]>(() => {
        return listFigureCandidates(analyses, exposuresByAnalysisId, recipe, pipelineRuns, currentTimestep);
    }, [analyses, currentTimestep, exposuresByAnalysisId, pipelineRuns, recipe]);
    const pipelineCandidates = useMemo(() => {
        return listFigurePipelineCandidates(candidates, pipelineRuns, currentTimestep);
    }, [candidates, currentTimestep, pipelineRuns]);

    useEffect(() => {
        const readyIds = new Set(
            pipelineCandidates.flatMap((candidate) => candidate.analysisIds)
        );
        const next = selectedAnalysisIds.filter((analysisId) => readyIds.has(analysisId));
        if (next.length !== selectedAnalysisIds.length) {
            useScreenshotStore.getState().setSelectedFigureAnalysisIds(next);
        }
    }, [pipelineCandidates, selectedAnalysisIds]);

    const togglePipeline = useCallback((analysisIds: string[], selected: boolean) => {
        const current = useScreenshotStore.getState().selectedFigureAnalysisIds;
        const selectedSet = new Set(current);
        analysisIds.forEach((analysisId) => {
            if (selected) {
                selectedSet.add(analysisId);
                return;
            }

            selectedSet.delete(analysisId);
        });
        useScreenshotStore.getState().setSelectedFigureAnalysisIds(Array.from(selectedSet));
    }, []);

    const selectAllReady = useCallback(() => {
        useScreenshotStore.getState().setSelectedFigureAnalysisIds(
            pipelineCandidates.flatMap((candidate) => candidate.analysisIds)
        );
    }, [pipelineCandidates]);

    const clearSelection = useCallback(() => {
        useScreenshotStore.getState().setSelectedFigureAnalysisIds([]);
    }, []);

    const cancel = useCallback(() => {
        abortFigureBatch();
    }, []);

    const resolveFilename = useCallback((scenes: SceneObjectType[]) => {
        return buildScreenshotFilename({
            scenes,
            analyses,
            pipelineRuns,
            exposuresByAnalysisId,
            timestep: currentTimestep
        });
    }, [analyses, currentTimestep, exposuresByAnalysisId, pipelineRuns]);

    useEffect(() => {
        useScreenshotStore.getState().setFilenameResolver(() => {
            return resolveFilename(useEditorStore.getState().activeScenes);
        });
        return () => {
            useScreenshotStore.getState().setFilenameResolver(null);
        };
    }, [resolveFilename]);

    const runBatch = useCallback(async (settings: ScreenshotSettings) => {
        if (!trajectoryId || !recipe || selectedAnalysisIds.length === 0 || isBatching) {
            return;
        }

        const selected = selectedAnalysisIds
            .map((analysisId) => analyses.find((analysis) => analysis._id === analysisId))
            .filter((analysis): analysis is Analysis => Boolean(analysis));
        if (selected.length === 0) {
            return;
        }

        abortFigureBatch();
        const controller = new AbortController();
        activeBatchAbort = controller;
        useScreenshotStore.getState().setFigureBatchActive(true);
        useEditorStore.getState().stopPlayback();
        const snapshot = snapshotScene();
        const toastId = sileo.show({
            type: 'loading',
            title: `Capturing ${selected.length} figures…`,
            duration: null
        });

        let captured = 0;
        const failures: string[] = [];

        try {
            await runWithoutHistory(async () => {
                try {
                    for (const [index, analysis] of selected.entries()) {
                        if (controller.signal.aborted) {
                            break;
                        }

                        const figure = composeFigureForAnalysis(
                            analysis,
                            exposuresByAnalysisId.get(analysis._id) ?? [],
                            recipe,
                            pluginsById[analysis.plugin]
                        );
                        if (!figure) {
                            failures.push(buildFallbackLabel(analysis));
                            continue;
                        }

                        useScreenshotStore.getState().setFigureBatchProgress({
                            current: index + 1,
                            total: selected.length,
                            label: figure.label
                        });

                        try {
                            applyComposedFigure(figure);
                            await wait(0);
                            await waitForScenesReady(figure.scenes.map(getSceneKey), controller.signal);

                            const requestId = useScreenshotStore.getState().requestCapture(settings, {
                                filename: resolveFilename(figure.scenes),
                                fromBatch: true
                            });
                            if (requestId === null) {
                                throw new Error('Could not queue a screenshot.');
                            }

                            await useScreenshotStore.getState().waitForCapture(requestId);
                            captured += 1;
                        } catch (error) {
                            if (controller.signal.aborted) {
                                throw error;
                            }

                            failures.push(figure.label);
                        }
                    }
                } finally {
                    restoreScene(snapshot);
                }
            });
        } catch (error) {
            if (!controller.signal.aborted) {
                sileo.error({
                    title: 'Figure batch failed',
                    description: error instanceof Error ? error.message : 'Could not capture the selected figures.'
                });
            }
        } finally {
            useScreenshotStore.getState().setFigureBatchActive(false);
            sileo.dismiss(toastId);
            if (activeBatchAbort === controller) {
                activeBatchAbort = null;
            }

            if (captured > 0) {
                sileo.success({
                    title: captured === 1 ? 'Captured 1 figure' : `Captured ${captured} figures`,
                    description: failures.length > 0
                        ? `Skipped ${failures.length} ${failures.length === 1 ? 'analysis' : 'analyses'}.`
                        : undefined
                });
            } else if (failures.length > 0 && !controller.signal.aborted) {
                sileo.error({
                    title: 'No figures captured',
                    description: 'Could not compose or capture the selected analyses.'
                });
            }
        }
    }, [analyses, exposuresByAnalysisId, isBatching, pluginsById, recipe, resolveFilename, selectedAnalysisIds, trajectoryId]);

    return {
        recipe,
        candidates,
        pipelineCandidates,
        selectedAnalysisIds,
        togglePipeline,
        selectAllReady,
        clearSelection,
        resolveFilename,
        runBatch,
        cancel,
        progress,
        isBatching,
        isBusy: isBatching || isCapturing
    };
};

const buildFallbackLabel = (analysis: Analysis): string => analysis.pluginDisplayName;

export default useFigureBatch;
