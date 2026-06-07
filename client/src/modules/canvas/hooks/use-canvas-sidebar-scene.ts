import { isSameScene, isSameSceneRenderMetadata } from '../utilities/scene-identity';
import { AnalysisStatus, normalizeCanvasAnalysisStatus } from '../utilities/analysis-status';
import useExposureManager, { DEFAULT_ENTRY } from './use-exposure-manager';
import {
    extractTrajectoryTimesteps,
    getNearestTimestep,
    getSelectedTimestepsForAnalysis
} from '../utilities/selected-timestep-analysis';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import useCanvasUrlState from './use-canvas-url-state';
import { buildPluginScene, resolveExposureSceneRenderMetadata } from '../utilities/plugin-exposure-export';

import { useAnalysesByTrajectoryQuery, analysisQuery } from '@/modules/analysis/hooks/queries';
import {
    cancelAnalysisCacheQueries,
    findCachedAnalysisById,
    removeAnalysisCaches,
    snapshotAnalysisCaches,
    updateAnalysisExecutionCaches,
    updateAnalysisStatusCaches,
    upsertAnalysisFromSocketPayload
} from '@/modules/analysis/services/cache';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import queryClient from '@/shared/infrastructure/query/query-client';
import {
    cancelSceneArtifactCacheQueries,
    invalidateSceneArtifacts,
    removeSceneArtifactsForAnalysisFromCache,
    snapshotSceneArtifactCaches
} from '@/modules/trajectory/hooks/scene-artifacts/queries';
import { SOCKET_ANALYSIS_EVENTS } from '@/modules/socket/events/analysis';
import { SOCKET_SCENE_ARTIFACT_EVENTS } from '@/modules/socket/events/trajectory';
import { SOCKET_TEAM_EVENTS } from '@/modules/socket/events/team';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import { useCanvasCanCollaborate } from '@/modules/canvas/api/access';
import useRetryFailedFrames from '@/modules/analysis/hooks/use-retry-failed-frames';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { sileo } from 'sileo';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { usePendingPluginExecutionsStore } from '../stores/use-pending-plugin-executions-store';
import { DEFAULT_SCENE } from '@/modules/fractal/utilities/scene-utils';
import { restoreQueryDataSnapshot } from '@/shared/infrastructure/query/cache-utils';

import type { ExposureEntry } from './use-exposure-manager';
import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { SceneObjectType } from '@/modules/fractal/api/entities/scene';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory/trajectory';
import type { QueryDataSnapshot } from '@/shared/infrastructure/query/cache-utils';

export interface AnalysisSectionData {
    analysis: Analysis;
    pluginId: string;
    pluginDisplayName: string;
    entry: ExposureEntry;
    isCurrentAnalysis: boolean;
    userConfig: Record<string, unknown>;
}

interface UseCanvasSidebarSceneProps {
    trajectory?: Trajectory | null;
    trajectoryId?: string;
}

interface DeleteAnalysisOptimisticContext {
    analysisSnapshot: QueryDataSnapshot;
    sceneArtifactSnapshot: QueryDataSnapshot;
    expandedSectionsSnapshot: Set<string>;
    headerPopoverStatesSnapshot: Map<string, boolean>;
    selectedAnalysisIdSnapshot?: string;
    clearedSelectedAnalysis: boolean;
    editorSnapshot: {
        activeScene: SceneObjectType;
        activeScenes: SceneObjectType[];
    };
}

const sceneBelongsToAnalysis = (scene: SceneObjectType | null | undefined, analysisId: string): boolean => {
    return !!scene
        && scene.source !== 'default'
        && 'analysisId' in scene
        && scene.analysisId === analysisId;
};

