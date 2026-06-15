import './CanvasPipeline.css';
import {
    useCanvasPipelineStore,
    useStages,
    DEFAULT_SLICE_PLANE_STAGE_CONFIG,
    DEFAULT_COLOR_CODING_STAGE_CONFIG
} from '../../stores/canvas-pipeline';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { useEnsurePluginCatalogLoaded } from '@/modules/plugin/hooks/plugin/use-plugin-catalog';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useCloneIntentRunner from '../../hooks/use-clone-intent-runner';
import SlicePlane from '../SlicePlane';
import ColorCodingStageEditor from './stage-editors/ColorCodingStageEditor';
import ExpressionSelectStageEditor from './stage-editors/ExpressionSelectStageEditor';
import AnalysisPluginStageEditor from './stage-editors/AnalysisPluginStageEditor';
import { Box, Button, Popover, PopoverMenu, PopoverMenuItem, Row, SectionLabel, Stack, Text } from '@voltstack/bravais';
import { memo, useCallback, useEffect, useState } from 'react';
import { Filter, FlaskConical, GripVertical, Palette, Plus, Scissors, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PipelineStage, StageType, StageConfig } from '../../stores/canvas-pipeline';
import type { AnalysisPluginStageConfig, ExpressionSelectStageConfig } from '../../stores/canvas-pipeline';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory/trajectory';

interface CanvasPipelineProps {
    trajectory?: Trajectory | null;
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
    canMutateCanvas?: boolean;
}

const VIEW_STAGE_META: Record<Exclude<StageType, 'analysis-plugin'>, { label: string; icon: ReactNode }> = {
    'slice-plane': { label: 'Slice Plane', icon: <Scissors size={13} aria-hidden='true' /> },
    'color-coding': { label: 'Color Coding', icon: <Palette size={13} aria-hidden='true' /> },
    'expression-select': { label: 'Expression Select', icon: <Filter size={13} aria-hidden='true' /> }
};

const stageIcon = (stage: PipelineStage): ReactNode => {
    if (stage.type === 'analysis-plugin') return <FlaskConical size={13} aria-hidden='true' />;
    return VIEW_STAGE_META[stage.type].icon;
};

