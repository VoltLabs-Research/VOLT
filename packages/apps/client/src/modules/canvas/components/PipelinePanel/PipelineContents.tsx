import { useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { Button, Separator } from '@heroui/react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import PanelRow, { PanelGroupLabel } from './PanelRow';
import Scrollable from '@/shared/ui/components/Scrollable';
import { buildArtifactRows } from '../AnalysisTreeNode/artifact-rows';
import useRecentlyReadyArtifacts from '../AnalysisTreeNode/use-recently-ready-artifacts';
import useDownloadAnalysisListings from '../../hooks/use-download-analysis-listings';
import useDownloadExposureListing from '../../hooks/use-download-exposure-listing';
import { resolveAnalysisPluginId } from '@/modules/analysis/utils/resolve-plugin-id';
import { resolveExposureScene } from './exposure-scene';
import { describeDraftStage, describePipelineRunStage } from '../../utils/pipeline-stage-labels';
import { CanvasAnalysisStatusEnum, isCanvasAnalysisSettled } from '../../utils/analysis-status';
import { analysisStatus, panelItemKey } from './panel-items';

import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type { MenuOption } from '@/shared/contracts/menu';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';
import type { PipelineStage } from '../../store/canvas-pipeline';
import type { PipelineRunSection, PipelineRunStageRow } from '../../utils/pipeline-run-sections';
import type { AnalysisSectionData } from '../../utils/sidebar-scene-sections';
import type { CanvasAnalysisStatus, CanvasAnalysisStatusEntry } from '../../utils/analysis-status';
import type { AnalysisActivityTone } from '../../utils/analysis-status-selectors';
import type { SceneObjectType } from '@/modules/fractal/contracts/scene';
import type { PanelRowTone } from './PanelRow';

export const TRAJECTORY_SCENE: SceneObjectType = {
    sceneType: 'trajectory',
    source: 'default'
};

const ARTIFACT_TONE: Partial<Record<string, PanelRowTone>> = {
    pending: 'queued',
    generating: 'running',
    uploading: 'running',
    failed: 'failed'
};

const ANALYSIS_TONE: Record<AnalysisActivityTone, PanelRowTone> = {
    queued: 'queued',
    running: 'running',
    completed: 'completed',
    failed: 'failed'
};

export interface PipelineContentsProps {
    trajectoryName?: string;
    // The saved run on screen; absent for the draft.
    section?: PipelineRunSection;
    // The stages this pipeline can still edit: the draft's, or those added to the saved run.
    editableStages: PipelineStage[];
    pluginNameById: ReadonlyMap<string, string>;
    pluginsById: Record<string, Plugin>;
    statusMap: Map<string, CanvasAnalysisStatusEntry>;
    toneByAnalysisId?: Map<string, AnalysisActivityTone>;
    selectedKey: string;
    onSelectKey: (key: string) => void;
    onSelectScene: (scene: SceneObjectType, analysis?: Analysis) => void;
    isSceneInActiveScenes: (scene: SceneObjectType) => boolean;
    addScene: (scene: SceneObjectType) => void;
    removeScene: (scene: SceneObjectType) => void;
    showSimulationCell: boolean;
    onToggleSimulationCell: () => void;
    onToggleStage: (stageId: string) => void;
    onMoveStage: (stageId: string, direction: 1 | -1) => void;
    // Puts a stage at an index of the editable stages, for drag and drop.
    onReorderStage: (stageId: string, index: number) => void;
    // Saved stages whose parameters were changed, by stage index.
    stageEdits?: Record<number, Record<string, unknown>>;
    onRemoveStage: (stageId: string) => void;
    onDeleteAnalysis: (analysisId: string) => Promise<void>;
    onRetryLoadExposures?: (analysisId: string) => void;
    canMutateCanvas?: boolean;
    firstAnalysisTourTargetId?: string;
    firstExposureTourTargetId?: string;
}

// Live stages act on the scene at once; an analysis stage can be switched only once it has run.
const canToggleStage = (stage: PipelineStage): boolean =>
    stage.type === 'color-coding' || stage.type === 'expression-select' || Boolean(stage.executed);

interface VisualRowsProps extends Pick<PipelineContentsProps,
    'pluginsById' | 'selectedKey' | 'onSelectKey' | 'onSelectScene' | 'isSceneInActiveScenes' | 'addScene' | 'removeScene' | 'onRetryLoadExposures'> {
    section: AnalysisSectionData;
    status?: CanvasAnalysisStatus;
    firstExposureTourTargetId?: string;
}

// One analysis's models in Visual elements; a component so each keeps its "recently ready" timers.
const AnalysisVisualRows = ({
    section,
    status,
    pluginsById,
    selectedKey,
    onSelectKey,
    onSelectScene,
    isSceneInActiveScenes,
    addScene,
    removeScene,
    onRetryLoadExposures,
    firstExposureTourTargetId
}: VisualRowsProps) => {
    const { analysis, entry } = section;
    const { download: downloadExposureListing } = useDownloadExposureListing();
    const recentlyReady = useRecentlyReadyArtifacts(analysis.expectedArtifacts);
    const pluginId = resolveAnalysisPluginId(analysis);
    const rows = buildArtifactRows(analysis.expectedArtifacts, entry.exposures, isCanvasAnalysisSettled(status));
    const firstExposureKey = rows.find((row) => row.exposure)?.key;

    if (entry.state === 'error' && onRetryLoadExposures) {
        return (
            <PanelRow
                id={`canvas-visual-error-${analysis._id}`}
                label={`${analysis.pluginDisplayName}: models failed to load`}
                meta='Retry'
                tone='failed'
                onSelect={() => onRetryLoadExposures(analysis._id)}
            />
        );
    }

    if (entry.state === 'loading' && rows.length === 0) {
        return <PanelRow id={`canvas-visual-loading-${analysis._id}`} label='Loading models…' />;
    }

    return (
        <>
            {rows.map(({ key, artifact, exposure }) => {
                const isRecent = artifact ? recentlyReady.has(artifact.exposureId) : false;
                const tone = isRecent ? 'completed' : artifact && artifact.status !== 'ready' ? ARTIFACT_TONE[artifact.status] : undefined;

                if (!exposure) {
                    return (
                        <PanelRow
                            key={key}
                            id={`canvas-visual-${analysis._id}-${key}`}
                            label={artifact?.name ?? key}
                            tone={tone}
                            meta={artifact?.status === 'failed' ? 'Failed' : 'Pending'}
                        />
                    );
                }

                const { scene } = resolveExposureScene(exposure, pluginId, pluginsById);
                const itemKey = panelItemKey.exposure(analysis._id, exposure.exposureId);
                const isInScene = isSceneInActiveScenes(scene);
                const menuOptions: MenuOption[] = [{
                    label: 'Download',
                    onClick: () => void downloadExposureListing({
                        pluginId,
                        exposureId: exposure.exposureId,
                        analysisId: analysis._id,
                        exposureName: exposure.name
                    })
                }];

                return (
                    <PanelRow
                        key={key}
                        id={`canvas-visual-${analysis._id}-${key}`}
                        label={exposure.name}
                        title={`${exposure.name} · ${analysis.pluginDisplayName}`}
                        tone={tone}
                        isSelected={selectedKey === itemKey}
                        checkbox={{
                            isSelected: isInScene,
                            ariaLabel: `${isInScene ? 'Remove' : 'Add'} ${exposure.name} ${isInScene ? 'from' : 'to'} the scene`,
                            onChange: (next) => (next ? addScene(scene) : removeScene(scene))
                        }}
                        onSelect={() => {
                            onSelectKey(itemKey);
                            onSelectScene(scene, analysis);
                        }}
                        menuOptions={menuOptions}
                        tourTargetId={key === firstExposureKey ? firstExposureTourTargetId : undefined}
                    />
                );
            })}
        </>
    );
};

interface AnalysisStageRowProps {
    row: Extract<PipelineRunStageRow, { kind: 'analysis' }>;
    isEdited: boolean;
    status?: CanvasAnalysisStatus;
    tone?: AnalysisActivityTone;
    isSelected: boolean;
    onSelect: () => void;
    onDeleteAnalysis: (analysisId: string) => Promise<void>;
    canMutateCanvas?: boolean;
    tourTargetId?: string;
}

const AnalysisStageRow = ({ row, isEdited, status, tone, isSelected, onSelect, onDeleteAnalysis, canMutateCanvas, tourTargetId }: AnalysisStageRowProps) => {
    const { download } = useDownloadAnalysisListings();
    const { analysis } = row.section;
    const menuOptions: MenuOption[] = [
        {
            label: 'Download',
            onClick: () => void download({ analysisId: analysis._id }),
            disabled: status !== CanvasAnalysisStatusEnum.Completed
        },
        ...(canMutateCanvas ? [{
            label: 'Delete',
            onClick: () => onDeleteAnalysis(analysis._id),
            destructive: true
        }] : [])
    ];

    return (
        <PanelRow
            id={`canvas-stage-${row.key}`}
            label={analysis.pluginDisplayName}
            meta={isEdited ? 'edited' : row.cacheHit ? 'cached' : undefined}
            tone={tone ? ANALYSIS_TONE[tone] : undefined}
            isSelected={isSelected}
            onSelect={onSelect}
            menuOptions={menuOptions}
            tourTargetId={tourTargetId}
        />
    );
};

const PipelineContents = ({
    trajectoryName,
    section,
    editableStages,
    pluginNameById,
    pluginsById,
    statusMap,
    toneByAnalysisId,
    selectedKey,
    onSelectKey,
    onSelectScene,
    isSceneInActiveScenes,
    addScene,
    removeScene,
    showSimulationCell,
    onToggleSimulationCell,
    onToggleStage,
    onMoveStage,
    onReorderStage,
    stageEdits,
    onRemoveStage,
    onDeleteAnalysis,
    onRetryLoadExposures,
    canMutateCanvas,
    firstAnalysisTourTargetId,
    firstExposureTourTargetId
}: PipelineContentsProps) => {
    const analysisSections = useMemo(() => section?.analysisSections ?? [], [section]);
    const [dragId, setDragId] = useState<string | null>(null);
    const [dropTargetId, setDropTargetId] = useState<string | null>(null);
    // Drag events can outrun a render, so the handlers read the dragged stage from here.
    const dragIdRef = useRef<string | null>(null);

    const endDrag = () => {
        dragIdRef.current = null;
        setDragId(null);
        setDropTargetId(null);
    };

    // Only the stages this pipeline can still edit move; what already ran is a record.
    const stageDrag = (stageId: string) => canMutateCanvas ? {
        isDragging: dragId === stageId,
        isDropTarget: dropTargetId === stageId && dragId !== stageId,
        onDragStart: (event: DragEvent<HTMLDivElement>) => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', stageId);
            dragIdRef.current = stageId;
            setDragId(stageId);
        },
        onDragOver: (event: DragEvent<HTMLDivElement>) => {
            if (!dragIdRef.current) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            setDropTargetId(stageId);
        },
        onDrop: (event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            const draggedId = dragIdRef.current;
            const targetIndex = editableStages.findIndex((stage) => stage.id === stageId);
            if (draggedId && draggedId !== stageId && targetIndex !== -1) onReorderStage(draggedId, targetIndex);
            endDrag();
        },
        onDragEnd: endDrag
    } : undefined;
    const isTrajectoryInScene = isSceneInActiveScenes(TRAJECTORY_SCENE);
    const selectedStage = editableStages.find((stage) => panelItemKey.stage(stage.id) === selectedKey);
    const selectedIndex = selectedStage ? editableStages.indexOf(selectedStage) : -1;
    const savedRows = section?.rows ?? [];
    const hasModifications = savedRows.length > 0 || editableStages.length > 0;

    const selectAnalysis = (analysisSection: AnalysisSectionData) => {
        onSelectKey(panelItemKey.analysis(analysisSection.analysis._id));
        if (!analysisSection.isCurrentAnalysis) {
            onSelectScene(TRAJECTORY_SCENE, analysisSection.analysis);
        }
    };

    const renderSavedRow = (row: PipelineRunStageRow, isFirstAnalysis: boolean) => {
        if (row.kind === 'analysis') {
            const itemKey = panelItemKey.analysis(row.section.analysis._id);
            return (
                <AnalysisStageRow
                    key={row.key}
                    row={row}
                    isEdited={row.stage !== undefined && stageEdits?.[row.stage.index] !== undefined}
                    status={analysisStatus(row.section, statusMap)}
                    tone={toneByAnalysisId?.get(row.section.analysis._id)}
                    isSelected={selectedKey === itemKey}
                    onSelect={() => selectAnalysis(row.section)}
                    onDeleteAnalysis={onDeleteAnalysis}
                    canMutateCanvas={canMutateCanvas}
                    tourTargetId={isFirstAnalysis ? firstAnalysisTourTargetId : undefined}
                />
            );
        }

        const label = describePipelineRunStage(row.stage);
        const itemKey = panelItemKey.context(row.key);
        return (
            <PanelRow
                key={row.key}
                id={`canvas-stage-${row.key}`}
                label={label}
                title={row.kind === 'unavailable' ? `${label} — results not loaded for this timestep` : label}
                meta={row.kind === 'unavailable' && row.stage.cacheHit ? 'cached' : undefined}
                isOff={row.kind === 'unavailable'}
                isSelected={selectedKey === itemKey}
                onSelect={() => onSelectKey(itemKey)}
            />
        );
    };

    // OVITO's order: the data source at the foot, each later stage above the one it reads from.
    const savedRowsTopDown = [...savedRows].reverse();
    const firstAnalysisRowKey = savedRows.find((row) => row.kind === 'analysis')?.key;

    return (
        <div className='flex min-h-0 flex-1 flex-row gap-0.5 pl-2 pr-1.5'>
            <Scrollable className='flex min-w-0 flex-1 flex-col gap-px' role='listbox' aria-label='Pipeline'>
                <div className='flex flex-col gap-px' data-tour-id='canvas-analyses-section'>
                    <PanelGroupLabel>Visual elements</PanelGroupLabel>
                    <PanelRow
                        id='canvas-visual-trajectory'
                        label='Trajectory'
                        isSelected={selectedKey === panelItemKey.trajectory}
                        checkbox={{
                            isSelected: isTrajectoryInScene,
                            ariaLabel: `${isTrajectoryInScene ? 'Remove' : 'Add'} the trajectory ${isTrajectoryInScene ? 'from' : 'to'} the scene`,
                            onChange: (next) => (next ? addScene(TRAJECTORY_SCENE) : removeScene(TRAJECTORY_SCENE))
                        }}
                        onSelect={() => {
                            // Like a model's row, the trajectory's shows it, keeping the current analysis.
                            onSelectKey(panelItemKey.trajectory);
                            onSelectScene(TRAJECTORY_SCENE, analysisSections.find((candidate) => candidate.isCurrentAnalysis)?.analysis);
                        }}
                    />
                    <PanelRow
                        id='canvas-visual-simulation-cell'
                        label='Simulation cell'
                        isSelected={selectedKey === panelItemKey.cell}
                        checkbox={{
                            isSelected: showSimulationCell,
                            ariaLabel: `${showSimulationCell ? 'Hide' : 'Show'} the simulation cell`,
                            onChange: onToggleSimulationCell
                        }}
                        onSelect={() => onSelectKey(panelItemKey.cell)}
                    />
                    {analysisSections.map((analysisSection, index) => (
                        <AnalysisVisualRows
                            key={analysisSection.analysis._id}
                            section={analysisSection}
                            status={analysisStatus(analysisSection, statusMap)}
                            pluginsById={pluginsById}
                            selectedKey={selectedKey}
                            onSelectKey={onSelectKey}
                            onSelectScene={onSelectScene}
                            isSceneInActiveScenes={isSceneInActiveScenes}
                            addScene={addScene}
                            removeScene={removeScene}
                            onRetryLoadExposures={onRetryLoadExposures}
                            firstExposureTourTargetId={index === 0 ? firstExposureTourTargetId : undefined}
                        />
                    ))}
                </div>

                <PanelGroupLabel>Modifications</PanelGroupLabel>
                {!hasModifications && (
                    <span className='px-2.5 py-1.5 text-xs text-muted'>No modifications yet. Add one above.</span>
                )}
                {[...editableStages].reverse().map((stage) => {
                    const label = describeDraftStage(stage, pluginNameById);
                    const canToggle = canToggleStage(stage);
                    const itemKey = panelItemKey.stage(stage.id);
                    return (
                        <PanelRow
                            key={stage.id}
                            id={`canvas-stage-${stage.id}`}
                            label={label}
                            title={label}
                            meta={stage.type === 'analysis-plugin' && !stage.executed ? 'Not run' : undefined}
                            isOff={!stage.enabled}
                            isSelected={selectedKey === itemKey}
                            checkbox={{
                                isSelected: stage.enabled,
                                isDisabled: !canToggle || !canMutateCanvas,
                                ariaLabel: canToggle ? `${stage.enabled ? 'Disable' : 'Enable'} ${label}` : 'Run the pipeline to enable this stage',
                                onChange: () => onToggleStage(stage.id)
                            }}
                            onSelect={() => onSelectKey(itemKey)}
                            menuOptions={canMutateCanvas ? [{ label: 'Delete', onClick: () => onRemoveStage(stage.id), destructive: true }] : undefined}
                            drag={stageDrag(stage.id)}
                        />
                    );
                })}
                {savedRowsTopDown.map((row) => renderSavedRow(row, row.key === firstAnalysisRowKey))}

                <PanelGroupLabel>Data source</PanelGroupLabel>
                <PanelRow
                    id='canvas-data-source'
                    label={trajectoryName ?? 'Trajectory'}
                    isSelected={selectedKey === panelItemKey.source}
                    onSelect={() => onSelectKey(panelItemKey.source)}
                />
            </Scrollable>

            {/* Only stages this pipeline can still edit move or go; what ran is a record. */}
            <div className='flex shrink-0 flex-col gap-0.5' role='toolbar' aria-orientation='vertical' aria-label='Modification actions'>
                <Button
                    variant='ghost'
                    size='sm'
                    isIconOnly
                    className='size-7 min-w-7 rounded-full'
                    isDisabled={!selectedStage || !canMutateCanvas}
                    onPress={() => selectedStage && onRemoveStage(selectedStage.id)}
                    aria-label='Delete modification'
                >
                    <Trash2 size={13} aria-hidden='true' />
                </Button>
                <Separator className='mx-auto my-1 w-4' />
                <Button
                    variant='ghost'
                    size='sm'
                    isIconOnly
                    className='size-7 min-w-7 rounded-full'
                    isDisabled={!selectedStage || !canMutateCanvas || selectedIndex === editableStages.length - 1}
                    onPress={() => selectedStage && onMoveStage(selectedStage.id, 1)}
                    aria-label='Move modification up'
                >
                    <ChevronUp size={13} aria-hidden='true' />
                </Button>
                <Button
                    variant='ghost'
                    size='sm'
                    isIconOnly
                    className='size-7 min-w-7 rounded-full'
                    isDisabled={!selectedStage || !canMutateCanvas || selectedIndex <= 0}
                    onPress={() => selectedStage && onMoveStage(selectedStage.id, -1)}
                    aria-label='Move modification down'
                >
                    <ChevronDown size={13} aria-hidden='true' />
                </Button>
            </div>
        </div>
    );
};

export default PipelineContents;
