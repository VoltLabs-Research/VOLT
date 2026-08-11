import { Checkbox, cn } from '@heroui/react';
import { useCanvasPipelineStore, useStages } from '../../store/canvas-pipeline';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { useEnsurePluginCatalogLoaded } from '@/modules/plugin/hooks/plugin/use-plugin-catalog';
import SlicePlane from '../SlicePlane';
import ExpressionSelectStageEditor from './stage-editors/ExpressionSelectStageEditor';
import AnalysisPluginStageEditor from './stage-editors/AnalysisPluginStageEditor';
import ColorCodingStageEditor from './stage-editors/ColorCodingStageEditor';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import {
    PIPELINE_CLASS,
    PIPELINE_LIST_CLASS,
    PLUGIN_CONFIG_PANEL_CLASS,
    PLUGIN_POPOVER_CONTENT_CLASS,
    STAGE_ACTIONS_CLASS,
    STAGE_ACTION_CLASS,
    STAGE_ACTION_REMOVE_CLASS,
    STAGE_CLASS,
    STAGE_DRAGGING_CLASS,
    STAGE_GEAR_CLASS,
    STAGE_GRIP_CLASS,
    STAGE_HEADER_CLASS,
    STAGE_HEADER_DISABLED_CLASS,
    STAGE_ICON_CLASS,
    STAGE_LABEL_CLASS,
    STAGE_SELECT_CLASS
} from './pipeline-classes';
import { memo, useEffect, useState } from 'react';
import { Filter, FlaskConical, GripVertical, Palette, Scissors, Settings, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PipelineStage, StageType } from '../../store/canvas-pipeline';
import type { AnalysisPluginStageConfig, ExpressionSelectStageConfig } from '../../store/canvas-pipeline';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

interface CanvasPipelineProps {
    trajectory?: Trajectory | null;
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
    canMutateCanvas?: boolean;
}

const STAGE_ICONS: Record<StageType, ReactNode> = {
    'analysis-plugin': <FlaskConical size={13} aria-hidden='true' />,
    'color-coding': <Palette size={13} aria-hidden='true' />,
    'slice-plane': <Scissors size={13} aria-hidden='true' />,
    'expression-select': <Filter size={13} aria-hidden='true' />
};

const STAGE_LABELS: Record<StageType, string> = {
    'analysis-plugin': 'Analysis',
    'color-coding': 'Color Coding',
    'slice-plane': 'Slice Plane',
    'expression-select': 'Expression Select'
};

const stageLabel = (stage: PipelineStage, pluginNameById: Map<string, string>): string => {
    if (stage.type === 'analysis-plugin') {
        const { pluginId } = stage.config as AnalysisPluginStageConfig;
        return pluginNameById.get(pluginId) ?? pluginId;
    }
    if (stage.type === 'expression-select') {
        return (stage.config as ExpressionSelectStageConfig).expression.trim() || STAGE_LABELS[stage.type];
    }
    return STAGE_LABELS[stage.type];
};

// Stages that restyle the scene client-side can be toggled before the pipeline ever runs.
const isLiveToggleStage = (stage: PipelineStage): boolean =>
    stage.type === 'color-coding'
    || stage.type === 'expression-select';

