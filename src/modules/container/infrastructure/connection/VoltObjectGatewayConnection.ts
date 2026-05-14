import { io, type Socket } from 'socket.io-client';

import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import type { DaemonConfig } from '@/core/config';

const TEAM_CLUSTER_DAEMON_REGISTER_EVENT = 'team-cluster-daemon:register';
const TEAM_CLUSTER_DAEMON_REGISTERED_EVENT = 'team-cluster-daemon:registered';
const TEAM_CLUSTER_DAEMON_MESSAGE_EVENT = 'team-cluster-daemon:message';
const OBJECT_GATEWAY_CHANNEL = 'object-gateway';

type MessageListener = (message: unknown) => void;
type DisconnectedListener = () => void;

@Service('voltObjectGatewayConnection')
export class VoltObjectGatewayConnection {
    private socket: Socket | null = null;
    private registered = false;
    private readonly messageListeners: MessageListener[] = [];
    private readonly disconnectedListeners: DisconnectedListener[] = [];

    constructor(private readonly config: DaemonConfig) {}

    async start(): Promise<void> {
        if (this.socket) {
            return;
        }

        const socket = io(this.config.voltCloudUrl, {
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
        this.socket = socket;

        await new Promise<void>((resolve, reject) => {
            let settled = false;
            const settle = (fn: () => void): void => {
                if (settled) {
                    return;
                }

                settled = true;
                fn();
            };

            socket.on('connect', () => {
                socket.emit(TEAM_CLUSTER_DAEMON_REGISTER_EVENT, {
                    teamClusterId: this.config.teamClusterId,
                    daemonPassword: this.config.daemonPassword,
                    channel: OBJECT_GATEWAY_CHANNEL
                });
            });

            socket.on(TEAM_CLUSTER_DAEMON_REGISTERED_EVENT, () => {
                this.registered = true;
                logger.info('Connected object gateway data channel to VoltCloud');
                settle(resolve);
            });

            socket.on('disconnect', (reason) => {
                this.registered = false;
                logger.info(`Object gateway data channel disconnected (${reason})`);
                for (const listener of this.disconnectedListeners) {
                    listener();
                }
            });

            socket.on('connect_error', (error) => {
                logger.warn(`Object gateway data channel connection error: ${error.message}`);
                settle(() => reject(error));
            });

            socket.on(TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, (message: unknown) => {
                for (const listener of this.messageListeners) {
                    listener(message);
                }
            });
        });
    }

    stop(): void {
        this.registered = false;
        this.socket?.removeAllListeners();
        this.socket?.close();
        this.socket = null;
    }

    emitMessage(message: object): void {
        if (!this.socket || !this.registered) {
            logger.warn('Object gateway data channel is not connected; dropping reverse-channel message');
            return;
        }

        this.socket.emit(TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, message);
    }

    onMessage(listener: MessageListener): this {
        this.messageListeners.push(listener);
        return this;
    }

    onDisconnected(listener: DisconnectedListener): this {
        this.disconnectedListeners.push(listener);
        return this;
    }
}
