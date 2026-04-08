import JsonTree from '@/modules/plugin/components/plugin/atoms/JsonTree';
import Container from '@/shared/presentation/components/Container';
import DynamicIcon from '@/shared/presentation/components/DynamicIcon';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import { usePluginDebugStore } from '@/modules/plugin/stores/plugin/use-plugin-debug-store';
import type { DebugTraceNode } from '@/modules/plugin/stores/plugin/use-plugin-debug-store';
import { NODE_CONFIGS } from '@/modules/plugin/utilities/plugin/node-registry';
import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import { Handle, Position } from '@xyflow/react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Database, SkipForward, Terminal } from 'lucide-react';
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

interface DebugExecutionTraceTreeProps {
    nodes: DebugTraceNode[];
    expandedTraceIds: Set<string>;
    onToggleTraceNode: (traceId: string) => void;
    depth?: number;
}

const formatTraceDuration = (durationMs: number): string => {
    if (durationMs < 1000) {
        return `${durationMs}ms`;
    }

    return `${(durationMs / 1000).toFixed(1)}s`;
};

const resolveTraceNodeLabel = (node: DebugTraceNode): string => {
    if (typeof node.label === 'string' && node.label.trim().length > 0) {
        return node.label;
    }

    if (node.nodeType === 'plugin-reference') {
        return 'Plugin Reference';
    }

    const resolvedNodeType = node.nodeType as NodeType;
    const configuredLabel = NODE_CONFIGS[resolvedNodeType]?.label;
    if (configuredLabel) {
        return configuredLabel;
    }

    return node.nodeType
        .split(/[-_]/g)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
};

