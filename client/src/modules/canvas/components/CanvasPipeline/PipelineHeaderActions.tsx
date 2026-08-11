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
import { Button, Popover } from '@heroui/react';
import { Filter, FlaskConical, Palette, Play, Plus, Scissors } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { StageType, StageConfig } from '../../store/canvas-pipeline';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

interface PipelineHeaderActionsProps {
    trajectory?: Trajectory | null;
    trajectoryId?: string;
    currentTimestep?: number;
    canMutateCanvas?: boolean;
}

interface AddMenuItemProps {
    icon: ReactNode;
    label: string;
    onSelect: () => void;
}

const AddMenuItem = ({ icon, label, onSelect }: AddMenuItemProps) => (
    <button type='button' role='menuitem' className='flex w-full min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border-none bg-transparent px-2.5 py-2 text-left text-xs text-foreground hover:bg-default' onClick={onSelect}>
        {icon}
        <span className='min-w-0 flex-1 truncate'>{label}</span>
    </button>
);

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

    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const closeAddMenu = () => setIsAddMenuOpen(false);
    const [isRunMenuOpen, setIsRunMenuOpen] = useState(false);
    const closeRunMenu = () => setIsRunMenuOpen(false);

    const handleAdd = (type: StageType, config: StageConfig) => {
        addStage(type, config, trajectoryId);
    };

    return (
        <div className='flex flex-row items-center gap-1' onClick={(event) => event.stopPropagation()}>
            <Popover isOpen={isRunMenuOpen} onOpenChange={setIsRunMenuOpen}>
                <Button
                    variant='ghost'
                    size='sm'
                    isIconOnly
                    isDisabled={!canMutateCanvas || !trajectoryId || orderedStageCount === 0}
                    aria-label='Run pipeline'
                >
                    <Play size={13} />
                </Button>
                <Popover.Content placement='left top'>
                    <Popover.Dialog id='canvas-pipeline-run' aria-label='Run pipeline' className='min-w-[min(22rem,calc(100vw-2rem))] max-w-[min(24rem,calc(100vw-2rem))]'>
                        <div className='gap-2 flex min-w-[min(21rem,calc(100vw-3rem))] max-h-[min(70vh,32rem)] flex-col overflow-hidden origin-top-right'>
                            <span className='text-xs font-medium text-muted'>Pipeline</span>
                            <PipelineRunControl
                                trajectory={trajectory}
                                trajectoryId={trajectoryId}
                                currentTimestep={currentTimestep}
                                canMutateCanvas={canMutateCanvas}
                                onClose={closeRunMenu}
                            />
                        </div>
                    </Popover.Dialog>
                </Popover.Content>
            </Popover>
            <Popover isOpen={isAddMenuOpen} onOpenChange={setIsAddMenuOpen}>
                <Button
                    variant='ghost'
                    size='sm'
                    isDisabled={!canMutateCanvas || !trajectoryId}
                    aria-label='Add pipeline stage'
                    className='text-xs'
                >
                    <Plus size={12} />
                    Add new
                </Button>
                <Popover.Content placement='bottom start'>
                    <Popover.Dialog id='canvas-pipeline-add-menu' aria-label='Add pipeline stage' className='flex min-w-45 max-w-80 flex-col p-1'>
                        <span className='px-2 pb-0.5 pt-1 text-xs font-semibold uppercase tracking-[0.05em] text-muted'>View</span>
                        <AddMenuItem
                            icon={<Scissors size={13} aria-hidden='true' />}
                            label='Slice Plane'
                            onSelect={() => { handleAdd('slice-plane', { ...DEFAULT_SLICE_PLANE_STAGE_CONFIG }); closeAddMenu(); }}
                        />
                        <AddMenuItem
                            icon={<Filter size={13} aria-hidden='true' />}
                            label='Expression Select'
                            onSelect={() => { handleAdd('expression-select', { ...DEFAULT_EXPRESSION_SELECT_STAGE_CONFIG }); closeAddMenu(); }}
                        />
                        <AddMenuItem
                            icon={<Palette size={13} aria-hidden='true' />}
                            label='Color Coding'
                            onSelect={() => { handleAdd('color-coding', { ...DEFAULT_COLOR_CODING_STAGE_CONFIG }); closeAddMenu(); }}
                        />
                        {modifiers.length > 0 && (
                            <span className='px-2 pb-0.5 pt-1 text-xs font-semibold uppercase tracking-[0.05em] text-muted'>Plugins</span>
                        )}
                        {modifiers.map((modifier) => (
                            <AddMenuItem
                                key={modifier.pluginId}
                                icon={<FlaskConical size={13} aria-hidden='true' />}
                                label={modifier.name}
                                onSelect={() => {
                                    handleAdd('analysis-plugin', {
                                        pluginId: modifier.pluginId,
                                        argValues: {}
                                    });
                                    closeAddMenu();
                                }}
                            />
                        ))}
                    </Popover.Dialog>
                </Popover.Content>
            </Popover>
        </div>
    );
};

export default PipelineHeaderActions;
