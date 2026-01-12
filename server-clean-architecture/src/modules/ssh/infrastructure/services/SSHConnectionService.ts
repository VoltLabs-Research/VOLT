import { ISSHConnectionService, SSHFileEntry, DownloadProgress } from '../../domain/ports/ISSHConnectionService';
import SSHConnection from '../../domain/entities/SSHConnection';
import { Client, SFTPWrapper } from 'ssh2';
import { createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs/promises';
import path from 'node:path';

interface CachedConnection{
    client: Client;
    sftp: SFTPWrapper;
    lastUsed: number;
    configHash: string;
    isClosing: boolean;
};

interface SSHConnectionConfig{
    host: string;
    port: number;
    username: string;
    password: string;
    readyTimeout?: number;
    keepAliveInterval?: number;
};

interface SSH2Connection{
    client: Client;
    sftp: SFTPWrapper;
};

export default class SSHConnectionService implements ISSHConnectionService{
    private connections: Map<string, CachedConnection> = new Map();
    private connectionPromises: Map<string, Promise<SSH2Connection>> = new Map();

    // 5 minutes
    private readonly IDLE_TIMEOUT = 1000 * 60 * 5;
    private readonly CONNECTION_TIMEOUT = 20000;
    private readonly MAX_RETRIES = 2;
    private readonly PROGRESS_THROTTLE_MS = 150;

    // 1 MB
    private readonly STREAM_HIGH_WATER_MARK = 1024 * 1024;

    constructor(){
        // TODO: implement scheduler/job service
        setInterval(() => this.cleanupIdleConnections(), 1000 * 60);
    }

    async testConnection(connection: SSHConnection): Promise<boolean>{
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

            client.on('error', (error) => {
                clearTimeout(timeout);
                client.end();
                reject(error);
            });

            client.connect(config);
        });
    }

    async listFiles(connection: SSHConnection, remotePath: string = '.'): Promise<SSHFileEntry[]>{
        return this.executeWithRetry(connection, async (sftp) => {
            return new Promise((resolve, reject) => {
                sftp.readdir(remotePath, (error, list) => {
                    if(error) return reject(error);
                    
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

    async getFileStats(connection: SSHConnection, remotePath: string): Promise<SSHFileEntry | null>{
        return this.executeWithRetry(connection, async (sftp) => {
            return new Promise((resolve) => {
                sftp.stat(remotePath, (error, stats) => {
                    if(error) return resolve(null);
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

    async downloadFile(connection: SSHConnection, remotePath: string, localPath: string): Promise<void>{
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

    async getRemoteDirectorySize(connection: SSHConnection, remotePath: string): Promise<number>{
        const { client } = await this.getConnection(connection);

        return new Promise((resolve) => {
            // Safety check
            if(remotePath === '/') return resolve(0);

            const cmd = `du -sb -- ${this.shQuote(remotePath)}`;

            client.exec(cmd, (error, stream) => {
                if(error) return resolve(0);
                let output = '';
                stream.on('data', (data: Buffer) => output += data.toString());
                stream.on('close', () => {
                    const match = output.match(/^(\d+)/);
                    resolve(match ? parseInt(match[1], 10): 0);
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
    ): Promise<string[]>{
        const { client } = await this.getConnection(connection);
        if(remotePath === '/') throw new Error('Refusing to download "/"');
        
        await fs.mkdir(localPath, { recursive: true });

        let totalBytes = 0;
        if(onProgress){
            totalBytes = await this.getRemoteDirectorySize(connection, remotePath);
        }

        return new Promise((resolve, reject) => {
            const remoteDir = path.posix.dirname(remotePath);
            const remoteBase = path.posix.basename(remotePath);
            const cmd = `tar -C ${this.shQuote(remoteDir)} -cf - -- ${this.shQuote(remoteBase)}`;
            
            client.exec(cmd, (error, stream) => {
                if(error) return reject(error);

                const tarExtract = spawn('tar', ['-xf', '-', '-C', localPath], {
                    stdio: ['pipe', 'ignore', 'pipe']
                });

                let downloadedBytes = 0;
                let lastEmit = 0;

                const failHandler = (error: any) => {
                    try{
                        stream.destroy();
                    }catch(_){
                        // Nothing to do!
                    }

                    try{
                        tarExtract.stdin.destroy();
                    }catch(_){
                        // Nothing to do!
                    }

                    reject(error instanceof Error ? error : new Error(String(error)));
                };

                stream.on('error', failHandler);

                tarExtract.on('error', (spawnError) => failHandler(new Error (`Local tar failed: ${spawnError.message}`)));
                tarExtract.stdin.on('error', failHandler);

                stream.on('data', (chunk: Buffer) => {
                    downloadedBytes += chunk.length;
                    if(!onProgress) return;

                    const now = Date.now();
                    if((now - lastEmit) < this.PROGRESS_THROTTLE_MS) return;
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

                stream.pipe(tarExtract.stdin!);

                tarExtract.on('close', async (code) => {
                    if(code != 0) return failHandler(new Error(`Local tar exited with code ${code}`));

                    if(onProgress){
                        onProgress({ 
                            totalBytes, 
                            downloadedBytes, 
                            currentFile: 'done', 
                            percent: totalBytes > 0 ? 100 : 0 
                        })
                    }

                    try{
                        const files = await this.walkFiles(localPath);
                        resolve(files);
                    }catch(error){
                        failHandler(error);
                    }
                });
            });
        });
    }

    private async executeWithRetry<T>(
        connection: SSHConnection,
        operation: (sftp: SFTPWrapper) => Promise<T>,
        attempt = 1
    ): Promise<T>{
        try{
            const { sftp } = await this.getConnection(connection);
            return await operation(sftp);
        }catch(error: any){
            const shouldRetry = attempt <= this.MAX_RETRIES &&
                (error.code === 'ECONNRESET' || error.message?.includes('No SFTP') || !error.code);

            if(!shouldRetry) throw error;

            // Force reconnect
            this.closeConnection(connection.id);
            await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
            return this.executeWithRetry(connection, operation, attempt + 1);
        }
    }

    private async getConnection(connection: SSHConnection): Promise<SSH2Connection>{
        const config = this.createConfig(connection);
        const configHash = this.getConfigHash(config);
        const cached = this.connections.get(connection.id);
        if(cached){
            if(cached.configHash === configHash && !cached.isClosing){
                cached.lastUsed = Date.now();
                return cached;
            }
            this.closeConnection(connection.id);
        }

        if(this.connectionPromises.has(connection.id)){
            return this.connectionPromises.get(connection.id)!;
        }

        const connectPromise = new Promise<SSH2Connection>((resolve, reject) => {
            const client = new Client();
            const timeoutTimer = setTimeout(() => {
                client.destroy();
                reject(new Error(`Connection timeout after ${this.CONNECTION_TIMEOUT}ms`));
            }, this.CONNECTION_TIMEOUT + 1000);

            client.on('ready', () => {
                client.sftp((error, sftp) => {
                    clearTimeout(timeoutTimer);
                    if(error){
                        client.end();
                        return reject(error);
                    }

                    this.connections.set(connection.id, {
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
                clearTimeout(timeoutTimer);
            });

            client.on('close', () => {
                this.connections.delete(connection.id);
                this.connectionPromises.delete(connection.id);
            });

            try{
                client.connect(config);
            }catch(error){
                clearTimeout(timeoutTimer);
                reject(error);
            }
        });

        this.connectionPromises.set(connection.id, connectPromise);

        try{
            return await connectPromise;
        }catch(error){
            this.connections.delete(connection.id);
            throw error;
        }finally{
            this.connectionPromises.delete(connection.id);
        }
    }

    private createConfig(connection: SSHConnection): SSHConnectionConfig{
        const { host, port, username } = connection.props;
        return {
            host,
            port: Number(port),
            username,
            password: connection.getPassword(),
            readyTimeout: this.CONNECTION_TIMEOUT,
            keepAliveInterval: 10000
        };
    }

    private getConfigHash(config: SSHConnectionConfig): string {
        return `${config.host}:${config.port}:${config.username}:${config.password.length}`;
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
            conn.isClosing = true;
            conn.client.end();
            this.connections.delete(connectionId);
        }
    }

    private shQuote(value: string): string {
        return `'${value.replace(/'/g, `'\\''`)}'`;
    }

    private async walkFiles(root: string): Promise<string[]>{
        const out: string[] = [];
        const stack: string[] = [root];

        while(stack.length > 0){
            const dir = stack.pop()!;
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for(const entry of entries){
                const p = path.join(dir, entry.name);
                if(entry.isDirectory()){
                    stack.push(p);
                }else{
                    out.push(p);
                }
            }
        }
        return out;
    }
};