import { useEffect, useCallback } from 'react';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import { emitOrReport } from '@/modules/socket/services/socket-emit-helpers';
import useDebugTrajectorySelector from '@/modules/plugin/hooks/plugin/use-debug-trajectory-selector';
import { usePluginDebugStore } from '@/modules/plugin/store/plugin/use-plugin-debug-store';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import { sanitizeVisibleArgumentConfig } from '@/modules/plugin/utils/plugin/argument-visibility';
import { SOCKET_PLUGIN_DEBUG_EVENTS } from '@/modules/socket/events/plugin';
import { sileo } from 'sileo';
import { useSearchParams } from 'react-router-dom';
import type {
    DebugExecutionLogSegment,
    DebugTraceNode
} from '@/modules/plugin/store/plugin/use-plugin-debug-store';

interface DebugSessionEvent {
    sessionId: string;
}

interface DebugSessionCreatedEvent extends DebugSessionEvent {
    executionOrder: Array<{ nodeId: string; type: string }>;
    forEachNodeId: string | null;
    totalIterations: number;
}

interface DebugNodeStartedEvent extends DebugSessionEvent {
    nodeId: string;
    index: number;
    total: number;
}

interface DebugNodeCompletedEvent extends DebugSessionEvent {
    nodeId: string;
    output: Record<string, unknown>;
    nestedTrace?: DebugTraceNode[];
    durationMs: number;
    contextSnapshot: Record<string, Record<string, unknown>>;
}

interface DebugNodeSkippedEvent extends DebugSessionEvent {
    nodeId: string;
    reason: string;
    nestedTrace?: DebugTraceNode[];
}

interface DebugNodeErrorEvent extends DebugSessionEvent {
    nodeId: string;
    error: string;
    stack?: string;
    nestedTrace?: DebugTraceNode[];
}

interface DebugSessionCompletedEvent extends DebugSessionEvent {
    totalDuration: number;
}

interface DebugNodeLogChunkEvent extends DebugSessionEvent {
    nodeId: string;
    segments: DebugExecutionLogSegment[];
}

interface DebugSessionErrorEvent {
    sessionId?: string;
    error: string;
}

interface UsePluginDebugSocketOptions {
    subscribe?: boolean;
}

const useActiveSessionEvent = <TEvent extends DebugSessionEvent>(
    event: string,
    handler: (event: TEvent) => void,
    enabled: boolean
): void => {
    useSocketEvent<TEvent>(event, (payload) => {
        if (usePluginDebugStore.getState().sessionId !== payload.sessionId) {
            return;
        }

        handler(payload);
    }, { enabled });
};

const emitSessionCommand = (event: string): void => {
    const { sessionId } = usePluginDebugStore.getState();
    if (!sessionId) {
        return;
    }

    void emitOrReport(event, { sessionId });
};

const step = () => emitSessionCommand(SOCKET_PLUGIN_DEBUG_EVENTS.STEP);

const continueAll = () => emitSessionCommand(SOCKET_PLUGIN_DEBUG_EVENTS.CONTINUE);

const stop = () => {
    emitSessionCommand(SOCKET_PLUGIN_DEBUG_EVENTS.STOP);
    usePluginDebugStore.getState().reset();
};

const usePluginDebugSocket = ({ subscribe = true }: UsePluginDebugSocketOptions = {}) => {
    const sessionId = usePluginDebugStore((state) => state.sessionId);
    const isDebugging = usePluginDebugStore((state) => state.isDebugging);
    const { selectedTrajectoryId, selectedTimestep } = useDebugTrajectorySelector();

    const [searchParams] = useSearchParams();
    const currentPluginId = searchParams.get('id');
    const sessionEventsEnabled = subscribe && !!sessionId;

    useSocketEvent<DebugSessionCreatedEvent>(SOCKET_PLUGIN_DEBUG_EVENTS.SESSION_CREATED, (event) => {
        usePluginDebugStore.getState().onSessionCreated(
            event.sessionId,
            event.executionOrder,
            event.forEachNodeId,
            event.totalIterations
        );
    }, { enabled: subscribe });

    useActiveSessionEvent<DebugNodeStartedEvent>(SOCKET_PLUGIN_DEBUG_EVENTS.NODE_STARTED, (event) => {
        usePluginDebugStore.getState().onNodeStarted(event.nodeId, event.index, event.total);
    }, sessionEventsEnabled);

    useActiveSessionEvent<DebugNodeCompletedEvent>(SOCKET_PLUGIN_DEBUG_EVENTS.NODE_COMPLETED, (event) => {
        usePluginDebugStore.getState().onNodeCompleted(
            event.nodeId,
            event.output,
            event.durationMs,
            event.contextSnapshot,
            event.nestedTrace
        );
    }, sessionEventsEnabled);

    useActiveSessionEvent<DebugNodeSkippedEvent>(SOCKET_PLUGIN_DEBUG_EVENTS.NODE_SKIPPED, (event) => {
        usePluginDebugStore.getState().onNodeSkipped(event.nodeId, event.reason, event.nestedTrace);
    }, sessionEventsEnabled);

    useActiveSessionEvent<DebugNodeErrorEvent>(SOCKET_PLUGIN_DEBUG_EVENTS.NODE_ERROR, (event) => {
        usePluginDebugStore.getState().onNodeError(event.nodeId, event.error, event.stack, event.nestedTrace);
        sileo.error({
            title: 'Node execution failed',
            description: event.error
        });
    }, sessionEventsEnabled);

    useActiveSessionEvent<DebugNodeLogChunkEvent>(SOCKET_PLUGIN_DEBUG_EVENTS.NODE_LOG_CHUNK, (event) => {
        usePluginDebugStore.getState().onNodeLogChunk(event.nodeId, event.segments);
    }, sessionEventsEnabled);

    useActiveSessionEvent<DebugSessionCompletedEvent>(SOCKET_PLUGIN_DEBUG_EVENTS.SESSION_COMPLETED, (event) => {
        usePluginDebugStore.getState().onSessionCompleted(event.totalDuration);
    }, sessionEventsEnabled);

    useSocketEvent<DebugSessionErrorEvent>(SOCKET_PLUGIN_DEBUG_EVENTS.SESSION_ERROR, (event) => {
        if (event.sessionId && usePluginDebugStore.getState().sessionId !== event.sessionId) {
            return;
        }

        usePluginDebugStore.getState().onSessionError(event.error);
        sileo.error({
            title: 'Debug session failed',
            description: event.error
        });
    }, { enabled: subscribe });

    useEffect(() => {
        if (!subscribe) {
            return;
        }

        return () => {
            usePluginDebugStore.getState().reset();
        };
    }, [subscribe]);

    const startDebug = useCallback(() => {
        if (!currentPluginId || !selectedTrajectoryId || selectedTimestep === null) {
            return;
        }

        const { debugConfig, setStarting } = usePluginDebugStore.getState();
        const workflow = usePluginBuilderStore.getState().getWorkflow();
        const argumentsNode = workflow.nodes.find((node) => node.type === 'arguments');
        const argumentDefinitions = argumentsNode?.data.arguments?.arguments ?? [];
        setStarting();
        void emitOrReport(SOCKET_PLUGIN_DEBUG_EVENTS.START, {
            pluginId: currentPluginId,
            trajectoryId: selectedTrajectoryId,
            timestep: selectedTimestep,
            config: sanitizeVisibleArgumentConfig(argumentDefinitions, debugConfig),
            workflow
        });
    }, [currentPluginId, selectedTrajectoryId, selectedTimestep]);

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
