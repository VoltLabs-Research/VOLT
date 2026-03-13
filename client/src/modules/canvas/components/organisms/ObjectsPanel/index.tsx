import { isArtifactSceneActive, toSceneObjectFromArtifact } from '@/modules/canvas/utilities/scene-identity';
import useAnalysisStatus from '../../../hooks/use-analysis-status';
import useCanvasSidebarState from '../../../hooks/use-canvas-sidebar-state';
import useSceneArtifacts from '../../../hooks/use-scene-artifacts';
import PanelHeader from '../../atoms/PanelHeader';
import SceneCollection from '../../molecules/SceneCollection';

import { Filter, Layers, Palette, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import Container from '@/shared/presentation/components/Container';
import IconButton from '@/shared/presentation/components/IconButton';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { useShallow } from 'zustand/react/shallow';

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

    const { showSimulationCell, setShowSimulationCell } = useEditorStore(useShallow((s) => ({
        showSimulationCell: s.showSimulationCell,
        setShowSimulationCell: s.setShowSimulationCell
    })));

    const handleToggleSimulationCell = () => setShowSimulationCell(!showSimulationCell);

    const isArtifactActive = (artifact: SceneArtifact): boolean => isArtifactSceneActive(activeScene, artifact);

    return (
        <Container className="canvas-objects-panel d-flex column min-h-0 overflow-auto">
            <PanelHeader
                icon={<Layers style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.35)' }} />}
                title="Objects"
                actions={
                    <IconButton variant="ghost" size="sm" aria-label="Filter">
                        <SlidersHorizontal style={{ width: 13, height: 13 }} />
                    </IconButton>
                }
            />

            <CollapsibleSection
                title="Scene Collection"
                icon={<Layers style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.25)' }} />}
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
                />
            </CollapsibleSection>

            {hasSelectedTimestepAnalyses && (
                <CollapsibleSection
                    title="Selected timestep analysis"
                    icon={<Layers style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.25)' }} />}
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
                    />
                </CollapsibleSection>
            )}

            <CollapsibleSection
                title="Color Coding"
                icon={<Palette style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.25)' }} />}
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
                        <Container
                            key={artifact._id}
                            className={`canvas-tree-item canvas-tree-item--indent font-size-1 color-secondary cursor-pointer u-select-none ${isArtifactActive(artifact) ? 'selected' : ''}`}
                            onClick={() => {
                                const scene = toSceneObjectFromArtifact(artifact);
                                if (!scene) return;
                                onSelectScene(scene);
                            }}
                        >
                            <span className={`${isArtifactActive(artifact) ? 'color-primary' : 'color-secondary'}`}>
                                {artifact.displayName}
                            </span>
                        </Container>
                    ))}
                </Container>
            </CollapsibleSection>

            <CollapsibleSection
                title="Particle Filter"
                icon={<Filter style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.25)' }} />}
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
                        <Container
                            key={artifact._id}
                            className={`canvas-tree-item canvas-tree-item--indent font-size-1 color-secondary cursor-pointer u-select-none ${isArtifactActive(artifact) ? 'selected' : ''}`}
                            onClick={() => {
                                const scene = toSceneObjectFromArtifact(artifact);
                                if (!scene) return;
                                onSelectScene(scene);
                            }}
                        >
                            <span className={`${isArtifactActive(artifact) ? 'color-primary' : 'color-secondary'}`}>
                                {artifact.displayName}
                            </span>
                        </Container>
                    ))}
                </Container>
            </CollapsibleSection>
        </Container>
    );
};

export default ObjectsPanel;
