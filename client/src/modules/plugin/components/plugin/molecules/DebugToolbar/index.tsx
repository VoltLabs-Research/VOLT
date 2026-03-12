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
import Loader from '@/shared/presentation/components/Loader';
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

    return (
        <Container className='p-absolute z-10 d-flex column items-center top-1 center-x debug-toolbar-wrapper'>
            <Container className='d-flex items-center gap-05 panel-floating radius-full debug-toolbar'>
                <Container className='d-flex items-center gap-05'>
                    <Bug size={14} className='color-secondary' />
                    <Paragraph className='font-size-2 color-secondary font-weight-6'>Debug</Paragraph>
                </Container>

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

                <Container className='d-flex items-center gap-025'>
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
                </Container>
            </Container>

            {isDebugging && (
                <>
                    <Divider orientation='vertical' className='debug-toolbar-divider' />
                    <Container className='d-flex items-center gap-05 debug-toolbar-status'>
                        {isPaused && currentNodeLabel && (
                            <>
                                <span className='debug-toolbar-status-dot debug-toolbar-status-dot--paused radius-full f-shrink-0' />
                                <Paragraph className='font-size-2'>
                                    Paused at: {currentNodeLabel} ({currentNodeIndex + 1}/{totalNodes})
                                </Paragraph>
                            </>
                        )}
                        {!isPaused && (
                            <>
                                <span className='debug-toolbar-status-dot debug-toolbar-status-dot--running radius-full f-shrink-0' />
                                <Paragraph className='font-size-2 color-secondary'>
                                    Running... {completedCount}/{totalNodes}
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
