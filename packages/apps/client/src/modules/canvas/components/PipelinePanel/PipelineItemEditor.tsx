import {
    Button,
    Checkbox,
    ColorArea,
    ColorField,
    ColorPicker,
    ColorSlider,
    ColorSwatch,
    Label,
    NumberField,
    Slider
} from '@heroui/react';
import SlicePlane from '../SlicePlane';
import ExpressionSelectStageEditor from '../CanvasPipeline/stage-editors/ExpressionSelectStageEditor';
import AnalysisPluginStageEditor from '../CanvasPipeline/stage-editors/AnalysisPluginStageEditor';
import ColorCodingStageEditor from '../CanvasPipeline/stage-editors/ColorCodingStageEditor';
import ExecutionConfigSummary from '../AnalysisTreeNode/ExecutionConfigSummary';
import AnalysisResultsSection from '../AnalysisResultsSection';
import SavedStageParameters from './SavedStageParameters';
import { resolveAnalysisPluginId } from '@/modules/analysis/utils/resolve-plugin-id';
import { getSceneKey } from '@/modules/fractal/utils/scene-utils';
import { describeDraftStage, describePipelineRunStage } from '../../utils/pipeline-stage-labels';
import { CanvasAnalysisStatusEnum } from '../../utils/analysis-status';
import { resolveExposureScene } from './exposure-scene';
import { analysisStatus, panelItemKey } from './panel-items';
import { TRAJECTORY_SCENE } from './PipelineContents';

import type { ReactNode } from 'react';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import type { PipelineStage } from '../../store/canvas-pipeline';
import type { PipelineRunSection } from '../../utils/pipeline-run-sections';
import type { CanvasAnalysisStatusEntry } from '../../utils/analysis-status';
import type { SceneVisualOverrides } from '@/modules/fractal/contracts/scene';

interface PipelineItemEditorProps {
    selectedKey: string;
    trajectory?: Trajectory | null;
    trajectoryId?: string;
    pipelineKey: string;
    section?: PipelineRunSection;
    editableStages: PipelineStage[];
    pluginNameById: ReadonlyMap<string, string>;
    pluginsById: Record<string, Plugin>;
    statusMap: Map<string, CanvasAnalysisStatusEntry>;
    analysisId?: string;
    currentTimestep?: number;
    canMutateCanvas?: boolean;
    sceneVisualOverrides: SceneVisualOverrides;
    setSceneOpacity: (sceneKey: string, opacity: number) => void;
    setSceneLineWidth: (sceneKey: string, lineWidth: number) => void;
    setSceneColor: (sceneKey: string, color: string | undefined) => void;
    setSceneEdges: (sceneKey: string, edges: boolean) => void;
}

const SIMULATION_CELL_SCENE_KEY = 'simulation-cell';

// What a scene without a colour override is drawn in, as the tree's colour menu had it.
const DEFAULT_SCENE_COLOR = '#4d80e6';

const STATUS_LINE: Partial<Record<string, { text: string; className: string }>> = {
    [CanvasAnalysisStatusEnum.Pending]: { text: 'Queued', className: 'text-warning-soft-foreground' },
    [CanvasAnalysisStatusEnum.Running]: { text: 'Running', className: 'text-info-soft-foreground' },
    [CanvasAnalysisStatusEnum.Failed]: { text: 'Failed', className: 'text-danger-soft-foreground' }
};

// OVITO's rollouts: a heading and the selected item's settings, stacked.
const Rollout = ({ title, children }: { title: string; children: ReactNode }) => (
    <section className='flex flex-col border-foreground/[0.06] [&+&]:mt-1 [&+&]:border-t'>
        <h3 className='m-0 flex min-h-9 items-center truncate px-4 text-sm font-medium text-foreground'>{title}</h3>
        <div className='flex flex-col gap-3.5 px-4 pb-3.5'>{children}</div>
    </section>
);

const FieldGrid = ({ children }: { children: ReactNode }) => (
    <div className='grid grid-cols-[minmax(5.5rem,38%)_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 text-xs'>{children}</div>
);

const FieldLabel = ({ children }: { children: ReactNode }) => (
    <span className='min-w-0 truncate text-muted'>{children}</span>
);

interface SceneLookControlsProps {
    sceneKey: string;
    label: string;
    overrides: SceneVisualOverrides;
    setSceneOpacity: (sceneKey: string, opacity: number) => void;
    setSceneColor?: (sceneKey: string, color: string | undefined) => void;
    setSceneLineWidth?: (sceneKey: string, lineWidth: number) => void;
    setSceneEdges?: (sceneKey: string, edges: boolean) => void;
    defaultLineWidth?: number;
}

