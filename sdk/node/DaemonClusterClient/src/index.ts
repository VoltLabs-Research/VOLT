/** Main client */
export { ClusterDaemonClient } from './ClusterDaemonClient';
export type { ClusterDaemonClientOptions } from './ClusterDaemonClient';

/** Enrollment */
export { EnrollmentClient } from './enrollment/EnrollmentClient';
export type { DaemonCredentials, EnrollmentOptions, EnrollmentResult } from './enrollment/types';

/** Socket */
export { ControlSocketManager } from './socket/ControlSocketManager';
export type { SocketOptions } from './socket/types';

/** Heartbeat */
export { HeartbeatManager } from './heartbeat/HeartbeatManager';
export type { HeartbeatOptions } from './heartbeat/types';

/** Reverse channel */
export { ReverseChannelBridge } from './reverse-channel/ReverseChannelBridge';
export type { ReverseChannelHandler } from './reverse-channel/ReverseChannelHandler';
export type { CommandResult, HandlerContext } from './reverse-channel/types';

/** Errors */
export { DaemonClientError } from './errors/DaemonClientError';
export { DaemonClientErrorCode } from './errors/error-codes';

/** Protocol contracts */
export { DaemonSocketEvent, ProgressStageType } from './contracts/events';
export type {
    RuntimeLifecycleEventType,
    RuntimeLifecycleEvent,
    RuntimeProgressEvent
} from './contracts/events';

export { REVERSE_CHANNEL, TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL } from './contracts/reverseChannel';
export type {
    TeamClusterDaemonResponseType,
    TeamClusterDaemonSessionKind,
    TeamClusterDaemonTerminalTarget,
    TeamClusterTunnelSessionStatus,
    TeamClusterDaemonSocketChannel,
    TeamClusterDaemonSocketHeaders,
    TeamClusterDaemonRegisterPayload,
    TeamClusterDaemonCommandMessage,
    TeamClusterDaemonSuccessEnvelope,
    TeamClusterDaemonErrorResult,
    TeamClusterDaemonSocketResponsePayload,
    TeamClusterDaemonSocketStreamPayload,
    TeamClusterDaemonSocketStreamStatePayload,
    TeamClusterDaemonSessionAttachPayload,
    TeamClusterDaemonSessionAttachResult,
    TeamClusterDaemonSessionInputPayload,
    TeamClusterDaemonSessionResizePayload,
    TeamClusterDaemonSessionDetachPayload,
    TeamClusterDaemonSessionDataPayload,
    TeamClusterDaemonSessionEndPayload,
    TeamClusterDaemonExposureSnapshotPayload,
    TeamClusterDaemonExposureUpsertPayload,
    TeamClusterDaemonExposureRemovePayload,
    TeamClusterDaemonExposureTunnelOpenPayload,
    TeamClusterDaemonDirectTunnelOpenPayload,
    TeamClusterDaemonTunnelOpenPayload,
    TeamClusterDaemonTunnelStatePayload,
    TeamClusterDaemonTunnelDataPayload,
    TeamClusterDaemonTunnelDrainPayload,
    TeamClusterDaemonTunnelClosePayload,
    TeamClusterDaemonTunnelHeartbeatPayload,
    TeamClusterDaemonContainerCreateProgress,
    TeamClusterDaemonRuntimeProgressPayload,
    TeamClusterDaemonMessage
} from './contracts/reverseChannel';

export type {
    TeamClusterDaemonRole,
    TeamClusterDaemonRoleDrainState,
    TeamClusterDaemonRuntimeRoleConfig,
    TeamClusterDaemonQueueScopeLimit,
    TeamClusterDaemonQueueScopeLimits,
    TeamClusterDaemonQueueConcurrency,
    TeamClusterDaemonHostCapabilities,
    TeamClusterDaemonMemoryMetrics,
    TeamClusterDaemonDiskMetrics,
    TeamClusterDaemonDiskOperationMetrics,
    TeamClusterDaemonNetworkMetrics,
    TeamClusterDaemonHeartbeatMetrics,
    TeamClusterDaemonHeartbeatCommand,
    TeamClusterDaemonLifecycleCommand,
    TeamClusterDaemonDeleteCompletedCommand
} from './contracts/runtime';

export type {
    EnrollmentRequestBody,
    EnrollmentResponseData,
    EnrollmentApiResponse
} from './contracts/http';
