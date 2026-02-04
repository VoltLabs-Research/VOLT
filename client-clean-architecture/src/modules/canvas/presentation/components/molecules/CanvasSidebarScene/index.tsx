import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Paragraph from '@/shared/presentation/components/Paragraph';
import CursorTooltip from '@/shared/presentation/components/CursorTooltip';

import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import usePluginStore, { type RenderableExposure, type ResolvedModifier } from '@/modules/plugin/presentation/stores/use-plugin-store';
import useAnalysisConfigStore from '@/modules/canvas/presentation/stores/use-analysis-config-store';
import useAnalysisStatus from '@/modules/canvas/presentation/hooks/use-analysis-status';
import useAnalysisUseCases from '@/modules/analysis/presentation/hooks/use-analysis-use-cases';
import useSocket from '@/modules/socket/presentation/hooks/use-socket';
import type { Analysis } from '@/modules/analysis/domain/entities/Analysis';
import type { Plugin } from '@/modules/plugin/domain/entities';

import '@/modules/canvas/presentation/components/molecules/CanvasSidebarScene/CanvasSidebarScene.css';
import { computeDifferingConfigFields, DEFAULT_ENTRY } from '@/modules/canvas/presentation/components/molecules/CanvasSidebarScene/utils';

import AnalysisSearchInput from '@/modules/canvas/presentation/components/atoms/AnalysisSearchInput';
import BootstrapSkeleton from '@/modules/canvas/presentation/components/atoms/BootstrapSkeleton';
import DefaultSceneOption from '@/modules/canvas/presentation/components/molecules/DefaultSceneOption';
import AnalysisTooltipContent from '@/modules/canvas/presentation/components/molecules/AnalysisTooltipContent';
import AnalysisSection from '@/modules/canvas/presentation/components/organisms/AnalysisSection';
import useToast from '@/shared/presentation/hooks/use-toast';

interface CanvasSidebarSceneProps {
    trajectory?: any | null;
    trajectoryId?: string;
}

type ExposureLoadState = 'idle' | 'loading' | 'loaded' | 'error';

type ExposureEntry = {
    state: ExposureLoadState;
    exposures: RenderableExposure[];
    error?: unknown;
};

interface AnalysisSectionData {
    analysis: Analysis;
    pluginSlug: string;
    plugin: ResolvedModifier;
    pluginDisplayName: string;
    entry: ExposureEntry;
    isCurrentAnalysis: boolean;
    config: Record<string, any>;
}

