import './CanvasPipeline.css';
import { useCanvasPipelineStore, useStages } from '../../store/canvas-pipeline';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { useEnsurePluginCatalogLoaded } from '@/modules/plugin/hooks/plugin/use-plugin-catalog';
import SlicePlane from '../SlicePlane';
import ExpressionSelectStageEditor from './stage-editors/ExpressionSelectStageEditor';
import AnalysisPluginStageEditor from './stage-editors/AnalysisPluginStageEditor';
import ColorCodingStageEditor from './stage-editors/ColorCodingStageEditor';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import { Box, Checkbox, Row, Stack, Text } from '@voltstack/bravais';
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
        <Stack gap='05' className='canvas-pipeline'>
            <Stack gap='025' className='canvas-pipeline__list'>
                {stages.map((stage) => {
                    const label = stageLabel(stage, pluginNameById);
                    const canToggle = isLiveToggleStage(stage) || stage.executed;

                    return (
                        <Box
                            key={stage.id}
                            className={`canvas-pipeline-stage ${dragId === stage.id ? 'canvas-pipeline-stage--dragging' : ''}`}
                            draggable
                            onDragStart={() => setDragId(stage.id)}
                            onDragEnd={() => setDragId(null)}
                            onDragOver={(e) => { e.preventDefault(); }}
                            onDrop={() => handleDrop(stage.id)}
                        >
                            <Row
                                gap='05'
                                className={`canvas-pipeline-stage__header ${!stage.enabled ? 'canvas-pipeline-stage__header--disabled' : ''}`}
                            >
                                <span className='canvas-pipeline-stage__grip' aria-hidden='true'>
                                    <GripVertical size={12} />
                                </span>

                                <ContextMenuPopover
                                    id={`canvas-pipeline-stage-config-${stage.id}`}
                                    triggerAction='click'
                                    placement='left-start'
                                    ariaLabel={`${label} settings`}
                                    className='context-menu-popover--plugin-config'
                                    trigger={
                                        <button
                                            type='button'
                                            className='canvas-pipeline-stage__select select-none'
                                            aria-label={`${label} settings`}
                                        >
                                            <span className='canvas-pipeline-stage__icon'>{STAGE_ICONS[stage.type]}</span>
                                            <Text
                                                size='sm'
                                                tone={stage.enabled ? 'secondary' : 'muted'}
                                                truncate
                                                className='canvas-pipeline-stage__label'
                                            >
                                                {label}
                                            </Text>
                                            <span className='canvas-pipeline-stage__gear' aria-hidden='true'>
                                                <Settings size={12} />
                                            </span>
                                        </button>
                                    }
                                    content={(close) => (
                                        <Stack className='canvas-plugin-popover-content'>
                                            {renderStageEditor(stage, close)}
                                        </Stack>
                                    )}
                                />

                                <Row gap='025' shrink='0' className='canvas-pipeline-stage__actions'>
                                    <button
                                        type='button'
                                        className='canvas-pipeline-stage__action canvas-pipeline-stage__action--remove'
                                        onClick={() => removeStage(stage.id, trajectoryId)}
                                        aria-label='Remove stage'
                                        title='Remove'
                                    >
                                        <Trash2 size={12} aria-hidden='true' />
                                    </button>
                                    <Checkbox
                                        checked={stage.enabled}
                                        disabled={!canToggle}
                                        onChange={() => toggleStageEnabled(stage.id, trajectoryId)}
                                        aria-label={stage.enabled ? 'Disable stage' : 'Enable stage'}
                                        title={canToggle ? (stage.enabled ? 'Disable' : 'Enable') : 'Run the pipeline to enable this stage'}
                                    />
                                </Row>
                            </Row>
                        </Box>
                    );
                })}
            </Stack>
        </Stack>
    );
};

export default memo(CanvasPipeline);
