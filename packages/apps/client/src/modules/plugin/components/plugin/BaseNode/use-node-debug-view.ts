import { DebugNodeStatus, usePluginDebugStore } from '@/modules/plugin/store/plugin/use-plugin-debug-store';
import { NodeType } from '@volt/contracts/modules/plugin/enums';
import { useState } from 'react';

export const formatTraceDuration = (ms: number): string => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);

export type NodeOverheadBadgeTone = 'success' | 'danger' | 'neutral';

interface NodeOverheadBadge {
    label: string;
    tone: NodeOverheadBadgeTone;
}

const INSPECTABLE_STATUSES: DebugNodeStatus[] = [
    DebugNodeStatus.Completed,
    DebugNodeStatus.Failed,
    DebugNodeStatus.Skipped
];

const OUTCOME_BADGES: Partial<Record<DebugNodeStatus, NodeOverheadBadge>> = {
    [DebugNodeStatus.Failed]: {
        label: 'Error',
        tone: 'danger'
    },
    [DebugNodeStatus.Skipped]: {
        label: 'Skipped',
        tone: 'neutral'
    }
};

const resolveOverheadBadge = (
    status: DebugNodeStatus | undefined,
    durationMs: number | undefined
): NodeOverheadBadge | null => {
    if (status === DebugNodeStatus.Completed) {
        return durationMs === undefined ? null : {
            label: formatTraceDuration(durationMs),
            tone: 'success'
        };
    }

    return (status && OUTCOME_BADGES[status]) ?? null;
};

const useNodeDebugView = (nodeId: string, nodeType: NodeType) => {
    // Rings and halos instead of borders, so a state never changes the card's size.
    const statusClass: Record<DebugNodeStatus, string> = {
        [DebugNodeStatus.Pending]: 'opacity-50',
        [DebugNodeStatus.Running]: 'ring-[1.5px] ring-foreground shadow-[0_0_0_6px_color-mix(in_oklab,var(--foreground)_12%,transparent)] animate-[plugin-node-pulse_1.5s_ease-in-out_infinite]',
        [DebugNodeStatus.Completed]: 'ring-[1.5px] ring-success',
        [DebugNodeStatus.Failed]: 'ring-[1.5px] ring-danger shadow-[0_0_0_5px_color-mix(in_oklab,var(--danger)_22%,transparent)]',
        [DebugNodeStatus.Skipped]: 'opacity-40 ring-0 outline-1 outline-dashed outline-border-secondary'
    };

    const storedState = usePluginDebugStore((s) => s.nodeStates[nodeId]);
    const isDebugging = usePluginDebugStore((s) => s.isDebugging || s.totalDuration !== null);
    const inspectedNodeId = usePluginDebugStore((s) => s.inspectedNodeId);
    const setInspectedNode = usePluginDebugStore((s) => s.setInspectedNode);

    const [showLog, setShowLog] = useState(false);
    const [expandedTraceIds, setExpandedTraceIds] = useState<Set<string>>(new Set());

    const debugState = isDebugging ? storedState : undefined;
    const status = debugState?.status;
    const logSegments = debugState?.logSegments ?? [];

    const hasInspectableOutput = status !== undefined && INSPECTABLE_STATUSES.includes(status);
    const supportsExecutionLog = nodeType === NodeType.ENTRYPOINT || nodeType === NodeType.PLUGIN;
    const hasLog = Boolean(
        supportsExecutionLog
        && (status === DebugNodeStatus.Running || hasInspectableOutput)
        && (
            logSegments.length > 0
            || (nodeType === NodeType.ENTRYPOINT && debugState?.output)
            || status === DebugNodeStatus.Running
        )
    );

    const toggleInspectedOutput = () => {
        setShowLog(false);
        setInspectedNode(inspectedNodeId === nodeId ? null : nodeId);
    };

    const toggleExecutionLog = () => {
        if (showLog) {
            setShowLog(false);
            return;
        }

        setInspectedNode(null);
        setShowLog(true);
    };

    const toggleTraceNode = (traceId: string) => {
        setExpandedTraceIds((prev) => {
            const next = new Set(prev);
            if (next.has(traceId)) {
                next.delete(traceId);
            } else {
                next.add(traceId);
            }
            return next;
        });
    };

    return {
        debugState,
        logSegments,
        overheadBadge: resolveOverheadBadge(status, debugState?.durationMs),

        debugClass: status ? statusClass[status] : '',
        isInspectingOutput: inspectedNodeId === nodeId && hasInspectableOutput,
        hasInspectableOutput,
        hasLog,
        isShowingLog: showLog && hasLog,
        expandedTraceIds,
        toggleInspectedOutput,
        toggleExecutionLog,
        toggleTraceNode
    };
};

export default useNodeDebugView;
