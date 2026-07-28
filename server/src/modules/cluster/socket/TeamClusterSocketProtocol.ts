import type { TeamCluster } from '@modules/cluster/contracts/domain/team-cluster';
import type { SystemMetrics } from '@modules/system/services/SystemMetrics';
import type { AnalysisStageStatus, AnalysisStageType } from '@shared/contracts/types';
import { TeamClusterDaemonResponseType } from '@shared/contracts/types/TeamClusterDaemon';
import {
    TeamClusterServiceExposureAccessMode,
    TeamClusterServiceExposureSourceKind,
    TeamClusterServiceExposureStatus,
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

export interface TeamClusterDaemonCommandMessage {
    type: 'command';
    requestId: string;
    command: string;
    responseType?: TeamClusterDaemonResponseType;
    payload?: Record<string, unknown>;
}

interface TeamClusterDaemonCommandBinaryMessage {
    type: 'command-binary';
    requestId: string;
    command: string;
    envelope: Uint8Array;
}

export interface TeamClusterDaemonSocketResponsePayload<T = unknown> {
    type: 'response';
    requestId: string;
    ok: boolean;
    status: number;
    data?: T;
    headers?: TeamClusterDaemonSocketHeaders;
    message?: string;
    streamId?: string;
}

interface TeamClusterDaemonSocketBinaryResponsePayload {
    type: 'response-binary';
    requestId: string;
    ok: boolean;
    status: number;
    envelope: Uint8Array;
    headers?: TeamClusterDaemonSocketHeaders;
    message?: string;
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
    accessMode: TeamClusterServiceExposure['accessModes'][number];
}

interface TeamClusterDaemonDirectTunnelOpenPayload {
    type: 'tunnel-open';
    sessionId: string;
    targetHost: string;
    targetPort: number;
    accessMode: TeamClusterServiceExposure['accessModes'][number];
}

type TeamClusterDaemonTunnelOpenPayload =
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

export interface TeamClusterDaemonRuntimeProgressPayload {
    type: 'runtime-progress';
    action: string;
    stage: string;
    timestamp: string;
    payload?: Record<string, unknown>;
}

interface TeamClusterDaemonAnalysisJobCompletionEventPayload {
    type: 'analysis-job-completion';
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    name: string;
    analysisId: string;
    teamId: string;
    trajectoryId?: string;
    timestep?: number;
    success: boolean;
    error?: string;
}

interface TeamClusterDaemonAnalysisJobStatusEventPayload {
    type: 'analysis-job-status';
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    name: string;
    analysisId: string;
    teamId: string;
    trajectoryId?: string;
    timestep?: number;
    status: 'running' | 'completed' | 'failed';
    error?: string;
}

interface TeamClusterDaemonAnalysisStageStatusEventPayload {
    type: 'analysis-stage-status';
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    name: string;
    analysisId: string;
    teamId: string;
    trajectoryId?: string;
    timestep?: number;
    stageKey: string;
    label: string;
    stageType: AnalysisStageType;
    stageStatus: AnalysisStageStatus;
    pluginId?: string;
    pluginDisplayName?: string;
    nodeId?: string;
    exposureId?: string;
    configHash?: string;
    cacheHit?: boolean;
    detail?: string;
    startedAt?: string;
    finishedAt?: string;
    durationMs?: number;
}

interface TeamClusterDaemonRasterJobStatusEventPayload {
    type: 'trajectory-raster-job-status';
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    timestep?: number;
    status: 'running' | 'completed' | 'failed';
    error?: string;
}

interface TeamClusterDaemonGlbJobStatusEventPayload {
    type: 'trajectory-glb-job-status';
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    timestep?: number;
    status: 'running' | 'completed' | 'failed';
    error?: string;
}

interface TeamClusterDaemonArtifactUploadJobStatusEventPayload {
    type: 'artifact-upload-job-status';
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    timestep?: number;
    status: 'queued' | 'running' | 'completed' | 'failed';
    error?: string;
}

interface TeamClusterDaemonRuntimeHeartbeatEventPayload {
    type: 'runtime-heartbeat';
    teamClusterId: string;
    daemonPassword: string;
    installedVersion?: string;
    runtime?: Record<string, unknown>;
    metrics?: Record<string, unknown>;
}

export const TEAM_CLUSTER_DAEMON_STREAM_ID = {
    AnalysisLogChunk: 'analysis-log-chunk',
    DebugLogChunk: 'debug-log-chunk',
    TrajectorySceneArtifactUpsertBatch: 'trajectory-scene-artifact-upsert-batch'
} as const;

type TeamClusterDaemonServerEventMessage =
    | TeamClusterDaemonAnalysisJobCompletionEventPayload
    | TeamClusterDaemonAnalysisJobStatusEventPayload
    | TeamClusterDaemonAnalysisStageStatusEventPayload
    | TeamClusterDaemonRasterJobStatusEventPayload
    | TeamClusterDaemonGlbJobStatusEventPayload
    | TeamClusterDaemonArtifactUploadJobStatusEventPayload
    | TeamClusterDaemonRuntimeHeartbeatEventPayload;

export type TeamClusterDaemonMessage =
    | TeamClusterDaemonCommandMessage
    | TeamClusterDaemonCommandBinaryMessage
    | TeamClusterDaemonSocketResponsePayload
    | TeamClusterDaemonSocketBinaryResponsePayload
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
    TeamClusterServiceExposureAccessMode,
    TeamClusterServiceExposureSourceKind,
    TeamClusterServiceExposureStatus
};

export type {
    TeamClusterServiceExposure,
    TeamClusterDaemonExecutionLogSegment
};

export {
    ChannelCommands,
    TEAM_CLUSTER_DAEMON_EVENT,
    TEAM_CLUSTER_EVENT
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

export interface TeamClusterClientMetrics extends SystemMetrics {
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