const DebugExecutionTraceTree = ({
    nodes,
    expandedTraceIds,
    onToggleTraceNode,
    depth = 0
}: DebugExecutionTraceTreeProps) => {
    if (nodes.length === 0) {
        return null;
    }

    return (
        <Container className={`workflow-node-trace-tree workflow-node-trace-tree--depth-${depth}`}>
            {nodes.map((node) => {
                const hasDetails = Boolean(node.output || node.error || node.reason || (node.children?.length ?? 0) > 0);
                const isExpanded = expandedTraceIds.has(node.traceId);

                return (
                    <Container key={node.traceId} className={`workflow-node-trace-item workflow-node-trace-item--${node.status}`}>
                        <Container
                            className={`workflow-node-trace-row d-flex items-start content-between gap-05 ${hasDetails ? 'cursor-pointer' : ''}`}
                            onClick={() => {
                                if (hasDetails) {
                                    onToggleTraceNode(node.traceId);
                                }
                            }}
                        >
                            <Container className='d-flex items-start gap-035'>
                                <span className={`workflow-node-trace-status workflow-node-trace-status--${node.status}`}>
                                    {node.status === 'completed' && <CheckCircle2 size={11} />}
                                    {node.status === 'skipped' && <SkipForward size={11} />}
                                    {node.status === 'error' && <AlertCircle size={11} />}
                                </span>
                                <Container className='d-flex column gap-02'>
                                    <Paragraph className='workflow-node-trace-title'>{resolveTraceNodeLabel(node)}</Paragraph>
                                    <Paragraph className='workflow-node-trace-meta color-muted'>
                                        {node.pluginId ? `${node.pluginId} · ` : ''}{node.nodeId}
                                    </Paragraph>
                                </Container>
                            </Container>

                            <Container className='d-flex items-center gap-035'>
                                <span className='workflow-node-trace-duration'>
                                    {formatTraceDuration(node.durationMs)}
                                </span>
                                {hasDetails && (
                                    isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />
                                )}
                            </Container>
                        </Container>

                        {isExpanded && (
                            <Container className='workflow-node-trace-details d-flex column gap-035'>
                                {node.error && (
                                    <Container className='workflow-node-trace-message workflow-node-trace-message--error'>
                                        <Paragraph className='font-size-1'>{node.error}</Paragraph>
                                        {node.stack && (
                                            <pre className='m-0 workflow-node-debug-stack'>{node.stack}</pre>
                                        )}
                                    </Container>
                                )}

                                {node.reason && !node.error && (
                                    <Container className='workflow-node-trace-message workflow-node-trace-message--skipped'>
                                        <Paragraph className='font-size-1'>{node.reason}</Paragraph>
                                    </Container>
                                )}

                                {node.output && (
                                    <Container className='workflow-node-trace-json'>
                                        <JsonTree data={node.output} defaultExpanded={false} />
                                    </Container>
                                )}

                                {Array.isArray(node.children) && node.children.length > 0 && (
                                    <Container className='workflow-node-trace-children'>
                                        <DebugExecutionTraceTree
                                            nodes={node.children}
                                            expandedTraceIds={expandedTraceIds}
                                            onToggleTraceNode={onToggleTraceNode}
                                            depth={depth + 1}
                                        />
                                    </Container>
                                )}
                            </Container>
                        )}
                    </Container>
                );
            })}
        </Container>
    );
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
    const [expandedTraceIds, setExpandedTraceIds] = useState<Set<string>>(new Set());

    const isExpanded = inspectedNodeId === id;
    const hasInspectableOutput = isDebugging && debugState &&
        (debugState.status === 'completed' || debugState.status === 'failed' || debugState.status === 'skipped');
    const nestedTrace = Array.isArray(debugState?.nestedTrace) ? debugState.nestedTrace : [];
    const hasNestedTrace = nestedTrace.length > 0;

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

    const toggleTraceNode = useCallback((traceId: string) => {
        setExpandedTraceIds((prev) => {
            const next = new Set(prev);
            if (next.has(traceId)) {
                next.delete(traceId);
            } else {
                next.add(traceId);
            }
            return next;
        });
    }, []);

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

            <Container className={`p-relative b-soft radius-sm workflow-node glass-bg ${selected ? 'workflow-node--selected' : ''} ${debugClass}`}>
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

                            {hasNestedTrace && (
                                <Container className='workflow-node-trace-panel d-flex column gap-035'>
                                    <Paragraph className='font-size-1 font-weight-6'>Nested Execution</Paragraph>
                                    <DebugExecutionTraceTree
                                        nodes={nestedTrace}
                                        expandedTraceIds={expandedTraceIds}
                                        onToggleTraceNode={toggleTraceNode}
                                    />
                                </Container>
                            )}
                        </Container>
                    )}

                    {debugState.status === 'skipped' && (
                        <Container className='p-05 radius-sm font-size-05 workflow-node-debug-skipped d-flex column gap-035'>
                            <Container className='d-flex items-center gap-025'>
                                <SkipForward size={12} />
                                <Paragraph className='font-size-1'>{debugState.reason || 'Skipped'}</Paragraph>
                            </Container>

                            {hasNestedTrace && (
                                <Container className='workflow-node-trace-panel d-flex column gap-035'>
                                    <Paragraph className='font-size-1 font-weight-6'>Nested Execution</Paragraph>
                                    <DebugExecutionTraceTree
                                        nodes={nestedTrace}
                                        expandedTraceIds={expandedTraceIds}
                                        onToggleTraceNode={toggleTraceNode}
                                    />
                                </Container>
                            )}
                        </Container>
                    )}

                    {debugState.status === 'completed' && (
                        <Container className='workflow-node-debug-tree font-size-05 line-height-5 d-flex column gap-05'>
                            {hasNestedTrace && (
                                <Container className='workflow-node-trace-panel d-flex column gap-035'>
                                    <Paragraph className='font-size-1 font-weight-6'>Nested Execution</Paragraph>
                                    <DebugExecutionTraceTree
                                        nodes={nestedTrace}
                                        expandedTraceIds={expandedTraceIds}
                                        onToggleTraceNode={toggleTraceNode}
                                    />
                                </Container>
                            )}

                            {debugState.output && (
                                <JsonTree data={debugState.output} defaultExpanded={true} />
                            )}
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
