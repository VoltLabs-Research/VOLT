import { ISSHConnectionService, SSHFileEntry, DownloadProgress } from '@modules/ssh/domain/port/ISSHConnectionService';
import SSHConnection from '@modules/ssh/domain/entities/SSHConnection';
import { Client, SFTPWrapper } from 'ssh2';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { injectable, inject } from 'tsyringe';
import logger from '@shared/infrastructure/logger';
import { ErrorCodes } from '@core/constants/error-codes';
import type { ErrorCode } from '@core/constants/error-codes';
import { SSH_TOKENS } from '@modules/ssh/infrastructure/di/SSHTokens';
import { ISSHCredentialsCipher } from '@modules/ssh/domain/port/ISSHCredentialsCipher';

interface CachedConnection {
    client: Client;
    sftp: SFTPWrapper;
    lastUsed: number;
    configHash: string;
    isClosing: boolean;
};

interface SSHConnectionConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    readyTimeout?: number;
    keepAliveInterval?: number;
};

interface SSH2Connection {
    client: Client;
    sftp: SFTPWrapper;
};

class SSHServiceError extends Error {
    constructor(
        public readonly code: ErrorCode,
        public readonly statusCode: number,
        message: string
    ) {
        super(message);
        this.name = 'SSHServiceError';
    }
}

@injectable()
export default class SSHConnectionService implements ISSHConnectionService {
    private connections: Map<string, CachedConnection> = new Map();
    private connectionPromises: Map<string, Promise<SSH2Connection>> = new Map();

    // 5 minutes
    private readonly IDLE_TIMEOUT = 1000 * 60 * 5;
    private readonly CONNECTION_TIMEOUT = 20000;
    private readonly MAX_RETRIES = 2;
    private readonly PROGRESS_THROTTLE_MS = 150;

    // 1 MB
    private readonly STREAM_HIGH_WATER_MARK = 1024 * 1024;

    constructor(
        @inject(SSH_TOKENS.SSHCredentialsCipher)
        private readonly sshCredentialsCipher: ISSHCredentialsCipher
    ) {
        setInterval(() => this.cleanupIdleConnections(), 1000 * 60);
    }

