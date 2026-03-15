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
import { AlertTriangle, Bug, CheckCircle2, FastForward, Play, Square, StepForward } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import './DebugToolbar.css';

interface DebugStatusContent {
    detail: string;
    helper: string | null;
    label: string;
    liveMessage: string;
    modifierClassName: string;
};

const resolveNodeType = (value: string | null): NodeType | null => {
    if (!value) {
        return null;
    }

    return Object.values(NodeType).find((nodeType) => nodeType === value) ?? null;
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

        const argumentDefinitions = argsNode.data.arguments?.arguments;
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

    let currentNodeType: NodeType | null = null;
    if (currentNodeId) {
        currentNodeType = resolveNodeType(executionOrder.find((node) => node.nodeId === currentNodeId)?.type ?? null);
    }

    let currentNodeLabel: string | null = null;
    if (currentNodeType) {
        currentNodeLabel = NODE_CONFIGS[currentNodeType]?.label ?? currentNodeType;
    }

    const completedCount = Object.values(nodeStates).filter((s) => s.status === 'completed').length;

    let debugStatusContent: DebugStatusContent | null = null;
    if (isStarting) {
        debugStatusContent = {
            detail: 'Preparing debug session…',
            helper: 'Loading the selected trajectory frame and initializing node state.',
            label: 'Debug starting',
            liveMessage: 'Starting debug session.',
            modifierClassName: 'debug-toolbar-status-panel--running'
        };
    } else if (sessionError) {
        debugStatusContent = {
            detail: 'Debug session failed.',
            helper: sessionError,
            label: 'Debug error',
            liveMessage: `Debug session error: ${sessionError}`,
            modifierClassName: 'debug-toolbar-status-panel--error'
        };
    } else if (isDebugging && isPaused && currentNodeLabel) {
        debugStatusContent = {
            detail: `Paused at ${currentNodeLabel}.`,
            helper: `Node ${currentNodeIndex + 1} of ${totalNodes} is ready for inspection or stepping.`,
            label: 'Debug paused',
            liveMessage: `Debug paused at ${currentNodeLabel}. Node ${currentNodeIndex + 1} of ${totalNodes}.`,
            modifierClassName: 'debug-toolbar-status-panel--paused'
        };
    } else if (isDebugging) {
        debugStatusContent = {
            detail: 'Debug session running.',
            helper: `${completedCount} of ${totalNodes} nodes completed.`,
            label: 'Debug running',
            liveMessage: `Debug running. ${completedCount} of ${totalNodes} nodes completed.`,
            modifierClassName: 'debug-toolbar-status-panel--running'
        };
    } else if (totalDuration !== null && totalDuration >= 0) {
        debugStatusContent = {
            detail: 'Debug session completed.',
            helper: `Finished in ${totalDuration < 1000 ? `${totalDuration} milliseconds` : `${(totalDuration / 1000).toFixed(1)} seconds`}.`,
            label: 'Debug complete',
            liveMessage: `Debug completed in ${totalDuration < 1000 ? `${totalDuration} milliseconds` : `${(totalDuration / 1000).toFixed(1)} seconds`}.`,
            modifierClassName: 'debug-toolbar-status-panel--completed'
        };
    } else if (!selectedTrajectoryId || selectedTimestep === null) {
        debugStatusContent = {
            detail: 'Select a trajectory and frame to start debugging.',
            helper: 'Debug controls stay secondary until a debug session becomes the active task.',
            label: 'Debug setup required',
            liveMessage: 'Select a trajectory and frame to start debugging.',
            modifierClassName: 'debug-toolbar-status-panel--idle'
        };
    } else {
        debugStatusContent = {
            detail: 'Ready to start debugging.',
            helper: hasConfigurableArgs ? 'This workflow has configurable arguments that must be reviewed before start.' : 'Start runs the selected trajectory frame through the current workflow.',
            label: 'Debug ready',
            liveMessage: 'Debug session is ready to start.',
            modifierClassName: 'debug-toolbar-status-panel--ready'
        };
    }

    return (
        <Container className='p-absolute z-10 d-flex column items-center top-1 center-x debug-toolbar-wrapper'>
            {debugStatusContent && (
                <Container className='plugin-accessible-status' role='status' aria-live='polite'>
                    {debugStatusContent.liveMessage}
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
                            variant='soft'
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
                            variant='outline'
                            intent='brand'
                            size='sm'
                            className='debug-toolbar-action debug-toolbar-action--continue'
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

            {debugStatusContent && (
                <Container className={`d-flex items-start gap-05 radius-md p-1 debug-toolbar-status-panel ${debugStatusContent.modifierClassName}`} role={sessionError ? 'alert' : 'status'} aria-live={sessionError ? 'assertive' : 'polite'}>
                    {sessionError && <AlertTriangle size={16} className='debug-toolbar-status-icon' aria-hidden='true' />}
                    {!sessionError && totalDuration !== null && totalDuration >= 0 && !isDebugging && !isStarting && (
                        <CheckCircle2 size={16} className='debug-toolbar-status-icon' aria-hidden='true' />
                    )}
                    {!sessionError && (isDebugging || isStarting) && (
                        <span className={`debug-toolbar-status-dot ${isPaused ? 'debug-toolbar-status-dot--paused' : 'debug-toolbar-status-dot--running'} radius-full f-shrink-0`} aria-hidden='true' />
                    )}
                    {!sessionError && !isDebugging && !isStarting && totalDuration === null && (
                        <Bug size={16} className='debug-toolbar-status-icon debug-toolbar-status-icon--idle' aria-hidden='true' />
                    )}

                    <Container className='d-flex column gap-025 min-w-0'>
                        <Container className='d-flex items-center gap-05 flex-wrap'>
                            <span className='debug-toolbar-state-badge'>{debugStatusContent.label}</span>
                            {isDebugging && isPaused && currentNodeLabel && (
                                <Paragraph className='font-size-2 debug-toolbar-inline-copy'>
                                    {currentNodeLabel} ({currentNodeIndex + 1}/{totalNodes})
                                </Paragraph>
                            )}
                        </Container>
                        <Paragraph className='font-size-2 debug-toolbar-status-copy'>{debugStatusContent.detail}</Paragraph>
                        {debugStatusContent.helper && (
                            <Paragraph className='font-size-2 color-secondary debug-toolbar-status-copy'>{debugStatusContent.helper}</Paragraph>
                        )}
                    </Container>
                </Container>
            )}

            <DebugArgumentsPanel onStart={handleStartFromPanel} canStart={canStart} />
        </Container>
    );
};

export default DebugToolbar;
