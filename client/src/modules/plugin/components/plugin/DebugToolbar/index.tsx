import Loader from '@/shared/ui/components/Loader';
import { Button, Separator, Tooltip } from '@heroui/react';
import { NodeType } from '@volt/contracts/modules/plugin/enums';
import DebugArgumentsPanel from '@/modules/plugin/components/plugin/DebugArgumentsPanel';
import { PluginSelect } from '@/modules/plugin/components/plugin/PluginSelect';
import useDebugTrajectorySelector from '@/modules/plugin/hooks/plugin/use-debug-trajectory-selector';
import usePluginDebugSocket from '@/modules/plugin/hooks/plugin/use-plugin-debug-socket';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import { DebugNodeStatus, usePluginDebugStore } from '@/modules/plugin/store/plugin/use-plugin-debug-store';
import { isUserConfigurableArgument } from '@/modules/plugin/utils/plugin/argument-values';
import { NODE_CONFIGS } from '@/modules/plugin/utils/plugin/node-registry';
import { Bug, FastForward, Play, Square, StepForward } from 'lucide-react';
import type { ReactNode } from 'react';

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

const formatDuration = (totalDuration: number): string =>
    totalDuration < 1000 ? `${totalDuration}ms` : `${(totalDuration / 1000).toFixed(1)}s`;

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
        <div className='absolute top-4 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5'>
            <div className='flex flex-row items-center gap-2 whitespace-nowrap rounded-full border border-border bg-surface px-4'>
                <div className='flex flex-row items-center gap-2'>
                    <Bug size={14} className='text-muted' aria-hidden='true' />
                    <p className='text-xs font-semibold text-muted'>Debug</p>
                </div>
                <Separator orientation='vertical' className='mx-1 h-5 bg-border-secondary' />
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
                    triggerClassName='disabled:cursor-not-allowed disabled:opacity-50 focus:border-accent data-[open]:border-accent'
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
                    triggerClassName='disabled:cursor-not-allowed disabled:opacity-50 focus:border-accent data-[open]:border-accent'
                />
                <Separator orientation='vertical' className='mx-1 h-5 bg-border-secondary' />
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
                <>
                    <Separator orientation='vertical' className='mx-1 h-5 bg-border-secondary' />
                    <div className='flex flex-row items-center gap-2 whitespace-nowrap'>
                        {isPaused && currentNodeLabel && (
                            <>
                                <span role='status' aria-label='warning status' className='inline-block size-2 shrink-0 animate-pulse rounded-full shadow-[0_0_0_2px_var(--surface-secondary)] bg-warning' />
                                <p className='text-xs'>
                                    Paused at: {currentNodeLabel} ({currentNodeIndex + 1}/{totalNodes})
                                </p>
                            </>
                        )}
                        {!isPaused && (
                            <>
                                <span role='status' aria-label='info status' className='inline-block size-2 shrink-0 animate-pulse rounded-full shadow-[0_0_0_2px_var(--surface-secondary)] bg-info' />
                                <p className='text-xs text-muted'>
                                    Running... {completedCount}/{totalNodes}
                                </p>
                            </>
                        )}
                    </div>
                </>
            )}

            <DebugArgumentsPanel onStart={startDebug} canStart={canStart} />

            {!isDebugging && (totalDuration !== null || sessionError) && (
                <div className='mt-4 flex flex-col whitespace-nowrap text-center'>
                    {totalDuration !== null && totalDuration >= 0 && (
                        <p className='text-xs text-success'>
                            Completed in {formatDuration(totalDuration)}
                        </p>
                    )}
                    {sessionError && (
                        <p className='text-xs text-danger'>
                            {sessionError}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default DebugToolbar;
