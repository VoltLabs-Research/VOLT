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

const MAX_INDENTED_TRACE_DEPTH = 3;

interface TracePanelProps {
    nodes: DebugTraceNode[];
    expandedTraceIds: Set<string>;
    onToggleTraceNode: (traceId: string) => void;
}

type TraceTreeProps = TracePanelProps & { depth?: number };

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
}: TraceTreeProps) => {
    const itemStatusClass: Record<DebugTraceNode['status'], string> = {
        completed: 'border-[color-mix(in_srgb,var(--success)_25%,var(--border))]',
        skipped: 'border-[color-mix(in_srgb,var(--border-secondary)_30%,var(--border))]',
        error: 'border-[color-mix(in_srgb,var(--danger)_30%,var(--border))]'
    };

    const statusToneClass: Record<DebugTraceNode['status'], string> = {
        completed: 'text-success',
        skipped: 'text-border-secondary',
        error: 'text-danger'
    };

    return (
        <div className={cn('flex flex-col gap-[0.35rem]', depth >= 1 && depth <= MAX_INDENTED_TRACE_DEPTH ? 'ml-[0.6rem] border-l border-border/80 pl-[0.55rem]' : null)}>
            {nodes.map((node) => {
                const children = node.children ?? [];
                const hasDetails = Boolean(node.output || node.error || node.reason || children.length > 0);
                const isExpanded = expandedTraceIds.has(node.traceId);

                return (
                    <div className={cn('rounded-[0.35rem] border bg-surface-tertiary/85 px-[0.4rem] py-[0.35rem]', itemStatusClass[node.status])} key={node.traceId}>
                        <div className={cn('flex flex-row items-start justify-between gap-2 text-[0.7rem]', hasDetails ? 'cursor-pointer' : null)} onClick={() => {
                                if (hasDetails) {
                                    onToggleTraceNode(node.traceId);
                                }
                            }}>
                            <div className='flex flex-row items-start gap-[0.35rem]'>
                                <span className={cn('inline-flex flex-row items-center justify-center mt-[0.1rem]', statusToneClass[node.status])}>
                                    {TRACE_STATUS_ICONS[node.status]}
                                </span>
                                <div className='flex flex-col gap-[0.2rem]'>
                                    <p className='text-[0.72rem] font-semibold'>{resolveTraceNodeLabel(node)}</p>
                                    <p className='break-all text-[0.62rem] leading-[1.3] text-muted'>
                                        {node.pluginId ? `${node.pluginId} · ` : ''}{node.nodeId}
                                    </p>
                                </div>
                            </div>
                            <div className='flex flex-row items-center gap-[0.35rem]'>
                                <span className='whitespace-nowrap font-mono text-[0.58rem] text-muted'>
                                    {formatTraceDuration(node.durationMs)}
                                </span>
                                {hasDetails && (
                                    isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />
                                )}
                            </div>
                        </div>

                        {isExpanded && (
                            <div className='flex flex-col gap-[0.35rem] mt-[0.35rem]'>
                                {node.error && (
                                    <div className='rounded-[0.3rem] px-[0.4rem] py-[0.35rem] bg-danger/8 text-danger'>
                                        <p className='text-xs'>{node.error}</p>
                                        {node.stack && (
                                            <pre className='m-0 whitespace-pre-wrap break-all font-mono text-[0.625rem] opacity-80'>{node.stack}</pre>
                                        )}
                                    </div>
                                )}

                                {node.reason && !node.error && (
                                    <div className='rounded-[0.3rem] px-[0.4rem] py-[0.35rem] bg-border-secondary/8 text-border-secondary'>
                                        <p className='text-xs'>{node.reason}</p>
                                    </div>
                                )}

                                {node.output && (
                                    <div className='rounded-[0.3rem] bg-surface-secondary/82 px-[0.3rem] py-[0.25rem]'>
                                        <JsonTree data={node.output} defaultExpanded={false} />
                                    </div>
                                )}

                                {children.length > 0 && (
                                    <div className='pt-[0.15rem]'>
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
};

const NestedExecutionTracePanel = (props: TracePanelProps) => {
    if (props.nodes.length === 0) {
        return null;
    }

    return (
        <div className='flex flex-col gap-[0.35rem] border-t border-border/80 pt-[0.35rem]'>
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

const NodeDebugOutput = ({ debugState, expandedTraceIds, onToggleTraceNode }: NodeDebugOutputProps) => {
    const tracePanel = (
        <NestedExecutionTracePanel
            nodes={debugState.nestedTrace ?? []}
            expandedTraceIds={expandedTraceIds}
            onToggleTraceNode={onToggleTraceNode}
        />
    );

    return (
        <div className='absolute left-1/2 top-[calc(100%+2rem)] w-[300px] max-h-[260px] -translate-x-1/2 overflow-y-auto rounded-md border border-border bg-surface-secondary p-2 nowheel' onClick={(event) => event.stopPropagation()}>
            {debugState.status === DebugNodeStatus.Failed && (
                <div className='flex flex-col gap-1 rounded-lg bg-danger/8 p-2 text-xs text-danger'>
                    <div className='flex flex-row items-center gap-1'>
                        <AlertCircle size={12} />
                        <p className='text-xs font-semibold'>Error</p>
                    </div>
                    <p className='text-xs'>{debugState.error}</p>
                    {debugState.stack && (
                        <pre className='m-0 whitespace-pre-wrap break-all font-mono text-[0.625rem] opacity-80'>{debugState.stack}</pre>
                    )}

                    {tracePanel}
                </div>
            )}

            {debugState.status === DebugNodeStatus.Skipped && (
                <div className='flex flex-col gap-[0.35rem] rounded-lg bg-border-secondary/8 p-2 text-xs text-border-secondary'>
                    <div className='flex flex-row items-center gap-1'>
                        <SkipForward size={12} />
                        <p className='text-xs'>{debugState.reason || 'Skipped'}</p>
                    </div>

                    {tracePanel}
                </div>
            )}

            {debugState.status === DebugNodeStatus.Completed && (
                <div className='flex flex-col gap-2 font-mono text-xs leading-normal'>
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
