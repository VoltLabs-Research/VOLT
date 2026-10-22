import Loader from '@/shared/ui/components/Loader';
import { Button, Separator, Tooltip } from '@heroui/react';
import { NodeType } from '@volt/contracts/modules/plugin/enums';
import DebugArgumentsPanel from '@/modules/plugin/components/plugin/DebugArgumentsPanel';
import { PluginSelect } from '@/modules/plugin/components/plugin/PluginSelect';
import { formatTraceDuration } from '@/modules/plugin/components/plugin/BaseNode/use-node-debug-view';
import useDebugTrajectorySelector from '@/modules/plugin/hooks/plugin/use-debug-trajectory-selector';
import usePluginDebugSocket from '@/modules/plugin/hooks/plugin/use-plugin-debug-socket';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import { DebugNodeStatus, usePluginDebugStore } from '@/modules/plugin/store/plugin/use-plugin-debug-store';
import { isUserConfigurableArgument } from '@/modules/plugin/utils/plugin/argument-values';
import { NODE_CONFIGS } from '@/modules/plugin/utils/plugin/node-registry';
import { FastForward, Play, Square, StepForward } from 'lucide-react';
import type { ReactNode } from 'react';

// Pills inside the pill toolbar, as tall as its icon buttons. On a phone they share a second row.
const SELECT_CLASS_NAME = 'max-[768px]:order-2 max-[768px]:min-w-0 max-[768px]:flex-[1_1_40%]';
const SELECT_TRIGGER_CLASS_NAME = 'h-8 min-h-8 items-center rounded-full py-0 text-xs disabled:cursor-not-allowed disabled:opacity-50 max-[768px]:w-full';

interface DebugControlButtonProps {
    tooltip: string;
    onPress: () => void;
    isDisabled: boolean;
    children: ReactNode;
}

const DebugControlButton = ({ tooltip, onPress, isDisabled, children }: DebugControlButtonProps) => (
    <Tooltip>
        <Button
            variant='ghost'
            isIconOnly
            size='sm'
            aria-label={tooltip}
            onPress={onPress}
            isDisabled={isDisabled}
        >
            {children}
        </Button>
        <Tooltip.Content placement='bottom'>{tooltip}</Tooltip.Content>
    </Tooltip>
);

