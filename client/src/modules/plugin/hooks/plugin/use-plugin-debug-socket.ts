import { useEffect, useCallback } from 'react';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import { emitOrReport } from '@/modules/socket/services/socket-emit-helpers';
import useDebugTrajectorySelector from '@/modules/plugin/hooks/plugin/use-debug-trajectory-selector';
import { usePluginDebugStore } from '@/modules/plugin/stores/plugin/use-plugin-debug-store';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { sanitizeVisibleArgumentConfig } from '@/modules/plugin/utilities/plugin/argument-visibility';
import { SOCKET_PLUGIN_DEBUG_EVENTS } from '@/modules/socket/events/plugin';
import { sileo } from 'sileo';
import { useSearchParams } from 'react-router-dom';
import type { IWorkflow } from '@/modules/plugin/api/entities/plugin/workflow';
import type {
    DebugExecutionLogSegment,
    DebugTraceNode
} from '@/modules/plugin/stores/plugin/use-plugin-debug-store';

interface DebugSessionCreatedEvent {
    sessionId: string;
    executionOrder: Array<{ nodeId: string; type: string }>;
    forEachNodeId: string | null;
    totalIterations: number;
}

interface DebugNodeStartedEvent {
    sessionId: string;
    nodeId: string;
    nodeType: string;
    index: number;
    total: number;
}

interface DebugNodeCompletedEvent {
    sessionId: string;
    nodeId: string;
    nodeType: string;
    output: Record<string, unknown>;
    nestedTrace?: DebugTraceNode[];
    durationMs: number;
    index: number;
    contextSnapshot: Record<string, Record<string, unknown>>;
}

interface DebugNodeSkippedEvent {
    sessionId: string;
    nodeId: string;
    nodeType: string;
    reason: string;
    nestedTrace?: DebugTraceNode[];
}

interface DebugNodeErrorEvent {
    sessionId: string;
    nodeId: string;
    nodeType: string;
    error: string;
    stack?: string;
    nestedTrace?: DebugTraceNode[];
}

interface DebugSessionCompletedEvent {
    sessionId: string;
    exposureResults: unknown[];
    totalDuration: number;
}

interface DebugNodeLogChunkEvent {
    sessionId: string;
    nodeId: string;
    segments: DebugExecutionLogSegment[];
}

interface DebugSessionErrorEvent {
    sessionId?: string;
    error: string;
}

interface DebugStartPayload {
    pluginId: string;
    trajectoryId: string;
    timestep: number;
    config: Record<string, unknown>;
    workflow: IWorkflow;
}

interface UsePluginDebugSocketOptions {
    subscribe?: boolean;
}

