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
import { TeamClusterDaemonResponseType } from '@shared/contracts/types/TeamClusterDaemon';
import type {
    TeamClusterRuntimeRoleConfigProps,
    TeamClusterStatus
} from '@shared/contracts/types/TeamCluster';
import {
    TeamClusterServiceExposureAccessMode,
    type TeamClusterDaemonExecutionLogSegment,
    type TeamClusterServiceExposure
} from '@shared/contracts/types/TeamClusterExposure';
import {
    ChannelCommands,
    TEAM_CLUSTER_DAEMON_EVENT,
    TEAM_CLUSTER_EVENT
} from '@shared/infrastructure/contracts/team-cluster';

export interface TeamClusterHeartbeatMetricsInput {
    timestamp: string;
    hostname: string;
    uptimeSeconds: number;
    cpuUsagePercent: number;
    cpuLoadAverage: number[];
    cpuPerCoreUsagePercent: number[];
    memory: {
        totalBytes: number;
        freeBytes: number;
        usedBytes: number;
        usagePercent: number;
    };
    disk: {
        totalBytes: number;
        freeBytes: number;
        usedBytes: number;
        usagePercent: number;
    };
    diskOperations: {
        readMegabytesPerSecond: number;
        writeMegabytesPerSecond: number;
        readIOPS: number;
        writeIOPS: number;
        totalIOPS: number;
    };
    network: {
        incomingKilobytesPerSecond: number;
        outgoingKilobytesPerSecond: number;
        totalKilobytesPerSecond: number;
        receivedBytes: number;
        sentBytes: number;
    };
    cloudLatencyMs: number | null;
    connectedToCloud: boolean;
}

export { TeamClusterDaemonResponseType };

export enum TeamClusterDaemonSessionKind {
    Terminal = 'terminal',
    Tunnel = 'tunnel',
    WebSocket = 'websocket'
}

export enum TeamClusterTunnelSessionStatus {
    Opening = 'opening',
    Open = 'open',
    Closed = 'closed'
}

export interface TeamClusterDaemonSocketHeaders {
    [key: string]: string;
}

export const TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL = {
    Heartbeat: 'heartbeat',
    Control: 'control',
    ObjectGateway: 'object-gateway',
    Events: 'events'
} as const;

export type TeamClusterDaemonSocketChannel =
    typeof TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL[keyof typeof TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL];

export interface TeamClusterDaemonRegisterPayload {
    teamClusterId: string;
    daemonPassword: string;
    channel?: TeamClusterDaemonSocketChannel;
}

export interface TeamClusterDaemonSessionAttachPayload {
    sessionId: string;
    kind: TeamClusterDaemonSessionKind;
    containerId?: string;
    targetUrl?: string;
    protocols?: string[];
}

export interface TeamClusterDaemonSessionAttachResult {
    attached: boolean;
    selectedProtocol?: string;
}

/**
 * Commands travel in both directions: the control plane issues them to a daemon,
 * and a daemon issues the runtime.* commands below back to the control plane.
 */
export interface TeamClusterDaemonCommandMessage {
    type: 'command';
    requestId: string;
    command: string;
    responseType?: TeamClusterDaemonResponseType;
    payload?: unknown;
}

/**
 * Every JSON reply on the reverse channel is wrapped by @voltstack/daemon-cluster-client,
 * so `data` is the envelope and the handler result sits one level in. The handler
 * result itself may be an error report, which is why it is a declared union member.
 */
export interface TeamClusterDaemonSuccessEnvelope<T> {
    status: 'success';
    data: T;
}

export interface TeamClusterDaemonErrorResult {
    status: 'error';
    code: string;
    message: string;
}

export interface TeamClusterDaemonSocketResponsePayload<T = unknown> {
    type: 'response';
    requestId: string;
    ok: boolean;
    status: number;
    data?: TeamClusterDaemonSuccessEnvelope<T | TeamClusterDaemonErrorResult>;
    headers?: TeamClusterDaemonSocketHeaders;
    message?: string;
    streamId?: string;
}

export interface TeamClusterDaemonSocketStreamPayload {
    type: 'stream';
    requestId: string;
    streamId: string;
    chunk: Uint8Array;
}

