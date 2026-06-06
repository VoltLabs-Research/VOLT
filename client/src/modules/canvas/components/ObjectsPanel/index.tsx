import { isArtifactSceneActive, toSceneObjectFromArtifact } from '@/modules/canvas/utilities/scene-identity';
import { getSceneKey } from '@/modules/fractal/utilities/scene-utils';
import useAnalysisActivityTone from '../../hooks/use-analysis-activity-tone';
import useAnalysisStatus from '../../hooks/use-analysis-status';
import useCanvasSidebarState from '../../hooks/use-canvas-sidebar-state';
import useSceneArtifacts from '../../hooks/use-scene-artifacts';
import SceneCollection from '../SceneCollection';
import {
    CanvasTreeEmptyRow,
    CanvasTreeRow,
    MaybeContextMenu
} from '../CanvasTree';
import {
    buildAddRemoveOption,
    buildTransparencySubmenu,
    transparencyOption
} from '../../utilities/tree-menus';
import { formatArtifactLabel, pruneExpandedTimesteps } from './artifact-labels';

import { ChevronDown, ChevronRight, Filter, Layers, Palette, Wrench } from 'lucide-react';
import type { ComponentProps, ComponentType, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '@/shared/presentation/primitives/Button';
import CollapsibleSection from '@/shared/presentation/primitives/CollapsibleSection';
import Stack from '@/shared/presentation/primitives/Stack';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import useCanvasUrlState, { CanvasWorkspace } from '@/modules/canvas/hooks/use-canvas-url-state';
import { useShallow } from 'zustand/react/shallow';

import type { MenuOption } from '@/shared/presentation/types/menu';
import type { SceneArtifact } from '@/modules/trajectory/api/entities/scene-artifacts/scene-artifact';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory/trajectory';
import type { RasterContainerSelection, RasterSelectableScene } from '@/modules/raster/types/container-selection';
import type { CanvasPanelActionProps } from '../canvas-panel-props';

import './ObjectsPanel.css';

interface ObjectsPanelProps extends CanvasPanelActionProps {
    trajectory: Trajectory | null | undefined;
    pluginsContent?: ReactNode;
    mode?: 'default' | 'analysis-compact';
}

const PANEL_ICON_COLOR = 'var(--color-text-secondary)';
const TREE_MODIFIER_ICON_SIZE = 12;
const TREE_MODIFIER_ICON_COLOR = 'var(--accent-blue)';
const TIMESTEP_PAGE_SIZE = 50;
const TOUR_SELECT_ANALYSIS_EVENT = 'canvas-analysis-tour:select-first-analysis';

const CONTEXT_MENU_ID_PREFIX = {
    colorCoding: 'canvas-ctx-color-coding',
    particleFilter: 'canvas-ctx-particle-filter'
} as const;

const COLLAPSIBLE_PRESET = {
    className: 'canvas-right-dropdown',
    headerClassName: 'canvas-right-dropdown-header d-flex items-center gap-05',
    titleClassName: 'canvas-right-dropdown-title font-size-05 color-muted',
    iconClassName: 'canvas-right-dropdown-icon',
    bodyClassName: 'canvas-right-dropdown-body',
    contentClassName: 'd-flex column',
    noSpacing: true,
    arrowSize: 13,
    useDefaultHeaderStyles: false,
    useDefaultTitleStyles: false
} as const;

interface RightCollapsibleProps {
    title: string;
    icon?: ReactNode;
    expanded: boolean;
    onExpandedChange: (next: boolean) => void;
    headerAction?: ReactNode;
    children: ReactNode;
    extraClassName?: string;
    collapsible?: boolean;
    tourId?: string;
}

const RightCollapsible = ({ title, icon, expanded, onExpandedChange, headerAction, children, extraClassName, collapsible = true, tourId }: RightCollapsibleProps) => (
    <div data-tour-id={tourId}>
        <CollapsibleSection
            {...COLLAPSIBLE_PRESET}
            className={`${COLLAPSIBLE_PRESET.className} ${extraClassName ?? ''}`}
            title={title}
            icon={icon}
            expanded={expanded}
            onExpandedChange={onExpandedChange}
            headerAction={headerAction}
            collapsible={collapsible}
        >
            {children}
        </CollapsibleSection>
    </div>
);

const ObjectsPanel = ({
    trajectory,
    onDownloadAnalysis,
    onDownloadExposureListing,
    rasterContainerSelections = [],
    activeRasterContainerId = 'container-1',
    onSetActiveRasterContainer,
    onUpdateRasterContainerSelection,
    pluginsContent,
    mode = 'default'
}: ObjectsPanelProps) => {
    const [sceneCollectionOpen, setSceneCollectionOpen] = useState(true);
    const [selectedTimestepAnalysisOpen, setSelectedTimestepAnalysisOpen] = useState(true);
    const [pluginsOpen, setPluginsOpen] = useState(true);
    const [colorCodingOpen, setColorCodingOpen] = useState(false);
    const [particleFilterOpen, setParticleFilterOpen] = useState(false);
    const [expandedColorCodingTimesteps, setExpandedColorCodingTimesteps] = useState<Set<number>>(new Set());
    const [expandedParticleFilterTimesteps, setExpandedParticleFilterTimesteps] = useState<Set<number>>(new Set());
    const [colorCodingVisibleCount, setColorCodingVisibleCount] = useState(TIMESTEP_PAGE_SIZE);
    const [particleFilterVisibleCount, setParticleFilterVisibleCount] = useState(TIMESTEP_PAGE_SIZE);
    const { activeWorkspace } = useCanvasUrlState();
    const isRasterWorkspace = activeWorkspace === CanvasWorkspace.Raster;
    const isAnalysisCompact = mode === 'analysis-compact';

    const {
        sceneCollectionSections,
        selectedTimestepSections,
        expandedSections,
        toggleSection,
        showSectionsSkeleton,
        activeScene,
        onSelectScene,
        isSceneInActiveScenes,
        addScene,
        removeScene,
        onDeleteAnalysis,
        onRetryLoadExposures,
        sceneCollectionTotalAnalyses,
        selectedTimestepTotalAnalyses,
        hasSelectedTimestepAnalyses
    } = useCanvasSidebarState({ trajectory, trajectoryId: trajectory?._id });

    const { statusMap } = useAnalysisStatus({ trajectoryId: trajectory?._id, enabled: !!trajectory?._id });
    const { toneByAnalysisId } = useAnalysisActivityTone(statusMap);

    const {
        isLoading: sceneArtifactsLoading,
        colorCodingArtifacts,
        particleFilterArtifacts
    } = useSceneArtifacts({ trajectoryId: trajectory?._id });

    const particleFilterTimesteps = useMemo(() => {
        return [...new Set(particleFilterArtifacts.map((artifact) => artifact.timestep))].sort((left, right) => right - left);
    }, [particleFilterArtifacts]);

    const colorCodingTimesteps = useMemo(() => {
        return [...new Set(colorCodingArtifacts.map((artifact) => artifact.timestep))].sort((left, right) => right - left);
    }, [colorCodingArtifacts]);

    const {
        showSimulationCell,
        setShowSimulationCell,
        sceneVisualOverrides,
        setSceneOpacity,
        setSceneLineWidth,
        setCurrentTimestep
    } = useEditorStore(useShallow((s) => ({
        showSimulationCell: s.showSimulationCell,
        setShowSimulationCell: s.setShowSimulationCell,
        sceneVisualOverrides: s.sceneVisualOverrides,
        setSceneOpacity: s.setSceneOpacity,
        setSceneLineWidth: s.setSceneLineWidth,
        setCurrentTimestep: s.setCurrentTimestep
    })));

    const handleToggleSimulationCell = useCallback(() => {
        setShowSimulationCell(!showSimulationCell);
    }, [setShowSimulationCell, showSimulationCell]);

    const syncArtifactTimestep = useCallback((artifact: SceneArtifact) => {
        setCurrentTimestep(artifact.timestep);
    }, [setCurrentTimestep]);

    const getFirstTourSection = useCallback(() => {
        return sceneCollectionSections[0] ?? selectedTimestepSections[0];
    }, [sceneCollectionSections, selectedTimestepSections]);

    const selectFirstTourAnalysis = useCallback(() => {
        const section = getFirstTourSection();
        if (!section) {
            return;
        }

        if (!expandedSections.has(section.analysis._id)) {
            toggleSection(section.analysis._id);
        }

        onRetryLoadExposures?.(section.analysis._id);

        if (activeScene?.source === 'plugin' && activeScene.analysisId === section.analysis._id) {
            return;
        }

        if (section.isCurrentAnalysis) {
            return;
        }

        onSelectScene({ sceneType: 'trajectory', source: 'default' as const }, section.analysis);
    }, [activeScene, expandedSections, getFirstTourSection, onRetryLoadExposures, onSelectScene, toggleSection]);

    useEffect(() => {
        window.addEventListener(TOUR_SELECT_ANALYSIS_EVENT, selectFirstTourAnalysis);

        return () => {
            window.removeEventListener(TOUR_SELECT_ANALYSIS_EVENT, selectFirstTourAnalysis);
        };
    }, [selectFirstTourAnalysis]);

    useEffect(() => {
        setExpandedParticleFilterTimesteps((current) => pruneExpandedTimesteps(current, particleFilterTimesteps));
    }, [particleFilterTimesteps]);

    useEffect(() => {
        setExpandedColorCodingTimesteps((current) => pruneExpandedTimesteps(current, colorCodingTimesteps));
    }, [colorCodingTimesteps]);

    useEffect(() => {
        const onArtifactsChanged = (event: Event) => {
            const { source, timestep } = (event as CustomEvent<{ source?: string; timestep?: number }>).detail ?? {};
            if (source !== 'color-coding' || timestep === undefined) return;
            setColorCodingOpen(true);
            setExpandedColorCodingTimesteps((current) => {
                if (current.has(timestep)) return current;
                return new Set([...current, timestep]);
            });
        };

        window.addEventListener('canvas:scene-artifacts:changed', onArtifactsChanged);
        return () => {
            window.removeEventListener('canvas:scene-artifacts:changed', onArtifactsChanged);
        };
    }, []);

    const handleSelectRasterScene = useCallback((scene: RasterSelectableScene, label: string) => {
        if (!onUpdateRasterContainerSelection) return;
        const model = scene.source === 'plugin' ? scene.exposureId : undefined;
        onUpdateRasterContainerSelection(activeRasterContainerId, { scene, label, model });
    }, [activeRasterContainerId, onUpdateRasterContainerSelection]);

    const sharedSceneCollectionProps: Partial<ComponentProps<typeof SceneCollection>> = useMemo(() => ({
        expandedSections,
        toggleSection,
        showSectionsSkeleton,
        activeScene,
        onSelectScene,
        isSceneInActiveScenes,
        addScene,
        removeScene,
        statusMap,
        toneByAnalysisId,
        onDeleteAnalysis,
        onDownloadAnalysis: onDownloadAnalysis ?? (() => undefined),
        onDownloadExposureListing,
        onRetryLoadExposures,
        sceneVisualOverrides,
        setSceneOpacity,
        setSceneLineWidth
    }), [
        activeScene,
        addScene,
        expandedSections,
        isSceneInActiveScenes,
        onDeleteAnalysis,
        onDownloadAnalysis,
        onDownloadExposureListing,
        onRetryLoadExposures,
        onSelectScene,
        removeScene,
        sceneVisualOverrides,
        setSceneLineWidth,
        setSceneOpacity,
        showSectionsSkeleton,
        statusMap,
        toneByAnalysisId,
        toggleSection
    ]);

    const renderRasterContainerPanel = useCallback((selection: RasterContainerSelection) => {
        const isActive = selection.id === activeRasterContainerId;

        return (
            <RightCollapsible
                key={selection.id}
                title={selection.title}
                icon={<Layers style={{ width: 13, height: 13, color: PANEL_ICON_COLOR }} />}
                expanded={isActive}
                onExpandedChange={(next) => { if (next) onSetActiveRasterContainer?.(selection.id); }}
                extraClassName={isActive ? 'canvas-raster-container-panel--active' : ''}
                headerAction={(
                    <Button
                        variant='ghost'
                        size='sm'
                        shape='pill'
                        className={`canvas-raster-container-panel__summary ${isActive ? 'is-active' : ''}`}
                        onClick={() => onSetActiveRasterContainer?.(selection.id)}
                    >
                        {selection.label}
                    </Button>
                )}
            >
                {isActive && (
                    <SceneCollection
                        {...(sharedSceneCollectionProps as ComponentProps<typeof SceneCollection>)}
                        filteredSections={sceneCollectionSections}
                        totalAnalyses={sceneCollectionTotalAnalyses}
                        showSimulationCell={showSimulationCell}
                        onToggleSimulationCell={handleToggleSimulationCell}
                        selectionMode="raster"
                        selectedScene={selection.scene}
                        onSelectRasterScene={handleSelectRasterScene}
                    />
                )}
            </RightCollapsible>
        );
    }, [
        activeRasterContainerId,
        handleSelectRasterScene,
        handleToggleSimulationCell,
        onSetActiveRasterContainer,
        sceneCollectionSections,
        sceneCollectionTotalAnalyses,
        sharedSceneCollectionProps,
        showSimulationCell
    ]);

    const getArtifactMenuOptions = useCallback((artifact: SceneArtifact): MenuOption[] => {
        const scene = toSceneObjectFromArtifact(artifact);
        if (!scene) return [];

        const isActive = isSceneInActiveScenes(scene);
        const sceneKey = getSceneKey(scene);
        const currentOpacity = sceneVisualOverrides[sceneKey]?.opacity ?? 1;
        const artifactLabel = formatArtifactLabel(artifact);

        return [
            buildAddRemoveOption({
                isActive,
                onAdd: () => { syncArtifactTimestep(artifact); addScene(scene); },
                onRemove: () => removeScene(scene)
            }),
            transparencyOption(buildTransparencySubmenu(artifactLabel, currentOpacity, (value) => setSceneOpacity(sceneKey, value)))
        ];
    }, [isSceneInActiveScenes, sceneVisualOverrides, addScene, removeScene, setSceneOpacity, syncArtifactTimestep]);

    const renderArtifactTreeItem = useCallback((
        artifact: SceneArtifact,
        Icon: ComponentType<{ style?: React.CSSProperties }>,
        menuIdPrefix: string
    ) => {
        const scene = toSceneObjectFromArtifact(artifact);
        const isActive = isArtifactSceneActive(activeScene, artifact);
        const artifactLabel = formatArtifactLabel(artifact);

        const trigger = (
            <CanvasTreeRow
                indent='lg'
                isActive={isActive}
                icon={<Icon style={{ width: TREE_MODIFIER_ICON_SIZE, height: TREE_MODIFIER_ICON_SIZE, color: TREE_MODIFIER_ICON_COLOR }} />}
                label={artifactLabel}
                onClick={() => {
                    if (!scene) return;
                    syncArtifactTimestep(artifact);
                    onSelectScene(scene);
                }}
            />
        );

        return (
            <MaybeContextMenu
                key={artifact._id}
                enabled={!!scene}
                id={`${menuIdPrefix}-${artifact._id}`}
                options={getArtifactMenuOptions(artifact)}
            >
                {trigger}
            </MaybeContextMenu>
        );
    }, [activeScene, getArtifactMenuOptions, onSelectScene, syncArtifactTimestep]);

    const toggleExpandedTimestep = (
        setter: React.Dispatch<React.SetStateAction<Set<number>>>,
        timestep: number
    ): void => setter((current) => {
        const next = new Set(current);
        if (next.has(timestep)) next.delete(timestep);
        else next.add(timestep);
        return next;
    });

    const toggleParticleFilterTimestep = useCallback(
        (timestep: number) => toggleExpandedTimestep(setExpandedParticleFilterTimesteps, timestep),
        []
    );
    const toggleColorCodingTimestep = useCallback(
        (timestep: number) => toggleExpandedTimestep(setExpandedColorCodingTimesteps, timestep),
        []
    );

    const artifactsByTimestep = useMemo(() => {
        const colorIndex = new Map<number, SceneArtifact[]>();
        colorCodingArtifacts.forEach((artifact) => {
            const list = colorIndex.get(artifact.timestep);
            if (list) list.push(artifact);
            else colorIndex.set(artifact.timestep, [artifact]);
        });
        const particleIndex = new Map<number, SceneArtifact[]>();
        particleFilterArtifacts.forEach((artifact) => {
            const list = particleIndex.get(artifact.timestep);
            if (list) list.push(artifact);
            else particleIndex.set(artifact.timestep, [artifact]);
        });
        return { colorIndex, particleIndex };
    }, [colorCodingArtifacts, particleFilterArtifacts]);

    const renderArtifactTreeSection = useCallback((params: {
        artifactsByTimestep: Map<number, SceneArtifact[]>;
        timesteps: number[];
        expandedSet: Set<number>;
        toggleTimestep: (timestep: number) => void;
        icon: ComponentType<{ style?: React.CSSProperties }>;
        menuIdPrefix: string;
        ariaLabel: string;
        visibleCount: number;
        onShowMore: () => void;
    }) => {
        const { artifactsByTimestep, timesteps, expandedSet, toggleTimestep, icon: Icon, menuIdPrefix, ariaLabel, visibleCount, onShowMore } = params;

        if (timesteps.length === 0) {
            return (
                <Stack gap='025' overflow='auto' className="canvas-tree-container" role="tree" aria-label={ariaLabel}>
                    <CanvasTreeEmptyRow label={sceneArtifactsLoading ? 'Loading...' : 'No models generated'} />
                </Stack>
            );
        }

        const visibleTimesteps = timesteps.slice(0, visibleCount);
        const hiddenCount = Math.max(0, timesteps.length - visibleCount);

        return (
            <Stack gap='025' overflow='auto' className="canvas-tree-container" role="tree" aria-label={ariaLabel}>
                {visibleTimesteps.map((timestep) => {
                    const timestepArtifacts = artifactsByTimestep.get(timestep) ?? [];
                    const isExpanded = expandedSet.has(timestep);
                    const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;
                    const groupId = `${menuIdPrefix}-group-${timestep}`;

                    return (
                        <div key={timestep} className="canvas-tree-group" role="treeitem" aria-expanded={isExpanded} aria-level={1}>
                            <Button
                                variant='ghost'
                                size='sm'
                                align='start'
                                block
                                id={groupId}
                                className='canvas-tree-group-header gap-05'
                                onClick={() => toggleTimestep(timestep)}
                                aria-expanded={isExpanded}
                                aria-controls={isExpanded ? `${groupId}-children` : undefined}
                            >
                                <ChevronIcon className={`canvas-tree-group-chevron ${isExpanded ? '' : 'collapsed'}`} style={{ width: 13, height: 13 }} />
                                <span className="canvas-tree-item__text">{timestep}</span>
                                <span className="canvas-tree-group-count">{timestepArtifacts.length}</span>
                            </Button>

                            {isExpanded && (
                                <div id={`${groupId}-children`} role="group">
                                    {timestepArtifacts.map((artifact) => renderArtifactTreeItem(artifact, Icon, menuIdPrefix))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {hiddenCount > 0 && (
                    <Button
                        variant='ghost'
                        size='sm'
                        className='canvas-tree-show-more font-size-05 color-secondary'
                        onClick={onShowMore}
                    >
                        Show {Math.min(TIMESTEP_PAGE_SIZE, hiddenCount)} more timesteps ({hiddenCount} hidden)
                    </Button>
                )}
            </Stack>
        );
    }, [renderArtifactTreeItem, sceneArtifactsLoading]);

    if (isAnalysisCompact) {
        const hasAnalyses = sceneCollectionSections.length > 0;
        const hasColorCodingArtifacts = colorCodingArtifacts.length > 0;
        const hasParticleFilterArtifacts = particleFilterArtifacts.length > 0;
        const compactSectionCount = (hasAnalyses ? 1 : 0)
            + (hasSelectedTimestepAnalyses ? 1 : 0)
            + (hasColorCodingArtifacts ? 1 : 0)
            + (hasParticleFilterArtifacts ? 1 : 0);

        return (
            <Stack minH='0' className="canvas-objects-panel canvas-objects-panel--analysis-compact">
                <div className="canvas-objects-panel__top">
                    {hasAnalyses && (
                        <RightCollapsible
                            title="Analyses"
                            icon={<Layers style={{ width: 13, height: 13, color: PANEL_ICON_COLOR }} />}
                            expanded={sceneCollectionOpen}
                            onExpandedChange={setSceneCollectionOpen}
                            collapsible={compactSectionCount > 1}
                            tourId="canvas-analyses-section"
                        >
                            <SceneCollection
                                {...(sharedSceneCollectionProps as ComponentProps<typeof SceneCollection>)}
                                filteredSections={sceneCollectionSections}
                                totalAnalyses={sceneCollectionTotalAnalyses}
                                showDefaultScene={false}
                                showSimulationCell={false}
                                firstAnalysisTourTargetId="canvas-first-analysis-row"
                                firstExposureTourTargetId="canvas-first-exposure-row"
                            />
                        </RightCollapsible>
                    )}

                    {hasSelectedTimestepAnalyses && (
                        <RightCollapsible
                            title="Per-timestep analyses"
                            icon={<Layers style={{ width: 13, height: 13, color: PANEL_ICON_COLOR }} />}
                            expanded={selectedTimestepAnalysisOpen}
                            onExpandedChange={setSelectedTimestepAnalysisOpen}
                            tourId="canvas-per-timestep-analyses-section"
                        >
                            <SceneCollection
                                {...(sharedSceneCollectionProps as ComponentProps<typeof SceneCollection>)}
                                filteredSections={selectedTimestepSections}
                                totalAnalyses={selectedTimestepTotalAnalyses}
                                showDefaultScene={false}
                                firstAnalysisTourTargetId="canvas-first-per-timestep-analysis-row"
                            />
                        </RightCollapsible>
                    )}

                    {hasColorCodingArtifacts && (
                        <RightCollapsible
                            title="Color Coding"
                            icon={<Palette style={{ width: 13, height: 13, color: PANEL_ICON_COLOR }} />}
                            expanded={colorCodingOpen}
                            onExpandedChange={setColorCodingOpen}
                        >
                            {renderArtifactTreeSection({
                                artifactsByTimestep: artifactsByTimestep.colorIndex,
                                timesteps: colorCodingTimesteps,
                                expandedSet: expandedColorCodingTimesteps,
                                toggleTimestep: toggleColorCodingTimestep,
                                icon: Palette,
                                menuIdPrefix: CONTEXT_MENU_ID_PREFIX.colorCoding,
                                ariaLabel: 'Color Coding hierarchy',
                                visibleCount: colorCodingVisibleCount,
                                onShowMore: () => setColorCodingVisibleCount((current) => current + TIMESTEP_PAGE_SIZE)
                            })}
                        </RightCollapsible>
                    )}

                    {hasParticleFilterArtifacts && (
                        <RightCollapsible
                            title="Particle Filter"
                            icon={<Filter style={{ width: 13, height: 13, color: PANEL_ICON_COLOR }} />}
                            expanded={particleFilterOpen}
                            onExpandedChange={setParticleFilterOpen}
                        >
                            {renderArtifactTreeSection({
                                artifactsByTimestep: artifactsByTimestep.particleIndex,
                                timesteps: particleFilterTimesteps,
                                expandedSet: expandedParticleFilterTimesteps,
                                toggleTimestep: toggleParticleFilterTimestep,
                                icon: Filter,
                                menuIdPrefix: CONTEXT_MENU_ID_PREFIX.particleFilter,
                                ariaLabel: 'Particle Filter hierarchy',
                                visibleCount: particleFilterVisibleCount,
                                onShowMore: () => setParticleFilterVisibleCount((current) => current + TIMESTEP_PAGE_SIZE)
                            })}
                        </RightCollapsible>
                    )}
                </div>
            </Stack>
        );
    }

    return (
        <Stack minH='0' className="canvas-objects-panel">
            <div className="canvas-objects-panel__top">
                <RightCollapsible
                    title="Scene Collection"
                    icon={<Layers style={{ width: 13, height: 13, color: PANEL_ICON_COLOR }} />}
                    expanded={sceneCollectionOpen}
                    onExpandedChange={setSceneCollectionOpen}
                    tourId="canvas-analyses-section"
                >
                    {isRasterWorkspace ? (
                        <Stack gap='05' className="canvas-raster-container-panels">
                            {rasterContainerSelections.map(renderRasterContainerPanel)}
                        </Stack>
                    ) : (
                        <SceneCollection
                            {...(sharedSceneCollectionProps as ComponentProps<typeof SceneCollection>)}
                            filteredSections={sceneCollectionSections}
                            totalAnalyses={sceneCollectionTotalAnalyses}
                            showSimulationCell={showSimulationCell}
                            onToggleSimulationCell={handleToggleSimulationCell}
                            firstAnalysisTourTargetId="canvas-first-analysis-row"
                            firstExposureTourTargetId="canvas-first-exposure-row"
                        />
                    )}
                </RightCollapsible>

                {!isRasterWorkspace && hasSelectedTimestepAnalyses && (
                    <RightCollapsible
                        title="Timestep-scoped analyses"
                        icon={<Layers style={{ width: 13, height: 13, color: PANEL_ICON_COLOR }} />}
                        expanded={selectedTimestepAnalysisOpen}
                        onExpandedChange={setSelectedTimestepAnalysisOpen}
                        tourId="canvas-per-timestep-analyses-section"
                    >
                        <SceneCollection
                            {...(sharedSceneCollectionProps as ComponentProps<typeof SceneCollection>)}
                            filteredSections={selectedTimestepSections}
                            totalAnalyses={selectedTimestepTotalAnalyses}
                            showDefaultScene={false}
                            firstAnalysisTourTargetId="canvas-first-per-timestep-analysis-row"
                        />
                    </RightCollapsible>
                )}

                {pluginsContent && (
                    <RightCollapsible
                        title="Plugins"
                        icon={<Wrench style={{ width: 13, height: 13, color: PANEL_ICON_COLOR }} />}
                        expanded={pluginsOpen}
                        onExpandedChange={setPluginsOpen}
                    >
                        {pluginsContent}
                    </RightCollapsible>
                )}
            </div>

            <div className="canvas-objects-panel__bottom">
                <RightCollapsible
                    title="Color Coding"
                    icon={<Palette style={{ width: 13, height: 13, color: PANEL_ICON_COLOR }} />}
                    expanded={colorCodingOpen}
                    onExpandedChange={setColorCodingOpen}
                >
                    {renderArtifactTreeSection({
                        artifactsByTimestep: artifactsByTimestep.colorIndex,
                        timesteps: colorCodingTimesteps,
                        expandedSet: expandedColorCodingTimesteps,
                        toggleTimestep: toggleColorCodingTimestep,
                        icon: Palette,
                        menuIdPrefix: CONTEXT_MENU_ID_PREFIX.colorCoding,
                        ariaLabel: 'Color Coding hierarchy',
                        visibleCount: colorCodingVisibleCount,
                        onShowMore: () => setColorCodingVisibleCount((current) => current + TIMESTEP_PAGE_SIZE)
                    })}
                </RightCollapsible>

                <RightCollapsible
                    title="Particle Filter"
                    icon={<Filter style={{ width: 13, height: 13, color: PANEL_ICON_COLOR }} />}
                    expanded={particleFilterOpen}
                    onExpandedChange={setParticleFilterOpen}
                >
                    {renderArtifactTreeSection({
                        artifactsByTimestep: artifactsByTimestep.particleIndex,
                        timesteps: particleFilterTimesteps,
                        expandedSet: expandedParticleFilterTimesteps,
                        toggleTimestep: toggleParticleFilterTimestep,
                        icon: Filter,
                        menuIdPrefix: CONTEXT_MENU_ID_PREFIX.particleFilter,
                        ariaLabel: 'Particle Filter hierarchy',
                        visibleCount: particleFilterVisibleCount,
                        onShowMore: () => setParticleFilterVisibleCount((current) => current + TIMESTEP_PAGE_SIZE)
                    })}
                </RightCollapsible>
            </div>
        </Stack>
    );
};

export default ObjectsPanel;
