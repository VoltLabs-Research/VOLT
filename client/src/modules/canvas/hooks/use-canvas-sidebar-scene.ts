import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import useCanvasUrlState from './use-canvas-url-state';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { useAnalysesByTrajectoryQuery, analysisQuery } from '@/modules/analysis/hooks/queries';
import { upsertAnalysisCaches, updateAnalysisStatusCaches } from '@/modules/analysis/hooks/socket-queries';
import useSocket from '@/modules/socket/hooks/use-socket';
import useAnalysisStatus, { normalizeAnalysisStatus } from './use-analysis-status';
import useExposureManager, { type ExposureEntry, DEFAULT_ENTRY } from './use-exposure-manager';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { SOCKET_TEAM_EVENTS } from '@/modules/socket/api/entities/socket-constants';

import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { SceneObjectType } from '@/modules/fractal/api/entities/fractal';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';
import { computeDifferingConfigFields } from '../utilities/canvas-sidebar-scene.ts';
import { isSameScene } from '../utilities/scene-identity';

export interface AnalysisSectionData {
    analysis: Analysis;
    pluginId: string;
    pluginDisplayName: string;
    entry: ExposureEntry;
    isCurrentAnalysis: boolean;
    config: Record<string, unknown>;
}

interface UseCanvasSidebarSceneProps {
    trajectory?: Trajectory | null;
    trajectoryId?: string;
}