export interface TeamClusterDaemonSocketStreamStatePayload {
    type: 'stream-end';
    requestId: string;
    streamId: string;
    message?: string;
}

export interface TeamClusterDaemonSessionInputPayload {
    type: 'session-input';
    sessionId: string;
    chunk: Uint8Array;
    isBinary: boolean;
}

export interface TeamClusterDaemonSessionResizePayload {
    type: 'session-resize';
    sessionId: string;
    rows: number;
    cols: number;
}

export interface TeamClusterDaemonSessionDetachPayload {
    type: 'session-detach';
    sessionId: string;
}

export interface TeamClusterDaemonSessionDataPayload {
    type: 'session-data';
    sessionId: string;
    chunk: Uint8Array;
    isBinary: boolean;
}

export interface TeamClusterDaemonSessionEndPayload {
    type: 'session-end';
    sessionId: string;
    code?: number;
    message?: string;
    error?: string;
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

interface TeamClusterDaemonExposureTunnelOpenPayload {
    type: 'tunnel-open';
    sessionId: string;
    exposureId: string;
    accessMode: TeamClusterServiceExposureAccessMode;
}

interface TeamClusterDaemonDirectTunnelOpenPayload {
    type: 'tunnel-open';
    sessionId: string;
    targetHost: string;
    targetPort: number;
    accessMode: TeamClusterServiceExposureAccessMode;
}

export type TeamClusterDaemonTunnelOpenPayload =
    | TeamClusterDaemonExposureTunnelOpenPayload
    | TeamClusterDaemonDirectTunnelOpenPayload;

export interface TeamClusterDaemonTunnelStatePayload {
    type: 'tunnel-state';
    sessionId: string;
    status: TeamClusterTunnelSessionStatus;
    message?: string;
    error?: string;
}

export interface TeamClusterDaemonTunnelDataPayload {
    type: 'tunnel-data';
    sessionId: string;
    chunk: Uint8Array;
    isBinary: boolean;
    sequence?: number;
    requiresAck?: boolean;
}

export interface TeamClusterDaemonTunnelDrainPayload {
    type: 'tunnel-drain';
    sessionId: string;
    sequence: number;
}

export interface TeamClusterDaemonTunnelClosePayload {
    type: 'tunnel-close';
    sessionId: string;
    code?: number;
    message?: string;
}

export interface TeamClusterDaemonContainerCreateProgress {
    operationId: string;
    step?: string;
    image?: string;
    containerName?: string;
    containerId?: string;
}

export interface TeamClusterDaemonRuntimeProgressPayload {
    type: 'runtime-progress';
    action: string;
    stage: string;
    timestamp: string;
    payload?: TeamClusterDaemonContainerCreateProgress;
}

/** Lifecycle commands a daemon invokes on the control plane. */
export interface ClusterRuntimeHeartbeatCommand {
    teamClusterId: string;
    daemonPassword: string;
    installedVersion?: string;
    runtime?: { roleConfig: TeamClusterRuntimeRoleConfigProps };
    metrics?: TeamClusterHeartbeatMetricsInput;
}

export interface ClusterRuntimeLifecycleCommand {
    teamClusterId: string;
    daemonPassword: string;
    status: TeamClusterStatus;
    installedVersion?: string;
}

export interface ClusterRuntimeDeleteCompletedCommand {
    teamClusterId: string;
    daemonPassword: string;
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
    | TeamClusterDaemonExposureUpsertPayload
    | TeamClusterDaemonExposureRemovePayload
    | TeamClusterDaemonTunnelOpenPayload
    | TeamClusterDaemonTunnelStatePayload
    | TeamClusterDaemonTunnelDataPayload
    | TeamClusterDaemonTunnelDrainPayload
    | TeamClusterDaemonTunnelClosePayload
    | TeamClusterDaemonRuntimeProgressPayload
    | TeamClusterDaemonServerEventMessage;

export {
    TeamClusterServiceExposureAccessMode
};

export type {
    TeamClusterServiceExposure,
    TeamClusterDaemonExecutionLogSegment
};

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
