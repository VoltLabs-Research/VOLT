import {
    ContainerAction,
    ContainerEnvironmentVariable,
    ContainerPortMapping,
    CreateContainerRequest
} from '../contracts/http';
import Docker from 'dockerode';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { Writable } from 'node:stream';
import type { ContainerInfo } from 'dockerode';
import type { Duplex, Readable } from 'node:stream';

interface DockerContainerFilter {
    label?: string[];
};

interface DockerApiError {
    statusCode?: number;
    message?: string;
};

export interface RuntimeContainerFileEntry {
    name: string;
    isDirectory: boolean;
    size: string;
    permissions: string;
    owner: string;
    group: string;
    date: string;
};

export interface RuntimeTerminalAttachment {
    stream: Duplex;
    exec: Docker.Exec;
};

const MAX_EXEC_BUFFER_SIZE = 10 * 1024 * 1024;

const toEnvPairs = (environmentVariables: ContainerEnvironmentVariable[] = []): string[] => {
    return environmentVariables.map((entry) => `${entry.key}=${entry.value}`);
};

const toExposedPorts = (ports: ContainerPortMapping[] = []): Record<string, Record<string, never>> => {
    const exposedPorts: Record<string, Record<string, never>> = {};
    for (const port of ports) {
        exposedPorts[`${port.private}/tcp`] = {};
    }

    return exposedPorts;
};

const toPortBindings = (ports: ContainerPortMapping[] = []): Record<string, Array<{ HostPort: string }>> => {
    const portBindings: Record<string, Array<{ HostPort: string }>> = {};
    for (const port of ports) {
        portBindings[`${port.private}/tcp`] = [{ HostPort: String(port.public) }];
    }

    return portBindings;
};

export class DockerRuntimeService {
    private readonly docker: Docker;

    constructor() {
        this.docker = new Docker({
            socketPath: '/var/run/docker.sock',
            timeout: 60_000
        });
    }

    async listContainers(all: boolean = true, filters?: DockerContainerFilter): Promise<ContainerInfo[]> {
        if (!filters) {
            return this.docker.listContainers({ all });
        }

        return this.docker.listContainers({
            all,
            filters: JSON.stringify(filters)
        });
    }

    async createContainer(input: CreateContainerRequest): Promise<Docker.ContainerInspectInfo> {
        await this.ensureImage(input.image);
        const container = await this.docker.createContainer({
            Image: input.image,
            name: input.name,
            Env: toEnvPairs(input.env),
            Cmd: input.cmd,
            Labels: {
                'volt.managed': 'true',
                ...input.labels
            },
            ExposedPorts: toExposedPorts(input.ports),
            HostConfig: {
                Memory: input.memoryInMegabytes * 1024 * 1024,
                NanoCpus: Math.round(input.cpus * 1_000_000_000),
                Binds: input.binds,
                PortBindings: toPortBindings(input.ports)
            }
        });

        await container.start();
        return container.inspect();
    }

    async getContainer(containerId: string): Promise<Docker.ContainerInspectInfo> {
        return this.docker.getContainer(containerId).inspect();
    }

    async startContainer(containerId: string): Promise<void> {
        await this.docker.getContainer(containerId).start();
    }

    async applyContainerAction(containerId: string, action: ContainerAction): Promise<Docker.ContainerInspectInfo> {
        const container = this.docker.getContainer(containerId);
        if (action === ContainerAction.Start) {
            await container.start();
        }

        if (action === ContainerAction.Stop) {
            await container.stop();
        }

        if (action === ContainerAction.Restart) {
            await container.restart();
        }

        return container.inspect();
    }

    async deleteContainer(containerId: string): Promise<void> {
        await this.docker.getContainer(containerId).remove({ force: true, v: true });
    }

    async getContainerStats(containerId: string): Promise<Docker.ContainerStats> {
        return this.docker.getContainer(containerId).stats({ stream: false });
    }

    async getContainerProcesses(containerId: string): Promise<Record<string, unknown>[]> {
        const result = await this.docker.getContainer(containerId).top({ ps_args: '-o pid,comm,nlwp,user,rss,pcpu,args' });
        return Array.isArray(result.Processes) ? result.Processes : [];
    }

    async getContainerFiles(containerId: string, directoryPath: string): Promise<RuntimeContainerFileEntry[]> {
        const normalizedDirectoryPath = this.normalizeContainerPath(directoryPath);

        try {
            const output = await this.exec(containerId, [
                'find',
                normalizedDirectoryPath,
                '-mindepth', '1',
                '-maxdepth', '1',
                '-printf', '%P\0%y\0%s\0%M\0%u\0%g\0%TY-%Tm-%TdT%TH:%TM:%TS\0'
            ]);
            return this.parseFindListingOutput(output);
        } catch {
            const output = await this.exec(containerId, ['sh', '-c', `target="$1"
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
done`, '--', normalizedDirectoryPath]);
            return this.parseFindListingOutput(output);
        }
    }

    async readContainerFile(containerId: string, filePath: string): Promise<string> {
        const normalizedPath = this.normalizeContainerPath(filePath);
        return this.exec(containerId, ['sh', '-c', 'cat -- "$1"', '--', normalizedPath]);
    }

    async writeContainerFile(containerId: string, filePath: string, content: string): Promise<void> {
        const normalizedPath = this.normalizeContainerPath(filePath);
        await this.exec(containerId, ['mkdir', '-p', '--', path.posix.dirname(normalizedPath)]);
        await this.exec(containerId, ['tee', '--', normalizedPath], content);
    }

