import type {
    TeamClusterDaemonMessage,
    TeamClusterDaemonSessionInputPayload,
    TeamClusterDaemonSocketStreamPayload,
    TeamClusterDaemonTunnelDataPayload,
    TeamClusterDaemonTunnelDrainPayload,
    TeamClusterDaemonDirectTunnelOpenPayload
} from '@voltstack/daemon-cluster-client';
import type { InboundChunk } from '@shared/contracts/channel/binary-envelope';

type WithInboundChunk<T extends { chunk: Uint8Array }> = Omit<T, 'chunk'> & { chunk: InboundChunk };

export type BinarySessionInputPayload = WithInboundChunk<TeamClusterDaemonSessionInputPayload>;
export type BinaryStreamPayload = TeamClusterDaemonSocketStreamPayload;
export type BinaryTunnelDataPayload = WithInboundChunk<TeamClusterDaemonTunnelDataPayload>;
export type BinaryTunnelDrainPayload = TeamClusterDaemonTunnelDrainPayload;

export type DirectTunnelOpenPayload = TeamClusterDaemonDirectTunnelOpenPayload;

type WidenInboundChunks<T> = T extends { chunk: Uint8Array } ? WithInboundChunk<T> : T;

export type ReverseChannelInboundMessage = WidenInboundChunks<Exclude<TeamClusterDaemonMessage, { type: 'command' }>>;

export type ReverseChannelOutboundMessage = Exclude<TeamClusterDaemonMessage, { type: 'command' }>;
