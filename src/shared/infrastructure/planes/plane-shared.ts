import { io, type Socket } from 'socket.io-client';

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
