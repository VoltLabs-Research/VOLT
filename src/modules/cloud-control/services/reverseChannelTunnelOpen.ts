import { TeamClusterServiceExposureAccessMode } from '@/shared/contracts/serviceExposure';
import type { TeamClusterDaemonTunnelOpenPayload as LocalTeamClusterDaemonTunnelOpenPayload } from '@/shared/contracts/reverseChannel';
import type { TeamClusterDaemonTunnelOpenPayload as InboundTeamClusterDaemonTunnelOpenPayload } from '@voltstack/daemon-cluster-client';

const isTunnelAccessMode = (value: string): value is TeamClusterServiceExposureAccessMode => {
    return Object.values(TeamClusterServiceExposureAccessMode).some((accessMode) => accessMode === value);
};

const isNonEmptyString = (value: unknown): value is string => {
    return typeof value === 'string' && value.trim().length > 0;
};

const readBinaryRelayDescriptor = (value: unknown): LocalTeamClusterDaemonTunnelOpenPayload['relay'] | null => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return null;
    }

    const candidate = value as Record<string, unknown>;
    if (
        !isNonEmptyString(candidate.relaySessionId)
        || !isNonEmptyString(candidate.relayUrl)
        || !isNonEmptyString(candidate.relayToken)
        || candidate.relayProtocolVersion !== 1
    ) {
        return null;
    }

    return {
        relaySessionId: candidate.relaySessionId.trim(),
        relayUrl: candidate.relayUrl.trim(),
        relayToken: candidate.relayToken.trim(),
        relayProtocolVersion: 1
    };
};

export const readTunnelOpenPayload = (
    message: InboundTeamClusterDaemonTunnelOpenPayload
): LocalTeamClusterDaemonTunnelOpenPayload | null => {
    if (!isTunnelAccessMode(message.accessMode) || !isNonEmptyString(message.sessionId)) {
        return null;
    }

    const sessionId = message.sessionId.trim();
    const relay = 'relay' in message && typeof message.relay !== 'undefined'
        ? readBinaryRelayDescriptor((message as { relay?: unknown }).relay)
        : undefined;

    if ('relay' in message && typeof message.relay !== 'undefined' && !relay) {
        return null;
    }

    if ('targetHost' in message && 'targetPort' in message) {
        const targetHost = typeof message.targetHost === 'string'
            ? message.targetHost.trim()
            : null;

        if (
            targetHost === null
            || targetHost.length === 0
            || typeof message.targetPort !== 'number'
            || !Number.isInteger(message.targetPort)
            || message.targetPort <= 0
            || message.targetPort > 65535
        ) {
            return null;
        }

        return {
            type: 'tunnel-open',
            sessionId,
            targetHost,
            targetPort: message.targetPort,
            accessMode: message.accessMode,
            ...(relay ? { relay } : {})
        };
    }

    if ('exposureId' in message) {
        const exposureId = typeof message.exposureId === 'string'
            ? message.exposureId.trim()
            : null;

        if (exposureId === null || exposureId.length === 0) {
            return null;
        }

        return {
            type: 'tunnel-open',
            sessionId,
            exposureId,
            accessMode: message.accessMode,
            ...(relay ? { relay } : {})
        };
    }

    return null;
};
