import { computeDifferingConfigFields } from '../utilities/canvas-sidebar-scene';
import { isSameScene } from '../utilities/scene-identity';
import { normalizeCanvasAnalysisStatus } from '../utilities/analysis-status';
import { DEFAULT_ENTRY } from './use-exposure-manager';
import {
    extractTrajectoryTimesteps,
    getNearestTimestep,
    getSelectedTimestepsForAnalysis
} from '../utilities/selected-timestep-analysis';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import useAnalysisStatus from './use-analysis-status';
import useCanvasUrlState from './use-canvas-url-state';
import useExposureManager from './use-exposure-manager';

import { useAnalysesByTrajectoryQuery, analysisQuery } from '@/modules/analysis/hooks/queries';
import { upsertAnalysisCaches, updateAnalysisStatusCaches } from '@/modules/analysis/services/cache';
import { SOCKET_TEAM_EVENTS } from '@/modules/socket/team/constants/team-socket-events';
import useSocketEvent from '@/modules/socket/core/hooks/use-socket-event';
import { showPromise } from '@/shared/presentation/hooks/toast';
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
    config: Record<string, unknown>;
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
    }, [trajectory?.name, trajectoryId]);

    const handleJobUpdated = useCallback((update: Record<string, unknown>) => {
        if (!trajectoryId || update.trajectoryId !== trajectoryId || !update.analysisId) {
            return;
        }

        const normalizedStatus = normalizeCanvasAnalysisStatus(update.status as string | undefined);
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
    }, [trajectoryId]);

    useSocketEvent<Record<string, unknown>>('analysis.created', handleAnalysisCreated, { enabled: !!trajectoryId });
    useSocketEvent<Record<string, unknown>>(SOCKET_TEAM_EVENTS.JOB_UPDATED, handleJobUpdated, { enabled: !!trajectoryId });

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
        const analysis = analyses.find((x: Analysis) => x._id === analysisConfigId);
        if (!analysis) return;
        loadExposuresForAnalysis(analysis._id);
    }, [analysisConfigId, analyses, loadExposuresForAnalysis]);

    useEffect(() => {
        if (analyses.length === 0) return;
        expandedSections.forEach((analysisId) => {
            const analysis = analyses.find((x: Analysis) => x._id === analysisId);
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

    const trajectoryTimesteps = useMemo(() => extractTrajectoryTimesteps(trajectory), [trajectory]);

    const allAnalysisSections = useMemo((): AnalysisSectionData[] => {
        if (analyses.length === 0) return [];

        return analyses.map((analysis: Analysis) => {
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
        sceneCollectionSections,
        selectedTimestepSections,
        hasSelectedTimestepAnalyses,
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
