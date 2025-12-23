/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Client, SFTPWrapper } from 'ssh2';
import { ISSHConnection } from '@/models/ssh-connection';
import { createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import logger from '@/logger';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface SSHConnection {
    client: Client;
    sftp: SFTPWrapper;
};

export interface SSHFileEntry {
    name: string;
    path: string;
    isDirectory: boolean;
    size: number;
    mtime: Date;
};

export interface FileTask {
    remote: string;
    local: string;
    size: number;
    filename: string;
};

export interface SSHConnectionConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    readyTimeout?: number;
    keepaliveInterval?: number;
};

export interface CachedConnection {
    client: Client;
    sftp: SFTPWrapper;
    lastUsed: number;
    configHash: string;
    isClosing: boolean;
};

export interface DownloadProgress {
    totalBytes: number;
    downloadedBytes: number;
    currentFile: string;
    percent: number;
};

class SSHService {
    private connections: Map<string, CachedConnection> = new Map();
    // thundering herd protection
    private connectionPromises: Map<string, Promise<SSHConnection>> = new Map();
    // 5 minutes
    private readonly IDLE_TIMEOUT = 1000 * 60 * 5;
    private readonly CONNECT_TIMEOUT = 20000;
    private readonly MAX_RETRIES = 2;

    // Progress throttling (ms)
    private readonly PROGRESS_THROTTLE_MS = 150;

    // Buffer tuning for big files
    private readonly STREAM_HIGH_WATER_MARK = 1024 * 1024; // 1MB

