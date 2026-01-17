import Docker, { Container } from 'dockerode';
import { injectable } from 'tsyringe';
import { IContainerService, ContainerStats } from '../../domain/ports/IContainerService';
import logger from '@/src/shared/infrastructure/logger';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@/src/shared/domain/constants/ErrorCodes';

const MAX_EXEC_BUFFER_SIZE = 10 * 1024 * 1024;

@injectable()
export class DockerContainerService implements IContainerService {
    private docker: Docker;
    private pullLocks: Map<string, Promise<void>> = new Map();

    constructor() {
        this.docker = new Docker({
            socketPath: '/var/run/docker.sock',
            timeout: 60000
        });
    }

    async createContainer(config: any): Promise<any> {
        try {
            const container = await this.docker.createContainer(config);
            return container.inspect();
        } catch (error: any) {
            logger.error(`Failed to create docker container: ${error.message}`);
            throw new ApplicationError(ErrorCodes.CONTAINER_CREATION_FAILED, error.message, 500);
        }
    }

    async startContainer(containerId: string): Promise<void> {
        try {
            const container = this.docker.getContainer(containerId);
            await container.start();
        } catch (error: any) {
            if (error.statusCode === 304) return;
            logger.error(`Failed to start container ${containerId}: ${error.message}`);
            throw new ApplicationError(ErrorCodes.CONTAINER_START_FAILED, error.message, 500);
        }
    }

    async stopContainer(containerId: string): Promise<void> {
        try {
            const container = this.docker.getContainer(containerId);
            await container.stop();
        } catch (error: any) {
            if (error.statusCode === 304) return;
            if (error.statusCode === 404) return;
            logger.error(`Failed to stop container ${containerId}: ${error.message}`);
            throw new ApplicationError(ErrorCodes.CONTAINER_STOP_FAILED, error.message, 500);
        }
    }

    async removeContainer(containerId: string): Promise<void> {
        try {
            const container = this.docker.getContainer(containerId);
            // Calling stop() before remove(force=true) can cause race conditions or state conflicts
            // We rely on force=true to kill and remove the container
            await container.remove({ force: true, v: true });
        } catch (error: any) {
            if (error.statusCode === 404) return;
            // If removal is already in progress, we can consider this a success (or at least non-blocking)
            // for the purpose of ensuring the container is going away.
            if (error.statusCode === 409 && error.message.includes('in progress')) {
                return;
            }
            logger.error(`Failed to remove container ${containerId}: ${error.message}`);
            throw new ApplicationError(ErrorCodes.CONTAINER_DELETION_FAILED, error.message, 500);
        }
    }

    async getStats(containerId: string): Promise<ContainerStats> {
        try {
            const container = this.docker.getContainer(containerId);
            const stats = await container.stats({ stream: false });
            return stats as ContainerStats;
        } catch (error: any) {
            logger.error(`Failed to get stats for ${containerId}: ${error.message}`);
            throw new ApplicationError(ErrorCodes.CONTAINER_STATS_FAILED, error.message, 500);
        }
    }

    async getFiles(containerId: string, path: string = '/'): Promise<any[]> {
        try {
            const output = await this.exec(containerId, ['ls', '-la', '--full-time', path]);
            const lines = output.split('\n').slice(1);
            return lines.map(line => {
                const parts = line.trim().split(/\s+/);
                if (parts.length < 9) return null;
                const isDir = parts[0].startsWith('d');
                const name = parts.slice(8).join(' ');
                if (name === '.' || name === '..') return null;
                return {
                    name,
                    isDirectory: isDir,
                    size: parts[4],
                    permissions: parts[0],
                    owner: parts[2],
                    group: parts[3],
                    date: `${parts[5]} ${parts[6]} ${parts[7]}`
                };
            }).filter(Boolean);
        } catch (error: any) {
            logger.error(`Failed to list files in ${containerId}: ${error.message}`);
            return [];
        }
    }

    async readFile(containerId: string, path: string): Promise<string> {
        try {
            const output = await this.exec(containerId, ['cat', path]);
            return output.replace(/[\x00-\x09\x0B-\x1F\x7F]/g, '');
        } catch (error: any) {
            throw new ApplicationError(ErrorCodes.CONTAINER_FILE_READ_FAILED, error.message, 500);
        }
    }

    async getProcesses(containerId: string): Promise<any[]> {
        try {
            const container = this.docker.getContainer(containerId);
            // Pass specific arguments to ps. Put 'args' LAST because it can contain spaces which split into multiple array elements.
            const result = await container.top({ ps_args: '-o pid,comm,nlwp,user,rss,pcpu,args' });
            return result.Processes || [];
        } catch (error: any) {
            return [];
        }
    }

