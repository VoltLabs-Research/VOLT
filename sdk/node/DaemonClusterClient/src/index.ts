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

export { REVERSE_CHANNEL } from './contracts/reverseChannel';
export type {
    TeamClusterDaemonResponseType,
    TeamClusterDaemonSessionKind,
    TeamClusterDaemonTerminalTarget,
    TeamClusterTunnelSessionStatus,
    TeamClusterDaemonSocketHeaders,
    TeamClusterDaemonRegisterPayload,
    TeamClusterDaemonCommandMessage,
    TeamClusterDaemonSocketResponsePayload,
    TeamClusterDaemonSocketStreamPayload,
    TeamClusterDaemonSocketStreamStatePayload,
    TeamClusterDaemonSessionAttachPayload,
    TeamClusterDaemonSessionInputPayload,
    TeamClusterDaemonSessionResizePayload,
    TeamClusterDaemonSessionDetachPayload,
    TeamClusterDaemonSessionDataPayload,
    TeamClusterDaemonSessionEndPayload,
    TeamClusterDaemonExposureSnapshotPayload,
    TeamClusterDaemonExposureUpsertPayload,
    TeamClusterDaemonExposureRemovePayload,
    TeamClusterDaemonTunnelOpenPayload,
    TeamClusterDaemonTunnelStatePayload,
    TeamClusterDaemonTunnelDataPayload,
    TeamClusterDaemonTunnelClosePayload,
    TeamClusterDaemonTunnelHeartbeatPayload,
    TeamClusterDaemonMessage
} from './contracts/reverseChannel';

export type {
    EnrollmentRequestBody,
    EnrollmentResponseData,
    EnrollmentApiResponse
} from './contracts/http';
