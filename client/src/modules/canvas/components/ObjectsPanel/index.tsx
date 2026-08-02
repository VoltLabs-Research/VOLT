import ArtifactTreeSection from './ArtifactTreeSection';
import RightCollapsible, { PANEL_ICON_STYLE } from './RightCollapsible';
import useArtifactSections from './use-artifact-sections';
import useAnalysisActivityTone from '../../hooks/use-analysis-activity-tone';
import useAnalysisStatus from '../../hooks/use-analysis-status';
import useCanvasSidebarState from '../../hooks/use-canvas-sidebar-state';
import useSceneArtifacts from '../../hooks/use-scene-artifacts';
import CanvasPipeline from '../CanvasPipeline';
import PipelineHeaderActions from '../CanvasPipeline/PipelineHeaderActions';
import SceneCollection from '../SceneCollection';

import { Layers } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { Button, Stack } from '@voltstack/bravais';
import { useEditorStore } from '@/modules/canvas/store/editor';
import useCanvasUrlState, { CanvasWorkspace } from '@/modules/canvas/hooks/use-canvas-url-state';
import { useShallow } from 'zustand/react/shallow';

import type { ArtifactSection } from './use-artifact-sections';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import type { RasterContainerSelection, RasterSelectableScene } from '@/modules/raster/contracts/container-selection';
import type { CanvasPanelActionProps } from '../canvas-panel-props';

import './ObjectsPanel.css';

interface ObjectsPanelProps extends CanvasPanelActionProps {
    trajectory: Trajectory | null | undefined;
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
    canMutateCanvas?: boolean;
    mode?: 'default' | 'analysis-compact';
}

type SharedSceneCollectionProps = Omit<ComponentProps<typeof SceneCollection>, 'filteredSections' | 'totalAnalyses'>;

const TOUR_SELECT_ANALYSIS_EVENT = 'canvas-analysis-tour:select-first-analysis';

