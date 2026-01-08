import Docker, { Container, ContainerCreateOptions, ContainerInspectInfo, ContainerStats } from 'dockerode';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import logger from '@/logger';

const MAX_EXEC_BUFFER_SIZE = 10 * 1024 * 1024;

class DockerService {
    private readonly docker: Docker;
    private pullLocks: Map<string, Promise<void>> = new Map();

    constructor() {
        this.docker = new Docker({
            socketPath: '/var/run/docker.sock',
            timeout: 60000
        });
    }

    async createContainer(config: ContainerCreateOptions): Promise<Container> {
        if (!config.Image) {
            throw new RuntimeError(ErrorCodes.DOCKER_CREATE_MISSING_IMAGE, 400);
        }

        try {
            await this.ensureImage(config.Image);
            return await this.docker.createContainer(config);
        } catch (error: any) {
            throw new RuntimeError(ErrorCodes.DOCKER_CREATE_ERROR, 500);
        }
    }

    private async pullImage(imageName: string): Promise<void> {
        try {
            const image = this.docker.getImage(imageName);
            await image.inspect();
        } catch (error: any) {
            // Only if it does not exist(404), do we proceed to download
            if (error.statusCode === 404) {
                logger.info(`Pulling image ${imageName}...`);
                await this.pullImageStream(imageName);
            } else {
                throw error;
            }
        } finally {
            // Always release the lock, even if the download fails.
            this.pullLocks.delete(imageName);
        }
    }

    private async pullImageStream(imageName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.docker.pull(imageName, (err: any, stream: any) => {
                if (err) return reject(err);
                this.docker.modem.followProgress(stream, (err, output) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
        });
    }

    async stopContainer(containerId: string): Promise<void> {
        try {
            const container = this.docker.getContainer(containerId);
            await container.stop();
        } catch (error: any) {
            if (error.statusCode !== 304 && error.statusCode !== 404) {
                throw new RuntimeError(ErrorCodes.DOCKER_STOP_ERROR, 500);
            }
        }
    }

    async removeContainer(containerId: string): Promise<void> {
        try {
            const container = this.docker.getContainer(containerId);
            // v: true removes associated anonymous volumes(Disk Garbage Collection)
            await container.remove({ force: true, v: true });
        } catch (error: any) {
            if (error.statusCode !== 404) {
                throw new RuntimeError(ErrorCodes.DOCKER_REMOVE_ERROR, 500);
            }
        }
    }

    async ensureImage(imageName: string): Promise<void> {
        // Check if operation is already in progress
        if (this.pullLocks.has(imageName)) {
            return this.pullLocks.get(imageName);
        }

        // Start new operation and lock
        const pullTask = this.pullImage(imageName);
        this.pullLocks.set(imageName, pullTask);
        return pullTask;
    }

    async startContainer(containerId: string): Promise<void> {
        try {
            const container = this.docker.getContainer(containerId);
            await container.start();
        } catch (error: any) {
            // 304 = Already Started(HTTP 304 Not Modified)
            if (error.statusCode !== 304) {
                throw new RuntimeError(ErrorCodes.DOCKER_START_ERROR, 500);
            }
        }
    }

    async getContainerStats(containerId: string): Promise<ContainerStats> {
        try {
            const container = this.docker.getContainer(containerId);
            return await container.stats({ stream: false });
        } catch (error: any) {
            throw new RuntimeError(ErrorCodes.DOCKER_STATS_ERROR, 500);
        }
    }

    async inspectContainer(containerId: string): Promise<ContainerInspectInfo> {
        try {
            const container = this.docker.getContainer(containerId);
            return await container.inspect();
        } catch (error: any) {
            throw new RuntimeError(ErrorCodes.DOCKER_INSPECT_ERROR, 500);
        }
    }

    public getContainer(containerId: string): Container {
        return this.docker.getContainer(containerId);
    }

    async getContainerProcesses(containerId: string): Promise<any> {
        try {
            const container = this.docker.getContainer(containerId);
            return await container.top({ ps_args: '-o pid,comm,args,nlwp,user,rss,pcpu' });
        } catch (error: any) {
            throw new RuntimeError(ErrorCodes.DOCKER_TOP_ERROR, 500);
        }
    }

    async execCommand(containerId: string, command: string[]): Promise<string> {
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

                    const newSize = totalBytes + chunk.length;
                    if (newSize > MAX_EXEC_BUFFER_SIZE) {
                        output += chunk.slice(0, MAX_EXEC_BUFFER_SIZE - totalBytes).toString('utf8');
                        output += '\n... [TRUNCATED] ...';
                        truncated = true;
                        // TODO: Should the connection be cut off if the limit is exceeded?
                        // stream.destroy()
                    } else {
                        output += chunk.toString('utf8');
                    }
                    totalBytes = newSize;
                };

                this.docker.modem.demuxStream(stream,
                    { write: safeWrite } as any,
                    { write: safeWrite } as any
                );

                stream.on('end', () => resolve(output));
                stream.on('error', (err) => reject(new RuntimeError(ErrorCodes.DOCKER_STREAM_ERROR, 500)));
            });
        } catch (error: any) {
            throw new RuntimeError(ErrorCodes.DOCKER_EXEC_ERROR, 500);
        }
    }

    async createNetwork(name: string): Promise<{ id: string; name: string }> {
        try {
            const network = await this.docker.createNetwork({
                Name: name,
                Driver: 'bridge',
                CheckDuplicate: true
            });
            const info = await network.inspect();
            return { id: info.Id, name: info.Name };
        } catch (error: any) {
            throw new RuntimeError(ErrorCodes.DOCKER_NETWORK_CREATE_ERROR, 500);
        }
    }

    async removeNetwork(networkId: string): Promise<void> {
        try {
            const network = this.docker.getNetwork(networkId);
            await network.remove();
        } catch (error: any) {
            if (error.statusCode !== 404) {
                throw new RuntimeError(ErrorCodes.DOCKER_NETWORK_REMOVE_ERROR, 500);
            }
        }
    }

    async connectContainerToNetwork(containerId: string, networkId: string): Promise<void> {
        try {
            const network = this.docker.getNetwork(networkId);
            await network.connect({ Container: containerId });
        } catch (error: any) {
            throw new RuntimeError(ErrorCodes.DOCKER_NETWORK_CONNECT_ERROR, 500);
        }
    }

    async createVolume(name: string): Promise<{ id: string; name: string }> {
        try {
            const volume = await this.docker.createVolume({
                Name: name,
                Driver: 'local'
            });
            return { id: volume.Name || name, name: volume.Name || name };
        } catch (error: any) {
            throw new RuntimeError(ErrorCodes.DOCKER_VOLUME_CREATE_ERROR, 500);
        }
    }

    async removeVolume(volumeName: string): Promise<void> {
        try {
            const volume = this.docker.getVolume(volumeName);
            await volume.remove();
        } catch (error: any) {
            if (error.statusCode !== 404) {
                throw new RuntimeError(ErrorCodes.DOCKER_VOLUME_REMOVE_ERROR, 500);
            }
        }
    }
};

export const dockerService = new DockerService();
