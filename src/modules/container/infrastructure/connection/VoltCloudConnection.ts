import Bottleneck from 'bottleneck';

import { logger } from '@/core/logger';
import { MetricsService } from '@/core/metrics/application/MetricsService';
import { RuntimeEventBroker } from '@/core/reverse-channel/application/RuntimeEventBroker';
import type { TeamClusterDaemonServerEventMessage } from '@/core/reverse-channel/contracts/messages/server-event';
import type { ExposureSnapshotMessage } from '@/core/reverse-channel/contracts/messages/exposure-snapshot';
import type { RuntimeProgressMessage } from '@/core/reverse-channel/contracts/messages/runtime-progress';
import { ChannelCommands } from '@/core/reverse-channel/contracts/reverseChannel.constants';
import { OrchestrationAction } from '@/core/runtime/contracts/http.runtime';
import http from 'node:http';
import https from 'node:https';
import {
    ClusterDaemonClient,
    DaemonClientError
} from '@voltstack/daemon-cluster-client';
import type { DaemonConfig, DaemonRuntimeConfig } from '@/core/config';
import type { RuntimeLifecycleEventType, TeamClusterDaemonMessage } from '@voltstack/daemon-cluster-client';
import { TeamClusterStatus } from '@/modules/container/contracts/voltCloudTypes';

interface RuntimeLifecycleUpdateRequest {
    teamClusterId: string;
    daemonPassword: string;
    status: TeamClusterStatus;
    installedVersion?: string;
};
type OutboundMessage =
    | CommandlessTeamClusterDaemonMessage
    | ExposureSnapshotMessage
    | RuntimeProgressMessage
    | TeamClusterDaemonServerEventMessage;

type CommandlessTeamClusterDaemonMessage = Exclude<TeamClusterDaemonMessage, { type: 'command' }>;

interface BackgroundServerCommandOptions {
    dedupeKey?: string;
}

interface BufferedEventOptions {
    dedupeKey?: string;
}

interface QueuedEventMessage {
    message: TeamClusterDaemonServerEventMessage;
    dedupeKey?: string;
}

export class VoltCloudConnection {
    private connectedToCloud = false;
    private lastCloudLatencyMs: number | null = null;
    private heartbeatFailureCount = 0;
    private lastHeartbeatFailureAt: string | null = null;
    private readonly backgroundCommandConcurrency = 2;
    private readonly backgroundCommandMaxQueueSize = 2048;
    private readonly backgroundCommandLimiter: Bottleneck;
    private readonly backgroundCommandDedupeKeys = new Set<string>();
    private readonly bufferedEventMaxQueueSize = 8192;
    private readonly bufferedEventQueue: QueuedEventMessage[] = [];
    private readonly bufferedEventDedupeKeys = new Set<string>();
    private backgroundCommandProcessedCount = 0;
    private backgroundCommandDroppedCount = 0;
    private backgroundCommandTotalQueueWaitMs = 0;
    private backgroundCommandMaxQueueWaitMs = 0;
    private controlPlaneSummaryTimer: ReturnType<typeof setInterval> | null = null;
    private cloudLatencyProbeTimer: ReturnType<typeof setInterval> | null = null;
    private controlPlaneMetricsDirty = false;

    readonly client: ClusterDaemonClient;

