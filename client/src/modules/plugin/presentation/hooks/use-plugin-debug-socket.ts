import { useEffect, useCallback } from 'react';
import useSocket from '@/modules/socket/presentation/hooks/use-socket';
import { usePluginDebugStore } from '../stores/use-plugin-debug-store';
import { usePluginBuilderStore } from '../stores/use-plugin-builder-store';
import { sileo } from 'sileo';

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

    const currentPluginId = usePluginBuilderStore((s) => s.currentPluginId);

    useEffect(() => {
        if (!subscribe) {
            return;
        }

        const unsubs: Array<() => void> = [];

        unsubs.push(socket.on('debug:session:created', (data: unknown) => {
            const event = data as DebugSessionCreatedEvent;
            usePluginDebugStore.getState().onSessionCreated(
                event.sessionId,
                event.executionOrder,
                event.forEachNodeId ?? null,
                event.totalIterations ?? 0
            );
        }));

        unsubs.push(socket.on('debug:node:started', (data: unknown) => {
            const event = data as DebugNodeStartedEvent;
            usePluginDebugStore.getState().onNodeStarted(event.nodeId, event.index, event.total);
        }));

        unsubs.push(socket.on('debug:node:completed', (data: unknown) => {
            const event = data as DebugNodeCompletedEvent;
            usePluginDebugStore.getState().onNodeCompleted(event.nodeId, event.output, event.durationMs, event.contextSnapshot);
        }));

        unsubs.push(socket.on('debug:node:skipped', (data: unknown) => {
            const event = data as DebugNodeSkippedEvent;
            usePluginDebugStore.getState().onNodeSkipped(event.nodeId, event.reason);
        }));

        unsubs.push(socket.on('debug:node:error', (data: unknown) => {
            const event = data as DebugNodeErrorEvent;
            usePluginDebugStore.getState().onNodeError(event.nodeId, event.error, event.stack);
            sileo.error({ title: 'Node execution failed', description: event.error });
        }));

        unsubs.push(socket.on('debug:session:completed', (data: unknown) => {
            const event = data as DebugSessionCompletedEvent;
            usePluginDebugStore.getState().onSessionCompleted(event.totalDuration);
        }));

        unsubs.push(socket.on('debug:session:error', (data: unknown) => {
            const event = data as DebugSessionErrorEvent;
            usePluginDebugStore.getState().onSessionError(event.error);
            sileo.error({ title: 'Debug session failed', description: event.error });
        }));

        return () => {
            unsubs.forEach((unsub) => unsub());
            reset();
        };
    }, [reset, socket, subscribe]);

    const startDebug = useCallback(() => {
        if (!currentPluginId || !selectedTrajectoryId || selectedTimestep === null) return;

        const { debugConfig } = usePluginDebugStore.getState();
        setStarting();
        void socket.emit('debug:start', {
            pluginId: currentPluginId,
            trajectoryId: selectedTrajectoryId,
            timestep: selectedTimestep,
            config: debugConfig
        }).catch(() => undefined);
    }, [socket, currentPluginId, selectedTrajectoryId, selectedTimestep, setStarting]);

    const step = useCallback(() => {
        const sid = usePluginDebugStore.getState().sessionId;
        if (!sid) return;
        void socket.emit('debug:step', { sessionId: sid }).catch(() => undefined);
    }, [socket]);

    const continueAll = useCallback(() => {
        const sid = usePluginDebugStore.getState().sessionId;
        if (!sid) return;
        void socket.emit('debug:continue', { sessionId: sid }).catch(() => undefined);
    }, [socket]);

    const stop = useCallback(() => {
        const sid = usePluginDebugStore.getState().sessionId;
        if (!sid) return;
        void socket.emit('debug:stop', { sessionId: sid }).catch(() => undefined);
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