    constructor() {
        // Periodic cleaning of inactive connections
        setInterval(() => this.cleanupIdleConnections(), 1000 * 60);
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
            logger.info(`Closing idle SSH connection: ${connectionId}`);
            conn.isClosing = true;
            try {
                conn.client.end();
            } catch (e) {
                // ignore
            }
            this.connections.delete(connectionId);
        }
    }

    private getConfigHash(config: SSHConnectionConfig): string {
        return `${config.host}:${config.port}:${config.username}:${config.password.length}`;
    }

    private createConfig(connection: ISSHConnection): SSHConnectionConfig {
        return {
            host: connection.host,
            port: connection.port,
            username: connection.username,
            password: connection.getPassword(),
            readyTimeout: this.CONNECT_TIMEOUT,
            keepaliveInterval: 10000
        };
    }

    private shQuote(value: string): string {
        // Safe single-quote for sh:
        // abc'def -> 'abc'\''def'
        return `'${value.replace(/'/g, `'\\''`)}'`;
    }

    private async walkFiles(root: string): Promise<string[]> {
        const out: string[] = [];
        const stack: string[] = [root];

        while (stack.length > 0) {
            const dir = stack.pop()!;
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const p = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    stack.push(p);
                } else {
                    out.push(p);
                }
            }
        }

        return out;
    }

    private async executeWithRetry<T>(
        connection: ISSHConnection,
        operation: (sftp: SFTPWrapper) => Promise<T>,
        attempt = 1
    ): Promise<T> {
        try {
            const { sftp } = await this.getConnection(connection);
            return await operation(sftp);
        } catch (error: any) {
            const shouldRetry = attempt <= this.MAX_RETRIES &&
                (error.code === 'ECONNRESET' || error.message?.includes('No SFTP') || !error.code);

            if (!shouldRetry) throw error;

            logger.warn(`Retrying SSH operation(Attempt ${attempt}/${this.MAX_RETRIES}) for ${connection.host}`);

            // force reconnection by clearing cache
            const connectionId = connection._id.toString();
            this.closeConnection(connectionId);

            // backoff
            await new Promise((r) => setTimeout(r, 500 * attempt));
            return this.executeWithRetry(connection, operation, attempt + 1);
        }
    }

    async testConnection(connection: ISSHConnection): Promise<boolean> {
        const config = this.createConfig(connection);
        const client = new Client();

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                client.end();
                reject(new Error('Connection timeout during test'));
            }, 10000);

            client.on('ready', () => {
                clearTimeout(timeout);
                client.end();
                resolve(true);
            });

            client.on('error', (err) => {
                clearTimeout(timeout);
                client.end();
                reject(err);
            });

            client.connect(config);
        });
    }

    async listFiles(connection: ISSHConnection, remotePath: string = '.'): Promise<SSHFileEntry[]> {
        return this.executeWithRetry(connection, async (sftp) => {
            return new Promise((resolve, reject) => {
                sftp.readdir(remotePath, (err, list) => {
                    if (err) return reject(err);

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

    async getFileStats(connection: ISSHConnection, remotePath: string): Promise<SSHFileEntry | null> {
        return this.executeWithRetry(connection, async (sftp) => {
            return new Promise((resolve) => {
                sftp.stat(remotePath, (err, stats) => {
                    if (err) return resolve(null);
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

    async downloadFile(connection: ISSHConnection, remotePath: string, localPath: string): Promise<void> {
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

    async getRemoteDirectorySize(connection: ISSHConnection, remotePath: string): Promise<number> {
        const { client } = await this.getConnection(connection);

        return new Promise((resolve) => {
            if (remotePath === '/') {
                // Avoid accidentally sizing the entire filesystem.
                return resolve(0);
            }

            const cmd = `du -sb -- ${this.shQuote(remotePath)}`;

            client.exec(cmd, (err, stream) => {
                if (err) return resolve(0);

                let output = '';

                stream.on('data', (data: Buffer) => {
                    output += data.toString();
                });

                stream.stderr.on('data', () => {
                    // ignore
                });

                stream.on('close', () => {
                    const match = output.match(/^(\d+)/);
                    resolve(match ? parseInt(match[1], 10) : 0);
                });

                stream.on('error', () => resolve(0));
            });
        });
    }

    async downloadDirectory(
        connection: ISSHConnection,
        remotePath: string,
        localPath: string,
        onProgress?: (progress: DownloadProgress) => void
    ): Promise<string[]> {
        const { client } = await this.getConnection(connection);

        if (remotePath === '/') {
            throw new Error('Refusing to download "/"');
        }

        await fs.mkdir(localPath, { recursive: true });

        let totalBytes = 0;
        if (onProgress) {
            try {
                totalBytes = await this.getRemoteDirectorySize(connection, remotePath);
            } catch (e) {
                logger.warn(`Failed to calculate remote directory size: ${e}`);
            }
        }

        return new Promise((resolve, reject) => {
            const remoteDir = path.posix.dirname(remotePath);
            const remoteBase = path.posix.basename(remotePath);

            // Stream remote content using tar
            // -C: change directory
            // -c: create archive
            // -f -: write to stdout
            // --: end of options
            const cmd = `tar -C ${this.shQuote(remoteDir)} -cf - -- ${this.shQuote(remoteBase)}`;

            client.exec(cmd, (err, stream) => {
                if (err) return reject(err);

                const tarExtract = spawn('tar', ['-xf', '-', '-C', localPath], {
                    stdio: ['pipe', 'ignore', 'pipe']
                });

                let downloadedBytes = 0;
                let lastEmit = 0;

                const fail = (e: any) => {
                    try {
                        stream.destroy();
                    } catch (ex) {
                        // ignore
                    }

                    try {
                        tarExtract.stdin?.destroy();
                    } catch (ex) {
                        // ignore
                    }

                    reject(e instanceof Error ? e : new Error(String(e)));
                };

                stream.on('error', fail);

                tarExtract.on('error', (spawnErr) => {
                    fail(new Error(`Local tar failed: ${spawnErr.message}`));
                });

                tarExtract.stdin?.on('error', fail);

                stream.on('data', (chunk: Buffer) => {
                    downloadedBytes += chunk.length;

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
                        currentFile: 'streaming...',
                        percent
                    });
                });

                stream.stderr.on('data', (data: Buffer) => {
                    logger.warn(`Remote tar stderr: ${data.toString()}`);
                });

                tarExtract.stderr?.on('data', (data: Buffer) => {
                    logger.warn(`Local tar stderr: ${data.toString()}`);
                });

                // Pipe remote tar stream to local tar stdin (backpressure-aware)
                stream.pipe(tarExtract.stdin!);

                tarExtract.on('close', async (code) => {
                    if (code !== 0) {
                        return fail(new Error(`Local tar exited with code ${code}`));
                    }

                    try {
                        // Emit a final progress update
                        if (onProgress) {
                            onProgress({
                                totalBytes,
                                downloadedBytes,
                                currentFile: 'done',
                                percent: totalBytes > 0 ? 100 : 0
                            });
                        }

                        const files = await this.walkFiles(localPath);
                        resolve(files);
                    } catch (e) {
                        fail(e);
                    }
                });

                stream.on('close', (code: any) => {
                    // ssh2 stream "close" may include exit code; log only
                    if (code !== 0 && code !== null && code !== undefined) {
                        logger.warn(`Remote tar closed with code ${code}`);
                    }
                });
            });
        });
    }

    private async getConnection(connection: ISSHConnection): Promise<SSHConnection> {
        const connectionId = connection._id.toString();
        const config = this.createConfig(connection);
        const configHash = this.getConfigHash(config);

        const cached = this.connections.get(connectionId);
        if (cached) {
            if (cached.configHash === configHash && !cached.isClosing) {
                cached.lastUsed = Date.now();
                return { client: cached.client, sftp: cached.sftp };
            }

            this.closeConnection(connectionId);
        }

        // promise sharing
        if (this.connectionPromises.has(connectionId)) {
            return this.connectionPromises.get(connectionId)!;
        }

        // create new connection
        const connectPromise = new Promise<SSHConnection>((resolve, reject) => {
            const client = new Client();

            const timeoutTimer = setTimeout(() => {
                client.destroy();
                reject(new Error(`Connection timeout after ${this.CONNECT_TIMEOUT}ms`));
            }, this.CONNECT_TIMEOUT + 1000);

            client.on('ready', () => {
                client.sftp((err, sftp) => {
                    clearTimeout(timeoutTimer);
                    if (err) {
                        client.end();
                        return reject(err);
                    }

                    // save to cache
                    this.connections.set(connectionId, {
                        client,
                        sftp,
                        lastUsed: Date.now(),
                        configHash,
                        isClosing: false
                    });

                    resolve({ client, sftp });
                });
            });

            client.on('error', (err) => {
                clearTimeout(timeoutTimer);
                logger.error(`SSH Error(${connection.host}): ${err.message}`);
            });

            client.on('close', () => {
                this.connections.delete(connectionId);
                this.connectionPromises.delete(connectionId);
            });

            try {
                client.connect(config);
            } catch (err) {
                clearTimeout(timeoutTimer);
                reject(err);
            }
        });

        // save the promise so others can reuse it while connecting
        this.connectionPromises.set(connectionId, connectPromise);

        try {
            const result = await connectPromise;
            return result;
        } catch (error) {
            this.connections.delete(connectionId);
            throw error;
        } finally {
            this.connectionPromises.delete(connectionId);
        }
    }
};

const sshService = new SSHService();

export default sshService;
