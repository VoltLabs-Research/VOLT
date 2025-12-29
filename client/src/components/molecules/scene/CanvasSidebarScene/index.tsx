import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TbObjectScan, TbSearch } from 'react-icons/tb';
import { MdKeyboardArrowDown, MdKeyboardArrowRight } from 'react-icons/md';
import CanvasSidebarOption from '@/components/atoms/scene/CanvasSidebarOption';
import { useEditorStore } from '@/stores/slices/editor';
import type { Trajectory } from '@/types/models';
import { usePluginStore, type RenderableExposure } from '@/stores/slices/plugin/plugin-slice';
import './CanvasSidebarScene.css';
import DynamicIcon from '@/components/atoms/common/DynamicIcon';
import { useAnalysisConfigStore } from '@/stores/slices/analysis';
import { Skeleton } from '@mui/material';
import Container from '@/components/primitives/Container';
import Paragraph from '@/components/primitives/Paragraph';
import Popover from '@/components/molecules/common/Popover';
import PopoverMenuItem from '@/components/atoms/common/PopoverMenuItem';
import { RiMore2Fill } from 'react-icons/ri';

interface CanvasSidebarSceneProps {
    trajectory?: Trajectory | null;
}

interface AnalysisSection {
    analysisId: string;
    pluginName: string;
    plugin: string;
    exposures: RenderableExposure[];
    isCurrentAnalysis: boolean;
}

