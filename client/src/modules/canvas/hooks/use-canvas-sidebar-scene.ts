import { isSameScene, isSameSceneRenderMetadata } from '../utilities/scene-identity';
import { AnalysisStatus, normalizeCanvasAnalysisStatus } from '../utilities/analysis-status';
import { DEFAULT_ENTRY } from './use-exposure-manager';
import {
    extractTrajectoryTimesteps,
    getNearestTimestep,
    getSelectedTimestepsForAnalysis
} from '../utilities/selected-timestep-analysis';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import useCanvasUrlState from './use-canvas-url-state';
import useExposureManager from './use-exposure-manager';
import { buildPluginScene, resolveExposureSceneRenderMetadata } from '../utilities/plugin-exposure-export';

import { useAnalysesByTrajectoryQuery, analysisQuery } from '@/modules/analysis/hooks/queries';
import { findCachedAnalysisById, updateAnalysisStatusCaches, upsertAnalysisFromSocketPayload } from '@/modules/analysis/services/cache';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import queryClient from '@/shared/infrastructure/query/query-client';
import { SCENE_ARTIFACTS_QUERY_KEYS } from '@/modules/trajectory/hooks/scene-artifacts/queries';
import { SOCKET_ANALYSIS_EVENTS } from '@/modules/socket/analysis/constants/analysis-socket-events';
import { SOCKET_SCENE_ARTIFACT_EVENTS } from '@/modules/socket/trajectory/constants/scene-artifact-socket-events';
import { SOCKET_TEAM_EVENTS } from '@/modules/socket/team/constants/team-socket-events';
import useSocketEvent from '@/modules/socket/core/hooks/use-socket-event';
import { useCanvasCanCollaborate } from '@/modules/canvas/api/access';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { sileo } from 'sileo';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';

import type { ExposureEntry } from './use-exposure-manager';
import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { SceneObjectType } from '@/modules/fractal/api/entities/scene';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';

export interface AnalysisSectionData {
    analysis: Analysis;
    pluginId: string;
    pluginDisplayName: string;
    entry: ExposureEntry;
    isCurrentAnalysis: boolean;
    userConfig: Record<string, unknown>;
};

interface UseCanvasSidebarSceneProps {
    trajectory?: Trajectory | null;
    trajectoryId?: string;
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

    if (typeof window !== 'undefined') {
        (window as any).__VOLT_SIDEBAR_DEBUG = {
            trajectoryId,
            dataShape: analysesQuery.data ? Object.keys(analysesQuery.data) : null,
            dataIsArray: Array.isArray(analysesQuery.data),
            rawDataLen: Array.isArray(analysesQuery.data) ? analysesQuery.data.length : undefined,
            innerLen: analyses.length,
            isLoading: analysesQuery.isLoading,
            isError: analysesQuery.isError,
            errorMsg: analysesQuery.error?.message
        };
    }
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

    const deleteAnalysisMutation = analysisQuery.useDeleteMutation();

    const handleAnalysisCreated = useCallback((data: Record<string, unknown>) => {
        if (!trajectoryId || data.trajectoryId !== trajectoryId) {
            return;
        }
        upsertAnalysisFromSocketPayload(data, trajectory?.name ?? '');
    }, [trajectory?.name, trajectoryId]);

    const patchStatusFromSocket = useCallback((update: Record<string, unknown>) => {
        if (!trajectoryId || update.trajectoryId !== trajectoryId || !update.analysisId) {
            return;
        }

        const normalizedStatus = normalizeCanvasAnalysisStatus(update.status as string | undefined);
        if (!normalizedStatus) {
            return;
        }

        updateAnalysisStatusCaches({
            analysisId: String(update.analysisId),
            status: normalizedStatus,
            completedFrames: typeof update.completedFrames === 'number' ? update.completedFrames : undefined,
            totalFrames: typeof update.totalFrames === 'number' ? update.totalFrames : undefined
        });
    }, [trajectoryId]);

    const handleAnalysisStatusChanged = useCallback((update: Record<string, unknown>) => {
        patchStatusFromSocket(update);
        if (update.status === AnalysisStatus.Completed) {
            const pluginName = (update.pluginDisplayName as string | undefined)
                ?? (resolvedAnalyses.find((a) => a._id === update.analysisId)?.pluginDisplayName ?? 'Analysis');
            sileo.success({ title: `${pluginName} completed`, description: 'Artifacts are ready in Scene Collection.' });
        }
    }, [patchStatusFromSocket, resolvedAnalyses]);

    const handleSceneArtifactUpserted = useCallback((update: Record<string, unknown>) => {
        if (!trajectoryId || update.trajectoryId !== trajectoryId) {
            return;
        }
        void queryClient.invalidateQueries({ queryKey: SCENE_ARTIFACTS_QUERY_KEYS.sceneArtifacts() });
    }, [trajectoryId]);

    const canCollaborate = useCanvasCanCollaborate();
    const socketEnabled = !!trajectoryId && canCollaborate;
    useSocketEvent<Record<string, unknown>>(SOCKET_ANALYSIS_EVENTS.CREATED, handleAnalysisCreated, { enabled: socketEnabled });
    useSocketEvent<Record<string, unknown>>(SOCKET_TEAM_EVENTS.JOB_UPDATED, patchStatusFromSocket, { enabled: socketEnabled });
    useSocketEvent<Record<string, unknown>>(SOCKET_ANALYSIS_EVENTS.STATUS_CHANGED, handleAnalysisStatusChanged, { enabled: socketEnabled });
    useSocketEvent<Record<string, unknown>>(SOCKET_SCENE_ARTIFACT_EVENTS.UPSERTED, handleSceneArtifactUpserted, { enabled: socketEnabled });

    useEffect(() => {
        if (!analysisConfigId) return;
        setExpandedSections(prev => {
            const next = new Set(prev);
            next.add(analysisConfigId);
            return next;
        });
        loadExposuresForAnalysis(analysisConfigId);
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
            const next = exposures[0];
            setActiveScene(buildSceneFromExposure(next.analysisId, next.exposureId, next.export));
            return;
        }

        setActiveScene({ sceneType: 'trajectory', source: 'default' });
    }, [analysisConfigId, getEntry, pluginsById, selectedAnalysisPluginId, setActiveScene]);

    const trajectoryTimesteps = useMemo(() => extractTrajectoryTimesteps(trajectory), [trajectory]);

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

    const hasSelectedTimestepAnalyses = useMemo(() => {
        return allAnalysisSections.some((section) => {
            return Boolean(getSelectedTimestepsForAnalysis(section.analysis, trajectoryTimesteps));
        });
    }, [allAnalysisSections, trajectoryTimesteps]);

    const sceneCollectionSections = useMemo(() => {
        return filteredSections.filter((section) => {
            return !getSelectedTimestepsForAnalysis(section.analysis, trajectoryTimesteps);
        });
    }, [filteredSections, trajectoryTimesteps]);

    const selectedTimestepSections = useMemo(() => {
        return filteredSections.filter((section) => {
            return Boolean(getSelectedTimestepsForAnalysis(section.analysis, trajectoryTimesteps));
        });
    }, [filteredSections, trajectoryTimesteps]);

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
