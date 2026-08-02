import { Button, Divider, Loader, Row, Stack, StatusDot, Text, Tooltip, Select } from '@voltstack/bravais';
import { NodeType } from '@volt/contracts/modules/plugin/enums';
import DebugArgumentsPanel from '@/modules/plugin/components/plugin/DebugArgumentsPanel';
import useDebugTrajectorySelector from '@/modules/plugin/hooks/plugin/use-debug-trajectory-selector';
import usePluginDebugSocket from '@/modules/plugin/hooks/plugin/use-plugin-debug-socket';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import { DebugNodeStatus, usePluginDebugStore } from '@/modules/plugin/store/plugin/use-plugin-debug-store';
import { isUserConfigurableArgument } from '@/modules/plugin/utils/plugin/argument-values';
import { NODE_CONFIGS } from '@/modules/plugin/utils/plugin/node-registry';
import { Bug, FastForward, Play, Square, StepForward } from 'lucide-react';
import type { ReactNode } from 'react';
import './DebugToolbar.css';

interface DebugControlButtonProps {
    tooltip: string;
    onClick: () => void;
    disabled: boolean;
    children: ReactNode;
}

const DebugControlButton = ({ tooltip, onClick, disabled, children }: DebugControlButtonProps) => (
    <Tooltip content={tooltip} placement='bottom'>
        <Button
            variant='ghost'
            intent='neutral'
            iconOnly
            size='sm'
            onClick={onClick}
            disabled={disabled}
        >
            {children}
        </Button>
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
        <Stack align='center' position='absolute' zIndex='10' top='1' className='center-x debug-toolbar-wrapper'>
            <Row gap='05' className='panel-floating radius-full debug-toolbar glass-bg'>
                <Row gap='05'>
                    <Bug size={14} className='color-secondary' />
                    <Text as='p' size='sm' tone='muted' weight='bold'>Debug</Text>
                </Row>

                <Divider orientation='vertical' className='debug-toolbar-divider' />

                <Select
                    options={trajectories.map((trajectory) => ({
                        value: trajectory._id,
                        title: trajectory.name
                    }))}
                    value={selectedTrajectoryId || null}
                    onChange={(value: string) => setSelectedTrajectory(value || null)}
                    placeholder={trajLoading ? 'Loading...' : 'Trajectory'}
                    disabled={isDebugging || isStarting}
                    isLoading={trajLoading}
                    className='debug-toolbar-select'
                />

                <Select
                    options={frames.map((frame) => ({
                        value: String(frame.timestep),
                        title: `t=${frame.timestep} (${frame.natoms} atoms)`
                    }))}
                    value={selectedTimestep !== null ? String(selectedTimestep) : null}
                    onChange={(value: string) => setSelectedTimestep(value ? Number(value) : null)}
                    placeholder='Frame'
                    disabled={!selectedTrajectoryId || isDebugging || isStarting}
                    className='debug-toolbar-select'
                />

                <Divider orientation='vertical' className='debug-toolbar-divider' />

                <Row gap='025'>
                    <DebugControlButton tooltip={startTooltip} onClick={handlePlayClick} disabled={!canStart}>
                        {isStarting ? <Loader scale={0.6} isFixed={false} /> : <Play size={14} />}
                    </DebugControlButton>

                    <DebugControlButton tooltip='Step to next node' onClick={step} disabled={!canAdvance}>
                        <StepForward size={14} />
                    </DebugControlButton>

                    <DebugControlButton tooltip='Continue (run all remaining)' onClick={continueAll} disabled={!canAdvance}>
                        <FastForward size={14} />
                    </DebugControlButton>

                    <DebugControlButton tooltip='Stop debug session' onClick={stop} disabled={!canStop}>
                        <Square size={14} />
                    </DebugControlButton>
                </Row>
            </Row>

            {isDebugging && (
                <>
                    <Divider orientation='vertical' className='debug-toolbar-divider' />
                    <Row gap='05' className='debug-toolbar-status'>
                        {isPaused && currentNodeLabel && (
                            <>
                                <StatusDot tone='warning' pulse />
                                <Text as='p' size='sm'>
                                    Paused at: {currentNodeLabel} ({currentNodeIndex + 1}/{totalNodes})
                                </Text>
                            </>
                        )}
                        {!isPaused && (
                            <>
                                <StatusDot tone='info' pulse />
                                <Text as='p' size='sm' tone='muted'>
                                    Running... {completedCount}/{totalNodes}
                                </Text>
                            </>
                        )}
                    </Row>
                </>
            )}

            <DebugArgumentsPanel onStart={startDebug} canStart={canStart} />

            {!isDebugging && (totalDuration !== null || sessionError) && (
                <Stack mt='1' textAlign='center' className='debug-toolbar-below-status'>
                    {totalDuration !== null && totalDuration >= 0 && (
                        <Text as='p' size='sm' className='debug-toolbar-status--completed'>
                            Completed in {formatDuration(totalDuration)}
                        </Text>
                    )}
                    {sessionError && (
                        <Text as='p' size='sm' className='debug-toolbar-status--error'>
                            {sessionError}
                        </Text>
                    )}
                </Stack>
            )}
        </Stack>
    );
};

export default DebugToolbar;
