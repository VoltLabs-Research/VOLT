import { useEffect, useCallback } from 'react';
import useSocket from '@/modules/socket/hooks/use-socket';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import { usePluginDebugStore } from '../stores/use-plugin-debug-store';
import { PLUGIN_DEBUG_SOCKET_EVENTS } from '../api/entities/plugin-constants';
import { sileo } from 'sileo';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';

interface DebugSessionCreatedEvent {
    sessionId: string;
    executionOrder: Array<{ nodeId: string; type: string }>;
    forEachNodeId: string | null;
    totalIterations: number;
};

interface DebugNodeStartedEvent {
    sessionId: string;
    nodeId: string;
    nodeType: string;
    index: number;
    total: number;
};

interface DebugNodeCompletedEvent {
    sessionId: string;
    nodeId: string;
    nodeType: string;
    output: Record<string, unknown>;
    durationMs: number;
    index: number;
    contextSnapshot: Record<string, Record<string, unknown>>;
};

interface DebugNodeSkippedEvent {
    sessionId: string;
    nodeId: string;
    nodeType: string;
    reason: string;
};

interface DebugNodeErrorEvent {
    sessionId: string;
    nodeId: string;
    nodeType: string;
    error: string;
    stack?: string;
};

interface DebugSessionCompletedEvent {
    sessionId: string;
    exposureResults: unknown[];
    totalDuration: number;
};

interface DebugSessionErrorEvent {
    sessionId?: string;
    error: string;
};

interface UsePluginDebugSocketOptions {
    subscribe?: boolean;
}

const usePluginDebugSocket = ({ subscribe = true }: UsePluginDebugSocketOptions = {}) => {
    const socket = useSocket();
    const {
        sessionId,
        isDebugging,
        selectedTrajectoryId,
        selectedTimestep,
        setStarting,
        reset
    } = usePluginDebugStore();

    const { searchParams } = useSearchParamsState();
    const currentPluginId = searchParams.get('id');

    useSocketEvent<DebugSessionCreatedEvent>(PLUGIN_DEBUG_SOCKET_EVENTS.SESSION_CREATED, (event) => {
        usePluginDebugStore.getState().onSessionCreated(
            event.sessionId,
            event.executionOrder,
            event.forEachNodeId ?? null,
            event.totalIterations ?? 0
        );
    }, { enabled: subscribe });

    useSocketEvent<DebugNodeStartedEvent>(PLUGIN_DEBUG_SOCKET_EVENTS.NODE_STARTED, (event) => {
        usePluginDebugStore.getState().onNodeStarted(event.nodeId, event.index, event.total);
    }, { enabled: subscribe });

    useSocketEvent<DebugNodeCompletedEvent>(PLUGIN_DEBUG_SOCKET_EVENTS.NODE_COMPLETED, (event) => {
        usePluginDebugStore.getState().onNodeCompleted(event.nodeId, event.output, event.durationMs, event.contextSnapshot);
    }, { enabled: subscribe });

    useSocketEvent<DebugNodeSkippedEvent>(PLUGIN_DEBUG_SOCKET_EVENTS.NODE_SKIPPED, (event) => {
        usePluginDebugStore.getState().onNodeSkipped(event.nodeId, event.reason);
    }, { enabled: subscribe });

    useSocketEvent<DebugNodeErrorEvent>(PLUGIN_DEBUG_SOCKET_EVENTS.NODE_ERROR, (event) => {
        usePluginDebugStore.getState().onNodeError(event.nodeId, event.error, event.stack);
        sileo.error({ title: 'Node execution failed', description: event.error });
    }, { enabled: subscribe });

    useSocketEvent<DebugSessionCompletedEvent>(PLUGIN_DEBUG_SOCKET_EVENTS.SESSION_COMPLETED, (event) => {
        usePluginDebugStore.getState().onSessionCompleted(event.totalDuration);
    }, { enabled: subscribe });

    useSocketEvent<DebugSessionErrorEvent>(PLUGIN_DEBUG_SOCKET_EVENTS.SESSION_ERROR, (event) => {
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
        setStarting();
        void socket.emit(PLUGIN_DEBUG_SOCKET_EVENTS.START, {
            pluginId: currentPluginId,
            trajectoryId: selectedTrajectoryId,
            timestep: selectedTimestep,
            config: debugConfig
        }).catch(() => undefined);
    }, [socket, currentPluginId, selectedTrajectoryId, selectedTimestep, setStarting]);

    const step = useCallback(() => {
        const sid = usePluginDebugStore.getState().sessionId;
        if (!sid) return;
        void socket.emit(PLUGIN_DEBUG_SOCKET_EVENTS.STEP, { sessionId: sid }).catch(() => undefined);
    }, [socket]);

    const continueAll = useCallback(() => {
        const sid = usePluginDebugStore.getState().sessionId;
        if (!sid) return;
        void socket.emit(PLUGIN_DEBUG_SOCKET_EVENTS.CONTINUE, { sessionId: sid }).catch(() => undefined);
    }, [socket]);

    const stop = useCallback(() => {
        const sid = usePluginDebugStore.getState().sessionId;
        if (!sid) return;
        void socket.emit(PLUGIN_DEBUG_SOCKET_EVENTS.STOP, { sessionId: sid }).catch(() => undefined);
        reset();
    }, [socket, reset]);

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
