import { logger } from '@/core/logger';
import { OrchestrationAction } from '@/shared/contracts';
import { TEAM_CLUSTER_DAEMON_COMMAND } from '@/shared/contracts';
import { MetricsService } from '@/modules/metrics/services';
import { RuntimeEventBroker } from '@/shared/services';
import {
    ClusterDaemonClient,
    DaemonClientError
} from '@voltstack/daemon-cluster-client';
import type { DaemonConfig, DaemonRuntimeConfig } from '@/core/config';
import type {
    TeamClusterDaemonRuntimeProgressPayload,
    TeamClusterDaemonServerEventMessage
} from '@/shared/contracts';
import type {
    RuntimeLifecycleEvent,
    RuntimeLifecycleEventType,
    TeamClusterDaemonMessage
} from '@voltstack/daemon-cluster-client';
import { TeamClusterStatus } from '../contracts/voltCloudTypes';

interface RuntimeLifecycleUpdateRequest {
    teamClusterId: string;
    daemonPassword: string;
    status: TeamClusterStatus;
    installedVersion?: string;
};

interface DeleteCompletionRequest {
    teamClusterId: string;
    daemonPassword: string;
};

type NonCommandMessage = Exclude<TeamClusterDaemonMessage, { type: 'command' }>;
type OutboundMessage =
    | NonCommandMessage
    | TeamClusterDaemonRuntimeProgressPayload
    | TeamClusterDaemonServerEventMessage;

interface BackgroundServerCommandOptions {
    dedupeKey?: string;
}

interface BufferedEventOptions {
    dedupeKey?: string;
}

interface QueuedServerCommand {
    command: string;
    payload: object;
    dedupeKey?: string;
    enqueuedAt: number;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
}

interface QueuedEventMessage {
    message: TeamClusterDaemonServerEventMessage;
    dedupeKey?: string;
}

/**
 * Adapter that wraps `ClusterDaemonClient` to provide the lifecycle and
 * reporting API consumed by the rest of the daemon modules.
 *
 * Internal communication (enrollment, socket, heartbeat) is fully delegated to
 * `ClusterDaemonClient`. This class only adds daemon-specific concerns:
 * metrics collection for heartbeat payloads, lifecycle event emission to
 * `RuntimeEventBroker`, and the higher-level reporting helpers.
 */
export class VoltCloudConnection {
    private connectedToCloud = false;
    private readonly backgroundCommandConcurrency = 2;
    private readonly backgroundCommandMaxQueueSize = 2048;
    private readonly backgroundCommandQueue: QueuedServerCommand[] = [];
    private readonly backgroundCommandDedupeKeys = new Set<string>();
    private backgroundCommandsInFlight = 0;
    private readonly bufferedEventMaxQueueSize = 8192;
    private readonly bufferedEventQueue: QueuedEventMessage[] = [];
    private readonly bufferedEventDedupeKeys = new Set<string>();

    readonly client: ClusterDaemonClient;

    constructor(
        private readonly config: DaemonConfig,
        private readonly metricsService: MetricsService,
        private readonly eventBroker: RuntimeEventBroker
    ) {
        this.client = new ClusterDaemonClient({
            serverUrl: config.voltCloudUrl,
            controlSocketUrl: config.controlSocketUrl ?? config.voltCloudUrl,
            credentials: {
                teamClusterId: config.teamClusterId,
                daemonPassword: config.daemonPassword,
                enrollmentToken: config.enrollmentToken,
                installedVersion: config.installedVersion
            },
            enrollment: config.healthcheckPath
                ? { url: `${config.voltCloudUrl}${config.healthcheckPath}` }
                : { enabled: false, url: '' },
            heartbeat: {
                interval: config.heartbeatIntervalMs,
                payloadFactory: async () => ({
                    teamClusterId: this.client.getTeamClusterId(),
                    daemonPassword: this.client.getDaemonPassword(),
                    installedVersion: config.installedVersion,
                    metrics: await this.metricsService.collectSnapshot({
                        cloudLatencyMs: null,
                        connectedToCloud: this.connectedToCloud
                    })
                })
            },
            socket: {
                reconnect: true,
                maxReconnectAttempts: Infinity,
                reconnectBaseDelayMs: 500,
                reconnectMaxDelayMs: 30_000,
                randomizationFactor: 0.3
            },
            commandTimeout: 30_000
        });

        this.client
            .onConnected(() => {
                this.connectedToCloud = true;
                this.emitLifecycleEvent('cloud-socket-connected', 'Outbound cloud socket connected');
                this.flushBufferedEventQueue();
                logger.info('Connected to VoltCloud');
            })
            .onDisconnected((reason) => {
                this.connectedToCloud = false;
                this.emitLifecycleEvent('cloud-socket-disconnected', `Outbound cloud socket disconnected (${reason})`);
            })
            .onError((err: DaemonClientError) => {
                if (err.message.includes('heartbeat')) {
                    this.connectedToCloud = false;
                    this.emitLifecycleEvent('heartbeat-failed', err.message);
                    logger.warn(`Heartbeat failed: ${err.message}`);
                    return;
                }

                logger.error({ err }, 'VoltCloudConnection error');
            });

        this.eventBroker.onProgress((event) => {
            if (event.action !== OrchestrationAction.ContainerCreate) {
                return;
            }

            const payload: TeamClusterDaemonRuntimeProgressPayload = {
                type: 'runtime-progress',
                action: event.action,
                stage: event.stage,
                timestamp: event.timestamp,
                payload: event.payload
            };

            this.emitMessage(payload);
        });
    }

