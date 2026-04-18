import type { TeamClusterDaemonTunnelOpenPayload as LocalTeamClusterDaemonTunnelOpenPayload } from '@/core/reverse-channel/contracts/reverse-channel-socket';
import type { TeamClusterDaemonTunnelOpenPayload as InboundTeamClusterDaemonTunnelOpenPayload } from '@voltstack/daemon-cluster-client';

export const readTunnelOpenPayload = (
    message: InboundTeamClusterDaemonTunnelOpenPayload
): LocalTeamClusterDaemonTunnelOpenPayload => {
    return message as LocalTeamClusterDaemonTunnelOpenPayload;
};
