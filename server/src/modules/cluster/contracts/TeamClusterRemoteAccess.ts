/**
 * Remote-access / remote-explorer domain vocabulary.
 *
 * These enums and shapes describe the protected cluster resources and the
 * explorer entities (entries, nodes, sessions) that the remote-access ports
 * (`IRemoteExplorerDaemonGateway`, `ITeamClusterRemoteAccessSessionService`)
 * operate over. They are domain concepts, not HTTP transport shapes, so they
 * live in the domain layer where both ports and application code can depend on
 * them without breaking the dependency rule.
 */

/**
 * Enumerates the protected remote resources available from the cluster explorer.
 */
export enum TeamClusterRemoteAccessTargetDTO {
    MongoDocuments = 'mongo-documents',
    RedisData = 'redis-data',
    Minio = 'minio'
}

/**
 * Enumerates the entry visuals reused by the shared explorer list.
 */
export enum TeamClusterRemoteExplorerEntryTypeDTO {
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
export enum TeamClusterRemoteExplorerNodeTypeDTO {
    Collection = 'collection',
    RedisValue = 'redis-value',
    Object = 'object'
}

/**
 * Enumerates the content renderers supported by the remote explorer details pane.
 */
export enum TeamClusterRemoteExplorerContentTypeDTO {
    Empty = 'empty',
    Text = 'text',
    MongoDocuments = 'mongo-documents'
}

/**
 * Represents a navigable item rendered inside the shared remote explorer UI.
 */
export interface TeamClusterRemoteExplorerEntryDTO {
    id: string;
    name: string;
    path: string;
    type: TeamClusterRemoteExplorerEntryTypeDTO;
    size: number | null;
    updatedAt: string | null;
    description: string | null;
}

/**
 * Represents a MongoDB document rendered by the dedicated collection viewer.
 */
export interface TeamClusterMongoDocumentDTO {
    id: string;
    value: Record<string, unknown>;
}

/**
 * Represents the content payload shown when the explorer opens a concrete resource node.
 */
export interface TeamClusterRemoteExplorerNodeDTO {
    path: string;
    title: string;
    type: TeamClusterRemoteExplorerNodeTypeDTO;
    contentType: TeamClusterRemoteExplorerContentTypeDTO;
    textContent: string | null;
    mongoDocuments: TeamClusterMongoDocumentDTO[];
}

/**
 * Represents a password-confirmed remote access session for a specific cluster resource.
 */
export interface TeamClusterRemoteAccessSessionDTO {
    sessionId: string;
    teamClusterId: string;
    target: TeamClusterRemoteAccessTargetDTO;
    createdAt: string;
    expiresAt: string;
}
