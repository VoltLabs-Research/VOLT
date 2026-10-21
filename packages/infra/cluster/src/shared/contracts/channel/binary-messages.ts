import type {
    TeamClusterDaemonMessage,
    TeamClusterDaemonSessionInputPayload,
    TeamClusterDaemonSocketStreamPayload,
    TeamClusterDaemonTunnelDataPayload,
    TeamClusterDaemonTunnelDrainPayload,
    TeamClusterDaemonDirectTunnelOpenPayload,
    BinaryChunk
} from '@voltstack/daemon-cluster-client';

type WithInboundChunk<T extends { chunk: Uint8Array }> = Omit<T, 'chunk'> & { chunk: BinaryChunk };

export type BinarySessionInputPayload = WithInboundChunk<TeamClusterDaemonSessionInputPayload>;
export type BinaryStreamPayload = TeamClusterDaemonSocketStreamPayload;
export type BinaryTunnelDataPayload = WithInboundChunk<TeamClusterDaemonTunnelDataPayload>;
export type BinaryTunnelDrainPayload = TeamClusterDaemonTunnelDrainPayload;

export type DirectTunnelOpenPayload = TeamClusterDaemonDirectTunnelOpenPayload;

type WidenInboundChunks<T> = T extends { chunk: Uint8Array } ? WithInboundChunk<T> : T;

export type ReverseChannelInboundMessage = WidenInboundChunks<Exclude<TeamClusterDaemonMessage, { type: 'command' }>>;

export type ReverseChannelOutboundMessage = Exclude<TeamClusterDaemonMessage, { type: 'command' }>;
