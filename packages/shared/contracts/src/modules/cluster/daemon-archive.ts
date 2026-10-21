// Payload and result of DaemonCommand.ObjectStoreArchiveCreate: the daemon zips objects from
// its object store, plus inline files, into a new object.

export interface ArchiveObjectEntry{
    type: 'object';
    name: string;
    bucket: string;
    objectKey: string;
    ownerClusterId?: string;
    optional?: boolean;
}

export interface ArchiveInlineEntry{
    type: 'inline';
    name: string;
    content: string;
    encoding?: 'utf8' | 'base64';
}

export type ArchiveEntry = ArchiveObjectEntry | ArchiveInlineEntry;

export interface ArchiveCreateRequest{
    output: {
        bucket?: string;
        objectKey: string;
    };
    entries: ArchiveEntry[];
}

export interface ArchiveCreateResult{
    bucket: string;
    objectKey: string;
    contentLength: number;
}
