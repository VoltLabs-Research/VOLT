import { TeamClusterServiceExposureAccessMode } from '@/shared/contracts';
import type { TeamClusterDaemonTunnelOpenPayload as LocalTeamClusterDaemonTunnelOpenPayload } from '@/shared/contracts';
import type { TeamClusterDaemonTunnelOpenPayload as InboundTeamClusterDaemonTunnelOpenPayload } from '@voltstack/daemon-cluster-client';

const isTunnelAccessMode = (value: string): value is TeamClusterServiceExposureAccessMode => {
    return Object.values(TeamClusterServiceExposureAccessMode).some((accessMode) => accessMode === value);
};

const isNonEmptyString = (value: unknown): value is string => {
    return typeof value === 'string' && value.trim().length > 0;
};

export const readTunnelOpenPayload = (
    message: InboundTeamClusterDaemonTunnelOpenPayload
): LocalTeamClusterDaemonTunnelOpenPayload | null => {
    if (!isTunnelAccessMode(message.accessMode) || !isNonEmptyString(message.sessionId)) {
        return null;
    }

    const sessionId = message.sessionId.trim();

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
            accessMode: message.accessMode
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
            accessMode: message.accessMode
        };
    }

    return null;
};
