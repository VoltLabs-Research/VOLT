import { cn } from '@heroui/react';
import JsonTree from '@/modules/plugin/components/plugin/JsonTree';
import { DebugNodeStatus } from '@/modules/plugin/store/plugin/use-plugin-debug-store';
import { NODE_CONFIGS } from '@/modules/plugin/utils/plugin/node-registry';
import { formatTraceDuration } from '@/modules/plugin/components/plugin/BaseNode/use-node-debug-view';
import {
    NODE_DEBUG_ERROR_CLASS,
    NODE_DEBUG_OUTPUT_CLASS,
    NODE_DEBUG_SKIPPED_CLASS,
    NODE_DEBUG_STACK_CLASS,
    NODE_DEBUG_TREE_CLASS,
    TRACE_CHILDREN_CLASS,
    TRACE_DETAILS_CLASS,
    TRACE_DURATION_CLASS,
    TRACE_ITEM_CLASS,
    TRACE_ITEM_STATUS_CLASS,
    TRACE_JSON_CLASS,
    TRACE_MESSAGE_CLASS,
    TRACE_MESSAGE_ERROR_CLASS,
    TRACE_MESSAGE_SKIPPED_CLASS,
    TRACE_META_CLASS,
    TRACE_PANEL_CLASS,
    TRACE_ROW_CLASS,
    TRACE_STATUS_CLASS,
    TRACE_STATUS_TONE_CLASS,
    TRACE_TITLE_CLASS,
    TRACE_TREE_CLASS,
    resolveTraceTreeIndentClass
} from '@/modules/plugin/components/plugin/BaseNode/node-styles';
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
    <div className={cn(TRACE_TREE_CLASS, resolveTraceTreeIndentClass(depth))}>
        {nodes.map((node) => {
            const children = node.children ?? [];
            const hasDetails = Boolean(node.output || node.error || node.reason || children.length > 0);
            const isExpanded = expandedTraceIds.has(node.traceId);

            return (
                <div className={cn(TRACE_ITEM_CLASS, TRACE_ITEM_STATUS_CLASS[node.status])} key={node.traceId}>
                    <div className={cn(TRACE_ROW_CLASS, hasDetails ? 'cursor-pointer' : null)} onClick={() => {
                            if (hasDetails) {
                                onToggleTraceNode(node.traceId);
                            }
                        }}>
                        <div className='flex flex-row items-start gap-[0.35rem]'>
                            <span className={cn(TRACE_STATUS_CLASS, TRACE_STATUS_TONE_CLASS[node.status])}>
                                {TRACE_STATUS_ICONS[node.status]}
                            </span>
                            <div className='flex flex-col gap-[0.2rem]'>
                                <p className={TRACE_TITLE_CLASS}>{resolveTraceNodeLabel(node)}</p>
                                <p className={TRACE_META_CLASS}>
                                    {node.pluginId ? `${node.pluginId} · ` : ''}{node.nodeId}
                                </p>
                            </div>
                        </div>

                        <div className='flex flex-row items-center gap-[0.35rem]'>
                            <span className={TRACE_DURATION_CLASS}>
                                {formatTraceDuration(node.durationMs)}
                            </span>
                            {hasDetails && (
                                isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />
                            )}
                        </div>
                    </div>

                    {isExpanded && (
                        <div className={TRACE_DETAILS_CLASS}>
                            {node.error && (
                                <div className={cn(TRACE_MESSAGE_CLASS, TRACE_MESSAGE_ERROR_CLASS)}>
                                    <p className='text-xs'>{node.error}</p>
                                    {node.stack && (
                                        <pre className={NODE_DEBUG_STACK_CLASS}>{node.stack}</pre>
                                    )}
                                </div>
                            )}

                            {node.reason && !node.error && (
                                <div className={cn(TRACE_MESSAGE_CLASS, TRACE_MESSAGE_SKIPPED_CLASS)}>
                                    <p className='text-xs'>{node.reason}</p>
                                </div>
                            )}

                            {node.output && (
                                <div className={TRACE_JSON_CLASS}>
                                    <JsonTree data={node.output} defaultExpanded={false} />
                                </div>
                            )}

                            {children.length > 0 && (
                                <div className={TRACE_CHILDREN_CLASS}>
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
        <div className={TRACE_PANEL_CLASS}>
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
        <div className={cn(NODE_DEBUG_OUTPUT_CLASS, 'nowheel')} onClick={(event) => event.stopPropagation()}>
            {debugState.status === DebugNodeStatus.Failed && (
                <div className={NODE_DEBUG_ERROR_CLASS}>
                    <div className='flex flex-row items-center gap-1'>
                        <AlertCircle size={12} />
                        <p className='text-xs font-semibold'>Error</p>
                    </div>
                    <p className='text-xs'>{debugState.error}</p>
                    {debugState.stack && (
                        <pre className={NODE_DEBUG_STACK_CLASS}>{debugState.stack}</pre>
                    )}

                    {tracePanel}
                </div>
            )}

            {debugState.status === DebugNodeStatus.Skipped && (
                <div className={NODE_DEBUG_SKIPPED_CLASS}>
                    <div className='flex flex-row items-center gap-1'>
                        <SkipForward size={12} />
                        <p className='text-xs'>{debugState.reason || 'Skipped'}</p>
                    </div>

                    {tracePanel}
                </div>
            )}

            {debugState.status === DebugNodeStatus.Completed && (
                <div className={NODE_DEBUG_TREE_CLASS}>
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
