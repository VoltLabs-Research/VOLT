export type RemoteExplorerMongoValue =
    | boolean
    | null
    | number
    | string
    | RemoteExplorerMongoValue[]
    | RemoteExplorerMongoValueObject;

export interface RemoteExplorerMongoValueObject {
    [key: string]: RemoteExplorerMongoValue;
}

export interface RemoteExplorerEntry {
    id: string;
    name: string;
    path: string;
    type: RemoteExplorerEntryType;
    size: number | null;
    updatedAt: string | null;
    description: string | null;
};

export interface RemoteExplorerMongoDocument {
    id: string;
    value: RemoteExplorerMongoValueObject;
};

export interface RemoteExplorerNode {
    path: string;
    title: string;
    type: RemoteExplorerNodeType;
    contentType: RemoteExplorerContentType;
    textContent: string | null;
    mongoDocuments: RemoteExplorerMongoDocument[];
};

export interface RemoteExplorerRequest {
    target: RemoteExplorerTarget;
    path: string;
};

/**
 * Enumerates the protected remote resources available from the cluster explorer.
 */
export enum RemoteExplorerTarget {
    MongoDocuments = 'mongo-documents',
    RedisData = 'redis-data',
    Minio = 'minio'
};

/**
 * Enumerates the entry visuals reused by the shared explorer list.
 */
export enum RemoteExplorerEntryType {
    Directory = 'directory',
    Collection = 'collection',
    RedisDatabase = 'redis-database',
    RedisKey = 'redis-key',
    Bucket = 'bucket',
    Object = 'object'
};

/**
 * Enumerates the concrete node payloads that can be opened from the explorer.
 */
export enum RemoteExplorerNodeType {
    Collection = 'collection',
    RedisValue = 'redis-value',
    Object = 'object'
};

/**
 * Enumerates the content renderers supported by the remote explorer details pane.
 */
export enum RemoteExplorerContentType {
    Empty = 'empty',
    Text = 'text',
    MongoDocuments = 'mongo-documents'
};
