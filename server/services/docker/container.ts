import { Container, ContainerCreateOptions, ContainerInspectInfo, ContainerStats } from 'dockerode';
import { execSync } from 'child_process';
import { docker } from '@/services/docker/client';
import networkService from '@/services/docker/network';
import volumeService from '@/services/docker/volume';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import logger from '@/logger';

const MAX_EXEC_BUFFER_SIZE = 10 * 1024 * 1024;

class ContainerService {
    private pullLocks: Map<string, Promise<void>> = new Map();

    // --- High Level Business Logic ---

    /**
     * Prepares and creates a container with associated network and volume.
     */
    async createContainer(data: any, userId: string, teamId: string) {
        const { name, image, env, ports, cmd, mountDockerSocket, useImageCmd, memory, cpus } = data;

        const Env = env ? env.map((e: any) => `${e.key}=${e.value}`) : [];
        const PortBindings: Record<string, any> = {};
        const ExposedPorts: Record<string, any> = {};

        if (ports) {
            ports.forEach((p: any) => {
                const portKey = `${p.private}/tcp`;
                ExposedPorts[portKey] = {};
                PortBindings[portKey] = [{ HostPort: String(p.public) }];
            });
        }

        let containerCmd = cmd && Array.isArray(cmd) && cmd.length > 0 ? cmd : undefined;
        if (!containerCmd && !useImageCmd) {
            containerCmd = ['tail', '-f', '/dev/null'];
        }

        const HostConfig: any = {
            PortBindings,
            Memory: (memory || 512) * 1024 * 1024,
            NanoCpus: (cpus || 1) * 1_000_000_000
        };

        // Create named volume for data persistence (or get name if exists)
        const volumeBind = volumeService.getDataBind(name);
        HostConfig.Binds = HostConfig.Binds || [];
        HostConfig.Binds.push(volumeBind);

        if (mountDockerSocket) {
            HostConfig.Binds.push('/var/run/docker.sock:/var/run/docker.sock');
            try {
                const dockerGid = execSync("getent group docker | cut -d: -f3").toString().trim();
                if (dockerGid) HostConfig.GroupAdd = [dockerGid];
            } catch (e) {
                console.warn('Could not detect docker group ID:', e);
            }
        }

        const dockerConfig = {
            Image: image,
            name: `${name.replace(/\s+/g, '-')}-${Date.now()}`,
            Env,
            ExposedPorts,
            HostConfig,
            Tty: true,
            Cmd: containerCmd
        } as any;

        const dockerContainer = await this.createDockerContainer(dockerConfig);
        await dockerContainer.start();

        // Create Docker network for container
        const { networkDoc } = await networkService.createNetwork(name);

        // Connect container to network
        await networkService.connectContainer(dockerContainer.id, networkDoc.networkId);

        const { volumeDoc } = await volumeService.createVolume(name);

        // Re-inspect to get IP after network connection
        const containerInfo = await dockerContainer.inspect();
        const internalIp = networkService.getContainerIp(containerInfo, name);

        return {
            ...data,
            team: teamId,
            containerId: containerInfo.Id,
            internalIp,
            network: networkDoc._id,
            volume: volumeDoc._id,
            status: containerInfo.State.Status,
            createdBy: userId
        };
    }

    /**
     * Updates a container, potentially recreating it if config changes.
     */
    async updateContainer(data: any, currentDoc: any) {
        const { action, env, ports } = data;

        if (action) {
            return await this.handleContainerAction(currentDoc, action, data);
        }

        // Commit current container to temporary image to preserve filesystem changes
        const tempImageName = `volterra-temp-${currentDoc.name.replace(/\s+/g, '-').toLowerCase()}:${Date.now()}`;
        try {
            const oldContainer = this.getContainer(currentDoc.containerId);
            await oldContainer.commit({
                repo: tempImageName.split(':')[0],
                tag: tempImageName.split(':')[1]
            });
        } catch (e) {
            console.warn('Could not commit container, using original image:', e);
        }

        // Stop and remove old container (volumes are preserved)
        try {
            await this.stopContainer(currentDoc.containerId);
            await this.removeContainer(currentDoc.containerId);
        } catch (e) { /* container may be gone */ }

        const Env = env ? env.map((e: any) => `${e.key}=${e.value}`) : [];
        const PortBindings: Record<string, any> = {};
        const ExposedPorts: Record<string, any> = {};

        if (ports) {
            ports.forEach((p: any) => {
                const portKey = `${p.private}/tcp`;
                ExposedPorts[portKey] = {};
                PortBindings[portKey] = [{ HostPort: String(p.public) }];
            });
        }

        // Reuse volume to preserve data
        const volumeBind = volumeService.getDataBind(currentDoc.name);

        const dockerConfig = {
            Image: tempImageName || currentDoc.image,
            name: `${currentDoc.name.replace(/\s+/g, '-')}-${Date.now()}`,
            Env,
            ExposedPorts,
            HostConfig: {
                PortBindings,
                Memory: currentDoc.memory * 1024 * 1024,
                NanoCpus: currentDoc.cpus * 1_000_000_000,
                Binds: [volumeBind]
            },
            Tty: true
        } as any;

        const dockerContainer = await this.createDockerContainer(dockerConfig);
        await dockerContainer.start();

        if (currentDoc.network) {
            await networkService.connectContainerByDocId(dockerContainer.id, currentDoc.network);
        }

        const containerInfo = await dockerContainer.inspect();
        const internalIp = networkService.getContainerIp(containerInfo, currentDoc.name);

        return {
            ...data,
            containerId: containerInfo.Id,
            internalIp,
            status: containerInfo.State.Status
        };
    }

