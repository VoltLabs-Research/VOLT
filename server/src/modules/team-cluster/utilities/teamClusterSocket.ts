import {
    TeamClusterServiceExposureAccessMode,
    TeamClusterServiceExposureSourceKind,
    TeamClusterServiceExposureStatus,
    type TeamClusterServiceExposure
} from '@modules/team-cluster/domain/contracts/TeamClusterServiceExposure';
import {
    TEAM_CLUSTER_DAEMON_COMMAND,
    TEAM_CLUSTER_DAEMON_EVENT,
    TEAM_CLUSTER_EVENT,
    TEAM_CLUSTER_RUNTIME_CONTRACT_VERSION,
    TEAM_CLUSTER_REMOTE_EXPLORER_COMMAND
} from '@shared/infrastructure/contracts/team-cluster';

export enum TeamClusterDaemonResponseType {
    Json = 'json',
    Buffer = 'buffer',
    Stream = 'stream'
};

export enum TeamClusterDaemonSessionKind {
    Terminal = 'terminal',
    Tunnel = 'tunnel',
    WebSocket = 'websocket'
};

export enum TeamClusterDaemonTerminalTarget {
    Container = 'container',
    Host = 'host'
};

export enum TeamClusterTunnelSessionStatus {
    Opening = 'opening',
    Open = 'open',
    Closed = 'closed'
};

export interface TeamClusterDaemonSocketHeaders {
    [key: string]: string;
};

export interface TeamClusterDaemonRegisterPayload {
    teamClusterId: string;
    daemonPassword: string;
};

export interface TeamClusterDaemonRegisteredPayload {
    teamClusterId: string;
};

export interface TeamClusterDaemonSessionAttachPayload {
    sessionId: string;
    kind: TeamClusterDaemonSessionKind;
    terminalTarget?: TeamClusterDaemonTerminalTarget;
    containerId?: string;
    targetUrl?: string;
    protocols?: string[];
};

export interface TeamClusterDaemonCommandMessage {
    type: 'command';
    requestId: string;
    command: string;
    responseType?: TeamClusterDaemonResponseType;
    payload?: Record<string, unknown>;
};

export interface TeamClusterDaemonSocketResponsePayload<T = unknown> {
    type: 'response';
    requestId: string;
    ok: boolean;
    status: number;
    data?: T;
    bodyBase64?: string;
    headers?: TeamClusterDaemonSocketHeaders;
    message?: string;
    streamId?: string;
};

export interface TeamClusterDaemonSocketStreamPayload {
    type: 'stream';
    requestId: string;
    streamId: string;
    chunkBase64: string;
};

export interface TeamClusterDaemonSocketStreamStatePayload {
    type: 'stream-end';
    requestId: string;
    streamId: string;
    message?: string;
};

export interface TeamClusterDaemonSessionInputPayload {
    type: 'session-input';
    sessionId: string;
    chunkBase64: string;
    isBinary: boolean;
};

export interface TeamClusterDaemonSessionResizePayload {
    type: 'session-resize';
    sessionId: string;
    rows: number;
    cols: number;
};

export interface TeamClusterDaemonSessionDetachPayload {
    type: 'session-detach';
    sessionId: string;
};

export interface TeamClusterDaemonSessionDataPayload {
    type: 'session-data';
    sessionId: string;
    chunkBase64: string;
    isBinary: boolean;
};

export interface TeamClusterDaemonSessionEndPayload {
    type: 'session-end';
    sessionId: string;
    code?: number;
    message?: string;
    error?: string;
};

/**
 * Replaces the full exposure registry stored in volt/server for a connected team cluster.
 */
export interface TeamClusterDaemonExposureSnapshotPayload {
    type: 'exposure-snapshot';
    exposures: TeamClusterServiceExposure[];
};

/**
 * Applies additive exposure changes without replacing the full registry.
 */
