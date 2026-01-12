import SSHConnection from "../entities/SSHConnection";

export interface SSHFileEntry{
    name: string;
    path: string;
    isDirectory: boolean;
    size: number;
    mtime: Date;
};

export interface DownloadProgress{
    totalBytes: number;
    downloadedBytes: number;
    currentFile: string;
    percent: number;
};

export interface ISSHConnectionService{
    testConnection(
        connection: SSHConnection
    ): Promise<boolean>;

    listFiles(
        connection: SSHConnection,
        remotePath?: string
    ): Promise<SSHFileEntry[]>;

    getFileStats(
        connection: SSHConnection,
        remotePath: string
    ): Promise<SSHFileEntry | null>;

    downloadFile(
        connection: SSHConnection,
        remotePath: string,
        localPath: string
    ): Promise<void>;

    getRemoteDirectorySize(
        connection: SSHConnection,
        remotePath: string
    ): Promise<number>;

    downloadDirectory(
        connection: SSHConnection,
        remotePath: string,
        localPath: string,
        onProgress?: (progress: DownloadProgress) => void
    ): Promise<string[]>;
};