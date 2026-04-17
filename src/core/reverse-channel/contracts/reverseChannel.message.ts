import type { TeamClusterDaemonExposureSnapshotPayload, TeamClusterDaemonRuntimeProgressPayload, TeamClusterDaemonServerEventMessage } from '@/core/reverse-channel/contracts/reverseChannel.events';
import type { TeamClusterDaemonCommandMessage, TeamClusterDaemonSessionDataPayload, TeamClusterDaemonSessionDetachPayload, TeamClusterDaemonSessionEndPayload, TeamClusterDaemonSessionInputPayload, TeamClusterDaemonSessionResizePayload, TeamClusterDaemonSocketResponsePayload, TeamClusterDaemonSocketStreamPayload, TeamClusterDaemonSocketStreamStatePayload, TeamClusterDaemonTunnelClosePayload, TeamClusterDaemonTunnelDataPayload, TeamClusterDaemonTunnelHeartbeatPayload, TeamClusterDaemonTunnelOpenPayload, TeamClusterDaemonTunnelStatePayload } from '@/core/reverse-channel/contracts/reverseChannel.socket';

export type TeamClusterDaemonMessage =
    | TeamClusterDaemonCommandMessage
    | TeamClusterDaemonSocketResponsePayload
    | TeamClusterDaemonSocketStreamPayload
    | TeamClusterDaemonSocketStreamStatePayload
    | TeamClusterDaemonSessionInputPayload
    | TeamClusterDaemonSessionResizePayload
    | TeamClusterDaemonSessionDetachPayload
    | TeamClusterDaemonSessionDataPayload
    | TeamClusterDaemonSessionEndPayload
    | TeamClusterDaemonExposureSnapshotPayload
    | TeamClusterDaemonTunnelOpenPayload
    | TeamClusterDaemonTunnelStatePayload
    | TeamClusterDaemonTunnelDataPayload
    | TeamClusterDaemonTunnelClosePayload
    | TeamClusterDaemonTunnelHeartbeatPayload
    | TeamClusterDaemonRuntimeProgressPayload
    | TeamClusterDaemonServerEventMessage;
