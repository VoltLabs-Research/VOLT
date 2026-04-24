import JsonTree from '@/modules/plugin/components/plugin/JsonTree';
import DynamicIcon from '@/shared/presentation/components/DynamicIcon';
import Box from '@/shared/presentation/primitives/Box';
import Button from '@/shared/presentation/primitives/Button';
import Heading from '@/shared/presentation/primitives/Heading';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Tag from '@/shared/presentation/primitives/Tag';
import Text from '@/shared/presentation/primitives/Text';
import { DebugNodeStatus, usePluginDebugStore } from '@/modules/plugin/stores/plugin/use-plugin-debug-store';
import type { DebugTraceNode } from '@/modules/plugin/stores/plugin/use-plugin-debug-store';
import type { INodeData } from '@/modules/plugin/api/entities/plugin/workflow';
import { NODE_CONFIGS } from '@/modules/plugin/utilities/plugin/node-registry';
import {
    createReactFlowHandleStyle,
    getNodeHandleDefinitions,
    resolveNodeHandlePlacement,
    toReactFlowHandlePosition
} from '@/modules/plugin/utilities/plugin/node-handles';
import { NodeType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import { Handle, useUpdateNodeInternals } from '@xyflow/react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Database, SkipForward, Terminal } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
        <Box className={`workflow-node-trace-tree workflow-node-trace-tree--depth-${depth}`}>
            {nodes.map((node) => {
                const hasDetails = Boolean(node.output || node.error || node.reason || (node.children?.length ?? 0) > 0);
                const isExpanded = expandedTraceIds.has(node.traceId);

                return (
                    <Box key={node.traceId} className={`workflow-node-trace-item workflow-node-trace-item--${node.status}`}>
                        <Row align='start' justify='between' gap='05' className={`workflow-node-trace-row ${hasDetails ? 'cursor-pointer' : ''}`} onClick={() => {
                                if (hasDetails) {
                                    onToggleTraceNode(node.traceId);
                                }
                            }}>
                            <Row align='start' gap='035'>
                                <span className={`workflow-node-trace-status workflow-node-trace-status--${node.status}`}>
                                    {node.status === 'completed' && <CheckCircle2 size={11} />}
                                    {node.status === 'skipped' && <SkipForward size={11} />}
                                    {node.status === 'error' && <AlertCircle size={11} />}
                                </span>
                                <Stack gap='02'>
                                    <Text as='p' className='workflow-node-trace-title'>{resolveTraceNodeLabel(node)}</Text>
                                    <Text as='p' tone='muted' className='workflow-node-trace-meta'>
                                        {node.pluginId ? `${node.pluginId} · ` : ''}{node.nodeId}
                                    </Text>
                                </Stack>
                            </Row>

                            <Row gap='035'>
                                <span className='workflow-node-trace-duration'>
                                    {formatTraceDuration(node.durationMs)}
                                </span>
                                {hasDetails && (
                                    isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />
                                )}
                            </Row>
                        </Row>

                        {isExpanded && (
                            <Stack gap='035' className='workflow-node-trace-details'>
                                {node.error && (
                                    <Box className='workflow-node-trace-message workflow-node-trace-message--error'>
                                        <Text as='p' size='sm'>{node.error}</Text>
                                        {node.stack && (
                                            <pre className='m-0 workflow-node-debug-stack'>{node.stack}</pre>
                                        )}
                                    </Box>
                                )}

                                {node.reason && !node.error && (
                                    <Box className='workflow-node-trace-message workflow-node-trace-message--skipped'>
                                        <Text as='p' size='sm'>{node.reason}</Text>
                                    </Box>
                                )}

                                {node.output && (
                                    <Box className='workflow-node-trace-json'>
                                        <JsonTree data={node.output} defaultExpanded={false} />
                                    </Box>
                                )}

                                {Array.isArray(node.children) && node.children.length > 0 && (
                                    <Box className='workflow-node-trace-children'>
                                        <DebugExecutionTraceTree
                                            nodes={node.children}
                                            expandedTraceIds={expandedTraceIds}
                                            onToggleTraceNode={onToggleTraceNode}
                                            depth={depth + 1}
                                        />
                                    </Box>
                                )}
                            </Stack>
                        )}
                    </Box>
                );
            })}
        </Box>
    );
};