// The scene overrides the tree's context menus offered, as fields.
const SceneLookControls = ({
    sceneKey,
    label,
    overrides,
    setSceneOpacity,
    setSceneColor,
    setSceneLineWidth,
    setSceneEdges,
    defaultLineWidth
}: SceneLookControlsProps) => {
    const override = overrides[sceneKey];
    const opacity = override?.opacity ?? 1;

    return (
        <>
            <FieldGrid>
                <FieldLabel>Opacity</FieldLabel>
                <Slider
                    aria-label={`${label} opacity`}
                    minValue={0}
                    maxValue={1}
                    step={0.01}
                    value={opacity}
                    onChange={(next) => setSceneOpacity(sceneKey, Array.isArray(next) ? next[0] : next)}
                    className='w-full'
                >
                    <Slider.Track>
                        <Slider.Fill />
                        <Slider.Thumb />
                    </Slider.Track>
                </Slider>
                {setSceneColor && (
                    <>
                        <FieldLabel>Color</FieldLabel>
                        <span className='flex min-w-0 items-center gap-2'>
                            <ColorPicker
                                value={override?.color ?? DEFAULT_SCENE_COLOR}
                                onChange={(color) => setSceneColor(sceneKey, color.toString('hex'))}
                            >
                                <ColorPicker.Trigger aria-label={`${label} color`}>
                                    <ColorSwatch size='sm' />
                                </ColorPicker.Trigger>
                                <ColorPicker.Popover>
                                    <ColorArea colorSpace='hsb' xChannel='saturation' yChannel='brightness'>
                                        <ColorArea.Thumb />
                                    </ColorArea>
                                    <ColorSlider colorSpace='hsb' channel='hue' aria-label='Hue'>
                                        <ColorSlider.Track>
                                            <ColorSlider.Thumb />
                                        </ColorSlider.Track>
                                    </ColorSlider>
                                    <ColorField aria-label='Hex color'>
                                        <ColorField.Group>
                                            <ColorField.Input />
                                        </ColorField.Group>
                                    </ColorField>
                                </ColorPicker.Popover>
                            </ColorPicker>
                            {override?.color && (
                                <Button variant='ghost' size='sm' className='text-xs' onPress={() => setSceneColor(sceneKey, undefined)}>
                                    Reset
                                </Button>
                            )}
                        </span>
                    </>
                )}
                {setSceneLineWidth && defaultLineWidth !== undefined && (
                    <>
                        <FieldLabel>Line width</FieldLabel>
                        <NumberField
                            aria-label={`${label} line width`}
                            minValue={0.5}
                            step={0.5}
                            value={override?.lineWidth ?? defaultLineWidth}
                            onChange={(next) => {
                                if (Number.isFinite(next) && next > 0) setSceneLineWidth(sceneKey, next);
                            }}
                        >
                            <NumberField.Group>
                                <NumberField.DecrementButton />
                                <NumberField.Input />
                                <NumberField.IncrementButton />
                            </NumberField.Group>
                        </NumberField>
                    </>
                )}
            </FieldGrid>
            {setSceneEdges && (
                <Checkbox isSelected={override?.edges ?? false} onChange={(next) => setSceneEdges(sceneKey, next)}>
                    <Checkbox.Content>
                        <Checkbox.Control>
                            <Checkbox.Indicator />
                        </Checkbox.Control>
                        <Label className='text-xs'>Show edges</Label>
                    </Checkbox.Content>
                </Checkbox>
            )}
        </>
    );
};

