import type { TeamCluster } from '@modules/cluster/contracts/team-cluster';
import type { SystemMetrics } from '@modules/system/services/SystemMetrics';
import type {
    ProcessDaemonAnalysisJobCompletionInput,
    ProcessDaemonAnalysisJobStatusInput,
    ProcessDaemonAnalysisStageStatusInput,
    ProcessDaemonArtifactUploadJobStatusInput,
    ProcessDaemonGlbJobStatusInput,
    ProcessDaemonRasterJobStatusInput
} from '@modules/cluster/contracts/daemon-job-completion';
import type {
    SceneArtifactParams,
    SceneArtifactSourceType,
    SceneArtifactStatus
} from '@shared/contracts/types';
import {
    TeamClusterServiceExposureAccessMode,
    type TeamClusterDaemonExecutionLogSegment,
    type TeamClusterServiceExposure
} from '@shared/contracts/types/TeamClusterExposure';
import type {
    TeamClusterRuntimeRoleConfigProps,
    TeamClusterStatus
} from '@shared/contracts/types/TeamCluster';
import {
    ChannelCommands,
    TEAM_CLUSTER_DAEMON_EVENT,
    TEAM_CLUSTER_EVENT
} from '@shared/infrastructure/contracts/team-cluster';
import {
    REVERSE_CHANNEL,
    TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL,
    type TeamClusterDaemonCommandMessage,
    type TeamClusterDaemonContainerCreateProgress,
    type TeamClusterDaemonDeleteCompletedCommand,
    type TeamClusterDaemonErrorResult,
    type TeamClusterDaemonExposureRemovePayload as SdkExposureRemovePayload,
    type TeamClusterDaemonExposureSnapshotPayload as SdkExposureSnapshotPayload,
    type TeamClusterDaemonExposureUpsertPayload as SdkExposureUpsertPayload,
    type TeamClusterDaemonHeartbeatCommand,
    type TeamClusterDaemonHeartbeatMetrics,
    type TeamClusterDaemonMessage as SdkTeamClusterDaemonMessage,
    type TeamClusterDaemonRegisterPayload,
    type TeamClusterDaemonResponseType as SdkResponseType,
    type TeamClusterDaemonRuntimeProgressPayload as SdkRuntimeProgressPayload,
    type TeamClusterDaemonSessionAttachPayload,
    type TeamClusterDaemonSessionAttachResult,
    type TeamClusterDaemonSessionDataPayload,
    type TeamClusterDaemonSessionDetachPayload,
    type TeamClusterDaemonSessionEndPayload,
    type TeamClusterDaemonSessionInputPayload,
    type TeamClusterDaemonSessionKind as SdkSessionKind,
    type TeamClusterDaemonSessionResizePayload,
    type TeamClusterDaemonSocketChannel,
    type TeamClusterDaemonSocketHeaders,
    type TeamClusterDaemonSocketResponsePayload,
    type TeamClusterDaemonSocketStreamPayload,
    type TeamClusterDaemonSocketStreamStatePayload,
    type TeamClusterDaemonSuccessEnvelope,
    type TeamClusterDaemonTunnelClosePayload,
    type TeamClusterDaemonTunnelDataPayload,
    type TeamClusterDaemonTunnelDrainPayload,
    type TeamClusterDaemonTunnelOpenPayload,
    type TeamClusterDaemonTunnelStatePayload,
    type TeamClusterTunnelSessionStatus as SdkTunnelSessionStatus
} from '@voltstack/daemon-cluster-client';

/**
 * The reverse-channel transport contract is owned by `@voltstack/daemon-cluster-client`
 * (sdk/node/DaemonClusterClient); the server compiles it from source through the
 * `@voltstack/daemon-cluster-client` tsconfig path, the same way it consumes
 * `@volt/contracts`. This file re-exports those transport types under their
 * historical names and layers the server-specific, domain-typed frames on top.
 */
export { TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL };
export type {
    TeamClusterDaemonCommandMessage,
    TeamClusterDaemonContainerCreateProgress,
    TeamClusterDaemonErrorResult,
    TeamClusterDaemonRegisterPayload,
    TeamClusterDaemonSessionAttachPayload,
    TeamClusterDaemonSessionAttachResult,
    TeamClusterDaemonSessionDataPayload,
    TeamClusterDaemonSessionDetachPayload,
    TeamClusterDaemonSessionEndPayload,
    TeamClusterDaemonSessionInputPayload,
    TeamClusterDaemonSessionResizePayload,
    TeamClusterDaemonSocketChannel,
    TeamClusterDaemonSocketHeaders,
    TeamClusterDaemonSocketResponsePayload,
    TeamClusterDaemonSocketStreamPayload,
    TeamClusterDaemonSocketStreamStatePayload,
    TeamClusterDaemonSuccessEnvelope,
    TeamClusterDaemonTunnelClosePayload,
    TeamClusterDaemonTunnelDataPayload,
    TeamClusterDaemonTunnelDrainPayload,
    TeamClusterDaemonTunnelOpenPayload,
    TeamClusterDaemonTunnelStatePayload
};

export const TeamClusterDaemonResponseType = REVERSE_CHANNEL.ResponseType;
export type TeamClusterDaemonResponseType = SdkResponseType;

export const TeamClusterDaemonSessionKind = REVERSE_CHANNEL.SessionKind;
export type TeamClusterDaemonSessionKind = SdkSessionKind;

export const TeamClusterTunnelSessionStatus = REVERSE_CHANNEL.TunnelSessionStatus;
export type TeamClusterTunnelSessionStatus = SdkTunnelSessionStatus;

/** Heartbeat metrics are the SDK wire contract, re-exported under the historical input name. */
export type TeamClusterHeartbeatMetricsInput = TeamClusterDaemonHeartbeatMetrics;

/** Lifecycle commands a daemon invokes on the control plane. */
export interface ClusterRuntimeHeartbeatCommand extends TeamClusterDaemonHeartbeatCommand {
    /* The server persists role config with `Date`, narrower than the wire's ISO string. */
    runtime?: {
        roleConfig: TeamClusterRuntimeRoleConfigProps;
    };
}

export interface ClusterRuntimeLifecycleCommand {
    teamClusterId: string;
    daemonPassword: string;
    status: TeamClusterStatus;
    installedVersion?: string;
}

export type ClusterRuntimeDeleteCompletedCommand = TeamClusterDaemonDeleteCompletedCommand;

/**
 * The server narrows the generic `runtime-progress` payload to the container-create
 * shape it actually handles; the daemon is free to carry other payloads (e.g. trace
 * context) which this handler ignores.
 */
export interface TeamClusterDaemonRuntimeProgressPayload extends Omit<SdkRuntimeProgressPayload, 'payload'> {
    payload?: TeamClusterDaemonContainerCreateProgress;
}

/**
 * Exposure frames are typed with the server's `TeamClusterServiceExposure` rather
 * than the SDK's `unknown[]`, so these local declarations stand in for the SDK's.
 */
export interface TeamClusterDaemonExposureSnapshotPayload {
    type: 'exposure-snapshot';
    exposures: TeamClusterServiceExposure[];
}

interface TeamClusterDaemonExposureUpsertPayload {
    type: 'exposure-upsert';
    exposures: TeamClusterServiceExposure[];
}

interface TeamClusterDaemonExposureRemovePayload {
    type: 'exposure-remove';
    exposureIds: string[];
}

export interface TeamClusterDaemonAnalysisProvenanceEvent {
    type: 'analysis-provenance';
    teamClusterId: string;
    daemonPassword: string;
    pluginName: string;
    pluginVersion: string;
    parameters: Record<string, unknown>;
    inputFrameContentHash: string;
    atomCount: number;
    frameIndex: number;
    trajectoryId: string;
    analysisId: string;
    teamId: string;
    coreToolkitVersion: string;
    rngSeed?: number;
    executedAt: string;
    executedBy: string;
    executionTimeMs: number;
    outputArtifactIds: string[];
}

export const TEAM_CLUSTER_DAEMON_STREAM_ID = {
    AnalysisLogChunk: 'analysis-log-chunk',
    DebugLogChunk: 'debug-log-chunk',
    TrajectorySceneArtifactUpsertBatch: 'trajectory-scene-artifact-upsert-batch'
} as const;

