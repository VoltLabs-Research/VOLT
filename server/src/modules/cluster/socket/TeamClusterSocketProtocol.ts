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
import type { SceneArtifactParams } from '@volt/contracts/modules/trajectory/domain';
import type {
    SceneArtifactSourceType,
    SceneArtifactStatus
} from '@shared/contracts/types/SceneArtifact';
import {
    TeamClusterServiceExposureAccessMode,
    type TeamClusterDaemonExecutionLogSegment,
    type TeamClusterServiceExposure
} from '@shared/contracts/types/TeamClusterExposure';
import type { TeamClusterRuntimeRoleConfigProps } from '@shared/contracts/types/TeamCluster';
import type { TeamClusterStatus } from '@volt/contracts/modules/cluster/domain';
import {
    ChannelCommands,
    TEAM_CLUSTER_DAEMON_EVENT,
    TEAM_CLUSTER_EVENT
} from '@shared/contracts/types/team-cluster-daemon-channel';
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

export type TeamClusterHeartbeatMetricsInput = TeamClusterDaemonHeartbeatMetrics;

export interface ClusterRuntimeHeartbeatCommand extends TeamClusterDaemonHeartbeatCommand {
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

export interface TeamClusterDaemonRuntimeProgressPayload extends Omit<SdkRuntimeProgressPayload, 'payload'> {
    payload?: TeamClusterDaemonContainerCreateProgress;
}

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
