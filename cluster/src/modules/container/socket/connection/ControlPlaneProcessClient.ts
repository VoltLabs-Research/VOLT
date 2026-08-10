import { errorMessage } from '@shared/application/utilities/error-message';
import { randomUUID } from 'node:crypto';
import { PlaneProcessSupervisor } from '@shared/infrastructure/planes/PlaneProcessSupervisor';
import type { ChildProcess } from 'node:child_process';
import type { DaemonConfig } from '@core/config/daemon';
import type {
    CommandResult,
    HandlerContext,
    ReverseChannelHandler
} from '@voltstack/daemon-cluster-client';
import type {
    ReverseChannelInboundMessage,
    ReverseChannelOutboundMessage
} from '@shared/contracts/channel/binary-messages';

interface PendingSendCommand {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
}

interface ChildMessage {
    type: string;
    ipcRequestId?: string;
    requestId?: string;
    command?: string;
    payload?: unknown;
    message?: unknown;
    reason?: string;
    ok?: boolean;
    data?: unknown;
}

const CONTROL_PROCESS_RESTART_DELAY_MS = 2_000;

export class ControlPlaneProcessClient extends PlaneProcessSupervisor {
    private ready = false;
    private connectWaiters: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
    private readonly handlers = new Map<string, ReverseChannelHandler>();
    private readonly messageListeners: Array<(message: ReverseChannelInboundMessage) => void> = [];
    private readonly connectedListeners: Array<() => void> = [];
    private readonly disconnectedListeners: Array<(reason: string) => void> = [];
    private readonly errorListeners: Array<(error: Error) => void> = [];
    private readonly pendingSendCommands = new Map<string, PendingSendCommand>();

    constructor(private readonly config: DaemonConfig) {
        super({
            label: 'control-plane',
            script: 'control-plane',
            restartDelayMs: CONTROL_PROCESS_RESTART_DELAY_MS,
            env: { TEAM_CLUSTER_CONTROL_PLANE: '1' },
            advancedSerialization: true
        });
    }

