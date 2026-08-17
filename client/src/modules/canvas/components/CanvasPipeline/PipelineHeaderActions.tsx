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
import {
    Button,
    DropdownItem,
    DropdownMenu,
    DropdownPopover,
    DropdownRoot,
    DropdownTrigger,
    Popover
} from '@heroui/react';
import { Play, Plus } from 'lucide-react';
import { useState } from 'react';
import type { Key } from 'react';
import type { StageType, StageConfig } from '../../store/canvas-pipeline';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

interface PipelineHeaderActionsProps {
    trajectory?: Trajectory | null;
    trajectoryId?: string;
    currentTimestep?: number;
    canMutateCanvas?: boolean;
}

const STATIC_STAGE_PRESETS: { id: string; label: string; type: StageType; config: StageConfig }[] = [
    {
        id: 'slice-plane',
        label: 'Slice Plane',
        type: 'slice-plane',
        config: DEFAULT_SLICE_PLANE_STAGE_CONFIG
    },
    {
        id: 'expression-select',
        label: 'Expression Select',
        type: 'expression-select',
        config: DEFAULT_EXPRESSION_SELECT_STAGE_CONFIG
    },
    {
        id: 'color-coding',
        label: 'Color Coding',
        type: 'color-coding',
        config: DEFAULT_COLOR_CODING_STAGE_CONFIG
    }
];

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
    const [isRunMenuOpen, setIsRunMenuOpen] = useState(false);
    const closeRunMenu = () => setIsRunMenuOpen(false);

    const handleAdd = (type: StageType, config: StageConfig) => {
        addStage(type, config, trajectoryId);
    };

    const handleAddMenuAction = (key: Key) => {
        const id = String(key);
        const preset = STATIC_STAGE_PRESETS.find((entry) => entry.id === id);

        if (preset) {
            handleAdd(preset.type, { ...preset.config });
            return;
        }

        handleAdd('analysis-plugin', {
            pluginId: id,
            argValues: {}
        });
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
                        <div className='gap-2 flex min-w-[min(21rem,calc(100vw-3rem))] flex-col origin-top-right'>
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
            <DropdownRoot isOpen={isAddMenuOpen} onOpenChange={setIsAddMenuOpen}>
                <DropdownTrigger
                    isDisabled={!canMutateCanvas || !trajectoryId}
                    aria-label='Add pipeline stage'
                >
                    <Button variant='ghost' size='sm' className='text-xs'>
                        <Plus size={12} />
                        Add new
                    </Button>
                </DropdownTrigger>
                <DropdownPopover placement='bottom start'>
                    <DropdownMenu
                        aria-label='Add pipeline stage'
                        onAction={handleAddMenuAction}
                    >
                        {STATIC_STAGE_PRESETS.map((preset) => (
                            <DropdownItem key={preset.id} id={preset.id} textValue={preset.label}>
                                {preset.label}
                            </DropdownItem>
                        ))}
                        {modifiers.map((modifier) => (
                            <DropdownItem
                                key={modifier.pluginId}
                                id={modifier.pluginId}
                                textValue={modifier.name}
                            >
                                {modifier.name}
                            </DropdownItem>
                        ))}
                    </DropdownMenu>
                </DropdownPopover>
            </DropdownRoot>
        </div>
    );
};

export default PipelineHeaderActions;
