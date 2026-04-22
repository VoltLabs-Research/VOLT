import type { Readable } from 'node:stream';

export interface ClusterObjectHeadResponse {
    contentLength?: number;
    contentType?: string;
    contentEncoding?: string;
    etag?: string;
    lastModified?: Date;
    metadata: Record<string, string>;
}

export interface ClusterObjectStreamResponse extends ClusterObjectHeadResponse {
    stream: Readable;
}

export interface ClusterObjectListEntry {
    key: string;
    contentLength?: number;
    etag?: string;
    lastModified?: Date;
}

export interface ClusterObjectReadOptions {
    skipMetadata?: boolean;
    range?: {
        offset: number;
        length: number;
    };
}

export interface ClusterObjectPutInput {
    ownerClusterId: string;
    bucket: string;
    objectKey: string;
    body: Buffer;
    metadata?: Record<string, string>;
}

export interface ClusterObjectPutStreamInput {
    ownerClusterId: string;
    bucket: string;
    objectKey: string;
    stream: Readable;
    size: number;
    metadata?: Record<string, string>;
}

export type ScopedClusterObjectPutInput = Omit<ClusterObjectPutInput, 'ownerClusterId'>;
export type ScopedClusterObjectPutStreamInput = Omit<ClusterObjectPutStreamInput, 'ownerClusterId'>;

export interface ScopedClusterObjectStore {
    putObject(input: ScopedClusterObjectPutInput): Promise<void>;
    putObjectStream(input: ScopedClusterObjectPutStreamInput): Promise<void>;
}

export interface ClusterObjectListRequest {
    bucket: string;
    prefix: string;
    cursor?: string;
    limit?: number;
}

export interface ClusterObjectListResponse {
    keys: string[];
    objects: ClusterObjectListEntry[];
    nextCursor?: string;
}

export interface LocalClusterObjectStat {
    size: number;
    metaData: Record<string, string>;
    etag?: string;
    lastModified?: Date;
}

export type LocalClusterObjectListRequest = Omit<ClusterObjectListRequest, 'limit'> & {
    limit: number;
};

export interface LocalClusterObjectStoreGateway extends ScopedClusterObjectStore {
    listBuckets(): string[];
    statObject(bucket: string, objectKey: string): Promise<LocalClusterObjectStat>;
    getObjectStream(bucket: string, objectKey: string): Promise<Readable>;
    getObjectRangeStream(bucket: string, objectKey: string, offset: number, length: number): Promise<Readable>;
    listObjectsPage(input: LocalClusterObjectListRequest): Promise<ClusterObjectListResponse>;
    removeObject(bucket: string, objectKey: string): Promise<void>;
    deleteByPrefix(bucket: string, prefix: string): Promise<number>;
}

export interface RemoteClusterObjectPutBufferRequest {
    bucket: string;
    objectKey: string;
    buffer: Buffer;
    contentType?: string;
    contentEncoding?: string;
    metadata?: Record<string, string>;
}

export interface RemoteClusterObjectPutStreamRequest {
    bucket: string;
    objectKey: string;
    stream: Readable;
    contentLength: number;
    contentType?: string;
    contentEncoding?: string;
    metadata?: Record<string, string>;
}

export interface RemoteClusterObjectStoreGateway {
    head(ownerClusterId: string, bucket: string, objectKey: string): Promise<ClusterObjectHeadResponse>;
    getStream(
        ownerClusterId: string,
        bucket: string,
        objectKey: string,
        options?: ClusterObjectReadOptions
    ): Promise<ClusterObjectStreamResponse>;
    putBuffer(ownerClusterId: string, request: RemoteClusterObjectPutBufferRequest): Promise<void>;
    putStream(ownerClusterId: string, request: RemoteClusterObjectPutStreamRequest): Promise<void>;
    list(ownerClusterId: string, request: ClusterObjectListRequest): Promise<ClusterObjectListResponse>;
}

export interface ClusterObjectStore {
    head(ownerClusterId: string, bucket: string, objectKey: string): Promise<ClusterObjectHeadResponse>;
    getStream(
        ownerClusterId: string,
        bucket: string,
        objectKey: string,
        options?: ClusterObjectReadOptions
    ): Promise<ClusterObjectStreamResponse>;
    putObject(input: ClusterObjectPutInput): Promise<void>;
    putObjectStream(input: ClusterObjectPutStreamInput): Promise<void>;
    list(ownerClusterId: string, request: ClusterObjectListRequest): Promise<ClusterObjectListResponse>;
}
