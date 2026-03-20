import { Client, SFTPWrapper } from 'ssh2';
import { logger } from '@/core/logger';
import { withTimeout } from '@/shared/observability/daemonInstrumentation';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs/promises';
import path from 'node:path';

const SSH_OPERATION_TIMEOUT_MS = 30_000;

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
    private readonly progressThrottleMs = 150;
    private readonly streamHighWaterMark = 1024 * 1024;

    async getFileStats(connection: SSHConnectionConfig, remotePath: string): Promise<SSHFileEntry | null> {
        return this.execute('ssh-stat', connection, (sftp) => {
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
        await this.execute('ssh-download-file', connection, async (sftp) => {
            await fs.mkdir(path.dirname(localPath), { recursive: true });

            const readStream = sftp.createReadStream(remotePath, {
                highWaterMark: this.streamHighWaterMark
            });
            const writeStream = createWriteStream(localPath, {
                highWaterMark: this.streamHighWaterMark
            });
            await pipeline(readStream, writeStream);
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
        const files: string[] = [];
        const totalBytes = onProgress
            ? await this.getRemoteDirectorySize(connection, remotePath)
            : 0;
        let downloadedBytes = 0;
        let lastProgressEmitAt = 0;

        const emitProgress = (currentFile: string) => {
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

        await this.execute('ssh-download-directory', connection, async (sftp) => {
            const downloadRecursive = async (remoteDir: string, localDir: string): Promise<void> => {
                await fs.mkdir(localDir, { recursive: true });

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
                    emitProgress(entry.name);
                }
            };

            await downloadRecursive(remotePath, localPath);
        });

        if (onProgress) {
            onProgress({
                totalBytes,
                downloadedBytes,
                currentFile: 'done',
                percent: totalBytes > 0 ? 100 : 0
            });
        }

        return files;
    }

    private async getRemoteDirectorySize(connection: SSHConnectionConfig, remotePath: string): Promise<number> {
        const client = new Client();

        try {
            return await withTimeout(async () => new Promise<number>((resolve) => {
                client.on('ready', () => {
                    const command = `du -sb -- ${this.shQuote(remotePath)}`;
                    client.exec(command, (error, stream) => {
                        if (error) {
                            resolve(0);
                            return;
                        }

                        let output = '';
                        stream.on('data', (data: Buffer) => {
                            output += data.toString();
                        });
                        stream.on('close', () => {
                            const match = output.match(/^(\d+)/);
                            resolve(match ? Number.parseInt(match[1], 10) : 0);
                        });
                        stream.on('error', () => resolve(0));
                    });
                });

                client.on('error', () => resolve(0));
                client.connect(connection);
            }), {
                onTimeout: () => {
                    client.end();
                },
                operation: 'ssh-directory-size',
                timeoutMs: SSH_OPERATION_TIMEOUT_MS
            });
        } finally {
            client.end();
        }
    }

    private async execute<T>(
        operationName: string,
        connection: SSHConnectionConfig,
        operation: (sftp: SFTPWrapper) => Promise<T>
    ): Promise<T> {
        const client = new Client();
        const startedAt = Date.now();

        try {
            logger.info({ host: connection.host, operationName, port: connection.port, username: connection.username }, 'Opening SSH connection');
            const sftp = await withTimeout(async () => new Promise<SFTPWrapper>((resolve, reject) => {
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
            }), {
                onTimeout: () => {
                    client.end();
                },
                operation: operationName,
                timeoutMs: SSH_OPERATION_TIMEOUT_MS
            });

            const result = await withTimeout(() => operation(sftp), {
                onTimeout: () => {
                    client.end();
                },
                operation: operationName,
                timeoutMs: SSH_OPERATION_TIMEOUT_MS
            });

            logger.info(
                {
                    durationMs: Date.now() - startedAt,
                    host: connection.host,
                    operationName,
                    port: connection.port,
                    username: connection.username
                },
                'SSH operation completed'
            );
            return result;
        } catch (error: unknown) {
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
            client.end();
        }
    }

    private shQuote(value: string): string {
        return `'${value.replace(/'/g, `'\"'\"'`)}'`;
    }
};
