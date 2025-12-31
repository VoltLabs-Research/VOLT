import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceToNow, formatDuration } from 'date-fns';
import { TbObjectScan, TbSearch } from 'react-icons/tb';
import { MdKeyboardArrowDown, MdKeyboardArrowRight } from 'react-icons/md';
import CanvasSidebarOption from '@/components/atoms/scene/CanvasSidebarOption';
import { useEditorStore } from '@/stores/slices/editor';
import type { Analysis, Trajectory } from '@/types/models';
import { usePluginStore, type RenderableExposure, type ResolvedModifier } from '@/stores/slices/plugin/plugin-slice';
import DynamicIcon from '@/components/atoms/common/DynamicIcon';
import { useAnalysisConfigStore } from '@/stores/slices/analysis';
import { Skeleton } from '@mui/material';
import Container from '@/components/primitives/Container';
import Paragraph from '@/components/primitives/Paragraph';
import Popover from '@/components/molecules/common/Popover';
import PopoverMenuItem from '@/components/atoms/common/PopoverMenuItem';
import CursorTooltip from '@/components/atoms/common/CursorTooltip';
import Title from '@/components/primitives/Title';
import './CanvasSidebarScene.css';

interface CanvasSidebarSceneProps {
    trajectory?: Trajectory | null;
}

interface AnalysisSection {
    analysis: Analysis;
    plugin: ResolvedModifier | null;
    exposures: RenderableExposure[];
    isCurrentAnalysis: boolean;
    config: Record<string, any>;
}

/**
 * For analyses of the same plugin, find which config keys have different values.
 * Returns a map of analysisId -> array of [key, value] pairs that differ.
 */
const computeDifferingConfigFields = (
    analyses: { _id: string; plugin: string; config: Record<string, any> }[]
): Map<string, [string, any][]> => {
    const result = new Map<string, [string, any][]>();

    // Group analyses by plugin
    const byPlugin = new Map<string, typeof analyses>();
    for (const analysis of analyses) {
        const existing = byPlugin.get(analysis.plugin) || [];
        existing.push(analysis);
        byPlugin.set(analysis.plugin, existing);
    }

    // For each plugin group, find differing keys
    for (const [, pluginAnalyses] of byPlugin) {
        if (pluginAnalyses.length <= 1) {
            // Only one analysis for this plugin - show all config if present
            for (const analysis of pluginAnalyses) {
                const entries = Object.entries(analysis.config || {});
                if (entries.length > 0) {
                    result.set(analysis._id, entries);
                }
            }
            continue;
        }

        // Multiple analyses - find which keys differ
        const allKeys = new Set<string>();
        for (const analysis of pluginAnalyses) {
            Object.keys(analysis.config || {}).forEach(k => allKeys.add(k));
        }

        const differingKeys = new Set<string>();
        for (const key of allKeys) {
            const values = pluginAnalyses.map(a => JSON.stringify(a.config?.[key]));
            const uniqueValues = new Set(values);
            if (uniqueValues.size > 1) {
                differingKeys.add(key);
            }
        }

        // For each analysis, store only the differing fields
        for (const analysis of pluginAnalyses) {
            const differingEntries: [string, any][] = [];
            for (const key of differingKeys) {
                if (analysis.config && key in analysis.config) {
                    differingEntries.push([key, analysis.config[key]]);
                }
            }
            if (differingEntries.length > 0) {
                result.set(analysis._id, differingEntries);
            }
        }
    }

    return result;
};

/**
 * Format config value for display
 */
const formatConfigValue = (value: any): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return `[${value.length}]`;
    if (typeof value === 'object') return '{...}';
    return String(value);
};

/**
 * Build a map of argument key -> label from plugin arguments
 */
const buildArgumentLabelMap = (
    pluginSlug: string,
    getPluginArguments: (slug: string) => { argument: string; label: string }[]
): Map<string, string> => {
    const labelMap = new Map<string, string>();
    const args = getPluginArguments(pluginSlug);
    for (const arg of args) {
        labelMap.set(arg.argument, arg.label);
    }
    return labelMap;
};