    async start(): Promise<void> {
        this.emitLifecycleEvent('starting', 'Cluster daemon starting');
        await this.client.connect();
    }

    stop(): void {
        this.client.disconnect();
    }

    isConnectedToCloud(): boolean {
        return this.connectedToCloud;
    }

    getTeamClusterId(): string {
        return this.client.getTeamClusterId();
    }

    getDaemonPassword(): string {
        return this.client.getDaemonPassword();
    }

    /**
     * Emits a fire-and-forget message on the control socket.
     * Use this instead of the old `getControlSocket().emit(...)` pattern.
     */
    emitMessage(message: OutboundMessage): void {
        try {
            this.client.emit(message);
        } catch (err: unknown) {
            logger.warn({ err }, 'Failed to emit message to VoltCloud');
        }
    }

    emitBufferedMessage(message: TeamClusterDaemonServerEventMessage, options: BufferedEventOptions = {}): void {
        const dedupeKey = typeof options.dedupeKey === 'string' && options.dedupeKey.trim().length > 0
            ? options.dedupeKey.trim()
            : undefined;

        if (dedupeKey && this.bufferedEventDedupeKeys.has(dedupeKey)) {
            logger.debug({ type: message.type, dedupeKey }, 'Skipped duplicate buffered daemon event');
            return;
        }

        if (this.connectedToCloud && this.client.isReady()) {
            try {
                this.client.emit(message);
                return;
            } catch (err: unknown) {
                logger.warn({ err, type: message.type }, 'Failed to emit daemon event immediately; buffering');
            }
        }

        if (this.bufferedEventQueue.length >= this.bufferedEventMaxQueueSize) {
            logger.warn(
                {
                    type: message.type,
                    dedupeKey,
                    queueLength: this.bufferedEventQueue.length
                },
                'Buffered daemon event queue is full; dropping event'
            );
            return;
        }

        if (dedupeKey) {
            this.bufferedEventDedupeKeys.add(dedupeKey);
        }

        this.bufferedEventQueue.push({
            message,
            dedupeKey
        });
    }

    async reportDeleteFailed(details: string): Promise<void> {
        await this.sendLifecycleStatus(TeamClusterStatus.DeleteFailed, details);
    }

    async reportUpdateFailed(details: string): Promise<void> {
        await this.sendLifecycleStatus(TeamClusterStatus.UpdateFailed, details);
    }

    async reportDeleting(details: string): Promise<void> {
        await this.sendLifecycleStatus(TeamClusterStatus.Deleting, details);
    }

    async reportDisconnected(details: string): Promise<void> {
        await this.sendLifecycleStatus(TeamClusterStatus.Disconnected, details);
    }

    async reportDeleteCompleted(details: string): Promise<void> {
        if (!this.client.isReady()) {
            return;
        }

        try {
            const request: DeleteCompletionRequest = {
                teamClusterId: this.client.getTeamClusterId(),
                daemonPassword: this.client.getDaemonPassword()
            };
            await this.sendServerCommand('runtime.delete-completed', request);
        } catch (error: unknown) {
            logger.warn({ err: error, details }, 'Failed to report completed team cluster deletion to VoltCloud');
        }
    }

    async sendServerCommand<T>(command: string, payload: object): Promise<T | undefined> {
        return this.client.sendCommand<T>(command, payload);
    }

