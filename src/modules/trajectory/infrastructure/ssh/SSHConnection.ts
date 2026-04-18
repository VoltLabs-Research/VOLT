import SftpClient from 'ssh2-sftp-client';

import { logger } from '@/core/logger';
import { withTimeout } from '@/core/observability/infrastructure/daemon-instrumentation';
import fs from 'node:fs/promises';
import path from 'node:path';

const SSH_OPERATION_TIMEOUT_MS = 30_000;

type SftpClientInstance = InstanceType<typeof SftpClient>;
type SftpRemoteFileInfo = Awaited<ReturnType<SftpClientInstance['list']>>[number];
type SftpRemoteFileStats = Awaited<ReturnType<SftpClientInstance['stat']>>;

export interface SSHConnectionConfig {
    host: string;
    port: number;
    username: string;
    password: string;
};

interface SSHFileEntry {
    name: string;
    path: string;
    isDirectory: boolean;
    size: number;
    mtime: Date;
};

interface DownloadProgress {
    totalBytes: number;
    downloadedBytes: number;
    currentFile: string;
    percent: number;
};

const toRemoteModifiedAt = (value: number): Date => {
    return new Date(value >= 1_000_000_000_000 ? value : value * 1000);
};

const toSSHFileEntry = (
    parentPath: string,
    entry: Pick<SftpRemoteFileInfo, 'modifyTime' | 'name' | 'size' | 'type'>
): SSHFileEntry => {
    return {
        name: entry.name,
        path: path.posix.join(parentPath, entry.name),
        isDirectory: entry.type === 'd',
        size: entry.size,
        mtime: toRemoteModifiedAt(entry.modifyTime)
    };
};

const toSSHFileStatEntry = (
    remotePath: string,
    stats: Pick<SftpRemoteFileStats, 'isDirectory' | 'modifyTime' | 'size'>
): SSHFileEntry => {
    return {
        name: path.posix.basename(remotePath),
        path: remotePath,
        isDirectory: stats.isDirectory,
        size: stats.size,
        mtime: toRemoteModifiedAt(stats.modifyTime)
    };
};

export class SSHConnection {
    private readonly progressThrottleMs = 150;
    private readonly streamHighWaterMark = 1024 * 1024;

    async getFileStats(connection: SSHConnectionConfig, remotePath: string): Promise<SSHFileEntry | null> {
        return this.execute('ssh-stat', connection, async (client) => {
            try {
                const stats = await client.stat(remotePath);
                return toSSHFileStatEntry(remotePath, stats);
            } catch {
                return null;
            }
        });
    }

    async downloadFile(connection: SSHConnectionConfig, remotePath: string, localPath: string): Promise<void> {
        await this.execute('ssh-download-file', connection, async (client) => {
            await fs.mkdir(path.dirname(localPath), { recursive: true });
            await client.get(remotePath, localPath, {
                readStreamOptions: {
                    highWaterMark: this.streamHighWaterMark
                },
                writeStreamOptions: {
                    highWaterMark: this.streamHighWaterMark
                }
            });
        });
    }

    async downloadDirectory(
        connection: SSHConnectionConfig,
        remotePath: string,
        localPath: string,
        onProgress?: (progress: DownloadProgress) => void
    ): Promise<string[]> {
        if (remotePath === '/') {
            throw new Error('Refusing to download root directory');
        }

        await fs.mkdir(localPath, { recursive: true });

        return this.execute('ssh-download-directory', connection, async (client) => {
            const files: string[] = [];
            const totalBytes = onProgress
                ? await this.getRemoteDirectorySize(client, remotePath)
                : 0;
            let downloadedBytes = 0;
            let lastProgressEmitAt = 0;

            const emitProgress = (currentFile: string): void => {
                if (!onProgress) {
                    return;
                }

                const now = Date.now();
                if ((now - lastProgressEmitAt) < this.progressThrottleMs) {
                    return;
                }

                lastProgressEmitAt = now;
                onProgress({
                    totalBytes,
                    downloadedBytes,
                    currentFile,
                    percent: totalBytes > 0
                        ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
                        : 0
                });
            };

            const downloadRecursive = async (remoteDir: string, localDir: string): Promise<void> => {
                await fs.mkdir(localDir, { recursive: true });

                for (const entry of await this.listDirectory(client, remoteDir)) {
                    const localEntryPath = path.join(localDir, entry.name);

                    if (entry.isDirectory) {
                        await downloadRecursive(entry.path, localEntryPath);
                        continue;
                    }

                    await fs.mkdir(path.dirname(localEntryPath), { recursive: true });
                    await client.fastGet(entry.path, localEntryPath, {
                        concurrency: 1
                    });
                    downloadedBytes += entry.size;
                    files.push(localEntryPath);
                    emitProgress(entry.name);
                }
            };

            await downloadRecursive(remotePath, localPath);

            if (onProgress) {
                onProgress({
                    totalBytes,
                    downloadedBytes,
                    currentFile: 'done',
                    percent: totalBytes > 0 ? 100 : 0
                });
            }

            return files;
        });
    }

    private async listDirectory(client: SftpClientInstance, remoteDir: string): Promise<SSHFileEntry[]> {
        const entries = await client.list(remoteDir);
        return entries.map((entry) => toSSHFileEntry(remoteDir, entry));
    }

    private async getRemoteDirectorySize(client: SftpClientInstance, remotePath: string): Promise<number> {
        let totalBytes = 0;

        for (const entry of await this.listDirectory(client, remotePath)) {
            if (entry.isDirectory) {
                totalBytes += await this.getRemoteDirectorySize(client, entry.path);
                continue;
            }

            totalBytes += entry.size;
        }

        return totalBytes;
    }

    private async execute<T>(
        operationName: string,
        connection: SSHConnectionConfig,
        operation: (client: SftpClientInstance) => Promise<T>
    ): Promise<T> {
        const client = new SftpClient(`cluster-daemon:${operationName}`);
        const startedAt = Date.now();

        try {
            const result = await withTimeout(async () => {
                await client.connect(connection);
                return operation(client);
            }, {
                onTimeout: () => {
                    client.end().catch(() => undefined);
                },
                operation: operationName,
                timeoutMs: SSH_OPERATION_TIMEOUT_MS
            });

            return result;
        } catch (error) {
            logger.warn(
                {
                    durationMs: Date.now() - startedAt,
                    err: error,
                    host: connection.host,
                    operationName,
                    port: connection.port,
                    username: connection.username
                },
                'SSH operation failed'
            );
            throw error;
        } finally {
            await client.end().catch(() => undefined);
        }
    }
};
