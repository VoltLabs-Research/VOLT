import { isArtifactSceneActive, toSceneObjectFromArtifact } from '@/modules/canvas/utilities/scene-identity';
import CanvasSlider from '../../atoms/CanvasSlider';
import { getSceneKey } from '@/modules/fractal/utilities/scene-utils';
import useAnalysisStatus from '../../../hooks/use-analysis-status';
import useCanvasSidebarState from '../../../hooks/use-canvas-sidebar-state';
import useSceneArtifacts from '../../../hooks/use-scene-artifacts';
import PanelHeader from '../../atoms/PanelHeader';
import SceneCollection from '../../molecules/SceneCollection';

import { Eye, Filter, Layers, Minus, Palette, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import Container from '@/shared/presentation/components/Container';
import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { useShallow } from 'zustand/react/shallow';

import type { MenuOption } from '@/shared/presentation/types/menu';
import type { SceneArtifact } from '@/modules/trajectory/api/entities/scene-artifacts';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';

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
};

const PANEL_ICON_COLOR = 'var(--color-text-secondary)';

const ObjectsPanel = ({ trajectory, onDownloadAnalysis, onDownloadExposureListing }: ObjectsPanelProps) => {
    const [sceneCollectionOpen, setSceneCollectionOpen] = useState(true);
    const [selectedTimestepAnalysisOpen, setSelectedTimestepAnalysisOpen] = useState(true);
    const [colorCodingOpen, setColorCodingOpen] = useState(true);
    const [particleFilterOpen, setParticleFilterOpen] = useState(true);

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

    const {
        showSimulationCell,
        setShowSimulationCell,
        sceneOpacities,
        setSceneOpacity
    } = useEditorStore(useShallow((s) => ({
        showSimulationCell: s.showSimulationCell,
        setShowSimulationCell: s.setShowSimulationCell,
        sceneOpacities: s.sceneOpacities,
        setSceneOpacity: s.setSceneOpacity
    })));

    const handleToggleSimulationCell = () => setShowSimulationCell(!showSimulationCell);

    const isArtifactActive = (artifact: SceneArtifact): boolean => isArtifactSceneActive(activeScene, artifact);

    const getArtifactMenuOptions = useCallback((artifact: SceneArtifact): MenuOption[] => {
        const scene = toSceneObjectFromArtifact(artifact);
        if (!scene) return [];

        const isActive = isSceneInActiveScenes(scene);
        const sceneKey = getSceneKey(scene);
        const currentOpacity = sceneOpacities[sceneKey] ?? 1;

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
                onClick: () => addScene(scene)
            });
        }

        const transparencySubmenu = (
            <div className="context-menu-transparency">
                <span className="context-menu-transparency__label">Transparency</span>
                <CanvasSlider
                    ariaLabel={`Adjust ${artifact.displayName} transparency`}
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
    }, [isSceneInActiveScenes, sceneOpacities, addScene, removeScene, setSceneOpacity]);

    return (
        <Container className="canvas-objects-panel d-flex column min-h-0 overflow-auto">
            <PanelHeader
                icon={<Layers style={{ width: 13, height: 13, color: PANEL_ICON_COLOR }} />}
                title="Objects"
            />

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
                    sceneOpacities={sceneOpacities}
                    setSceneOpacity={setSceneOpacity}
                />
            </CollapsibleSection>

            {hasSelectedTimestepAnalyses && (
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
                        sceneOpacities={sceneOpacities}
                        setSceneOpacity={setSceneOpacity}
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
                <Container className="canvas-tree-container d-flex column gap-025">
                    {sceneArtifactsLoading && colorCodingArtifacts.length === 0 && (
                        <Container className="canvas-tree-item color-muted font-size-1 canvas-tree-item--indent">
                            Loading...
                        </Container>
                    )}
                    {!sceneArtifactsLoading && colorCodingArtifacts.length === 0 && (
                        <Container className="canvas-tree-item color-muted font-size-1 canvas-tree-item--indent">
                            No models generated
                        </Container>
                    )}
                    {colorCodingArtifacts.map((artifact: SceneArtifact) => (
                        <ContextMenuPopover
                            key={artifact._id}
                            id={`canvas-ctx-color-coding-${artifact._id}`}
                            trigger={(
                                <button
                                    className={`canvas-tree-item canvas-tree-item--indent font-size-1 color-secondary cursor-pointer u-select-none ${isArtifactActive(artifact) ? 'selected' : ''}`}
                                    onClick={() => {
                                        const scene = toSceneObjectFromArtifact(artifact);
                                        if (!scene) return;
                                        onSelectScene(scene);
                                    }}
                                    type="button"
                                >
                                    <span className={`${isArtifactActive(artifact) ? 'color-primary' : 'color-secondary'}`}>
                                        {artifact.displayName}
                                    </span>
                                </button>
                            )}
                            options={getArtifactMenuOptions(artifact)}
                            size='sm'
                        />
                    ))}
                </Container>
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
                <Container className="canvas-tree-container d-flex column gap-025">
                    {sceneArtifactsLoading && particleFilterArtifacts.length === 0 && (
                        <Container className="canvas-tree-item color-muted font-size-1 canvas-tree-item--indent">
                            Loading...
                        </Container>
                    )}
                    {!sceneArtifactsLoading && particleFilterArtifacts.length === 0 && (
                        <Container className="canvas-tree-item color-muted font-size-1 canvas-tree-item--indent">
                            No models generated
                        </Container>
                    )}
                    {particleFilterArtifacts.map((artifact: SceneArtifact) => (
                        <ContextMenuPopover
                            key={artifact._id}
                            id={`canvas-ctx-particle-filter-${artifact._id}`}
                            trigger={(
                                <button
                                    className={`canvas-tree-item canvas-tree-item--indent font-size-1 color-secondary cursor-pointer u-select-none ${isArtifactActive(artifact) ? 'selected' : ''}`}
                                    onClick={() => {
                                        const scene = toSceneObjectFromArtifact(artifact);
                                        if (!scene) return;
                                        onSelectScene(scene);
                                    }}
                                    type="button"
                                >
                                    <span className={`${isArtifactActive(artifact) ? 'color-primary' : 'color-secondary'}`}>
                                        {artifact.displayName}
                                    </span>
                                </button>
                            )}
                            options={getArtifactMenuOptions(artifact)}
                            size='sm'
                        />
                    ))}
                </Container>
            </CollapsibleSection>
        </Container>
    );
};

export default ObjectsPanel;