    constructor(
        private readonly config: DaemonConfig,
        private readonly metricsService: MetricsService,
        private readonly eventBroker: RuntimeEventBroker,
        private readonly getRuntimeConfigSnapshot?: () => DaemonRuntimeConfig | null
    ) {
        const enrollmentEnabled = Boolean(
            config.healthcheckPath
            && config.enrollmentToken
            && !config.daemonPassword.trim()
        );

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
                ? {
                    enabled: enrollmentEnabled,
                    url: `${config.voltCloudUrl}${config.healthcheckPath}`
                }
                : { enabled: false, url: '' },
            heartbeat: {
                interval: config.heartbeatIntervalMs,
                payloadFactory: async () => ({
                    teamClusterId: this.client.getTeamClusterId(),
                    daemonPassword: this.client.getDaemonPassword(),
                    installedVersion: config.installedVersion,
                    runtime: this.getRuntimeConfigSnapshot?.(),
                    metrics: await this.metricsService.collectSnapshot({
                        cloudLatencyMs: this.lastCloudLatencyMs,
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

        this.backgroundCommandLimiter = new Bottleneck({
            maxConcurrent: this.backgroundCommandConcurrency,
            highWater: this.backgroundCommandMaxQueueSize,
            strategy: Bottleneck.strategy.OVERFLOW,
            rejectOnDrop: true
        });
        this.backgroundCommandLimiter.on('error', (error) => {
            logger.warn({ err: error as Error }, 'Background server command limiter error');
        });

        this.client
            .onConnected(() => {
                this.connectedToCloud = true;
                this.heartbeatFailureCount = 0;
                this.lastHeartbeatFailureAt = null;
                this.controlPlaneMetricsDirty = true;
                this.emitLifecycleEvent('cloud-socket-connected', 'Outbound cloud socket connected');
                if (this.client.isReady()) {
                    while (this.bufferedEventQueue.length > 0) {
                        const queued = this.bufferedEventQueue[0] as QueuedEventMessage;

                        try {
                            this.client.emit(queued.message);
                            this.bufferedEventQueue.shift();

                            if (queued.dedupeKey) {
                                this.bufferedEventDedupeKeys.delete(queued.dedupeKey);
                            }
                        } catch (err) {
                            logger.warn({ err: err as Error, type: queued.message.type }, 'Failed to flush buffered daemon event');
                            break;
                        }
                    }
                }
                logger.info('Connected to VoltCloud');
            })
            .onDisconnected((reason) => {
                this.connectedToCloud = false;
                this.heartbeatFailureCount = 0;
                this.controlPlaneMetricsDirty = true;
                this.emitLifecycleEvent('cloud-socket-disconnected', `Outbound cloud socket disconnected (${reason})`);
            })
            .onError((err: DaemonClientError) => {
                if (err.message.includes('heartbeat')) {
                    this.heartbeatFailureCount += 1;
                    this.lastHeartbeatFailureAt = new Date().toISOString();
                    this.controlPlaneMetricsDirty = true;
                    this.emitLifecycleEvent('heartbeat-failed', err.message);
                    logger.warn({
                        heartbeatFailureCount: this.heartbeatFailureCount,
                        socketReady: this.client.isReady()
                    }, `Heartbeat failed: ${err.message}`);
                    return;
                }

                logger.error({ err }, 'VoltCloudConnection error');
            });
    }

    async start(): Promise<void> {
        this.emitLifecycleEvent('starting', 'Cluster daemon starting');
        await this.client.connect();
        this.startCloudLatencyProbe();
        this.startControlPlaneSummaryTimer();
    }

    stop(): void {
        if (this.cloudLatencyProbeTimer) {
            clearInterval(this.cloudLatencyProbeTimer);
            this.cloudLatencyProbeTimer = null;
        }

        if (this.controlPlaneSummaryTimer) {
            clearInterval(this.controlPlaneSummaryTimer);
            this.controlPlaneSummaryTimer = null;
        }

        void this.backgroundCommandLimiter.stop({
            dropWaitingJobs: true
        }).catch(() => undefined);
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

    emitMessage(message: OutboundMessage): void {
        try {
            this.client.emit(message);
        } catch (err) {
            logger.warn({ err: err as Error }, 'Failed to emit message to VoltCloud');
        }
    }

    emitBufferedMessage(message: TeamClusterDaemonServerEventMessage, options: BufferedEventOptions = {}): void {
        const dedupeKey = options.dedupeKey;

        if (dedupeKey && this.bufferedEventDedupeKeys.has(dedupeKey)) {
            logger.debug({ type: message.type, dedupeKey }, 'Skipped duplicate buffered daemon event');
            return;
        }

        if (this.connectedToCloud && this.client.isReady()) {
            try {
                this.client.emit(message);
                return;
            } catch (err) {
                logger.warn({ err: err as Error, type: message.type }, 'Failed to emit daemon event immediately; buffering');
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

    async reportDeleteFailed(_details?: string): Promise<void> {
        const startedAt = Date.now();

        try {
            await this.client.sendCommand('runtime.lifecycle', {
                teamClusterId: this.client.getTeamClusterId(),
                daemonPassword: this.client.getDaemonPassword(),
                status: TeamClusterStatus.DeleteFailed,
                installedVersion: this.config.installedVersion
            } satisfies RuntimeLifecycleUpdateRequest);
            logger.info({ status: TeamClusterStatus.DeleteFailed, durationMs: Date.now() - startedAt }, 'Reported daemon lifecycle status to VoltCloud');
        } catch (error) {
            logger.warn(
                {
                    err: error as Error,
                    status: TeamClusterStatus.DeleteFailed,
                    durationMs: Date.now() - startedAt
                },
                'Failed to send lifecycle status to VoltCloud'
            );
        }
    }

    sendServerCommand<TResponse = object>(command: string, payload: object): Promise<TResponse | undefined> {
        return this.client.sendCommand<TResponse>(command, payload);
    }

    sendBackgroundServerCommand(
        command: string,
        payload: object,
        options: BackgroundServerCommandOptions = {}
    ): Promise<object | undefined> {
        const dedupeKey = options.dedupeKey;

        if (dedupeKey && this.backgroundCommandDedupeKeys.has(dedupeKey)) {
            logger.debug({ command, dedupeKey }, 'Skipped duplicate background server command');
            return Promise.resolve(undefined);
        }

        if (this.getBackgroundCommandQueueLength() >= this.backgroundCommandMaxQueueSize) {
            this.backgroundCommandDroppedCount += 1;
            this.controlPlaneMetricsDirty = true;
            logger.warn(
                {
                    command,
                    dedupeKey,
                    queueLength: this.getBackgroundCommandQueueLength()
                },
                'Background server command queue is full; dropping command'
            );
            return Promise.resolve(undefined);
        }

        const enqueuedAt = Date.now();
        if (dedupeKey) {
            this.backgroundCommandDedupeKeys.add(dedupeKey);
        }

        return this.backgroundCommandLimiter.schedule(async () => {
            const queueWaitMs = Date.now() - enqueuedAt;
            if (queueWaitMs >= 5_000) {
                logger.warn(
                    {
                        command,
                        dedupeKey,
                        queueWaitMs,
                        inFlight: this.getBackgroundCommandsInFlight(),
                        pending: this.getBackgroundCommandQueueLength()
                    },
                    'Background server command experienced queue delay'
                );
            }

            try {
                return await this.client.sendCommand<object>(command, payload);
            } finally {
                if (dedupeKey) {
                    this.backgroundCommandDedupeKeys.delete(dedupeKey);
                }

                this.backgroundCommandProcessedCount += 1;
                this.backgroundCommandTotalQueueWaitMs += queueWaitMs;
                this.backgroundCommandMaxQueueWaitMs = Math.max(this.backgroundCommandMaxQueueWaitMs, queueWaitMs);
                this.controlPlaneMetricsDirty = true;
            }
        }).catch((error) => {
            if (dedupeKey) {
                this.backgroundCommandDedupeKeys.delete(dedupeKey);
            }

            if (this.isBackgroundCommandDropError(error)) {
                this.backgroundCommandDroppedCount += 1;
                this.controlPlaneMetricsDirty = true;
                logger.warn(
                    {
                        command,
                        dedupeKey,
                        queueLength: this.getBackgroundCommandQueueLength()
                    },
                    'Background server command queue is full; dropping command'
                );
                return undefined;
            }

            throw error;
        });
    }

    async getRuntimeConfig(): Promise<DaemonRuntimeConfig> {
        const runtimeConfig = await this.sendServerCommand<DaemonRuntimeConfig>(
            ChannelCommands.RuntimeConfigGet,
            {}
        );
        if (!runtimeConfig) {
            throw new Error('VoltCloud returned an empty runtime config payload');
        }

        return runtimeConfig;
    }

    emitLifecycleEvent(type: RuntimeLifecycleEventType, details?: string): void {
        this.eventBroker.emitLifecycle({
            type,
            teamClusterId: this.client.getTeamClusterId(),
            timestamp: new Date().toISOString(),
            connectedToCloud: this.connectedToCloud,
            details
        });
    }

    private getBackgroundCommandQueueLength(): number {
        return this.backgroundCommandLimiter.counts().QUEUED;
    }

    private getBackgroundCommandsInFlight(): number {
        const counts = this.backgroundCommandLimiter.counts();
        return counts.RUNNING + counts.EXECUTING;
    }

    private isBackgroundCommandDropError(error: unknown): boolean {
        return error instanceof Error
            && error.message.toLowerCase().includes('drop');
    }

    private startCloudLatencyProbe(): void {
        if (this.cloudLatencyProbeTimer) {
            return;
        }

        const runProbe = (): void => {
            this.probeCloudLatency();
        };

        runProbe();
        this.cloudLatencyProbeTimer = setInterval(runProbe, this.config.metricsIntervalMs);
        this.cloudLatencyProbeTimer.unref();
    }

    private async probeCloudLatency(): Promise<void> {
        const targetUrl = new URL(this.config.voltCloudUrl);
        const transport = targetUrl.protocol === 'https:'
            ? https
            : http;
        const startedAt = Date.now();

        await new Promise<void>((resolve) => {
            const request = transport.request({
                method: 'HEAD',
                protocol: targetUrl.protocol,
                hostname: targetUrl.hostname,
                port: targetUrl.port ? Number(targetUrl.port) : undefined,
                path: `${targetUrl.pathname}${targetUrl.search}`,
                timeout: 5_000
            }, (response) => {
                response.resume();
                response.once('end', () => {
                    this.lastCloudLatencyMs = Date.now() - startedAt;
                    this.controlPlaneMetricsDirty = true;
                    resolve();
                });
            });

            request.once('timeout', () => {
                this.lastCloudLatencyMs = null;
                request.destroy(new Error('Cloud latency probe timed out'));
            });

            request.once('error', () => {
                this.lastCloudLatencyMs = null;
                this.controlPlaneMetricsDirty = true;
                resolve();
            });

            request.end();
        });
    }

    private startControlPlaneSummaryTimer(): void {
        if (this.controlPlaneSummaryTimer) {
            return;
        }

        this.controlPlaneSummaryTimer = setInterval(() => {
            if (!this.controlPlaneMetricsDirty) {
                return;
            }

            logger.info({
                action: 'reverse-channel.control-plane.summary',
                connectedToCloud: this.connectedToCloud,
                lastCloudLatencyMs: this.lastCloudLatencyMs,
                backgroundCommandQueueLength: this.getBackgroundCommandQueueLength(),
                backgroundCommandsInFlight: this.getBackgroundCommandsInFlight(),
                backgroundCommandProcessedCount: this.backgroundCommandProcessedCount,
                backgroundCommandDroppedCount: this.backgroundCommandDroppedCount,
                avgBackgroundCommandQueueWaitMs: this.backgroundCommandProcessedCount > 0
                    ? Math.round((this.backgroundCommandTotalQueueWaitMs / this.backgroundCommandProcessedCount) * 100) / 100
                    : 0,
                maxBackgroundCommandQueueWaitMs: this.backgroundCommandMaxQueueWaitMs,
                bufferedEventQueueLength: this.bufferedEventQueue.length,
                heartbeatFailureCount: this.heartbeatFailureCount,
                lastHeartbeatFailureAt: this.lastHeartbeatFailureAt
            }, 'Reverse-channel control-plane summary');

            this.controlPlaneMetricsDirty = false;
        }, 60_000);

        this.controlPlaneSummaryTimer.unref();
    }
};
