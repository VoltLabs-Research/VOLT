/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
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
**/

import { Client, SFTPWrapper } from 'ssh2';
import { ISSHConnection } from '@/models/ssh-connection';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createWriteStream, createReadStream } from 'fs';
import logger from '@/logger';

export interface SSHFileEntry {
    name: string;
    path: string;
    isDirectory: boolean;
    size: number;
    mtime: Date;
}

export interface SSHConnectionConfig {
    host: string;
    port: number;
    username: string;
    password: string;
}

class SSHService {
    private connections: Map<string, { client: Client, sftp?: SFTPWrapper, lastUsed: number, config: SSHConnectionConfig }> = new Map();
    private readonly IDLE_TIMEOUT = 1000 * 60 * 5; // 5 minutes

    constructor() {
        // Periodic cleanup of idle connections
        setInterval(() => this.cleanupIdleConnections(), 1000 * 60);
    }

    private cleanupIdleConnections() {
        const now = Date.now();
        for (const [id, conn] of this.connections.entries()) {
            if (now - conn.lastUsed > this.IDLE_TIMEOUT) {
                logger.info(`Closing idle SSH connection: ${id}`);
                conn.client.end();
                this.connections.delete(id);
            }
        }
    }

    /**
     * Create SSH connection configuration from SSHConnection model
     */
    private createConfig(connection: ISSHConnection): SSHConnectionConfig {
        return {
            host: connection.host,
            port: connection.port,
            username: connection.username,
            password: connection.getPassword()
        };
    }

    /**
     * Get or create an SSH connection
     */
    private async getConnection(connection: ISSHConnection): Promise<{ client: Client, sftp: SFTPWrapper }> {
        const connectionId = connection._id.toString();
        const cached = this.connections.get(connectionId);
        const config = this.createConfig(connection);

        // Check if cached connection is valid and config hasn't changed
        if (cached) {
            // Simple check if config changed (e.g. password updated)
            const configChanged = JSON.stringify(cached.config) !== JSON.stringify(config);

            if (!configChanged) {
                cached.lastUsed = Date.now();
                if (cached.sftp) {
                    return { client: cached.client, sftp: cached.sftp };
                }
                // If client exists but no SFTP (shouldn't happen with this logic, but safe fallback)
            } else {
                // Config changed, close old connection
                cached.client.end();
                this.connections.delete(connectionId);
            }
        }

        return new Promise((resolve, reject) => {
            const client = new Client();
            const timeout = setTimeout(() => {
                client.end();
                this.connections.delete(connectionId);
                reject(new Error('Connection timeout'));
            }, 20000);

            client.on('ready', () => {
                client.sftp((err, sftp) => {
                    clearTimeout(timeout);
                    if (err) {
                        client.end();
                        return reject(err);
                    }

                    // Cache the connection
                    this.connections.set(connectionId, {
                        client,
                        sftp,
                        lastUsed: Date.now(),
                        config
                    });

                    resolve({ client, sftp });
                });
            });

            client.on('error', (err) => {
                clearTimeout(timeout);
                logger.error(`SSH connection error for ${connection.name}: ${err.message}`);
                this.connections.delete(connectionId);
                // Don't reject here if it's an existing connection error, 
                // the caller will handle the failure and retry or fail.
            });

            client.on('end', () => {
                this.connections.delete(connectionId);
            });

            client.on('close', () => {
                this.connections.delete(connectionId);
            });

            try {
                client.connect(config);
            } catch (err) {
                clearTimeout(timeout);
                reject(err);
            }
        });
    }

    /**
     * Test SSH connection
     */
    async testConnection(connection: ISSHConnection): Promise<boolean> {
        // For testing, we force a new connection to verify credentials
        const config = this.createConfig(connection);

        return new Promise((resolve, reject) => {
            const client = new Client();
            const timeout = setTimeout(() => {
                client.end();
                reject(new Error('Connection timeout'));
            }, 10000);

            client.on('ready', () => {
                clearTimeout(timeout);
                client.end();
                resolve(true);
            });

            client.on('error', (err) => {
                clearTimeout(timeout);
                logger.error(`SSH connection test failed: ${err.message}`);
                reject(err);
            });

            client.connect(config);
        });
    }

