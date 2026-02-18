import { useCallback, useState, type ReactNode } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { NodeType } from '@/modules/plugin/domain/entities';
import { NODE_CONFIGS } from '@/modules/plugin/presentation/utilities/node-types';
import { usePluginDebugStore } from '@/modules/plugin/presentation/stores/use-plugin-debug-store';
import JsonTree from '@/modules/plugin/presentation/components/atoms/JsonTree';
import DynamicIcon from '@/shared/presentation/components/DynamicIcon';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { AlertCircle, SkipForward, Database, Terminal } from 'lucide-react';
import './BaseNode.css';

interface BaseNodeProps extends NodeProps {
    nodeType: NodeType;
    nodeTitle?: string;
    description?: string;
    children?: ReactNode;
};

const BaseNode = ({
    id,
    selected,
    nodeType,
    nodeTitle,
    description,
    children
}: BaseNodeProps) => {
    const config = NODE_CONFIGS[nodeType];
    const debugState = usePluginDebugStore((s) => s.nodeStates[id]);
    const isDebugging = usePluginDebugStore((s) => s.isDebugging || s.totalDuration !== null);
    const inspectedNodeId = usePluginDebugStore((s) => s.inspectedNodeId);
    const setInspectedNode = usePluginDebugStore((s) => s.setInspectedNode);

    const [showLog, setShowLog] = useState(false);

    const isExpanded = inspectedNodeId === id;
    const hasInspectableOutput = isDebugging && debugState &&
        (debugState.status === 'completed' || debugState.status === 'failed' || debugState.status === 'skipped');

    const isEntrypoint = nodeType === NodeType.ENTRYPOINT;
    const hasLog = isEntrypoint && hasInspectableOutput && debugState?.output &&
        (debugState.output.stdout || debugState.output.stderr);

    const debugClass = isDebugging && debugState
        ? `workflow-node--debug-${debugState.status}`
        : '';

    const stopPropagation = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
    }, []);

    const handleDataToggle = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setShowLog(false);
        setInspectedNode(isExpanded ? null : id);
    }, [isExpanded, id, setInspectedNode]);

    const handleLogToggle = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (showLog) {
            setShowLog(false);
        } else {
            setInspectedNode(null);
            setShowLog(true);
        }
    }, [showLog, setInspectedNode]);

    const durationLabel = isDebugging && debugState?.status === 'completed' && debugState.durationMs !== undefined
        ? (debugState.durationMs < 1000 ? `${debugState.durationMs}ms` : `${(debugState.durationMs / 1000).toFixed(1)}s`)
        : null;

    const statusLabel = isDebugging && debugState?.status === 'failed'
        ? 'failed'
        : isDebugging && debugState?.status === 'skipped'
            ? 'skipped'
            : null;

    return (
        <Container className={`p-relative workflow-node-wrapper ${durationLabel || statusLabel ? 'workflow-node-wrapper--has-badge' : ''}`}>
            {durationLabel && (
                <span className='p-absolute top-0 center-x radius-full font-weight-6 workflow-node-overhead-badge workflow-node-overhead-badge--completed'>
                    {durationLabel}
                </span>
            )}

            {statusLabel === 'failed' && (
                <span className='p-absolute top-0 center-x radius-full font-weight-6 workflow-node-overhead-badge workflow-node-overhead-badge--failed'>
                    Error
                </span>
            )}

            {statusLabel === 'skipped' && (
                <span className='p-absolute top-0 center-x radius-full font-weight-6 workflow-node-overhead-badge workflow-node-overhead-badge--skipped'>
                    Skipped
                </span>
            )}

            <Container className={`p-relative b-soft radius-sm workflow-node ${selected ? 'workflow-node--selected' : ''} ${debugClass}`}>
                {config.inputs > 0 && (
                    <Handle type='target' position={Position.Left} id='input' />
                )}

                <Container className='d-flex items-center gap-1'>
                    <span className='d-flex items-center content-center workflow-node-icon'>
                        <DynamicIcon iconName={config.icon} />
                    </span>
                    <Container className='d-flex column gap-02 f-1'>
                        <Title>{nodeTitle ?? config.label}</Title>
                        {description && (
                            <Paragraph className='color-muted overflow-hidden workflow-node-description'>
                                {description}
                            </Paragraph>
                        )}
                    </Container>
                </Container>

                {children}

                {!children && config.outputs !== 0 && (
                    <Handle type='source' position={Position.Right} id='output' />
                )}
            </Container>

            {hasInspectableOutput && (
                <Container className='p-absolute center-x items-center workflow-node-btn-group'>
                    <button
                        className={`b-soft radius-full cursor-pointer font-weight-6 workflow-node-data-btn ${isExpanded ? 'workflow-node-data-btn--active' : ''}`}
                        onClick={handleDataToggle}
                    >
                        <Database size={11} />
                        Data
                    </button>

                    {hasLog && (
                        <button
                            className={`b-soft radius-full cursor-pointer font-weight-6 workflow-node-data-btn ${showLog ? 'workflow-node-data-btn--active' : ''}`}
                            onClick={handleLogToggle}
                        >
                            <Terminal size={11} />
                            Execution Log
                        </button>
                    )}
                </Container>
            )}

            {isExpanded && hasInspectableOutput && (
                <Container className='p-absolute center-x p-05 y-auto scrollbar-thin workflow-node-debug-output nowheel' onClick={stopPropagation}>
                    {debugState.status === 'failed' && (
                        <Container className='p-05 radius-sm font-size-05 workflow-node-debug-error d-flex column gap-025'>
                            <Container className='d-flex items-center gap-025'>
                                <AlertCircle size={12} />
                                <Paragraph className='font-size-1 font-weight-6'>Error</Paragraph>
                            </Container>
                            <Paragraph className='font-size-1'>{debugState.error}</Paragraph>
                            {debugState.stack && (
                                <pre className='m-0 workflow-node-debug-stack'>{debugState.stack}</pre>
                            )}
                        </Container>
                    )}

                    {debugState.status === 'skipped' && (
                        <Container className='p-05 radius-sm font-size-05 workflow-node-debug-skipped d-flex items-center gap-025'>
                            <SkipForward size={12} />
                            <Paragraph className='font-size-1'>{debugState.reason || 'Skipped'}</Paragraph>
                        </Container>
                    )}

                    {debugState.status === 'completed' && debugState.output && (
                        <Container className='workflow-node-debug-tree font-size-05 line-height-5'>
                            <JsonTree data={debugState.output} defaultExpanded={false} />
                        </Container>
                    )}
                </Container>
            )}

            {showLog && hasLog && (
                <Container className='p-absolute center-x overflow-hidden z-5 workflow-node-exec-log nowheel' onClick={stopPropagation}>
                    <Container className='color-secondary workflow-node-exec-log-header d-flex items-center gap-025'>
                        <Terminal size={10} />
                        <Paragraph className='font-size-1 font-weight-6'>Execution Log</Paragraph>
                        {debugState.output.exitCode !== undefined && (
                            <span className={`radius-full font-weight-6 workflow-node-exec-log-exit ${debugState.output.exitCode === 0 ? 'workflow-node-exec-log-exit--ok' : 'workflow-node-exec-log-exit--fail'}`}>
                                exit {debugState.output.exitCode}
                            </span>
                        )}
                    </Container>
                    <pre className='m-0 p-05 y-auto scrollbar-thin workflow-node-exec-log-content'>
                        {debugState.output.stdout && (
                            <span className='workflow-node-exec-log-stdout'>{debugState.output.stdout}</span>
                        )}
                        {debugState.output.stderr && (
                            <span className='workflow-node-exec-log-stderr'>{debugState.output.stderr}</span>
                        )}
                    </pre>
                </Container>
            )}
        </Container>
    );
};

export default BaseNode;