/** Frames the daemon pushes as an inbound stream body rather than as a socket event. */
export interface TeamClusterDaemonAnalysisLogChunkStream {
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    timestep: number;
    segments: TeamClusterDaemonExecutionLogSegment[];
}

export interface TeamClusterDaemonDebugLogChunkStream {
    teamClusterId: string;
    daemonPassword: string;
    sessionId: string;
    nodeId: string;
    segments: TeamClusterDaemonExecutionLogSegment[];
}

export interface TeamClusterDaemonSceneArtifactUpsertItem {
    trajectory: string;
    storageClusterId: string;
    analysis?: string;
    plugin?: string;
    sourceType: SceneArtifactSourceType;
    timestep: number;
    objectName: string;
    storageBucket: string;
    params: SceneArtifactParams;
    displayName: string;
    status: SceneArtifactStatus;
    metadata?: Record<string, unknown>;
}

export interface TeamClusterDaemonSceneArtifactUpsertBatchStream {
    teamClusterId: string;
    daemonPassword: string;
    items: TeamClusterDaemonSceneArtifactUpsertItem[];
}

export type TeamClusterDaemonServerEventMessage =
    | ProcessDaemonAnalysisJobCompletionInput
    | ProcessDaemonAnalysisJobStatusInput
    | ProcessDaemonAnalysisStageStatusInput
    | ProcessDaemonRasterJobStatusInput
    | ProcessDaemonGlbJobStatusInput
    | ProcessDaemonArtifactUploadJobStatusInput
    | TeamClusterDaemonAnalysisProvenanceEvent
    | (ClusterRuntimeHeartbeatCommand & { type: 'runtime-heartbeat' });

type SdkExposureFrames =
    | SdkExposureSnapshotPayload
    | SdkExposureUpsertPayload
    | SdkExposureRemovePayload;

/**
 * The full message union: the SDK transport frames (minus the `unknown[]`-typed
 * exposure frames and the generic runtime-progress frame), plus the server's
 * domain-typed stand-ins and the server-bound event messages.
 */
export type TeamClusterDaemonMessage =
    | Exclude<SdkTeamClusterDaemonMessage, SdkExposureFrames | SdkRuntimeProgressPayload>
    | TeamClusterDaemonExposureSnapshotPayload
    | TeamClusterDaemonExposureUpsertPayload
    | TeamClusterDaemonExposureRemovePayload
    | TeamClusterDaemonRuntimeProgressPayload
    | TeamClusterDaemonServerEventMessage;

export {
    ChannelCommands
};

export const TEAM_CLUSTER_LIFECYCLE_EVENT = TEAM_CLUSTER_EVENT.lifecycleUpdated;
export const TEAM_CLUSTER_SUBSCRIPTION_EVENT = 'subscribe_to_team_cluster';
export const TEAM_CLUSTER_DAEMON_REGISTER_EVENT = TEAM_CLUSTER_DAEMON_EVENT.register;
export const TEAM_CLUSTER_DAEMON_REGISTERED_EVENT = TEAM_CLUSTER_DAEMON_EVENT.registered;
export const TEAM_CLUSTER_DAEMON_MESSAGE_EVENT = TEAM_CLUSTER_DAEMON_EVENT.message;

export const getTeamClusterRoom = (teamClusterId: string): string => {
    return `team-cluster:${teamClusterId}`;
};

export const TEAM_CLUSTER_METRICS_ALL_EVENT = 'metrics:all';
export const TEAM_CLUSTER_METRICS_HISTORY_EVENT = 'metrics:history';

interface TeamClusterClientMetrics extends SystemMetrics {
    clusterId: string;
    teamClusterId: string;
    teamClusterName: string;
    teamClusterStatus: TeamCluster['props']['status'];
}

export const toTeamClusterClientMetrics = (
    teamCluster: TeamCluster,
    metrics: SystemMetrics
): TeamClusterClientMetrics => ({
    ...metrics,
    clusterId: teamCluster.id,
    teamClusterId: metrics.teamClusterId ?? teamCluster.id,
    teamClusterName: teamCluster.props.name,
    teamClusterStatus: teamCluster.props.status
});
