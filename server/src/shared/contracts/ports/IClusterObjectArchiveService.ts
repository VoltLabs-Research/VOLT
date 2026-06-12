import type { DownloadStreamOutputDTO } from '@shared/contracts/types/DownloadStream';

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

/**
 * Neutral cross-module port for building archive (zip) downloads from cluster
 * objects. Owned by the cluster module; consumed by trajectory + latex.
 * Canonical home in `shared/contracts`; concrete impl stays in cluster.
 */
export interface IClusterObjectArchiveService {
    createArchiveDownload(input: CreateArchiveDownloadInput): Promise<ClusterArchiveDownload>;
}