const CanvasSidebarScene: React.FC<CanvasSidebarSceneProps> = ({ trajectory }) => {
    const setActiveScene = useEditorStore((state) => state.setActiveScene);
    const activeScene = useEditorStore((state) => state.activeScene);
    const addScene = useEditorStore((state) => state.addScene);
    const removeScene = useEditorStore((state) => state.removeScene);
    const activeScenes = useEditorStore((state) => state.activeScenes);

    const getRenderableExposures = usePluginStore((state) => state.getRenderableExposures);
    const getModifiers = usePluginStore((state) => state.getModifiers);
    const getPluginArguments = usePluginStore((state) => state.getPluginArguments);
    const analysisConfig = useAnalysisConfigStore((state) => state.analysisConfig);
    const updateAnalysisConfig = useAnalysisConfigStore((state) => state.updateAnalysisConfig);

    const [exposuresByAnalysis, setExposuresByAnalysis] = useState<Map<string, RenderableExposure[]>>(new Map());
    const [loadingAnalyses, setLoadingAnalyses] = useState<Set<string>>(new Set());
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    // Tooltip state for analysis section hover
    const [tooltipOpen, setTooltipOpen] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [tooltipAnalysis, setTooltipAnalysis] = useState<any | null>(null);

    const analysisConfigId = analysisConfig?._id;
    const activeSceneRef = useRef(activeScene);

    useEffect(() => {
        activeSceneRef.current = activeScene;
    }, [activeScene]);

    useEffect(() => {
        console.log('---------------------------------------_>', analysisConfig)
    }, [analysisConfig]);

    // Build analysis sections from trajectory (data already loaded in trajectory object)
    const allAnalysisSections = useMemo((): AnalysisSection[] => {
        if (!trajectory?.analysis) return [];

        const modifiers = getModifiers();
        const sections: AnalysisSection[] = [];

        for (const analysis of trajectory.analysis) {
            const modifier = modifiers.find(m => m.plugin.slug === analysis.plugin);
            const exposures = exposuresByAnalysis.get(analysis._id) || [];

            sections.push({
                analysis,
                plugin: modifier || null,
                exposures,
                isCurrentAnalysis: analysis._id === analysisConfigId,
                config: analysis.config || {}
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
            (s.plugin?.name || s.analysis.plugin || '').toLowerCase().includes(query)
        );
    }, [allAnalysisSections, searchQuery]);

    // Compute differing config fields for analyses of the same plugin
    const differingConfigByAnalysis = useMemo(() => {
        if (!trajectory?.analysis) return new Map<string, [string, any][]>();
        return computeDifferingConfigFields(trajectory.analysis);
    }, [trajectory?.analysis]);

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
                    const isExpanded = expandedSections.has(section.analysis._id);
                    const isLoading = loadingAnalyses.has(section.analysis._id);
                    const analysis = trajectory?.analysis?.find((a: any) => a._id === section.analysis._id);
                    const differingFields = differingConfigByAnalysis.get(section.analysis._id) || [];

                    // Build label map for this plugin to show labels instead of keys
                    const labelMap = buildArgumentLabelMap(section.plugin?.plugin.slug || section.analysis.plugin || '', getPluginArguments);
                    const configDescription = differingFields
                        .map(([key, value]) => `${labelMap.get(key) || key}: ${formatConfigValue(value)}`)
                        .join(', ');

                    return (
                        <Container key={section.analysis._id} className='analysis-section'>
                            <Container
                                className='analysis-section-header d-flex column cursor-pointer'
                                onClick={() => toggleSection(section.analysis._id)}
                                onMouseEnter={(e: React.MouseEvent) => {
                                    const rect = (e.currentTarget as Element).getBoundingClientRect();
                                    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                                    const durationMs = section.analysis.finishedAt && section.analysis.startedAt
                                        ? new Date(section.analysis.finishedAt).getTime() - new Date(section.analysis.startedAt).getTime()
                                        : null;
                                    setTooltipAnalysis({ ...section, duration: durationMs });
                                    setTooltipOpen(true);
                                }}
                                onMouseLeave={() => {
                                    setTooltipOpen(false);
                                    setTooltipAnalysis(null);
                                }}
                                onMouseMove={(e: React.MouseEvent) => {
                                    setTooltipPos({ x: e.clientX, y: e.clientY });
                                }}
                            >
                                <Container className='d-flex items-center gap-05'>
                                    <i className='analysis-section-arrow'>
                                        {isExpanded ? <MdKeyboardArrowDown /> : <MdKeyboardArrowRight />}
                                    </i>
                                    <Paragraph
                                        className={`analysis-section-title font-size-2 ${section.isCurrentAnalysis ? 'color-gray' : 'color-secondary'}`}
                                    >
                                        {section.plugin?.name || 'Unknown'}
                                        {section.isCurrentAnalysis && ' (Active)'}
                                        {analysis?.createdAt && (
                                            <span className='analysis-section-date'>
                                                {' • '}{formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })}
                                            </span>
                                        )}
                                    </Paragraph>
                                </Container>
                                {configDescription && (
                                    <Paragraph className='analysis-section-description color-tertiary font-size-1'>
                                        {configDescription}
                                    </Paragraph>
                                )}
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
                                                    id={`exposure-option-menu-${section.analysis._id}-${index}`}
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

            <CursorTooltip
                isOpen={tooltipOpen}
                x={tooltipPos.x}
                y={tooltipPos.y}
                content={
                    tooltipAnalysis && (
                        <Container className='analysis-tooltip-content'>
                            <Container className='analysis-tooltip-header-container d-flex column gap-05'>
                                <Title className='font-weight-4 font-size-3 d-flex gap-05'>
                                    <span>{tooltipAnalysis.plugin?.name}</span>
                                    {tooltipAnalysis.duration != null && (
                                        <span className='color-muted'> • {formatDuration({ seconds: Math.floor(tooltipAnalysis.duration / 1000) })}</span>
                                    )}
                                </Title>
                                <Paragraph className='color-tertiary font-size-1'>
                                    {tooltipAnalysis.plugin?.plugin?.modifier?.description}
                                </Paragraph>
                            </Container>

                            {/* Two tables side by side */}
                            <Container className='analysis-tooltip-tables d-flex gap-2'>
                                {/* Config fields */}
                                {tooltipAnalysis.config && Object.keys(tooltipAnalysis.config).length > 0 && (
                                    <Container className='analysis-tooltip-grid'>
                                        {Object.entries(tooltipAnalysis.config).map(([key, value]) => {
                                            const argDef = tooltipAnalysis.plugin?.plugin?.arguments?.find(
                                                (arg: any) => arg.argument === key
                                            );
                                            const label = argDef?.label || key;

                                            return (
                                                <React.Fragment key={key}>
                                                    <span className='color-muted font-size-1'>{label}</span>
                                                    <span className='color-secondary font-size-1 font-weight-5'>
                                                        {formatConfigValue(value)}
                                                    </span>
                                                </React.Fragment>
                                            );
                                        })}
                                    </Container>
                                )}

                                {/* Metadata */}
                                <Container className='analysis-tooltip-grid'>
                                    <span className='color-muted font-size-1'>Exposures</span>
                                    <span className='color-secondary font-size-1 font-weight-5'>
                                        {tooltipAnalysis.exposures?.length || 0}
                                    </span>
                                    <span className='color-muted font-size-1'>Completed Frames</span>
                                    <span className='color-secondary font-size-1 font-weight-5'>
                                        {tooltipAnalysis.analysis.completedFrames}
                                    </span>
                                    {tooltipAnalysis.analysis.clusterId && (
                                        <>
                                            <span className='color-muted font-size-1'>Cluster</span>
                                            <span className='color-secondary font-size-1 font-weight-5'>
                                                {tooltipAnalysis.analysis.clusterId}
                                            </span>
                                        </>
                                    )}
                                    <span className='color-muted font-size-1'>Created</span>
                                    <span className='color-secondary font-size-1 font-weight-5'>
                                        {formatDistanceToNow(new Date(tooltipAnalysis.analysis.createdAt), { addSuffix: true })}
                                    </span>
                                </Container>
                            </Container>
                        </Container>
                    )
                }
            />
        </div>
    );
};

export default CanvasSidebarScene;
