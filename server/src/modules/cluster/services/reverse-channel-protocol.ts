import {
    TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL,
    type TeamClusterDaemonCommandMessage,
    type TeamClusterDaemonResponseType,
    type TeamClusterDaemonSocketChannel,
    type TeamClusterDaemonSocketHeaders,
    type TeamClusterDaemonTunnelOpenPayload
} from '@modules/cluster/socket/TeamClusterSocketProtocol';
import { OBJECT_GATEWAY_EXPOSURE_ID } from '@modules/cluster/services/object-gateway-paths';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { TeamClusterServiceExposureAccessMode } from '@shared/contracts/types/TeamClusterExposure';
import {
    EnvelopeKind,
    decodeEnvelope,
    encodeEnvelope,
    toUint8Array
} from '@shared/infrastructure/types/reverseChannelBinary';
import type { PassThrough } from 'node:stream';

export interface TeamClusterDaemonCommandPayload {
    command: string;
    payload?: unknown;
    responseType: TeamClusterDaemonResponseType;
}

export interface TeamClusterCommandOptions {
    timeoutMs?: number;
}

export interface TeamClusterExposureTunnelOpenRequest {
    exposureId: string;
    accessMode: TeamClusterServiceExposureAccessMode;
}

export interface TeamClusterDirectTunnelOpenRequest {
    targetHost: string;
    targetPort: number;
    accessMode: TeamClusterServiceExposureAccessMode;
}

export type TeamClusterTunnelOpenRequest = TeamClusterExposureTunnelOpenRequest | TeamClusterDirectTunnelOpenRequest;

export interface TeamClusterTunnelOpenOptions {
    timeoutMs?: number;
    timeoutMessage?: string;
}

export interface TeamClusterReverseChannelStreamAttachment {
    status: number;
    headers: TeamClusterDaemonSocketHeaders;
    stream: PassThrough;
}

export interface TeamClusterDaemonInboundStreamPayload {
    socketId: string;
    teamClusterId: string;
    requestId: string;
    streamId: string;
    chunk: Buffer;
}

export type TeamClusterDaemonInboundStreamConsumer = (payload: TeamClusterDaemonInboundStreamPayload) => void | Promise<void>;

export const wrapEnvelopeBuffer = (chunk: Buffer | Uint8Array): Uint8Array => {
    return encodeEnvelope(0, EnvelopeKind.StreamChunk, chunk);
};

export const unwrapEnvelopeBuffer = (chunk: Uint8Array): Buffer => {
    const decoded = decodeEnvelope(toUint8Array(chunk));
    if (decoded.kind !== EnvelopeKind.StreamChunk) {
        throw ApplicationError.internalServerError(
            `Unexpected reverse channel envelope kind: ${decoded.kind}`
        );
    }
    return Buffer.from(decoded.payload.buffer, decoded.payload.byteOffset, decoded.payload.byteLength);
};

export const createCommandMessage = (
    requestId: string,
    payload: TeamClusterDaemonCommandPayload
): TeamClusterDaemonCommandMessage => ({
    type: 'command',
    requestId,
    command: payload.command,
    responseType: payload.responseType,
    payload: payload.payload
});

export const resolveTunnelChannel = (
    request: TeamClusterTunnelOpenRequest
): TeamClusterDaemonSocketChannel => {
    return 'exposureId' in request && request.exposureId === OBJECT_GATEWAY_EXPOSURE_ID
        ? TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL.ObjectGateway
        : TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL.Control;
};

export const createTunnelOpenPayload = (
    sessionId: string,
    request: TeamClusterTunnelOpenRequest
): TeamClusterDaemonTunnelOpenPayload => ({
    type: 'tunnel-open',
    sessionId,
    ...request
});

export const clearPendingTimeout = (timeout: NodeJS.Timeout | null): void => {
    if (timeout) {
        clearTimeout(timeout);
    }
};
