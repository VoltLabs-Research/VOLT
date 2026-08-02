
import {
    TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL,
    TeamClusterDaemonResponseType,
    TeamClusterServiceExposureAccessMode,
    type TeamClusterDaemonCommandMessage,
    type TeamClusterDaemonSocketChannel
} from '@modules/cluster/socket/TeamClusterSocketProtocol';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type {
    TeamClusterDaemonCommandPayload,
    TeamClusterTunnelOpenRequest
} from '@modules/cluster/services/TeamClusterReverseChannelTypes';
import {
    EnvelopeKind,
    decodeEnvelope,
    encodeEnvelope,
    toUint8Array
} from '@shared/infrastructure/types/reverseChannelBinary';

const OBJECT_GATEWAY_EXPOSURE_ID = 'daemon:object-gateway';

interface TeamClusterDaemonExposureTunnelOpenMessage {
    type: 'tunnel-open';
    sessionId: string;
    exposureId: string;
    accessMode: TeamClusterServiceExposureAccessMode;
}

interface TeamClusterDaemonDirectTunnelOpenMessage {
    type: 'tunnel-open';
    sessionId: string;
    targetHost: string;
    targetPort: number;
    accessMode: TeamClusterServiceExposureAccessMode;
}

type TeamClusterDaemonTunnelOpenMessage = TeamClusterDaemonExposureTunnelOpenMessage | TeamClusterDaemonDirectTunnelOpenMessage;

export const wrapEnvelopeBuffer = (chunk: Buffer | Uint8Array): Uint8Array => {
    return encodeEnvelope(0, EnvelopeKind.StreamChunk, chunk);
};

export const unwrapEnvelopeBuffer = (chunk: Uint8Array | Buffer | ArrayBuffer): Buffer => {
    const bytes = toUint8Array(chunk);
    const decoded = decodeEnvelope(bytes);
    if (decoded.kind !== EnvelopeKind.StreamChunk) {
        throw ApplicationError.internalServerError(
            `Unexpected reverse channel envelope kind: ${decoded.kind}`
        );
    }
    return Buffer.from(decoded.payload.buffer, decoded.payload.byteOffset, decoded.payload.byteLength);
};

export const describeBinaryCarrier = (value: unknown): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (value instanceof Uint8Array) return `${value.constructor.name}(byteLength=${value.byteLength})`;
    if (value instanceof ArrayBuffer) return `ArrayBuffer(byteLength=${value.byteLength})`;
    if (ArrayBuffer.isView(value)) {
        return `${value.constructor.name}(byteLength=${value.byteLength})`;
    }
    if (Array.isArray(value)) return `Array(length=${value.length})`;
    if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        return `Object(keys=${Object.keys(record).slice(0, 8).join(',')}; type=${String(record.type)}; data=${Array.isArray(record.data) ? `array:${record.data.length}` : typeof record.data}; length=${String(record.length)})`;
    }
    return typeof value;
};

const requireCommandResponseType = (
    responseType: TeamClusterDaemonResponseType | undefined
): TeamClusterDaemonResponseType => {
    if (!responseType) {
        throw ApplicationError.internalServerError('Daemon command response type is required');
    }

    return responseType;
};

export const createCommandMessage = (
    requestId: string,
    payload: TeamClusterDaemonCommandPayload
): TeamClusterDaemonCommandMessage => {
    return {
        type: 'command',
        requestId,
        command: payload.command,
        responseType: requireCommandResponseType(payload.responseType),
        payload: payload.payload ? { ...payload.payload } : undefined
    };
};

export const resolveTunnelChannel = (
    target: string | TeamClusterTunnelOpenRequest
): TeamClusterDaemonSocketChannel => {
    const exposureId = typeof target === 'string'
        ? target
        : 'exposureId' in target
            ? target.exposureId
            : null;

    return exposureId === OBJECT_GATEWAY_EXPOSURE_ID
        ? TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL.ObjectGateway
        : TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL.Control;
};

export const createTunnelOpenPayload = (
    sessionId: string,
    target: string | TeamClusterTunnelOpenRequest,
    accessMode?: TeamClusterServiceExposureAccessMode
): TeamClusterDaemonTunnelOpenMessage => {
    if (typeof target === 'string') {
        if (!accessMode) {
            throw ApplicationError.badRequest(
                'TeamCluster::TunnelAccessModeRequired',
                'Tunnel access mode is required when opening a tunnel by exposure id'
            );
        }

        return {
            type: 'tunnel-open',
            sessionId,
            exposureId: target,
            accessMode
        };
    }

    if ('exposureId' in target) {
        return {
            type: 'tunnel-open',
            sessionId,
            exposureId: target.exposureId,
            accessMode: target.accessMode
        };
    }

    return {
        type: 'tunnel-open',
        sessionId,
        targetHost: target.targetHost,
        targetPort: target.targetPort,
        accessMode: target.accessMode
    };
};

export const clearPendingTimeout = (timeout: NodeJS.Timeout | null): void => {
    if (timeout) {
        clearTimeout(timeout);
    }
};
