export const RemoteExplorerTarget = Object.freeze({
    MongoDocuments: 'mongo-documents',
    RedisData: 'redis-data',
    Minio: 'minio'
} as const);
export type RemoteExplorerTarget = typeof RemoteExplorerTarget[keyof typeof RemoteExplorerTarget];

export const RemoteExplorerEntryType = Object.freeze({
    Directory: 'directory',
    Collection: 'collection',
    RedisDatabase: 'redis-database',
    RedisKey: 'redis-key',
    Bucket: 'bucket',
    Object: 'object'
} as const);
export type RemoteExplorerEntryType = typeof RemoteExplorerEntryType[keyof typeof RemoteExplorerEntryType];

export const RemoteExplorerNodeType = Object.freeze({
    Collection: 'collection',
    RedisValue: 'redis-value',
    Object: 'object'
} as const);
export type RemoteExplorerNodeType = typeof RemoteExplorerNodeType[keyof typeof RemoteExplorerNodeType];

export const RemoteExplorerContentType = Object.freeze({
    Empty: 'empty',
    Text: 'text',
    MongoDocuments: 'mongo-documents'
} as const);
export type RemoteExplorerContentType = typeof RemoteExplorerContentType[keyof typeof RemoteExplorerContentType];

export interface RemoteExplorerRequest {
    target: RemoteExplorerTarget;
    path: string;
}

export interface RemoteExplorerEntry {
    id: string;
    name: string;
    path: string;
    type: RemoteExplorerEntryType;
    size: number | null;
    updatedAt: string | null;
    description: string;
}

export interface RemoteExplorerMongoDocument {
    id: string;
    value: Record<string, unknown>;
}

export interface RemoteExplorerNode {
    path: string;
    title: string;
    type: RemoteExplorerNodeType;
    contentType: RemoteExplorerContentType;
    textContent: string | null;
    mongoDocuments: RemoteExplorerMongoDocument[];
}
