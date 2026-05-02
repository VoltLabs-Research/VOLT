import Button from '@/shared/presentation/primitives/Button';
import Divider from '@/shared/presentation/primitives/Divider';
import Loader from '@/shared/presentation/primitives/Loader';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import StatusDot from '@/shared/presentation/primitives/StatusDot';
import Text from '@/shared/presentation/primitives/Text';
import Tooltip from '@/shared/presentation/primitives/Tooltip';
import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import DebugArgumentsPanel from '@/modules/plugin/components/plugin/DebugArgumentsPanel';
import useDebugTrajectorySelector from '@/modules/plugin/hooks/plugin/use-debug-trajectory-selector';
import usePluginDebugSocket from '@/modules/plugin/hooks/plugin/use-plugin-debug-socket';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { usePluginDebugStore } from '@/modules/plugin/stores/plugin/use-plugin-debug-store';
import { isUserConfigurableArgument } from '@/modules/plugin/utilities/plugin/argument-values';
import { NODE_CONFIGS } from '@/modules/plugin/utilities/plugin/node-registry';
import Select from '@/shared/presentation/primitives/Select';
import { Bug, FastForward, Play, Square, StepForward } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import type { IArgumentDefinition } from '@/modules/plugin/api/entities/plugin/workflow';
import './DebugToolbar.css';

interface ArgumentsNodeArguments {
    arguments?: IArgumentDefinition[];
}

interface ArgumentsNodeData {
    arguments?: ArgumentsNodeArguments;
}

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

    const hasConfigurableArgs = useMemo(() => {
        const argsNode = nodes.find((n) => n.type === NodeType.ARGUMENTS);
        if (!argsNode) {
            return false;
        }

        const argsNodeData = argsNode.data as ArgumentsNodeData;
        const argumentDefinitions = argsNodeData?.arguments?.arguments;
        if (!argumentDefinitions) {
            return false;
        }

        return argumentDefinitions.some(isUserConfigurableArgument);
    }, [nodes]);

    const handleTrajectoryChange = useCallback((value: string) => {
        setSelectedTrajectory(value || null);
    }, [setSelectedTrajectory]);

    const handleFrameChange = useCallback((value: string) => {
        setSelectedTimestep(value ? Number(value) : null);
    }, [setSelectedTimestep]);

    const canStart = !isDebugging && !isStarting && !!selectedTrajectoryId && selectedTimestep !== null;

    const trajectoryOptions = useMemo(() => {
        return trajectories.map((t) => ({
            value: t._id,
            title: t.name
        }));
    }, [trajectories]);

    const frameOptions = useMemo(() => {
        return frames.map((f) => ({
            value: String(f.timestep),
            title: `t=${f.timestep} (${f.natoms} atoms)`
        }));
    }, [frames]);
    const canStep = isDebugging && isPaused;
    const canContinue = isDebugging && isPaused;
    const canStop = isDebugging || isStarting;

    const handlePlayClick = useCallback(() => {
        if (hasConfigurableArgs) {
            setShowArgumentsPanel(true);
        } else {
            startDebug();
        }
    }, [hasConfigurableArgs, setShowArgumentsPanel, startDebug]);

    const handleStartFromPanel = useCallback(() => {
        startDebug();
    }, [startDebug]);

    let currentNodeType: string | null = null;
    if (currentNodeId) {
        currentNodeType = executionOrder.find((node) => node.nodeId === currentNodeId)?.type ?? null;
    }

    let currentNodeLabel: string | null = null;
    if (currentNodeType) {
        const resolvedNodeType = currentNodeType as NodeType;
        currentNodeLabel = NODE_CONFIGS[resolvedNodeType]?.label ?? currentNodeType;
    }

    const completedCount = Object.values(nodeStates).filter((s) => s.status === 'completed').length;

    return (
        <Stack align='center' position='absolute' zIndex='10' top='1' className='center-x debug-toolbar-wrapper'>
            <Row gap='05' className='panel-floating radius-full debug-toolbar glass-bg'>
                <Row gap='05'>
                    <Bug size={14} className='color-secondary' />
                    <Text as='p' size='sm' tone='muted' weight='bold'>Debug</Text>
                </Row>

                <Divider orientation='vertical' className='debug-toolbar-divider' />

                <Select
                    options={trajectoryOptions}
                    value={selectedTrajectoryId || null}
                    onChange={handleTrajectoryChange}
                    placeholder={trajLoading ? 'Loading...' : 'Trajectory'}
                    disabled={isDebugging || isStarting}
                    isLoading={trajLoading}
                    className='debug-toolbar-select'
                />

                <Select
                    options={frameOptions}
                    value={selectedTimestep !== null ? String(selectedTimestep) : null}
                    onChange={handleFrameChange}
                    placeholder='Frame'
                    disabled={!selectedTrajectoryId || isDebugging || isStarting}
                    className='debug-toolbar-select'
                />

                <Divider orientation='vertical' className='debug-toolbar-divider' />

                <Row gap='025'>
                    <Tooltip content={canStart ? (hasConfigurableArgs ? 'Configure arguments & start' : 'Start debug (single frame)') : 'Select trajectory & frame first'} placement='bottom'>
                        <Button
                            variant='ghost'
                            intent='neutral'
                            iconOnly
                            size='sm'
                            onClick={handlePlayClick}
                            disabled={!canStart}
                        >
                            {isStarting ? <Loader scale={0.6} isFixed={false} /> : <Play size={14} />}
                        </Button>
                    </Tooltip>

                    <Tooltip content='Step to next node' placement='bottom'>
                        <Button
                            variant='ghost'
                            intent='neutral'
                            iconOnly
                            size='sm'
                            onClick={step}
                            disabled={!canStep}
                        >
                            <StepForward size={14} />
                        </Button>
                    </Tooltip>

                    <Tooltip content='Continue (run all remaining)' placement='bottom'>
                        <Button
                            variant='ghost'
                            intent='neutral'
                            iconOnly
                            size='sm'
                            onClick={continueAll}
                            disabled={!canContinue}
                        >
                            <FastForward size={14} />
                        </Button>
                    </Tooltip>

                    <Tooltip content='Stop debug session' placement='bottom'>
                        <Button
                            variant='ghost'
                            intent='neutral'
                            iconOnly
                            size='sm'
                            onClick={stop}
                            disabled={!canStop}
                        >
                            <Square size={14} />
                        </Button>
                    </Tooltip>
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

            <DebugArgumentsPanel onStart={handleStartFromPanel} canStart={canStart} />

            {!isDebugging && (totalDuration !== null || sessionError) && (
                <Stack mt='1' textAlign='center' className='debug-toolbar-below-status'>
                    {totalDuration !== null && totalDuration >= 0 && (
                        <Text as='p' size='sm' className='debug-toolbar-status--completed'>
                            Completed in {totalDuration < 1000 ? `${totalDuration}ms` : `${(totalDuration / 1000).toFixed(1)}s`}
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
