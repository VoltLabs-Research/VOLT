import { type Socket } from 'socket.io-client';

import { loadConfig } from '@core/config/daemon';
import {
    TEAM_CLUSTER_DAEMON_MESSAGE_EVENT,
    connectPlaneSocket,
    sendToParent,
    registerSignalHandlers
} from '@shared/infrastructure/planes/plane-shared';

interface EmitMessage {
    type: 'emit-message';
    message: unknown;
}

const MAX_BUFFERED_MESSAGES = 8192;

const config = loadConfig();
const channel = process.argv[2] || process.env.TEAM_CLUSTER_SOCKET_CHANNEL_PROCESS;
const label = process.argv[3] || process.env.TEAM_CLUSTER_SOCKET_CHANNEL_LABEL || channel || 'socket channel';

let socket: Socket | null = null;
let isRegistered = (): boolean => false;
const bufferedMessages: unknown[] = [];

const drainBufferedMessages = (): void => {
    if (!socket || !isRegistered()) return;

    while (bufferedMessages.length > 0) {
        socket.emit(TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, bufferedMessages.shift());
    }
};

const emitMessage = (message: unknown): void => {
    if (!socket || !isRegistered()) {
        if (bufferedMessages.length >= MAX_BUFFERED_MESSAGES) {
            bufferedMessages.shift();
        }
        bufferedMessages.push(message);
        return;
    }

    socket.emit(TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, message);
};

const start = (activeChannel: string): void => {
    const connection = connectPlaneSocket(
        config,
        {
            channel: activeChannel,
            label,
            notifyParent: true,
            /* This plane relays object-gateway bytes, which are already compressed. */
            skipCompression: true
        },
        { onRegistered: drainBufferedMessages }
    );

    socket = connection.socket;
    isRegistered = connection.isRegistered;

    socket.on(TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, (message: unknown) => {
        sendToParent({
            type: 'message',
            message
        });
    });
};

const stop = (): void => {
    isRegistered = () => false;
    bufferedMessages.length = 0;
    socket?.removeAllListeners();
    socket?.close();
    socket = null;
};

process.on('message', (message: EmitMessage) => {
    if (!message || message.type !== 'emit-message') return;
    emitMessage(message.message);
});

registerSignalHandlers(stop);

if (channel) {
    start(channel);
}
