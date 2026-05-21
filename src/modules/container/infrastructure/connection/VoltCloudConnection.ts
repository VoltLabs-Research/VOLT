import Bottleneck from 'bottleneck';

import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import {
    EnvelopeKind,
    encodeEnvelope
} from '@/core/reverse-channel/contracts/binary-envelope';
import type { BinaryStreamPayload } from '@/core/reverse-channel/contracts/binary-messages';
import type { TeamClusterDaemonServerEventMessage } from '@/core/reverse-channel/contracts/server-event';
import type { RuntimeProgressMessage } from '@/core/runtime/contracts/reverse-channel-runtime';
import type { DaemonConfig } from '@/core/config';
import type { TeamClusterDaemonRuntimeConfig } from '@/core/runtime/contracts/team-cluster-runtime';
import type { TeamClusterDaemonMessage } from '@voltstack/daemon-cluster-client';
import { ControlPlaneProcessClient } from '@/modules/container/infrastructure/connection/ControlPlaneProcessClient';
import { TeamClusterStatus } from '@/modules/container/contracts/container-types';
import type { ExposureSnapshotMessage } from '@/modules/container/contracts/container-types';
import { BufferedDedupeQueue } from '@/modules/container/infrastructure/connection/BufferedDedupeQueue';

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

const STREAM_TRANSPORTED_SERVER_EVENT_TYPES = [
    'analysis-log-chunk',
    'debug-log-chunk',
    'trajectory-scene-artifact-upsert-batch'
] as const;

type StreamTransportedServerEventType = typeof STREAM_TRANSPORTED_SERVER_EVENT_TYPES[number];
type StreamTransportedServerEventMessage = Extract<
    TeamClusterDaemonServerEventMessage,
    { type: StreamTransportedServerEventType }
>;

const STREAM_TRANSPORTED_SERVER_EVENT_TYPE_SET = new Set<string>(STREAM_TRANSPORTED_SERVER_EVENT_TYPES);

@Service('voltCloudConnection')
export class VoltCloudConnection {
    private connectedToCloud = false;
    private heartbeatFailureCount = 0;
    private readonly backgroundCommandConcurrency = 2;
    private readonly backgroundCommandMaxQueueSize = 2048;
    private readonly backgroundCommandLimiter: Bottleneck;
    private readonly backgroundCommandDedupeKeys = new Set<string>();
    private readonly bufferedEvents = new BufferedDedupeQueue<TeamClusterDaemonServerEventMessage>(8192);

    public readonly client: ControlPlaneProcessClient;

    constructor(
        private readonly config: DaemonConfig,
        private readonly getRuntimeConfigSnapshot?: () => TeamClusterDaemonRuntimeConfig | null
    ) {
        this.client = new ControlPlaneProcessClient(config);

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
            .onError((err: Error) => {
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
    }

    stop(): void {
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
            this.emitTransportMessage(message);
        } catch (err) {
            logger.warn(`Failed to emit message to VoltCloud: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    emitBufferedMessage(message: TeamClusterDaemonServerEventMessage, options: BufferedEventOptions = {}): void {
        const dedupeKey = options.dedupeKey;
        const enqueueResult = this.bufferedEvents.enqueue(message, dedupeKey);
        if (enqueueResult === 'duplicate') {
            logger.debug(`Skipped duplicate buffered daemon event type=${message.type}, dedupeKey=${dedupeKey}`);
            return;
        }

        if (enqueueResult === 'overflow') {
            logger.warn(`Buffered daemon event queue is full; dropping event type=${message.type}, dedupeKey=${dedupeKey ?? 'none'}, queueLength=${this.bufferedEvents.length}`);
            return;
        }
        this.drainBufferedEvents();
    }

    private drainBufferedEvents(): void {
        if (!this.connectedToCloud || !this.client.isReady()) return;

        const drainResult = this.bufferedEvents.drain((queuedMessage) => {
            this.emitServerEventMessage(queuedMessage);
        });
        if (!drainResult.ok && drainResult.failedItem) {
            logger.warn(`Failed to flush buffered daemon event type=${drainResult.failedItem.type}: ${drainResult.error instanceof Error ? drainResult.error.message : String(drainResult.error)}`);
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

    private emitTransportMessage(message: OutboundMessage): void {
        if (this.isServerEventMessage(message)) {
            this.emitServerEventMessage(message);
            return;
        }

        this.client.emit(message as unknown as TeamClusterDaemonMessage);
    }

    private emitServerEventMessage(message: TeamClusterDaemonServerEventMessage): void {
        if (!this.isStreamTransportedServerEventMessage(message)) {
            this.client.emit(message as unknown as TeamClusterDaemonMessage);
            return;
        }

        const serialized = Buffer.from(JSON.stringify(message), 'utf8');
        const streamPayload: BinaryStreamPayload = {
            type: 'stream',
            requestId: `daemon-event-stream:${message.type}`,
            streamId: message.type,
            chunk: encodeEnvelope(0, EnvelopeKind.StreamChunk, serialized)
        };

        this.client.emit(streamPayload as unknown as TeamClusterDaemonMessage);
    }

    private isServerEventMessage(message: OutboundMessage): message is TeamClusterDaemonServerEventMessage {
        return typeof message === 'object'
            && message !== null
            && 'type' in message
            && typeof message.type === 'string'
            && (
                message.type.startsWith('analysis-')
                || message.type.startsWith('trajectory-')
                || message.type === 'artifact-upload-job-status'
            );
    }

    private isStreamTransportedServerEventMessage(
        message: TeamClusterDaemonServerEventMessage
    ): message is StreamTransportedServerEventMessage {
        return STREAM_TRANSPORTED_SERVER_EVENT_TYPE_SET.has(message.type);
    }
};