const useCanvasSidebarScene = ({ trajectory, trajectoryId: propTrajectoryId }: UseCanvasSidebarSceneProps) => {
    const socketService = useSocket();
    const { accessDenied, accessDeniedMessage, checkRBACError } = useAccessDenied();

    const trajectoryId = propTrajectoryId || trajectory?._id;

    const { setActiveScene, activeScene, addScene, removeScene, activeScenes } = useEditorStore(useShallow((s) => ({
        setActiveScene: s.setActiveScene,
        activeScene: s.activeScene,
        addScene: s.addScene,
        removeScene: s.removeScene,
        activeScenes: s.activeScenes
    })));

    const { analysisId: analysisConfigId, setAnalysisId } = useCanvasUrlState();

    const { isAnalysisInProgress } = useAnalysisStatus({ trajectoryId, enabled: !!trajectoryId });

    const { exposureEntries, getEntry, loadExposuresForAnalysis, resetEntries } = useExposureManager({ trajectoryId });

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

    useEffect(() => {
        if (analysesQuery.error) {
            checkRBACError(analysesQuery.error);
        }
    }, [analysesQuery.error, checkRBACError]);

    useEffect(() => {
        setExpandedSections(new Set());
        setSearchQuery('');
        setHeaderPopoverStates(new Map());
        resetEntries();
    }, [trajectoryId, resetEntries]);

    const deleteAnalysisMutation = analysisQuery.useDeleteMutation();

    useEffect(() => {
        if (!trajectoryId) return;

        const handleAnalysisCreated = (...args: unknown[]) => {
            const data = args[0] as Record<string, unknown>;
            if (data.trajectoryId !== trajectoryId) return;

            const newAnalysis = {
                _id: data.analysisId,
                plugin: data.pluginId,
                pluginDisplayName: data.pluginDisplayName,
                config: data.config,
                trajectory: {
                    _id: String(data.trajectoryId || ''),
                    name: trajectory?.name ?? ''
                },
                totalFrames: data.totalFrames,
                completedFrames: data.completedFrames,
                status: data.status,
                createdAt: data.createdAt,
                updatedAt: data.createdAt
            } as unknown as Analysis;

            upsertAnalysisCaches(newAnalysis);
            void analysisQuery.cache.invalidate();
        };

        const unsubscribe = socketService.on('analysis.created', handleAnalysisCreated);
        return () => { unsubscribe(); };
    }, [trajectory?.name, trajectoryId, socketService]);

    useEffect(() => {
        if (!trajectoryId) {
            return;
        }

        const handleJobUpdated = (payload: unknown) => {
            const update = payload as Record<string, unknown>;
            if (update.trajectoryId !== trajectoryId || !update.analysisId) {
                return;
            }

            const normalizedStatus = normalizeAnalysisStatus(update.status as string | undefined);
            if (!normalizedStatus) {
                return;
            }

            updateAnalysisStatusCaches({
                analysisId: String(update.analysisId),
                trajectoryId,
                status: normalizedStatus,
                completedFrames: typeof update.completedFrames === 'number' ? update.completedFrames : undefined,
                totalFrames: typeof update.totalFrames === 'number' ? update.totalFrames : undefined
            });
        };

        const unsubscribe = socketService.on(SOCKET_TEAM_EVENTS.JOB_UPDATED, handleJobUpdated);
        return () => { unsubscribe(); };
    }, [trajectoryId, socketService]);

    useEffect(() => {
        if (!analysisConfigId) return;
        setExpandedSections(prev => {
            const next = new Set(prev);
            next.add(analysisConfigId);
            return next;
        });
    }, [analysisConfigId]);

    useEffect(() => {
        if (!analysisConfigId || analyses.length === 0) return;
        const analysis = analyses.find((x) => x._id === analysisConfigId);
        if (!analysis) return;
        loadExposuresForAnalysis(analysis._id);
    }, [analysisConfigId, analyses, loadExposuresForAnalysis]);

    useEffect(() => {
        if (analyses.length === 0) return;
        expandedSections.forEach((analysisId) => {
            const analysis = analyses.find((x) => x._id === analysisId);
            if (!analysis) return;
            const entry = getEntry(analysisId);
            if (entry.state === 'idle' || entry.state === 'error') {
                loadExposuresForAnalysis(analysisId);
            }
        });
    }, [expandedSections, analyses, getEntry, loadExposuresForAnalysis]);

    useEffect(() => {
        if (!analysisConfigId) return;

        if (manualSelectionRef.current === analysisConfigId) {
            manualSelectionRef.current = null;
            return;
        }

        const currentScene = activeSceneRef.current;

        if (currentScene?.source === 'plugin' && 'analysisId' in currentScene && currentScene.analysisId === analysisConfigId) {
            return;
        }

        const entry = getEntry(analysisConfigId);
        if (entry.state !== 'loaded') return;

        const exposures = entry.exposures;

        if (currentScene?.source === 'plugin') {
            const match = exposures.find((ex) => ex.exposureId === currentScene.sceneType);
            if (match) {
                setActiveScene({
                    sceneType: match.exposureId,
                    source: 'plugin',
                    analysisId: match.analysisId,
                    exposureId: match.exposureId
                });
                return;
            }
        }

        if (exposures.length > 0) {
            const next = exposures[0];
            setActiveScene({
                sceneType: next.exposureId,
                source: 'plugin',
                analysisId: next.analysisId,
                exposureId: next.exposureId
            });
            return;
        }

        setActiveScene({ sceneType: 'trajectory', source: 'default' });
    }, [analysisConfigId, getEntry, setActiveScene]);

    const differingConfigByAnalysis = useMemo(() => {
        if (analyses.length === 0) return new Map<string, [string, unknown][]>();
        return computeDifferingConfigFields(analyses);
    }, [analyses]);

    const allAnalysisSections = useMemo((): AnalysisSectionData[] => {
        if (analyses.length === 0) return [];

        return analyses.map((analysis) => {
            const entry = exposureEntries.get(analysis._id) ?? DEFAULT_ENTRY;

            return {
                analysis,
                pluginId: analysis.plugin,
                pluginDisplayName: analysis.pluginDisplayName || '',
                entry,
                isCurrentAnalysis: analysis._id === analysisConfigId,
                config: analysis.config
            };
        });
    }, [analyses, exposureEntries, analysisConfigId]);

    const filteredSections = useMemo(() => {
        if (!searchQuery.trim()) return allAnalysisSections;
        const query = searchQuery.toLowerCase();
        return allAnalysisSections.filter((section) => section.pluginDisplayName.toLowerCase().includes(query));
    }, [allAnalysisSections, searchQuery]);

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
        setActiveScene(scene);
        if (analysis?._id) {
            setAnalysisId(analysis._id, { replace: true });
        }
    }, [setActiveScene, setAnalysisId]);

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

    const showSectionsSkeleton = bootstrapLoading || (analyses.length > 0 && allAnalysisSections.length === 0);

    return {
        trajectoryId,
        searchQuery,
        setSearchQuery,
        expandedSections,
        bootstrapLoading,
        analyses,
        headerPopoverStates,
        accessDenied,
        accessDeniedMessage,

        filteredSections,
        differingConfigByAnalysis,
        showSectionsSkeleton,
        headerPopoverCallbacks,

        activeScene,
        addScene,
        removeScene,
        onSelectScene,
        isSceneInActiveScenes,

        toggleSection,
        onDeleteAnalysis,
        isAnalysisInProgress
    };
};

export default useCanvasSidebarScene;
