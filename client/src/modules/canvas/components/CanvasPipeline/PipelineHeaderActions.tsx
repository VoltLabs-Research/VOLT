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
import { Button, Popover } from '@heroui/react';
import {
    PLUGIN_CONFIG_PANEL_CLASS,
    PLUGIN_POPOVER_CONTENT_CLASS
} from './pipeline-classes';
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

/** `.canvas-pipeline__menu-group` — a section label inside the add menu. */
const MENU_GROUP_CLASS = 'px-2 pb-0.5 pt-1 text-xs font-semibold uppercase tracking-[0.05em] text-muted';

/** bravais's `PopoverMenuItem size='sm'`, translated by value. */
const MENU_ITEM_CLASS = 'flex w-full min-h-10 cursor-pointer items-center gap-1.5 rounded-lg border-none bg-transparent px-2.5 py-2 text-left text-xs text-foreground hover:bg-default';

interface AddMenuItemProps {
    icon: ReactNode;
    label: string;
    onSelect: () => void;
}

const AddMenuItem = ({ icon, label, onSelect }: AddMenuItemProps) => (
    <button type='button' role='menuitem' className={MENU_ITEM_CLASS} onClick={onSelect}>
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
                className={PLUGIN_CONFIG_PANEL_CLASS}
                trigger={
                    <span className='inline-flex'>
                        <Button
                            variant='ghost'
                            size='sm'
                            isIconOnly
                            isDisabled={!canMutateCanvas || !trajectoryId || orderedStageCount === 0}
                            aria-label='Run pipeline'
                        >
                            <Play size={13} />
                        </Button>
                    </span>
                }
                content={(close) => (
                    <div className={`gap-2 ${PLUGIN_POPOVER_CONTENT_CLASS}`}>
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

            <Popover isOpen={isAddMenuOpen} onOpenChange={setIsAddMenuOpen}>
                {/* The Button is the Root's direct child — see MenuPopover for why. */}
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
                        <span className={MENU_GROUP_CLASS}>View</span>
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
                            <span className={MENU_GROUP_CLASS}>Plugins</span>
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
