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
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import logger from '@/logger';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface SSHConnection{
    client: Client;
    sftp: SFTPWrapper;
};

export interface SSHFileEntry{
    name: string;
    path: string;
    isDirectory: boolean;
    size: number;
    mtime: Date;
};

export interface FileTask{
    remote: string;
    local: string;
    size: number;
    filename: string;
};

export interface SSHConnectionConfig{
    host: string;
    port: number;
    username: string;
    password: string;
    readyTimeout?: number;
    keepaliveInterval?: number;
};

export interface CachedConnection{
    client: Client;
    sftp: SFTPWrapper;
    lastUsed: number;
    configHash: string;
    isClosing: boolean;
};

export interface DownloadProgress{
    totalBytes: number;
    downloadedBytes: number;
    currentFile: string;
    percent: number;
};

class SSHService{
    private connections: Map<string, CachedConnection> = new Map();
    // thundering herd protection
    private connectionPromises: Map<string, Promise<SSHConnection>> = new Map();
    // 5 minutes
    private readonly IDLE_TIMEOUT = 1000 * 60 * 5;
    private readonly CONNECT_TIMEOUT = 20000;
    private readonly MAX_RETRIES = 2;
    private readonly DOWNLOAD_CONCURRENCY = 10;

    constructor(){
        // Periodic cleaning of inactive connections
        setInterval(() => this.cleanupIdleConnections(), 1000 * 60);        
    }

    private cleanupIdleConnections(){
        const now = Date.now();
        for(const [id, conn] of this.connections.entries()){
            if(!conn.isClosing && (now - conn.lastUsed > this.IDLE_TIMEOUT)){
                this.closeConnection(id);
            }
        }
    }

    private closeConnection(connectionId: string){
        const conn = this.connections.get(connectionId);
        if(conn){
            logger.info(`Closing idle SSH connection: ${connectionId}`);
            conn.isClosing = true;
            try{
                conn.client.end();
            }catch(e){
                // ignore
            }
            this.connections.delete(connectionId);
        }
    }

    private getConfigHash(config: SSHConnectionConfig): string{
        return `${config.host}:${config.port}:${config.username}:${config.password.length}`;
    }

    private createConfig(connection: ISSHConnection): SSHConnectionConfig{
        return {
            host: connection.host,
            port: connection.port,
            username: connection.username,
            password: connection.getPassword(),
            readyTimeout: this.CONNECT_TIMEOUT,
            keepaliveInterval: 10000
        };
    }

    private async executeWithRetry<T>(
        connection: ISSHConnection, 
        operation: (sftp: SFTPWrapper) => Promise<T>, 
        attempt = 1
    ): Promise<T>{
        try{
            const { sftp } = await this.getConnection(connection);
            return await operation(sftp);
        }catch(error: any){
            const shouldRetry = attempt <= this.MAX_RETRIES && 
                (error.code === 'ECONNRESET' || error.message.includes('No SFTP') || !error.code);

            if(!shouldRetry) throw error;
            logger.warn(`Retrying SSH operation (Attempt ${attempt}/${this.MAX_RETRIES}) for ${connection.host}`);
            // force reconnection by clearing cache
            const connectionId = connection._id.toString();
            this.closeConnection(connectionId);
            // backoff
            await new Promise((r) => setTimeout(r, 500 * attempt));
            return this.executeWithRetry(connection, operation, attempt + 1);
        }
    }

