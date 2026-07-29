import { io, type Socket } from 'socket.io-client';
import { logger } from '@shared/infrastructure/logger';

export const TEAM_CLUSTER_DAEMON_REGISTER_EVENT = 'team-cluster-daemon:register';
export const TEAM_CLUSTER_DAEMON_REGISTERED_EVENT = 'team-cluster-daemon:registered';
export const TEAM_CLUSTER_DAEMON_MESSAGE_EVENT = 'team-cluster-daemon:message';

export const createPlaneSocket = (voltCloudUrl: string): Socket =>
    io(voltCloudUrl, {
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

export const sendToParent = (message: object): void => {
    process.send?.(message);
};

export const registerSignalHandlers = (stop: () => void): void => {
    const shutdown = (): void => {
        stop();
        process.exit(0);
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
};

export interface PlaneSocketConfig {
    voltCloudUrl: string;
    teamClusterId: string;
    daemonPassword: string;
}

export interface PlaneSocketHandlers {
    onRegistered?: () => void;
    onDisconnected?: (reason: string) => void;
    onError?: (message: string) => void;
}

export interface PlaneSocketConnection {
    socket: Socket;
    isRegistered: () => boolean;
}

export const connectPlaneSocket = (
    config: PlaneSocketConfig,
    plane: { channel: string; label: string; notifyParent?: boolean },
    handlers: PlaneSocketHandlers = {}
): PlaneSocketConnection => {
    const socket = createPlaneSocket(config.voltCloudUrl);
    let registered = false;

    socket.on('connect', () => {
        socket.emit(TEAM_CLUSTER_DAEMON_REGISTER_EVENT, {
            teamClusterId: config.teamClusterId,
            daemonPassword: config.daemonPassword,
            channel: plane.channel
        });
    });

    socket.on(TEAM_CLUSTER_DAEMON_REGISTERED_EVENT, () => {
        registered = true;
        logger.info(`${plane.label} connected to VoltCloud`);
        if (plane.notifyParent) sendToParent({ type: 'connected' });
        handlers.onRegistered?.();
    });

    socket.on('disconnect', (reason: string) => {
        registered = false;
        logger.warn(`${plane.label} disconnected (${reason})`);
        handlers.onDisconnected?.(reason);
        if (plane.notifyParent) sendToParent({
            type: 'disconnected',
            reason
        });
    });

    socket.on('connect_error', (error: Error) => {
        registered = false;
        logger.warn(`${plane.label} connection error: ${error.message}`);
        handlers.onError?.(error.message);
        if (plane.notifyParent) sendToParent({
            type: 'error',
            message: error.message
        });
    });

    return {
        socket,
        isRegistered: () => registered
    };
};
