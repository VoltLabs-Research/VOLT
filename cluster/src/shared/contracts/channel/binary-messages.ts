import type {
    TeamClusterDaemonMessage,
    TeamClusterDaemonSessionInputPayload,
    TeamClusterDaemonSocketStreamPayload,
    TeamClusterDaemonTunnelDataPayload,
    TeamClusterDaemonTunnelDrainPayload,
    TeamClusterDaemonDirectTunnelOpenPayload
} from '@voltstack/daemon-cluster-client';
import type { InboundChunk } from '@shared/contracts/channel/binary-envelope';

/**
 * Chunk-carrying frames are declared by `@voltstack/daemon-cluster-client` with a
 * canonical `chunk: Uint8Array`. Inbound chunks may additionally arrive as a
 * JSON-serialized `Buffer`, so inbound frames widen the chunk to `InboundChunk`;
 * every inbound chunk is normalized through `toBytes` before use.
 */
type WithInboundChunk<T extends { chunk: Uint8Array }> = Omit<T, 'chunk'> & { chunk: InboundChunk };

export type BinarySessionInputPayload = WithInboundChunk<TeamClusterDaemonSessionInputPayload>;
export type BinaryStreamPayload = TeamClusterDaemonSocketStreamPayload;
export type BinaryTunnelDataPayload = WithInboundChunk<TeamClusterDaemonTunnelDataPayload>;
export type BinaryTunnelDrainPayload = TeamClusterDaemonTunnelDrainPayload;

/**
 * The object gateway connection opens tunnels straight at a host:port instead of
 * naming a published exposure; the SDK's tunnel-open union already carries both
 * shapes, and this alias keeps the historical local name.
 */
export type DirectTunnelOpenPayload = TeamClusterDaemonDirectTunnelOpenPayload;

type WidenInboundChunks<T> = T extends { chunk: Uint8Array } ? WithInboundChunk<T> : T;

/** Every reverse-channel frame the daemon can receive. Commands are dispatched separately. */
export type ReverseChannelInboundMessage = WidenInboundChunks<Exclude<TeamClusterDaemonMessage, { type: 'command' }>>;

/** Every reverse-channel frame the daemon can send. */
export type ReverseChannelOutboundMessage = Exclude<TeamClusterDaemonMessage, { type: 'command' }>;
