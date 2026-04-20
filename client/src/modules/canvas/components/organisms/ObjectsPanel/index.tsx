import { isArtifactSceneActive, toSceneObjectFromArtifact } from '@/modules/canvas/utilities/scene-identity';
import { getSceneKey } from '@/modules/fractal/utilities/scene-utils';
import useAnalysisStatus from '../../../hooks/use-analysis-status';
import useCanvasSidebarState from '../../../hooks/use-canvas-sidebar-state';
import useSceneArtifacts from '../../../hooks/use-scene-artifacts';
import SceneCollection from '../../molecules/SceneCollection';
import {
    CanvasTreeEmptyRow,
    CanvasTreeRow,
    MaybeContextMenu
} from '../../atoms/CanvasTree';
import {
    buildAddRemoveOption,
    buildTransparencySubmenu,
    transparencyOption
} from '../../../utilities/tree-menus';

import { ChevronDown, ChevronRight, Filter, Layers, Palette } from 'lucide-react';
import type { ComponentProps, ComponentType, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import Container from '@/shared/presentation/components/Container';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { CanvasWorkspace } from '@/modules/canvas/hooks/use-canvas-url-state';
import useCanvasUrlState from '@/modules/canvas/hooks/use-canvas-url-state';
import { useShallow } from 'zustand/react/shallow';

import type { MenuOption } from '@/shared/presentation/types/menu';
import type { SceneArtifact, SceneArtifactParticleFilterCondition } from '@/modules/trajectory/api/entities/scene-artifacts';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';
import type { RasterContainerId, RasterContainerSelection, RasterSelectableScene } from '@/modules/raster/types/container-selection';

import './ObjectsPanel.css';

interface ObjectsPanelProps {
    trajectory: Trajectory | null | undefined;
    onDownloadAnalysis?: (analysisId: string) => void | Promise<void>;
    onDownloadExposureListing?: (params: {
        pluginId: string;
        exposureId: string;
        analysisId?: string;
        trajectoryId?: string;
        exposureName?: string;
    }) => void;
    rasterContainerSelections?: RasterContainerSelection[];
    activeRasterContainerId?: RasterContainerId;
    onSetActiveRasterContainer?: (containerId: RasterContainerId) => void;
    onUpdateRasterContainerSelection?: (containerId: RasterContainerId, updates: Partial<RasterContainerSelection>) => void;
};

const PANEL_ICON_COLOR = 'var(--color-text-secondary)';
const TREE_MODIFIER_ICON_SIZE = 12;
const TREE_MODIFIER_ICON_COLOR = 'var(--accent-blue)';

const PARTICLE_FILTER_ACTION_LABELS = {
    delete: 'Delete',
    highlight: 'Color Selection'
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

const formatArtifactValue = (value: unknown): string => {
    if (typeof value !== 'number' || Number.isNaN(value)) return String(value ?? '');
    if (Number.isInteger(value)) return String(value);
    return String(Number(value.toFixed(3)));
};

const formatParticleFilterConditionLabel = (condition: SceneArtifactParticleFilterCondition | SceneArtifact['params']): string => {
    if (typeof condition.property !== 'string' || typeof condition.operator !== 'string' || condition.value === undefined) {
        return '';
    }
    return `${condition.property} ${condition.operator} ${formatArtifactValue(condition.value)}`;
};

const formatParticleFilterArtifactLabel = (artifact: SceneArtifact): string => {
    const { params, displayName } = artifact;
    const baseCondition = Array.isArray(params.conditions) && params.conditions.length > 0
        ? formatParticleFilterConditionLabel(params.conditions[0])
        : formatParticleFilterConditionLabel(params);

    if (!baseCondition) return displayName;

    const extraConditions = Array.isArray(params.conditions) && params.conditions.length > 1
        ? `+${params.conditions.length - 1} more`
        : '';
    const actionLabel = params.action ? PARTICLE_FILTER_ACTION_LABELS[params.action] ?? params.action : '';

    return [baseCondition, extraConditions, actionLabel].filter(Boolean).join(' · ');
};

const formatColorCodingArtifactLabel = (artifact: SceneArtifact): string => {
    const { params, displayName } = artifact;

    if (
        typeof params.property !== 'string'
        || params.startValue === undefined
        || params.endValue === undefined
    ) {
        return displayName;
    }

    const rangeLabel = `[${formatArtifactValue(params.startValue)}, ${formatArtifactValue(params.endValue)}]`;
    const gradientLabel = typeof params.gradient === 'string' ? params.gradient : '';

    return [params.property, rangeLabel, gradientLabel].filter(Boolean).join(' · ');
};

const formatArtifactLabel = (artifact: SceneArtifact): string => {
    if (artifact.sourceType === 'particle-filter') return formatParticleFilterArtifactLabel(artifact);
    if (artifact.sourceType === 'color-coding') return formatColorCodingArtifactLabel(artifact);
    return artifact.displayName;
};

interface RightCollapsibleProps {
    title: string;
    icon?: ReactNode;
    expanded: boolean;
    onExpandedChange: (next: boolean) => void;
    headerAction?: ReactNode;
    children: ReactNode;
    extraClassName?: string;
}

const RightCollapsible = ({ title, icon, expanded, onExpandedChange, headerAction, children, extraClassName }: RightCollapsibleProps) => (
    <CollapsibleSection
        {...COLLAPSIBLE_PRESET}
        className={`${COLLAPSIBLE_PRESET.className} ${extraClassName ?? ''}`}
        title={title}
        icon={icon}
        expanded={expanded}
        onExpandedChange={onExpandedChange}
        headerAction={headerAction}
    >
        {children}
    </CollapsibleSection>
);

const ObjectsPanel = ({
    trajectory,
    onDownloadAnalysis,
    onDownloadExposureListing,
    rasterContainerSelections = [],
    activeRasterContainerId = 'container-1',
    onSetActiveRasterContainer,
    onUpdateRasterContainerSelection
}: ObjectsPanelProps) => {
    const [sceneCollectionOpen, setSceneCollectionOpen] = useState(true);
    const [selectedTimestepAnalysisOpen, setSelectedTimestepAnalysisOpen] = useState(true);
    const [colorCodingOpen, setColorCodingOpen] = useState(true);
    const [particleFilterOpen, setParticleFilterOpen] = useState(true);
    const [expandedColorCodingTimesteps, setExpandedColorCodingTimesteps] = useState<Set<number>>(new Set());
    const [expandedParticleFilterTimesteps, setExpandedParticleFilterTimesteps] = useState<Set<number>>(new Set());
    const { activeWorkspace } = useCanvasUrlState();
    const isRasterWorkspace = activeWorkspace === CanvasWorkspace.Raster;

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

    const handleToggleSimulationCell = () => setShowSimulationCell(!showSimulationCell);

    const syncArtifactTimestep = useCallback((artifact: SceneArtifact) => {
        setCurrentTimestep(artifact.timestep);
    }, [setCurrentTimestep]);

    useEffect(() => {
        if (particleFilterTimesteps.length === 0) {
            setExpandedParticleFilterTimesteps(new Set());
            return;
        }

        setExpandedParticleFilterTimesteps((current) => new Set([...current].filter((t) => particleFilterTimesteps.includes(t))));
    }, [particleFilterTimesteps]);

    useEffect(() => {
        if (colorCodingTimesteps.length === 0) {
            setExpandedColorCodingTimesteps(new Set());
            return;
        }

        setExpandedColorCodingTimesteps((current) => new Set([...current].filter((t) => colorCodingTimesteps.includes(t))));
    }, [colorCodingTimesteps]);

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
                    <button
                        type="button"
                        className={`canvas-raster-container-panel__summary ${isActive ? 'is-active' : ''}`}
                        onClick={() => onSetActiveRasterContainer?.(selection.id)}
                    >
                        {selection.label}
                    </button>
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

    const toggleTimestepSetter = (setter: React.Dispatch<React.SetStateAction<Set<number>>>) =>
        (timestep: number) => setter((current) => {
            const next = new Set(current);
            if (next.has(timestep)) next.delete(timestep);
            else next.add(timestep);
            return next;
        });

    const toggleParticleFilterTimestep = useCallback(toggleTimestepSetter(setExpandedParticleFilterTimesteps), []);
    const toggleColorCodingTimestep = useCallback(toggleTimestepSetter(setExpandedColorCodingTimesteps), []);

    const renderArtifactTreeSection = useCallback((params: {
        artifacts: SceneArtifact[];
        timesteps: number[];
        expandedSet: Set<number>;
        toggleTimestep: (timestep: number) => void;
        icon: ComponentType<{ style?: React.CSSProperties }>;
        menuIdPrefix: string;
        ariaLabel: string;
    }) => {
        const { artifacts, timesteps, expandedSet, toggleTimestep, icon: Icon, menuIdPrefix, ariaLabel } = params;

        if (artifacts.length === 0) {
            return (
                <Container className="canvas-tree-container overflow-auto d-flex column gap-025" role="tree" aria-label={ariaLabel}>
                    <CanvasTreeEmptyRow label={sceneArtifactsLoading ? 'Loading...' : 'No models generated'} />
                </Container>
            );
        }

        return (
            <Container className="canvas-tree-container overflow-auto d-flex column gap-025" role="tree" aria-label={ariaLabel}>
                {timesteps.map((timestep) => {
                    const timestepArtifacts = artifacts.filter((artifact) => artifact.timestep === timestep);
                    const isExpanded = expandedSet.has(timestep);
                    const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

                    return (
                        <Container key={timestep} className="canvas-tree-group">
                            <button
                                type="button"
                                className="canvas-tree-group-header d-flex items-center gap-05"
                                onClick={() => toggleTimestep(timestep)}
                                aria-expanded={isExpanded}
                            >
                                <ChevronIcon className={`canvas-tree-group-chevron ${isExpanded ? '' : 'collapsed'}`} style={{ width: 13, height: 13 }} />
                                <Icon style={{ width: TREE_MODIFIER_ICON_SIZE, height: TREE_MODIFIER_ICON_SIZE, color: TREE_MODIFIER_ICON_COLOR }} />
                                <span className="canvas-tree-item__text">{timestep}</span>
                                <span className="canvas-tree-group-count">{timestepArtifacts.length}</span>
                            </button>

                            {isExpanded && timestepArtifacts.map((artifact) => renderArtifactTreeItem(artifact, Icon, menuIdPrefix))}
                        </Container>
                    );
                })}
            </Container>
        );
    }, [renderArtifactTreeItem, sceneArtifactsLoading]);

    return (
        <Container className="canvas-objects-panel d-flex column min-h-0 overflow-auto">
            <RightCollapsible
                title="Scene Collection"
                icon={<Layers style={{ width: 13, height: 13, color: PANEL_ICON_COLOR }} />}
                expanded={sceneCollectionOpen}
                onExpandedChange={setSceneCollectionOpen}
            >
                {isRasterWorkspace ? (
                    <Container className="canvas-raster-container-panels d-flex column gap-05">
                        {rasterContainerSelections.map(renderRasterContainerPanel)}
                    </Container>
                ) : (
                    <SceneCollection
                        {...(sharedSceneCollectionProps as ComponentProps<typeof SceneCollection>)}
                        filteredSections={sceneCollectionSections}
                        totalAnalyses={sceneCollectionTotalAnalyses}
                        showSimulationCell={showSimulationCell}
                        onToggleSimulationCell={handleToggleSimulationCell}
                    />
                )}
            </RightCollapsible>

            {!isRasterWorkspace && hasSelectedTimestepAnalyses && (
                <RightCollapsible
                    title="Timestep-scoped analyses"
                    icon={<Layers style={{ width: 13, height: 13, color: PANEL_ICON_COLOR }} />}
                    expanded={selectedTimestepAnalysisOpen}
                    onExpandedChange={setSelectedTimestepAnalysisOpen}
                >
                    <SceneCollection
                        {...(sharedSceneCollectionProps as ComponentProps<typeof SceneCollection>)}
                        filteredSections={selectedTimestepSections}
                        totalAnalyses={selectedTimestepTotalAnalyses}
                        showDefaultScene={false}
                    />
                </RightCollapsible>
            )}

            <RightCollapsible
                title="Color Coding"
                icon={<Palette style={{ width: 13, height: 13, color: PANEL_ICON_COLOR }} />}
                expanded={colorCodingOpen}
                onExpandedChange={setColorCodingOpen}
            >
                {renderArtifactTreeSection({
                    artifacts: colorCodingArtifacts,
                    timesteps: colorCodingTimesteps,
                    expandedSet: expandedColorCodingTimesteps,
                    toggleTimestep: toggleColorCodingTimestep,
                    icon: Palette,
                    menuIdPrefix: 'canvas-ctx-color-coding',
                    ariaLabel: 'Color Coding hierarchy'
                })}
            </RightCollapsible>

            <RightCollapsible
                title="Particle Filter"
                icon={<Filter style={{ width: 13, height: 13, color: PANEL_ICON_COLOR }} />}
                expanded={particleFilterOpen}
                onExpandedChange={setParticleFilterOpen}
            >
                {renderArtifactTreeSection({
                    artifacts: particleFilterArtifacts,
                    timesteps: particleFilterTimesteps,
                    expandedSet: expandedParticleFilterTimesteps,
                    toggleTimestep: toggleParticleFilterTimestep,
                    icon: Filter,
                    menuIdPrefix: 'canvas-ctx-particle-filter',
                    ariaLabel: 'Particle Filter hierarchy'
                })}
            </RightCollapsible>
        </Container>
    );
};

export default ObjectsPanel;
