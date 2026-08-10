import {
    useCanvasPipelineStore,
    useStages,
    isOrderedPipelineStage,
    DEFAULT_SLICE_PLANE_STAGE_CONFIG,
    DEFAULT_COLOR_CODING_STAGE_CONFIG,
    DEFAULT_EXPRESSION_SELECT_STAGE_CONFIG
} from '../../store/canvas-pipeline';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { useEnsurePluginCatalogLoaded } from '@/modules/plugin/hooks/plugin/use-plugin-catalog';
import PipelineRunControl from './PipelineRunControl';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import { Button, Popover, PopoverMenu, PopoverMenuItem } from '@voltstack/bravais';
import { Filter, FlaskConical, Palette, Play, Plus, Scissors } from 'lucide-react';
import type { StageType, StageConfig } from '../../store/canvas-pipeline';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

interface PipelineHeaderActionsProps {
    trajectory?: Trajectory | null;
    trajectoryId?: string;
    currentTimestep?: number;
    canMutateCanvas?: boolean;
}

const PipelineHeaderActions = ({
    trajectory,
    trajectoryId,
    currentTimestep,
    canMutateCanvas
}: PipelineHeaderActionsProps) => {
    useEnsurePluginCatalogLoaded();
    const { modifiers } = usePluginSelectors();
    const addStage = useCanvasPipelineStore((s) => s.addStage);
    const orderedStageCount = useStages(trajectoryId).filter(isOrderedPipelineStage).length;

    const handleAdd = (type: StageType, config: StageConfig) => {
        addStage(type, config, trajectoryId);
    };

    return (
        <div className='flex flex-row items-center gap-1' onClick={(event) => event.stopPropagation()}>
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
                        disabled={!canMutateCanvas || !trajectoryId || orderedStageCount === 0}
                        aria-label='Run pipeline'
                    />
                }
                content={(close) => (
                    <div className='flex flex-col gap-2 canvas-plugin-popover-content'>
                        <span className='text-xs font-medium text-muted'>Pipeline</span>
                        <PipelineRunControl
                            trajectory={trajectory}
                            trajectoryId={trajectoryId}
                            currentTimestep={currentTimestep}
                            canMutateCanvas={canMutateCanvas}
                            onClose={close}
                        />
                    </div>
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
                        className='text-xs'
                    >
                        Add new
                    </Button>
                }
            >
                {(close) => (
                    <PopoverMenu label='Add pipeline stage'>
                        <span className='text-xs font-semibold uppercase tracking-[0.05em] text-muted canvas-pipeline__menu-group'>View</span>
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
                            onClick={() => { handleAdd('expression-select', { ...DEFAULT_EXPRESSION_SELECT_STAGE_CONFIG }); close(); }}
                        />
                        <PopoverMenuItem
                            icon={<Palette size={13} aria-hidden='true' />}
                            label='Color Coding'
                            size='sm'
                            onClick={() => { handleAdd('color-coding', { ...DEFAULT_COLOR_CODING_STAGE_CONFIG }); close(); }}
                        />
                        {modifiers.length > 0 && (
                            <span className='text-xs font-semibold uppercase tracking-[0.05em] text-muted canvas-pipeline__menu-group'>Plugins</span>
                        )}
                        {modifiers.map((modifier) => (
                            <PopoverMenuItem
                                key={modifier.pluginId}
                                icon={<FlaskConical size={13} aria-hidden='true' />}
                                label={modifier.name}
                                size='sm'
                                onClick={() => {
                                    handleAdd('analysis-plugin', {
                                        pluginId: modifier.pluginId,
                                        argValues: {}
                                    });
                                    close();
                                }}
                            />
                        ))}
                    </PopoverMenu>
                )}
            </Popover>
        </div>
    );
};

export default PipelineHeaderActions;
