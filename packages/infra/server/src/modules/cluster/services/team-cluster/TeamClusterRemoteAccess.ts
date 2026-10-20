import { TeamClusterRemoteAccessTarget } from '@volt/contracts/modules/cluster/domain';
export { TeamClusterRemoteAccessTarget };

export enum TeamClusterRemoteExplorerEntryType {
    Directory = 'directory',
    Collection = 'collection',
    Bucket = 'bucket',
    Object = 'object'
}

export enum TeamClusterRemoteExplorerNodeType {
    Collection = 'collection',
    Object = 'object'
}

export enum TeamClusterRemoteExplorerContentType {
    Empty = 'empty',
    Text = 'text',
    DaemonTables = 'daemon-tables'
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

export interface TeamClusterDocumentView {
    id: string;
    value: Record<string, unknown>;
}

export interface TeamClusterRemoteExplorerNodeView {
    path: string;
    title: string;
    type: TeamClusterRemoteExplorerNodeType;
    contentType: TeamClusterRemoteExplorerContentType;
    textContent: string | null;
    documents: TeamClusterDocumentView[];
}

export interface TeamClusterRemoteAccessSessionView {
    sessionId: string;
    teamClusterId: string;
    target: TeamClusterRemoteAccessTarget;
    createdAt: string;
    expiresAt: string;
}