const CanvasSidebarScene: React.FC<CanvasSidebarSceneProps> = ({ trajectory }) => {
    const setActiveScene = useEditorStore((state) => state.setActiveScene);
    const activeScene = useEditorStore((state) => state.activeScene);
    const addScene = useEditorStore((state) => state.addScene);
    const removeScene = useEditorStore((state) => state.removeScene);
    const activeScenes = useEditorStore((state) => state.activeScenes);

    const getRenderableExposures = usePluginStore((state) => state.getRenderableExposures);
    const getModifiers = usePluginStore((state) => state.getModifiers);
    const analysisConfig = useAnalysisConfigStore((state) => state.analysisConfig);
    const updateAnalysisConfig = useAnalysisConfigStore((state) => state.updateAnalysisConfig);

    const [exposuresByAnalysis, setExposuresByAnalysis] = useState<Map<string, RenderableExposure[]>>(new Map());
    const [loadingAnalyses, setLoadingAnalyses] = useState<Set<string>>(new Set());
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');



    const analysisConfigId = analysisConfig?._id;
    const activeSceneRef = useRef(activeScene);

    useEffect(() => {
        activeSceneRef.current = activeScene;
    }, [activeScene]);

    // Build analysis sections from trajectory (data already loaded in trajectory object)
    const allAnalysisSections = useMemo((): AnalysisSection[] => {
        if (!trajectory?.analysis) return [];

        const modifiers = getModifiers();
        const sections: AnalysisSection[] = [];

        for (const analysis of trajectory.analysis) {
            const modifier = modifiers.find(m => m.pluginSlug === analysis.plugin);
            const exposures = exposuresByAnalysis.get(analysis._id) || [];

            sections.push({
                analysisId: analysis._id,
                pluginName: modifier?.name || analysis.plugin || 'Unknown',
                plugin: analysis.plugin,
                exposures,
                isCurrentAnalysis: analysis._id === analysisConfigId
            });
        }

        // Sort: current analysis first, then others
        return sections.sort((a, b) => {
            if (a.isCurrentAnalysis) return -1;
            if (b.isCurrentAnalysis) return 1;
            return 0;
        });
    }, [trajectory?.analysis, exposuresByAnalysis, analysisConfigId, getModifiers]);

    // Filter by search query (client-side filtering since data is already loaded)
    const filteredSections = useMemo(() => {
        if (!searchQuery.trim()) return allAnalysisSections;
        const query = searchQuery.toLowerCase();
        return allAnalysisSections.filter(s =>
            s.pluginName.toLowerCase().includes(query)
        );
    }, [allAnalysisSections, searchQuery]);

    // Load exposures for a specific analysis (this is the actual server call)
    const loadExposuresForAnalysis = useCallback(async (analysisId: string, plugin: string) => {
        if (exposuresByAnalysis.has(analysisId) || loadingAnalyses.has(analysisId)) return;

        setLoadingAnalyses(prev => new Set([...prev, analysisId]));
        try {
            const exposures = await getRenderableExposures(
                trajectory!._id,
                analysisId,
                'canvas',
                plugin
            );
            setExposuresByAnalysis(prev => {
                const next = new Map(prev);
                next.set(analysisId, exposures);
                return next;
            });
        } catch (error) {
            console.error('Failed to load exposures for analysis:', analysisId, error);
        } finally {
            setLoadingAnalyses(prev => {
                const next = new Set(prev);
                next.delete(analysisId);
                return next;
            });
        }
    }, [trajectory, getRenderableExposures, exposuresByAnalysis, loadingAnalyses]);

    // Auto-load exposures for current analysis
    useEffect(() => {
        if (!analysisConfigId || !trajectory?.analysis) return;
        const analysis = trajectory.analysis.find((a: any) => a._id === analysisConfigId);
        if (analysis) {
            loadExposuresForAnalysis(analysisConfigId, analysis.plugin);
        }
    }, [analysisConfigId, trajectory?.analysis, loadExposuresForAnalysis]);

    // Auto-expand current analysis section
    useEffect(() => {
        if (analysisConfigId) {
            setExpandedSections(prev => new Set([...prev, analysisConfigId]));
        }
    }, [analysisConfigId]);

    // Load exposures when section is expanded (lazy loading - server call)
    useEffect(() => {
        if (!trajectory?.analysis) return;

        for (const analysisId of expandedSections) {
            const analysis = trajectory.analysis.find((a: any) => a._id === analysisId);
            if (analysis && !exposuresByAnalysis.has(analysisId)) {
                loadExposuresForAnalysis(analysisId, analysis.plugin);
            }
        }
    }, [expandedSections, trajectory?.analysis, exposuresByAnalysis, loadExposuresForAnalysis]);

    // Update active scene when analysis changes
    useEffect(() => {
        if (!analysisConfigId) return;
        const currentScene = activeSceneRef.current;
        if (!currentScene || currentScene.source !== 'plugin') return;
        if (currentScene.analysisId === analysisConfigId) return;

        const currentExposures = exposuresByAnalysis.get(analysisConfigId) || [];
        const matchingExposure = currentExposures.find(
            (exposure) => exposure.exposureId === currentScene.sceneType
        );

        if (matchingExposure) {
            setActiveScene({
                sceneType: matchingExposure.exposureId,
                source: 'plugin',
                analysisId: matchingExposure.analysisId,
                exposureId: matchingExposure.exposureId
            });
            return;
        }

        if (currentExposures.length > 0) {
            const nextExposure = currentExposures[0];
            setActiveScene({
                sceneType: nextExposure.exposureId,
                source: 'plugin',
                analysisId: nextExposure.analysisId,
                exposureId: nextExposure.exposureId
            });
            return;
        }

        setActiveScene({ sceneType: 'trajectory', source: 'default' });
    }, [analysisConfigId, exposuresByAnalysis, setActiveScene]);

    const toggleSection = (analysisId: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(analysisId)) {
                next.delete(analysisId);
            } else {
                next.add(analysisId);
            }
            return next;
        });
    };

    const onSelect = (option: any, analysis?: any) => {
        console.log('[CanvasSidebarScene] onSelect called:', { option, analysis, sceneType: option?.sceneType });
        if (analysis) {
            updateAnalysisConfig(analysis);
        }
        setActiveScene(option.sceneType);
    };



    const getSceneObjectFromOption = (option: any) => {
        return option.sceneType || {
            sceneType: option.exposureId,
            source: 'plugin',
            analysisId: option.analysisId,
            exposureId: option.exposureId
        };
    };

    const isOptionInScene = (option: any) => {
        const target = getSceneObjectFromOption(option);

        return activeScenes.some(s =>
            s.sceneType === target.sceneType &&
            s.source === target.source &&
            (s as any).analysisId === (target as any).analysisId &&
            (s as any).exposureId === (target as any).exposureId
        );
    };

    const defaultOptions = [{
        Icon: TbObjectScan,
        title: 'Frame Atoms',
        sceneType: { sceneType: 'trajectory', source: 'default' as const }
    }];

    const totalAnalyses = trajectory?.analysis?.length || 0;

    return (
        <div className='editor-sidebar-scene-container'>
            <div className='editor-sidebar-scene-options-container d-flex gap-1 column'>
                {/* Default Options - Always visible */}
                {defaultOptions.map((option, index) => (
                    <div
                        key={`${option.sceneType.source}-${option.sceneType.sceneType}-${index}`}
                    >
                        <Popover
                            id={`default-option-menu-${index}`}
                            triggerAction="contextmenu"
                            trigger={
                                <CanvasSidebarOption
                                    onSelect={() => onSelect(option)}
                                    activeOption={isOptionInScene(option)}
                                    isLoading={false}
                                    option={{
                                        Icon: option.Icon,
                                        title: option.title,
                                        modifierId: ''
                                    }}
                                />
                            }
                        >
                            <PopoverMenuItem
                                onClick={() => addScene(option.sceneType)}
                                disabled={isOptionInScene(option)}
                            >
                                Add to scene
                            </PopoverMenuItem>
                            <PopoverMenuItem
                                onClick={() => removeScene(option.sceneType)}
                                disabled={!isOptionInScene(option)}
                            >
                                Remove from scene
                            </PopoverMenuItem>
                        </Popover>
                    </div>
                ))}

                {/* Search Input */}
                {totalAnalyses > 0 && (
                    <Container className='analysis-search-container'>
                        <Container className='analysis-search-input-wrapper d-flex items-center gap-05'>
                            <TbSearch className='analysis-search-icon' />
                            <input
                                type='text'
                                className='analysis-search-input'
                                placeholder='Search analyses...'
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </Container>
                    </Container>
                )}

                {/* Analysis Sections */}
                {filteredSections.map((section) => {
                    const isExpanded = expandedSections.has(section.analysisId);
                    const isLoading = loadingAnalyses.has(section.analysisId);
                    const analysis = trajectory?.analysis?.find((a: any) => a._id === section.analysisId);

                    return (
                        <Container key={section.analysisId} className='analysis-section'>
                            <Container
                                className='analysis-section-header d-flex items-center gap-05 cursor-pointer'
                                onClick={() => toggleSection(section.analysisId)}
                            >
                                <i className='analysis-section-arrow'>
                                    {isExpanded ? <MdKeyboardArrowDown /> : <MdKeyboardArrowRight />}
                                </i>
                                <Paragraph
                                    className={`analysis-section-title font-size-2 ${section.isCurrentAnalysis ? 'color-gray' : 'color-secondary'}`}
                                >
                                    {section.pluginName}
                                    {section.isCurrentAnalysis && ' (Active)'}
                                </Paragraph>
                            </Container>

                            {isExpanded && isLoading && (
                                <Container className='analysis-section-content'>
                                    <Skeleton variant="rounded" height={40} sx={{ borderRadius: 1 }} />
                                </Container>
                            )}

                            {isExpanded && !isLoading && section.exposures.length > 0 && (
                                <Container className='analysis-section-content d-flex column gap-05'>
                                    {section.exposures.map((exposure, index) => {
                                        const optionObj = {
                                            sceneType: {
                                                sceneType: exposure.exposureId,
                                                source: 'plugin' as const,
                                                analysisId: exposure.analysisId,
                                                exposureId: exposure.exposureId
                                            }
                                        };
                                        const sceneObject = optionObj.sceneType;

                                        return (
                                            <div
                                                key={`${exposure.exposureId}-${index}`}
                                            >
                                                <Popover
                                                    id={`exposure-option-menu-${section.analysisId}-${index}`}
                                                    triggerAction="contextmenu"
                                                    trigger={
                                                        <CanvasSidebarOption
                                                            onSelect={() => onSelect(optionObj, analysis)}
                                                            activeOption={isOptionInScene(optionObj)}
                                                            isLoading={false}
                                                            option={{
                                                                Icon: () => <DynamicIcon iconName={exposure.icon!} />,
                                                                title: exposure.name || exposure.exposureId,
                                                                modifierId: exposure.modifierId || ''
                                                            }}
                                                        />
                                                    }
                                                >
                                                    <PopoverMenuItem
                                                        onClick={() => {
                                                            console.log('[CanvasSidebarScene] addScene called:', { sceneObject, analysis });
                                                            if (analysis) updateAnalysisConfig(analysis);
                                                            addScene(sceneObject);
                                                        }}
                                                        disabled={isOptionInScene(optionObj)}
                                                    >
                                                        Add to scene
                                                    </PopoverMenuItem>
                                                    <PopoverMenuItem
                                                        onClick={() => removeScene(sceneObject)}
                                                        disabled={!isOptionInScene(optionObj)}
                                                    >
                                                        Remove from scene
                                                    </PopoverMenuItem>
                                                </Popover>
                                            </div>
                                        )
                                    })}
                                </Container>
                            )}

                            {isExpanded && !isLoading && section.exposures.length === 0 && (
                                <Paragraph className='analysis-section-empty color-muted font-size-1 pl-2'>
                                    No visualizations available
                                </Paragraph>
                            )}
                        </Container>
                    );
                })}

                {/* Empty state when search has no results */}
                {searchQuery && filteredSections.length === 0 && (
                    <Paragraph className='color-muted font-size-1 text-center p-1'>
                        No analyses match your search
                    </Paragraph>
                )}
            </div>


        </div>
    );
};

export default CanvasSidebarScene;
