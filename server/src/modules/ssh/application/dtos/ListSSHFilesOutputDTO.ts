export interface SSHFileEntryDTO{
    type: 'dir' | 'file';
    name: string;
    relPath: string;
    size: number;
    mtime: string;
};

export interface ListSSHFilesOutputDTO{
    cwd: string;
    entries: SSHFileEntryDTO[];
};
