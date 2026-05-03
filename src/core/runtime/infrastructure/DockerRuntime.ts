import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import type { ContainerAction } from '@/modules/container/contracts/http-container';
import { TEAM_CLUSTER_ID_LABEL_KEY, VOLT_MANAGED_CONTAINER_LABEL_KEY, VOLT_MANAGED_CONTAINER_LABEL_VALUE } from '@/core/runtime/contracts/runtime-container';
import { ProgressStageType } from '@voltstack/daemon-cluster-client';
import { withTimeout } from '@/core/observability/infrastructure/daemon-instrumentation';
import type { DaemonConfig } from '@/core/config';
import type { DaemonTraceContext } from '@/core/observability/infrastructure/daemon-instrumentation';
import type { RuntimeEventBroker } from '@/core/reverse-channel/application/RuntimeEventBroker';
import type { CreateContainerRequest } from '@/modules/container/contracts/http-container';
import { Writable, type Duplex } from 'node:stream';
import Docker from 'dockerode';
import net from 'node:net';
import path from 'node:path';

interface DockerContainerFilter {
    label?: string[];
}

interface DockerExecOptions {
    operationName?: string;
    timeoutMs?: number;
    traceContext?: DaemonTraceContext;
}

interface DockerTopProcessesResult {
    Processes: string[][];
}

interface DockerImagePullProgressEvent {
    status: string;
    id?: string;
    progress?: string;
}

interface DockerContainerCreateProgressPayload {
    image: string;
    step: string;
    containerName?: string;
    containerId?: string;
}

interface RuntimeContainerFileEntry {
    name: string;
    isDirectory: boolean;
    size: string;
    permissions: string;
    owner: string;
    group: string;
    date: string;
}

export interface RuntimeTerminalAttachment {
    stream: Duplex;
    exec: RuntimeTerminalExec;
}

interface RuntimeTerminalSize {
    rows: number;
    cols: number;
}

interface RuntimeTerminalExec {
    resize(size: RuntimeTerminalSize): Promise<void>;
}

interface HostPortBinding {
    HostPort: string;
}

const MAX_EXEC_BUFFER_SIZE = 10 * 1024 * 1024;
const DEFAULT_DOCKER_EXEC_TIMEOUT_MS = 120_000;

@Service('dockerRuntime')
export class DockerRuntime {
    private readonly docker: Docker;
    private readonly tenantLabel: string;

    constructor(
        private readonly eventBroker: RuntimeEventBroker,
        private readonly config: DaemonConfig
    ) {
        const dockerHost = process.env.DOCKER_HOST;

        if (dockerHost && dockerHost.startsWith('tcp://')) {
            const url = new URL(dockerHost);
            this.docker = new Docker({
                host: url.hostname,
                port: Number(url.port || 2375),
                timeout: 60_000
            });
        } else {
            this.docker = new Docker({
                socketPath: '/var/run/docker.sock',
                timeout: 60_000
            });
        }
        this.tenantLabel = this.config.teamClusterId;
    }

    private mergeTenantFilter(filters?: DockerContainerFilter): DockerContainerFilter {
        const tenantSelector = `${TEAM_CLUSTER_ID_LABEL_KEY}=${this.tenantLabel}`;
        const existingLabels = filters?.label ?? [];
        if (existingLabels.includes(tenantSelector)) {
            return filters ?? { label: [tenantSelector] };
        }
        return {
            ...filters,
            label: [...existingLabels, tenantSelector]
        };
    }

    readonly listContainers = (all: boolean = true, filters?: DockerContainerFilter): Promise<Docker.ContainerInfo[]> => {
        const scopedFilters = this.mergeTenantFilter(filters);
        return this.docker.listContainers({
            all,
            filters: JSON.stringify(scopedFilters)
        });
    };

    private async assertTenantOwnership(containerId: string): Promise<Docker.ContainerInspectInfo> {
        const info = await this.docker.getContainer(containerId).inspect();
        const labelValue = info.Config?.Labels?.[TEAM_CLUSTER_ID_LABEL_KEY];
        if (labelValue !== this.tenantLabel) {
            throw new Error(`Container ${containerId} is not owned by this tenant`);
        }
        return info;
    }

    private getPortsFromRequest(input: CreateContainerRequest){
        const exposedPorts: Record<string, Record<string, never>> = {};
        const portBindings: Record<string, HostPortBinding[]> = {};

        for(const port of input.ports ?? []){
            const key = `${port.private}/tcp`;
            exposedPorts[key] = {};
            portBindings[key] = [{ HostPort: port.public && port.public > 0 ? `${port.public}` : '' }];
        }
        
        return { exposedPorts, portBindings };
    }