const DebugToolbar = () => {
    const {
        trajectories,
        frames,
        selectedTrajectoryId,
        selectedTimestep,
        setSelectedTrajectory,
        setSelectedTimestep,
        isLoading: trajLoading
    } = useDebugTrajectorySelector();

    const { startDebug, step, continueAll, stop, isDebugging } = usePluginDebugSocket({
        subscribe: false
    });

    const {
        isPaused,
        isStarting,
        currentNodeId,
        currentNodeIndex,
        totalNodes,
        totalDuration,
        sessionError,
        nodeStates,
        executionOrder,
        setShowArgumentsPanel
    } = usePluginDebugStore();

    const nodes = usePluginBuilderStore((s) => s.nodes);

    const argumentDefinitions = nodes.find((n) => n.type === NodeType.ARGUMENTS)?.data.arguments?.arguments;
    const hasConfigurableArgs = !!argumentDefinitions?.some(isUserConfigurableArgument);

    const canStart = !isDebugging && !isStarting && !!selectedTrajectoryId && selectedTimestep !== null;
    const canAdvance = isDebugging && isPaused;
    const canStop = isDebugging || isStarting;

    const handlePlayClick = () => {
        if (hasConfigurableArgs) {
            setShowArgumentsPanel(true);
        } else {
            startDebug();
        }
    };

    const currentNodeType = currentNodeId
        ? executionOrder.find((node) => node.nodeId === currentNodeId)?.type ?? null
        : null;
    const currentNodeLabel = currentNodeType
        ? NODE_CONFIGS[currentNodeType as NodeType]?.label ?? currentNodeType
        : null;

    const completedCount = Object.values(nodeStates).filter((s) => s.status === DebugNodeStatus.Completed).length;

    let startTooltip = 'Select trajectory & frame first';
    if (canStart) {
        startTooltip = hasConfigurableArgs ? 'Configure arguments & start' : 'Start debug (single frame)';
    }

    return (
        <div className='absolute top-4 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 max-[768px]:top-2 max-[768px]:right-2 max-[768px]:left-18 max-[768px]:translate-x-0 max-[768px]:items-stretch'>
            <div role='toolbar' aria-label='Debug' className='glass-surface flex flex-row items-center gap-1 whitespace-nowrap rounded-full bg-dashboard-surface p-1 shadow-[var(--overlay-shadow)] max-[768px]:flex-wrap max-[768px]:justify-between max-[768px]:rounded-3xl'>
                <p className='pr-2 pl-3 text-xs font-semibold text-muted'>Debug</p>
                <Separator orientation='vertical' className='mx-1 h-5 bg-foreground/10 max-[768px]:hidden' />
                <PluginSelect
                    options={trajectories.map((trajectory) => ({
                        value: trajectory._id,
                        title: trajectory.name
                    }))}
                    value={selectedTrajectoryId || null}
                    onChange={(value: string) => setSelectedTrajectory(value || null)}
                    placeholder={trajLoading ? 'Loading...' : 'Trajectory'}
                    ariaLabel='Trajectory'
                    isDisabled={isDebugging || isStarting}
                    isPending={trajLoading}
                    className={SELECT_CLASS_NAME}
                    triggerClassName={SELECT_TRIGGER_CLASS_NAME}
                />
                <PluginSelect
                    options={frames.map((frame) => ({
                        value: String(frame.timestep),
                        title: `t=${frame.timestep} (${frame.natoms} atoms)`
                    }))}
                    value={selectedTimestep !== null ? String(selectedTimestep) : null}
                    onChange={(value: string) => setSelectedTimestep(value ? Number(value) : null)}
                    placeholder='Frame'
                    ariaLabel='Frame'
                    isDisabled={!selectedTrajectoryId || isDebugging || isStarting}
                    className={SELECT_CLASS_NAME}
                    triggerClassName={SELECT_TRIGGER_CLASS_NAME}
                />
                <Separator orientation='vertical' className='mx-1 h-5 bg-foreground/10 max-[768px]:hidden' />
                <div className='flex flex-row items-center gap-1'>
                    <DebugControlButton tooltip={startTooltip} onPress={handlePlayClick} isDisabled={!canStart}>
                        {isStarting ? <Loader size='sm' color='current' /> : <Play size={14} aria-hidden='true' />}
                    </DebugControlButton>
                    <DebugControlButton tooltip='Step to next node' onPress={step} isDisabled={!canAdvance}>
                        <StepForward size={14} aria-hidden='true' />
                    </DebugControlButton>
                    <DebugControlButton tooltip='Continue (run all remaining)' onPress={continueAll} isDisabled={!canAdvance}>
                        <FastForward size={14} aria-hidden='true' />
                    </DebugControlButton>
                    <DebugControlButton tooltip='Stop debug session' onPress={stop} isDisabled={!canStop}>
                        <Square size={14} aria-hidden='true' />
                    </DebugControlButton>
                </div>
            </div>

            {isDebugging && (
                <div className='flex flex-row items-center gap-2 whitespace-nowrap'>
                    {isPaused && currentNodeLabel && (
                        <>
                            <span role='status' aria-label='warning status' className='inline-block size-2 shrink-0 animate-pulse rounded-full bg-warning shadow-[0_0_0_2px_var(--surface-secondary)]' />
                            <p className='text-xs'>
                                Paused at: {currentNodeLabel} ({currentNodeIndex + 1}/{totalNodes})
                            </p>
                        </>
                    )}
                    {!isPaused && (
                        <>
                            <span role='status' aria-label='info status' className='inline-block size-2 shrink-0 animate-pulse rounded-full bg-foreground shadow-[0_0_0_2px_var(--surface-secondary)]' />
                            <p className='text-xs text-muted'>
                                Running... {completedCount}/{totalNodes}
                            </p>
                        </>
                    )}
                </div>
            )}

            <DebugArgumentsPanel onStart={startDebug} canStart={canStart} />

            {!isDebugging && (totalDuration !== null || sessionError) && (
                <div className='flex flex-col whitespace-nowrap text-center'>
                    {totalDuration !== null && totalDuration >= 0 && (
                        <p className='text-xs text-success-soft-foreground'>
                            Completed in {formatTraceDuration(totalDuration)}
                        </p>
                    )}
                    {sessionError && (
                        <p className='text-xs text-danger-soft-foreground'>
                            {sessionError}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default DebugToolbar;
