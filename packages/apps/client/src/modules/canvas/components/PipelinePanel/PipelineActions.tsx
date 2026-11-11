import {
    useCanvasPipelineStore,
    useStages,
    useStageEdits,
    isOrderedPipelineStage,
    DEFAULT_SLICE_PLANE_STAGE_CONFIG,
    DEFAULT_COLOR_CODING_STAGE_CONFIG,
    DEFAULT_EXPRESSION_SELECT_STAGE_CONFIG
} from '../../store/canvas-pipeline';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import { useEnsurePluginCatalogLoaded } from '@/modules/plugin/hooks/plugin/use-plugin-catalog';
import PipelineRunControl from '../CanvasPipeline/PipelineRunControl';
import AddPluginMenu from './AddPluginMenu';
import { buildPluginPickerSections } from '../../utils/plugin-picker-sections';
import { Button, Popover } from '@heroui/react';
import { Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { StageType, StageConfig } from '../../store/canvas-pipeline';
import type { PipelineRun } from '@volt/contracts/modules/plugin/pipeline-run';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

interface PipelineActionsProps {
    trajectory?: Trajectory | null;
    trajectoryId?: string;
    pipelineKey: string;
    // The saved run these stages extend; absent for the draft.
    run?: PipelineRun;
    isRunBusy?: boolean;
    // Why the selected pipeline cannot take stages, when it cannot.
    unavailableReason?: string;
    currentTimestep?: number;
    canMutateCanvas?: boolean;
    onStageAdded?: (stageId: string) => void;
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

const PipelineActions = ({
    trajectory,
    trajectoryId,
    pipelineKey,
    run,
    isRunBusy = false,
    unavailableReason,
    currentTimestep,
    canMutateCanvas,
    onStageAdded
}: PipelineActionsProps) => {
    useEnsurePluginCatalogLoaded();
    const { modifiers } = usePluginSelectors();
    const addStage = useCanvasPipelineStore((s) => s.addStage);
    const orderedStageCount = useStages(pipelineKey).filter(isOrderedPipelineStage).length;
    const stageEdits = useStageEdits(run ? pipelineKey : undefined);
    const hasEdits = Object.keys(stageEdits).length > 0;

    const [isRunMenuOpen, setIsRunMenuOpen] = useState(false);
    const closeRunMenu = () => setIsRunMenuOpen(false);
    const canAdd = Boolean(canMutateCanvas && trajectoryId && !unavailableReason);

    const handleAdd = (type: StageType, config: StageConfig) => {
        const stageId = addStage(type, config, pipelineKey);
        if (stageId) onStageAdded?.(stageId);
    };

    const pickerSections = useMemo(() => buildPluginPickerSections(
        STATIC_STAGE_PRESETS.map((preset) => ({ id: preset.id, label: preset.label })),
        modifiers.map((modifier) => ({
            id: modifier.pluginId,
            label: modifier.name,
            category: modifier.plugin.modifier?.category
        }))
    ), [modifiers]);

    const handleAddMenuAction = (id: string) => {
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
        <div className='flex shrink-0 flex-row items-center gap-1 px-2 pb-1.5' title={unavailableReason}>
            <AddPluginMenu sections={pickerSections} isDisabled={!canAdd} onAdd={handleAddMenuAction} />
            <Popover isOpen={isRunMenuOpen} onOpenChange={setIsRunMenuOpen}>
                <Button
                    variant='ghost'
                    size='sm'
                    isIconOnly
                    className='rounded-full'
                    isDisabled={!canAdd || (orderedStageCount === 0 && !hasEdits)}
                    aria-label={run && !hasEdits ? 'Run new stages' : 'Run pipeline'}
                >
                    <Play size={13} aria-hidden='true' />
                </Button>
                <Popover.Content placement='left top'>
                    <Popover.Dialog id='canvas-pipeline-run' aria-label='Run pipeline' className='min-w-[min(22rem,calc(100vw-2rem))] max-w-[min(24rem,calc(100vw-2rem))]'>
                        <div className='gap-2 flex min-w-[min(21rem,calc(100vw-3rem))] flex-col origin-top-right'>
                            <span className='text-xs font-medium text-muted'>Pipeline</span>
                            <PipelineRunControl
                                trajectory={trajectory}
                                trajectoryId={trajectoryId}
                                pipelineKey={pipelineKey}
                                run={run}
                                isRunBusy={isRunBusy}
                                stageEdits={run ? stageEdits : undefined}
                                currentTimestep={currentTimestep}
                                canMutateCanvas={canMutateCanvas}
                                onClose={closeRunMenu}
                            />
                        </div>
                    </Popover.Dialog>
                </Popover.Content>
            </Popover>
        </div>
    );
};

export default PipelineActions;