const scrollRightPanelToTop = (): (() => void) | undefined => {
    const raf = window.requestAnimationFrame(() => {
        const panel = document.getElementById('canvas-right-panel');
        const targets = [
            panel,
            panel?.querySelector<HTMLElement>('.canvas-objects-panel__top'),
            panel?.querySelector<HTMLElement>('.canvas-tree-container')
        ].filter((target): target is HTMLElement => Boolean(target));

        targets.forEach((target) => {
            target.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    return () => window.cancelAnimationFrame(raf);
};

const useCanvasSidebarScene = ({ trajectory, trajectoryId: propTrajectoryId }: UseCanvasSidebarSceneProps) => {
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();

    const trajectoryId = propTrajectoryId || trajectory?._id;

    const {
        setActiveScene,
        activeScene,
        addScene,
        removeScene,
        activeScenes,
        currentTimestep,
        setCurrentTimestep
    } = useEditorStore(useShallow((s) => ({
        setActiveScene: s.setActiveScene,
        activeScene: s.activeScene,
        addScene: s.addScene,
        removeScene: s.removeScene,
        activeScenes: s.activeScenes,
        currentTimestep: s.currentTimestep,
        setCurrentTimestep: s.setCurrentTimestep
    })));

    const { analysisId: analysisConfigId, setAnalysisId } = useCanvasUrlState();

    const { exposureEntries, getEntry, loadExposuresForAnalysis, resetEntries } = useExposureManager({ trajectoryId });
    const { pluginsById } = usePluginSelectors();
    const retryFailedFrames = useRetryFailedFrames();
    const analysisConfigIdRef = useRef<string | undefined>(analysisConfigId);
    useEffect(() => { analysisConfigIdRef.current = analysisConfigId; }, [analysisConfigId]);

    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [headerPopoverStates, setHeaderPopoverStates] = useState<Map<string, boolean>>(new Map());

    const activeSceneRef = useRef(activeScene);
    const manualSelectionRef = useRef<string | null>(null);

    useEffect(() => { activeSceneRef.current = activeScene; }, [activeScene]);

    const analysesQuery = useAnalysesByTrajectoryQuery(
        { trajectoryId: trajectoryId ?? '', page: 1, limit: 100 },
        { enabled: !!trajectoryId }
    );

    const bootstrapLoading = analysesQuery.isLoading;

    const analyses = analysesQuery.data?.data ?? [];
    const selectedAnalysis = useMemo(() => {
        if (!analysisConfigId) {
            return undefined;
        }

        return findCachedAnalysisById({
            analysisId: analysisConfigId,
            trajectoryId,
            fallbackAnalyses: analyses.length > 0 ? analyses : (trajectory?.analysis ?? [])
        });
    }, [analyses, analysisConfigId, trajectory?.analysis, trajectoryId]);
    const resolvedAnalyses = useMemo(() => {
        if (!selectedAnalysis || analyses.some((analysis) => analysis._id === selectedAnalysis._id)) {
            return analyses;
        }

        return [selectedAnalysis, ...analyses];
    }, [analyses, selectedAnalysis]);
    const selectedAnalysisPluginId = useMemo(() => {
        if (!analysisConfigId) {
            return undefined;
        }

        return resolvedAnalyses.find((analysis) => analysis._id === analysisConfigId)?.plugin;
    }, [analysisConfigId, resolvedAnalyses]);

    useEffect(() => {
        if (analysesQuery.error) {
            checkAccessDeniedError(analysesQuery.error);
        }
    }, [analysesQuery.error, checkAccessDeniedError]);

    useEffect(() => {
        setExpandedSections(new Set());
        setSearchQuery('');
        setHeaderPopoverStates(new Map());
        resetEntries();
    }, [trajectoryId, resetEntries]);

    // Drop in-flight plugin toasts tied to the previous trajectory so they
    // don't linger when the user navigates to a different canvas.
    useEffect(() => {
        if (!trajectoryId) {
            return;
        }
        return () => {
            const { entries } = usePendingPluginExecutionsStore.getState();
            Object.values(entries).forEach((entry) => {
                if (entry.trajectoryId !== trajectoryId) {
                    return;
                }
                if (entry.toastId) {
                    sileo.dismiss(entry.toastId);
                }
                usePendingPluginExecutionsStore.getState().remove(entry.analysisId);
            });
        };
    }, [trajectoryId]);

    const removeAnalysisScenes = useCallback((analysisId: string) => {
        const editorState = useEditorStore.getState();
        const nextActiveScenes = editorState.activeScenes.filter((scene) => !sceneBelongsToAnalysis(scene, analysisId));
        const safeActiveScenes = nextActiveScenes.length > 0 ? nextActiveScenes : [DEFAULT_SCENE];
        const nextActiveScene = sceneBelongsToAnalysis(editorState.activeScene, analysisId)
            ? safeActiveScenes[0] ?? DEFAULT_SCENE
            : editorState.activeScene;

        useEditorStore.setState({
            activeScene: nextActiveScene,
            activeScenes: safeActiveScenes
        });
    }, []);

    const applyDeletedAnalysisLocally = useCallback((analysisId: string) => {
        removeAnalysisCaches(analysisId);
        removeSceneArtifactsForAnalysisFromCache(analysisId);
        removeAnalysisScenes(analysisId);
        setExpandedSections((current) => {
            if (!current.has(analysisId)) return current;
            const next = new Set(current);
            next.delete(analysisId);
            return next;
        });
        setHeaderPopoverStates((current) => {
            if (!current.has(analysisId)) return current;
            const next = new Map(current);
            next.delete(analysisId);
            return next;
        });

        if (analysisConfigIdRef.current === analysisId) {
            setAnalysisId(undefined, { replace: true });
        }
    }, [removeAnalysisScenes, setAnalysisId]);

    const deleteAnalysisMutation = analysisQuery.useDeleteMutation({
        onMutate: async (analysisId): Promise<DeleteAnalysisOptimisticContext> => {
            await Promise.all([
                cancelAnalysisCacheQueries(),
                cancelSceneArtifactCacheQueries()
            ]);

            const editorState = useEditorStore.getState();
            const context: DeleteAnalysisOptimisticContext = {
                analysisSnapshot: snapshotAnalysisCaches(),
                sceneArtifactSnapshot: snapshotSceneArtifactCaches(),
                expandedSectionsSnapshot: new Set(expandedSections),
                headerPopoverStatesSnapshot: new Map(headerPopoverStates),
                selectedAnalysisIdSnapshot: analysisConfigIdRef.current,
                clearedSelectedAnalysis: analysisConfigIdRef.current === analysisId,
                editorSnapshot: {
                    activeScene: editorState.activeScene,
                    activeScenes: editorState.activeScenes
                }
            };

            applyDeletedAnalysisLocally(analysisId);

            return context;
        },
        onError: (_error, _analysisId, context) => {
            const rollback = context as DeleteAnalysisOptimisticContext | undefined;
            if (!rollback) return;

            restoreQueryDataSnapshot(rollback.analysisSnapshot);
            restoreQueryDataSnapshot(rollback.sceneArtifactSnapshot);
            setExpandedSections(new Set(rollback.expandedSectionsSnapshot));
            setHeaderPopoverStates(new Map(rollback.headerPopoverStatesSnapshot));
            useEditorStore.setState({
                activeScene: rollback.editorSnapshot.activeScene,
                activeScenes: rollback.editorSnapshot.activeScenes
            });
            if (rollback.clearedSelectedAnalysis) {
                setAnalysisId(rollback.selectedAnalysisIdSnapshot, { replace: true });
            }
        },
        onSettled: () => {
            void analysisQuery.cache.invalidate();
            void invalidateSceneArtifacts();
        }
    });

    const handleAnalysisCreated = useCallback((data: Record<string, unknown>) => {
        if (!trajectoryId || data.trajectoryId !== trajectoryId) {
            return;
        }
        upsertAnalysisFromSocketPayload(data, trajectory?.name ?? '');
    }, [trajectory?.name, trajectoryId]);

    const handleAnalysisDeleted = useCallback((data: Record<string, unknown>) => {
        if (!trajectoryId || data.trajectoryId !== trajectoryId || !data.analysisId) {
            return;
        }

        applyDeletedAnalysisLocally(String(data.analysisId));
        void analysisQuery.cache.invalidate();
        void invalidateSceneArtifacts();
    }, [applyDeletedAnalysisLocally, trajectoryId]);

    const patchStatusFromSocket = useCallback((update: Record<string, unknown>) => {
        if (!trajectoryId || update.trajectoryId !== trajectoryId || !update.analysisId) {
            return;
        }

        const analysisId = String(update.analysisId);
        const isKnown = Boolean(findCachedAnalysisById({
            analysisId,
            trajectoryId,
            fallbackAnalyses: resolvedAnalyses
        }));

        if (!isKnown) {
            void queryClient.invalidateQueries({ queryKey: analysisQuery.QUERY_KEYS.lists() });
            void queryClient.invalidateQueries({
                predicate: (query) => {
                    const key = query.queryKey;
                    return Array.isArray(key) && key.includes('analysis') && key.includes('byTrajectory');
                }
            });
            return;
        }

        const normalizedStatus = normalizeCanvasAnalysisStatus(update.status as string | undefined);
        if (!normalizedStatus) {
            return;
        }

        updateAnalysisStatusCaches({
            analysisId,
            status: normalizedStatus,
            completedFrames: typeof update.completedFrames === 'number' ? update.completedFrames : undefined,
            totalFrames: typeof update.totalFrames === 'number' ? update.totalFrames : undefined,
            artifactStatus: update.artifactStatus as Analysis['artifactStatus'],
            expectedArtifacts: update.expectedArtifacts as Analysis['expectedArtifacts'],
            stages: update.stages as Analysis['stages'],
            childAnalyses: update.childAnalyses as Analysis['childAnalyses']
        });
    }, [trajectoryId, resolvedAnalyses]);

    const handleAnalysisStageChanged = useCallback((update: Record<string, unknown>) => {
        if (!trajectoryId || update.trajectoryId !== trajectoryId || !update.analysisId) {
            return;
        }

        updateAnalysisExecutionCaches({
            analysisId: String(update.analysisId),
            artifactStatus: update.artifactStatus as Analysis['artifactStatus'],
            expectedArtifacts: update.expectedArtifacts as Analysis['expectedArtifacts'],
            stages: update.stages as Analysis['stages'],
            childAnalyses: update.childAnalyses as Analysis['childAnalyses']
        });

        if (Array.isArray(update.expectedArtifacts)
            && update.expectedArtifacts.some((artifact) => {
                return typeof artifact === 'object'
                    && artifact !== null
                    && (artifact as { status?: unknown }).status === 'ready';
            })) {
            void invalidateSceneArtifacts();
        }
    }, [trajectoryId]);

    const handleAnalysisStatusChanged = useCallback((update: Record<string, unknown>) => {
        patchStatusFromSocket(update);

        const analysisId = typeof update.analysisId === 'string' ? update.analysisId : undefined;
        if (!analysisId) {
            return;
        }

        const resolvedPluginName = (update.pluginDisplayName as string | undefined)
            ?? (resolvedAnalyses.find((a) => a._id === analysisId)?.pluginDisplayName);
        const completedFrames = typeof update.completedFrames === 'number' ? update.completedFrames : undefined;
        const totalFrames = typeof update.totalFrames === 'number' ? update.totalFrames : undefined;
        const failedFrames = typeof update.failedFrames === 'number' ? update.failedFrames : undefined;

        const pendingStore = usePendingPluginExecutionsStore.getState();
        const pending = pendingStore.get(analysisId);
        const pluginName = pending?.pluginName ?? resolvedPluginName ?? 'Analysis';
        const status = update.status;

        if (status === AnalysisStatus.Running) {
            if (!pending) {
                return;
            }

            pendingStore.update(analysisId, {
                completedFrames,
                totalFrames
            });
            return;
        }

        if (status === AnalysisStatus.Completed) {
            if (pending) {
                const entry = pendingStore.remove(analysisId);

                const currentSelectedAnalysisId = analysisConfigIdRef.current;
                const canAutoSelect = Boolean(entry?.autoSelect)
                    && (!currentSelectedAnalysisId || currentSelectedAnalysisId === analysisId);

                const artifactsReady = update.artifactStatus === 'ready' || update.artifactStatus === undefined;

                if (canAutoSelect) {
                    if (entry?.timestep !== undefined) {
                        setCurrentTimestep(entry.timestep);
                    }
                    setAnalysisId(analysisId, { replace: true });
                    sileo.success({
                        title: `${pluginName} completed`,
                        description: artifactsReady
                            ? 'Analysis selected - results are ready in Scene Collection.'
                            : 'Analysis selected - artifacts are still uploading.'
                    });
                    return;
                }

                sileo.success({
                    title: `${pluginName} completed`,
                    description: artifactsReady
                        ? 'Artifacts are ready in Scene Collection.'
                        : 'Analysis completed. Artifacts are still uploading.',
                    button: {
                        title: 'View',
                        onClick: () => {
                            if (entry?.timestep !== undefined) {
                                setCurrentTimestep(entry.timestep);
                            }
                            setAnalysisId(analysisId, { replace: true });
                        }
                    }
                });
                return;
            }

            sileo.success({
                title: `${pluginName} completed`,
                description: update.artifactStatus === 'ready' || update.artifactStatus === undefined
                    ? 'Artifacts are ready in Scene Collection.'
                    : 'Analysis completed. Artifacts are still uploading.'
            });
            return;
        }

        if (status === AnalysisStatus.Failed) {
            pendingStore.remove(analysisId);

            const description = failedFrames !== undefined && failedFrames > 0
                ? `${failedFrames} frame${failedFrames === 1 ? '' : 's'} failed. Retry to re-run the failed frames.`
                : 'The analysis failed. Retry to re-run the failed frames.';

            sileo.error({
                title: `${pluginName} failed`,
                description,
                duration: 8000,
                button: {
                    title: 'Retry',
                    onClick: () => {
                        void retryFailedFrames(analysisId);
                    }
                }
            });
        }
    }, [patchStatusFromSocket, resolvedAnalyses, retryFailedFrames, setAnalysisId, setCurrentTimestep]);

    const handleSceneArtifactUpserted = useCallback((update: Record<string, unknown>) => {
        if (!trajectoryId || update.trajectoryId !== trajectoryId) {
            return;
        }
        void invalidateSceneArtifacts();
    }, [trajectoryId]);

    const canCollaborate = useCanvasCanCollaborate();
    const socketEnabled = !!trajectoryId && canCollaborate;
    useSocketEvent<Record<string, unknown>>(SOCKET_ANALYSIS_EVENTS.CREATED, handleAnalysisCreated, { enabled: socketEnabled });
    useSocketEvent<Record<string, unknown>>(SOCKET_ANALYSIS_EVENTS.DELETED, handleAnalysisDeleted, { enabled: socketEnabled });
    useSocketEvent<Record<string, unknown>>(SOCKET_TEAM_EVENTS.JOB_UPDATED, patchStatusFromSocket, { enabled: socketEnabled });
    useSocketEvent<Record<string, unknown>>(SOCKET_ANALYSIS_EVENTS.STATUS_CHANGED, handleAnalysisStatusChanged, { enabled: socketEnabled });
    useSocketEvent<Record<string, unknown>>(SOCKET_ANALYSIS_EVENTS.STAGE_CHANGED, handleAnalysisStageChanged, { enabled: socketEnabled });
    useSocketEvent<Record<string, unknown>>(SOCKET_SCENE_ARTIFACT_EVENTS.UPSERTED, handleSceneArtifactUpserted, { enabled: socketEnabled });

    useEffect(() => {
        if (!analysisConfigId) return;
        setExpandedSections(prev => {
            const next = new Set(prev);
            next.add(analysisConfigId);
            return next;
        });
        loadExposuresForAnalysis(analysisConfigId);
        return scrollRightPanelToTop();
    }, [analysisConfigId, loadExposuresForAnalysis]);

    useEffect(() => {
        if (resolvedAnalyses.length === 0) return;
        expandedSections.forEach((analysisId) => {
            if (!resolvedAnalyses.some((x: Analysis) => x._id === analysisId)) return;
            const entry = getEntry(analysisId);
            if (entry.state === 'idle' || entry.state === 'error') {
                loadExposuresForAnalysis(analysisId);
            }
        });
    }, [expandedSections, resolvedAnalyses, getEntry, loadExposuresForAnalysis]);

    useEffect(() => {
        if (!analysisConfigId) return;

        const currentScene = activeSceneRef.current;
        const entry = getEntry(analysisConfigId);

        if (entry.state !== 'loaded') return;

        const buildSceneFromExposure = (analysisId: string, exposureId: string, exposureExport?: {
            exporter?: string;
            type?: string;
            options?: Record<string, unknown>;
        }) => {
            const sceneRenderMetadata = resolveExposureSceneRenderMetadata({
                exposureId,
                exposureExport,
                plugin: selectedAnalysisPluginId ? pluginsById[selectedAnalysisPluginId] : undefined
            });

            return buildPluginScene({
                analysisId,
                exposureId,
                sceneRenderMetadata
            });
        };

        if (manualSelectionRef.current === analysisConfigId) {
            manualSelectionRef.current = null;
            return;
        }

        const exposures = entry.exposures;

        if (currentScene?.source === 'plugin') {
            const match = exposures.find((ex) => ex.exposureId === currentScene.sceneType);
            if (match) {
                const nextScene = buildSceneFromExposure(match.analysisId, match.exposureId, match.export);

                if (currentScene.analysisId === nextScene.analysisId
                    && currentScene.exposureId === nextScene.exposureId
                    && isSameSceneRenderMetadata(currentScene.sceneRenderMetadata, nextScene.sceneRenderMetadata)) {
                    return;
                }

                setActiveScene(nextScene);
                return;
            }
        }

        if (exposures.length > 0) {
            const primaryExposureId = selectedAnalysis?.expectedArtifacts?.find((artifact) => artifact.isPrimary)?.exposureId;
            const next = exposures.find((exposure) => exposure.exposureId === primaryExposureId) ?? exposures[0];
            setActiveScene(buildSceneFromExposure(next.analysisId, next.exposureId, next.export));
            return;
        }

        setActiveScene({ sceneType: 'trajectory', source: 'default' });
    }, [analysisConfigId, getEntry, pluginsById, selectedAnalysis, selectedAnalysisPluginId, setActiveScene]);

    const trajectoryTimesteps = useMemo(() => extractTrajectoryTimesteps(trajectory), [trajectory]);

    const sectionTimestepScopedIds = useMemo(() => {
        const scoped = new Set<string>();
        for (const analysis of resolvedAnalyses) {
            if (getSelectedTimestepsForAnalysis(analysis, trajectoryTimesteps)) {
                scoped.add(analysis._id);
            }
        }
        return scoped;
    }, [resolvedAnalyses, trajectoryTimesteps]);

    const allAnalysisSections = useMemo((): AnalysisSectionData[] => {
        if (resolvedAnalyses.length === 0) return [];

        return resolvedAnalyses.map((analysis: Analysis) => {
            const entry = exposureEntries.get(analysis._id) ?? DEFAULT_ENTRY;

            return {
                analysis,
                pluginId: analysis.plugin,
                pluginDisplayName: analysis.pluginDisplayName,
                entry,
                isCurrentAnalysis: analysis._id === analysisConfigId,
                userConfig: analysis.config
            };
        });
    }, [resolvedAnalyses, exposureEntries, analysisConfigId]);

    const filteredSections = useMemo(() => {
        if (!searchQuery.trim()) return allAnalysisSections;
        const query = searchQuery.toLowerCase();
        return allAnalysisSections.filter((section) => section.pluginDisplayName.toLowerCase().includes(query));
    }, [allAnalysisSections, searchQuery]);

    const hasSelectedTimestepAnalyses = sectionTimestepScopedIds.size > 0;

    const sceneCollectionSections = useMemo(
        () => filteredSections.filter((section) => !sectionTimestepScopedIds.has(section.analysis._id)),
        [filteredSections, sectionTimestepScopedIds]
    );

    const selectedTimestepSections = useMemo(
        () => filteredSections.filter((section) => sectionTimestepScopedIds.has(section.analysis._id)),
        [filteredSections, sectionTimestepScopedIds]
    );

    const toggleSection = useCallback((analysisId: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(analysisId)) next.delete(analysisId);
            else next.add(analysisId);
            return next;
        });
    }, []);

    const isSceneInActiveScenes = useCallback((scene: SceneObjectType) => {
        return activeScenes.some((s) => isSameScene(s, scene));
    }, [activeScenes]);

    const prevTimestepRef = useRef(currentTimestep);

    useEffect(() => {
        const previous = prevTimestepRef.current;
        prevTimestepRef.current = currentTimestep;

        if (previous === currentTimestep) return;
        if (currentTimestep === undefined) return;
        if (!selectedAnalysis) return;

        const scopedTimesteps = getSelectedTimestepsForAnalysis(selectedAnalysis, trajectoryTimesteps);
        if (!scopedTimesteps || scopedTimesteps.includes(currentTimestep)) return;

        setActiveScene({ sceneType: 'trajectory', source: 'default' });
        setAnalysisId(undefined, { replace: true });
    }, [currentTimestep, selectedAnalysis, trajectoryTimesteps, setActiveScene, setAnalysisId]);

    const onSelectScene = useCallback((scene: SceneObjectType, analysis?: Analysis) => {
        if (scene.source === 'plugin' && 'analysisId' in scene) {
            manualSelectionRef.current = scene.analysisId;
        }

        if (analysis?._id) {
            const selectedAnalysisTimesteps = getSelectedTimestepsForAnalysis(analysis, trajectoryTimesteps);
            const nextTimestep = getNearestTimestep(currentTimestep, selectedAnalysisTimesteps ?? trajectoryTimesteps);

            if (nextTimestep !== undefined && nextTimestep !== currentTimestep) {
                setCurrentTimestep(nextTimestep);
            }
        }

        setActiveScene(scene);
        if (analysis?._id) {
            setAnalysisId(analysis._id, { replace: true });
        } else {
            setAnalysisId(undefined, { replace: true });
        }
    }, [currentTimestep, setActiveScene, setAnalysisId, setCurrentTimestep, trajectoryTimesteps]);

    const onDeleteAnalysis = useCallback(async (analysisId: string) => {
        await showPromise(
            deleteAnalysisMutation.mutateAsync(analysisId),
            {
                loading: { title: 'Deleting analysis...' },
                success: { title: 'Analysis deleted successfully' },
                error: { title: 'Failed to delete analysis' }
            }
        );
        if (analysisConfigId === analysisId) {
            setAnalysisId(undefined, { replace: true });
        }
    }, [analysisConfigId, setAnalysisId, deleteAnalysisMutation]);

    const setHeaderPopoverOpen = useCallback((analysisId: string, isOpen: boolean) => {
        setHeaderPopoverStates(prev => {
            const next = new Map(prev);
            next.set(analysisId, isOpen);
            return next;
        });
    }, []);

    const headerPopoverCallbacks = useMemo(() => {
        const map = new Map<string, (isOpen: boolean) => void>();
        filteredSections.forEach((section) => {
            map.set(section.analysis._id, (isOpen: boolean) => {
                setHeaderPopoverOpen(section.analysis._id, isOpen);
            });
        });
        return map;
    }, [filteredSections, setHeaderPopoverOpen]);

    return {
        trajectoryId,
        searchQuery,
        setSearchQuery,
        expandedSections,
        bootstrapLoading,
        analyses: resolvedAnalyses,
        headerPopoverStates,
        accessDenied,
        accessDeniedMessage,

        filteredSections,
        sceneCollectionSections,
        selectedTimestepSections,
        hasSelectedTimestepAnalyses,
        showSectionsSkeleton: bootstrapLoading,
        headerPopoverCallbacks,

        activeScene,
        addScene,
        removeScene,
        onSelectScene,
        isSceneInActiveScenes,

        toggleSection,
        onDeleteAnalysis,
        onRetryLoadExposures: loadExposuresForAnalysis
    };
};

export default useCanvasSidebarScene;
