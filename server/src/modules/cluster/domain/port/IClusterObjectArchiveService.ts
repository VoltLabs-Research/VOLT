import type { DownloadStreamOutputDTO } from '@modules/plugin/domain/contracts/plugin/DownloadStream';

export interface ClusterArchiveObjectEntry {
    type: 'object';
    name: string;
    bucket: string;
    objectKey: string;
    ownerClusterId?: string;
    optional?: boolean;
}

export interface ClusterArchiveInlineEntry {
    type: 'inline';
    name: string;
    content: string;
    encoding?: BufferEncoding;
}

export type ClusterArchiveEntry = ClusterArchiveObjectEntry | ClusterArchiveInlineEntry;

export interface ClusterArchiveReference {
    teamClusterId: string;
    bucket: string;
    objectKey: string;
}

export type ClusterArchiveDownload = DownloadStreamOutputDTO & {
    clusterObject: ClusterArchiveReference;
};

export interface CreateArchiveDownloadInput {
    teamClusterId: string;
    entries: ClusterArchiveEntry[];
    outputObjectKey: string;
    outputBucket?: string;
    filename: string;
    cacheControl?: string;
}

export interface IClusterObjectArchiveService {
    createArchiveDownload(input: CreateArchiveDownloadInput): Promise<ClusterArchiveDownload>;
}
