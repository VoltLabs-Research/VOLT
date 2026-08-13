import { cn } from '@heroui/react';
import ArtifactTreeSection from './ArtifactTreeSection';
import RightCollapsible, { PANEL_ICON_STYLE } from './RightCollapsible';
import useArtifactSections from './use-artifact-sections';
import useAnalysisActivityTone from '../../hooks/use-analysis-activity-tone';
import useCanvasAnalysisStatus from '../../hooks/use-canvas-analysis-status';
import useCanvasSidebarState from '../../hooks/use-canvas-sidebar-state';
import usePipelineRuns from '../../hooks/use-pipeline-runs';
import useSceneArtifacts from '../../hooks/use-scene-artifacts';
import CanvasPipeline from '../CanvasPipeline';
import PipelineHeaderActions from '../CanvasPipeline/PipelineHeaderActions';
import SceneCollection from '../SceneCollection';

import { Layers } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';

import { useEditorStore } from '@/modules/canvas/store/editor';
import { useShallow } from 'zustand/react/shallow';

import type { ArtifactSection } from './use-artifact-sections';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import type { CanvasPanelActionProps } from '../canvas-panel-props';

interface ObjectsPanelProps extends CanvasPanelActionProps {
    trajectory: Trajectory | null | undefined;
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
    canMutateCanvas?: boolean;
    mode?: 'default' | 'analysis-compact';
}

type SharedSceneCollectionProps = Omit<ComponentProps<typeof SceneCollection>, 'runSections' | 'totalAnalyses'>;

const TOUR_SELECT_ANALYSIS_EVENT = 'canvas-analysis-tour:select-first-analysis';

const ObjectsPanel = ({
    trajectory,
    trajectoryId,
    analysisId,
    currentTimestep,
    canMutateCanvas,
    onDownloadAnalysis,
    onDownloadExposureListing,
    mode = 'default'
}: ObjectsPanelProps) => {
    const [sceneCollectionOpen, setSceneCollectionOpen] = useState(true);
    const isAnalysisCompact = mode === 'analysis-compact';

    const {
        sceneCollectionSections,
        expandedSections,
        toggleSection,
        expandSection,
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

    const { runSections, onRestoreRun, onRenameRun } = usePipelineRuns({
        trajectoryId: trajectory?._id,
        canMutateCanvas,
        sections: sceneCollectionSections,
        expandedSections,
        expandSection
    });

    const { statusMap } = useCanvasAnalysisStatus({
        trajectoryId: trajectory?._id,
        enabled: !!trajectory?._id
    });
    const { toneByAnalysisId } = useAnalysisActivityTone(statusMap);

    const {
        isLoading: sceneArtifactsLoading,
        colorCodingArtifacts,
        particleFilterArtifacts
    } = useSceneArtifacts({ trajectoryId: trajectory?._id });

    const artifactSections = useArtifactSections({
        'color-coding': colorCodingArtifacts,
        'particle-filter': particleFilterArtifacts
    });

    const {
        showSimulationCell,
        setShowSimulationCell,
        sceneVisualOverrides,
        setSceneOpacity,
        setSceneLineWidth,
        setSceneColor,
        setSceneEdges
    } = useEditorStore(useShallow((s) => ({
        showSimulationCell: s.showSimulationCell,
        setShowSimulationCell: s.setShowSimulationCell,
        sceneVisualOverrides: s.sceneVisualOverrides,
        setSceneOpacity: s.setSceneOpacity,
        setSceneLineWidth: s.setSceneLineWidth,
        setSceneColor: s.setSceneColor,
        setSceneEdges: s.setSceneEdges
    })));

    const handleToggleSimulationCell = () => setShowSimulationCell(!showSimulationCell);

    useEffect(() => {
        const selectFirstTourAnalysis = () => {
            const section = sceneCollectionSections[0];
            if (!section) {
                return;
            }

            // The analysis row only exists in the DOM once its run is open, so the
            // owning run has to be expanded before the analysis itself.
            const owningRun = runSections.find((runSection) => runSection.analysisSections
                .some((analysisSection) => analysisSection.analysis._id === section.analysis._id));
            if (owningRun && !expandedSections.has(owningRun.runId)) {
                toggleSection(owningRun.runId);
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
    }, [activeScene, expandedSections, onRetryLoadExposures, onSelectScene, runSections, sceneCollectionSections, toggleSection]);


    const sharedSceneCollectionProps: SharedSceneCollectionProps = {
        onRestoreRun,
        onRenameRun,
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
        setSceneColor,
        setSceneEdges
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

    const pipelineSection = (
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
    );

    const populatedSections = artifactSections.filter((section) => section.timesteps.length > 0);
    const showSceneCollection = !isAnalysisCompact || sceneCollectionSections.length > 0;

    return (
        <div className={cn('canvas-objects-panel flex h-full min-h-0 flex-col justify-between overflow-hidden', isAnalysisCompact && 'canvas-objects-panel--analysis-compact justify-start')}>
            <div className='flex min-h-0 flex-auto flex-col overflow-y-auto [&>:first-child]:mt-2'>
                {showSceneCollection && (
                    <RightCollapsible
                        title="Visual Elements"
                        icon={<Layers style={PANEL_ICON_STYLE} />}
                        expanded={sceneCollectionOpen}
                        onExpandedChange={setSceneCollectionOpen}
                        collapsible={!isAnalysisCompact || populatedSections.length > 0}
                        tourId='canvas-analyses-section'
                    >
                        <SceneCollection
                            {...sharedSceneCollectionProps}
                            runSections={runSections}
                            totalAnalyses={sceneCollectionTotalAnalyses}
                            showDefaultScene={!isAnalysisCompact}
                            showSimulationCell={!isAnalysisCompact && showSimulationCell}
                            onToggleSimulationCell={handleToggleSimulationCell}
                            firstAnalysisTourTargetId="canvas-first-analysis-row"
                            firstExposureTourTargetId="canvas-first-exposure-row"
                        />
                    </RightCollapsible>
                )}
                {pipelineSection}

                {isAnalysisCompact && populatedSections.map(renderArtifactSection)}
            </div>

            {!isAnalysisCompact && (
                <div className='flex flex-none flex-col border-t border-border'>
                    {artifactSections.map(renderArtifactSection)}
                </div>
            )}
        </div>
    );
};

export default ObjectsPanel;
