import './CanvasPipeline.css';
import {
    useCanvasPipelineStore,
    useStages,
    isOrderedPipelineStage
} from '../../stores/canvas-pipeline';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { useEnsurePluginCatalogLoaded } from '@/modules/plugin/hooks/plugin/use-plugin-catalog';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useCloneIntentRunner from '../../hooks/use-clone-intent-runner';
import SlicePlane from '../SlicePlane';
import ExpressionSelectStageEditor from './stage-editors/ExpressionSelectStageEditor';
import AnalysisPluginStageEditor from './stage-editors/AnalysisPluginStageEditor';
import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import { Box, Checkbox, Row, Stack, Text } from '@voltstack/bravais';
import { memo, useCallback, useEffect, useState } from 'react';
import { Filter, FlaskConical, GripVertical, Scissors, Settings, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PipelineStage } from '../../stores/canvas-pipeline';
import type { AnalysisPluginStageConfig, ExpressionSelectStageConfig } from '../../stores/canvas-pipeline';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory/trajectory';

interface CanvasPipelineProps {
    trajectory?: Trajectory | null;
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
}

type OrderedViewStageType = 'slice-plane' | 'expression-select';

const VIEW_STAGE_META: Record<OrderedViewStageType, { label: string; icon: ReactNode }> = {
    'slice-plane': { label: 'Slice Plane', icon: <Scissors size={13} aria-hidden='true' /> },
    'expression-select': { label: 'Expression Select', icon: <Filter size={13} aria-hidden='true' /> }
};

const stageIcon = (stage: PipelineStage): ReactNode => {
    if (stage.type === 'analysis-plugin') return <FlaskConical size={13} aria-hidden='true' />;
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
    if (stage.type === 'slice-plane') return VIEW_STAGE_META['slice-plane'].label;
    return 'Stage';
};

const CanvasPipeline = ({
    trajectory,
    trajectoryId,
    analysisId,
    currentTimestep
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

    // Always-mounted: runs a pending foreign-trajectory clone-and-run intent once
    // the user lands on the destination canvas (was the AnalyzeLauncher modal's job).
    useCloneIntentRunner({ trajectoryId, isForeignTrajectory });

    // Only slice-plane / expression-select / analysis-plugin are part of the ordered
    // executable pipeline. color-coding stays a standalone bake (its own section).
    const allStages = useStages(trajectoryId);
    const stages = allStages.filter(isOrderedPipelineStage);
    const removeStage = useCanvasPipelineStore((s) => s.removeStage);
    const reorderStage = useCanvasPipelineStore((s) => s.reorderStage);
    const toggleStageEnabled = useCanvasPipelineStore((s) => s.toggleStageEnabled);
    const setActiveTrajectory = useCanvasPipelineStore((s) => s.setActiveTrajectory);

    // Register the active trajectory so global getState() callers (AI tools, the
    // exposure chart, the header Add menu) append stages to this pipeline.
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
        // Reorder against the full store array so filtered-out (color-coding) stages
        // keep their positions; translate the target's index in the full list.
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
            default:
                return null;
        }
    }, [trajectory, trajectoryId, analysisId, currentTimestep]);

    // Nothing to show until the user adds a stage (Add lives in the section
    // header now). Render nothing rather than an empty-state message.
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
                                    disabled={!stage.executed}
                                    onChange={() => toggleStageEnabled(stage.id, trajectoryId)}
                                    aria-label={stage.enabled ? 'Disable stage' : 'Enable stage'}
                                    title={stage.executed ? (stage.enabled ? 'Disable' : 'Enable') : 'Run the pipeline to enable this stage'}
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
