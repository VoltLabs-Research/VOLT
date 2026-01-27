export interface SSHConnection {
    _id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    user: string;
    createdAt: string;
    updatedAt: string;
}

export interface SSHFileEntry {
    name: string;
    type: 'file' | 'dir';
    size?: number;
    mtime?: string;
    relPath: string;
}

export interface SSHFileListResponse {
    entries: SSHFileEntry[];
    cwd: string;
}
