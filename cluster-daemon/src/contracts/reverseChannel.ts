type ValueOf<T> = T[keyof T];

export const REVERSE_CHANNEL = Object.freeze({
    ResponseType: Object.freeze({
        Json: 'json',
        Buffer: 'buffer',
        Stream: 'stream'
    }),
    SessionKind: Object.freeze({
        Terminal: 'terminal',
        WebSocket: 'websocket'
    })
});

export type TeamClusterDaemonResponseType = ValueOf<typeof REVERSE_CHANNEL.ResponseType>;
export type TeamClusterDaemonSessionKind = ValueOf<typeof REVERSE_CHANNEL.SessionKind>;

export interface TeamClusterDaemonSocketHeaders {
    [key: string]: string;
};

export interface TeamClusterDaemonRegisterPayload {
    teamClusterId: string;
    daemonPassword: string;
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

export interface TeamClusterDaemonSessionAttachPayload {
    sessionId: string;
    kind: TeamClusterDaemonSessionKind;
    containerId?: string;
    targetUrl?: string;
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

export type TeamClusterDaemonMessage =
    | TeamClusterDaemonCommandMessage
    | TeamClusterDaemonSocketResponsePayload
    | TeamClusterDaemonSocketStreamPayload
    | TeamClusterDaemonSocketStreamStatePayload
    | TeamClusterDaemonSessionInputPayload
    | TeamClusterDaemonSessionResizePayload
    | TeamClusterDaemonSessionDetachPayload
    | TeamClusterDaemonSessionDataPayload
    | TeamClusterDaemonSessionEndPayload;
