import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TbObjectScan } from 'react-icons/tb';
import { MdKeyboardArrowDown, MdKeyboardArrowRight } from 'react-icons/md';
import CanvasSidebarOption from '@/components/atoms/scene/CanvasSidebarOption';
import useModelStore from '@/stores/editor/model';
import type { Trajectory } from '@/types/models';
import usePluginStore, { type RenderableExposure } from '@/stores/plugins/plugin';
import './CanvasSidebarScene.css';
import DynamicIcon from '@/components/atoms/common/DynamicIcon';
import useAnalysisConfigStore from '@/stores/analysis-config';
import { Skeleton } from '@mui/material';
import Container from '@/components/primitives/Container';
import Paragraph from '@/components/primitives/Paragraph';

interface CanvasSidebarSceneProps {
    trajectory?: Trajectory | null;
}

interface AnalysisSection {
    analysisId: string;
    pluginName: string;
    exposures: RenderableExposure[];
    isCurrentAnalysis: boolean;
}

const CanvasSidebarScene: React.FC<CanvasSidebarSceneProps> = ({ trajectory }) => {
    const setActiveScene = useModelStore((state) => state.setActiveScene);
    const activeScene = useModelStore((state) => state.activeScene);
    const getRenderableExposures = usePluginStore((state) => state.getRenderableExposures);
    const getModifiers = usePluginStore((state) => state.getModifiers);
    const analysisConfig = useAnalysisConfigStore((state) => state.analysisConfig);
    const updateAnalysisConfig = useAnalysisConfigStore((state) => state.updateAnalysisConfig);

    const [allExposures, setAllExposures] = useState<RenderableExposure[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

    const analysisConfigId = analysisConfig?._id;
    const activeSceneRef = useRef(activeScene);

    useEffect(() => {
        activeSceneRef.current = activeScene;
    }, [activeScene]);

    // Load exposures for ALL analyses
    useEffect(() => {
        if (!trajectory?._id || !trajectory.analysis || trajectory.analysis.length === 0) {
            setLoading(false);
            setAllExposures([]);
            return;
        }

        const loadAllExposures = async () => {
            setLoading(true);
            try {
                const exposurePromises = trajectory.analysis.map((analysis: any) =>
                    getRenderableExposures(trajectory._id, analysis._id, 'canvas', analysis.plugin)
                );
                const results = await Promise.all(exposurePromises);
                setAllExposures(results.flat());
            } catch (error) {
                console.error('Failed to load plugin exposures:', error);
            } finally {
                setLoading(false);
            }
        };

        loadAllExposures();
    }, [trajectory?._id, trajectory?.analysis, getRenderableExposures]);

    // Group exposures by analysis
    const analysisSections = useMemo((): AnalysisSection[] => {
        if (!trajectory?.analysis) return [];

        const modifiers = getModifiers();
        const sections: AnalysisSection[] = [];

        for (const analysis of trajectory.analysis) {
            const analysisExposures = allExposures.filter(e => e.analysisId === analysis._id);
            const modifier = modifiers.find(m => m.pluginSlug === analysis.plugin);

            sections.push({
                analysisId: analysis._id,
                pluginName: modifier?.name || analysis.plugin || 'Unknown',
                exposures: analysisExposures,
                isCurrentAnalysis: analysis._id === analysisConfigId
            });
        }

        // Sort: current analysis first, then others
        return sections.sort((a, b) => {
            if (a.isCurrentAnalysis) return -1;
            if (b.isCurrentAnalysis) return 1;
            return 0;
        });
    }, [trajectory?.analysis, allExposures, analysisConfigId, getModifiers]);

    // Auto-expand current analysis section
    useEffect(() => {
        if (analysisConfigId) {
            setExpandedSections(prev => new Set([...prev, analysisConfigId]));
        }
    }, [analysisConfigId]);

    useEffect(() => {
        if (loading || !analysisConfigId) return;
        const currentScene = activeSceneRef.current;
        if (!currentScene || currentScene.source !== 'plugin') return;
        if (currentScene.analysisId === analysisConfigId) return;

        const currentExposures = allExposures.filter(e => e.analysisId === analysisConfigId);
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
    }, [analysisConfigId, loading, allExposures, setActiveScene]);

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

    const selectAnalysis = (analysis: any) => {
        updateAnalysisConfig(analysis);
        setExpandedSections(prev => new Set([...prev, analysis._id]));
    };

    const onSelect = (option: any, analysis?: any) => {
        if (analysis) {
            updateAnalysisConfig(analysis);
        }
        setActiveScene(option.sceneType);
    };

    const defaultOptions = [{
        Icon: TbObjectScan,
        title: 'Frame Atoms',
        sceneType: { sceneType: 'trajectory', source: 'default' }
    }];

    return (
        <div className='editor-sidebar-scene-container'>
            <div className='editor-sidebar-scene-options-container d-flex gap-1 column'>
                {/* Default Options - Always visible */}
                {defaultOptions.map((option, index) => (
                    <div key={`${option.sceneType.source}-${option.sceneType.sceneType}-${index}`}>
                        <CanvasSidebarOption
                            onSelect={() => onSelect(option)}
                            activeOption={false}
                            isLoading={false}
                            option={{
                                Icon: option.Icon,
                                title: option.title,
                                modifierId: ''
                            }}
                        />
                    </div>
                ))}

                {loading && (
                    Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton
                            key={`plugin-exposure-skeleton-${index}`}
                            variant="rounded"
                            height={48}
                            sx={{ width: '100%', mb: 1.5, borderRadius: 2 }}
                        />
                    ))
                )}

                {/* Analysis Sections */}
                {!loading && analysisSections.map((section) => {
                    const isExpanded = expandedSections.has(section.analysisId);
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
                                    className={`analysis-section-title font-size-2 ${section.isCurrentAnalysis ? 'color-accent' : 'color-secondary'}`}
                                >
                                    {section.pluginName}
                                    {section.isCurrentAnalysis && ' (Active)'}
                                </Paragraph>
                            </Container>

                            {isExpanded && section.exposures.length > 0 && (
                                <Container className='analysis-section-content d-flex column gap-05'>
                                    {section.exposures.map((exposure, index) => (
                                        <div key={`${exposure.exposureId}-${index}`}>
                                            <CanvasSidebarOption
                                                onSelect={() => onSelect({
                                                    sceneType: {
                                                        sceneType: exposure.exposureId,
                                                        source: 'plugin',
                                                        analysisId: exposure.analysisId,
                                                        exposureId: exposure.exposureId
                                                    }
                                                }, analysis)}
                                                activeOption={false}
                                                isLoading={false}
                                                option={{
                                                    Icon: () => <DynamicIcon iconName={exposure.icon!} />,
                                                    title: exposure.name || exposure.exposureId,
                                                    modifierId: exposure.modifierId || ''
                                                }}
                                            />
                                        </div>
                                    ))}
                                </Container>
                            )}

                            {isExpanded && section.exposures.length === 0 && (
                                <Paragraph className='analysis-section-empty color-muted font-size-1 pl-2'>
                                    No visualizations available
                                </Paragraph>
                            )}
                        </Container>
                    );
                })}
            </div>
        </div>
    );
};

export default CanvasSidebarScene;