    private getEnvFromRequest(input: CreateContainerRequest): string[] {
        return (input.env ?? []).map((entry) => `${entry.key}=${entry.value}`);
    }

    async createContainer(input: CreateContainerRequest): Promise<Docker.ContainerInspectInfo> {
        if (this.config.isDemoMode && input.binds?.some((bind) => bind.includes('docker.sock'))) {
            throw new Error('Mounting the Docker socket is disabled in demo mode. Connect your own cluster to enable this option.');
        }

        const env = this.getEnvFromRequest(input);
        const { exposedPorts, portBindings } = this.getPortsFromRequest(input);
        const { image, name: containerName } = input;

        this.emitContainerCreateProgress(input, ProgressStageType.Accepted, {
            image,
            containerName,
            step: 'accepted'
        });

        this.emitContainerCreateProgress(input, ProgressStageType.Running, {
            image,
            containerName,
            step: 'pulling-image'
        });

        await this.ensureImage(image);

        this.emitContainerCreateProgress(input, ProgressStageType.Running, {
            image,
            containerName,
            step: 'creating-container'
        });

        const container = await this.docker.createContainer({
            Image: input.image,
            name: input.name,
            User: input.user,
            Env: env,
            Cmd: input.cmd,
            Labels: {
                [VOLT_MANAGED_CONTAINER_LABEL_KEY]: VOLT_MANAGED_CONTAINER_LABEL_VALUE,
                [TEAM_CLUSTER_ID_LABEL_KEY]: this.tenantLabel,
                ...input.labels
            },
            ExposedPorts: exposedPorts,
            HostConfig: {
                Memory: input.memoryInMegabytes * 1024 * 1024,
                NanoCpus: Math.round(input.cpus * 1_000_000_000),
                Binds: input.binds,
                PortBindings: portBindings,
                NetworkMode: input.networkMode
            }
        });

        this.emitContainerCreateProgress(input, ProgressStageType.Running, {
            image,
            containerName,
            containerId: container.id,
            step: 'starting-container'
        });

        await container.start();
        const inspectedContainer = await container.inspect();

        this.emitContainerCreateProgress(input, ProgressStageType.Completed, {
            image: input.image,
            containerName: input.name,
            containerId: inspectedContainer.Id,
            step: 'container-ready'
        });

        return inspectedContainer;
    }

    readonly getContainer = async (containerId: string): Promise<Docker.ContainerInspectInfo> => {
        return this.assertTenantOwnership(containerId);
    };

    readonly startContainer = async (containerId: string): Promise<void> => {
        await this.assertTenantOwnership(containerId);
        await this.docker.getContainer(containerId).start();
    };

    async applyContainerAction(containerId: string, action: ContainerAction): Promise<Docker.ContainerInspectInfo> {
        await this.assertTenantOwnership(containerId);
        const container = this.docker.getContainer(containerId);

        if (action === 'start') {
            await container.start();
        } else if (action === 'stop') {
            await container.stop();
        } else if (action === 'restart') {
            await container.restart();
        }

        return container.inspect();
    }

    readonly deleteContainer = async (containerId: string): Promise<void> => {
        await this.assertTenantOwnership(containerId);
        await this.docker.getContainer(containerId).remove({ force: true, v: true });
    };

    readonly getContainerStats = async (containerId: string): Promise<Docker.ContainerStats> => {
        await this.assertTenantOwnership(containerId);
        return this.docker.getContainer(containerId).stats({ stream: false });
    };

    readonly getContainerProcesses = async (containerId: string): Promise<string[][]> => {
        await this.assertTenantOwnership(containerId);
        const result = await this.docker.getContainer(containerId).top({ ps_args: '-o pid,comm,nlwp,user,rss,pcpu,args' }) as DockerTopProcessesResult;
        return result.Processes;
    };

    readonly getContainerFiles = async (
        containerId: string,
        directoryPath: string,
        options?: DockerExecOptions
    ): Promise<RuntimeContainerFileEntry[]> => {
        await this.assertTenantOwnership(containerId);
        const normalizedDirectoryPath = this.normalizeContainerPath(directoryPath);

        try {
            const output = await this.execute(containerId, [
                'find',
                normalizedDirectoryPath,
                '-mindepth', '1',
                '-maxdepth', '1',
                '-printf', '%P\0%y\0%s\0%M\0%u\0%g\0%TY-%Tm-%TdT%TH:%TM:%TS\0'
            ], undefined, options);
            return this.parseFindListingOutput(output);
        } catch {
            const output = await this.execute(containerId, ['sh', '-c', `target="$1"
if [ ! -d "$target" ]; then
  exit 1
fi
for entry in "$target"/* "$target"/.[!.]* "$target"/..?*; do
  [ -e "$entry" ] || continue
  name=$(basename "$entry")
  if [ -d "$entry" ]; then
    type="d"
  else
    type="f"
  fi
  size=$(wc -c < "$entry" 2>/dev/null || printf "0")
  perms=$(ls -ld "$entry" | awk '{print $1}')
  owner=$(ls -ld "$entry" | awk '{print $3}')
  group=$(ls -ld "$entry" | awk '{print $4}')
  date=$(date -r "$entry" +"%Y-%m-%dT%H:%M:%S" 2>/dev/null || printf "")
  printf '%s\\0%s\\0%s\\0%s\\0%s\\0%s\\0%s\\0' "$name" "$type" "$size" "$perms" "$owner" "$group" "$date"
 done`, '--', normalizedDirectoryPath], undefined, options);
            return this.parseFindListingOutput(output);
        }
    };

