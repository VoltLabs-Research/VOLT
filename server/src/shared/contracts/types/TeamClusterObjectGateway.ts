import type { Readable as NodeReadable } from 'node:stream';

export interface TeamClusterObjectGatewayListRequest {
    bucket: string;
    prefix?: string;
    cursor?: string;
    limit?: number;
}

export interface TeamClusterObjectGatewayListEntry {
    key: string;
    contentLength?: number;
    etag?: string;
    lastModified?: Date;
}

export interface TeamClusterObjectGatewayListResponse {
    keys: string[];
    objects: TeamClusterObjectGatewayListEntry[];
    nextCursor?: string;
}

export interface TeamClusterObjectGatewayHeadResponse {
    contentLength?: number;
    contentType?: string;
    contentEncoding?: string;
    etag?: string;
    lastModified?: Date;
    metadata: Record<string, string>;
}

export interface TeamClusterObjectGatewayStreamResponse extends TeamClusterObjectGatewayHeadResponse {
    headers: Record<string, string>;
    stream: NodeReadable;
}

export interface TeamClusterObjectGatewayPutRequest {
    bucket: string;
    objectKey: string;
    contentLength: number;
    contentType?: string;
    contentEncoding?: string;
    metadata?: Record<string, string>;
}

export interface TeamClusterObjectGatewayPutStreamRequest extends TeamClusterObjectGatewayPutRequest {
    stream: NodeReadable;
}

export interface TeamClusterObjectGatewayPutBufferRequest extends TeamClusterObjectGatewayPutRequest {
    buffer: Buffer;
}

export interface TeamClusterObjectGatewayComposeRequest {
    bucket: string;
    objectKey: string;
    sourceObjectKeys: string[];
    metadata?: Record<string, string>;
}

export const TEAM_CLUSTER_OBJECT_STORE_PROXY_BASE_PATH = '/internal/team-cluster/object-store/v1';
export const TEAM_CLUSTER_OBJECT_STORE_DAEMON_ID_HEADER = 'x-team-cluster-id';
export const TEAM_CLUSTER_OBJECT_STORE_DAEMON_PASSWORD_HEADER = 'x-team-cluster-daemon-password';
export const TEAM_CLUSTER_OBJECT_STORE_METADATA_HEADER_PREFIX = 'x-object-meta-';
export const TEAM_CLUSTER_OBJECT_STORE_SKIP_METADATA_HEADER = 'x-volt-object-store-skip-metadata';
export const TEAM_CLUSTER_DIRECT_ACCESS_TOKEN_HEADER = 'x-team-cluster-direct-access-token';