    connect(): Promise<void> {
        if (!this.child) {
            this.stopping = false;
            this.spawnProcess();
        }

        if (this.ready) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            this.connectWaiters.push({
                resolve,
                reject
            });
        });
    }

    disconnect(): void {
        this.ready = false;
        this.stopProcess();
    }

    sendCommand<T = unknown>(command: string, payload?: object, timeout?: number): Promise<T | undefined> {
        const child = this.child;
        if (!child || !child.connected || !this.ready) {
            return Promise.reject(new Error('Control socket is not ready'));
        }

        const ipcRequestId = randomUUID();
        return new Promise((resolve, reject) => {
            this.pendingSendCommands.set(ipcRequestId, {
                resolve: (value) => resolve(value as T | undefined),
                reject
            });
            child.send({
                type: 'send-command',
                ipcRequestId,
                command,
                payload,
                timeoutMs: timeout
            });
        });
    }

    emit(message: ReverseChannelOutboundMessage): void {
        const child = this.child;
        if (!child || !child.connected || !this.ready) {
            throw new Error('Control socket is not ready');
        }
        child.send({
            type: 'emit',
            message
        });
    }

    isReady(): boolean {
        return this.ready;
    }

    registerHandler(command: string, handler: ReverseChannelHandler): this {
        this.handlers.set(command, handler);
        return this;
    }

    onMessage(cb: (message: ReverseChannelInboundMessage) => void): this {
        this.messageListeners.push(cb);
        return this;
    }

    onConnected(cb: () => void): this {
        this.connectedListeners.push(cb);
        return this;
    }

    onDisconnected(cb: (reason: string) => void): this {
        this.disconnectedListeners.push(cb);
        return this;
    }

    onError(cb: (error: Error) => void): this {
        this.errorListeners.push(cb);
        return this;
    }

    getTeamClusterId(): string {
        return this.config.teamClusterId;
    }

    getDaemonPassword(): string {
        return this.config.daemonPassword;
    }

    protected override onProcessSpawned(child: ChildProcess): void {
        child.on('message', (message) => {
            void this.handleChildMessage(message as ChildMessage);
        });
    }

    protected override onProcessError(error: Error): void {
        this.notifyError(error);
    }

    protected override onProcessExit(code: number | null, signal: NodeJS.Signals | null): void {
        this.setDisconnected(`exit:${signal ?? code ?? 'unknown'}`);
    }

    private async handleChildMessage(message: ChildMessage): Promise<void> {
        if (message.type === 'connected') {
            this.ready = true;
            for (const waiter of this.connectWaiters.splice(0)) {
                waiter.resolve();
            }
            for (const listener of this.connectedListeners) {
                listener();
            }
            return;
        }

        if (message.type === 'disconnected') {
            this.setDisconnected(message.reason ?? 'disconnect');
            return;
        }

        if (message.type === 'error') {
            this.notifyError(new Error(String(message.message ?? 'Control plane error')));
            return;
        }

        if (message.type === 'inbound-message') {
            for (const listener of this.messageListeners) {
                listener(message.message as ReverseChannelInboundMessage);
            }
            return;
        }

        if (message.type === 'send-command-result') {
            const ipcRequestId = message.ipcRequestId;
            const pending = ipcRequestId ? this.pendingSendCommands.get(ipcRequestId) : undefined;
            if (!pending || !ipcRequestId) return;
            this.pendingSendCommands.delete(ipcRequestId);
            if (message.ok) {
                pending.resolve(message.data);
            } else {
                pending.reject(new Error(String(message.message ?? 'Control command failed')));
            }
            return;
        }

        if (message.type === 'inbound-command') {
            await this.handleInboundCommand(message);
        }
    }

    private async handleInboundCommand(message: ChildMessage): Promise<void> {
        const ipcRequestId = message.ipcRequestId;
        const command = message.command;
        if (!ipcRequestId || !command) return;

        const handler = this.handlers.get(command);
        if (!handler) {
            this.sendCommandResponse(ipcRequestId, {
                type: 'response',
                requestId: String(message.requestId),
                ok: false,
                status: 404,
                message: `Unknown daemon command: ${command}`
            });
            return;
        }

        try {
            const result = await handler.handle(message.payload, {
                command,
                requestId: String(message.requestId)
            } satisfies HandlerContext);

            this.sendCommandResponse(ipcRequestId, this.toSocketResponse(String(message.requestId), result));
        } catch (error) {
            const messageText = errorMessage(error);
            this.notifyError(new Error(`Handler error for command ${command}: ${messageText}`));
            this.sendCommandResponse(ipcRequestId, {
                type: 'response',
                requestId: String(message.requestId),
                ok: false,
                status: 500,
                message: messageText
            });
        }
    }

    private toSocketResponse(requestId: string, result: CommandResult): object {
        if (result.stream) {
            return {
                type: 'response',
                requestId,
                ok: false,
                status: 501,
                message: 'Streaming command responses are not supported by the isolated control plane'
            };
        }

        if (result.body) {
            return {
                type: 'response',
                requestId,
                ok: true,
                status: result.status ?? 200,
                headers: result.headers,
                bodyBase64: result.body.toString('base64')
            };
        }

        return {
            type: 'response',
            requestId,
            ok: true,
            status: result.status ?? 200,
            headers: result.headers,
            data: {
                status: 'success',
                data: result.data
            }
        };
    }

    private sendCommandResponse(ipcRequestId: string, response: object): void {
        this.child?.send({
            type: 'command-response',
            ipcRequestId,
            response
        });
    }

    private setDisconnected(reason: string): void {
        if (!this.ready && this.connectWaiters.length === 0) return;

        this.ready = false;
        for (const waiter of this.connectWaiters.splice(0)) {
            waiter.reject(new Error(`Control plane disconnected before registration: ${reason}`));
        }
        for (const [, pending] of this.pendingSendCommands) {
            pending.reject(new Error(`Control plane disconnected: ${reason}`));
        }
        this.pendingSendCommands.clear();
        for (const listener of this.disconnectedListeners) {
            listener(reason);
        }
    }

    private notifyError(error: Error): void {
        for (const listener of this.errorListeners) {
            listener(error);
        }
    }

}
