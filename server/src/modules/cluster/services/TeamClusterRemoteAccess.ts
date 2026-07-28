import { TeamClusterRemoteAccessTarget } from '@volt/contracts/modules/cluster/domain';
export { TeamClusterRemoteAccessTarget };

export enum TeamClusterRemoteExplorerEntryType {
    Directory = 'directory',
    Collection = 'collection',
    RedisDatabase = 'redis-database',
    RedisKey = 'redis-key',
    Bucket = 'bucket',
    Object = 'object'
}

export enum TeamClusterRemoteExplorerNodeType {
    Collection = 'collection',
    RedisValue = 'redis-value',
    Object = 'object'
}

export enum TeamClusterRemoteExplorerContentType {
    Empty = 'empty',
    Text = 'text',
    MongoDocuments = 'mongo-documents'
}

export interface TeamClusterRemoteExplorerEntryView {
    id: string;
    name: string;
    path: string;
    type: TeamClusterRemoteExplorerEntryType;
    size: number | null;
    updatedAt: string | null;
    description: string | null;
}

export interface TeamClusterMongoDocumentView {
    id: string;
    value: Record<string, unknown>;
}

export interface TeamClusterRemoteExplorerNodeView {
    path: string;
    title: string;
    type: TeamClusterRemoteExplorerNodeType;
    contentType: TeamClusterRemoteExplorerContentType;
    textContent: string | null;
    mongoDocuments: TeamClusterMongoDocumentView[];
}

export interface TeamClusterRemoteAccessSessionView {
    sessionId: string;
    teamClusterId: string;
    target: TeamClusterRemoteAccessTarget;
    createdAt: string;
    expiresAt: string;
}