const PipelineItemEditor = ({
    selectedKey,
    trajectory,
    trajectoryId,
    pipelineKey,
    section,
    editableStages,
    pluginNameById,
    pluginsById,
    statusMap,
    analysisId,
    currentTimestep,
    canMutateCanvas,
    sceneVisualOverrides,
    setSceneOpacity,
    setSceneLineWidth,
    setSceneColor,
    setSceneEdges
}: PipelineItemEditorProps) => {
    const sceneControls = {
        overrides: sceneVisualOverrides,
        setSceneOpacity
    };

    if (selectedKey === panelItemKey.trajectory) {
        return (
            <Rollout title='Trajectory'>
                <SceneLookControls {...sceneControls} sceneKey={getSceneKey(TRAJECTORY_SCENE)} label='Trajectory' setSceneColor={setSceneColor} />
            </Rollout>
        );
    }

    if (selectedKey === panelItemKey.cell) {
        return (
            <Rollout title='Simulation cell'>
                <SceneLookControls {...sceneControls} sceneKey={SIMULATION_CELL_SCENE_KEY} label='Simulation cell' />
            </Rollout>
        );
    }

    if (selectedKey === panelItemKey.source) {
        const frames = trajectory?.frames?.length ?? trajectory?.framesCount;
        return (
            <Rollout title={trajectory?.name ?? 'Trajectory'}>
                <FieldGrid>
                    <FieldLabel>Name</FieldLabel>
                    <span className='min-w-0 truncate'>{trajectory?.name ?? '—'}</span>
                    {frames !== undefined && (
                        <>
                            <FieldLabel>Frames</FieldLabel>
                            <span className='tabular-nums'>{frames.toLocaleString()}</span>
                        </>
                    )}
                </FieldGrid>
            </Rollout>
        );
    }

    const stage = editableStages.find((candidate) => panelItemKey.stage(candidate.id) === selectedKey);
    if (stage) {
        // The expression is already in its own field, so its rollout is named by the modifier.
        const title = stage.type === 'expression-select' ? 'Expression select' : describeDraftStage(stage, pluginNameById);
        return (
            <Rollout title={title}>
                {stage.type === 'slice-plane' && <SlicePlane stageId={stage.id} trajectoryId={pipelineKey} />}
                {stage.type === 'expression-select' && (
                    <ExpressionSelectStageEditor
                        stageId={stage.id}
                        trajectoryId={trajectoryId}
                        pipelineKey={pipelineKey}
                        analysisId={analysisId}
                        currentTimestep={currentTimestep}
                    />
                )}
                {stage.type === 'analysis-plugin' && (
                    <AnalysisPluginStageEditor stageId={stage.id} trajectory={trajectory} trajectoryId={pipelineKey} />
                )}
                {stage.type === 'color-coding' && (
                    <ColorCodingStageEditor
                        stageId={stage.id}
                        trajectoryId={trajectoryId}
                        pipelineKey={pipelineKey}
                        analysisId={analysisId}
                        currentTimestep={currentTimestep}
                        canMutateCanvas={canMutateCanvas}
                    />
                )}
            </Rollout>
        );
    }

    const analysisSections = section?.analysisSections ?? [];

    const analysisSection = analysisSections.find((candidate) => panelItemKey.analysis(candidate.analysis._id) === selectedKey);
    if (analysisSection) {
        const { analysis } = analysisSection;
        const pluginId = resolveAnalysisPluginId(analysis);
        const status = analysisStatus(analysisSection, statusMap);
        const statusLine = status ? STATUS_LINE[status] : undefined;
        const savedStage = section?.run
            ? section.rows.find((row) => row.kind === 'analysis' && row.section.analysis._id === analysis._id)?.stage
            : undefined;
        const editableStage = canMutateCanvas && savedStage?.pluginId
            ? { ...savedStage, pluginId: savedStage.pluginId }
            : undefined;
        return (
            <>
                <Rollout title={analysis.pluginDisplayName}>
                    {statusLine && <p className={`m-0 text-xs ${statusLine.className}`}>{statusLine.text}</p>}
                    {editableStage ? (
                        <SavedStageParameters pipelineKey={pipelineKey} stage={editableStage} trajectory={trajectory} />
                    ) : (
                        <ExecutionConfigSummary config={analysis.config} plugin={pluginsById[pluginId]} pluginsById={pluginsById} compact />
                    )}
                </Rollout>
                <AnalysisResultsRollout analysisId={analysis._id} pluginId={pluginId} currentTimestep={currentTimestep} />
            </>
        );
    }

    for (const candidate of analysisSections) {
        const exposure = candidate.entry.exposures.find((entry) =>
            panelItemKey.exposure(candidate.analysis._id, entry.exposureId) === selectedKey);
        if (!exposure) continue;

        const pluginId = resolveAnalysisPluginId(candidate.analysis);
        const { sceneKey, isLine, isMesh, defaultLineWidth } = resolveExposureScene(exposure, pluginId, pluginsById);
        return (
            <Rollout title={exposure.name}>
                <SceneLookControls
                    {...sceneControls}
                    sceneKey={sceneKey}
                    label={exposure.name}
                    setSceneColor={setSceneColor}
                    setSceneLineWidth={isLine ? setSceneLineWidth : undefined}
                    setSceneEdges={isMesh ? setSceneEdges : undefined}
                    defaultLineWidth={isLine ? defaultLineWidth : undefined}
                />
            </Rollout>
        );
    }

    const contextRow = section?.rows.find((row) => panelItemKey.context(row.key) === selectedKey);
    if (contextRow && contextRow.kind !== 'analysis') {
        const entries = Object.entries(contextRow.stage.config);
        return (
            <Rollout title={describePipelineRunStage(contextRow.stage)}>
                {contextRow.kind === 'unavailable' && (
                    <p className='m-0 text-xs text-muted'>No results at this timestep.</p>
                )}
                {entries.length > 0 && (
                    <FieldGrid>
                        {entries.map(([key, value]) => (
                            <span className='contents' key={key}>
                                <FieldLabel>{key}</FieldLabel>
                                <span className='min-w-0 truncate tabular-nums'>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                            </span>
                        ))}
                    </FieldGrid>
                )}
            </Rollout>
        );
    }

    return null;
};

// Results get their own rollout, and none while the analysis has no table for this timestep.
const AnalysisResultsRollout = ({ analysisId, pluginId, currentTimestep }: { analysisId: string; pluginId: string; currentTimestep?: number }) => (
    <section className='flex flex-col border-t border-foreground/[0.06] [&:has(>div:empty)]:hidden [&:has(>div>.hidden)]:hidden'>
        <h3 className='m-0 flex min-h-9 items-center px-4 text-sm font-medium text-foreground'>Results</h3>
        <div className='px-1.5 pb-2'>
            <AnalysisResultsSection analysisId={analysisId} pluginId={pluginId} currentTimestep={currentTimestep} embedded />
        </div>
    </section>
);

export default PipelineItemEditor;