export interface TeamClusterDaemonExposureUpsertPayload {
    type: 'exposure-upsert';
    exposures: TeamClusterServiceExposure[];
};

/**
 * Removes exposures that are no longer published by the daemon.
 */
export interface TeamClusterDaemonExposureRemovePayload {
    type: 'exposure-remove';
    exposureIds: string[];
};

/**
 * Opens a generic tunnel session against a persistent exposure or direct target.
 */
export interface TeamClusterDaemonBinaryRelayDescriptor {
    relaySessionId: string;
    relayUrl: string;
    relayToken: string;
    relayProtocolVersion: 1;
};

export interface TeamClusterDaemonExposureTunnelOpenPayload {
    type: 'tunnel-open';
    sessionId: string;
    exposureId: string;
    accessMode: TeamClusterServiceExposure['accessModes'][number];
    relay?: TeamClusterDaemonBinaryRelayDescriptor;
};

export interface TeamClusterDaemonDirectTunnelOpenPayload {
    type: 'tunnel-open';
    sessionId: string;
    targetHost: string;
    targetPort: number;
    accessMode: TeamClusterServiceExposure['accessModes'][number];
    relay?: TeamClusterDaemonBinaryRelayDescriptor;
};

export type TeamClusterDaemonTunnelOpenPayload =
    | TeamClusterDaemonExposureTunnelOpenPayload
    | TeamClusterDaemonDirectTunnelOpenPayload;

/**
 * Acknowledges the final state of a tunnel session transition.
 */
export interface TeamClusterDaemonTunnelStatePayload {
    type: 'tunnel-state';
    sessionId: string;
    status: TeamClusterTunnelSessionStatus;
    message?: string;
    error?: string;
};

/**
 * Carries raw tunnel bytes for HTTP, WebSocket or arbitrary TCP sessions.
 */
export interface TeamClusterDaemonTunnelDataPayload {
    type: 'tunnel-data';
    sessionId: string;
    chunkBase64: string;
    isBinary: boolean;
};

/**
 * Closes a generic tunnel session on either side of the reverse channel.
 */
export interface TeamClusterDaemonTunnelClosePayload {
    type: 'tunnel-close';
    sessionId: string;
    code?: number;
    message?: string;
};

/**
 * Keeps long-lived tunnel sessions observable without transferring business data.
 */
export interface TeamClusterDaemonTunnelHeartbeatPayload {
    type: 'tunnel-heartbeat';
    sessionId: string;
    occurredAt: string;
};

export interface TeamClusterDaemonRuntimeProgressPayload {
    type: 'runtime-progress';
    action: string;
    stage: string;
    timestamp: string;
    payload?: Record<string, unknown>;
};

export interface TeamClusterDaemonAnalysisJobCompletionEventPayload {
    type: 'analysis-job-completion';
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    name: string;
    analysisId: string;
    teamId: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
    success: boolean;
    error?: string;
};

export interface TeamClusterDaemonAnalysisJobStatusEventPayload {
    type: 'analysis-job-status';
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    name: string;
    analysisId: string;
    teamId: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
    status: 'running' | 'completed' | 'failed';
    error?: string;
};

export interface TeamClusterDaemonRasterJobStatusEventPayload {
    type: 'trajectory-raster-job-status';
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep?: number;
    status: 'running' | 'completed' | 'failed';
    error?: string;
};

export interface TeamClusterDaemonGlbJobStatusEventPayload {
    type: 'trajectory-glb-job-status';
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep?: number;
    status: 'running' | 'completed' | 'failed';
    error?: string;
};

export interface TeamClusterDaemonSshImportJobStatusEventPayload {
    type: 'ssh-import-job-status';
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    status: 'running' | 'completed' | 'failed';
    error?: string;
};

export interface TeamClusterDaemonArtifactUploadJobStatusEventPayload {
    type: 'artifact-upload-job-status';
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep?: number;
    status: 'queued' | 'running' | 'completed' | 'failed';
    error?: string;
};