    async testConnection(connection: ISSHConnection): Promise<boolean>{
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

    async listFiles(connection: ISSHConnection, remotePath: string = '.'): Promise<SSHFileEntry[]>{
        return this.executeWithRetry(connection, async (sftp) => {
            return new Promise((resolve, reject) => {
                sftp.readdir(remotePath, (err, list) => {
                    if(err) return reject(err);
                    
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

    async getFileStats(connection: ISSHConnection, remotePath: string): Promise<SSHFileEntry | null>{
        return this.executeWithRetry(connection, async (sftp) => {
            return new Promise((resolve) => {
                sftp.stat(remotePath, (err, stats) => {
                    if(err) return resolve(null);
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

    async downloadFile(connection: ISSHConnection, remotePath: string, localPath: string): Promise<void>{
        return this.executeWithRetry(connection, async (sftp) => {
            // ensure local dir
            await fs.mkdir(path.dirname(localPath), { recursive: true });
            await pipeline(sftp.createReadStream(remotePath), createWriteStream(localPath));
        });
    }

    async calculateDirectorySize(connection: ISSHConnection, remotePath: string): Promise<number>{
        return this.executeWithRetry(connection, async (sftp) => {
            let totalSize = 0;
            // array as a queue to avoid deep stack recursion (stack overflow)
            const queue = [remotePath];
            while(queue.length > 0){
                const currentDir = queue.shift()!;
                try{
                    const list = await new Promise<any[]>((resolve, reject) => {
                        sftp.readdir(currentDir, (err, list) => err ? reject(err) : resolve(list));
                    });
                    for(const item of list){
                        const itemPath = path.posix.join(currentDir, item.filename);
                        if(item.attrs.isDirectory()){
                            queue.push(itemPath);
                        }else{
                            totalSize += item.attrs.size;
                        }
                    }
                }catch(e){
                    logger.warn(`Error reading directory ${currentDir} during size calculation: ${e}`);
                }
            }

            return totalSize;
        });
    }

    async downloadDirectory(
        connection: ISSHConnection,
        remotePath: string,
        localPath: string,
        onProgress?: (progress: DownloadProgress) => void
    ): Promise<string[]>{
        const { sftp } = await this.getConnection(connection);
        const downloadFiles: string[] = [];

        let totalBytes = 0;
        let downloadedBytes = 0;

        if(onProgress){
            try{
                totalBytes = await this.calculateDirectorySize(connection, remotePath);
            }catch(error){
                logger.warn(`Failed to calculate directory size: ${error}`);
            }
        }

        const tasks: FileTask[] = [];
        const dirQueue = [{ remote: remotePath, local: localPath }];

        await fs.mkdir(localPath, { recursive: true });

        while(dirQueue.length > 0){
            const { remote, local } = dirQueue.shift()!;
            try{
                // TODO: duplicated code with SSHService.downloadFile
                const list = await new Promise<any[]>((resolve, reject) => {
                    sftp.readdir(remote, (err, l) => err ? reject(err) : resolve(l));
                });

                for(const item of list){
                    const itemRemote = path.posix.join(remote, item.filename);
                    const itemLocal = path.join(local, item.filename);
                    
                    if(item.attrs.isDirectory()){
                        await fs.mkdir(itemLocal, { recursive: true });
                        dirQueue.push({ remote: itemRemote, local: itemLocal });
                    }else{
                        tasks.push({
                            remote: itemRemote,
                            local: itemLocal,
                            size: item.attrs.size,
                            filename: item.filename
                        });
                    }
                }
            }catch(err){
                logger.error(`Error reading dir ${remote}: ${err}`);
                throw err;
            }
        }

        const downloadWorker = async (task: FileTask) => {
            return new Promise<void>((resolve, reject) => {
                const readStream = sftp.createReadStream(task.remote);
                const writeStream = createWriteStream(task.local);

                readStream.on('data', (chunk: Buffer) => {
                    downloadedBytes += chunk.length;
                    if(onProgress){
                        onProgress({
                            totalBytes,
                            downloadedBytes,
                            currentFile: task.filename,
                            percent: totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0
                        });
                    }
                });

                readStream.pipe(writeStream);

                readStream.on('error', (err: any) => {
                    writeStream.close();
                    reject(err);
                });

                writeStream.on('error', (err) => reject(err));

                writeStream.on('finish', () => {
                    downloadFiles.push(task.local);
                    resolve();
                });
            });
        };

        const runQueue = async () => {
            const results: Promise<void>[] = [];
            const executing: Promise<void>[] = [];

            for(const task of tasks){
                const promise = downloadWorker(task);
                results.push(promise);
                
                const e: Promise<void> = promise.then(() => {
                    executing.splice(executing.indexOf(e), 1);
                });
                executing.push(e);

                if(executing.length >= this.DOWNLOAD_CONCURRENCY){
                    await Promise.race(executing);
                }
            }

            return Promise.all(results);
        };

        try{
            await runQueue();
        }catch(error){
            logger.error(`Error during batch download: ${error}`);
            throw error;
        }

        return downloadFiles;
    }

    private async getConnection(connection: ISSHConnection): Promise<SSHConnection>{
        const connectionId = connection._id.toString();
        const config = this.createConfig(connection);
        const configHash = this.getConfigHash(config);

        const cached = this.connections.get(connectionId);
        if(cached){
            if(cached.configHash === configHash && !cached.isClosing){
                cached.lastUsed = Date.now();
                return { client: cached.client, sftp: cached.sftp };
            }

            this.closeConnection(connectionId);
        }

        // promise sharing
        if(this.connectionPromises.has(connectionId)){
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
                    if(err){
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
                logger.error(`SSH Error (${connection.host}): ${err.message}`);
            });

            client.on('close', () => {
                this.connections.delete(connectionId);
                this.connectionPromises.delete(connectionId);
            });

            try{
                client.connect(config);
            }catch(err){
                clearTimeout(timeoutTimer);
                reject(err);
            }
        });

        // save the promise so others can reuse it while connecting 
        this.connectionPromises.set(connectionId, connectPromise);

        try{
            const result = await connectPromise;
            return result;
        }catch(error){
            this.connections.delete(connectionId);
            throw error;
        }finally{
            this.connectionPromises.delete(connectionId);
        }
    }
};

const sshService = new SSHService();

export default sshService;