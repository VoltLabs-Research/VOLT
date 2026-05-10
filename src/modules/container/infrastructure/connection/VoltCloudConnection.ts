import Bottleneck from 'bottleneck';

import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import { MetricsService } from '@/core/metrics/application/MetricsService';
import type { TeamClusterDaemonServerEventMessage } from '@/core/reverse-channel/contracts/server-event';
import type { RuntimeProgressMessage } from '@/core/runtime/contracts/reverse-channel-runtime';
import http from 'node:http';
import https from 'node:https';
import {
    ClusterDaemonClient,
    DaemonClientError
} from '@voltstack/daemon-cluster-client';
import type { DaemonConfig } from '@/core/config';
import type { TeamClusterDaemonRuntimeConfig } from '@/core/runtime/contracts/team-cluster-runtime';
import type { TeamClusterDaemonMessage } from '@voltstack/daemon-cluster-client';
import { TeamClusterStatus } from '@/modules/container/contracts/container-types';
import type { ExposureSnapshotMessage } from '@/modules/container/contracts/container-types';

interface RuntimeLifecycleUpdateRequest {
    teamClusterId: string;
    daemonPassword: string;
    status: TeamClusterStatus;
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

@Service('voltCloudConnection')
export class VoltCloudConnection {
    private connectedToCloud = false;
    private lastCloudLatencyMs: number | null = null;
    private heartbeatFailureCount = 0;
    private readonly backgroundCommandConcurrency = 2;
    private readonly backgroundCommandMaxQueueSize = 2048;
    private readonly backgroundCommandLimiter: Bottleneck;
    private readonly backgroundCommandDedupeKeys = new Set<string>();
    private readonly bufferedEventMaxQueueSize = 8192;
    private readonly bufferedEventQueue: QueuedEventMessage[] = [];
    private readonly bufferedEventDedupeKeys = new Set<string>();
    private cloudLatencyProbeTimer: ReturnType<typeof setInterval> | null = null;

    public readonly client: ClusterDaemonClient;

