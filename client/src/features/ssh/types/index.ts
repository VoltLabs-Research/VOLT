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

export interface CreateSSHConnectionPayload {
    name: string;
    host: string;
    port: number;
    username: string;
    password?: string;
}

export interface SSHFileListResponse {
    entries: Array<{
        name: string;
        type: 'file' | 'dir';
        size?: number;
        mtime?: string;
        relPath: string;
    }>;
    cwd: string;
}

export interface TestSSHConnection{
    valid: boolean;
    error?: string;
};