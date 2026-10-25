import { cn } from '@heroui/react';
import ArtifactTreeSection from './ArtifactTreeSection';
import useArtifactSections from './use-artifact-sections';
import useAnalysisActivityTone from '../../hooks/use-analysis-activity-tone';
import useCanvasAnalysisStatus from '../../hooks/use-canvas-analysis-status';
import useCanvasSidebarScene from './use-canvas-sidebar-scene';
import usePipelineRuns from './use-pipeline-runs';
import useSceneArtifacts from './use-scene-artifacts';
import useResizable, { ResizeDirection } from '../../hooks/use-resizable';
import ResizeHandle from '../ResizeHandle';
import PipelinesSection, { DRAFT_PIPELINE_ID } from '../PipelinePanel/PipelinesSection';
import PipelineActions from '../PipelinePanel/PipelineActions';
import PipelineContents, { TRAJECTORY_SCENE } from '../PipelinePanel/PipelineContents';
import PipelineItemEditor from '../PipelinePanel/PipelineItemEditor';
import { panelItemKey } from '../PipelinePanel/panel-items';
import { computeRunActivityStatus } from '../../utils/analysis-status-selectors';
import { isCanvasAnalysisInProgress, normalizeCanvasAnalysisStatus } from '../../utils/analysis-status';
import { pipelineRunIdOf, pipelineStoreKey, useCanvasPipelineStore, useStages } from '../../store/canvas-pipeline';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { useEnsurePluginCatalogLoaded } from '@/modules/plugin/hooks/plugin/use-plugin-catalog';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useEditorStore } from '@/modules/canvas/store/editor';
import { useShallow } from 'zustand/react/shallow';

import type { ArtifactSection } from './use-artifact-sections';
import type { PipelineRun } from '@volt/contracts/modules/plugin/pipeline-run';
import type { PipelineRunSection } from '../../utils/pipeline-run-sections';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import Scrollable from '@/shared/ui/components/Scrollable';

interface ObjectsPanelProps {
    trajectory: Trajectory | null | undefined;
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
    canMutateCanvas?: boolean;
    mode?: 'default' | 'analysis-compact';
}

const TOUR_SELECT_ANALYSIS_EVENT = 'canvas-analysis-tour:select-first-analysis';

const UNGROUPED_REASON = 'These analyses ran outside a pipeline, so they cannot take new stages.';

/*
 * The canvas panel as OVITO's pipeline editor: the pipelines (the draft and every saved run), the
 * selected one's visual elements, modifications and data source over a seam, and the selected item's
 * settings below it. Every pipeline takes new modifications; in a saved run they extend it in place.
 */