    async testConnection(connection: SSHConnection): Promise<boolean> {
        const config = await this.createConfig(connection);
        const client = new Client();

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                client.end();
                reject(this.normalizeServiceError(undefined, 'Failed to test SSH connection'));
            }, 10000);

            client.on('ready', () => {
                clearTimeout(timeout);
                client.end();
                resolve(true);
            });

            client.on('error', (error) => {
                clearTimeout(timeout);
                client.end();
                reject(this.normalizeServiceError(error, 'Failed to test SSH connection'));
            });

            client.connect(config);
        });
    }

    async listFiles(connection: SSHConnection, remotePath: string = '.'): Promise<SSHFileEntry[]> {
        logger.info(`[SSHConnectionService] Listing files for ${connection._id} at ${remotePath}`);
        return this.executeWithRetry(connection, async (sftp) => {
            return new Promise((resolve, reject) => {
                sftp.readdir(remotePath, (error, list) => {
                    if (error) return reject(error);

                    const entries: SSHFileEntry[] = list.map((item) => ({
                        name: item.filename,
                        path: path.posix.join(remotePath, item.filename),
                        isDirectory: item.attrs.isDirectory(),
                        size: item.attrs.size,
                        mtime: new Date(item.attrs.mtime * 1000)
                    }));

                    resolve(entries);
                });
            });
        });
    }

    async getFileStats(connection: SSHConnection, remotePath: string): Promise<SSHFileEntry | null> {
        return this.executeWithRetry(connection, async (sftp) => {
            return new Promise((resolve) => {
                sftp.stat(remotePath, (error, stats) => {
                    if (error) return resolve(null);
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

    async downloadFile(connection: SSHConnection, remotePath: string, localPath: string): Promise<void> {
        return this.executeWithRetry(connection, async (sftp) => {
            await fs.mkdir(path.dirname(localPath), { recursive: true });

            const readStream = sftp.createReadStream(remotePath, {
                highWaterMark: this.STREAM_HIGH_WATER_MARK
            });

            const writeStream = createWriteStream(localPath, {
                highWaterMark: this.STREAM_HIGH_WATER_MARK
            });

            await pipeline(readStream, writeStream);
        });
    }

    async getRemoteDirectorySize(connection: SSHConnection, remotePath: string): Promise<number> {
        const { client } = await this.getConnection(connection);

        return new Promise((resolve) => {
            // Safety check
            if (remotePath === '/') return resolve(0);

            const cmd = `du -sb -- ${this.shQuote(remotePath)}`;

            client.exec(cmd, (error, stream) => {
                if (error) return resolve(0);
                let output = '';
                stream.on('data', (data: Buffer) => output += data.toString());
                stream.on('close', () => {
                    const match = output.match(/^(\d+)/);
                    resolve(match ? parseInt(match[1], 10) : 0);
                });
                stream.on('error', () => resolve(0));
            });
        });
    }

    async downloadDirectory(
        connection: SSHConnection,
        remotePath: string,
        localPath: string,
        onProgress?: (progress: DownloadProgress) => void
    ): Promise<string[]> {
        if (remotePath === '/') {
            throw new SSHServiceError(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                400,
                'Refusing to download root directory'
            );
        }

        await fs.mkdir(localPath, { recursive: true });

        let totalBytes = 0;
        if (onProgress) {
            totalBytes = await this.getRemoteDirectorySize(connection, remotePath);
        }

        let downloadedBytes = 0;
        let lastEmit = 0;
        const downloadedFiles: string[] = [];

        const emitProgress = (currentFile: string) => {
            if (!onProgress) return;
            const now = Date.now();
            if ((now - lastEmit) < this.PROGRESS_THROTTLE_MS) return;
            lastEmit = now;

            const percent = totalBytes > 0
                ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
                : 0;
            onProgress({
                totalBytes,
                downloadedBytes,
                currentFile,
                percent
            });
        };

        const downloadRecursive = async (sftp: SFTPWrapper, remoteDir: string, localDir: string): Promise<void> => {
            await fs.mkdir(localDir, { recursive: true });

            const entries = await new Promise<SSHFileEntry[]>((resolve, reject) => {
                sftp.readdir(remoteDir, (error, list) => {
                    if (error) return reject(error);
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
                    await downloadRecursive(sftp, entry.path, localEntryPath);
                } else {
                    await fs.mkdir(path.dirname(localEntryPath), { recursive: true });
                    await new Promise<void>((resolve, reject) => {
                        sftp.fastGet(entry.path, localEntryPath, (error) => {
                            if (error) return reject(error);
                            resolve();
                        });
                    });
                    downloadedBytes += entry.size;
                    downloadedFiles.push(localEntryPath);
                    emitProgress(entry.name);
                }
            }
        };

        await this.executeWithRetry(connection, async (sftp) => {
            await downloadRecursive(sftp, remotePath, localPath);
        });

        if (onProgress) {
            onProgress({
                totalBytes,
                downloadedBytes,
                currentFile: 'done',
                percent: totalBytes > 0 ? 100 : 0
            });
        }

        return downloadedFiles;
    }

    private async executeWithRetry<T>(
        connection: SSHConnection,
        operation: (sftp: SFTPWrapper) => Promise<T>,
        attempt = 1
    ): Promise<T> {
        try {
            const { sftp } = await this.getConnection(connection);
            return await operation(sftp);
        } catch (error: unknown) {
            const sshError = error as Record<string, unknown>;
            const errorMessage = sshError.message as string | undefined;
            logger.warn(`[SSHConnectionService] Attempt ${attempt} failed for ${connection._id}: ${errorMessage}`);

            if (error instanceof SSHServiceError) {
                throw error;
            }

            if (errorMessage?.includes('All configured authentication methods failed')
                || sshError.level === 'client-authentication') {
                throw this.normalizeServiceError(error, 'SSH authentication failed');
            }

            const shouldRetry = attempt <= this.MAX_RETRIES &&
                (sshError.code === 'ECONNRESET' || errorMessage?.includes('No SFTP') || !sshError.code);

            if (!shouldRetry) {
                throw this.normalizeServiceError(error, 'SSH operation failed');
            }

            this.closeConnection(connection._id);
            await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
            return this.executeWithRetry(connection, operation, attempt + 1);
        }
    }

    private async getConnection(connection: SSHConnection): Promise<SSH2Connection> {
        const config = await this.createConfig(connection);
        const configHash = this.getConfigHash(config);
        const cached = this.connections.get(connection._id);
        if (cached) {
            if (cached.configHash === configHash && !cached.isClosing) {
                cached.lastUsed = Date.now();
                return cached;
            }
            this.closeConnection(connection._id);
        }

        if (this.connectionPromises.has(connection._id)) {
            return this.connectionPromises.get(connection._id)!;
        }

        const connectPromise = new Promise<SSH2Connection>((resolve, reject) => {
            const client = new Client();
            const timeoutTimer = setTimeout(() => {
                client.destroy();
                reject(this.normalizeServiceError(undefined, 'Failed to establish SSH connection'));
            }, this.CONNECTION_TIMEOUT + 1000);

            client.on('ready', () => {
                client.sftp((error, sftp) => {
                    clearTimeout(timeoutTimer);
                    if (error) {
                        client.end();
                        return reject(this.normalizeServiceError(error, 'Failed to establish SSH connection'));
                    }

                    this.connections.set(connection._id, {
                        client,
                        sftp,
                        lastUsed: Date.now(),
                        configHash,
                        isClosing: false
                    });

                    resolve({ client, sftp });
                });
            });

            client.on('error', (error) => {
                logger.error(`[SSHConnectionService] Connection error for ${connection._id}: ${error.message}`);
                clearTimeout(timeoutTimer);
                reject(this.normalizeServiceError(error, 'Failed to establish SSH connection'));
            });

            client.on('close', () => {
                this.connections.delete(connection._id);
                this.connectionPromises.delete(connection._id);
            });

            try {
                client.connect(config);
            } catch (error: unknown) {
                clearTimeout(timeoutTimer);
                reject(this.normalizeServiceError(error, 'Failed to establish SSH connection'));
            }
        });

        this.connectionPromises.set(connection._id, connectPromise);

        try {
            return await connectPromise;
        } catch (error) {
            this.connections.delete(connection._id);
            throw error;
        } finally {
            this.connectionPromises.delete(connection._id);
        }
    }

    private async createConfig(connection: SSHConnection): Promise<SSHConnectionConfig> {
        const { encryptedPassword, host, port, username } = connection.props;
        return {
            host,
            port: Number(port),
            username,
            password: await this.sshCredentialsCipher.decrypt(encryptedPassword),
            readyTimeout: this.CONNECTION_TIMEOUT,
            keepAliveInterval: 10000
        };
    }

    private getConfigHash(config: SSHConnectionConfig): string {
        const passwordHash = createHash('sha256').update(config.password).digest('hex');
        return `${config.host}:${config.port}:${config.username}:${passwordHash}`;
    }

    private cleanupIdleConnections() {
        const now = Date.now();
        for (const [id, conn] of this.connections.entries()) {
            if (!conn.isClosing && (now - conn.lastUsed > this.IDLE_TIMEOUT)) {
                this.closeConnection(id);
            }
        }
    }

    private closeConnection(connectionId: string) {
        const conn = this.connections.get(connectionId);
        if (conn) {
            conn.isClosing = true;
            conn.client.end();
            this.connections.delete(connectionId);
        }
    }

    private shQuote(value: string): string {
        return `'${value.replace(/'/g, `'\\''`)}'`;
    }

    private normalizeServiceError(error: unknown, fallbackMessage: string): SSHServiceError {
        if (error instanceof SSHServiceError) {
            return error;
        }

        if (this.isPathNotFoundError(error)) {
            return new SSHServiceError(
                ErrorCodes.SSH_PATH_NOT_FOUND,
                404,
                'SSH path not found'
            );
        }

        if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            const sshError = error as Error & { code?: unknown; level?: string };

            if (msg.includes('timed out') || msg.includes('timeout') || sshError.code === 'ETIMEDOUT') {
                return new SSHServiceError(
                    ErrorCodes.SSH_CONNECTION_TIMEOUT,
                    408,
                    `SSH connection timed out: ${error.message}`
                );
            }

            if (msg.includes('authentication') || sshError.level === 'client-authentication') {
                return new SSHServiceError(
                    ErrorCodes.SSH_AUTH_FAILED,
                    401,
                    `SSH authentication failed: ${error.message}`
                );
            }

            if (msg.includes('econnrefused') || sshError.code === 'ECONNREFUSED') {
                return new SSHServiceError(
                    ErrorCodes.SSH_CONNECTION_REFUSED,
                    502,
                    `SSH connection refused: ${error.message}`
                );
            }

            if (msg.includes('ehostunreach') || msg.includes('enetunreach') || sshError.code === 'EHOSTUNREACH' || sshError.code === 'ENETUNREACH') {
                return new SSHServiceError(
                    ErrorCodes.SSH_HOST_UNREACHABLE,
                    502,
                    `SSH host unreachable: ${error.message}`
                );
            }
        }

        return new SSHServiceError(
            ErrorCodes.INTERNAL_SERVER_ERROR,
            500,
            fallbackMessage
        );
    }

    private isPathNotFoundError(error: unknown): boolean {
        if (!(error instanceof Error)) {
            return false;
        }

        const normalizedMessage = error.message.toLowerCase();

        if (normalizedMessage.includes('no such file') || normalizedMessage.includes('not found')) {
            return true;
        }

        const sshError = error as Error & { code?: unknown };

        if (sshError.code === 2 || sshError.code === 'ENOENT') {
            return true;
        }

        return false;
    }

};
