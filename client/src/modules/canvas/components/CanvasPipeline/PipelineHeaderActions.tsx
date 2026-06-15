import {
    useCanvasPipelineStore,
    useStages,
    isOrderedPipelineStage,
    DEFAULT_SLICE_PLANE_STAGE_CONFIG
} from '../../stores/canvas-pipeline';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { useEnsurePluginCatalogLoaded } from '@/modules/plugin/hooks/plugin/use-plugin-catalog';
import PipelineRunControl from './PipelineRunControl';
import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import { Button, Popover, PopoverMenu, PopoverMenuItem, Row, SectionLabel, Stack, Text } from '@voltstack/bravais';
import { useCallback } from 'react';
import { Filter, FlaskConical, Play, Plus, Scissors } from 'lucide-react';
import type { StageType, StageConfig } from '../../stores/canvas-pipeline';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory/trajectory';

interface PipelineHeaderActionsProps {
    trajectory?: Trajectory | null;
    trajectoryId?: string;
    currentTimestep?: number;
    canMutateCanvas?: boolean;
}

/**
 * The Pipeline section's header controls (Run + Add), rendered as the
 * RightCollapsible `headerAction` so they sit to the LEFT of the section's
 * collapse chevron. Kept separate from CanvasPipeline (the section body) because
 * the collapsible renders its header and body in different slots; both read the
 * same global canvas-pipeline store, so no prop threading is needed.
 */
const PipelineHeaderActions = ({
    trajectory,
    trajectoryId,
    currentTimestep,
    canMutateCanvas
}: PipelineHeaderActionsProps) => {
    useEnsurePluginCatalogLoaded();
    const { modifiers } = usePluginSelectors();
    const addStage = useCanvasPipelineStore((s) => s.addStage);
    const enabledOrderedCount = useStages(trajectoryId).filter(isOrderedPipelineStage).length;

    const handleAdd = useCallback((type: StageType, config: StageConfig) => {
        if (!trajectoryId) return;
        addStage(type, config, trajectoryId);
    }, [addStage, trajectoryId]);

    return (
        // Stop propagation so opening a control never toggles the section.
        <Row gap='025' onClick={(event) => event.stopPropagation()}>
            <ContextMenuPopover
                id='canvas-pipeline-run'
                triggerAction='click'
                placement='left-start'
                ariaLabel='Run pipeline'
                className='context-menu-popover--plugin-config'
                trigger={
                    <Button
                        variant='ghost'
                        size='sm'
                        shape='rounded'
                        iconOnly
                        leftIcon={<Play size={13} />}
                        disabled={!canMutateCanvas || !trajectoryId || enabledOrderedCount === 0}
                        aria-label='Run pipeline'
                    />
                }
                content={(close) => (
                    <Stack gap='05' className='canvas-plugin-popover-content'>
                        <Text size='sm' tone='secondary' weight='medium'>Pipeline</Text>
                        <PipelineRunControl
                            trajectory={trajectory}
                            trajectoryId={trajectoryId}
                            currentTimestep={currentTimestep}
                            canMutateCanvas={canMutateCanvas}
                            onClose={close}
                        />
                    </Stack>
                )}
            />

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
                        Add new
                    </Button>
                }
            >
                {(close) => (
                    <PopoverMenu label='Add pipeline stage'>
                        <SectionLabel className='canvas-pipeline__menu-group'>View</SectionLabel>
                        <PopoverMenuItem
                            icon={<Scissors size={13} aria-hidden='true' />}
                            label='Slice Plane'
                            size='sm'
                            onClick={() => { handleAdd('slice-plane', { ...DEFAULT_SLICE_PLANE_STAGE_CONFIG }); close(); }}
                        />
                        <PopoverMenuItem
                            icon={<Filter size={13} aria-hidden='true' />}
                            label='Expression Select'
                            size='sm'
                            onClick={() => { handleAdd('expression-select', { expression: '' }); close(); }}
                        />
                        {modifiers.length > 0 && (
                            <SectionLabel className='canvas-pipeline__menu-group'>Plugins</SectionLabel>
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
    );
};

export default PipelineHeaderActions;
