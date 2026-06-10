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

/** Non-command inbound messages forwarded to `onMessage` subscribers. */
type NonCommandMessage = Exclude<TeamClusterDaemonMessage, { type: 'command' }>;

/** Full configuration for `ClusterDaemonClient`. */
export interface ClusterDaemonClientOptions {
    /**
     * Base URL of the Volt server.
     * Used together with `enrollment.url` for the healthcheck request.
     */
    serverUrl: string;
    /** URL of the socket.io control namespace, e.g. `wss://cloud.voltlabs.io`. */
    controlSocketUrl: string;
    /** Initial credentials - `daemonPassword` may be rotated after enrollment. */
    credentials: DaemonCredentials;
    /** Enrollment (healthcheck) options. */
    enrollment?: EnrollmentOptions;
    /** Heartbeat loop options. */
    heartbeat?: HeartbeatOptions;
    /** Control socket options. */
    socket?: SocketOptions;
    /**
     * Default timeout in milliseconds for `sendCommand` calls.
     * Individual calls may override this.
     * @default 30_000
     */
    commandTimeout?: number;
};

/**
 * High-level client for cluster-daemon ↔ Volt server communication.
 *
 * Orchestrates the full connection lifecycle:
 * 1. Optional HTTP enrollment (credential rotation).
 * 2. socket.io control socket with registration handshake.
 * 3. Periodic heartbeat loop.
 * 4. Inbound command dispatch via a `ReverseChannelBridge`.
 *
 * @example
 * ```typescript
 * const client = new ClusterDaemonClient({
 *     serverUrl: 'https://cloud.voltlabs.io',
 *     controlSocketUrl: 'wss://cloud.voltlabs.io',
 *     credentials: {
 *         teamClusterId: process.env.TEAM_CLUSTER_ID!,
 *         daemonPassword: process.env.TEAM_CLUSTER_DAEMON_PASSWORD!,
 *         enrollmentToken: process.env.TEAM_CLUSTER_ENROLLMENT_TOKEN
 *     },
 *     enrollment: { url: 'https://cloud.voltlabs.io/api/team-clusters/abc/healthcheck' }
 * });
 *
 * client.registerHandler('runtime.uninstall', myUninstallHandler);
 * await client.connect();
 * ```
 */
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

    /**
     * Connects to the Volt server.
     *
     * Steps (in order):
     * 1. If an `enrollmentToken` is present, performs the enrollment HTTP POST.
     *    The rotated `daemonPassword` is stored internally.
     * 2. Establishes the socket.io control connection and awaits registration.
     * 3. Starts the heartbeat loop.
     *
     * @throws {DaemonClientError} on enrollment or socket connection failure.
     */
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

    /**
     * Gracefully disconnects from the Volt server.
     * Stops the heartbeat loop and closes the control socket.
     */
    disconnect(): void {
        this.heartbeatManager.stop();
        this.socketManager.disconnect();
    }

    /**
     * Sends a request/response command to the server over the control socket.
     *
     * @param command - Command name, e.g. `"runtime.lifecycle"`.
     * @param payload - Arbitrary command payload sent to the server.
     * @param timeout - Per-call timeout override in milliseconds.
     * @returns The typed response data from the server command handler.
     * @throws {DaemonClientError} `SOCKET_NOT_READY` | `COMMAND_TIMEOUT` | `COMMAND_REJECTED`.
     */
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

    /**
     * Emits a fire-and-forget message on the control socket.
     * Used for outbound notifications that do not expect a response, such as
     * exposure snapshots, session data chunks and tunnel state updates.
     *
     * @throws {DaemonClientError} `EMIT_FAILED` when not connected.
     */
    emit(message: TeamClusterDaemonMessage): void {
        this.socketManager.emit(message);
    }

    /**
     * Registers a handler for an inbound command dispatched by the reverse channel.
     *
     * Handlers survive reconnections - register once at startup.
     *
     * @returns `this` for fluent chaining.
     */
    registerHandler(command: string, handler: ReverseChannelHandler): this {
        this.bridge.registerHandler(command, handler);
        return this;
    }

    /**
     * Removes a previously registered command handler.
     * @returns `this` for fluent chaining.
     */
    unregisterHandler(command: string): this {
        this.bridge.unregisterHandler(command);
        return this;
    }

    /**
     * Subscribes to all inbound non-command messages from the server.
     *
     * This includes session-input, tunnel-open, session-data, exposure-snapshot, etc.
     * Useful for daemon-level code that manages terminal/tunnel sessions.
     *
     * @returns `this` for fluent chaining.
     */
    onMessage(cb: (message: NonCommandMessage) => void): this {
        this.bridge.onMessage(cb);
        return this;
    }

    /** Subscribes to socket connected events (fired after each register ACK). */
    onConnected(cb: () => void): this {
        this.connectedListeners.push(cb);
        return this;
    }

    /** Subscribes to socket disconnected events. */
    onDisconnected(cb: (reason: string) => void): this {
        this.disconnectedListeners.push(cb);
        return this;
    }

    /** Subscribes to client errors (heartbeat failures, handler errors, socket errors). */
    onError(cb: (err: DaemonClientError) => void): this {
        this.errorListeners.push(cb);
        return this;
    }

    /** Returns the current `teamClusterId`. */
    getTeamClusterId(): string {
        return this.options.credentials.teamClusterId;
    }

    /**
     * Returns the current daemon password.
     * May differ from the value passed in `credentials` if enrollment rotated it.
     */
    getDaemonPassword(): string {
        return this.daemonPassword;
    }

    /** Returns whether the control socket is connected and registration is complete. */
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