    /**
     * List files and directories at the given remote path
     */
    async listFiles(connection: ISSHConnection, remotePath: string = '.'): Promise<SSHFileEntry[]> {
        try {
            const { sftp } = await this.getConnection(connection);

            return new Promise((resolve, reject) => {
                sftp.readdir(remotePath, (err, list) => {
                    if (err) return reject(err);

                    const entries: SSHFileEntry[] = list.map(item => ({
                        name: item.filename,
                        path: path.posix.join(remotePath, item.filename),
                        isDirectory: item.attrs.isDirectory(),
                        size: item.attrs.size,
                        mtime: new Date(item.attrs.mtime * 1000)
                    }));

                    resolve(entries);
                });
            });
        } catch (error) {
            // If connection failed, try to reconnect once (handled by getConnection logic if we clear cache)
            // But getConnection already creates new if missing.
            // If it failed, it might be stale.
            const connectionId = connection._id.toString();
            if (this.connections.has(connectionId)) {
                this.connections.get(connectionId)?.client.end();
                this.connections.delete(connectionId);
                // Retry once
                return this.listFiles(connection, remotePath);
            }
            throw error;
        }
    }

    /**
     * Get file stats
     */
    async getFileStats(connection: ISSHConnection, remotePath: string): Promise<SSHFileEntry | null> {
        try {
            const { sftp } = await this.getConnection(connection);

            return new Promise((resolve, reject) => {
                sftp.stat(remotePath, (err, stats) => {
                    if (err) return resolve(null);

                    const entry: SSHFileEntry = {
                        name: path.posix.basename(remotePath),
                        path: remotePath,
                        isDirectory: stats.isDirectory(),
                        size: stats.size,
                        mtime: new Date(stats.mtime * 1000)
                    };

                    resolve(entry);
                });
            });
        } catch (error) {
            const connectionId = connection._id.toString();
            if (this.connections.has(connectionId)) {
                this.connections.get(connectionId)?.client.end();
                this.connections.delete(connectionId);
                return this.getFileStats(connection, remotePath);
            }
            throw error;
        }
    }

    /**
     * Download a single file from SSH to local path
     */
    async downloadFile(connection: ISSHConnection, remotePath: string, localPath: string): Promise<void> {
        const { sftp } = await this.getConnection(connection);

        return new Promise((resolve, reject) => {
            const writeStream = createWriteStream(localPath);
            const readStream = sftp.createReadStream(remotePath);

            readStream.on('error', (err: Error) => {
                writeStream.close();
                reject(err);
            });

            writeStream.on('error', (err: Error) => {
                reject(err);
            });

            writeStream.on('finish', () => {
                resolve();
            });

            readStream.pipe(writeStream);
        });
    }

