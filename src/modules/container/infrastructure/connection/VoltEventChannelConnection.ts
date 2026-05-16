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
import type { ExposureSnapshotMessage } from '@/modules/container/contracts/container-types';
import type { VoltCloudConnection } from '@/modules/container/infrastructure/connection/VoltCloudConnection';
import type { ControlPlaneProcessClient } from '@/modules/container/infrastructure/connection/ControlPlaneProcessClient';
import { SocketChannelProcessClient } from '@/modules/container/infrastructure/connection/SocketChannelProcessClient';
import type { TeamClusterDaemonMessage } from '@voltstack/daemon-cluster-client';

interface BufferedEventOptions {
    dedupeKey?: string;
}

interface QueuedEventMessage {
    message: TeamClusterDaemonServerEventMessage;
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

@Service('voltEventChannelConnection')
export class VoltEventChannelConnection {
    private channelClient: SocketChannelProcessClient | null = null;
    private registered = false;
    private readonly bufferedEventMaxQueueSize = 8192;
    private readonly bufferedEventQueue: QueuedEventMessage[] = [];
    private readonly bufferedEventDedupeKeys = new Set<string>();

    constructor(
        private readonly config: DaemonConfig,
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
            this.config,
            EVENTS_CHANNEL,
            'Daemon event channel'
        );
        this.channelClient = channelClient;

        channelClient.onConnected(() => {
            this.registered = true;
            logger.info('Connected daemon event channel to VoltCloud');
            this.drainBufferedEvents();
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
        this.bufferedEventQueue.length = 0;
        this.bufferedEventDedupeKeys.clear();
    }

    emitMessage(message: EventTransportMessage): void {
        if (!this.channelClient || !this.registered) {
            logger.warn(`Daemon event channel is not connected; dropping event type=${message.type}`);
            return;
        }

        try {
            this.emitEventMessage(message);
        } catch (err) {
            logger.warn(`Failed to emit event to VoltCloud: ${err instanceof Error ? err.message : String(err)}`);
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
        if (!this.channelClient || !this.registered) return;

        while (this.bufferedEventQueue.length > 0) {
            const queued = this.bufferedEventQueue[0] as QueuedEventMessage;

            try {
                this.emitEventMessage(queued.message);
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

    private emitEventMessage(message: EventTransportMessage): void {
        if (this.isStreamTransportedServerEventMessage(message)) {
            this.emitServerEventStream(message);
            return;
        }

        this.channelClient?.emitMessage(message as unknown as TeamClusterDaemonMessage);
    }

    private emitServerEventStream(message: StreamTransportedServerEventMessage): void {
        const serialized = Buffer.from(JSON.stringify(message), 'utf8');
        const streamPayload: BinaryStreamPayload = {
            type: 'stream',
            requestId: `daemon-event-stream:${message.type}`,
            streamId: message.type,
            chunk: encodeEnvelope(0, EnvelopeKind.StreamChunk, serialized)
        };

        this.channelClient?.emitMessage(streamPayload as unknown as TeamClusterDaemonMessage);
    }

    private isStreamTransportedServerEventMessage(
        message: EventTransportMessage
    ): message is StreamTransportedServerEventMessage {
        return STREAM_TRANSPORTED_SERVER_EVENT_TYPE_SET.has(message.type);
    }
}