const ObjectsPanel = ({
    trajectory,
    trajectoryId,
    analysisId,
    currentTimestep,
    canMutateCanvas,
    mode = 'default'
}: ObjectsPanelProps) => {
    const isAnalysisCompact = mode === 'analysis-compact';
    const resolvedTrajectoryId = trajectoryId ?? trajectory?._id;
    useEnsurePluginCatalogLoaded();
    const { modifiers, pluginsById } = usePluginSelectors();
    const pluginNameById = useMemo(() => new Map(modifiers.map((m) => [m.pluginId, m.name])), [modifiers]);

    const {
        sceneCollectionSections,
        expandedSections,
        expandSection,
        activeScene,
        onSelectScene,
        isSceneInActiveScenes,
        addScene,
        removeScene,
        onDeleteAnalysis,
        applyDeletedAnalysisLocally,
        onRetryLoadExposures
    } = useCanvasSidebarScene({
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

    // ------------------------------------------------------------------ the selected pipeline

    const {
        setActivePipeline,
        setActiveTrajectory,
        toggleStageEnabled,
        reorderStage,
        removeStage,
        clearStages
    } = useCanvasPipelineStore(useShallow((s) => ({
        setActivePipeline: s.setActivePipeline,
        setActiveTrajectory: s.setActiveTrajectory,
        toggleStageEnabled: s.toggleStageEnabled,
        reorderStage: s.reorderStage,
        removeStage: s.removeStage,
        clearStages: s.clearStages
    })));
    const activeKey = useCanvasPipelineStore((s) =>
        resolvedTrajectoryId ? s.activeKeyByTrajectory[resolvedTrajectoryId] : undefined);
    const draftStages = useStages(resolvedTrajectoryId);

    const selectedRunId = resolvedTrajectoryId ? pipelineRunIdOf(resolvedTrajectoryId, activeKey) : undefined;

    // A run's rows can drop out of the list at a timestep none of its analyses cover; the panel
    // keeps showing the last ones it had rather than jumping to another pipeline.
    const lastSectionRef = useRef<PipelineRunSection | undefined>(undefined);
    const listedSection = runSections.find((section) => section.runId === selectedRunId);
    if (listedSection) lastSectionRef.current = listedSection;
    const selectedSection = listedSection
        ?? (lastSectionRef.current?.runId === selectedRunId ? lastSectionRef.current : undefined);

    const selectedPipelineId = selectedSection?.runId ?? DRAFT_PIPELINE_ID;
    const pipelineKey = resolvedTrajectoryId ? pipelineStoreKey(resolvedTrajectoryId, selectedSection?.runId) : '';
    const editableStages = useStages(pipelineKey);

    const resolveRunStatus = useCallback((section: PipelineRunSection) =>
        computeRunActivityStatus(section.analysisSections.map((analysisSection) =>
            statusMap.get(analysisSection.analysis._id)?.status
            ?? normalizeCanvasAnalysisStatus(analysisSection.analysis.status)
        )), [statusMap]);

    const isRunBusy = selectedSection ? isCanvasAnalysisInProgress(resolveRunStatus(selectedSection)) : false;

    const inViewRunId = activeScene?.source === 'plugin'
        ? runSections.find((section) => section.analysisSections
            .some((analysisSection) => analysisSection.analysis._id === activeScene.analysisId))?.runId
        : undefined;

    const [selectedKey, setSelectedKey] = useState<string>(panelItemKey.source);

    // What a pipeline opens on: the current analysis when it is there, else its last stage.
    const defaultItemKey = useCallback((section: PipelineRunSection | undefined): string => {
        if (!section) {
            const lastStage = draftStages[draftStages.length - 1];
            return lastStage ? panelItemKey.stage(lastStage.id) : panelItemKey.source;
        }
        const current = section.analysisSections.find((analysisSection) => analysisSection.isCurrentAnalysis);
        const last = section.analysisSections[section.analysisSections.length - 1];
        const target = current ?? last;
        return target ? panelItemKey.analysis(target.analysis._id) : panelItemKey.source;
    }, [draftStages]);

    const selectPipeline = useCallback((pipelineId: string) => {
        if (!resolvedTrajectoryId) return;
        const isDraft = pipelineId === DRAFT_PIPELINE_ID;
        setActivePipeline(resolvedTrajectoryId, isDraft ? undefined : pipelineId);
        setSelectedKey(defaultItemKey(isDraft ? undefined : runSections.find((section) => section.runId === pipelineId)));
    }, [defaultItemKey, resolvedTrajectoryId, runSections, setActivePipeline]);

    // First visit: the draft when it holds stages, else the newest run.
    useEffect(() => {
        if (!resolvedTrajectoryId || activeKey) return;
        const newest = runSections.find((section) => !section.isUngrouped);
        if (draftStages.length === 0 && !newest) return;
        selectPipeline(draftStages.length > 0 || !newest ? DRAFT_PIPELINE_ID : newest.runId);
    }, [activeKey, draftStages.length, resolvedTrajectoryId, runSections, selectPipeline]);

    // Stage calls without a key (search, assistant) go to the pipeline on screen.
    useEffect(() => {
        if (activeKey) setActiveTrajectory(activeKey);
    }, [activeKey, setActiveTrajectory]);
    useEffect(() => () => setActiveTrajectory(null), [setActiveTrajectory]);

    // An analysis made current elsewhere (a run starting, the URL, the assistant) brings its pipeline up.
    const syncedAnalysisIdRef = useRef<string | undefined>(undefined);
    useEffect(() => {
        if (!resolvedTrajectoryId || !analysisId || syncedAnalysisIdRef.current === analysisId) return;
        const owner = runSections.find((section) => section.analysisSections
            .some((analysisSection) => analysisSection.analysis._id === analysisId));
        if (!owner) return;
        syncedAnalysisIdRef.current = analysisId;
        if (owner.runId !== selectedRunId) setActivePipeline(resolvedTrajectoryId, owner.runId);
        setSelectedKey(panelItemKey.analysis(analysisId));
    }, [analysisId, resolvedTrajectoryId, runSections, selectedRunId, setActivePipeline]);

    // Visual elements lists every model of the pipeline, so its analyses' exposures are loaded.
    useEffect(() => {
        selectedSection?.analysisSections.forEach((analysisSection) => {
            if (!expandedSections.has(analysisSection.analysis._id)) expandSection(analysisSection.analysis._id);
        });
    }, [expandSection, expandedSections, selectedSection]);

    useEffect(() => {
        const selectFirstTourAnalysis = () => {
            const owner = runSections.find((section) => section.analysisSections.length > 0);
            const first = owner?.analysisSections[0];
            if (!owner || !first || !resolvedTrajectoryId) return;

            setActivePipeline(resolvedTrajectoryId, owner.runId);
            setSelectedKey(panelItemKey.analysis(first.analysis._id));
            onRetryLoadExposures?.(first.analysis._id);
            if (!first.isCurrentAnalysis) onSelectScene(TRAJECTORY_SCENE, first.analysis);
        };

        window.addEventListener(TOUR_SELECT_ANALYSIS_EVENT, selectFirstTourAnalysis);
        return () => window.removeEventListener(TOUR_SELECT_ANALYSIS_EVENT, selectFirstTourAnalysis);
    }, [onRetryLoadExposures, onSelectScene, resolvedTrajectoryId, runSections, setActivePipeline]);

    // ------------------------------------------------------------------------------- actions

    const duplicateRun = useCallback((run: PipelineRun) => {
        if (!onRestoreRun) return;
        onRestoreRun(run);
        selectPipeline(DRAFT_PIPELINE_ID);
    }, [onRestoreRun, selectPipeline]);

    const deleteRun = useCallback((run: PipelineRun) => {
        if (!onDeleteRun || !resolvedTrajectoryId) return;
        if (run._id === selectedRunId) selectPipeline(DRAFT_PIPELINE_ID);
        clearStages(pipelineStoreKey(resolvedTrajectoryId, run._id));
        onDeleteRun(run);
    }, [clearStages, onDeleteRun, resolvedTrajectoryId, selectPipeline, selectedRunId]);

    const moveStage = useCallback((stageId: string, direction: 1 | -1) => {
        const index = editableStages.findIndex((stage) => stage.id === stageId);
        const next = index + direction;
        if (index === -1 || next < 0 || next >= editableStages.length) return;
        reorderStage(stageId, next, pipelineKey);
    }, [editableStages, pipelineKey, reorderStage]);

    const deleteStage = useCallback((stageId: string) => {
        const index = editableStages.findIndex((stage) => stage.id === stageId);
        removeStage(stageId, pipelineKey);
        const neighbour = editableStages[index + 1] ?? editableStages[index - 1];
        setSelectedKey(neighbour && neighbour.id !== stageId ? panelItemKey.stage(neighbour.id) : defaultItemKey(selectedSection));
    }, [defaultItemKey, editableStages, pipelineKey, removeStage, selectedSection]);

    const resolvedAnalysisId = analysisId ?? selectedSection?.analysisSections[0]?.analysis._id;

    // List height, remembered per viewer like the panel width.
    const listPanel = useResizable({
        direction: ResizeDirection.Vertical,
        initialSize: 300,
        minSize: 120,
        maxSize: 640,
        growPositive: true,
        storageKey: 'volt:canvas:pipeline-list-size'
    });

    const populatedSections = artifactSections.filter((section) => section.timesteps.length > 0);
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

    const contents = (
        <PipelineContents
            trajectoryName={trajectory?.name}
            section={selectedSection}
            editableStages={editableStages}
            pluginNameById={pluginNameById}
            pluginsById={pluginsById}
            statusMap={statusMap}
            toneByAnalysisId={toneByAnalysisId}
            selectedKey={selectedKey}
            onSelectKey={setSelectedKey}
            onSelectScene={onSelectScene}
            isSceneInActiveScenes={isSceneInActiveScenes}
            addScene={addScene}
            removeScene={removeScene}
            showSimulationCell={showSimulationCell}
            onToggleSimulationCell={() => setShowSimulationCell(!showSimulationCell)}
            onToggleStage={(stageId) => toggleStageEnabled(stageId, pipelineKey)}
            onMoveStage={moveStage}
            onReorderStage={(stageId, index) => reorderStage(stageId, index, pipelineKey)}
            onRemoveStage={deleteStage}
            onDeleteAnalysis={onDeleteAnalysis}
            onRetryLoadExposures={onRetryLoadExposures}
            canMutateCanvas={canMutateCanvas}
            firstAnalysisTourTargetId='canvas-first-analysis-row'
            firstExposureTourTargetId='canvas-first-exposure-row'
        />
    );

    const editor = (
        <PipelineItemEditor
            selectedKey={selectedKey}
            trajectory={trajectory}
            trajectoryId={resolvedTrajectoryId}
            pipelineKey={pipelineKey}
            section={selectedSection}
            editableStages={editableStages}
            pluginNameById={pluginNameById}
            pluginsById={pluginsById}
            statusMap={statusMap}
            analysisId={resolvedAnalysisId}
            currentTimestep={currentTimestep}
            canMutateCanvas={canMutateCanvas}
            sceneVisualOverrides={sceneVisualOverrides}
            setSceneOpacity={setSceneOpacity}
            setSceneLineWidth={setSceneLineWidth}
            setSceneColor={setSceneColor}
            setSceneEdges={setSceneEdges}
        />
    );

    const head = (
        <>
            <PipelinesSection
                runSections={runSections}
                draftStageCount={draftStages.length}
                selectedId={selectedPipelineId}
                inViewRunId={inViewRunId}
                onSelect={selectPipeline}
                resolveRunStatus={resolveRunStatus}
                onDuplicate={onRestoreRun ? duplicateRun : undefined}
                onRename={onRenameRun}
                onDelete={onDeleteRun ? deleteRun : undefined}
                onClearDraft={canMutateCanvas && resolvedTrajectoryId ? () => clearStages(resolvedTrajectoryId) : undefined}
            />
            {pipelineKey && (
                <PipelineActions
                    key={pipelineKey}
                    trajectory={trajectory}
                    trajectoryId={resolvedTrajectoryId}
                    pipelineKey={pipelineKey}
                    run={selectedSection?.run}
                    isRunBusy={isRunBusy}
                    unavailableReason={selectedSection?.isUngrouped ? UNGROUPED_REASON : undefined}
                    currentTimestep={currentTimestep}
                    canMutateCanvas={canMutateCanvas}
                    onStageAdded={(stageId) => setSelectedKey(panelItemKey.stage(stageId))}
                />
            )}
        </>
    );

    // Phones get one scrolling column: the card is too short to split.
    if (isAnalysisCompact) {
        return (
            <div className='canvas-objects-panel canvas-objects-panel--analysis-compact flex h-full min-h-0 flex-col overflow-hidden'>
                <Scrollable className='flex min-h-0 flex-auto flex-col'>
                    {head}
                    <div className='flex flex-col'>{contents}</div>
                    <div className='mt-2 border-t border-foreground/[0.06] pt-1'>{editor}</div>
                    {populatedSections.map(renderArtifactSection)}
                </Scrollable>
            </div>
        );
    }

    return (
        <div className={cn('canvas-objects-panel flex h-full min-h-0 flex-col overflow-hidden')}>
            {head}
            <div className='flex min-h-0 shrink-0 flex-col' style={{ height: listPanel.size }} id='canvas-pipeline-list'>
                {contents}
            </div>
            <ResizeHandle
                direction={ResizeDirection.Vertical}
                isDragging={listPanel.isDragging}
                label='Resize pipeline list'
                controls='canvas-pipeline-list'
                className='mx-3 shrink-0'
                {...listPanel.handleProps}
            />
            <Scrollable className='flex min-h-0 flex-1 flex-col border-t border-foreground/[0.06] pt-1'>
                {editor}
            </Scrollable>
            {populatedSections.length > 0 && (
                <div className='flex flex-none flex-col border-t border-foreground/[0.06]'>
                    {populatedSections.map(renderArtifactSection)}
                </div>
            )}
        </div>
    );
};

export default ObjectsPanel;
