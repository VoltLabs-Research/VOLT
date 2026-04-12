import { isArtifactSceneActive, toSceneObjectFromArtifact } from '@/modules/canvas/utilities/scene-identity';
import CanvasSlider from '../../atoms/CanvasSlider';
import { getSceneKey } from '@/modules/fractal/utilities/scene-utils';
import useAnalysisStatus from '../../../hooks/use-analysis-status';
import useCanvasSidebarState from '../../../hooks/use-canvas-sidebar-state';
import useSceneArtifacts from '../../../hooks/use-scene-artifacts';
import SceneCollection from '../../molecules/SceneCollection';

import { ChevronDown, ChevronRight, Eye, Filter, Layers, Minus, Palette, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import Container from '@/shared/presentation/components/Container';
import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
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

const formatArtifactValue = (value: unknown): string => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return String(value ?? '');
    }

    if (Number.isInteger(value)) {
        return String(value);
    }

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

    if (!baseCondition) {
        return displayName;
    }

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
    if (artifact.sourceType === 'particle-filter') {
        return formatParticleFilterArtifactLabel(artifact);
    }

    if (artifact.sourceType === 'color-coding') {
        return formatColorCodingArtifactLabel(artifact);
    }

    return artifact.displayName;
};

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

        setExpandedParticleFilterTimesteps((current) => {
            return new Set([...current].filter((timestep) => particleFilterTimesteps.includes(timestep)));
        });
    }, [particleFilterTimesteps]);

    useEffect(() => {
        if (colorCodingTimesteps.length === 0) {
            setExpandedColorCodingTimesteps(new Set());
            return;
        }

        setExpandedColorCodingTimesteps((current) => {
            return new Set([...current].filter((timestep) => colorCodingTimesteps.includes(timestep)));
        });
    }, [colorCodingTimesteps]);

    const handleSelectRasterScene = useCallback((scene: RasterSelectableScene, label: string) => {
        if (!onUpdateRasterContainerSelection) {
            return;
        }

        const model = scene.source === 'plugin' ? scene.exposureId : undefined;

        onUpdateRasterContainerSelection(activeRasterContainerId, {
            scene,
            label,
            model
        });
    }, [activeRasterContainerId, onUpdateRasterContainerSelection]);

    const renderRasterContainerPanel = useCallback((selection: RasterContainerSelection) => {
        const isActive = selection.id === activeRasterContainerId;

        return (
            <CollapsibleSection
                key={selection.id}
                title={selection.title}
                icon={<Layers style={{ width: 13, height: 13, color: PANEL_ICON_COLOR }} />}
                expanded={isActive}
                onExpandedChange={(next) => {
                    if (next) {
                        onSetActiveRasterContainer?.(selection.id);
                    }
                }}
                className={`canvas-right-dropdown ${isActive ? 'canvas-raster-container-panel--active' : ''}`}
                headerClassName="canvas-right-dropdown-header d-flex items-center gap-05"
                titleClassName="canvas-right-dropdown-title font-size-05 color-muted"
                iconClassName="canvas-right-dropdown-icon"
                bodyClassName="canvas-right-dropdown-body"
                contentClassName="d-flex column"
                noSpacing
                useDefaultHeaderStyles={false}
                useDefaultTitleStyles={false}
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
                        filteredSections={sceneCollectionSections}
                        expandedSections={expandedSections}
                        toggleSection={toggleSection}
                        showSectionsSkeleton={showSectionsSkeleton}
                        activeScene={activeScene}
                        onSelectScene={onSelectScene}
                        isSceneInActiveScenes={isSceneInActiveScenes}
                        addScene={addScene}
                        removeScene={removeScene}
                        totalAnalyses={sceneCollectionTotalAnalyses}
                        statusMap={statusMap}
                        onDeleteAnalysis={onDeleteAnalysis}
                        onDownloadAnalysis={onDownloadAnalysis ?? (() => undefined)}
                        onDownloadExposureListing={onDownloadExposureListing}
                        showSimulationCell={showSimulationCell}
                        onToggleSimulationCell={handleToggleSimulationCell}
                        sceneVisualOverrides={sceneVisualOverrides}
                        setSceneOpacity={setSceneOpacity}
                        setSceneLineWidth={setSceneLineWidth}
                        selectionMode="raster"
                        selectedScene={selection.scene}
                        onSelectRasterScene={handleSelectRasterScene}
                    />
                )}
            </CollapsibleSection>
        );
    }, [
        activeRasterContainerId,
        activeScene,
        addScene,
        expandedSections,
        handleSelectRasterScene,
        isSceneInActiveScenes,
        onDeleteAnalysis,
        onDownloadAnalysis,
        onDownloadExposureListing,
        onSelectScene,
        onSetActiveRasterContainer,
        removeScene,
        sceneCollectionSections,
        sceneCollectionTotalAnalyses,
        sceneVisualOverrides,
        setSceneLineWidth,
        setSceneOpacity,
        showSectionsSkeleton,
        showSimulationCell,
        statusMap,
        toggleSection
    ]);

    const getArtifactMenuOptions = useCallback((artifact: SceneArtifact): MenuOption[] => {
        const scene = toSceneObjectFromArtifact(artifact);
        if (!scene) return [];

        const isActive = isSceneInActiveScenes(scene);
        const sceneKey = getSceneKey(scene);
        const currentOpacity = sceneVisualOverrides[sceneKey]?.opacity ?? 1;
        const artifactLabel = formatArtifactLabel(artifact);

        const options: MenuOption[] = [];

        if (isActive) {
            options.push({
                label: 'Remove from scene',
                icon: Minus,
                destructive: true,
                onClick: () => removeScene(scene)
            });
        } else {
            options.push({
                label: 'Add to scene',
                icon: Plus,
                onClick: () => {
                    syncArtifactTimestep(artifact);
                    addScene(scene);
                }   
            });
        }

        const transparencySubmenu = (
            <div className="context-menu-transparency glass-bg">
                <span className="context-menu-transparency__label">Transparency</span>
                <CanvasSlider
                    ariaLabel={`Adjust ${artifactLabel} transparency`}
                    min={0}
                    max={1}
                    step={0.01}
                    value={currentOpacity}
                    onChange={(value: number) => setSceneOpacity(sceneKey, value)}
                    ariaValueText={`${Math.round(currentOpacity * 100)}% opacity`}
                />
            </div>
        );

        options.push({
            label: 'Transparency',
            icon: Eye,
            submenuContent: transparencySubmenu
        });

        return options;
    }, [isSceneInActiveScenes, sceneVisualOverrides, addScene, removeScene, setSceneOpacity, syncArtifactTimestep]);

    const renderArtifactPlaceholder = useCallback((label: string) => {
        return (
            <Container className="canvas-tree-item canvas-tree-item--indent d-flex items-center gap-05 color-muted font-size-1">
                <span className="canvas-tree-spacer" />
                <span className="canvas-tree-item__text canvas-tree-item__text--muted">{label}</span>
            </Container>
        );
    }, []);

    const toggleParticleFilterTimestep = useCallback((timestep: number) => {
        setExpandedParticleFilterTimesteps((current) => {
            const next = new Set(current);

            if (next.has(timestep)) {
                next.delete(timestep);
            } else {
                next.add(timestep);
            }

            return next;
        });
    }, []);

    const toggleColorCodingTimestep = useCallback((timestep: number) => {
        setExpandedColorCodingTimesteps((current) => {
            const next = new Set(current);

            if (next.has(timestep)) {
                next.delete(timestep);
            } else {
                next.add(timestep);
            }

            return next;
        });
    }, []);

    const renderArtifactTreeItem = useCallback((artifact: SceneArtifact, icon: typeof Palette, menuIdPrefix: string, indentClassName: string = 'canvas-tree-item--indent') => {
        const scene = toSceneObjectFromArtifact(artifact);
        const isActive = isArtifactSceneActive(activeScene, artifact);
        const artifactLabel = formatArtifactLabel(artifact);
        const itemClassName = `canvas-tree-item ${indentClassName} font-size-1 d-flex items-center gap-05 color-secondary cursor-pointer u-select-none ${isActive ? 'selected' : ''}`;
        const textClassName = `canvas-tree-item__text ${isActive ? 'color-primary' : 'color-secondary'}`;
        const Icon = icon;

        const trigger = (
            <button
                className={itemClassName}
                onClick={() => {
                    if (!scene) {
                        return;
                    }

                    syncArtifactTimestep(artifact);
                    onSelectScene(scene);
                }}
                role="treeitem"
                aria-selected={isActive}
                type="button"
                title={artifactLabel}
            >
                <span className="canvas-tree-spacer" />
                <Icon style={{ width: TREE_MODIFIER_ICON_SIZE, height: TREE_MODIFIER_ICON_SIZE, color: TREE_MODIFIER_ICON_COLOR }} />
                <span className={textClassName}>{artifactLabel}</span>
            </button>
        );

        return (
            <ContextMenuPopover
                key={artifact._id}
                id={`${menuIdPrefix}-${artifact._id}`}
                trigger={trigger}
                options={getArtifactMenuOptions(artifact)}
                size='sm'
            />
        );
    }, [activeScene, getArtifactMenuOptions, onSelectScene, syncArtifactTimestep]);

    const renderParticleFilterTreeSection = useCallback(() => {
        if (sceneArtifactsLoading && particleFilterArtifacts.length === 0) {
            return (
                <Container className="canvas-tree-container overflow-auto d-flex column gap-025" role="tree" aria-label="Particle Filter hierarchy">
                    {renderArtifactPlaceholder('Loading...')}
                </Container>
            );
        }

        if (!sceneArtifactsLoading && particleFilterArtifacts.length === 0) {
            return (
                <Container className="canvas-tree-container overflow-auto d-flex column gap-025" role="tree" aria-label="Particle Filter hierarchy">
                    {renderArtifactPlaceholder('No models generated')}
                </Container>
            );
        }

        return (
            <Container className="canvas-tree-container overflow-auto d-flex column gap-025" role="tree" aria-label="Particle Filter hierarchy">
                {particleFilterTimesteps.map((timestep) => {
                    const timestepArtifacts = particleFilterArtifacts.filter((artifact) => artifact.timestep === timestep);
                    const isExpanded = expandedParticleFilterTimesteps.has(timestep);
                    const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

                    return (
                        <Container key={timestep} className="canvas-tree-group">
                            <button
                                type="button"
                                className="canvas-tree-group-header d-flex items-center gap-05"
                                onClick={() => toggleParticleFilterTimestep(timestep)}
                                aria-expanded={isExpanded}
                            >
                                <ChevronIcon className={`canvas-tree-group-chevron ${isExpanded ? '' : 'collapsed'}`} style={{ width: 13, height: 13 }} />
                                <Filter style={{ width: TREE_MODIFIER_ICON_SIZE, height: TREE_MODIFIER_ICON_SIZE, color: TREE_MODIFIER_ICON_COLOR }} />
                                <span className="canvas-tree-item__text">{timestep}</span>
                                <span className="canvas-tree-group-count">{timestepArtifacts.length}</span>
                            </button>

                            {isExpanded && timestepArtifacts.map((artifact) => renderArtifactTreeItem(
                                artifact,
                                Filter,
                                'canvas-ctx-particle-filter',
                                'canvas-tree-item--indent-lg'
                            ))}
                        </Container>
                    );
                })}
            </Container>
        );
    }, [expandedParticleFilterTimesteps, particleFilterArtifacts, particleFilterTimesteps, renderArtifactPlaceholder, renderArtifactTreeItem, sceneArtifactsLoading, toggleParticleFilterTimestep]);

    const renderColorCodingTreeSection = useCallback(() => {
        if (sceneArtifactsLoading && colorCodingArtifacts.length === 0) {
            return (
                <Container className="canvas-tree-container overflow-auto d-flex column gap-025" role="tree" aria-label="Color Coding hierarchy">
                    {renderArtifactPlaceholder('Loading...')}
                </Container>
            );
        }

        if (!sceneArtifactsLoading && colorCodingArtifacts.length === 0) {
            return (
                <Container className="canvas-tree-container overflow-auto d-flex column gap-025" role="tree" aria-label="Color Coding hierarchy">
                    {renderArtifactPlaceholder('No models generated')}
                </Container>
            );
        }

        return (
            <Container className="canvas-tree-container overflow-auto d-flex column gap-025" role="tree" aria-label="Color Coding hierarchy">
                {colorCodingTimesteps.map((timestep) => {
                    const timestepArtifacts = colorCodingArtifacts.filter((artifact) => artifact.timestep === timestep);
                    const isExpanded = expandedColorCodingTimesteps.has(timestep);
                    const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

                    return (
                        <Container key={timestep} className="canvas-tree-group">
                            <button
                                type="button"
                                className="canvas-tree-group-header d-flex items-center gap-05"
                                onClick={() => toggleColorCodingTimestep(timestep)}
                                aria-expanded={isExpanded}
                            >
                                <ChevronIcon className={`canvas-tree-group-chevron ${isExpanded ? '' : 'collapsed'}`} style={{ width: 13, height: 13 }} />
                                <Palette style={{ width: TREE_MODIFIER_ICON_SIZE, height: TREE_MODIFIER_ICON_SIZE, color: TREE_MODIFIER_ICON_COLOR }} />
                                <span className="canvas-tree-item__text">{timestep}</span>
                                <span className="canvas-tree-group-count">{timestepArtifacts.length}</span>
                            </button>

                            {isExpanded && timestepArtifacts.map((artifact) => renderArtifactTreeItem(
                                artifact,
                                Palette,
                                'canvas-ctx-color-coding',
                                'canvas-tree-item--indent-lg'
                            ))}
                        </Container>
                    );
                })}
            </Container>
        );
    }, [colorCodingArtifacts, colorCodingTimesteps, expandedColorCodingTimesteps, renderArtifactPlaceholder, renderArtifactTreeItem, sceneArtifactsLoading, toggleColorCodingTimestep]);

    return (
        <Container className="canvas-objects-panel d-flex column min-h-0 overflow-auto">
            <CollapsibleSection
                title="Scene Collection"
                icon={<Layers style={{ width: 13, height: 13, color: PANEL_ICON_COLOR }} />}
                expanded={sceneCollectionOpen}
                onExpandedChange={setSceneCollectionOpen}
                className="canvas-right-dropdown"
                headerClassName="canvas-right-dropdown-header d-flex items-center gap-05"
                titleClassName="canvas-right-dropdown-title font-size-05 color-muted"
                iconClassName="canvas-right-dropdown-icon"
                bodyClassName="canvas-right-dropdown-body"
                contentClassName="d-flex column"
                noSpacing
                arrowSize={13}
                useDefaultHeaderStyles={false}
                useDefaultTitleStyles={false}
            >
                {isRasterWorkspace
                    ? (
                        <Container className="canvas-raster-container-panels d-flex column gap-05">
                            {rasterContainerSelections.map(renderRasterContainerPanel)}
                        </Container>
                    )
                    : (
                        <SceneCollection
                            filteredSections={sceneCollectionSections}
                            expandedSections={expandedSections}
                            toggleSection={toggleSection}
                            showSectionsSkeleton={showSectionsSkeleton}
                            activeScene={activeScene}
                            onSelectScene={onSelectScene}
                            isSceneInActiveScenes={isSceneInActiveScenes}
                            addScene={addScene}
                            removeScene={removeScene}
                            totalAnalyses={sceneCollectionTotalAnalyses}
                            statusMap={statusMap}
                            onDeleteAnalysis={onDeleteAnalysis}
                            onDownloadAnalysis={onDownloadAnalysis ?? (() => undefined)}
                            onDownloadExposureListing={onDownloadExposureListing}
                            showSimulationCell={showSimulationCell}
                            onToggleSimulationCell={handleToggleSimulationCell}
                            sceneVisualOverrides={sceneVisualOverrides}
                            setSceneOpacity={setSceneOpacity}
                            setSceneLineWidth={setSceneLineWidth}
                        />
                    )}
            </CollapsibleSection>

            {!isRasterWorkspace && hasSelectedTimestepAnalyses && (
                <CollapsibleSection
                    title="Timestep-scoped analyses"
                    icon={<Layers style={{ width: 13, height: 13, color: PANEL_ICON_COLOR }} />}
                    expanded={selectedTimestepAnalysisOpen}
                    onExpandedChange={setSelectedTimestepAnalysisOpen}
                    className="canvas-right-dropdown"
                    headerClassName="canvas-right-dropdown-header d-flex items-center gap-05"
                    titleClassName="canvas-right-dropdown-title font-size-05 color-muted"
                    iconClassName="canvas-right-dropdown-icon"
                    bodyClassName="canvas-right-dropdown-body"
                    contentClassName="d-flex column"
                    noSpacing
                    arrowSize={13}
                    useDefaultHeaderStyles={false}
                    useDefaultTitleStyles={false}
                >
                    <SceneCollection
                        filteredSections={selectedTimestepSections}
                        expandedSections={expandedSections}
                        toggleSection={toggleSection}
                        showSectionsSkeleton={showSectionsSkeleton}
                        activeScene={activeScene}
                        onSelectScene={onSelectScene}
                        isSceneInActiveScenes={isSceneInActiveScenes}
                        addScene={addScene}
                        removeScene={removeScene}
                        totalAnalyses={selectedTimestepTotalAnalyses}
                        statusMap={statusMap}
                        onDeleteAnalysis={onDeleteAnalysis}
                        onDownloadAnalysis={onDownloadAnalysis ?? (() => undefined)}
                        onDownloadExposureListing={onDownloadExposureListing}
                        showDefaultScene={false}
                        sceneVisualOverrides={sceneVisualOverrides}
                        setSceneOpacity={setSceneOpacity}
                        setSceneLineWidth={setSceneLineWidth}
                    />
                </CollapsibleSection>
            )}

            <CollapsibleSection
                title="Color Coding"
                icon={<Palette style={{ width: 13, height: 13, color: PANEL_ICON_COLOR }} />}
                expanded={colorCodingOpen}
                onExpandedChange={setColorCodingOpen}
                className="canvas-right-dropdown"
                headerClassName="canvas-right-dropdown-header d-flex items-center gap-05"
                titleClassName="canvas-right-dropdown-title font-size-05 color-muted"
                iconClassName="canvas-right-dropdown-icon"
                bodyClassName="canvas-right-dropdown-body"
                contentClassName="d-flex column"
                noSpacing
                arrowSize={13}
                useDefaultHeaderStyles={false}
                useDefaultTitleStyles={false}
            >
                {renderColorCodingTreeSection()}
            </CollapsibleSection>

            <CollapsibleSection
                title="Particle Filter"
                icon={<Filter style={{ width: 13, height: 13, color: PANEL_ICON_COLOR }} />}
                expanded={particleFilterOpen}
                onExpandedChange={setParticleFilterOpen}
                className="canvas-right-dropdown"
                headerClassName="canvas-right-dropdown-header d-flex items-center gap-05"
                titleClassName="canvas-right-dropdown-title font-size-05 color-muted"
                iconClassName="canvas-right-dropdown-icon"
                bodyClassName="canvas-right-dropdown-body"
                contentClassName="d-flex column"
                noSpacing
                arrowSize={13}
                useDefaultHeaderStyles={false}
                useDefaultTitleStyles={false}
            >
                {renderParticleFilterTreeSection()}
            </CollapsibleSection>
        </Container>
    );
};

export default ObjectsPanel;
