import { PlaneProcessSupervisor } from '@shared/infrastructure/planes/PlaneProcessSupervisor';
import { logger } from '@shared/infrastructure/logger';
import type { ChildProcess } from 'node:child_process';
import type { DaemonConfig } from '@core/config/daemon';

type MessageListener = (message: unknown) => void;
type DisconnectedListener = () => void;
type ConnectedListener = () => void;
type ErrorListener = (error: Error) => void;

interface ChildEvent {
    type: string;
    message?: unknown;
    reason?: string;
}

const PROCESS_RESTART_DELAY_MS = 2_000;

export class SocketChannelProcessClient extends PlaneProcessSupervisor {
    private ready = false;
    private readonly messageListeners: MessageListener[] = [];
    private readonly disconnectedListeners: DisconnectedListener[] = [];
    private readonly connectedListeners: ConnectedListener[] = [];
    private readonly errorListeners: ErrorListener[] = [];

    constructor(
        private readonly config: DaemonConfig,
        private readonly channel: string,
        private readonly label: string
    ) {
        super({
            label: `${channel}-plane`,
            script: 'socket-channel-plane',
            restartDelayMs: PROCESS_RESTART_DELAY_MS,
            env: {
                TEAM_CLUSTER_SOCKET_CHANNEL_PROCESS: channel,
                TEAM_CLUSTER_SOCKET_CHANNEL_LABEL: label
            },
            advancedSerialization: true,
            args: [channel, label]
        });
    }

    async start(): Promise<void> {
        if (this.child) return;
        this.stopping = false;
        this.spawnProcess();

        await new Promise<void>((resolve, reject) => {
            let settled = false;
            const timeout = setTimeout(() => {
                if (settled) return;
                settled = true;
                reject(new Error(`${this.label} did not connect before startup timeout`));
            }, 30_000);
            timeout.unref();

            const cleanup = (): void => {
                clearTimeout(timeout);
                this.offConnected(onConnected);
                this.offError(onError);
            };
            const onConnected = (): void => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve();
            };
            const onError = (error: Error): void => {
                if (settled) return;
                settled = true;
                cleanup();
                reject(error);
            };

            this.onConnected(onConnected);
            this.onError(onError);
        });
    }

    stop(): void {
        this.ready = false;
        this.stopProcess();
    }

    isReady(): boolean {
        return this.ready;
    }

    emitMessage(message: unknown): void {
        const child = this.child;
        if (!child || !child.connected) {
            logger.warn(`${this.label} process is not connected; dropping message`);
            return;
        }

        child.send({
            type: 'emit-message',
            message
        });
    }

    onMessage(listener: MessageListener): this {
        this.messageListeners.push(listener);
        return this;
    }

    onDisconnected(listener: DisconnectedListener): this {
        this.disconnectedListeners.push(listener);
        return this;
    }

    onConnected(listener: ConnectedListener): this {
        this.connectedListeners.push(listener);
        return this;
    }

    onError(listener: ErrorListener): this {
        this.errorListeners.push(listener);
        return this;
    }

    private offConnected(listener: ConnectedListener): void {
        const index = this.connectedListeners.indexOf(listener);
        if (index >= 0) {
            this.connectedListeners.splice(index, 1);
        }
    }

    private offError(listener: ErrorListener): void {
        const index = this.errorListeners.indexOf(listener);
        if (index >= 0) {
            this.errorListeners.splice(index, 1);
        }
    }

    protected override onProcessSpawned(child: ChildProcess): void {
        child.on('message', (message: ChildEvent) => {
            this.handleChildMessage(message);
        });
    }

    protected override onProcessError(error: Error): void {
        logger.error({ err: error }, `@${this.channel}-plane: process error`);
        this.errorListeners.forEach((listener) => listener(error));
    }

    protected override onProcessExit(): void {
        this.ready = false;
        if (this.stopping) return;
        this.disconnectedListeners.forEach((listener) => listener());
    }

    private handleChildMessage(message: ChildEvent): void {
        if (!message) return;

        if (message.type === 'connected') {
            this.ready = true;
            this.connectedListeners.forEach((listener) => listener());
            return;
        }

        if (message.type === 'disconnected') {
            this.ready = false;
            this.disconnectedListeners.forEach((listener) => listener());
            return;
        }

        if (message.type === 'error') {
            const error = new Error(typeof message.message === 'string' ? message.message : `${this.label} socket error`);
            this.errorListeners.forEach((listener) => listener(error));
            return;
        }

        if (message.type === 'message') {
            this.messageListeners.forEach((listener) => listener(message.message));
        }
    }

}
