import { io, type Socket } from 'socket.io-client';
import { logger } from '@shared/infrastructure/logger';

const TEAM_CLUSTER_DAEMON_REGISTER_EVENT = 'team-cluster-daemon:register';
const TEAM_CLUSTER_DAEMON_REGISTERED_EVENT = 'team-cluster-daemon:registered';
export const TEAM_CLUSTER_DAEMON_MESSAGE_EVENT = 'team-cluster-daemon:message';

/*
 * `ws` offers permessage-deflate unless told otherwise (ws 8.20.0 websocket.js:665,
 * offered at :757), and engine.io-client only forwards the option when we set it —
 * so leaving it unset means the extension gets negotiated and the control plane
 * accepts it. A plane that carries object bytes moves payloads that are already
 * zstd-compressed, where deflate buys no size and costs a synchronous zlib pass on
 * both ends of every frame. engine.io-client types the option as `{ threshold }`
 * even though `false` is what its own docs prescribe and what `ws` needs to skip
 * the offer entirely.
 */
const SKIP_PER_MESSAGE_DEFLATE = false as unknown as { threshold: number };

interface PlaneTransportOptions {
    /* Set on planes whose payloads arrive pre-compressed. */
    skipCompression?: boolean;
}

const createPlaneSocket = (
    voltCloudUrl: string,
    transport: PlaneTransportOptions = {}
): Socket =>
    io(voltCloudUrl, {
        autoConnect: true,
        forceNew: true,
        transports: ['websocket'],
        upgrade: false,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        /*
         * A 30s ceiling is priced for a remote server that may be down for a while, but
         * it is also what the daemon pays after an ordinary control-plane restart: each
         * plane has usually backed off to the ceiling by the time the server returns, so
         * the planes trickle back over half a minute and whatever they carry is late.
         * That is measurable — the exposure snapshot rides the events plane, and until
         * it lands the server has no fast byte path and every object read tunnels. Four
         * sockets retrying every few seconds is a rounding error next to that.
         */
        reconnectionDelayMax: 5_000,
        randomizationFactor: 0.3,
        ...(transport.skipCompression ? { perMessageDeflate: SKIP_PER_MESSAGE_DEFLATE } : {})
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

interface PlaneSocketConfig {
    voltCloudUrl: string;
    teamClusterId: string;
    daemonPassword: string;
}

interface PlaneSocketHandlers {
    onRegistered?: () => void;
    onDisconnected?: (reason: string) => void;
    onError?: (message: string) => void;
}

interface PlaneSocketConnection {
    socket: Socket;
    isRegistered: () => boolean;
}

export const connectPlaneSocket = (
    config: PlaneSocketConfig,
    plane: { channel: string; label: string; notifyParent?: boolean; skipCompression?: boolean },
    handlers: PlaneSocketHandlers = {}
): PlaneSocketConnection => {
    const socket = createPlaneSocket(config.voltCloudUrl, { skipCompression: plane.skipCompression });
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
