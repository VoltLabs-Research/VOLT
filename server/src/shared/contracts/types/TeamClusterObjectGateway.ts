import type { Readable as NodeReadable } from 'node:stream';

/**
 * Cross-module payload types for the team-cluster object gateway.
 *
 * Canonical home in the neutral `shared/contracts` layer so consumers
 * (trajectory, plugin, analysis, raster, whiteboards, …) can reference the
 * gateway request/response shapes without importing `@modules/cluster`.
 * The original `@modules/cluster/contracts/TeamClusterObjectGateway`
 * re-exports these for backward compatibility.
 */

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
