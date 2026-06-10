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

    public readonly client: ControlPlaneProcessClient;

    constructor(
        private readonly config: DaemonConfig,
        private readonly getRuntimeConfigSnapshot?: () => TeamClusterDaemonRuntimeConfig | null
    ) {
        this.client = new ControlPlaneProcessClient(config);

        this.client
            .onConnected(() => {
                this.connectedToCloud = true;
                this.heartbeatFailureCount = 0;
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
        return message.type.startsWith('analysis-')
            || message.type.startsWith('trajectory-')
            || message.type === 'artifact-upload-job-status';
    }

    private isStreamTransportedServerEventMessage(
        message: TeamClusterDaemonServerEventMessage
    ): message is StreamTransportedServerEventMessage {
        return STREAM_TRANSPORTED_SERVER_EVENT_TYPE_SET.has(message.type);
    }
};
