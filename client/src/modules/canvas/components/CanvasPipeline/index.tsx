import { Checkbox, cn } from '@heroui/react';
import { useCanvasPipelineStore, useStages } from '../../store/canvas-pipeline';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { useEnsurePluginCatalogLoaded } from '@/modules/plugin/hooks/plugin/use-plugin-catalog';
import SlicePlane from '../SlicePlane';
import ExpressionSelectStageEditor from './stage-editors/ExpressionSelectStageEditor';
import AnalysisPluginStageEditor from './stage-editors/AnalysisPluginStageEditor';
import ColorCodingStageEditor from './stage-editors/ColorCodingStageEditor';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
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
        <div className='flex flex-col gap-2 p-1.5'>
            <div className='flex flex-col gap-1'>
                {stages.map((stage) => {
                    const label = stageLabel(stage, pluginNameById);
                    const canToggle = isLiveToggleStage(stage) || stage.executed;

                    return (
                        <div className={cn('group overflow-hidden rounded-lg border border-border', dragId === stage.id && 'opacity-50')}
                            key={stage.id}
                            draggable
                            onDragStart={() => setDragId(stage.id)}
                            onDragEnd={() => setDragId(null)}
                            onDragOver={(e) => { e.preventDefault(); }}
                            onDrop={() => handleDrop(stage.id)}
                        >
                            <div className={cn('flex flex-row items-center gap-2 px-1.5 py-1', !stage.enabled && 'opacity-55')}>
                                <span className='flex cursor-grab items-center text-muted' aria-hidden='true'>
                                    <GripVertical size={12} />
                                </span>
                                <ContextMenuPopover
                                    id={`canvas-pipeline-stage-config-${stage.id}`}
                                    triggerAction='click'
                                    placement='left-start'
                                    ariaLabel={`${label} settings`}
                                    className='min-w-[min(22rem,calc(100vw-2rem))] max-w-[min(24rem,calc(100vw-2rem))]'
                                    trigger={
                                        <button
                                            type='button'
                                            className='flex min-w-0 flex-1 cursor-pointer select-none items-center gap-1.5 border-none bg-transparent p-0 text-inherit'
                                            aria-label={`${label} settings`}
                                        >
                                            <span className='flex items-center text-muted'>{STAGE_ICONS[stage.type]}</span>
                                            <span className={cn('min-w-0 flex-1 truncate text-left text-sm', 'text-muted')}>
                                                {label}
                                            </span>
                                            <span className='ml-auto flex items-center text-muted opacity-0 transition-opacity duration-[120ms] ease-out group-hover:opacity-100 group-focus-within:opacity-100' aria-hidden='true'>
                                                <Settings size={12} />
                                            </span>
                                        </button>
                                    }
                                    content={(close) => (
                                        <div className='flex min-w-[min(21rem,calc(100vw-3rem))] max-h-[min(70vh,32rem)] flex-col overflow-hidden origin-top-right'>
                                            {renderStageEditor(stage, close)}
                                        </div>
                                    )}
                                />
                                <div className='flex shrink-0 flex-row items-center gap-1'>
                                    <button
                                        type='button'
                                        className={cn('flex cursor-pointer items-center rounded-lg border-none bg-transparent p-0.5 text-muted hover:text-foreground', 'opacity-0 transition-opacity duration-[120ms] ease-out hover:text-danger group-hover:opacity-100 group-focus-within:opacity-100')}
                                        onClick={() => removeStage(stage.id, trajectoryId)}
                                        aria-label='Remove stage'
                                        title='Remove'
                                    >
                                        <Trash2 size={12} aria-hidden='true' />
                                    </button>
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