    constructor(
        private readonly config: DaemonConfig,
        private readonly metricsService: MetricsService,
        private readonly getRuntimeConfigSnapshot?: () => TeamClusterDaemonRuntimeConfig | null
    ) {
        this.client = new ClusterDaemonClient({
            serverUrl: config.voltCloudUrl,
            controlSocketUrl: config.voltCloudUrl,
            credentials: {
                teamClusterId: config.teamClusterId,
                daemonPassword: config.daemonPassword
            },
            enrollment: { enabled: false, url: '' },
            heartbeat: {
                interval: config.heartbeatIntervalMs,
                payloadFactory: async () => ({
                    teamClusterId: this.client.getTeamClusterId(),
                    daemonPassword: this.client.getDaemonPassword(),
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
            commandTimeout: 180_000
        });

        this.backgroundCommandLimiter = new Bottleneck({
            maxConcurrent: this.backgroundCommandConcurrency,
            highWater: this.backgroundCommandMaxQueueSize,
            strategy: Bottleneck.strategy.OVERFLOW,
            rejectOnDrop: true
        });
        this.backgroundCommandLimiter.on('error', (error) => {
            logger.warn(`Background server command limiter error: ${error instanceof Error ? error.message : String(error)}`);
        });

        this.client
            .onConnected(() => {
                this.connectedToCloud = true;
                this.heartbeatFailureCount = 0;
                this.drainBufferedEvents();
                logger.info('Connected to VoltCloud');
            })
            .onDisconnected((reason) => {
                this.connectedToCloud = false;
                this.heartbeatFailureCount = 0;
                logger.info(`Outbound cloud socket disconnected (${reason})`);
            })
            .onError((err: DaemonClientError) => {
                if (err.message.includes('heartbeat')) {
                    this.heartbeatFailureCount += 1;
                    logger.warn(`Heartbeat failed: ${err.message} (heartbeatFailureCount=${this.heartbeatFailureCount}, socketReady=${this.client.isReady()})`);
                    return;
                }

                logger.error(`VoltCloudConnection error: ${err.message}`);
            });
    }

    async start(): Promise<void> {
        await this.client.connect();
        this.startCloudLatencyProbe();
    }

    stop(): void {
        if (this.cloudLatencyProbeTimer) {
            clearInterval(this.cloudLatencyProbeTimer);
            this.cloudLatencyProbeTimer = null;
        }

        void this.backgroundCommandLimiter.stop({
            dropWaitingJobs: true
        }).catch(() => undefined);
        this.client.disconnect();
    }

    isConnectedToCloud(): boolean {
        return this.connectedToCloud;
    }

    emitMessage(message: OutboundMessage): void {
        try {
            this.client.emit(message as unknown as TeamClusterDaemonMessage);
        } catch (err) {
            logger.warn(`Failed to emit message to VoltCloud: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    emitBufferedMessage(message: TeamClusterDaemonServerEventMessage, options: BufferedEventOptions = {}): void {
        const dedupeKey = options.dedupeKey;

        if (dedupeKey && this.bufferedEventDedupeKeys.has(dedupeKey)) {
            logger.debug(`Skipped duplicate buffered daemon event type=${message.type}, dedupeKey=${dedupeKey}`);
            return;
        }

        if (this.bufferedEventQueue.length >= this.bufferedEventMaxQueueSize) {
            logger.warn(`Buffered daemon event queue is full; dropping event type=${message.type}, dedupeKey=${dedupeKey ?? 'none'}, queueLength=${this.bufferedEventQueue.length}`);
            return;
        }

        if (dedupeKey) {
            this.bufferedEventDedupeKeys.add(dedupeKey);
        }

        this.bufferedEventQueue.push({ message, dedupeKey });
        this.drainBufferedEvents();
    }

    private drainBufferedEvents(): void {
        if (!this.connectedToCloud || !this.client.isReady()) return;

        while (this.bufferedEventQueue.length > 0) {
            const queued = this.bufferedEventQueue[0] as QueuedEventMessage;

            try {
                this.client.emit(queued.message as unknown as TeamClusterDaemonMessage);
            } catch (err) {
                logger.warn(`Failed to flush buffered daemon event type=${queued.message.type}: ${err instanceof Error ? err.message : String(err)}`);
                return;
            }

            this.bufferedEventQueue.shift();

            if (queued.dedupeKey) {
                this.bufferedEventDedupeKeys.delete(queued.dedupeKey);
            }
        }
    }

    async reportDeleteFailed(_details?: string): Promise<void> {
        const startedAt = Date.now();

        try {
            await this.client.sendCommand('runtime.lifecycle', {
                teamClusterId: this.client.getTeamClusterId(),
                daemonPassword: this.client.getDaemonPassword(),
                status: TeamClusterStatus.DeleteFailed
            } satisfies RuntimeLifecycleUpdateRequest);
            logger.info(`Reported daemon lifecycle status to VoltCloud: status=${TeamClusterStatus.DeleteFailed}, durationMs=${Date.now() - startedAt}`);
        } catch (error) {
            logger.warn(`Failed to send lifecycle status to VoltCloud: status=${TeamClusterStatus.DeleteFailed}, durationMs=${Date.now() - startedAt}, error=${error instanceof Error ? error.message : String(error)}`);
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
            logger.debug(`Skipped duplicate background server command command=${command}, dedupeKey=${dedupeKey}`);
            return Promise.resolve(undefined);
        }

        if (this.getBackgroundCommandQueueLength() >= this.backgroundCommandMaxQueueSize) {
            logger.warn(`Background server command queue is full; dropping command=${command}, dedupeKey=${dedupeKey ?? 'none'}, queueLength=${this.getBackgroundCommandQueueLength()}`);
            return Promise.resolve(undefined);
        }

        const enqueuedAt = Date.now();
        if (dedupeKey) {
            this.backgroundCommandDedupeKeys.add(dedupeKey);
        }

        return this.backgroundCommandLimiter.schedule(async () => {
            const queueWaitMs = Date.now() - enqueuedAt;
            if (queueWaitMs >= 5_000) {
                logger.warn(`Background server command experienced queue delay: command=${command}, dedupeKey=${dedupeKey ?? 'none'}, queueWaitMs=${queueWaitMs}, inFlight=${this.getBackgroundCommandsInFlight()}, pending=${this.getBackgroundCommandQueueLength()}`);
            }

            try {
                return await this.client.sendCommand<object>(command, payload);
            } finally {
                if (dedupeKey) {
                    this.backgroundCommandDedupeKeys.delete(dedupeKey);
                }
            }
        }).catch((error) => {
            if (dedupeKey) {
                this.backgroundCommandDedupeKeys.delete(dedupeKey);
            }

            if (this.isBackgroundCommandDropError(error)) {
                logger.warn(`Background server command queue is full; dropping command=${command}, dedupeKey=${dedupeKey ?? 'none'}, queueLength=${this.getBackgroundCommandQueueLength()}`);
                return undefined;
            }

            throw error;
        });
    }

    async getRuntimeConfig(): Promise<TeamClusterDaemonRuntimeConfig> {
        const runtimeConfig = await this.sendServerCommand<TeamClusterDaemonRuntimeConfig>(
            'runtime.config.get',
            {}
        );
        if (!runtimeConfig) {
            throw new Error('VoltCloud returned an empty runtime config payload');
        }

        return runtimeConfig;
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
                    resolve();
                });
            });

            request.once('timeout', () => {
                this.lastCloudLatencyMs = null;
                request.destroy(new Error('Cloud latency probe timed out'));
            });

            request.once('error', () => {
                this.lastCloudLatencyMs = null;
                resolve();
            });

            request.end();
        });
    }
};