const CanvasSidebarScene: React.FC<CanvasSidebarSceneProps> = ({ trajectory, trajectoryId: propTrajectoryId }) => {
    const socketService = useSocket();
    const { getAnalysesByTrajectoryUseCase, deleteAnalysisUseCase } = useAnalysisUseCases();

    const setActiveScene = useEditorStore((s) => s.setActiveScene);
    const activeScene = useEditorStore((s) => s.activeScene);
    const addScene = useEditorStore((s) => s.addScene);
    const removeScene = useEditorStore((s) => s.removeScene);
    const activeScenes = useEditorStore((s) => s.activeScenes);

    const getRenderableExposures = usePluginStore((s) => s.getRenderableExposures);
    const getModifiers = usePluginStore((s) => s.getModifiers);
    const pluginsBySlug = usePluginStore((s) => s.pluginsBySlug);

    const analysisConfig = useAnalysisConfigStore((s) => s.analysisConfig);
    const updateAnalysisConfig = useAnalysisConfigStore((s) => s.updateAnalysisConfig);
    const analysisConfigId = analysisConfig?._id;

    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [bootstrapLoading, setBootstrapLoading] = useState(true);
    const [analyses, setAnalyses] = useState<Analysis[]>([]);

    const [exposureEntries, setExposureEntries] = useState<Map<string, ExposureEntry>>(new Map());
    const exposureEntriesRef = useRef(exposureEntries);
    useEffect(() => { exposureEntriesRef.current = exposureEntries; }, [exposureEntries]);

    const getEntryLatest = useCallback((analysisId: string): ExposureEntry => {
        return exposureEntriesRef.current.get(analysisId) ?? DEFAULT_ENTRY;
    }, []);

    const setEntry = useCallback((analysisId: string, next: ExposureEntry) => {
        setExposureEntries(prev => {
            const map = new Map(prev);
            map.set(analysisId, next);
            return map;
        });
    }, []);

    const [tooltipOpen, setTooltipOpen] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [tooltipAnalysis, setTooltipAnalysis] = useState<any | null>(null);
    const [headerPopoverStates, setHeaderPopoverStates] = useState<Map<string, boolean>>(new Map());

    const activeSceneRef = useRef(activeScene);
    useEffect(() => { activeSceneRef.current = activeScene; }, [activeScene]);

    const manualSelectionRef = useRef<string | null>(null);

    const trajectoryId = propTrajectoryId || trajectory?._id;

    const { isAnalysisInProgress } = useAnalysisStatus({ trajectoryId, enabled: !!trajectoryId });
    const { showSuccess } = useToast();

    useEffect(() => {
        setExpandedSections(new Set());
        setSearchQuery('');
        setTooltipOpen(false);
        setTooltipAnalysis(null);
        setHeaderPopoverStates(new Map());
        setExposureEntries(new Map());
        setBootstrapLoading(true);
        setAnalyses([]);
    }, [trajectoryId]);

    useEffect(() => {
        let cancelled = false;

        const bootstrap = async () => {
            setBootstrapLoading(true);

            try {
                if (!trajectoryId) {
                    if (!cancelled) setBootstrapLoading(false);
                    return;
                }

                const response = await getAnalysesByTrajectoryUseCase.execute({
                    trajectoryId,
                    page: 1,
                    limit: 100
                });
                const fetchedRaw = response.data || [];

                if (cancelled) return;

                const pluginsToRegister: Plugin[] = [];
                const normalizedAnalyses: Analysis[] = [];

                fetchedRaw.forEach((item: any) => {
                    const props = item?.props ? item.props : item;
                    const id = item?.id || item?._id;

                    let pluginSlug = '';

                    if (props.plugin && typeof props.plugin === 'object') {
                        pluginsToRegister.push(props.plugin as Plugin);
                        pluginSlug = props.plugin.slug;
                    } else if (typeof props.plugin === 'string') {
                        pluginSlug = props.plugin;
                    }

                    normalizedAnalyses.push({
                        ...props,
                        _id: id,
                        plugin: pluginSlug,
                        config: props.config || {}
                    });
                });

                if (pluginsToRegister.length > 0) {
                    usePluginStore.getState().registerPlugins(pluginsToRegister);
                }

                setAnalyses(normalizedAnalyses);

                if (normalizedAnalyses.length === 0) {
                    setBootstrapLoading(false);
                    return;
                }
            } catch (error) {
                console.error('[CanvasSidebarScene] bootstrap failed', error);
            } finally {
                if (!cancelled) setBootstrapLoading(false);
            }
        };

        bootstrap();
        return () => { cancelled = true; };
    }, [trajectoryId, getAnalysesByTrajectoryUseCase]);

    useEffect(() => {
        if (!trajectoryId) return;

        const handleAnalysisCreated = (data: any) => {
            if (data.trajectoryId !== trajectoryId) return;

            const newAnalysis: Analysis = {
                _id: data.analysisId,
                plugin: data.pluginSlug,
                config: data.config || {},
                trajectory: data.trajectoryId,
                totalFrames: data.totalFrames ?? 0,
                completedFrames: data.completedFrames ?? 0,
                status: data.status || 'pending',
                createdAt: data.createdAt,
                updatedAt: data.createdAt
            } as any;

            setAnalyses(prev => {
                if (prev.some(a => a._id === newAnalysis._id)) return prev;
                return [newAnalysis, ...prev];
            });
        };

        const unsubscribe = socketService.on('analysis.created', handleAnalysisCreated);
        return () => {
            unsubscribe();
        };
    }, [trajectoryId, socketService]);

    const differingConfigByAnalysis = useMemo(() => {
        if (analyses.length === 0) return new Map<string, [string, any][]>();
        return computeDifferingConfigFields(analyses as any);
    }, [analyses]);

    const loadExposuresForAnalysis = useCallback(async (analysisId: string, pluginSlug: string) => {
        if (!trajectoryId) return;

        const current = getEntryLatest(analysisId);
        if (current.state === 'loading' || current.state === 'loaded') return;

        if (!pluginsBySlug[pluginSlug]) return;

        setEntry(analysisId, { state: 'loading', exposures: [] });

        try {
            const exposures = await getRenderableExposures(trajectoryId, analysisId, 'canvas', pluginSlug);
            setEntry(analysisId, { state: 'loaded', exposures });
        } catch (error) {
            console.error('[CanvasSidebarScene] exposures fetch failed', analysisId, error);
            setEntry(analysisId, { state: 'error', exposures: [], error });
        }
    }, [trajectoryId, getRenderableExposures, getEntryLatest, setEntry, pluginsBySlug]);

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
        loadExposuresForAnalysis(analysis._id, analysis.plugin as string);
    }, [analysisConfigId, analyses, loadExposuresForAnalysis]);

    useEffect(() => {
        if (analyses.length === 0) return;
        expandedSections.forEach((analysisId) => {
            const analysis = analyses.find((x) => x._id === analysisId);
            if (!analysis) return;
            const entry = getEntryLatest(analysisId);
            if (entry.state === 'idle' || entry.state === 'error') {
                loadExposuresForAnalysis(analysisId, analysis.plugin as string);
            }
        });
    }, [expandedSections, analyses, getEntryLatest, loadExposuresForAnalysis]);

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

        const entry = getEntryLatest(analysisConfigId);
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
    }, [analysisConfigId, getEntryLatest, setActiveScene]);

    const toggleSection = useCallback((analysisId: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(analysisId)) next.delete(analysisId);
            else next.add(analysisId);
            return next;
        });
    }, []);

    const isSceneInActiveScenes = useCallback((scene: any) => {
        return activeScenes.some((s) =>
            s.sceneType === scene.sceneType &&
            s.source === scene.source &&
            (s as any).analysisId === (scene as any).analysisId &&
            (s as any).exposureId === (scene as any).exposureId
        );
    }, [activeScenes]);

    const onSelectScene = useCallback((scene: any, analysis?: any) => {
        if (scene?.source === 'plugin' && scene?.analysisId) {
            manualSelectionRef.current = scene.analysisId;
        }
        setActiveScene(scene);
        if (analysis) {
            updateAnalysisConfig(analysis);
        }
    }, [updateAnalysisConfig, setActiveScene]);

    const onDeleteAnalysis = useCallback(async (analysisId: string) => {
        await deleteAnalysisUseCase.execute({ id: analysisId });
        setAnalyses(prev => prev.filter((analysis) => analysis._id !== analysisId));
        if (analysisConfigId === analysisId) {
            updateAnalysisConfig(null);
        }
        showSuccess('Analysis deleted successfully');
    }, [analysisConfigId, updateAnalysisConfig, deleteAnalysisUseCase, showSuccess]);

    const totalAnalyses = analyses.length || 0;

    const allAnalysisSections = useMemo((): AnalysisSectionData[] => {
        if (analyses.length === 0) return [];

        const modifiers = getModifiers();

        const neededSlugs = new Set(analyses.map((analysis) => analysis.plugin as string));
        const modifierBySlug = new Map(modifiers.map((modifier) => [modifier.pluginSlug, modifier]));

        for (const slug of neededSlugs) {
            const modifier = modifierBySlug.get(slug);
            if (!modifier || !modifier.name || modifier.name === slug) {
                return [];
            }
        }

        const sections = analyses.map((analysis) => {
            const modifier = modifierBySlug.get(analysis.plugin as string)!;
            const entry = exposureEntries.get(analysis._id) ?? DEFAULT_ENTRY;

            return {
                analysis,
                pluginSlug: analysis.plugin as string,
                plugin: modifier,
                pluginDisplayName: modifier.name,
                entry,
                isCurrentAnalysis: analysis._id === analysisConfigId,
                config: analysis.config || {}
            };
        });

        return sections.sort((a, b) => (a.isCurrentAnalysis ? -1 : b.isCurrentAnalysis ? 1 : 0));
    }, [analyses, getModifiers, exposureEntries, analysisConfigId]);

    const filteredSections = useMemo(() => {
        if (!searchQuery.trim()) return allAnalysisSections;
        const query = searchQuery.toLowerCase();
        return allAnalysisSections.filter((section) => section.pluginDisplayName.toLowerCase().includes(query));
    }, [allAnalysisSections, searchQuery]);

    const headerPopoverCallbacks = useMemo(() => {
        const map = new Map<string, (isOpen: boolean) => void>();
        filteredSections.forEach((section) => {
            map.set(section.analysis._id, (isOpen: boolean) => {
                setHeaderPopoverStates(prev => {
                    const next = new Map(prev);
                    next.set(section.analysis._id, isOpen);
                    return next;
                });
                if (isOpen) {
                    setTooltipOpen(false);
                    setTooltipAnalysis(null);
                }
            });
        });
        return map;
    }, [filteredSections]);

    const showSectionsSkeleton = bootstrapLoading || (totalAnalyses > 0 && allAnalysisSections.length === 0);

    return (
        <div className='editor-sidebar-scene-container p-1-5'>
            <div className='editor-sidebar-scene-options-container d-flex gap-1 column'>
                <DefaultSceneOption
                    onSelect={onSelectScene}
                    onAdd={addScene}
                    onRemove={removeScene}
                    isSceneActive={isSceneInActiveScenes}
                />

                {totalAnalyses > 0 && (
                    <AnalysisSearchInput value={searchQuery} onChange={setSearchQuery} />
                )}

                {showSectionsSkeleton && (
                    <BootstrapSkeleton count={totalAnalyses} />
                )}

                {!showSectionsSkeleton && filteredSections.map((section) => (
                    <AnalysisSection
                        key={section.analysis._id}
                        section={section}
                        trajectoryId={trajectoryId!}
                        isExpanded={expandedSections.has(section.analysis._id)}
                        onToggle={toggleSection}
                        differingFields={differingConfigByAnalysis.get(section.analysis._id) || []}
                        headerPopoverCallbacks={headerPopoverCallbacks}
                        headerPopoverStates={headerPopoverStates}
                        onSelectScene={onSelectScene}
                        onAddScene={addScene}
                        onRemoveScene={removeScene}
                        isSceneActive={isSceneInActiveScenes}
                        activeScene={activeScene}
                        updateAnalysisConfig={updateAnalysisConfig}
                        onDelete={onDeleteAnalysis}
                        isInProgress={isAnalysisInProgress(section.analysis._id)}
                    />
                ))}

                {!showSectionsSkeleton && searchQuery && filteredSections.length === 0 && (
                    <Paragraph className='color-muted font-size-1 text-center p-1'>
                        No analyses match your search
                    </Paragraph>
                )}
            </div>

            <CursorTooltip
                isOpen={tooltipOpen}
                x={tooltipPos.x}
                y={tooltipPos.y}
                content={<AnalysisTooltipContent analysis={tooltipAnalysis} />}
            />
        </div>
    );
};

export default CanvasSidebarScene;
