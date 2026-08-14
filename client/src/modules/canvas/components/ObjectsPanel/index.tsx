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

import AnalysisResultsSection from '../AnalysisResultsSection';

import { Layers } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { useEditorStore } from '@/modules/canvas/store/editor';
import { useShallow } from 'zustand/react/shallow';

import type { ArtifactSection } from './use-artifact-sections';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import type { CanvasPanelActionProps } from '../canvas-panel-props';
import Scrollable from '@/shared/ui/components/Scrollable';

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
        applyDeletedAnalysisLocally,
        onRetryLoadExposures,
        sceneCollectionTotalAnalyses
    } = useCanvasSidebarState({
        trajectory,
        trajectoryId: trajectory?._id
    });

    const { runSections, onRestoreRun, onRenameRun, onDeleteRun } = usePipelineRuns({
        trajectoryId: trajectory?._id,
        canMutateCanvas,
        sections: sceneCollectionSections,
        expandedSections,
        expandSection,
        applyDeletedAnalysisLocally
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
        onDeleteRun,
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

    /*
     * Which analysis the results panel describes, most specific source first.
     *
     * The first two were the whole rule, and between them they left the common case
     * uncovered: run a plugin without clicking into its exposure and the primary active
     * scene is still the simulation cell, so `activeScene.source` is not `'plugin'`; if
     * the URL carries no `analysisId` either, this was `undefined` and the panel removed
     * itself entirely. The plugin had run, its tables were on disk, and the sidebar showed
     * nothing — with no way for the reader to tell those two states apart.
     *
     * So the last fallback is the tree's newest analysis. When exactly one analysis is
     * listed, "the analysis the user is looking at" is not ambiguous, and showing its
     * summary beats showing nothing.
     */
    const resultsTarget = useMemo((): { analysisId?: string; pluginId?: string } => {
        /*
         * `analysis.plugin` is typed as an id but arrives populated: the API sends the whole
         * plugin object. Passing it straight through made the results panel look up
         * `pluginsById[{ _id, workflow, ... }]`, which is always a miss, so the panel found
         * no plugin, derived no tables, and removed itself — with every layer beneath it
         * holding the right data.
         */
        const toPluginId = (plugin: unknown): string | undefined => {
            if (typeof plugin === 'string') return plugin;
            if (plugin && typeof plugin === 'object') {
                const populated = plugin as { _id?: string; id?: string };
                return populated._id ?? populated.id;
            }

            return undefined;
        };

        const fromSections = (id: string | undefined) => toPluginId(sceneCollectionSections
            .find((section) => section.analysis._id === id)?.analysis.plugin);

        /*
         * A pipeline run carries the identity of every stage it executed, so a run row can
         * name its analysis and its plugin even when the analysis has no section — which is
         * exactly the state the sidebar is usually in. Its rows render from `stage`, so the
         * tree looks populated while `sceneCollectionSections` is empty, and any resolution
         * that only consulted the sections found nothing to describe.
         */
        const fromRuns = () => {
            for (const section of runSections) {
                for (const row of section.rows) {
                    const stage = row.stage;
                    const stageAnalysisId = stage?.cacheHit ? stage.cachedFromAnalysisId : stage?.analysisId;
                    if (stageAnalysisId) {
                        return {
                            analysisId: stageAnalysisId,
                            pluginId: fromSections(stageAnalysisId) ?? toPluginId(stage?.pluginId)
                        };
                    }
                }
            }

            return undefined;
        };

        if (activeScene?.source === 'plugin') {
            return {
                analysisId: activeScene.analysisId,
                pluginId: fromSections(activeScene.analysisId)
            };
        }

        if (analysisId) {
            return {
                analysisId,
                pluginId: fromSections(analysisId)
            };
        }

        const firstSection = sceneCollectionSections[0];
        if (firstSection) {
            return {
                analysisId: firstSection.analysis._id,
                pluginId: toPluginId(firstSection.analysis.plugin)
            };
        }

        return fromRuns() ?? {};
    }, [activeScene, analysisId, runSections, sceneCollectionSections]);

    const resultsAnalysisId = resultsTarget.analysisId;
    const resultsPluginId = resultsTarget.pluginId;

    const populatedSections = artifactSections.filter((section) => section.timesteps.length > 0);
    const showSceneCollection = !isAnalysisCompact || sceneCollectionSections.length > 0;

    return (
        <div className={cn('canvas-objects-panel flex h-full min-h-0 flex-col justify-between overflow-hidden', isAnalysisCompact && 'canvas-objects-panel--analysis-compact justify-start')}>
            <Scrollable className='flex min-h-0 flex-auto flex-col [&>:first-child]:mt-2'>
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

                {isAnalysisCompact && (
                    <>
                        <AnalysisResultsSection
                            analysisId={resultsAnalysisId}
                            pluginId={resultsPluginId}
                            currentTimestep={currentTimestep}
                        />
                        {populatedSections.map(renderArtifactSection)}
                    </>
                )}
            </Scrollable>

            {/*
             * Pinned to the bottom, above Color Coding: the results are a readout of the
             * selected analysis, not a branch of the scene tree, so they belong with the other
             * bottom panels rather than between the tree and the pipeline.
             *
             * The height is capped because this region does not scroll with the tree — a long
             * table would otherwise push Color Coding and Particle Filter off screen.
             */}
            {!isAnalysisCompact && (
                <div className='flex flex-none flex-col border-t border-border'>
                    <Scrollable className='flex max-h-[40vh] flex-col'>
                        <AnalysisResultsSection
                            analysisId={resultsAnalysisId}
                            pluginId={resultsPluginId}
                            currentTimestep={currentTimestep}
                        />
                    </Scrollable>
                    {artifactSections.map(renderArtifactSection)}
                </div>
            )}
        </div>
    );
};

export default ObjectsPanel;
