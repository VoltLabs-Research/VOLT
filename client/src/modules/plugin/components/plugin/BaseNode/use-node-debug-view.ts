import { DebugNodeStatus, usePluginDebugStore } from '@/modules/plugin/store/plugin/use-plugin-debug-store';
import { NODE_DEBUG_STATUS_CLASS } from '@/modules/plugin/components/plugin/BaseNode/node-styles';
import { NodeType } from '@volt/contracts/modules/plugin/enums';
import { useState } from 'react';

export const formatTraceDuration = (ms: number): string => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);

/** bravais `Tag` tones; `BaseNode` maps them onto HeroUI `Chip` colours. */
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

/**
 * Everything a node needs to render its debug affordances: which panel is open,
 * which nested traces are expanded, and the badge overlaid on the node.
 *
 * `debugState` is only surfaced while a debug run is active (or its results are
 * still on screen), so callers never have to re-check `isDebugging`.
 */
const useNodeDebugView = (nodeId: string, nodeType: NodeType) => {
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
        /*
         * This used to hand back the class name `workflow-node--debug-${status}`.
         * The stylesheet is gone, so it hands back that status's utilities instead —
         * from a lookup, so every value stays a complete literal Tailwind can scan.
         */
        debugClass: status ? NODE_DEBUG_STATUS_CLASS[status] : '',
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
