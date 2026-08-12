import { errorMessage } from '@shared/application/utilities/error-message';
import { randomUUID } from 'node:crypto';
import { type Socket } from 'socket.io-client';

import { loadConfig } from '@core/config/daemon';
import {
    TEAM_CLUSTER_DAEMON_MESSAGE_EVENT,
    connectPlaneSocket,
    registerSignalHandlers,
    sendToParent
} from '@shared/infrastructure/planes/plane-shared';
import type {
    TeamClusterDaemonCommandMessage,
    TeamClusterDaemonSocketResponsePayload
} from '@voltstack/daemon-cluster-client';
import type { ReverseChannelInboundMessage } from '@shared/contracts/channel/binary-messages';

const CONTROL_CHANNEL = 'control';
const DEFAULT_COMMAND_TIMEOUT_MS = 180_000;

type SocketResponse = TeamClusterDaemonSocketResponsePayload<{ status?: string; data?: unknown }>;

type InboundControlMessage =
    | TeamClusterDaemonCommandMessage
    | SocketResponse
    | Exclude<ReverseChannelInboundMessage, { type: 'response' }>;

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
    response: SocketResponse;
}

interface PendingCommand {
    command: string;
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
}

type ParentMessage = EmitMessage | SendCommandMessage | CommandResponseMessage;

const config = loadConfig();
let socket: Socket | null = null;
let isRegistered = (): boolean => false;
const pendingInboundCommands = new Map<string, string>();
const pendingCommands = new Map<string, PendingCommand>();

const sendCommand = (
    command: string,
    payload: object | undefined,
    timeoutMs: number | undefined
): Promise<unknown> => {
    const activeSocket = socket;
    if (!activeSocket || !isRegistered()) {
        return Promise.reject(new Error('Control socket is not connected or not registered'));
    }

    const requestId = randomUUID();

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            pendingCommands.delete(requestId);
            reject(new Error(`Timed out waiting for response to command "${command}"`));
        }, timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS);
        timeout.unref();

        pendingCommands.set(requestId, {
            command,
            resolve,
            reject,
            timeout
        });

        activeSocket.emit(TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, {
            type: 'command',
            requestId,
            command,
            responseType: 'json',
            payload
        });
    });
};

const resolvePendingCommand = (response: SocketResponse): void => {
    const pending = pendingCommands.get(response.requestId);
    if (!pending) return;

    clearTimeout(pending.timeout);
    pendingCommands.delete(response.requestId);

    if (!response.ok) {
        pending.reject(new Error(response.message ?? `Command "${pending.command}" was rejected with status ${response.status}`));
        return;
    }

    const data = response.data;
    pending.resolve(data && 'data' in data ? data.data : data);
};

const start = (): void => {
    const connection = connectPlaneSocket(
        config,
        {
            channel: CONTROL_CHANNEL,
            label: 'Control plane',
            notifyParent: true
        },
        { onDisconnected: () => pendingInboundCommands.clear() }
    );

    socket = connection.socket;
    isRegistered = connection.isRegistered;

    connection.socket.on(TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, (message: InboundControlMessage) => {
        if (message.type === 'command') {
            const ipcRequestId = randomUUID();
            pendingInboundCommands.set(ipcRequestId, message.requestId);
            sendToParent({
                type: 'inbound-command',
                ipcRequestId,
                requestId: message.requestId,
                command: message.command,
                responseType: message.responseType,
                payload: message.payload
            });
            return;
        }

        if (message.type === 'response') {
            resolvePendingCommand(message);
            return;
        }

        sendToParent({
            type: 'inbound-message',
            message
        });
    });
};

const stop = (): void => {
    isRegistered = () => false;
    pendingInboundCommands.clear();
    socket?.removeAllListeners();
    socket?.close();
    socket = null;
};

process.on('message', (message: ParentMessage) => {
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
            .catch((error: unknown) => {
                sendToParent({
                    type: 'send-command-result',
                    ipcRequestId: message.ipcRequestId,
                    ok: false,
                    message: errorMessage(error)
                });
            });
        return;
    }

    const requestId = pendingInboundCommands.get(message.ipcRequestId);
    if (requestId === undefined) return;
    pendingInboundCommands.delete(message.ipcRequestId);
    socket?.emit(TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, {
        ...message.response,
        requestId
    });
});

registerSignalHandlers(stop);

start();
