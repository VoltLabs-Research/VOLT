import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import DebugArgumentsPanel from '@/modules/plugin/components/plugin/molecules/DebugArgumentsPanel';
import useDebugTrajectorySelector from '@/modules/plugin/hooks/plugin/use-debug-trajectory-selector';
import usePluginDebugSocket from '@/modules/plugin/hooks/plugin/use-plugin-debug-socket';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { usePluginDebugStore } from '@/modules/plugin/stores/plugin/use-plugin-debug-store';
import { NODE_CONFIGS } from '@/modules/plugin/utilities/plugin/node-registry';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Divider from '@/shared/presentation/components/Divider';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Select from '@/shared/presentation/components/Select';
import Tooltip from '@/shared/presentation/components/Tooltip';
import { Bug, FastForward, Play, Square, StepForward } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import type { IArgumentDefinition } from '@/modules/plugin/api/entities/plugin/workflow';
import './DebugToolbar.css';

interface ArgumentsNodeArguments {
    arguments?: IArgumentDefinition[];
};

interface ArgumentsNodeData {
    arguments?: ArgumentsNodeArguments;
};

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

    const isPaused = usePluginDebugStore((state) => state.isPaused);
    const isStarting = usePluginDebugStore((state) => state.isStarting);
    const currentNodeId = usePluginDebugStore((state) => state.currentNodeId);
    const currentNodeIndex = usePluginDebugStore((state) => state.currentNodeIndex);
    const totalNodes = usePluginDebugStore((state) => state.totalNodes);
    const totalDuration = usePluginDebugStore((state) => state.totalDuration);
    const sessionError = usePluginDebugStore((state) => state.sessionError);
    const nodeStates = usePluginDebugStore((state) => state.nodeStates);
    const executionOrder = usePluginDebugStore((state) => state.executionOrder);
    const setShowArgumentsPanel = usePluginDebugStore((state) => state.setShowArgumentsPanel);

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

        return argumentDefinitions.some((argument) => argument.value === undefined);
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

    let debugStatusMessage: string | null = null;
    if (isStarting) {
        debugStatusMessage = 'Starting debug session.';
    } else if (sessionError) {
        debugStatusMessage = `Debug session error: ${sessionError}`;
    } else if (isDebugging && isPaused && currentNodeLabel) {
        debugStatusMessage = `Debug paused at ${currentNodeLabel}. Node ${currentNodeIndex + 1} of ${totalNodes}.`;
    } else if (isDebugging) {
        debugStatusMessage = `Debug running. ${completedCount} of ${totalNodes} nodes completed.`;
    } else if (totalDuration !== null && totalDuration >= 0) {
        debugStatusMessage = `Debug completed in ${totalDuration < 1000 ? `${totalDuration} milliseconds` : `${(totalDuration / 1000).toFixed(1)} seconds`}.`;
    }

    return (
        <Container className='p-absolute z-10 d-flex column items-center top-1 center-x debug-toolbar-wrapper'>
            {debugStatusMessage && (
                <Container className='plugin-accessible-status' role='status' aria-live='polite'>
                    {debugStatusMessage}
                </Container>
            )}

            <Container className='d-flex items-center gap-05 panel-floating radius-full debug-toolbar' role='toolbar' aria-label='Debug controls'>
                <Container className='d-flex items-center gap-05'>
                    <Bug size={14} className='color-secondary' />
                    <Paragraph className='font-size-2 color-secondary font-weight-6'>Debug</Paragraph>
                </Container>

                <Divider orientation='vertical' className='debug-toolbar-divider' />

                <Select
                    options={trajectoryOptions}
                    value={selectedTrajectoryId || null}
                    onChange={handleTrajectoryChange}
                    placeholder={trajLoading ? 'Loading…' : 'Trajectory'}
                    disabled={isDebugging || isStarting}
                    isLoading={trajLoading}
                    className='debug-toolbar-select'
                    aria-label='Select trajectory for debugging'
                />

                <Select
                    options={frameOptions}
                    value={selectedTimestep !== null ? String(selectedTimestep) : null}
                    onChange={handleFrameChange}
                    placeholder='Frame'
                    disabled={!selectedTrajectoryId || isDebugging || isStarting}
                    className='debug-toolbar-select'
                    aria-label='Select frame for debugging'
                />

                <Divider orientation='vertical' className='debug-toolbar-divider' />

                <Container className='d-flex items-center gap-025'>
                    <Tooltip content={canStart ? (hasConfigurableArgs ? 'Configure arguments & start' : 'Start debug (single frame)') : 'Select trajectory & frame first'} placement='bottom'>
                        <Button
                            variant='solid'
                            intent='brand'
                            size='sm'
                            className='debug-toolbar-action debug-toolbar-action--primary'
                            onClick={handlePlayClick}
                            disabled={!canStart}
                            title={hasConfigurableArgs ? 'Configure arguments and start debug' : 'Start debug'}
                            leftIcon={<Play size={16} />}
                            isLoading={isStarting}
                        >
                            {hasConfigurableArgs ? 'Configure & Start' : 'Start'}
                        </Button>
                    </Tooltip>

                    <Tooltip content='Step to next node' placement='bottom'>
                        <Button
                            variant='outline'
                            intent='neutral'
                            size='sm'
                            className='debug-toolbar-action'
                            onClick={step}
                            disabled={!canStep}
                            title='Step to next node'
                            leftIcon={<StepForward size={16} />}
                        >
                            Step
                        </Button>
                    </Tooltip>

                    <Tooltip content='Continue (run all remaining)' placement='bottom'>
                        <Button
                            variant='solid'
                            intent='brand'
                            size='sm'
                            className='debug-toolbar-action debug-toolbar-action--primary'
                            onClick={continueAll}
                            disabled={!canContinue}
                            title='Continue debug session'
                            leftIcon={<FastForward size={16} />}
                        >
                            Continue
                        </Button>
                    </Tooltip>

                    <Tooltip content='Stop debug session' placement='bottom'>
                        <Button
                            variant='outline'
                            intent='danger'
                            size='sm'
                            className='debug-toolbar-action'
                            onClick={stop}
                            disabled={!canStop}
                            title='Stop debug session'
                            leftIcon={<Square size={16} />}
                        >
                            Stop
                        </Button>
                    </Tooltip>
                </Container>
            </Container>

            {isDebugging && (
                <>
                    <Divider orientation='vertical' className='debug-toolbar-divider' />
                    <Container className='d-flex items-center gap-05 debug-toolbar-status'>
                        {isPaused && currentNodeLabel && (
                            <>
                                <span className='debug-toolbar-status-dot debug-toolbar-status-dot--paused radius-full f-shrink-0' />
                                <span className='debug-toolbar-state-badge debug-toolbar-state-badge--paused'>Paused</span>
                                <Paragraph className='font-size-2'>
                                    {currentNodeLabel} ({currentNodeIndex + 1}/{totalNodes})
                                </Paragraph>
                            </>
                        )}
                        {!isPaused && (
                            <>
                                <span className='debug-toolbar-status-dot debug-toolbar-status-dot--running radius-full f-shrink-0' />
                                <span className='debug-toolbar-state-badge debug-toolbar-state-badge--running'>Running</span>
                                <Paragraph className='font-size-2 color-secondary'>
                                    {completedCount}/{totalNodes} completed
                                </Paragraph>
                            </>
                        )}
                    </Container>
                </>
            )}

            <DebugArgumentsPanel onStart={handleStartFromPanel} canStart={canStart} />

            {!isDebugging && (totalDuration !== null || sessionError) && (
                <Container className='text-center mt-1 debug-toolbar-below-status'>
                    {totalDuration !== null && totalDuration >= 0 && (
                        <Paragraph className='font-size-2 debug-toolbar-status--completed'>
                            Completed in {totalDuration < 1000 ? `${totalDuration}ms` : `${(totalDuration / 1000).toFixed(1)}s`}
                        </Paragraph>
                    )}
                    {sessionError && (
                        <Paragraph className='font-size-2 debug-toolbar-status--error'>
                            {sessionError}
                        </Paragraph>
                    )}
                </Container>
            )}
        </Container>
    );
};

export default DebugToolbar;
