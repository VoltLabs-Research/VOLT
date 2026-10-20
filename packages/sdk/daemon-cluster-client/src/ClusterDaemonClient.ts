import { EnrollmentClient } from './enrollment/EnrollmentClient';
import { ControlSocketManager } from './socket/ControlSocketManager';
import { HeartbeatManager } from './heartbeat/HeartbeatManager';
import { ReverseChannelBridge } from './reverse-channel/ReverseChannelBridge';
import { DaemonClientError } from './errors/DaemonClientError';
import type { DaemonCredentials, EnrollmentOptions } from './enrollment/types';
import type { HeartbeatOptions } from './heartbeat/types';
import type { SocketOptions } from './socket/types';
import type { ReverseChannelHandler } from './reverse-channel/ReverseChannelHandler';
import type { TeamClusterDaemonMessage } from './contracts/reverseChannel';

type NonCommandMessage = Exclude<TeamClusterDaemonMessage, { type: 'command' }>;

export interface ClusterDaemonClientOptions {
    serverUrl: string;
    controlSocketUrl: string;
    credentials: DaemonCredentials;
    enrollment?: EnrollmentOptions;
    heartbeat?: HeartbeatOptions;
    socket?: SocketOptions;
    commandTimeout?: number;
};

export class ClusterDaemonClient {
    private daemonPassword: string;

    private readonly enrollmentClient: EnrollmentClient | null;
    private readonly socketManager: ControlSocketManager;
    private readonly heartbeatManager: HeartbeatManager;
    private readonly bridge: ReverseChannelBridge;

    private readonly connectedListeners: Array<() => void> = [];
    private readonly disconnectedListeners: Array<(reason: string) => void> = [];
    private readonly errorListeners: Array<(err: DaemonClientError) => void> = [];

    constructor(private readonly options: ClusterDaemonClientOptions) {
        this.daemonPassword = options.credentials.daemonPassword;

        const enrollmentEnabled =
            options.enrollment?.enabled !== false &&
            Boolean(options.credentials.enrollmentToken);

        this.enrollmentClient = enrollmentEnabled && options.enrollment
            ? new EnrollmentClient(options.enrollment)
            : null;

        this.bridge = new ReverseChannelBridge();
        this.bridge.onError((err) => this.notifyError(err));

        this.socketManager = new ControlSocketManager(
            options.controlSocketUrl,
            options.socket ?? {},
            {
                onConnected: () => this.notifyConnected(),
                onDisconnected: (reason) => this.notifyDisconnected(reason),
                onError: (err) => this.notifyError(err)
            }
        );

        this.socketManager.setBridge(this.bridge);

        this.heartbeatManager = new HeartbeatManager(
            options.heartbeat ?? {},
            async (payload) => {
                await this.socketManager.sendCommand('runtime.heartbeat', payload);
            },
            (error) => this.notifyError(
                error instanceof DaemonClientError
                    ? error
                    : DaemonClientError.heartbeatFailed(error)
            )
        );
    }

    async connect(): Promise<void> {
        if (this.enrollmentClient && this.options.credentials.enrollmentToken) {
            const result = await this.enrollmentClient.enroll(
                this.options.credentials.enrollmentToken,
                this.options.credentials.installedVersion
            );
            this.daemonPassword = result.daemonPassword;
        }

        await this.socketManager.connect(
            this.options.credentials.teamClusterId,
            this.daemonPassword
        );

        this.heartbeatManager.start();
    }

    disconnect(): void {
        this.heartbeatManager.stop();
        this.socketManager.disconnect();
    }

    sendCommand<T = unknown>(
        command: string,
        payload?: object,
        timeout?: number
    ): Promise<T | undefined> {
        return this.socketManager.sendCommand<T>(
            command,
            payload,
            timeout ?? this.options.commandTimeout
        );
    }

    emit(message: TeamClusterDaemonMessage): void {
        this.socketManager.emit(message);
    }

    registerHandler(command: string, handler: ReverseChannelHandler): this {
        this.bridge.registerHandler(command, handler);
        return this;
    }

    unregisterHandler(command: string): this {
        this.bridge.unregisterHandler(command);
        return this;
    }

    onMessage(cb: (message: NonCommandMessage) => void): this {
        this.bridge.onMessage(cb);
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

    onError(cb: (err: DaemonClientError) => void): this {
        this.errorListeners.push(cb);
        return this;
    }

    getTeamClusterId(): string {
        return this.options.credentials.teamClusterId;
    }

    getDaemonPassword(): string {
        return this.daemonPassword;
    }

    isReady(): boolean {
        return this.socketManager.isReady();
    }

    private notifyConnected(): void {
        for (const cb of this.connectedListeners) {
            cb();
        }
    }

    private notifyDisconnected(reason: string): void {
        for (const cb of this.disconnectedListeners) {
            cb(reason);
        }
    }

    private notifyError(err: DaemonClientError): void {
        for (const cb of this.errorListeners) {
            cb(err);
        }
    }
};