    async exec(containerId: string, command: string[]): Promise<string> {
        try {
            const container = this.docker.getContainer(containerId);
            const exec = await container.exec({
                Cmd: command,
                AttachStdout: true,
                AttachStderr: true
            });
            const stream = await exec.start({ hijack: true, stdin: false });

            return new Promise<string>((resolve, reject) => {
                let output = '';
                let totalBytes = 0;
                let truncated = false;

                const safeWrite = (chunk: Buffer) => {
                    if (truncated) return;
                    if (totalBytes + chunk.length > MAX_EXEC_BUFFER_SIZE) {
                        output += chunk.slice(0, MAX_EXEC_BUFFER_SIZE - totalBytes).toString('utf8');
                        output += '\n... [TRUNCATED] ...';
                        truncated = true;
                    } else {
                        output += chunk.toString('utf8');
                    }
                    totalBytes += chunk.length;
                };

                try {
                    this.docker.modem.demuxStream(stream, { write: safeWrite } as any, { write: safeWrite } as any);
                } catch (e) {
                    stream.on('data', safeWrite);
                }

                stream.on('end', () => resolve(output));
                stream.on('error', (err: any) => reject(err));
            });
        } catch (error: any) {
            throw new ApplicationError(ErrorCodes.CONTAINER_EXEC_FAILED, error.message, 500);
        }
    }

    async pullImage(imageName: string): Promise<void> {
        if (this.pullLocks.has(imageName)) {
            return this.pullLocks.get(imageName);
        }

        const pullPromise = new Promise<void>((resolve, reject) => {
            this.docker.pull(imageName, (err: any, stream: any) => {
                if (err) return reject(err);
                this.docker.modem.followProgress(stream, (err: any, output: any) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }).finally(() => {
            this.pullLocks.delete(imageName);
        });

        this.pullLocks.set(imageName, pullPromise);
        return pullPromise;
    }

    async ensureImage(imageName: string): Promise<void> {
        try {
            const image = this.docker.getImage(imageName);
            await image.inspect();
        } catch (e: any) {
            if (e.statusCode === 404) {
                await this.pullImage(imageName);
            }
        }
    }

    async createNetwork(name: string): Promise<{ id: string; name: string }> {
        const networkName = `volterra-${name.replace(/\s+/g, '-').toLowerCase()}-net`;
        try {
            const network = await this.docker.createNetwork({
                Name: networkName,
                Driver: 'bridge',
                CheckDuplicate: true
            });
            const info = await network.inspect();
            return { id: info.Id, name: info.Name };
        } catch (error: any) {
            if (error.statusCode === 409) {
                const networks = await this.docker.listNetworks({ filters: { name: [networkName] } });
                if (networks.length > 0) return { id: networks[0].Id, name: networks[0].Name };
            }
            throw new ApplicationError(ErrorCodes.DOCKER_CONNECT_ERROR, `Failed to create network: ${error.message}`, 500);
        }
    }

    async removeNetwork(networkId: string): Promise<void> {
        try {
            const network = this.docker.getNetwork(networkId);
            await network.remove();
        } catch (e: any) {
            if (e.statusCode === 404) return;
            logger.error(`Failed to remove network ${networkId}: ${e.message}`);
        }
    }

    async connectNetwork(networkId: string, containerId: string): Promise<void> {
        try {
            const network = this.docker.getNetwork(networkId);
            await network.connect({ Container: containerId });
        } catch (e: any) {
            logger.error(`Failed to connect container ${containerId} to network ${networkId}: ${e.message}`);
        }
    }

    async createVolume(name: string): Promise<{ id: string; name: string }> {
        const volumeName = `volterra-${name.replace(/\s+/g, '-').toLowerCase()}-data`;
        try {
            const volume = await this.docker.createVolume({
                Name: volumeName,
                Driver: 'local'
            });
            return { id: volume.Name || volumeName, name: volume.Name || volumeName };
        } catch (e: any) {
            throw new ApplicationError(ErrorCodes.DOCKER_CONNECT_ERROR, `Failed to create volume: ${e.message}`, 500);
        }
    }

    async removeVolume(name: string): Promise<void> {
        try {
            const volume = this.docker.getVolume(name);
            await volume.remove();
        } catch (e: any) {
            if (e.statusCode === 404) return;
            logger.error(`Failed to remove volume ${name}: ${e.message}`);
        }
    }

    async commitContainer(containerId: string, repo: string, tag: string): Promise<void> {
        try {
            const container = this.docker.getContainer(containerId);
            await container.commit({ repo, tag });
        } catch (e: any) {
            logger.error(`Failed to commit container ${containerId}: ${e.message}`);
        }
    }

    async attachTerminal(containerId: string): Promise<{ stream: any; exec: any }> {
        try {
            const container = this.docker.getContainer(containerId);
            const exec = await container.exec({
                AttachStdin: true,
                AttachStdout: true,
                AttachStderr: true,
                Tty: true,
                Cmd: ['/bin/sh'],
                Env: ['TERM=xterm-256color']
            });

            const stream = await exec.start({ hijack: true, stdin: true });
            return { stream, exec };
        } catch (error: any) {
            throw new ApplicationError(ErrorCodes.DOCKER_CONNECT_ERROR, `Failed to attach terminal: ${error.message}`, 500);
        }
    }
}