export interface TeamClusterDaemonExecutionLogSegment {
    stream: 'stdout' | 'stderr' | 'system';
    text: string;
    occurredAt: string;
    nodeId?: string;
    nodeType?: string;
    nodeLabel?: string;
    pluginId?: string;
    executionPath?: string[];
};

export interface TeamClusterDaemonAnalysisLogChunkEventPayload {
    type: 'analysis-log-chunk';
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    timestep: number;
    segments: TeamClusterDaemonExecutionLogSegment[];
};

export interface TeamClusterDaemonDebugLogChunkEventPayload {
    type: 'debug-log-chunk';
    teamClusterId: string;
    daemonPassword: string;
    sessionId: string;
    nodeId: string;
    segments: TeamClusterDaemonExecutionLogSegment[];
};

export interface TeamClusterDaemonSceneArtifactUpsertBatchItem {
    trajectory: string;
    storageClusterId: string;
    analysis?: string;
    plugin?: string;
    sourceType: 'color-coding' | 'particle-filter' | 'plugin-exposure';
    timestep: number;
    objectName: string;
    storageBucket: string;
    params: Record<string, unknown>;
    displayName: string;
    status: 'ready' | 'failed';
    metadata?: Record<string, unknown>;
};

export interface TeamClusterDaemonSceneArtifactUpsertBatchEventPayload {
    type: 'trajectory-scene-artifact-upsert-batch';
    teamClusterId: string;
    daemonPassword: string;
    items: TeamClusterDaemonSceneArtifactUpsertBatchItem[];
};

export type TeamClusterDaemonServerEventMessage =
    | TeamClusterDaemonAnalysisJobCompletionEventPayload
    | TeamClusterDaemonAnalysisJobStatusEventPayload
    | TeamClusterDaemonAnalysisLogChunkEventPayload
    | TeamClusterDaemonDebugLogChunkEventPayload
    | TeamClusterDaemonRasterJobStatusEventPayload
    | TeamClusterDaemonGlbJobStatusEventPayload
    | TeamClusterDaemonSshImportJobStatusEventPayload
    | TeamClusterDaemonArtifactUploadJobStatusEventPayload
    | TeamClusterDaemonSceneArtifactUpsertBatchEventPayload;

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
    | TeamClusterDaemonTunnelClosePayload
    | TeamClusterDaemonTunnelHeartbeatPayload
    | TeamClusterDaemonRuntimeProgressPayload
    | TeamClusterDaemonServerEventMessage;

export {
    TeamClusterServiceExposureAccessMode,
    TeamClusterServiceExposureSourceKind,
    TeamClusterServiceExposureStatus
};

export type {
    TeamClusterServiceExposure
};

export {
    TEAM_CLUSTER_DAEMON_COMMAND,
    TEAM_CLUSTER_DAEMON_EVENT,
    TEAM_CLUSTER_EVENT,
    TEAM_CLUSTER_RUNTIME_CONTRACT_VERSION,
    TEAM_CLUSTER_REMOTE_EXPLORER_COMMAND
};

export const TEAM_CLUSTER_LIFECYCLE_EVENT = TEAM_CLUSTER_EVENT.lifecycleUpdated;
export const TEAM_CLUSTER_SUBSCRIPTION_EVENT = 'subscribe_to_team_cluster';
export const TEAM_CLUSTER_DAEMON_REGISTER_EVENT = TEAM_CLUSTER_DAEMON_EVENT.register;
export const TEAM_CLUSTER_DAEMON_REGISTERED_EVENT = TEAM_CLUSTER_DAEMON_EVENT.registered;
export const TEAM_CLUSTER_DAEMON_MESSAGE_EVENT = TEAM_CLUSTER_DAEMON_EVENT.message;

export const getTeamClusterRoom = (teamClusterId: string): string => {
    return `team-cluster:${teamClusterId}`;
};