const stageLabel = (stage: PipelineStage, pluginNameById: Map<string, string>): string => {
    if (stage.type === 'analysis-plugin') {
        const cfg = stage.config as AnalysisPluginStageConfig;
        return pluginNameById.get(cfg.pluginId) ?? cfg.pluginId ?? 'Analysis';
    }
    if (stage.type === 'expression-select') {
        return (stage.config as ExpressionSelectStageConfig).expression?.trim() || 'Expression Select';
    }
    return VIEW_STAGE_META[stage.type].label;
};

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

    // Always-mounted: runs a pending foreign-trajectory clone-and-run intent once
    // the user lands on the destination canvas (was the AnalyzeLauncher modal's job).
    useCloneIntentRunner({ trajectoryId, isForeignTrajectory });

    const stages = useStages(trajectoryId);
    const addStage = useCanvasPipelineStore((s) => s.addStage);
    const removeStage = useCanvasPipelineStore((s) => s.removeStage);
    const reorderStage = useCanvasPipelineStore((s) => s.reorderStage);
    const toggleStageEnabled = useCanvasPipelineStore((s) => s.toggleStageEnabled);
    const setActiveTrajectory = useCanvasPipelineStore((s) => s.setActiveTrajectory);

    // Register the active trajectory so global getState() callers (AI tools, the
    // exposure chart, the global-attributes brush) append stages to this pipeline.
    useEffect(() => {
        setActiveTrajectory(trajectoryId ?? null);
        return () => setActiveTrajectory(null);
    }, [trajectoryId, setActiveTrajectory]);

    const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
    const [dragId, setDragId] = useState<string | null>(null);

    const pluginNameById = new Map(modifiers.map((m) => [m.pluginId, m.name]));

    const handleAdd = useCallback((type: StageType, config: StageConfig) => {
        if (!trajectoryId) return;
        const id = addStage(type, config, trajectoryId);
        if (id) setSelectedStageId(id);
    }, [addStage, trajectoryId]);

    const handleRemove = useCallback((id: string) => {
        removeStage(id, trajectoryId);
        setSelectedStageId((current) => (current === id ? null : current));
    }, [removeStage, trajectoryId]);

    const handleDrop = useCallback((targetId: string) => {
        if (!dragId || dragId === targetId) return;
        const targetIndex = stages.findIndex((s) => s.id === targetId);
        if (targetIndex === -1) return;
        reorderStage(dragId, targetIndex, trajectoryId);
        setDragId(null);
    }, [dragId, stages, reorderStage, trajectoryId]);

    const renderStageEditor = useCallback((stage: PipelineStage): ReactNode => {
        switch (stage.type) {
            case 'slice-plane':
                return <SlicePlane stageId={stage.id} trajectoryId={trajectoryId} />;
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
            case 'expression-select':
                return (
                    <ExpressionSelectStageEditor
                        stageId={stage.id}
                        trajectoryId={trajectoryId}
                        analysisId={analysisId}
                        currentTimestep={currentTimestep}
                    />
                );
            case 'analysis-plugin':
                return (
                    <AnalysisPluginStageEditor
                        stageId={stage.id}
                        trajectory={trajectory}
                        trajectoryId={trajectoryId}
                        currentTimestep={currentTimestep}
                        canMutateCanvas={canMutateCanvas}
                    />
                );
            default:
                return null;
        }
    }, [trajectory, trajectoryId, analysisId, currentTimestep, canMutateCanvas]);

    const selectedStage = stages.find((s) => s.id === selectedStageId) ?? null;

    return (
        <Stack gap='05' className='canvas-pipeline'>
            <Row justify='end' className='canvas-pipeline__toolbar'>
                <Popover
                    id='canvas-pipeline-add-menu'
                    noPadding
                    className='context-menu-popover context-menu-popover--md'
                    trigger={
                        <Button
                            variant='ghost'
                            size='sm'
                            shape='rounded'
                            leftIcon={<Plus size={12} />}
                            disabled={!canMutateCanvas || !trajectoryId}
                            aria-label='Add pipeline stage'
                            className='font-size-05'
                        >
                            Add
                        </Button>
                    }
                >
                    {(close) => (
                        <PopoverMenu label='Add pipeline stage'>
                            <SectionLabel className='canvas-pipeline__menu-group'>View</SectionLabel>
                            <PopoverMenuItem
                                icon={VIEW_STAGE_META['slice-plane'].icon}
                                label='Slice Plane'
                                size='sm'
                                onClick={() => { handleAdd('slice-plane', { ...DEFAULT_SLICE_PLANE_STAGE_CONFIG }); close(); }}
                            />
                            <PopoverMenuItem
                                icon={VIEW_STAGE_META['color-coding'].icon}
                                label='Color Coding'
                                size='sm'
                                onClick={() => { handleAdd('color-coding', { ...DEFAULT_COLOR_CODING_STAGE_CONFIG }); close(); }}
                            />
                            <PopoverMenuItem
                                icon={VIEW_STAGE_META['expression-select'].icon}
                                label='Expression Select'
                                size='sm'
                                onClick={() => { handleAdd('expression-select', { expression: '' }); close(); }}
                            />
                            {modifiers.length > 0 && (
                                <SectionLabel className='canvas-pipeline__menu-group'>Analysis</SectionLabel>
                            )}
                            {modifiers.map((modifier) => (
                                <PopoverMenuItem
                                    key={modifier.pluginId}
                                    icon={<FlaskConical size={13} aria-hidden='true' />}
                                    label={modifier.name}
                                    size='sm'
                                    onClick={() => {
                                        handleAdd('analysis-plugin', { pluginId: modifier.pluginId, argValues: {} });
                                        close();
                                    }}
                                />
                            ))}
                        </PopoverMenu>
                    )}
                </Popover>
            </Row>

            {stages.length === 0 ? (
                <Text size='xs' tone='muted' className='canvas-pipeline__empty'>
                    Add a View transform or run an analysis to build the pipeline.
                </Text>
            ) : (
                <Stack gap='025' className='canvas-pipeline__list'>
                    {stages.map((stage) => {
                        const isSelected = stage.id === selectedStageId;
                        return (
                            <Box
                                key={stage.id}
                                className={`canvas-pipeline-stage ${isSelected ? 'canvas-pipeline-stage--selected' : ''} ${dragId === stage.id ? 'canvas-pipeline-stage--dragging' : ''}`}
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
                                    <button
                                        type='button'
                                        className='canvas-pipeline-stage__select u-select-none'
                                        onClick={() => setSelectedStageId((current) => (current === stage.id ? null : stage.id))}
                                        aria-expanded={isSelected}
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
                                    </button>
                                    <Row gap='025' shrink='0' className='canvas-pipeline-stage__actions'>
                                        <button
                                            type='button'
                                            className='canvas-pipeline-stage__action'
                                            onClick={() => toggleStageEnabled(stage.id, trajectoryId)}
                                            aria-label={stage.enabled ? 'Disable stage' : 'Enable stage'}
                                            title={stage.enabled ? 'Disable' : 'Enable'}
                                        >
                                            {stage.enabled
                                                ? <ToggleRight size={13} aria-hidden='true' />
                                                : <ToggleLeft size={13} aria-hidden='true' />
                                            }
                                        </button>
                                        <button
                                            type='button'
                                            className='canvas-pipeline-stage__action canvas-pipeline-stage__action--remove'
                                            onClick={() => handleRemove(stage.id)}
                                            aria-label='Remove stage'
                                            title='Remove'
                                        >
                                            <Trash2 size={12} aria-hidden='true' />
                                        </button>
                                    </Row>
                                </Row>
                            </Box>
                        );
                    })}
                </Stack>
            )}

            {selectedStage && (
                <Box className='canvas-pipeline__editor'>
                    {renderStageEditor(selectedStage)}
                </Box>
            )}
        </Stack>
    );
};

export default memo(CanvasPipeline);
