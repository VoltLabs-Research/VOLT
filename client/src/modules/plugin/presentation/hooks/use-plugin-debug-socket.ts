import { useEffect, useCallback, useRef } from 'react';
import useSocket from '@/modules/socket/presentation/hooks/use-socket';
import { usePluginDebugStore } from '../stores/use-plugin-debug-store';
import { usePluginBuilderStore } from '../stores/use-plugin-builder-store';

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
    output: Record<string, any>;
    durationMs: number;
    index: number;
    contextSnapshot: Record<string, Record<string, any>>;
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
    exposureResults: any[];
    totalDuration: number;
};

interface DebugSessionErrorEvent {
    sessionId?: string;
    error: string;
};

const usePluginDebugSocket = () => {
    const socket = useSocket();
    const unsubscribesRef = useRef<Array<() => void>>([]);
    const {
        sessionId,
        isDebugging,
        selectedTrajectoryId,
        selectedTimestep,
        setStarting,
        reset
    } = usePluginDebugStore();

    const currentPluginId = usePluginBuilderStore((s) => s.currentPluginId);

    // Subscribe to socket events
    useEffect(() => {
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
        }));

        unsubs.push(socket.on('debug:session:completed', (data: unknown) => {
            const event = data as DebugSessionCompletedEvent;
            usePluginDebugStore.getState().onSessionCompleted(event.totalDuration);
        }));

        unsubs.push(socket.on('debug:session:error', (data: unknown) => {
            const event = data as DebugSessionErrorEvent;
            usePluginDebugStore.getState().onSessionError(event.error);
        }));

        unsubscribesRef.current = unsubs;

        return () => {
            unsubs.forEach((unsub) => unsub());
        };
    }, [socket]);

    // Actions
    const startDebug = useCallback(() => {
        if (!currentPluginId || !selectedTrajectoryId || selectedTimestep === null) return;
        
        const { debugConfig } = usePluginDebugStore.getState();
        setStarting();
        socket.emit('debug:start', {
            pluginId: currentPluginId,
            trajectoryId: selectedTrajectoryId,
            timestep: selectedTimestep,
            config: debugConfig
        });
    }, [socket, currentPluginId, selectedTrajectoryId, selectedTimestep, setStarting]);

    const step = useCallback(() => {
        const sid = usePluginDebugStore.getState().sessionId;
        if (!sid) return;
        socket.emit('debug:step', { sessionId: sid });
    }, [socket]);

    const continueAll = useCallback(() => {
        const sid = usePluginDebugStore.getState().sessionId;
        if (!sid) return;
        socket.emit('debug:continue', { sessionId: sid });
    }, [socket]);

    const stop = useCallback(() => {
        const sid = usePluginDebugStore.getState().sessionId;
        if (!sid) return;
        socket.emit('debug:stop', { sessionId: sid });
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
