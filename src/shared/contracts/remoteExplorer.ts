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

/**
 * Represents a navigable item rendered inside the shared remote explorer UI.
 */
export interface RemoteExplorerEntry {
    id: string;
    name: string;
    path: string;
    type: RemoteExplorerEntryType;
    size: number | null;
    updatedAt: string | null;
    description: string | null;
};

/**
 * Represents a MongoDB document rendered by the dedicated collection viewer.
 */
export interface RemoteExplorerMongoDocument {
    id: string;
    value: Record<string, unknown>;
};

/**
 * Represents the content payload shown when the explorer opens a concrete resource node.
 */
export interface RemoteExplorerNode {
    path: string;
    title: string;
    type: RemoteExplorerNodeType;
    contentType: RemoteExplorerContentType;
    textContent: string | null;
    mongoDocuments: RemoteExplorerMongoDocument[];
};

/**
 * Represents the reverse-channel payload used to query a remote explorer target.
 */
export interface RemoteExplorerRequest {
    target: RemoteExplorerTarget;
    path: string;
};