    /**
     * Calculate total size of a directory recursively
     */
    async calculateDirectorySize(connection: ISSHConnection, remotePath: string): Promise<number> {
        const { sftp } = await this.getConnection(connection);
        let totalSize = 0;

        const calculateRecursive = async (dir: string) => {
            return new Promise<void>((resolve, reject) => {
                sftp.readdir(dir, async (err: Error | undefined, list: any[]) => {
                    if (err) return reject(err);
                    try {
                        for (const item of list) {
                            const itemPath = path.posix.join(dir, item.filename);
                            if (item.attrs.isDirectory()) {
                                await calculateRecursive(itemPath);
                            } else {
                                totalSize += item.attrs.size;
                            }
                        }
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        };

        await calculateRecursive(remotePath);
        return totalSize;
    }

    /**
     * Download a directory recursively from SSH to local path
     */
    /**
     * Download a directory recursively from SSH to local path with parallel execution
     */
    async downloadDirectory(
        connection: ISSHConnection,
        remotePath: string,
        localPath: string,
        onProgress?: (progress: { total: number, downloaded: number, currentFile: string }) => void
    ): Promise<string[]> {
        const { sftp } = await this.getConnection(connection);
        const downloadedFiles: string[] = [];
        let totalSize = 0;
        let downloadedSize = 0;
        const CONCURRENCY_LIMIT = 5;

        // Ensure local directory exists
        await fs.mkdir(localPath, { recursive: true });

        // Calculate total size first if progress callback is provided
        if (onProgress) {
            try {
                totalSize = await this.calculateDirectorySize(connection, remotePath);
            } catch (error) {
                logger.warn(`Failed to calculate directory size: ${error}`);
            }
        }

        // 1. Collect all files to download first
        interface FileToDownload {
            remotePath: string;
            localPath: string;
            size: number;
            filename: string;
        }

        const filesToDownload: FileToDownload[] = [];

        const collectFiles = async (remoteDir: string, localDir: string) => {
            return new Promise<void>((resolveDir, rejectDir) => {
                sftp.readdir(remoteDir, async (err: Error | undefined, list: any[]) => {
                    if (err) return rejectDir(err);

                    try {
                        for (const item of list) {
                            const itemRemotePath = path.posix.join(remoteDir, item.filename);
                            const localItemPath = path.join(localDir, item.filename);

                            if (item.attrs.isDirectory()) {
                                await fs.mkdir(localItemPath, { recursive: true });
                                await collectFiles(itemRemotePath, localItemPath);
                            } else {
                                filesToDownload.push({
                                    remotePath: itemRemotePath,
                                    localPath: localItemPath,
                                    size: item.attrs.size,
                                    filename: item.filename
                                });
                            }
                        }
                        resolveDir();
                    } catch (error) {
                        rejectDir(error);
                    }
                });
            });
        };

        await collectFiles(remotePath, localPath);

        // 2. Download files in parallel with concurrency limit
        const downloadFile = async (file: FileToDownload) => {
            return new Promise<void>((resolveFile, rejectFile) => {
                const writeStream = createWriteStream(file.localPath);
                const readStream = sftp.createReadStream(file.remotePath);
                readStream.on('data', (chunk: Buffer) => {
                    downloadedSize += chunk.length;
                    if (onProgress) {
                        onProgress({
                            total: totalSize,
                            downloaded: downloadedSize,
                            currentFile: file.filename
                        });
                    }
                });

                readStream.on('error', (err: Error) => {
                    writeStream.close();
                    rejectFile(err);
                });

                writeStream.on('error', (err: Error) => {
                    rejectFile(err);
                });

                writeStream.on('finish', () => {
                    downloadedFiles.push(file.localPath);
                    resolveFile();
                });

                readStream.pipe(writeStream);
            });
        };

        // Simple concurrency control
        const queue = [...filesToDownload];
        const activePromises: Promise<void>[] = [];

        // Initial fill
        while (queue.length > 0 && activePromises.length < CONCURRENCY_LIMIT) {
            const file = queue.shift();
            if (file) {
                const p = downloadFile(file).then(() => {
                    activePromises.splice(activePromises.indexOf(p), 1);
                });
                activePromises.push(p);
            }
        }

        // Process rest
        while (queue.length > 0 || activePromises.length > 0) {
            if (queue.length > 0 && activePromises.length < CONCURRENCY_LIMIT) {
                const file = queue.shift();
                if (file) {
                    const p = downloadFile(file).then(() => {
                        activePromises.splice(activePromises.indexOf(p), 1);
                    });
                    activePromises.push(p);
                }
            } else {
                // Wait for at least one to finish
                await Promise.race(activePromises);
            }
        }

        return downloadedFiles;
    }
}

export default new SSHService();
