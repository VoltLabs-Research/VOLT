/**
 * Enumerates the protected remote resources available from the cluster explorer.
 */
export enum TeamClusterRemoteAccessTarget {
    MongoDocuments = 'mongo-documents',
    RedisData = 'redis-data',
    Minio = 'minio'
}

/**
 * Enumerates the entry visuals reused by the shared explorer list.
 */
export enum TeamClusterRemoteExplorerEntryType {
    Directory = 'directory',
    Collection = 'collection',
    RedisDatabase = 'redis-database',
    RedisKey = 'redis-key',
    Bucket = 'bucket',
    Object = 'object'
}

/**
 * Enumerates the concrete node payloads that can be opened from the explorer.
 */
export enum TeamClusterRemoteExplorerNodeType {
    Collection = 'collection',
    RedisValue = 'redis-value',
    Object = 'object'
}

/**
 * Enumerates the content renderers supported by the remote explorer details pane.
 */
export enum TeamClusterRemoteExplorerContentType {
    Empty = 'empty',
    Text = 'text',
    MongoDocuments = 'mongo-documents'
}

/**
 * Represents a navigable item rendered inside the shared remote explorer UI.
 */
export interface TeamClusterRemoteExplorerEntry {
    id: string;
    name: string;
    path: string;
    type: TeamClusterRemoteExplorerEntryType;
    size: number | null;
    updatedAt: string | null;
    description: string | null;
}

/**
 * Represents a MongoDB document rendered by the dedicated collection viewer.
 */
export interface TeamClusterMongoDocument {
    id: string;
    value: Record<string, unknown>;
}

/**
 * Represents the content payload shown when the explorer opens a concrete resource node.
 */
export interface TeamClusterRemoteExplorerNode {
    path: string;
    title: string;
    type: TeamClusterRemoteExplorerNodeType;
    contentType: TeamClusterRemoteExplorerContentType;
    textContent: string | null;
    mongoDocuments: TeamClusterMongoDocument[];
}

/**
 * Represents a password-confirmed remote access session for a specific cluster resource.
 */
export interface TeamClusterRemoteAccessSession {
    sessionId: string;
    teamClusterId: string;
    target: TeamClusterRemoteAccessTarget;
    createdAt: string;
    expiresAt: string;
}
