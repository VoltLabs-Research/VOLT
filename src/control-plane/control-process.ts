import { randomUUID } from 'node:crypto';
import { type Socket } from 'socket.io-client';

import { loadConfig } from '@/core/config';
import { logger } from '@/core/logger';
import {
    TEAM_CLUSTER_DAEMON_REGISTER_EVENT,
    TEAM_CLUSTER_DAEMON_REGISTERED_EVENT,
    TEAM_CLUSTER_DAEMON_MESSAGE_EVENT,
    createPlaneSocket,
    sendToParent,
    registerSignalHandlers
} from '@/control-plane/plane-shared';

const CONTROL_CHANNEL = 'control';
const DEFAULT_COMMAND_TIMEOUT_MS = 180_000;

interface EmitMessage {
    type: 'emit';
    message: unknown;
}

interface SendCommandMessage {
    type: 'send-command';
    ipcRequestId: string;
    command: string;
    payload?: object;
    timeoutMs?: number;
}

interface CommandResponseMessage {
    type: 'command-response';
    ipcRequestId: string;
    response: unknown;
}

interface SocketResponse {
    type: 'response';
    requestId: string;
    ok: boolean;
    status: number;
    message?: string;
    headers?: Record<string, string>;
    data?: { status?: string; data?: unknown } | unknown;
    bodyBase64?: string;
    streamId?: string;
}

interface PendingInboundCommand {
    requestId: string;
}

type ParentMessage = EmitMessage | SendCommandMessage | CommandResponseMessage;

const config = loadConfig();
let socket: Socket | null = null;
let registered = false;
const pendingInboundCommands = new Map<string, PendingInboundCommand>();

const emitSocketResponse = (requestId: string, response: SocketResponse): void => {
    socket?.emit(TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, {
        ...response,
        requestId
    });
};

const sendCommand = (
    command: string,
    payload: object | undefined,
    timeoutMs: number | undefined
): Promise<unknown> => {
    const activeSocket = socket;
    if (!activeSocket || !registered) {
        return Promise.reject(new Error('Control socket is not connected or not registered'));
    }

    const requestId = randomUUID();
    const effectiveTimeout = timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            activeSocket.off(TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, onMessage);
            reject(new Error(`Timed out waiting for response to command "${command}"`));
        }, effectiveTimeout);
        timeout.unref();

        const onMessage = (message: unknown): void => {
            if (!message || typeof message !== 'object' || Array.isArray(message)) return;
            const response = message as SocketResponse;
            if (response.type !== 'response' || response.requestId !== requestId) return;

            clearTimeout(timeout);
            activeSocket.off(TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, onMessage);

            if (!response.ok) {
                reject(new Error(response.message ?? `Command "${command}" was rejected with status ${response.status}`));
                return;
            }

            const data = response.data as { data?: unknown } | undefined;
            resolve(data && 'data' in data ? data.data : response.data);
        };

        activeSocket.on(TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, onMessage);
        activeSocket.emit(TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, {
            type: 'command',
            requestId,
            command,
            responseType: 'json',
            payload
        });
    });
};

const start = (): void => {
    socket = createPlaneSocket(config.voltCloudUrl);

    socket.on('connect', () => {
        socket?.emit(TEAM_CLUSTER_DAEMON_REGISTER_EVENT, {
            teamClusterId: config.teamClusterId,
            daemonPassword: config.daemonPassword,
            channel: CONTROL_CHANNEL
        });
    });

    socket.on(TEAM_CLUSTER_DAEMON_REGISTERED_EVENT, () => {
        registered = true;
        logger.info('Control plane connected to VoltCloud');
        sendToParent({ type: 'connected' });
    });

    socket.on('disconnect', (reason) => {
        registered = false;
        pendingInboundCommands.clear();
        logger.warn(`Control plane disconnected (${reason})`);
        sendToParent({ type: 'disconnected', reason });
    });

    socket.on('connect_error', (error) => {
        registered = false;
        logger.warn(`Control plane connection error: ${error.message}`);
        sendToParent({ type: 'error', message: error.message });
    });

    socket.on(TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, (message: unknown) => {
        if (!message || typeof message !== 'object' || Array.isArray(message)) {
            return;
        }

        const typed = message as { type?: string; requestId?: string; command?: string; payload?: unknown; responseType?: string };
        if (typed.type === 'command') {
            const ipcRequestId = randomUUID();
            pendingInboundCommands.set(ipcRequestId, {
                requestId: String(typed.requestId)
            });
            sendToParent({
                type: 'inbound-command',
                ipcRequestId,
                requestId: typed.requestId,
                command: typed.command,
                responseType: typed.responseType,
                payload: typed.payload
            });
            return;
        }

        sendToParent({
            type: 'inbound-message',
            message
        });
    });
};

const stop = (): void => {
    registered = false;
    pendingInboundCommands.clear();
    socket?.removeAllListeners();
    socket?.close();
    socket = null;
};

process.on('message', (message: ParentMessage) => {
    if (!message) return;

    if (message.type === 'emit') {
        socket?.emit(TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, message.message);
        return;
    }

    if (message.type === 'send-command') {
        sendCommand(message.command, message.payload, message.timeoutMs)
            .then((data) => {
                sendToParent({
                    type: 'send-command-result',
                    ipcRequestId: message.ipcRequestId,
                    ok: true,
                    data
                });
            })
            .catch((error) => {
                sendToParent({
                    type: 'send-command-result',
                    ipcRequestId: message.ipcRequestId,
                    ok: false,
                    message: error instanceof Error ? error.message : String(error)
                });
            });
        return;
    }

    if (message.type === 'command-response') {
        const pending = pendingInboundCommands.get(message.ipcRequestId);
        if (!pending) return;
        pendingInboundCommands.delete(message.ipcRequestId);
        emitSocketResponse(pending.requestId, message.response as SocketResponse);
    }
});

registerSignalHandlers(stop);

start();
