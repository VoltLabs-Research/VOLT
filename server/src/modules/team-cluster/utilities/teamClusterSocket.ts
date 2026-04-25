import {
    TeamClusterServiceExposureAccessMode,
    TeamClusterServiceExposureSourceKind,
    TeamClusterServiceExposureStatus,
    type TeamClusterServiceExposure
} from '@modules/team-cluster/domain/contracts/TeamClusterServiceExposure';
import {
    ChannelCommands,
    TEAM_CLUSTER_DAEMON_EVENT,
    TEAM_CLUSTER_EVENT
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

export interface TeamClusterDaemonSessionAttachPayload {
    sessionId: string;
    kind: TeamClusterDaemonSessionKind;
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

/**
 * Binary command carrier. `envelope` is a `Uint8Array` laid out as
 * `[u32 opId][u16 kind][u32 len][payload...]` (see
 * `@shared/infrastructure/types/reverseChannelBinary`). Socket.IO v4
 * serializes typed-array fields as native binary attachments — no base64.
 */
interface TeamClusterDaemonCommandBinaryMessage {
    type: 'command-binary';
    requestId: string;
    command: string;
    envelope: Uint8Array;
};

export interface TeamClusterDaemonSocketResponsePayload<T = unknown> {
    type: 'response';
    requestId: string;
    ok: boolean;
    status: number;
    data?: T;
    headers?: TeamClusterDaemonSocketHeaders;
    message?: string;
    streamId?: string;
};

/**
 * Binary response carrier. `envelope` holds the structured binary result
 * (mask, Float32 values, etc.). When `ok === false`, the envelope uses kind
 * `Error` with a UTF-8 JSON blob `{code, message}` as payload.
 */
interface TeamClusterDaemonSocketBinaryResponsePayload {
    type: 'response-binary';
    requestId: string;
    ok: boolean;
    status: number;
    envelope: Uint8Array;
    headers?: TeamClusterDaemonSocketHeaders;
    message?: string;
};

export interface TeamClusterDaemonSocketStreamPayload {
    type: 'stream';
    requestId: string;
    streamId: string;
    chunk: Uint8Array;
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
    chunk: Uint8Array;
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
    chunk: Uint8Array;
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
interface TeamClusterDaemonExposureUpsertPayload {
    type: 'exposure-upsert';
    exposures: TeamClusterServiceExposure[];
};

/**
 * Removes exposures that are no longer published by the daemon.
 */
interface TeamClusterDaemonExposureRemovePayload {
    type: 'exposure-remove';
    exposureIds: string[];
};

interface TeamClusterDaemonExposureTunnelOpenPayload {
    type: 'tunnel-open';
    sessionId: string;
    exposureId: string;
    accessMode: TeamClusterServiceExposure['accessModes'][number];
};

interface TeamClusterDaemonDirectTunnelOpenPayload {
    type: 'tunnel-open';
    sessionId: string;
    targetHost: string;
    targetPort: number;
    accessMode: TeamClusterServiceExposure['accessModes'][number];
};

type TeamClusterDaemonTunnelOpenPayload =
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
 * `chunk` travels as a native Socket.IO binary attachment — no base64.
 */
export interface TeamClusterDaemonTunnelDataPayload {
    type: 'tunnel-data';
    sessionId: string;
    chunk: Uint8Array;
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

export interface TeamClusterDaemonRuntimeProgressPayload {
    type: 'runtime-progress';
    action: string;
    stage: string;
    timestamp: string;
    payload?: Record<string, unknown>;
};

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
};

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
};

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
};

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
};

interface TeamClusterDaemonSshImportJobStatusEventPayload {
    type: 'ssh-import-job-status';
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    status: 'running' | 'completed' | 'failed';
    error?: string;
};

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

interface TeamClusterDaemonAnalysisLogChunkEventPayload {
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

interface TeamClusterDaemonDebugLogChunkEventPayload {
    type: 'debug-log-chunk';
    teamClusterId: string;
    daemonPassword: string;
    sessionId: string;
    nodeId: string;
    segments: TeamClusterDaemonExecutionLogSegment[];
};

interface TeamClusterDaemonSceneArtifactUpsertBatchItem {
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

interface TeamClusterDaemonSceneArtifactUpsertBatchEventPayload {
    type: 'trajectory-scene-artifact-upsert-batch';
    teamClusterId: string;
    daemonPassword: string;
    items: TeamClusterDaemonSceneArtifactUpsertBatchItem[];
};

type TeamClusterDaemonServerEventMessage =
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
    | TeamClusterDaemonTunnelClosePayload
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
