import JsonTree from '@/modules/plugin/components/plugin/JsonTree';
import { Box, Row, Stack, Text } from '@voltstack/bravais';
import { DebugNodeStatus } from '@/modules/plugin/store/plugin/use-plugin-debug-store';
import { NODE_CONFIGS } from '@/modules/plugin/utils/plugin/node-registry';
import { formatTraceDuration } from '@/modules/plugin/components/plugin/BaseNode/use-node-debug-view';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, SkipForward } from 'lucide-react';
import type { DebugNodeState, DebugTraceNode } from '@/modules/plugin/store/plugin/use-plugin-debug-store';
import type { NodeType } from '@volt/contracts/modules/plugin/enums';

const TRACE_STATUS_ICONS = {
    completed: <CheckCircle2 size={11} />,
    skipped: <SkipForward size={11} />,
    error: <AlertCircle size={11} />
};

interface TracePanelProps {
    nodes: DebugTraceNode[];
    expandedTraceIds: Set<string>;
    onToggleTraceNode: (traceId: string) => void;
}

type TraceTreeProps = TracePanelProps & { depth?: number };

/**
 * Trace nodes carry a free-form `nodeType` because a trace can cross into a
 * referenced plugin, whose node types are not part of this workflow's registry.
 */
const resolveTraceNodeLabel = (node: DebugTraceNode): string => {
    if (node.label?.trim()) {
        return node.label;
    }

    if (node.nodeType === 'plugin-reference') {
        return 'Plugin Reference';
    }

    return NODE_CONFIGS[node.nodeType as NodeType]?.label ?? node.nodeType
        .split(/[-_]/g)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
};

const DebugExecutionTraceTree = ({
    nodes,
    expandedTraceIds,
    onToggleTraceNode,
    depth = 0
}: TraceTreeProps) => (
    <Box className={`workflow-node-trace-tree workflow-node-trace-tree--depth-${depth}`}>
        {nodes.map((node) => {
            const children = node.children ?? [];
            const hasDetails = Boolean(node.output || node.error || node.reason || children.length > 0);
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
                                {TRACE_STATUS_ICONS[node.status]}
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

                            {children.length > 0 && (
                                <Box className='workflow-node-trace-children'>
                                    <DebugExecutionTraceTree
                                        nodes={children}
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

/** Expandable tree of the child executions this node triggered. */
const NestedExecutionTracePanel = (props: TracePanelProps) => {
    if (props.nodes.length === 0) {
        return null;
    }

    return (
        <Stack gap='035' className='workflow-node-trace-panel'>
            <Text as='p' size='sm' weight='bold'>Nested Execution</Text>
            <DebugExecutionTraceTree {...props} />
        </Stack>
    );
};

interface NodeDebugOutputProps {
    debugState: DebugNodeState;
    expandedTraceIds: Set<string>;
    onToggleTraceNode: (traceId: string) => void;
}

/**
 * Overlay showing what a node produced on its last debug run: the failure, the
 * skip reason, or the output tree — each alongside its nested execution trace.
 */
const NodeDebugOutput = ({ debugState, expandedTraceIds, onToggleTraceNode }: NodeDebugOutputProps) => {
    const tracePanel = (
        <NestedExecutionTracePanel
            nodes={debugState.nestedTrace ?? []}
            expandedTraceIds={expandedTraceIds}
            onToggleTraceNode={onToggleTraceNode}
        />
    );

    return (
        <Box position='absolute' p='05' overflow='y-auto' className='center-x workflow-node-debug-output nowheel' onClick={(event) => event.stopPropagation()}>
            {debugState.status === DebugNodeStatus.Failed && (
                <Stack p='05' radius='sm' gap='025' className='text-xs workflow-node-debug-error'>
                    <Row gap='025'>
                        <AlertCircle size={12} />
                        <Text as='p' size='sm' weight='bold'>Error</Text>
                    </Row>
                    <Text as='p' size='sm'>{debugState.error}</Text>
                    {debugState.stack && (
                        <pre className='m-0 workflow-node-debug-stack'>{debugState.stack}</pre>
                    )}

                    {tracePanel}
                </Stack>
            )}

            {debugState.status === DebugNodeStatus.Skipped && (
                <Stack p='05' radius='sm' gap='035' className='text-xs workflow-node-debug-skipped'>
                    <Row gap='025'>
                        <SkipForward size={12} />
                        <Text as='p' size='sm'>{debugState.reason || 'Skipped'}</Text>
                    </Row>

                    {tracePanel}
                </Stack>
            )}

            {debugState.status === DebugNodeStatus.Completed && (
                <Stack gap='05' className='workflow-node-debug-tree text-xs leading-normal'>
                    {tracePanel}

                    {debugState.output && (
                        <JsonTree data={debugState.output} defaultExpanded={true} />
                    )}
                </Stack>
            )}
        </Box>
    );
};

export default NodeDebugOutput;
