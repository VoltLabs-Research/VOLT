

export enum TeamClusterRemoteAccessTargetDTO {
    MongoDocuments = 'mongo-documents',
    RedisData = 'redis-data',
    Minio = 'minio'
}

export enum TeamClusterRemoteExplorerEntryTypeDTO {
    Directory = 'directory',
    Collection = 'collection',
    RedisDatabase = 'redis-database',
    RedisKey = 'redis-key',
    Bucket = 'bucket',
    Object = 'object'
}

export enum TeamClusterRemoteExplorerNodeTypeDTO {
    Collection = 'collection',
    RedisValue = 'redis-value',
    Object = 'object'
}

export enum TeamClusterRemoteExplorerContentTypeDTO {
    Empty = 'empty',
    Text = 'text',
    MongoDocuments = 'mongo-documents'
}

export interface TeamClusterRemoteExplorerEntryDTO {
    id: string;
    name: string;
    path: string;
    type: TeamClusterRemoteExplorerEntryTypeDTO;
    size: number | null;
    updatedAt: string | null;
    description: string | null;
}

export interface TeamClusterMongoDocumentDTO {
    id: string;
    value: Record<string, unknown>;
}

export interface TeamClusterRemoteExplorerNodeDTO {
    path: string;
    title: string;
    type: TeamClusterRemoteExplorerNodeTypeDTO;
    contentType: TeamClusterRemoteExplorerContentTypeDTO;
    textContent: string | null;
    mongoDocuments: TeamClusterMongoDocumentDTO[];
}

export interface TeamClusterRemoteAccessSessionDTO {
    sessionId: string;
    teamClusterId: string;
    target: TeamClusterRemoteAccessTargetDTO;
    createdAt: string;
    expiresAt: string;
}