const CanvasPipeline = ({
    trajectory,
    trajectoryId,
    analysisId,
    currentTimestep,
    canMutateCanvas
}: CanvasPipelineProps) => {
    useEnsurePluginCatalogLoaded();
    const { modifiers } = usePluginSelectors();
    const stages = useStages(trajectoryId);
    const removeStage = useCanvasPipelineStore((s) => s.removeStage);
    const reorderStage = useCanvasPipelineStore((s) => s.reorderStage);
    const toggleStageEnabled = useCanvasPipelineStore((s) => s.toggleStageEnabled);
    const setActiveTrajectory = useCanvasPipelineStore((s) => s.setActiveTrajectory);

    useEffect(() => {
        setActiveTrajectory(trajectoryId ?? null);
        return () => setActiveTrajectory(null);
    }, [trajectoryId, setActiveTrajectory]);

    const [dragId, setDragId] = useState<string | null>(null);

    const pluginNameById = new Map(modifiers.map((m) => [m.pluginId, m.name]));

    const handleDrop = (targetId: string) => {
        if (!dragId || dragId === targetId) return;
        const targetIndex = stages.findIndex((s) => s.id === targetId);
        if (targetIndex === -1) return;
        reorderStage(dragId, targetIndex, trajectoryId);
        setDragId(null);
    };

    const renderStageEditor = (stage: PipelineStage, close: () => void): ReactNode => {
        switch (stage.type) {
            case 'slice-plane':
                return <SlicePlane stageId={stage.id} trajectoryId={trajectoryId} />;
            case 'expression-select':
                return (
                    <ExpressionSelectStageEditor
                        stageId={stage.id}
                        trajectoryId={trajectoryId}
                        analysisId={analysisId}
                        currentTimestep={currentTimestep}
                        onSave={close}
                    />
                );
            case 'analysis-plugin':
                return (
                    <AnalysisPluginStageEditor
                        stageId={stage.id}
                        trajectory={trajectory}
                        trajectoryId={trajectoryId}
                        onSave={close}
                    />
                );
            case 'color-coding':
                return (
                    <ColorCodingStageEditor
                        stageId={stage.id}
                        trajectoryId={trajectoryId}
                        analysisId={analysisId}
                        currentTimestep={currentTimestep}
                        canMutateCanvas={canMutateCanvas}
                    />
                );
        }
    };

    if (stages.length === 0) {
        return null;
    }

    return (
        <div className={PIPELINE_CLASS}>
            <div className={PIPELINE_LIST_CLASS}>
                {stages.map((stage) => {
                    const label = stageLabel(stage, pluginNameById);
                    const canToggle = isLiveToggleStage(stage) || stage.executed;

                    return (
                        <div className={cn(STAGE_CLASS, dragId === stage.id && STAGE_DRAGGING_CLASS)}
                            key={stage.id}
                            draggable
                            onDragStart={() => setDragId(stage.id)}
                            onDragEnd={() => setDragId(null)}
                            onDragOver={(e) => { e.preventDefault(); }}
                            onDrop={() => handleDrop(stage.id)}
                        >
                            <div className={cn(STAGE_HEADER_CLASS, !stage.enabled && STAGE_HEADER_DISABLED_CLASS)}>
                                <span className={STAGE_GRIP_CLASS} aria-hidden='true'>
                                    <GripVertical size={12} />
                                </span>

                                <ContextMenuPopover
                                    id={`canvas-pipeline-stage-config-${stage.id}`}
                                    triggerAction='click'
                                    placement='left-start'
                                    ariaLabel={`${label} settings`}
                                    className={PLUGIN_CONFIG_PANEL_CLASS}
                                    trigger={
                                        <button
                                            type='button'
                                            className={STAGE_SELECT_CLASS}
                                            aria-label={`${label} settings`}
                                        >
                                            <span className={STAGE_ICON_CLASS}>{STAGE_ICONS[stage.type]}</span>
                                            {/* bravais `Text tone='secondary'|'muted'` — both collapse to `text-muted` (spec §3a). */}
                                            <span className={cn(STAGE_LABEL_CLASS, 'text-muted')}>
                                                {label}
                                            </span>
                                            <span className={STAGE_GEAR_CLASS} aria-hidden='true'>
                                                <Settings size={12} />
                                            </span>
                                        </button>
                                    }
                                    content={(close) => (
                                        <div className={PLUGIN_POPOVER_CONTENT_CLASS}>
                                            {renderStageEditor(stage, close)}
                                        </div>
                                    )}
                                />

                                <div className={STAGE_ACTIONS_CLASS}>
                                    <button
                                        type='button'
                                        className={cn(STAGE_ACTION_CLASS, STAGE_ACTION_REMOVE_CLASS)}
                                        onClick={() => removeStage(stage.id, trajectoryId)}
                                        aria-label='Remove stage'
                                        title='Remove'
                                    >
                                        <Trash2 size={12} aria-hidden='true' />
                                    </button>
                                    {/*
                                      * `title` is not on HeroUI's Checkbox prop surface, so the
                                      * hover hint moves to a wrapping span — a Tooltip here would
                                      * add a tab stop to every stage row.
                                      */}
                                    <span
                                        className='inline-flex'
                                        title={canToggle ? (stage.enabled ? 'Disable' : 'Enable') : 'Run the pipeline to enable this stage'}
                                    >
                                        <Checkbox
                                            isSelected={stage.enabled}
                                            isDisabled={!canToggle}
                                            onChange={() => toggleStageEnabled(stage.id, trajectoryId)}
                                            aria-label={stage.enabled ? 'Disable stage' : 'Enable stage'}
                                        >
                                            <Checkbox.Content>
                                                <Checkbox.Control>
                                                    <Checkbox.Indicator />
                                                </Checkbox.Control>
                                            </Checkbox.Content>
                                        </Checkbox>
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default memo(CanvasPipeline);
