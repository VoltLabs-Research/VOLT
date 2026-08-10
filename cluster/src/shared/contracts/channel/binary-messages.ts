import type { TeamClusterDaemonMessage } from '@voltstack/daemon-cluster-client';
import type { InboundChunk } from '@shared/contracts/channel/binary-envelope';

export interface BinaryTunnelDataPayload {
    type: 'tunnel-data';
    sessionId: string;
    chunk: InboundChunk;
    isBinary: boolean;
    sequence?: number;
    requiresAck?: boolean;
}

export interface BinaryTunnelDrainPayload {
    type: 'tunnel-drain';
    sessionId: string;
    sequence: number;
}

export interface BinaryStreamPayload {
    type: 'stream';
    requestId: string;
    streamId: string;
    chunk: Uint8Array;
}

export interface BinarySessionDataPayload {
    type: 'session-data';
    sessionId: string;
    chunk: Uint8Array;
    isBinary: boolean;
}

export interface BinarySessionInputPayload {
    type: 'session-input';
    sessionId: string;
    chunk: InboundChunk;
    isBinary: boolean;
}

/**
 * The object gateway connection opens tunnels straight at a host:port instead of
 * naming a published exposure, so `tunnel-open` has two legitimate shapes.
 */
export interface DirectTunnelOpenPayload {
    type: 'tunnel-open';
    sessionId: string;
    targetHost: string;
    targetPort: number;
    accessMode: string;
}

/**
 * `@voltstack/daemon-cluster-client` still declares these three frames with
 * `chunkBase64: string`; the transport moved to binary framing, so the wire
 * actually carries `chunk: Uint8Array`. The `Binary*` payloads above are the
 * real shapes and are substituted for the stale ones in the unions below —
 * that substitution is what keeps the rest of the daemon cast-free.
 */
type StaleBase64Frame = { type: 'session-input' | 'session-data' | 'tunnel-data' };

/** Every reverse-channel frame the daemon can receive. Commands are dispatched separately. */
export type ReverseChannelInboundMessage =
    | Exclude<TeamClusterDaemonMessage, StaleBase64Frame | { type: 'command' }>
    | BinarySessionInputPayload
    | BinaryTunnelDataPayload
    | BinaryTunnelDrainPayload
    | DirectTunnelOpenPayload;

/** Every reverse-channel frame the daemon can send. */
export type ReverseChannelOutboundMessage =
    | Exclude<TeamClusterDaemonMessage, StaleBase64Frame | { type: 'command' }>
    | BinarySessionDataPayload
    | BinaryStreamPayload
    | BinaryTunnelDataPayload
    | BinaryTunnelDrainPayload;
