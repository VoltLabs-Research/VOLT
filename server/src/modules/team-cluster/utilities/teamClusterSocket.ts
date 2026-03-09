export enum TeamClusterDaemonResponseType {
    Json = 'json',
    Buffer = 'buffer',
    Stream = 'stream'
};

export interface TeamClusterDaemonSocketHeaders {
    [key: string]: string;
};

export interface TeamClusterDaemonSocketRequestPayload {
    requestId: string;
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    path: string;
    responseType: TeamClusterDaemonResponseType;
    headers?: TeamClusterDaemonSocketHeaders;
    targetUrl?: string;
    query?: Record<string, string | number | boolean | undefined>;
    body?: Record<string, unknown>;
};

export interface TeamClusterDaemonSocketResponsePayload<T = unknown> {
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
    requestId: string;
    streamId: string;
    chunkBase64: string;
};

export interface TeamClusterDaemonSocketStreamStatePayload {
    requestId: string;
    streamId: string;
    message?: string;
};

export interface TeamClusterDaemonRegisterPayload {
    teamClusterId: string;
    daemonPassword: string;
};

export interface TeamClusterDaemonRegisteredPayload {
    teamClusterId: string;
};

export interface TeamClusterDaemonTerminalAttachPayload {
    sessionId: string;
    containerId: string;
};

export interface TeamClusterDaemonTerminalInputPayload {
    sessionId: string;
    input: string;
};

export interface TeamClusterDaemonTerminalResizePayload {
    sessionId: string;
    rows: number;
    cols: number;
};

export interface TeamClusterDaemonTerminalDetachPayload {
    sessionId: string;
};

export interface TeamClusterDaemonTerminalDataPayload {
    sessionId: string;
    chunkBase64: string;
};

export interface TeamClusterDaemonTerminalStatePayload {
    sessionId: string;
    message?: string;
};

export interface TeamClusterDaemonWebSocketAttachPayload {
    sessionId: string;
    targetUrl: string;
};

export interface TeamClusterDaemonWebSocketDetachPayload {
    sessionId: string;
};

export interface TeamClusterDaemonWebSocketDataPayload {
    sessionId: string;
    chunkBase64: string;
    isBinary: boolean;
};

export interface TeamClusterDaemonWebSocketStatePayload {
    sessionId: string;
    code?: number;
    message?: string;
};

export const TEAM_CLUSTER_LIFECYCLE_EVENT = 'team-cluster.updated';
export const TEAM_CLUSTER_SUBSCRIPTION_EVENT = 'subscribe_to_team_cluster';
export const TEAM_CLUSTER_DAEMON_REGISTER_EVENT = 'team-cluster-daemon:register';
export const TEAM_CLUSTER_DAEMON_REGISTERED_EVENT = 'team-cluster-daemon:registered';
export const TEAM_CLUSTER_DAEMON_REQUEST_EVENT = 'team-cluster-daemon:request';
export const TEAM_CLUSTER_DAEMON_RESPONSE_EVENT = 'team-cluster-daemon:response';
export const TEAM_CLUSTER_DAEMON_STREAM_EVENT = 'team-cluster-daemon:stream.event';
export const TEAM_CLUSTER_DAEMON_STREAM_END_EVENT = 'team-cluster-daemon:stream.end';
export const TEAM_CLUSTER_DAEMON_STREAM_ERROR_EVENT = 'team-cluster-daemon:stream.error';
export const TEAM_CLUSTER_DAEMON_TERMINAL_ATTACH_EVENT = 'team-cluster-daemon:terminal.attach';
export const TEAM_CLUSTER_DAEMON_TERMINAL_ATTACHED_EVENT = 'team-cluster-daemon:terminal.attached';
export const TEAM_CLUSTER_DAEMON_TERMINAL_INPUT_EVENT = 'team-cluster-daemon:terminal.input';
export const TEAM_CLUSTER_DAEMON_TERMINAL_RESIZE_EVENT = 'team-cluster-daemon:terminal.resize';
export const TEAM_CLUSTER_DAEMON_TERMINAL_DETACH_EVENT = 'team-cluster-daemon:terminal.detach';
export const TEAM_CLUSTER_DAEMON_TERMINAL_DATA_EVENT = 'team-cluster-daemon:terminal.data';
export const TEAM_CLUSTER_DAEMON_TERMINAL_END_EVENT = 'team-cluster-daemon:terminal.end';
export const TEAM_CLUSTER_DAEMON_TERMINAL_ERROR_EVENT = 'team-cluster-daemon:terminal.error';
export const TEAM_CLUSTER_DAEMON_WEBSOCKET_ATTACH_EVENT = 'team-cluster-daemon:websocket.attach';
export const TEAM_CLUSTER_DAEMON_WEBSOCKET_ATTACHED_EVENT = 'team-cluster-daemon:websocket.attached';
export const TEAM_CLUSTER_DAEMON_WEBSOCKET_INPUT_EVENT = 'team-cluster-daemon:websocket.input';
export const TEAM_CLUSTER_DAEMON_WEBSOCKET_DATA_EVENT = 'team-cluster-daemon:websocket.data';
export const TEAM_CLUSTER_DAEMON_WEBSOCKET_DETACH_EVENT = 'team-cluster-daemon:websocket.detach';
export const TEAM_CLUSTER_DAEMON_WEBSOCKET_END_EVENT = 'team-cluster-daemon:websocket.end';
export const TEAM_CLUSTER_DAEMON_WEBSOCKET_ERROR_EVENT = 'team-cluster-daemon:websocket.error';

export const getTeamClusterRoom = (teamClusterId: string): string => {
    return `team-cluster:${teamClusterId}`;
};
