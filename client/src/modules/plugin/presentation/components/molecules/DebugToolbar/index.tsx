import { useCallback, useMemo } from 'react';
import { usePluginDebugStore } from '@/modules/plugin/presentation/stores/use-plugin-debug-store';
import { usePluginBuilderStore } from '@/modules/plugin/presentation/stores/use-plugin-builder-store';
import usePluginDebugSocket from '@/modules/plugin/presentation/hooks/use-plugin-debug-socket';
import useDebugTrajectorySelector from '@/modules/plugin/presentation/hooks/use-debug-trajectory-selector';
import { NODE_CONFIGS } from '@/modules/plugin/presentation/utilities/node-types';
import { NodeType } from '@/modules/plugin/domain/entities';
import type { IArgumentDefinition } from '@/modules/plugin/domain/entities/Workflow';
import DebugArgumentsPanel from '@/modules/plugin/presentation/components/molecules/DebugArgumentsPanel';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import Tooltip from '@/shared/presentation/components/Tooltip';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Divider from '@/shared/presentation/components/Divider';
import { Play, StepForward, FastForward, Square, Bug } from 'lucide-react';
import Loader from '@/shared/presentation/components/Loader';
import './DebugToolbar.css';

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

    const { startDebug, step, continueAll, stop, isDebugging } = usePluginDebugSocket();

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

    // Check if the plugin has configurable arguments (no hardcoded `value`)
    const hasConfigurableArgs = useMemo(() => {
        const argsNode = nodes.find((n) => n.type === NodeType.ARGUMENTS);
        if (!argsNode) return false;
        const argsDef = (argsNode.data as any)?.arguments?.arguments as IArgumentDefinition[] | undefined;
        if (!argsDef) return false;
        return argsDef.some((arg) => arg.value === undefined);
    }, [nodes]);

    const handleTrajectoryChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedTrajectory(e.target.value || null);
    }, [setSelectedTrajectory]);

    const handleFrameChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSelectedTimestep(val ? Number(val) : null);
    }, [setSelectedTimestep]);

    const canStart = !isDebugging && !isStarting && !!selectedTrajectoryId && selectedTimestep !== null;
    const canStep = isDebugging && isPaused;
    const canContinue = isDebugging && isPaused;
    const canStop = isDebugging || isStarting;

    // When play is clicked: if configurable args exist, show panel; otherwise start directly
    const handlePlayClick = useCallback(() => {
        if (hasConfigurableArgs) {
            setShowArgumentsPanel(true);
        } else {
            startDebug();
        }
    }, [hasConfigurableArgs, setShowArgumentsPanel, startDebug]);

    // Called from the arguments panel "Start Debug" button
    const handleStartFromPanel = useCallback(() => {
        startDebug();
    }, [startDebug]);

    // Find current node label
    const currentNodeType = currentNodeId
        ? executionOrder.find((n) => n.nodeId === currentNodeId)?.type
        : null;
    const currentNodeLabel = currentNodeType
        ? NODE_CONFIGS[currentNodeType as keyof typeof NODE_CONFIGS]?.label ?? currentNodeType
        : null;

    // Count completed nodes
    const completedCount = Object.values(nodeStates).filter((s) => s.status === 'completed').length;

    return (
        <Container className='p-absolute z-10 d-flex column items-center top-1 center-x debug-toolbar-wrapper'>
            <Container className='d-flex items-center gap-05 panel-floating radius-full debug-toolbar'>
                <Container className='d-flex items-center gap-05'>
                    <Bug size={14} className='color-secondary' />
                    <Paragraph className='font-size-2 color-secondary font-weight-6'>Debug</Paragraph>
                </Container>

                <Divider orientation='vertical' className='debug-toolbar-divider' />

                {/* Trajectory Selector */}
                <select
                    className='debug-toolbar-select radius-sm font-size-1 cursor-pointer'
                    value={selectedTrajectoryId || ''}
                    onChange={handleTrajectoryChange}
                    disabled={isDebugging || isStarting}
                >
                    <option value=''>
                        {trajLoading ? 'Loading...' : 'Trajectory'}
                    </option>
                    {trajectories.map((t) => (
                        <option key={t._id} value={t._id}>{t.name}</option>
                    ))}
                </select>

                {/* Frame Selector */}
                <select
                    className='debug-toolbar-select radius-sm font-size-1 cursor-pointer'
                    value={selectedTimestep ?? ''}
                    onChange={handleFrameChange}
                    disabled={!selectedTrajectoryId || isDebugging || isStarting}
                >
                    <option value=''>Frame</option>
                    {frames.map((f) => (
                        <option key={f.timestep} value={f.timestep}>
                            t={f.timestep} ({f.natoms} atoms)
                        </option>
                    ))}
                </select>

                <Divider orientation='vertical' className='debug-toolbar-divider' />

                {/* Controls */}
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

            {/* In-toolbar status (paused / running) */}
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
        </Container>

            {/* Below-toolbar status (completed / error) */}
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
