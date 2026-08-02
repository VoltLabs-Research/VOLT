import {
    unwrapEnvelopeBuffer,
    type TeamClusterDaemonInboundStreamConsumer,
    type TeamClusterDaemonInboundStreamPayload
} from '@modules/cluster/services/reverse-channel-protocol';
import type {
    TeamClusterDaemonSocketStreamPayload,
    TeamClusterDaemonSocketStreamStatePayload
} from '@modules/cluster/socket/TeamClusterSocketProtocol';
import logger from '@shared/infrastructure/logger';

/**
 * Fan-out for stream frames the daemon initiates on its own (log chunks, artifact
 * batches) rather than as the body of a command the control plane asked for.
 */
export default class TeamClusterReverseInboundStreams {
    #consumersByStreamId = new Map<string, Set<TeamClusterDaemonInboundStreamConsumer>>();

    register(streamId: string, consumer: TeamClusterDaemonInboundStreamConsumer): () => void {
        const consumers = this.#consumersByStreamId.get(streamId) ?? new Set<TeamClusterDaemonInboundStreamConsumer>();
        consumers.add(consumer);
        this.#consumersByStreamId.set(streamId, consumers);

        return () => {
            const activeConsumers = this.#consumersByStreamId.get(streamId);
            if (!activeConsumers) {
                return;
            }

            activeConsumers.delete(consumer);
            if (activeConsumers.size === 0) {
                this.#consumersByStreamId.delete(streamId);
            }
        };
    }

    dispatchChunk(
        socketId: string,
        teamClusterId: string,
        payload: TeamClusterDaemonSocketStreamPayload
    ): void {
        const consumers = this.#consumersByStreamId.get(payload.streamId);
        if (!consumers?.size) {
            return;
        }

        let chunk: Buffer;
        try {
            chunk = unwrapEnvelopeBuffer(payload.chunk);
        } catch (error: unknown) {
            logger.warn(
                error,
                `[ReverseChannel] Failed to decode inbound stream chunk streamId=${payload.streamId} requestId=${payload.requestId}`
            );
            return;
        }

        const streamPayload: TeamClusterDaemonInboundStreamPayload = {
            socketId,
            teamClusterId,
            requestId: payload.requestId,
            streamId: payload.streamId,
            chunk
        };

        for (const consumer of consumers) {
            Promise.resolve(consumer(streamPayload)).catch((error: unknown) => {
                logger.warn(
                    error,
                    `[ReverseChannel] Inbound stream consumer failed streamId=${payload.streamId} requestId=${payload.requestId}`
                );
            });
        }
    }

    dispatchEnd(payload: TeamClusterDaemonSocketStreamStatePayload): void {
        if (!this.#consumersByStreamId.has(payload.streamId) || !payload.message) {
            return;
        }

        logger.warn(
            `[ReverseChannel] Inbound stream ended with message streamId=${payload.streamId} requestId=${payload.requestId} message=${payload.message}`
        );
    }
}
