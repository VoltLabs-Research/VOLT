export type FileEntryType = 'file' | 'dir';

export interface SSHFileEntry {
    type: FileEntryType;
    name: string;
    relPath: string;
    size?: number;
    mtime?: string;
};