const ObjectsPanel = ({
    trajectory,
    trajectoryId,
    analysisId,
    currentTimestep,
    canMutateCanvas,
    onDownloadAnalysis,
    onDownloadExposureListing,
    rasterContainerSelections = [],
    activeRasterContainerId = 'container-1',
    onSetActiveRasterContainer,
    onUpdateRasterContainerSelection,
    mode = 'default'
}: ObjectsPanelProps) => {
    const [sceneCollectionOpen, setSceneCollectionOpen] = useState(true);
    const { activeWorkspace } = useCanvasUrlState();
    const isRasterWorkspace = activeWorkspace === CanvasWorkspace.Raster;
    const isAnalysisCompact = mode === 'analysis-compact';

    const {
        sceneCollectionSections,
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
        sceneCollectionTotalAnalyses
    } = useCanvasSidebarState({
        trajectory,
        trajectoryId: trajectory?._id
    });

    const { statusMap } = useAnalysisStatus({
        trajectoryId: trajectory?._id,
        enabled: !!trajectory?._id
    });
    const { toneByAnalysisId } = useAnalysisActivityTone(statusMap);

    const {
        isLoading: sceneArtifactsLoading,
        colorCodingArtifacts,
        particleFilterArtifacts,
        lineStyleArtifacts
    } = useSceneArtifacts({ trajectoryId: trajectory?._id });

    const artifactSections = useArtifactSections({
        'color-coding': colorCodingArtifacts,
        'particle-filter': particleFilterArtifacts,
        'line-style': lineStyleArtifacts
    });

    const {
        showSimulationCell,
        setShowSimulationCell,
        sceneVisualOverrides,
        setSceneOpacity,
        setSceneLineWidth,
        setSceneColor
    } = useEditorStore(useShallow((s) => ({
        showSimulationCell: s.showSimulationCell,
        setShowSimulationCell: s.setShowSimulationCell,
        sceneVisualOverrides: s.sceneVisualOverrides,
        setSceneOpacity: s.setSceneOpacity,
        setSceneLineWidth: s.setSceneLineWidth,
        setSceneColor: s.setSceneColor
    })));

    const handleToggleSimulationCell = () => setShowSimulationCell(!showSimulationCell);

    useEffect(() => {
        const selectFirstTourAnalysis = () => {
            const section = sceneCollectionSections[0];
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

            onSelectScene({
                sceneType: 'trajectory',
                source: 'default' as const
            }, section.analysis);
        };

        window.addEventListener(TOUR_SELECT_ANALYSIS_EVENT, selectFirstTourAnalysis);

        return () => {
            window.removeEventListener(TOUR_SELECT_ANALYSIS_EVENT, selectFirstTourAnalysis);
        };
    }, [activeScene, expandedSections, onRetryLoadExposures, onSelectScene, sceneCollectionSections, toggleSection]);

    const handleSelectRasterScene = (scene: RasterSelectableScene, label: string) => {
        onUpdateRasterContainerSelection?.(activeRasterContainerId, {
            scene,
            label,
            model: scene.source === 'plugin' ? scene.exposureId : undefined
        });
    };

    const sharedSceneCollectionProps: SharedSceneCollectionProps = {
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
        setSceneLineWidth,
        setSceneColor
    };

    const renderRasterContainerPanel = (selection: RasterContainerSelection) => {
        const isActive = selection.id === activeRasterContainerId;

        return (
            <RightCollapsible
                key={selection.id}
                title={selection.title}
                icon={<Layers style={PANEL_ICON_STYLE} />}
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
                        {...sharedSceneCollectionProps}
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
    };

    const renderArtifactSection = (section: ArtifactSection) => (
        <ArtifactTreeSection
            key={section.id}
            section={section}
            isLoading={sceneArtifactsLoading}
            activeScene={activeScene}
            onSelectScene={onSelectScene}
            isSceneActive={isSceneInActiveScenes}
            onAddScene={addScene}
            onRemoveScene={removeScene}
        />
    );

    const resolvedTrajectoryId = trajectoryId ?? trajectory?._id;

    const pipelineSection = !isRasterWorkspace ? (
        <RightCollapsible
            title="Pipeline"
            icon={<Layers style={PANEL_ICON_STYLE} />}
            expanded
            collapsible={false}
            headerAction={(
                <PipelineHeaderActions
                    trajectory={trajectory}
                    trajectoryId={resolvedTrajectoryId}
                    currentTimestep={currentTimestep}
                    canMutateCanvas={canMutateCanvas}
                />
            )}
        >
            <CanvasPipeline
                trajectory={trajectory}
                trajectoryId={resolvedTrajectoryId}
                analysisId={analysisId}
                currentTimestep={currentTimestep}
                canMutateCanvas={canMutateCanvas}
            />
        </RightCollapsible>
    ) : null;

    /**
     * Compact mode drops the simulation cell and the raster container picker, and moves
     * the artifact trees into the top region so the panel stays scrollable on mobile.
     */
    const populatedSections = artifactSections.filter((section) => section.timesteps.length > 0);
    const showSceneCollection = !isAnalysisCompact || sceneCollectionSections.length > 0;

    return (
        <Stack minH='0' className={`canvas-objects-panel${isAnalysisCompact ? ' canvas-objects-panel--analysis-compact' : ''}`}>
            <div className="canvas-objects-panel__top">
                {showSceneCollection && (
                    <RightCollapsible
                        title="Visual Elements"
                        icon={<Layers style={PANEL_ICON_STYLE} />}
                        expanded={sceneCollectionOpen}
                        onExpandedChange={setSceneCollectionOpen}
                        collapsible={!isAnalysisCompact || populatedSections.length > 0}
                        tourId="canvas-analyses-section"
                    >
                        {isRasterWorkspace && !isAnalysisCompact ? (
                            <Stack gap='05' className="canvas-raster-container-panels">
                                {rasterContainerSelections.map(renderRasterContainerPanel)}
                            </Stack>
                        ) : (
                            <SceneCollection
                                {...sharedSceneCollectionProps}
                                filteredSections={sceneCollectionSections}
                                totalAnalyses={sceneCollectionTotalAnalyses}
                                showDefaultScene={!isAnalysisCompact}
                                showSimulationCell={!isAnalysisCompact && showSimulationCell}
                                onToggleSimulationCell={handleToggleSimulationCell}
                                firstAnalysisTourTargetId="canvas-first-analysis-row"
                                firstExposureTourTargetId="canvas-first-exposure-row"
                            />
                        )}
                    </RightCollapsible>
                )}
                {pipelineSection}

                {isAnalysisCompact && populatedSections.map(renderArtifactSection)}
            </div>

            {!isAnalysisCompact && (
                <div className="canvas-objects-panel__bottom">
                    {artifactSections.map(renderArtifactSection)}
                </div>
            )}
        </Stack>
    );
};

export default ObjectsPanel;
