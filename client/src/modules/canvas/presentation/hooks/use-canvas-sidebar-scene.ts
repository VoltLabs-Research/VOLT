import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import useCanvasUrlState from './use-canvas-url-state';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import useAnalysisUseCases from '@/modules/analysis/presentation/hooks/use-analysis-use-cases';
import useSocket from '@/modules/socket/presentation/hooks/use-socket';
import useAnalysisStatus, { seedAnalysisStatuses } from './use-analysis-status';
import useExposureManager, { type ExposureEntry, DEFAULT_ENTRY } from './use-exposure-manager';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { sileo } from 'sileo';

import type { Analysis } from '@/modules/analysis/domain/entities/Analysis';
import { computeDifferingConfigFields } from '../utils/canvas-sidebar-scene.ts';
import { isSameScene } from '../utils/scene-identity';

export interface AnalysisSectionData {
    analysis: Analysis;
    pluginId: string;
    pluginDisplayName: string;
    entry: ExposureEntry;
    isCurrentAnalysis: boolean;
    config: Record<string, any>;
}

interface UseCanvasSidebarSceneProps {
    trajectory?: any | null;
    trajectoryId?: string;
}

const useCanvasSidebarScene = ({ trajectory, trajectoryId: propTrajectoryId }: UseCanvasSidebarSceneProps) => {
    const socketService = useSocket();
    const { getAnalysesByTrajectoryUseCase, deleteAnalysisUseCase } = useAnalysisUseCases();

    const trajectoryId = propTrajectoryId || trajectory?._id;

    // Editor store
    const { setActiveScene, activeScene, addScene, removeScene, activeScenes } = useEditorStore(useShallow((s) => ({
        setActiveScene: s.setActiveScene,
        activeScene: s.activeScene,
        addScene: s.addScene,
        removeScene: s.removeScene,
        activeScenes: s.activeScenes
    })));

    // Search params
    const { analysisId: analysisConfigId, setAnalysisId } = useCanvasUrlState();

    // Analysis status
    const { isAnalysisInProgress } = useAnalysisStatus({ trajectoryId, enabled: !!trajectoryId });

    // Exposure manager
    const { exposureEntries, getEntry, loadExposuresForAnalysis, resetEntries } = useExposureManager({ trajectoryId });

    // Local state
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [bootstrapLoading, setBootstrapLoading] = useState(true);
    const [analyses, setAnalyses] = useState<Analysis[]>([]);
    const [headerPopoverStates, setHeaderPopoverStates] = useState<Map<string, boolean>>(new Map());

    // Refs
    const activeSceneRef = useRef(activeScene);
    const manualSelectionRef = useRef<string | null>(null);
    const analysesUseCaseRef = useRef(getAnalysesByTrajectoryUseCase);

    useEffect(() => { activeSceneRef.current = activeScene; }, [activeScene]);
    useEffect(() => { analysesUseCaseRef.current = getAnalysesByTrajectoryUseCase; }, [getAnalysesByTrajectoryUseCase]);

    // Reset state when trajectory changes
    useEffect(() => {
        setExpandedSections(new Set());
        setSearchQuery('');
        setHeaderPopoverStates(new Map());
        resetEntries();
        setBootstrapLoading(true);
        setAnalyses([]);
    }, [trajectoryId, resetEntries]);

    // Bootstrap: fetch analyses
    useEffect(() => {
        let cancelled = false;

        const bootstrap = async () => {
            setBootstrapLoading(true);

            try {
                if (!trajectoryId) {
                    if (!cancelled) setBootstrapLoading(false);
                    return;
                }

                const response = await analysesUseCaseRef.current.execute({
                    trajectoryId,
                    page: 1,
                    limit: 100
                });

                if (cancelled) return;
                seedAnalysisStatuses(response.data.map((analysis) => ({
                    analysisId: analysis._id,
                    status: analysis.status
                })));
                setAnalyses(response.data);
            } catch {
                sileo.error({ title: 'Failed to load analyses' });
            } finally {
                if (!cancelled) setBootstrapLoading(false);
            }
        };

        bootstrap();
        return () => { cancelled = true; };
    }, [trajectoryId]);

    // Socket: listen for new analyses
    useEffect(() => {
        if (!trajectoryId) return;

        const handleAnalysisCreated = (data: any) => {
            if (data.trajectoryId !== trajectoryId) return;

            const newAnalysis: Analysis = {
                _id: data.analysisId,
                plugin: data.pluginId,
                pluginDisplayName: data.pluginDisplayName,
                config: data.config,
                trajectory: data.trajectoryId,
                totalFrames: data.totalFrames,
                completedFrames: data.completedFrames,
                status: data.status,
                createdAt: data.createdAt,
                updatedAt: data.createdAt
            } as any;

            seedAnalysisStatuses([{
                analysisId: String(data.analysisId || ''),
                status: data.status
            }]);

            setAnalyses(prev => {
                if (prev.some(a => a._id === newAnalysis._id)) return prev;
                return [newAnalysis, ...prev];
            });
        };

        const unsubscribe = socketService.on('analysis.created', handleAnalysisCreated);
        return () => { unsubscribe(); };
    }, [trajectoryId, socketService]);

    // Auto-expand current analysis section
    useEffect(() => {
        if (!analysisConfigId) return;
        setExpandedSections(prev => {
            const next = new Set(prev);
            next.add(analysisConfigId);
            return next;
        });
    }, [analysisConfigId]);

    // Load exposures for current analysis
    useEffect(() => {
        if (!analysisConfigId || analyses.length === 0) return;
        const analysis = analyses.find((x) => x._id === analysisConfigId);
        if (!analysis) return;
        loadExposuresForAnalysis(analysis._id);
    }, [analysisConfigId, analyses, loadExposuresForAnalysis]);

    // Load exposures for expanded sections
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

    // Auto-select scene when analysis changes
    useEffect(() => {
        if (!analysisConfigId) return;

        if (manualSelectionRef.current === analysisConfigId) {
            manualSelectionRef.current = null;
            return;
        }

        const currentScene = activeSceneRef.current;

        if (currentScene?.source === 'plugin' && (currentScene as any).analysisId === analysisConfigId) {
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

    // Computed: differing config fields
    const differingConfigByAnalysis = useMemo(() => {
        if (analyses.length === 0) return new Map<string, [string, any][]>();
        return computeDifferingConfigFields(analyses as any);
    }, [analyses]);

    // Computed: all analysis sections
    const allAnalysisSections = useMemo((): AnalysisSectionData[] => {
        if (analyses.length === 0) return [];

        const sections = analyses.map((analysis) => {
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

        return sections;
    }, [analyses, exposureEntries, analysisConfigId]);

    // Computed: filtered sections
    const filteredSections = useMemo(() => {
        if (!searchQuery.trim()) return allAnalysisSections;
        const query = searchQuery.toLowerCase();
        return allAnalysisSections.filter((section) => section.pluginDisplayName.toLowerCase().includes(query));
    }, [allAnalysisSections, searchQuery]);

    // Callbacks
    const toggleSection = useCallback((analysisId: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(analysisId)) next.delete(analysisId);
            else next.add(analysisId);
            return next;
        });
    }, []);

    const isSceneInActiveScenes = useCallback((scene: any) => {
        return activeScenes.some((s) => isSameScene(s, scene));
    }, [activeScenes]);

    const onSelectScene = useCallback((scene: any, analysis?: any) => {
        if (scene?.source === 'plugin' && scene?.analysisId) {
            manualSelectionRef.current = scene.analysisId;
        }
        setActiveScene(scene);
        if (analysis?._id) {
            setAnalysisId(analysis._id, { replace: true });
        }
    }, [setActiveScene, setAnalysisId]);

    const onDeleteAnalysis = useCallback(async (analysisId: string) => {
        await showPromise(
            deleteAnalysisUseCase.execute({ id: analysisId }),
            {
                loading: { title: 'Deleting analysis...' },
                success: { title: 'Analysis deleted successfully' },
                error: { title: 'Failed to delete analysis' }
            }
        );
        setAnalyses(prev => prev.filter((analysis) => analysis._id !== analysisId));
        if (analysisConfigId === analysisId) {
            setAnalysisId(undefined, { replace: true });
        }
    }, [analysisConfigId, setAnalysisId, deleteAnalysisUseCase]);

    const setHeaderPopoverOpen = useCallback((analysisId: string, isOpen: boolean) => {
        setHeaderPopoverStates(prev => {
            const next = new Map(prev);
            next.set(analysisId, isOpen);
            return next;
        });
    }, []);

    // Computed: header popover callbacks
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
        // State
        trajectoryId,
        searchQuery,
        setSearchQuery,
        expandedSections,
        bootstrapLoading,
        analyses,
        headerPopoverStates,

        // Computed
        filteredSections,
        differingConfigByAnalysis,
        showSectionsSkeleton,
        headerPopoverCallbacks,

        // Scene actions
        activeScene,
        addScene,
        removeScene,
        onSelectScene,
        isSceneInActiveScenes,

        // Section actions
        toggleSection,
        onDeleteAnalysis,
        isAnalysisInProgress
    };
};

export default useCanvasSidebarScene;
