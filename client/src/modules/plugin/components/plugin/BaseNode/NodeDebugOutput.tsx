import { cn } from '@heroui/react';
import JsonTree from '@/modules/plugin/components/plugin/JsonTree';
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
    <div className={`workflow-node-trace-tree workflow-node-trace-tree--depth-${depth}`}>
        {nodes.map((node) => {
            const children = node.children ?? [];
            const hasDetails = Boolean(node.output || node.error || node.reason || children.length > 0);
            const isExpanded = expandedTraceIds.has(node.traceId);

            return (
                <div className={`workflow-node-trace-item workflow-node-trace-item--${node.status}`} key={node.traceId}>
                    <div className={cn('flex flex-row items-start justify-between gap-2', `workflow-node-trace-row ${hasDetails ? 'cursor-pointer' : ''}`)} onClick={() => {
                            if (hasDetails) {
                                onToggleTraceNode(node.traceId);
                            }
                        }}>
                        <div className='flex flex-row items-start gap-[0.35rem]'>
                            <span className={`workflow-node-trace-status workflow-node-trace-status--${node.status}`}>
                                {TRACE_STATUS_ICONS[node.status]}
                            </span>
                            <div className='flex flex-col gap-[0.2rem]'>
                                <p className='workflow-node-trace-title'>{resolveTraceNodeLabel(node)}</p>
                                <p className='text-muted workflow-node-trace-meta'>
                                    {node.pluginId ? `${node.pluginId} · ` : ''}{node.nodeId}
                                </p>
                            </div>
                        </div>

                        <div className='flex flex-row items-center gap-[0.35rem]'>
                            <span className='workflow-node-trace-duration'>
                                {formatTraceDuration(node.durationMs)}
                            </span>
                            {hasDetails && (
                                isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />
                            )}
                        </div>
                    </div>

                    {isExpanded && (
                        <div className='flex flex-col gap-[0.35rem] workflow-node-trace-details'>
                            {node.error && (
                                <div className='workflow-node-trace-message workflow-node-trace-message--error'>
                                    <p className='text-xs'>{node.error}</p>
                                    {node.stack && (
                                        <pre className='m-0 workflow-node-debug-stack'>{node.stack}</pre>
                                    )}
                                </div>
                            )}

                            {node.reason && !node.error && (
                                <div className='workflow-node-trace-message workflow-node-trace-message--skipped'>
                                    <p className='text-xs'>{node.reason}</p>
                                </div>
                            )}

                            {node.output && (
                                <div className='workflow-node-trace-json'>
                                    <JsonTree data={node.output} defaultExpanded={false} />
                                </div>
                            )}

                            {children.length > 0 && (
                                <div className='workflow-node-trace-children'>
                                    <DebugExecutionTraceTree
                                        nodes={children}
                                        expandedTraceIds={expandedTraceIds}
                                        onToggleTraceNode={onToggleTraceNode}
                                        depth={depth + 1}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            );
        })}
    </div>
);

/** Expandable tree of the child executions this node triggered. */
const NestedExecutionTracePanel = (props: TracePanelProps) => {
    if (props.nodes.length === 0) {
        return null;
    }

    return (
        <div className='flex flex-col gap-[0.35rem] workflow-node-trace-panel'>
            <p className='text-xs font-semibold'>Nested Execution</p>
            <DebugExecutionTraceTree {...props} />
        </div>
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
        <div className='p-2 absolute overflow-y-auto center-x workflow-node-debug-output nowheel' onClick={(event) => event.stopPropagation()}>
            {debugState.status === DebugNodeStatus.Failed && (
                <div className='flex flex-col gap-1 p-2 rounded-lg text-xs workflow-node-debug-error'>
                    <div className='flex flex-row items-center gap-1'>
                        <AlertCircle size={12} />
                        <p className='text-xs font-semibold'>Error</p>
                    </div>
                    <p className='text-xs'>{debugState.error}</p>
                    {debugState.stack && (
                        <pre className='m-0 workflow-node-debug-stack'>{debugState.stack}</pre>
                    )}

                    {tracePanel}
                </div>
            )}

            {debugState.status === DebugNodeStatus.Skipped && (
                <div className='flex flex-col gap-[0.35rem] p-2 rounded-lg text-xs workflow-node-debug-skipped'>
                    <div className='flex flex-row items-center gap-1'>
                        <SkipForward size={12} />
                        <p className='text-xs'>{debugState.reason || 'Skipped'}</p>
                    </div>

                    {tracePanel}
                </div>
            )}

            {debugState.status === DebugNodeStatus.Completed && (
                <div className='flex flex-col gap-2 workflow-node-debug-tree text-xs leading-normal'>
                    {tracePanel}

                    {debugState.output && (
                        <JsonTree data={debugState.output} defaultExpanded={true} />
                    )}
                </div>
            )}
        </div>
    );
};

export default NodeDebugOutput;