    async attachTerminal(containerId: string): Promise<RuntimeTerminalAttachment> {
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

        return {
            stream,
            exec
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

        const volumeList = Array.isArray(volumes.Volumes) ? volumes.Volumes : [];
        for (const volumeInfo of volumeList) {
            if (volumeInfo.Name) {
                await this.docker.getVolume(volumeInfo.Name).remove({ force: true });
            }
        }

        for (const networkInfo of networks) {
            await this.docker.getNetwork(networkInfo.Id).remove();
        }
    }

    async findAvailableHostPort(start: number, end: number): Promise<number | null> {
        for (let port = start; port <= end; port += 1) {
            const available = await this.isHostPortAvailable(port);
            if (available) {
                return port;
            }
        }

        return null;
    }

    async ensureImage(imageName: string): Promise<void> {
        try {
            await this.docker.getImage(imageName).inspect();
        } catch {
            await this.pullImage(imageName);
        }
    }

    async buildImage(imageName: string, contextPath: string): Promise<void> {
        const stream = await this.docker.buildImage({
            context: contextPath,
            src: ['Dockerfile', 'voltsdk']
        }, {
            t: imageName
        });

        await new Promise<void>((resolve, reject) => {
            this.docker.modem.followProgress(stream, (error, output) => {
                if (!error) {
                    resolve();
                    return;
                }

                const message = Array.isArray(output)
                    ? output
                        .map((entry) => {
                            if (typeof entry?.error === 'string') {
                                return entry.error;
                            }

                            if (typeof entry?.stream === 'string') {
                                return entry.stream.trim();
                            }

                            return '';
                        })
                        .filter(Boolean)
                        .join('\n')
                    : '';
                reject(new Error(message || error.message || 'Docker build failed'));
            });
        });
    }

    async exec(containerId: string, command: string[], stdin?: string): Promise<string> {
        return this.execute(containerId, command, stdin);
    }

    private pullImage(imageName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.docker.pull(imageName, (error: Error | null, stream?: Readable) => {
                if (error || !stream) {
                    reject(error);
                    return;
                }

                this.docker.modem.followProgress(stream, (progressError) => {
                    if (progressError) {
                        reject(progressError);
                        return;
                    }

                    resolve();
                });
            });
        });
    }

    private async isHostPortAvailable(port: number): Promise<boolean> {
        return new Promise((resolve) => {
            const server = net.createServer();
            server.unref();
            server.on('error', () => resolve(false));
            server.listen(port, '0.0.0.0', () => {
                server.close(() => resolve(true));
            });
        });
    }

    private normalizeContainerPath(targetPath: string): string {
        const normalizedPath = path.posix.normalize(targetPath || '/');
        if (normalizedPath === '.' || normalizedPath.length === 0) {
            return '/';
        }

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

    private execute(containerId: string, command: string[], stdin?: string): Promise<string> {
        return new Promise(async (resolve, reject) => {
            try {
                const container = this.docker.getContainer(containerId);
                const dockerExec = await container.exec({
                    Cmd: command,
                    AttachStdin: typeof stdin === 'string',
                    AttachStdout: true,
                    AttachStderr: true
                });
                const stream = await dockerExec.start({ hijack: true, stdin: typeof stdin === 'string' });
                let output = '';
                let totalBytes = 0;
                let truncated = false;

                const safeWrite = (chunk: Buffer) => {
                    if (truncated) {
                        return;
                    }

                    if (totalBytes + chunk.length > MAX_EXEC_BUFFER_SIZE) {
                        output += chunk.slice(0, MAX_EXEC_BUFFER_SIZE - totalBytes).toString('utf8');
                        output += '\n... [TRUNCATED] ...';
                        truncated = true;
                    } else {
                        output += chunk.toString('utf8');
                    }

                    totalBytes += chunk.length;
                };

                const stdoutSink = new Writable({
                    write(chunk, _encoding, callback) {
                        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                        safeWrite(buffer);
                        callback();
                    }
                });
                const stderrSink = new Writable({
                    write(chunk, _encoding, callback) {
                        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                        safeWrite(buffer);
                        callback();
                    }
                });

                this.docker.modem.demuxStream(stream, stdoutSink, stderrSink);

                if (typeof stdin === 'string') {
                    stream.write(stdin);
                    stream.end();
                }

                stream.on('end', async () => {
                    try {
                        const inspection = await dockerExec.inspect();
                        if (typeof inspection.ExitCode === 'number' && inspection.ExitCode !== 0) {
                            reject(new Error(output.trim() || `Command failed with exit code ${inspection.ExitCode}`));
                            return;
                        }

                        resolve(output);
                    } catch (error: unknown) {
                        reject(error);
                    }
                });
                stream.on('error', (error: Error) => reject(error));
            } catch (error: unknown) {
                const dockerError = this.getDockerError(error);
                reject(new Error(dockerError.message || 'Docker exec failed'));
            }
        });
    }

    private getDockerError(error: unknown): DockerApiError {
        if (typeof error !== 'object' || error === null) {
            return {};
        }

        const dockerError: DockerApiError = {};
        const statusCode = Reflect.get(error, 'statusCode');
        const message = Reflect.get(error, 'message');
        if (typeof statusCode === 'number') {
            dockerError.statusCode = statusCode;
        }

        if (typeof message === 'string') {
            dockerError.message = message;
        }

        return dockerError;
    }
}