    private async handleContainerAction(currentDoc: any, action: string, data: any) {
        if (action === 'start') {
            await this.startContainer(currentDoc.containerId);
        } else if (action === 'stop') {
            await this.stopContainer(currentDoc.containerId);
        } else if (action === 'restart') {
            await this.stopContainer(currentDoc.containerId);
            await this.startContainer(currentDoc.containerId);
        }

        const info = await this.inspectContainer(currentDoc.containerId);
        return { ...data, status: info.State.Status };
    }

    async deleteContainer(doc: any) {
        try {
            await this.stopContainer(doc.containerId);
            await this.removeContainer(doc.containerId);

            // Delete Docker network (cascade delete will handle MongoDB cleanup)
            if (doc.network) {
                await networkService.removeNetworkByDocId(doc.network);
            }
        } catch (e) {
            /* ignore if already removed */
        }
    }

    async getStats(container: any) {
        const stats = await this.getDockerContainerStats(container.containerId);
        return {
            stats,
            limits: { memory: container.memory * 1024 * 1024, cpus: container.cpus }
        };
    }

    async getFiles(container: any, path: string = '/') {
        const output = await this.execCommand(container.containerId, ['ls', '-la', String(path)]);
        const lines = output.split('\n').slice(1);
        return lines.map((line: string) => {
            const parts = line.trim().split(/\s+/);
            if (parts.length < 9) return null;
            return {
                name: parts.slice(8).join(' '),
                isDirectory: parts[0].startsWith('d'),
                size: parts[4],
                permissions: parts[0],
                updatedAt: `${parts[5]} ${parts[6]} ${parts[7]}`
            };
        }).filter(Boolean).filter((f: any) => f.name !== '.' && f.name !== '..');
    }

    async readFile(container: any, path: string) {
        return await this.execCommand(container.containerId, ['cat', path]);
    }

    async getProcesses(container: any) {
        return await this.getDockerContainerProcesses(container.containerId);
    }

    // --- Low Level Docker Logic ---

    async createDockerContainer(config: ContainerCreateOptions): Promise<Container> {
        if (!config.Image) {
            throw new RuntimeError(ErrorCodes.DOCKER_CREATE_MISSING_IMAGE, 400);
        }

        try {
            await this.ensureImage(config.Image);
            return await docker.createContainer(config);
        } catch (error: any) {
            throw new RuntimeError(ErrorCodes.DOCKER_CREATE_ERROR, 500);
        }
    }

    private async pullImage(imageName: string): Promise<void> {
        try {
            const image = docker.getImage(imageName);
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
            docker.pull(imageName, (err: any, stream: any) => {
                if (err) return reject(err);
                docker.modem.followProgress(stream, (err, output) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
        });
    }

    async stopContainer(containerId: string): Promise<void> {
        try {
            const container = docker.getContainer(containerId);
            await container.stop();
        } catch (error: any) {
            if (error.statusCode !== 304 && error.statusCode !== 404) {
                throw new RuntimeError(ErrorCodes.DOCKER_STOP_ERROR, 500);
            }
        }
    }

    async removeContainer(containerId: string): Promise<void> {
        try {
            const container = docker.getContainer(containerId);
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
            const container = docker.getContainer(containerId);
            await container.start();
        } catch (error: any) {
            // 304 = Already Started(HTTP 304 Not Modified)
            if (error.statusCode !== 304) {
                throw new RuntimeError(ErrorCodes.DOCKER_START_ERROR, 500);
            }
        }
    }

    async getDockerContainerStats(containerId: string): Promise<ContainerStats> {
        try {
            const container = docker.getContainer(containerId);
            return await container.stats({ stream: false });
        } catch (error: any) {
            throw new RuntimeError(ErrorCodes.DOCKER_STATS_ERROR, 500);
        }
    }

    async inspectContainer(containerId: string): Promise<ContainerInspectInfo> {
        try {
            const container = docker.getContainer(containerId);
            return await container.inspect();
        } catch (error: any) {
            throw new RuntimeError(ErrorCodes.DOCKER_INSPECT_ERROR, 500);
        }
    }

    public getContainer(containerId: string): Container {
        return docker.getContainer(containerId);
    }

    async getDockerContainerProcesses(containerId: string): Promise<any> {
        try {
            const container = docker.getContainer(containerId);
            return await container.top({ ps_args: '-o pid,comm,args,nlwp,user,rss,pcpu' });
        } catch (error: any) {
            throw new RuntimeError(ErrorCodes.DOCKER_TOP_ERROR, 500);
        }
    }

    async execCommand(containerId: string, command: string[]): Promise<string> {
        try {
            const container = docker.getContainer(containerId);
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

                docker.modem.demuxStream(stream,
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
}

export default new ContainerService();
