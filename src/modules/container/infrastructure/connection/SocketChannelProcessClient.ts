import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';

import { logger } from '@/core/logger';
import type { DaemonConfig } from '@/core/config';

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

export class SocketChannelProcessClient {
    private child: ChildProcess | null = null;
    private stopping = false;
    private ready = false;
    private restartTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly messageListeners: MessageListener[] = [];
    private readonly disconnectedListeners: DisconnectedListener[] = [];
    private readonly connectedListeners: ConnectedListener[] = [];
    private readonly errorListeners: ErrorListener[] = [];

    constructor(
        private readonly config: DaemonConfig,
        private readonly channel: string,
        private readonly label: string
    ) {}

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
        this.stopping = true;
        this.ready = false;
        if (this.restartTimer) {
            clearTimeout(this.restartTimer);
            this.restartTimer = null;
        }

        const child = this.child;
        this.child = null;
        child?.kill('SIGTERM');
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

        child.send({ type: 'emit-message', message });
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

    private spawnProcess(): void {
        const command = this.resolveProcessCommand();
        const child = spawn(command.execPath, command.args, {
            cwd: process.cwd(),
            env: {
                ...process.env,
                TEAM_CLUSTER_SOCKET_CHANNEL_PROCESS: this.channel,
                TEAM_CLUSTER_SOCKET_CHANNEL_LABEL: this.label
            },
            stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
            serialization: 'advanced'
        });

        this.child = child;

        child.stdout?.on('data', (chunk: Buffer) => {
            process.stdout.write(`[${this.channel}-plane] ${chunk.toString('utf8')}`);
        });
        child.stderr?.on('data', (chunk: Buffer) => {
            process.stderr.write(`[${this.channel}-plane] ${chunk.toString('utf8')}`);
        });
        child.on('message', (message: ChildEvent) => {
            this.handleChildMessage(message);
        });
        child.on('error', (error) => {
            logger.error({ err: error }, `@${this.channel}-plane: process error`);
            this.errorListeners.forEach((listener) => listener(error));
        });
        child.on('exit', (code, signal) => {
            if (this.child === child) {
                this.child = null;
            }
            this.ready = false;

            if (this.stopping) return;

            logger.warn(`${this.label} process exited code=${code ?? 'null'} signal=${signal ?? 'none'}; restarting`);
            this.restartTimer = setTimeout(() => {
                this.restartTimer = null;
                this.spawnProcess();
            }, PROCESS_RESTART_DELAY_MS);
            this.restartTimer.unref();
        });
    }

    private handleChildMessage(message: ChildEvent): void {
        if (!message || typeof message !== 'object') return;

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

    private resolveProcessCommand(): { execPath: string; args: string[] } {
        const runningFromDist = __filename.endsWith('.js') && __dirname.includes(`${path.sep}dist${path.sep}`);
        const scriptPath = runningFromDist
            ? path.resolve(__dirname, '..', '..', '..', '..', 'control-plane', 'socket-channel-process.js')
            : path.resolve(process.cwd(), 'src', 'control-plane', 'socket-channel-process.ts');

        if (runningFromDist) {
            return {
                execPath: process.execPath,
                args: [scriptPath, this.channel, this.label]
            };
        }

        return {
            execPath: path.resolve(process.cwd(), 'node_modules', '.bin', 'tsx'),
            args: [scriptPath, this.channel, this.label]
        };
    }
}