    async sendBackgroundServerCommand<T>(
        command: string,
        payload: object,
        options: BackgroundServerCommandOptions = {}
    ): Promise<T | undefined> {
        const dedupeKey = typeof options.dedupeKey === 'string' && options.dedupeKey.trim().length > 0
            ? options.dedupeKey.trim()
            : undefined;

        if (dedupeKey && this.backgroundCommandDedupeKeys.has(dedupeKey)) {
            logger.debug({ command, dedupeKey }, 'Skipped duplicate background server command');
            return undefined;
        }

        if (this.backgroundCommandQueue.length >= this.backgroundCommandMaxQueueSize) {
            logger.warn(
                {
                    command,
                    dedupeKey,
                    queueLength: this.backgroundCommandQueue.length
                },
                'Background server command queue is full; dropping command'
            );
            return undefined;
        }

        return new Promise<T | undefined>((resolve, reject) => {
            if (dedupeKey) {
                this.backgroundCommandDedupeKeys.add(dedupeKey);
            }

            this.backgroundCommandQueue.push({
                command,
                payload,
                dedupeKey,
                enqueuedAt: Date.now(),
                resolve: (value) => resolve(value as T | undefined),
                reject
            });

            this.flushBackgroundCommandQueue();
        });
    }

    async getRuntimeConfig(): Promise<DaemonRuntimeConfig> {
        const runtimeConfig = await this.sendServerCommand<DaemonRuntimeConfig>(
            TEAM_CLUSTER_DAEMON_COMMAND.runtime.config.get,
            {}
        );
        if (!runtimeConfig) {
            throw new Error('VoltCloud returned an empty runtime config payload');
        }

        return runtimeConfig;
    }

    emitLifecycleEvent(type: RuntimeLifecycleEventType, details?: string): void {
        this.eventBroker.emitLifecycle(this.createLifecycleEvent(type, details));
    }

    private async sendLifecycleStatus(status: TeamClusterStatus, details: string): Promise<void> {
        const startedAt = Date.now();

        try {
            const requestBody: RuntimeLifecycleUpdateRequest = {
                teamClusterId: this.client.getTeamClusterId(),
                daemonPassword: this.client.getDaemonPassword(),
                status,
                installedVersion: this.config.installedVersion
            };

            await this.sendServerCommand('runtime.lifecycle', requestBody);
            logger.info({ status, durationMs: Date.now() - startedAt }, 'Reported daemon lifecycle status to VoltCloud');
        } catch (error: unknown) {
            logger.warn({ err: error, status, durationMs: Date.now() - startedAt }, 'Failed to send lifecycle status to VoltCloud');
        }
    }

    private createLifecycleEvent(type: RuntimeLifecycleEventType, details?: string): RuntimeLifecycleEvent {
        return {
            type,
            teamClusterId: this.client.getTeamClusterId(),
            timestamp: new Date().toISOString(),
            connectedToCloud: this.connectedToCloud,
            details
        };
    }

    private flushBackgroundCommandQueue(): void {
        while (
            this.backgroundCommandsInFlight < this.backgroundCommandConcurrency
            && this.backgroundCommandQueue.length > 0
        ) {
            const queued = this.backgroundCommandQueue.shift() as QueuedServerCommand;
            this.backgroundCommandsInFlight += 1;

            void this.sendServerCommand(queued.command, queued.payload)
                .then((result) => {
                    queued.resolve(result);
                })
                .catch((error) => {
                    queued.reject(error);
                })
                .finally(() => {
                    this.backgroundCommandsInFlight = Math.max(0, this.backgroundCommandsInFlight - 1);

                    if (queued.dedupeKey) {
                        this.backgroundCommandDedupeKeys.delete(queued.dedupeKey);
                    }

                    const queueWaitMs = Date.now() - queued.enqueuedAt;
                    if (queueWaitMs >= 5_000) {
                        logger.warn(
                            {
                                command: queued.command,
                                dedupeKey: queued.dedupeKey,
                                queueWaitMs,
                                inFlight: this.backgroundCommandsInFlight,
                                pending: this.backgroundCommandQueue.length
                            },
                            'Background server command experienced queue delay'
                        );
                    }

                    this.flushBackgroundCommandQueue();
                });
        }
    }

    private flushBufferedEventQueue(): void {
        if (!this.connectedToCloud || !this.client.isReady()) {
            return;
        }

        while (this.bufferedEventQueue.length > 0) {
            const queued = this.bufferedEventQueue[0] as QueuedEventMessage;

            try {
                this.client.emit(queued.message);
                this.bufferedEventQueue.shift();

                if (queued.dedupeKey) {
                    this.bufferedEventDedupeKeys.delete(queued.dedupeKey);
                }
            } catch (err: unknown) {
                logger.warn({ err, type: queued.message.type }, 'Failed to flush buffered daemon event');
                break;
            }
        }
    }
};
