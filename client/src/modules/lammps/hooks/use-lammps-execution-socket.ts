import useSocket from '@/modules/socket/core/hooks/use-socket';
import { useCallback, useEffect, useRef } from 'react';
import type {
    LammpsDumpUpdatedEvent,
    LammpsExecutionLogEvent,
    LammpsExecutionUpdatedEvent
} from '@/modules/lammps/api/types';

interface UseLammpsExecutionSocketProps {
    teamId?: string;
    executionId?: string | null;
    enabled?: boolean;
    onExecutionUpdated?: (payload: LammpsExecutionUpdatedEvent) => void;
    onExecutionLog?: (payload: LammpsExecutionLogEvent) => void;
    onDumpUpdated?: (payload: LammpsDumpUpdatedEvent) => void;
}

const isExecutionUpdatedEvent = (value: unknown, executionId?: string | null): value is LammpsExecutionUpdatedEvent => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const payload = value as Partial<LammpsExecutionUpdatedEvent>;
    return typeof payload.executionId === 'string'
        && typeof payload.scriptId === 'string'
        && typeof payload.status === 'string'
        && typeof payload.dumpCount === 'number'
        && (!executionId || payload.executionId === executionId);
};

const isExecutionLogEvent = (value: unknown, executionId?: string | null): value is LammpsExecutionLogEvent => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const payload = value as Partial<LammpsExecutionLogEvent>;
    return typeof payload.executionId === 'string'
        && typeof payload.line === 'string'
        && typeof payload.stream === 'string'
        && (!executionId || payload.executionId === executionId);
};

const isDumpUpdatedEvent = (value: unknown, executionId?: string | null): value is LammpsDumpUpdatedEvent => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const payload = value as Partial<LammpsDumpUpdatedEvent>;
    return typeof payload.executionId === 'string'
        && typeof payload.dumpId === 'string'
        && typeof payload.fileName === 'string'
        && typeof payload.timestep === 'number'
        && (!executionId || payload.executionId === executionId);
};

const useLammpsExecutionSocket = ({
    teamId,
    executionId,
    enabled = true,
    onExecutionUpdated,
    onExecutionLog,
    onDumpUpdated
}: UseLammpsExecutionSocketProps) => {
    const socketService = useSocket();
    const isConnectedRef = useRef(socketService.isConnected());
    const subscribedRef = useRef(false);
    const onExecutionUpdatedRef = useRef(onExecutionUpdated);
    const onExecutionLogRef = useRef(onExecutionLog);
    const onDumpUpdatedRef = useRef(onDumpUpdated);

    useEffect(() => {
        onExecutionUpdatedRef.current = onExecutionUpdated;
        onExecutionLogRef.current = onExecutionLog;
        onDumpUpdatedRef.current = onDumpUpdated;
    }, [onDumpUpdated, onExecutionLog, onExecutionUpdated]);

    const subscribe = useCallback(() => {
        if (!enabled || !teamId || !executionId || !isConnectedRef.current || subscribedRef.current) {
            return;
        }

        subscribedRef.current = true;
        socketService.emit('lammps_open_execution', {
            teamId,
            executionId
        }).catch(console.warn);
    }, [enabled, executionId, socketService, teamId]);

    useEffect(() => {
        const unsubscribe = socketService.onConnectionChange((connected) => {
            isConnectedRef.current = connected;

            if (connected && !subscribedRef.current) {
                subscribe();
            }
        });

        return unsubscribe;
    }, [socketService, subscribe]);

    useEffect(() => {
        if (!enabled || !teamId || !executionId) {
            subscribedRef.current = false;
            return;
        }

        if (isConnectedRef.current) {
            subscribe();
        }

        const unsubscribeExecutionUpdated = socketService.on('lammps_execution_updated', (payload) => {
            if (isExecutionUpdatedEvent(payload, executionId)) {
                onExecutionUpdatedRef.current?.(payload);
            }
        });
        const unsubscribeExecutionLog = socketService.on('lammps_execution_log', (payload) => {
            if (isExecutionLogEvent(payload, executionId)) {
                onExecutionLogRef.current?.(payload);
            }
        });
        const unsubscribeDumpUpdated = socketService.on('lammps_dump_updated', (payload) => {
            if (isDumpUpdatedEvent(payload, executionId)) {
                onDumpUpdatedRef.current?.(payload);
            }
        });

        return () => {
            subscribedRef.current = false;
            unsubscribeExecutionUpdated();
            unsubscribeExecutionLog();
            unsubscribeDumpUpdated();

            if (isConnectedRef.current) {
                socketService.emit('lammps_close_execution', {
                    executionId
                }).catch(console.warn);
            }
        };
    }, [
        enabled,
        executionId,
        socketService,
        subscribe,
        teamId
    ]);
};

export default useLammpsExecutionSocket;
