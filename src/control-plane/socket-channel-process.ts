import { io, type Socket } from 'socket.io-client';

import { loadConfig } from '@/core/config';
import { logger } from '@/core/logger';

interface EmitMessage {
    type: 'emit-message';
    message: unknown;
}

const TEAM_CLUSTER_DAEMON_REGISTER_EVENT = 'team-cluster-daemon:register';
const TEAM_CLUSTER_DAEMON_REGISTERED_EVENT = 'team-cluster-daemon:registered';
const TEAM_CLUSTER_DAEMON_MESSAGE_EVENT = 'team-cluster-daemon:message';
const MAX_BUFFERED_MESSAGES = 8192;

const config = loadConfig();
const channel = process.argv[2] || process.env.TEAM_CLUSTER_SOCKET_CHANNEL_PROCESS;
const label = process.argv[3] || process.env.TEAM_CLUSTER_SOCKET_CHANNEL_LABEL || channel || 'socket channel';

let socket: Socket | null = null;
let registered = false;
const bufferedMessages: unknown[] = [];

const sendToParent = (message: object): void => {
    if (!process.send) return;
    process.send(message);
};

const drainBufferedMessages = (): void => {
    if (!socket || !registered) return;

    while (bufferedMessages.length > 0) {
        socket.emit(TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, bufferedMessages.shift());
    }
};

const emitMessage = (message: unknown): void => {
    if (!socket || !registered) {
        if (bufferedMessages.length >= MAX_BUFFERED_MESSAGES) {
            bufferedMessages.shift();
        }
        bufferedMessages.push(message);
        return;
    }

    socket.emit(TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, message);
};

const start = (): void => {
    socket = io(config.voltCloudUrl, {
        autoConnect: true,
        forceNew: true,
        transports: ['websocket'],
        upgrade: false,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 30_000,
        randomizationFactor: 0.3
    });

    socket.on('connect', () => {
        socket?.emit(TEAM_CLUSTER_DAEMON_REGISTER_EVENT, {
            teamClusterId: config.teamClusterId,
            daemonPassword: config.daemonPassword,
            channel
        });
    });

    socket.on(TEAM_CLUSTER_DAEMON_REGISTERED_EVENT, () => {
        registered = true;
        logger.info(`${label} connected to VoltCloud`);
        sendToParent({ type: 'connected' });
        drainBufferedMessages();
    });

    socket.on('disconnect', (reason) => {
        registered = false;
        logger.warn(`${label} disconnected (${reason})`);
        sendToParent({ type: 'disconnected', reason });
    });

    socket.on('connect_error', (error) => {
        registered = false;
        logger.warn(`${label} connection error: ${error.message}`);
        sendToParent({ type: 'error', message: error.message });
    });

    socket.on(TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, (message: unknown) => {
        sendToParent({ type: 'message', message });
    });
};

const stop = (): void => {
    registered = false;
    bufferedMessages.length = 0;
    socket?.removeAllListeners();
    socket?.close();
    socket = null;
};

process.on('message', (message: EmitMessage) => {
    if (!message || message.type !== 'emit-message') return;
    emitMessage(message.message);
});

process.once('SIGINT', () => {
    stop();
    process.exit(0);
});

process.once('SIGTERM', () => {
    stop();
    process.exit(0);
});

if (channel) {
    start();
}