const BaseNode = ({
    id,
    data,
    selected,
    nodeType,
    nodeTitle,
    description,
    children
}: BaseNodeProps) => {
    const config = NODE_CONFIGS[nodeType];
    const updateNodeInternals = useUpdateNodeInternals();
    const debugState = usePluginDebugStore((s) => s.nodeStates[id]);
    const isDebugging = usePluginDebugStore((s) => s.isDebugging || s.totalDuration !== null);
    const inspectedNodeId = usePluginDebugStore((s) => s.inspectedNodeId);
    const setInspectedNode = usePluginDebugStore((s) => s.setInspectedNode);

    const [showLog, setShowLog] = useState(false);
    const [expandedTraceIds, setExpandedTraceIds] = useState<Set<string>>(new Set());
    const handleDefinitions = useMemo(() => getNodeHandleDefinitions(nodeType), [nodeType]);
    const connectorLayoutSignature = useMemo(() => {
        return JSON.stringify((data as INodeData | undefined)?.connectorLayout ?? {});
    }, [data]);

    const isExpanded = inspectedNodeId === id;
    const hasInspectableOutput = isDebugging && debugState &&
        (debugState.status === DebugNodeStatus.Completed
            || debugState.status === DebugNodeStatus.Failed
            || debugState.status === DebugNodeStatus.Skipped);
    const nestedTrace = Array.isArray(debugState?.nestedTrace) ? debugState.nestedTrace : [];
    const hasNestedTrace = nestedTrace.length > 0;
    const logSegments = Array.isArray(debugState?.logSegments) ? debugState.logSegments : [];

    const isEntrypoint = nodeType === NodeType.ENTRYPOINT;
    const supportsExecutionLog = nodeType === NodeType.ENTRYPOINT || nodeType === NodeType.PLUGIN;
    const canInspectExecutionLog = Boolean(
        isDebugging
        && debugState
        && supportsExecutionLog
        && (debugState.status === DebugNodeStatus.Running || hasInspectableOutput)
    );
    const hasLog = Boolean(
        canInspectExecutionLog
        && (
            logSegments.length > 0
            || (isEntrypoint && debugState?.output)
            || debugState?.status === DebugNodeStatus.Running
        )
    );
    const showDebugActions = hasInspectableOutput || hasLog;

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

    useEffect(() => {
        updateNodeInternals(id);
    }, [connectorLayoutSignature, id, updateNodeInternals]);

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
        <Box position='relative' className={`workflow-node-wrapper ${durationLabel || statusLabel ? 'workflow-node-wrapper--has-badge' : ''}`}>
            {durationLabel && (
                <Tag
                    size='xs'
                    tone='success'
                    className='p-absolute top-0 center-x font-weight-6 workflow-node-overhead-badge'
                >
                    {durationLabel}
                </Tag>
            )}

            {statusLabel === 'failed' && (
                <Tag
                    size='xs'
                    tone='danger'
                    className='p-absolute top-0 center-x font-weight-6 workflow-node-overhead-badge'
                >
                    Error
                </Tag>
            )}

            {statusLabel === 'skipped' && (
                <Tag
                    size='xs'
                    tone='neutral'
                    className='p-absolute top-0 center-x font-weight-6 workflow-node-overhead-badge'
                >
                    Skipped
                </Tag>
            )}

            <Box position='relative' border='soft' radius='sm' className={`workflow-node glass-bg ${selected ? 'workflow-node--selected' : ''} ${debugClass}`}>
                {handleDefinitions.map((handleDefinition) => {
                    const placement = resolveNodeHandlePlacement(data as INodeData | undefined, handleDefinition);

                    return (
                        <Handle
                            key={handleDefinition.id}
                            type={handleDefinition.type}
                            position={toReactFlowHandlePosition(placement.side)}
                            id={handleDefinition.id}
                            className={handleDefinition.className}
                            style={createReactFlowHandleStyle(placement)}
                        />
                    );
                })}

                <Row gap='1'>
                    <span className='d-flex items-center content-center workflow-node-icon'>
                        <DynamicIcon iconName={config.icon} />
                    </span>
                    <Stack gap='02' className='f-1'>
                        <Heading level={3}>{nodeTitle ?? config.label}</Heading>
                        {description && (
                            <Text as='p' tone='muted' className='overflow-hidden workflow-node-description'>
                                {description}
                            </Text>
                        )}
                    </Stack>
                </Row>

                {children}
            </Box>

            {showDebugActions && (
                <Box position='absolute' className='center-x items-center workflow-node-btn-group'>
                    {hasInspectableOutput && (
                        <Button
                            variant='ghost'
                            size='sm'
                            shape='pill'
                            leftIcon={<Database size={11} />}
                            className={`b-soft workflow-node-data-btn ${isExpanded ? 'workflow-node-data-btn--active' : ''}`}
                            onClick={handleDataToggle}
                        >
                            Data
                        </Button>
                    )}

                    {hasLog && (
                        <Button
                            variant='ghost'
                            size='sm'
                            shape='pill'
                            leftIcon={<Terminal size={11} />}
                            className={`b-soft workflow-node-data-btn ${showLog ? 'workflow-node-data-btn--active' : ''}`}
                            onClick={handleLogToggle}
                        >
                            Execution Log
                        </Button>
                    )}
                </Box>
            )}

            {isExpanded && hasInspectableOutput && (
                <Box position='absolute' p='05' overflow='y-auto' className='center-x workflow-node-debug-output nowheel' onClick={stopPropagation}>
                    {debugState.status === 'failed' && (
                        <Stack p='05' radius='sm' gap='025' className='font-size-05 workflow-node-debug-error'>
                            <Row gap='025'>
                                <AlertCircle size={12} />
                                <Text as='p' size='sm' weight='bold'>Error</Text>
                            </Row>
                            <Text as='p' size='sm'>{debugState.error}</Text>
                            {debugState.stack && (
                                <pre className='m-0 workflow-node-debug-stack'>{debugState.stack}</pre>
                            )}

                            {hasNestedTrace && (
                                <Stack gap='035' className='workflow-node-trace-panel'>
                                    <Text as='p' size='sm' weight='bold'>Nested Execution</Text>
                                    <DebugExecutionTraceTree
                                        nodes={nestedTrace}
                                        expandedTraceIds={expandedTraceIds}
                                        onToggleTraceNode={toggleTraceNode}
                                    />
                                </Stack>
                            )}
                        </Stack>
                    )}

                    {debugState.status === 'skipped' && (
                        <Stack p='05' radius='sm' gap='035' className='font-size-05 workflow-node-debug-skipped'>
                            <Row gap='025'>
                                <SkipForward size={12} />
                                <Text as='p' size='sm'>{debugState.reason || 'Skipped'}</Text>
                            </Row>

                            {hasNestedTrace && (
                                <Stack gap='035' className='workflow-node-trace-panel'>
                                    <Text as='p' size='sm' weight='bold'>Nested Execution</Text>
                                    <DebugExecutionTraceTree
                                        nodes={nestedTrace}
                                        expandedTraceIds={expandedTraceIds}
                                        onToggleTraceNode={toggleTraceNode}
                                    />
                                </Stack>
                            )}
                        </Stack>
                    )}

                    {debugState.status === 'completed' && (
                        <Stack gap='05' className='workflow-node-debug-tree font-size-05 line-height-5'>
                            {hasNestedTrace && (
                                <Stack gap='035' className='workflow-node-trace-panel'>
                                    <Text as='p' size='sm' weight='bold'>Nested Execution</Text>
                                    <DebugExecutionTraceTree
                                        nodes={nestedTrace}
                                        expandedTraceIds={expandedTraceIds}
                                        onToggleTraceNode={toggleTraceNode}
                                    />
                                </Stack>
                            )}

                            {debugState.output && (
                                <JsonTree data={debugState.output} defaultExpanded={true} />
                            )}
                        </Stack>
                    )}
                </Box>
            )}

            {showLog && hasLog && (
                <Box position='absolute' overflow='hidden' zIndex='5' className='center-x workflow-node-exec-log nowheel' onClick={stopPropagation}>
                    <Row gap='025' className='color-secondary workflow-node-exec-log-header'>
                        <Terminal size={10} />
                        <Text as='p' size='sm' weight='bold'>Execution Log</Text>
                        {exitCode !== undefined && (
                            <Tag
                                size='xs'
                                tone={exitCode === 0 ? 'success' : 'danger'}
                                className='font-mono workflow-node-exec-log-exit'
                            >
                                exit {exitCode}
                            </Tag>
                        )}
                    </Row>
                    <pre className='m-0 p-05 y-auto workflow-node-exec-log-content'>
                        {logSegments.length > 0 ? (
                            <>
                                {logSegments.map((segment, index) => (
                                    <span
                                        key={`${segment.occurredAt}-${index}`}
                                        className={`workflow-node-exec-log-chunk workflow-node-exec-log-chunk--${segment.stream}`}
                                    >
                                        {segment.text}
                                    </span>
                                ))}
                            </>
                        ) : (
                            <>
                                {stdout && (
                                    <span className='workflow-node-exec-log-stdout'>{stdout}</span>
                                )}
                                {stderr && (
                                    <span className='workflow-node-exec-log-stderr'>{stderr}</span>
                                )}
                                {!stdout && !stderr && (
                                    <span className='workflow-node-exec-log-empty'>Waiting for output...</span>
                                )}
                            </>
                        )}
                    </pre>
                </Box>
            )}
        </Box>
    );
};

export default BaseNode;
