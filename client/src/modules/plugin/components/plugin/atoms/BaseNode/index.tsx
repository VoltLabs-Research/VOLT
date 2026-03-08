import JsonTree from '@/modules/plugin/components/plugin/atoms/JsonTree';
import Container from '@/shared/presentation/components/Container';
import DynamicIcon from '@/shared/presentation/components/DynamicIcon';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import { usePluginDebugStore } from '@/modules/plugin/stores/plugin/use-plugin-debug-store';
import { NODE_CONFIGS } from '@/modules/plugin/utilities/plugin/node-types';
import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import { Handle, Position } from '@xyflow/react';
import { AlertCircle, Database, SkipForward, Terminal } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { ReactNode } from 'react';
import './BaseNode.css';

const renderDebugValue = (value: unknown): ReactNode => {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }

    return JSON.stringify(value, null, 2);
};

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
    const hasLog = Boolean(isEntrypoint && hasInspectableOutput && debugState?.output);

    let debugClass = '';
    if (isDebugging && debugState) {
        debugClass = `workflow-node--debug-${debugState.status}`;
    }

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

    let durationLabel: string | null = null;
    if (isDebugging && debugState?.status === 'completed' && debugState.durationMs !== undefined) {
        if (debugState.durationMs < 1000) {
            durationLabel = `${debugState.durationMs}ms`;
        } else {
            durationLabel = `${(debugState.durationMs / 1000).toFixed(1)}s`;
        }
    }

    const debugOutput = debugState?.output;
    const exitCode = typeof debugOutput?.exitCode === 'number' ? debugOutput.exitCode : undefined;
    const stdout = renderDebugValue(debugOutput?.stdout);
    const stderr = renderDebugValue(debugOutput?.stderr);

    let statusLabel: 'failed' | 'skipped' | null = null;
    if (isDebugging && debugState?.status === 'failed') {
        statusLabel = 'failed';
    } else if (isDebugging && debugState?.status === 'skipped') {
        statusLabel = 'skipped';
    }

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
                            <JsonTree data={debugState.output} defaultExpanded={true} />
                        </Container>
                    )}
                </Container>
            )}

            {showLog && hasLog && (
                <Container className='p-absolute center-x overflow-hidden z-5 workflow-node-exec-log nowheel' onClick={stopPropagation}>
                    <Container className='color-secondary workflow-node-exec-log-header d-flex items-center gap-025'>
                        <Terminal size={10} />
                        <Paragraph className='font-size-1 font-weight-6'>Execution Log</Paragraph>
                        {exitCode !== undefined && (
                            <span className={`radius-full font-weight-6 workflow-node-exec-log-exit ${exitCode === 0 ? 'workflow-node-exec-log-exit--ok' : 'workflow-node-exec-log-exit--fail'}`}>
                                exit {exitCode}
                            </span>
                        )}
                    </Container>
                    <pre className='m-0 p-05 y-auto scrollbar-thin workflow-node-exec-log-content'>
                        {stdout && (
                            <span className='workflow-node-exec-log-stdout'>{stdout}</span>
                        )}
                        {stderr && (
                            <span className='workflow-node-exec-log-stderr'>{stderr}</span>
                        )}
                    </pre>
                </Container>
            )}
        </Container>
    );
};

export default BaseNode;