    readonly readContainerFile = async (containerId: string, filePath: string, options?: DockerExecOptions): Promise<string> => {
        await this.assertTenantOwnership(containerId);
        const normalizedPath = this.normalizeContainerPath(filePath);
        return this.execute(containerId, ['sh', '-c', 'cat -- "$1"', '--', normalizedPath], undefined, options);
    };

    readonly writeContainerFile = async (
        containerId: string,
        filePath: string,
        content: string,
        options?: DockerExecOptions
    ): Promise<void> => {
        await this.assertTenantOwnership(containerId);
        const normalizedPath = this.normalizeContainerPath(filePath);
        await this.execute(containerId, ['mkdir', '-p', '--', path.posix.dirname(normalizedPath)], undefined, options);
        await this.execute(containerId, ['tee', '--', normalizedPath], content, options);
    };

    async attachTerminal(containerId: string): Promise<RuntimeTerminalAttachment> {
        await this.assertTenantOwnership(containerId);
        const container = this.docker.getContainer(containerId);
        const dockerExec = await container.exec({
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
            Cmd: ['/bin/sh'],
            Env: ['TERM=xterm-256color']
        });
        const stream = await dockerExec.start({ hijack: true, stdin: true }) as unknown as Duplex;

        return {
            stream,
            exec: {
                resize: ({ rows, cols }) => dockerExec.resize({
                    h: rows,
                    w: cols
                })
            }
        };
    }

    async removeComposeProject(composeProjectName: string): Promise<void> {
        const projectFilter = {
            label: [`com.docker.compose.project=${composeProjectName}`]
        };
        const containers = await this.docker.listContainers({
            all: true,
            filters: JSON.stringify(projectFilter)
        });
        const volumes = await this.docker.listVolumes({
            filters: projectFilter
        });
        const networks = await this.docker.listNetworks({
            filters: JSON.stringify(projectFilter)
        });

        for (const containerInfo of containers) {
            await this.docker.getContainer(containerInfo.Id).remove({ force: true, v: true });
        }

        for (const volumeInfo of volumes.Volumes) {
            await this.docker.getVolume(volumeInfo.Name).remove({ force: true });
        }

        for (const networkInfo of networks) {
            await this.docker.getNetwork(networkInfo.Id).remove();
        }
    }

    readonly findAvailableHostPort = async (start: number, end: number): Promise<number | null> => {
        for (let port = start; port <= end; port += 1) {
            const available = await new Promise<boolean>((resolve) => {
                const server = net.createServer();
                server.unref();
                server.on('error', () => resolve(false));
                server.listen(port, '0.0.0.0', () => {
                    server.close(() => resolve(true));
                });
            });
            if (available) {
                return port;
            }
        }

        return null;
    };

    readonly getPublishedPort = async (containerId: string, privatePort: number): Promise<number | null> => {
        try {
            const container = await this.getContainer(containerId);
            const bindingKey = `${privatePort}/tcp`;
            const bindings = container.NetworkSettings.Ports[bindingKey];
            if (bindings.length === 0) {
                return null;
            }

            return Number(bindings[0].HostPort);
        } catch {
            return null;
        }
    };