const usePluginDebugSocket = ({ subscribe = true }: UsePluginDebugSocketOptions = {}) => {
    const {
        sessionId,
        isDebugging,
        setStarting,
        reset
    } = usePluginDebugStore();
    const { selectedTrajectoryId, selectedTimestep } = useDebugTrajectorySelector();

    const [searchParams] = useSearchParams();
    const currentPluginId = searchParams.get('id');

    const isCurrentSessionEvent = useCallback((eventSessionId?: string): boolean => {
        if (!eventSessionId) {
            return false;
        }

        const activeSessionId = usePluginDebugStore.getState().sessionId;
        return activeSessionId === eventSessionId;
    }, []);

    useSocketEvent<DebugSessionCreatedEvent>(SOCKET_PLUGIN_DEBUG_EVENTS.SESSION_CREATED, (event) => {
        usePluginDebugStore.getState().onSessionCreated(
            event.sessionId,
            event.executionOrder,
            event.forEachNodeId ?? null,
            event.totalIterations ?? 0
        );
    }, { enabled: subscribe });

    useSocketEvent<DebugNodeStartedEvent>(SOCKET_PLUGIN_DEBUG_EVENTS.NODE_STARTED, (event) => {
        if (!isCurrentSessionEvent(event.sessionId)) {
            return;
        }

        usePluginDebugStore.getState().onNodeStarted(event.nodeId, event.index, event.total);
    }, { enabled: subscribe && !!sessionId });

    useSocketEvent<DebugNodeCompletedEvent>(SOCKET_PLUGIN_DEBUG_EVENTS.NODE_COMPLETED, (event) => {
        if (!isCurrentSessionEvent(event.sessionId)) {
            return;
        }

        usePluginDebugStore.getState().onNodeCompleted(
            event.nodeId,
            event.output,
            event.durationMs,
            event.contextSnapshot,
            event.nestedTrace
        );
    }, { enabled: subscribe && !!sessionId });

    useSocketEvent<DebugNodeSkippedEvent>(SOCKET_PLUGIN_DEBUG_EVENTS.NODE_SKIPPED, (event) => {
        if (!isCurrentSessionEvent(event.sessionId)) {
            return;
        }

        usePluginDebugStore.getState().onNodeSkipped(event.nodeId, event.reason, event.nestedTrace);
    }, { enabled: subscribe && !!sessionId });

    useSocketEvent<DebugNodeErrorEvent>(SOCKET_PLUGIN_DEBUG_EVENTS.NODE_ERROR, (event) => {
        if (!isCurrentSessionEvent(event.sessionId)) {
            return;
        }

        usePluginDebugStore.getState().onNodeError(event.nodeId, event.error, event.stack, event.nestedTrace);
        sileo.error({ title: 'Node execution failed', description: event.error });
    }, { enabled: subscribe && !!sessionId });

    useSocketEvent<DebugNodeLogChunkEvent>(SOCKET_PLUGIN_DEBUG_EVENTS.NODE_LOG_CHUNK, (event) => {
        if (!isCurrentSessionEvent(event.sessionId)) {
            return;
        }

        usePluginDebugStore.getState().onNodeLogChunk(event.nodeId, event.segments);
    }, { enabled: subscribe && !!sessionId });

    useSocketEvent<DebugSessionCompletedEvent>(SOCKET_PLUGIN_DEBUG_EVENTS.SESSION_COMPLETED, (event) => {
        if (!isCurrentSessionEvent(event.sessionId)) {
            return;
        }

        usePluginDebugStore.getState().onSessionCompleted(event.totalDuration);
    }, { enabled: subscribe && !!sessionId });

    useSocketEvent<DebugSessionErrorEvent>(SOCKET_PLUGIN_DEBUG_EVENTS.SESSION_ERROR, (event) => {
        if (event.sessionId && !isCurrentSessionEvent(event.sessionId)) {
            return;
        }

        usePluginDebugStore.getState().onSessionError(event.error);
        sileo.error({ title: 'Debug session failed', description: event.error });
    }, { enabled: subscribe });

    useEffect(() => {
        if (!subscribe) {
            return;
        }

        return () => {
            reset();
        };
    }, [reset, subscribe]);

    const startDebug = useCallback(() => {
        if (!currentPluginId || !selectedTrajectoryId || selectedTimestep === null) {
            return;
        }

        const { debugConfig } = usePluginDebugStore.getState();
        const workflow = usePluginBuilderStore.getState().getWorkflow();
        const argumentsNode = workflow.nodes.find((node) => node.type === 'arguments');
        const argumentDefinitions = Array.isArray(argumentsNode?.data.arguments?.arguments)
            ? argumentsNode.data.arguments.arguments
            : [];
        const sanitizedConfig = sanitizeVisibleArgumentConfig(argumentDefinitions, debugConfig);
        setStarting();
        void emitOrReport(SOCKET_PLUGIN_DEBUG_EVENTS.START, {
            pluginId: currentPluginId,
            trajectoryId: selectedTrajectoryId,
            timestep: selectedTimestep,
            config: sanitizedConfig,
            workflow
        } satisfies DebugStartPayload);
    }, [currentPluginId, selectedTrajectoryId, selectedTimestep, setStarting]);

    const step = useCallback(() => {
        const sid = usePluginDebugStore.getState().sessionId;
        if (!sid) return;
        void emitOrReport(SOCKET_PLUGIN_DEBUG_EVENTS.STEP, { sessionId: sid });
    }, []);

    const continueAll = useCallback(() => {
        const sid = usePluginDebugStore.getState().sessionId;
        if (!sid) return;
        void emitOrReport(SOCKET_PLUGIN_DEBUG_EVENTS.CONTINUE, { sessionId: sid });
    }, []);

    const stop = useCallback(() => {
        const sid = usePluginDebugStore.getState().sessionId;
        if (!sid) return;
        void emitOrReport(SOCKET_PLUGIN_DEBUG_EVENTS.STOP, { sessionId: sid });
        reset();
    }, [reset]);

    return {
        startDebug,
        step,
        continueAll,
        stop,
        isDebugging,
        sessionId
    };
};

export default usePluginDebugSocket;
