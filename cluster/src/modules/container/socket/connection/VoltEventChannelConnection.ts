import { errorMessage } from '@shared/application/utilities/error-message';
import { singleton } from '@shared/application/utilities/singleton';
import { getVoltCloudConnection } from '@modules/container/socket/connection/VoltCloudConnection';
import { logger } from '@shared/infrastructure/logger';
import { encodeStreamChunk } from '@shared/contracts/channel/binary-envelope';
import type { BinaryStreamPayload } from '@shared/contracts/channel/binary-messages';
import type { TeamClusterDaemonServerEventMessage } from '@shared/contracts/channel/server-event';
import type { RuntimeProgressMessage } from '@shared/contracts/types/reverse-channel-runtime';
import type { ExposureSnapshotMessage } from '@shared/contracts/types/container-types';
import type { VoltCloudConnection } from '@modules/container/socket/connection/VoltCloudConnection';
import type { ControlPlaneProcessClient } from '@modules/container/socket/connection/ControlPlaneProcessClient';
import { SocketChannelProcessClient } from '@modules/container/socket/connection/SocketChannelProcessClient';
import { BufferedDedupeQueue } from '@modules/container/socket/connection/BufferedDedupeQueue';

interface BufferedEventOptions {
    dedupeKey?: string;
}

const EVENTS_CHANNEL = 'events';

const STREAM_TRANSPORTED_SERVER_EVENT_TYPES = [
    'analysis-log-chunk',
    'debug-log-chunk',
    'trajectory-scene-artifact-upsert-batch'
] as const;

type EventTransportMessage =
    | ExposureSnapshotMessage
    | RuntimeProgressMessage
    | TeamClusterDaemonServerEventMessage;

type StreamTransportedServerEventType = typeof STREAM_TRANSPORTED_SERVER_EVENT_TYPES[number];
type StreamTransportedServerEventMessage = Extract<
    TeamClusterDaemonServerEventMessage,
    { type: StreamTransportedServerEventType }
>;

const STREAM_TRANSPORTED_SERVER_EVENT_TYPE_SET = new Set<string>(STREAM_TRANSPORTED_SERVER_EVENT_TYPES);

export class VoltEventChannelConnection {
    private channelClient: SocketChannelProcessClient | null = null;
    private registered = false;
    private readonly readyListeners = new Set<() => void>();
    private readonly bufferedEvents = new BufferedDedupeQueue<TeamClusterDaemonServerEventMessage>(8192);

    constructor(
        private readonly voltCloudConnection: VoltCloudConnection
    ) {}

    get client(): ControlPlaneProcessClient {
        return this.voltCloudConnection.client;
    }

    async start(): Promise<void> {
        if (this.channelClient) {
            return;
        }

        const channelClient = new SocketChannelProcessClient(
            EVENTS_CHANNEL,
            'Daemon event channel'
        );
        this.channelClient = channelClient;

        channelClient.onConnected(() => {
            this.registered = true;
            logger.info('Connected daemon event channel to VoltCloud');
            this.drainBufferedEvents();

            for (const listener of this.readyListeners) {
                try {
                    listener();
                } catch (error) {
                    logger.warn(`Daemon event channel ready listener failed: ${(error as Error).message}`);
                }
            }
        });
        channelClient.onDisconnected(() => {
            this.registered = false;
            logger.info('Daemon event channel disconnected');
        });
        channelClient.onError((error) => {
            logger.warn(`Daemon event channel connection error: ${error.message}`);
        });

        await channelClient.start();
    }

    stop(): void {
        this.registered = false;
        this.channelClient?.stop();
        this.channelClient = null;
        this.bufferedEvents.clear();
    }

    isReady(): boolean {
        return Boolean(this.channelClient) && this.registered;
    }

    onReady(listener: () => void): () => void {
        this.readyListeners.add(listener);
        return () => this.readyListeners.delete(listener);
    }

    emitMessage(message: EventTransportMessage): void {
        if (!this.channelClient || !this.registered) {
            if (this.isStreamTransportedServerEventMessage(message)) {
                this.emitBufferedMessage(message);
                return;
            }
            logger.warn(`Daemon event channel is not connected; dropping event type=${message.type}`);
            return;
        }

        try {
            this.emitEventMessage(message);
        } catch (err) {
            if (this.isStreamTransportedServerEventMessage(message)) {
                this.emitBufferedMessage(message);
                return;
            }
            logger.warn(`Failed to emit event to VoltCloud: ${errorMessage(err)}`);
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
        if (!this.channelClient || !this.registered) return;

        const drainResult = this.bufferedEvents.drain((queuedMessage) => {
            this.emitEventMessage(queuedMessage);
        });
        if (!drainResult.ok && drainResult.failedItem) {
            logger.warn(`Failed to flush buffered daemon event type=${drainResult.failedItem.type}: ${errorMessage(drainResult.error)}`);
        }
    }

    private emitEventMessage(message: EventTransportMessage): void {
        if (this.isStreamTransportedServerEventMessage(message)) {
            this.emitServerEventStream(message);
            return;
        }

        this.channelClient?.emitMessage(message);
    }

    private emitServerEventStream(message: StreamTransportedServerEventMessage): void {
        const serialized = Buffer.from(JSON.stringify(message), 'utf8');
        const streamPayload: BinaryStreamPayload = {
            type: 'stream',
            requestId: `daemon-event-stream:${message.type}`,
            streamId: message.type,
            chunk: encodeStreamChunk(serialized)
        };

        this.channelClient?.emitMessage(streamPayload);
    }

    private isStreamTransportedServerEventMessage(
        message: EventTransportMessage
    ): message is StreamTransportedServerEventMessage {
        return STREAM_TRANSPORTED_SERVER_EVENT_TYPE_SET.has(message.type);
    }
}

export const getVoltEventChannelConnection = singleton((): VoltEventChannelConnection => new VoltEventChannelConnection(getVoltCloudConnection()));