    async ensureImage(imageName: string): Promise<void> {
        const startedAt = Date.now();

        try {
            await this.docker.getImage(imageName).inspect();
            return;
        } catch (error) {
            logger.info(`Docker image not available locally; provisioning required for imageName=${imageName}, durationMs=${Date.now() - startedAt}, error=${error instanceof Error ? error.message : String(error)}`);
        }

        const pullStartedAt = Date.now();
        logger.info(`Provisioning Docker image from registry for imageName=${imageName}`);

        this.eventBroker?.emitProgress({
            action: 'container-create',
            stage: ProgressStageType.Running,
            timestamp: new Date().toISOString(),
            payload: {
                image: imageName,
                step: 'pulling-image'
            }
        });

        try {
            const stream = await new Promise<NodeJS.ReadableStream>((resolve, reject) => {
                this.docker.pull(imageName, (error: Error | null, output?: NodeJS.ReadableStream) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    if (!output) {
                        reject(new Error(`Docker pull returned no stream for ${imageName}`));
                        return;
                    }

                    resolve(output);
                });
            });

            let lastStatus = '';
            await new Promise<void>((resolve, reject) => {
                this.docker.modem.followProgress(stream, (error) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve();
                }, (event: DockerImagePullProgressEvent) => {
                    const status = event.status;
                    if (!status || status === lastStatus) {
                        return;
                    }

                    lastStatus = status;
                    logger.info(`Docker image pull progress for imageName=${imageName}: status=${status}, id=${event.id ?? 'none'}, progress=${event.progress ?? 'none'}`);
                });
            });
            logger.info(`Docker image pull completed for imageName=${imageName}, durationMs=${Date.now() - pullStartedAt}`);
        } catch (error) {
            logger.error(`Docker image pull failed for imageName=${imageName}, durationMs=${Date.now() - pullStartedAt}: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    private emitContainerCreateProgress(
        input: CreateContainerRequest,
        stage: ProgressStageType,
        payload: DockerContainerCreateProgressPayload
    ): void {
        if (!this.eventBroker || !input.operationId) {
            return;
        }

        this.eventBroker.emitProgress({
            action: 'container-create',
            stage,
            timestamp: new Date().toISOString(),
            payload: {
                operationId: input.operationId,
                ...payload
            }
        });
    }

    private normalizeContainerPath(targetPath: string): string {
        if (targetPath === '') {
            return '/';
        }

        const normalizedPath = path.posix.normalize(targetPath);
        return normalizedPath.startsWith('/') ? normalizedPath : path.posix.join('/', normalizedPath);
    }

    private parseFindListingOutput(output: string): RuntimeContainerFileEntry[] {
        const tokens = output.split('\0')
            .map((token) => token.replace(/^\n+|\n+$/g, ''))
            .filter((token) => token.length > 0);
        const files: RuntimeContainerFileEntry[] = [];

        for (let index = 0; index + 6 < tokens.length; index += 7) {
            const name = tokens[index];
            if (!name) {
                continue;
            }

            files.push({
                name,
                isDirectory: tokens[index + 1] === 'd',
                size: tokens[index + 2],
                permissions: tokens[index + 3],
                owner: tokens[index + 4],
                group: tokens[index + 5],
                date: tokens[index + 6]
            });
        }

        return files;
    }

    private readonly runExec = async (containerId: string, command: string[], stdin: string | undefined, hasStdin: boolean): Promise<string> => {
        try {
            const container = this.docker.getContainer(containerId);
            const dockerExec = await container.exec({
                Cmd: command,
                AttachStdin: hasStdin,
                AttachStdout: true,
                AttachStderr: true
            });
            const stream = await dockerExec.start({ hijack: true, stdin: hasStdin });
            let output = '';
            let totalBytes = 0;
            let truncated = false;

            const sink = new Writable({
                write: (chunk, _encoding, callback) => {
                    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

                    if (!truncated) {
                        if (totalBytes + buffer.length > MAX_EXEC_BUFFER_SIZE) {
                            output += buffer.slice(0, MAX_EXEC_BUFFER_SIZE - totalBytes).toString('utf8');
                            output += '\n... [TRUNCATED] ...';
                            truncated = true;
                        } else {
                            output += buffer.toString('utf8');
                        }

                        totalBytes += buffer.length;
                    }

                    callback();
                }
            });

            this.docker.modem.demuxStream(stream, sink, sink);

            if (stdin !== undefined) {
                stream.write(stdin);
                stream.end();
            }

            await new Promise<void>((resolve, reject) => {
                stream.once('end', resolve);
                stream.once('error', reject);
            });

            const inspection = await dockerExec.inspect();
            if (inspection.ExitCode && inspection.ExitCode !== 0) {
                throw new Error(output || `Command failed with exit code ${inspection.ExitCode}`);
            }

            return output;
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }

            throw new Error('Docker exec failed');
        }
    };

    private async execute(
        containerId: string,
        command: string[],
        stdin?: string,
        options: DockerExecOptions = {}
    ): Promise<string> {
        const {
            operationName = 'docker-exec',
            timeoutMs = DEFAULT_DOCKER_EXEC_TIMEOUT_MS,
            traceContext
        } = options;
        const hasStdin = stdin !== undefined;

        try {
            return await withTimeout(() => this.runExec(containerId, command, stdin, hasStdin), {
                operation: operationName,
                timeoutMs,
                payload: {
                    command: command.join(' '),
                    containerId
                },
                traceContext
            });
        } catch (error) {
            logger.warn('Docker exec operation failed');
            throw error;
        }
    }
}
