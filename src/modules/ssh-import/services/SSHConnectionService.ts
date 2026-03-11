import { Client, SFTPWrapper } from 'ssh2';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface SSHConnectionConfig {
    host: string;
    port: number;
    username: string;
    password: string;
};

export interface SSHFileEntry {
    name: string;
    path: string;
    isDirectory: boolean;
    size: number;
    mtime: Date;
};

export interface DownloadProgress {
    totalBytes: number;
    downloadedBytes: number;
    currentFile: string;
    percent: number;
};

export class SSHConnectionService {
    async getFileStats(connection: SSHConnectionConfig, remotePath: string): Promise<SSHFileEntry | null> {
        return this.execute(connection, (sftp) => {
            return new Promise((resolve) => {
                sftp.stat(remotePath, (error, stats) => {
                    if (error) {
                        resolve(null);
                        return;
                    }

                    resolve({
                        name: path.posix.basename(remotePath),
                        path: remotePath,
                        isDirectory: stats.isDirectory(),
                        size: stats.size,
                        mtime: new Date(stats.mtime * 1000)
                    });
                });
            });
        });
    }

    async downloadFile(connection: SSHConnectionConfig, remotePath: string, localPath: string): Promise<void> {
        await this.execute(connection, async (sftp) => {
            await fs.mkdir(path.dirname(localPath), { recursive: true });

            const readStream = sftp.createReadStream(remotePath);
            const writeStream = createWriteStream(localPath);
            await pipeline(readStream, writeStream);
        });
    }

    async downloadDirectory(
        connection: SSHConnectionConfig,
        remotePath: string,
        localPath: string,
        onProgress?: (progress: DownloadProgress) => void
    ): Promise<string[]> {
        await fs.mkdir(localPath, { recursive: true });
        const files: string[] = [];
        let downloadedBytes = 0;

        await this.execute(connection, async (sftp) => {
            const downloadRecursive = async (remoteDir: string, localDir: string): Promise<void> => {
                const entries = await new Promise<SSHFileEntry[]>((resolve, reject) => {
                    sftp.readdir(remoteDir, (error, list) => {
                        if (error) {
                            reject(error);
                            return;
                        }

                        resolve(list.map((item) => ({
                            name: item.filename,
                            path: path.posix.join(remoteDir, item.filename),
                            isDirectory: item.attrs.isDirectory(),
                            size: item.attrs.size,
                            mtime: new Date(item.attrs.mtime * 1000)
                        })));
                    });
                });

                for (const entry of entries) {
                    const localEntryPath = path.join(localDir, entry.name);
                    if (entry.isDirectory) {
                        await fs.mkdir(localEntryPath, { recursive: true });
                        await downloadRecursive(entry.path, localEntryPath);
                        continue;
                    }

                    await fs.mkdir(path.dirname(localEntryPath), { recursive: true });
                    await new Promise<void>((resolve, reject) => {
                        sftp.fastGet(entry.path, localEntryPath, (error) => {
                            if (error) {
                                reject(error);
                                return;
                            }

                            resolve();
                        });
                    });

                    downloadedBytes += entry.size;
                    files.push(localEntryPath);
                    onProgress?.({
                        totalBytes: 0,
                        downloadedBytes,
                        currentFile: entry.name,
                        percent: 0
                    });
                }
            };

            await downloadRecursive(remotePath, localPath);
        });

        return files;
    }

    private async execute<T>(connection: SSHConnectionConfig, operation: (sftp: SFTPWrapper) => Promise<T>): Promise<T> {
        const client = new Client();

        try {
            const sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
                client.on('ready', () => {
                    client.sftp((error, nextSftp) => {
                        if (error) {
                            reject(error);
                            return;
                        }

                        resolve(nextSftp);
                    });
                });

                client.on('error', reject);
                client.connect(connection);
            });

            return await operation(sftp);
        } finally {
            client.end();
        }
    }
};
