import './CanvasPipeline.css';
import {
    useCanvasPipelineStore,
    useStages,
    isOrderedPipelineStage
} from '../../store/canvas-pipeline';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { useEnsurePluginCatalogLoaded } from '@/modules/plugin/hooks/plugin/use-plugin-catalog';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useCloneIntentRunner from '../../hooks/use-clone-intent-runner';
import SlicePlane from '../SlicePlane';
import ExpressionSelectStageEditor from './stage-editors/ExpressionSelectStageEditor';
import AnalysisPluginStageEditor from './stage-editors/AnalysisPluginStageEditor';
import ColorCodingStageEditor from './stage-editors/ColorCodingStageEditor';
import LineStyleStageEditor from './stage-editors/LineStyleStageEditor';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import { Box, Checkbox, Row, Stack, Text } from '@voltstack/bravais';
import { memo, useCallback, useEffect, useState } from 'react';
import { Filter, FlaskConical, GripVertical, Palette, Scissors, Settings, Spline, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PipelineStage } from '../../store/canvas-pipeline';
import type { AnalysisPluginStageConfig, ExpressionSelectStageConfig } from '../../store/canvas-pipeline';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

interface CanvasPipelineProps {
    trajectory?: Trajectory | null;
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
    canMutateCanvas?: boolean;
}

type OrderedViewStageType = 'slice-plane' | 'expression-select';

const VIEW_STAGE_META: Record<OrderedViewStageType, { label: string; icon: ReactNode }> = {
    'slice-plane': {
        label: 'Slice Plane',
        icon: <Scissors size={13} aria-hidden='true' />
    },
    'expression-select': {
        label: 'Expression Select',
        icon: <Filter size={13} aria-hidden='true' />
    }
};

const stageIcon = (stage: PipelineStage): ReactNode => {
    if (stage.type === 'analysis-plugin') return <FlaskConical size={13} aria-hidden='true' />;
    if (stage.type === 'color-coding') return <Palette size={13} aria-hidden='true' />;
    if (stage.type === 'line-style') return <Spline size={13} aria-hidden='true' />;
    if (stage.type === 'slice-plane' || stage.type === 'expression-select') return VIEW_STAGE_META[stage.type].icon;
    return <FlaskConical size={13} aria-hidden='true' />;
};

const stageLabel = (stage: PipelineStage, pluginNameById: Map<string, string>): string => {
    if (stage.type === 'analysis-plugin') {
        const cfg = stage.config as AnalysisPluginStageConfig;
        return pluginNameById.get(cfg.pluginId) ?? cfg.pluginId ?? 'Analysis';
    }
    if (stage.type === 'expression-select') {
        return (stage.config as ExpressionSelectStageConfig).expression?.trim() || 'Expression Select';
    }
    if (stage.type === 'color-coding') return 'Color Coding';
    if (stage.type === 'line-style') return 'Line Style';
    if (stage.type === 'slice-plane') return VIEW_STAGE_META['slice-plane'].label;
    return 'Stage';
};

const isStandaloneBakeStage = (stage: PipelineStage): boolean =>
    stage.type === 'color-coding' || stage.type === 'line-style';

const isLiveToggleStage = (stage: PipelineStage): boolean =>
    isStandaloneBakeStage(stage) || stage.type === 'expression-select';

const CanvasPipeline = ({
    trajectory,
    trajectoryId,
    analysisId,
    currentTimestep,
    canMutateCanvas
}: CanvasPipelineProps) => {
    useEnsurePluginCatalogLoaded();
    const { modifiers } = usePluginSelectors();
    const selectedTeamId = useSelectedTeamId();

    const trajectoryTeamId = ((): string | undefined => {
        const team = trajectory?.team;
        if (!team) return undefined;
        if (typeof team === 'string') return team;
        if (typeof team === 'object' && '_id' in team) return (team as { _id: string })._id;
        return undefined;
    })();
    const isForeignTrajectory = Boolean(selectedTeamId && trajectoryTeamId && trajectoryTeamId !== selectedTeamId);

    useCloneIntentRunner({
        trajectoryId,
        isForeignTrajectory
    });

    const allStages = useStages(trajectoryId);
    const stages = allStages.filter((stage) =>
        isOrderedPipelineStage(stage) || stage.type === 'color-coding' || stage.type === 'line-style');
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

    const handleRemove = useCallback((id: string) => {
        removeStage(id, trajectoryId);
    }, [removeStage, trajectoryId]);

    const handleDrop = useCallback((targetId: string) => {
        if (!dragId || dragId === targetId) return;
        const targetIndex = allStages.findIndex((s) => s.id === targetId);
        if (targetIndex === -1) return;
        reorderStage(dragId, targetIndex, trajectoryId);
        setDragId(null);
    }, [dragId, allStages, reorderStage, trajectoryId]);

    const renderStageEditor = useCallback((stage: PipelineStage, close: () => void): ReactNode => {
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
            case 'line-style':
                return (
                    <LineStyleStageEditor
                        trajectoryId={trajectoryId}
                        analysisId={analysisId}
                        currentTimestep={currentTimestep}
                        canMutateCanvas={canMutateCanvas}
                    />
                );
            default:
                return null;
        }
    }, [trajectory, trajectoryId, analysisId, currentTimestep, canMutateCanvas]);

    if (stages.length === 0) {
        return null;
    }

    return (
        <Stack gap='05' className='canvas-pipeline'>
            <Stack gap='025' className='canvas-pipeline__list'>
                {stages.map((stage) => (
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
                                ariaLabel={`${stageLabel(stage, pluginNameById)} settings`}
                                className='context-menu-popover--plugin-config'
                                trigger={
                                    <button
                                        type='button'
                                        className='canvas-pipeline-stage__select u-select-none'
                                        aria-label={`${stageLabel(stage, pluginNameById)} settings`}
                                    >
                                        <span className='canvas-pipeline-stage__icon'>{stageIcon(stage)}</span>
                                        <Text
                                            size='sm'
                                            tone={stage.enabled ? 'secondary' : 'muted'}
                                            truncate
                                            className='canvas-pipeline-stage__label'
                                        >
                                            {stageLabel(stage, pluginNameById)}
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
                                    onClick={() => handleRemove(stage.id)}
                                    aria-label='Remove stage'
                                    title='Remove'
                                >
                                    <Trash2 size={12} aria-hidden='true' />
                                </button>
                                <Checkbox
                                    checked={stage.enabled}
                                    disabled={isLiveToggleStage(stage) ? false : !stage.executed}
                                    onChange={() => toggleStageEnabled(stage.id, trajectoryId)}
                                    aria-label={stage.enabled ? 'Disable stage' : 'Enable stage'}
                                    title={(isLiveToggleStage(stage) || stage.executed) ? (stage.enabled ? 'Disable' : 'Enable') : 'Run the pipeline to enable this stage'}
                                />
                            </Row>
                        </Row>
                    </Box>
                ))}
            </Stack>
        </Stack>
    );
};

export default memo(CanvasPipeline);
