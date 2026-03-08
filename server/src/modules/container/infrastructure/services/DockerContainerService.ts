import { ErrorCodes } from '@core/constants/error-codes';
import type {
    ContainerFileEntry,
    ContainerProcessInfo,
    ContainerResourceReference,
    ContainerStats,
    ContainerTerminalAttachment,
    CreateRuntimeContainerOptions,
    IContainerService,
    RuntimeContainerInfo
} from '@modules/container/domain/port/IContainerService';
import { buildDockerContainerConfig } from '@modules/container/utilities/DockerContainerConfigFactory';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import logger from '@shared/infrastructure/logger';
import Docker from 'dockerode';
import net from 'node:net';
import path from 'node:path';
import { Writable } from 'node:stream';
import type { Readable } from 'node:stream';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { injectable } from 'tsyringe';

const MAX_EXEC_BUFFER_SIZE = 10 * 1024 * 1024;
const LOCAL_SCRIPTING_IMAGE_NAME = 'volt-scripting-env:latest';
const LOCAL_SCRIPTING_IMAGE_BUILD_COMMAND = 'cd server/docker/scripting && docker build -t volt-scripting-env:latest .';
const execFileAsync = promisify(execFile);

interface DockerApiError {
    statusCode?: number;
    message?: string;
};

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

    async createContainer(config: CreateRuntimeContainerOptions): Promise<RuntimeContainerInfo> {
        try {
            const dockerConfig = buildDockerContainerConfig(config);
            const container = await this.docker.createContainer(dockerConfig);
            return container.inspect();
        } catch (error: unknown) {
            const errorMessage = this.getErrorMessage(error);
            logger.error(`Failed to create docker container: ${errorMessage}`);
            throw this.toOperationError(
                error,
                ErrorCodes.CONTAINER_CREATION_FAILED,
                'Failed to create docker container',
                false
            );
        }
    }

    async startContainer(containerId: string): Promise<void> {
        try {
            const container = this.docker.getContainer(containerId);
            await container.start();
        } catch (error: unknown) {
            const dockerError = this.getDockerError(error);

            if (dockerError.statusCode === 304) {
                return;
            }

            const errorMessage = this.getErrorMessage(error);
            logger.error(`Failed to start container ${containerId}: ${errorMessage}`);
            throw this.toOperationError(
                error,
                ErrorCodes.CONTAINER_START_FAILED,
                `Failed to start container ${containerId}`
            );
        }
    }

    async stopContainer(containerId: string): Promise<void> {
        try {
            const container = this.docker.getContainer(containerId);
            await container.stop();
        } catch (error: unknown) {
            const dockerError = this.getDockerError(error);

            if (dockerError.statusCode === 304 || dockerError.statusCode === 404) {
                return;
            }

            const errorMessage = this.getErrorMessage(error);
            logger.error(`Failed to stop container ${containerId}: ${errorMessage}`);
            throw this.toOperationError(
                error,
                ErrorCodes.CONTAINER_STOP_FAILED,
                `Failed to stop container ${containerId}`
            );
        }
    }

    async removeContainer(containerId: string): Promise<void> {
        try {
            const container = this.docker.getContainer(containerId);
            await container.remove({ force: true, v: true });
        } catch (error: unknown) {
            const dockerError = this.getDockerError(error);

            if (dockerError.statusCode === 404) {
                return;
            }

            if (dockerError.statusCode === 409 && dockerError.message?.includes('in progress')) {
                return;
            }

            const errorMessage = this.getErrorMessage(error);
            logger.error(`Failed to remove container ${containerId}: ${errorMessage}`);
            throw this.toOperationError(
                error,
                ErrorCodes.CONTAINER_DELETION_FAILED,
                `Failed to remove container ${containerId}`
            );
        }
    }

    async getStats(containerId: string): Promise<ContainerStats> {
        try {
            const container = this.docker.getContainer(containerId);
            return await container.stats({ stream: false });
        } catch (error: unknown) {
            const errorMessage = this.getErrorMessage(error);
            logger.error(`Failed to get stats for ${containerId}: ${errorMessage}`);
            throw this.toOperationError(
                error,
                ErrorCodes.CONTAINER_STATS_FAILED,
                `Failed to get stats for ${containerId}`
            );
        }
    }

    async getFiles(containerId: string, directoryPath: string = '/'): Promise<ContainerFileEntry[]> {
        try {
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
            } catch (findError: unknown) {
                logger.warn(`Falling back to portable directory listing for ${containerId}:${normalizedDirectoryPath} - ${this.getErrorMessage(findError)}`);
                return await this.getFilesWithPortableListing(containerId, normalizedDirectoryPath);
            }
        } catch (error: unknown) {
            const errorMessage = this.getErrorMessage(error);
            logger.error(`Failed to list files in ${containerId}: ${errorMessage}`);
            throw this.toOperationError(
                error,
                ErrorCodes.CONTAINER_FILE_READ_FAILED,
                `Failed to list files in ${containerId}`
            );
        }
    }

    async readFile(containerId: string, filePath: string): Promise<string> {
        try {
            const normalizedPath = this.normalizeContainerPath(filePath);
            await this.exec(containerId, ['test', '-e', normalizedPath]);
            const entryType = (await this.exec(containerId, ['sh', '-c', 'if [ -d "$1" ]; then printf "directory"; else printf "file"; fi', '--', normalizedPath])).trim();

            if (entryType === 'directory') {
                throw new ApplicationError(
                    ErrorCodes.CONTAINER_FILE_IS_DIRECTORY,
                    `Path ${normalizedPath} is a directory and cannot be opened as a file`,
                    400
                );
            }

            const binaryCheck = await this.exec(containerId, [
                'sh',
                '-c',
                'if LC_ALL=C grep -q "[[:cntrl:]]" "$1" 2>/dev/null; then printf "binary"; else printf "text"; fi',
                '--',
                normalizedPath
            ]);

            if (binaryCheck.trim() === 'binary') {
                throw new ApplicationError(
                    ErrorCodes.CONTAINER_FILE_BINARY_UNSUPPORTED,
                    `Path ${normalizedPath} appears to be binary and cannot be previewed as text`,
                    400
                );
            }

            const output = await this.exec(containerId, ['sh', '-c', 'cat -- "$1"', '--', normalizedPath]);
            return output.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');
        } catch (error: unknown) {
            throw this.toOperationError(
                error,
                ErrorCodes.CONTAINER_FILE_READ_FAILED,
                `Failed to read file ${filePath} from container ${containerId}`
            );
        }
    }

    async writeFile(containerId: string, filePath: string, content: string): Promise<void> {
        try {
            const normalizedPath = this.normalizeContainerPath(filePath);
            const dir = path.posix.dirname(normalizedPath);
            await this.exec(containerId, ['mkdir', '-p', '--', dir]);
            await this.exec(containerId, ['tee', '--', normalizedPath], content);
        } catch (error: unknown) {
            throw this.toOperationError(
                error,
                ErrorCodes.CONTAINER_FILE_READ_FAILED,
                `Failed to write file ${filePath} to container ${containerId}`
            );
        }
    }

    async getProcesses(containerId: string): Promise<ContainerProcessInfo[]> {
        try {
            const container = this.docker.getContainer(containerId);
            const result = await container.top({ ps_args: '-o pid,comm,nlwp,user,rss,pcpu,args' });
            return Array.isArray(result.Processes) ? result.Processes : [];
        } catch (error: unknown) {
            const errorMessage = this.getErrorMessage(error);
            logger.error(`Failed to get processes for ${containerId}: ${errorMessage}`);
            throw this.toOperationError(
                error,
                ErrorCodes.CONTAINER_EXEC_FAILED,
                `Failed to get processes for ${containerId}`
            );
        }
    }

    async getPublishedPort(containerId: string, privatePort: number): Promise<number | null> {
        try {
            const container = this.docker.getContainer(containerId);
            const info = await container.inspect();
            const bindingKey = `${privatePort}/tcp`;
            const bindings = info?.NetworkSettings?.Ports?.[bindingKey];

            if (!Array.isArray(bindings) || bindings.length === 0) {
                return null;
            }

            const hostPort = Number(bindings[0]?.HostPort);
            return Number.isFinite(hostPort) ? hostPort : null;
        } catch {
            return null;
        }
    }

    async resolveDockerSocketGroupAdd(): Promise<string[]> {
        try {
            const { stdout } = await execFileAsync('getent', ['group', 'docker']);
            const dockerGid = stdout.split(':')[2]?.trim();
            return dockerGid ? [dockerGid] : [];
        } catch {
            return [];
        }
    }

    private async isHostPortAvailable(port: number): Promise<boolean> {
        return new Promise((resolve) => {
            const server = net.createServer();
            server.unref();

            server.on('error', () => {
                resolve(false);
            });

            server.listen(port, '0.0.0.0', () => {
                server.close(() => resolve(true));
            });
        });
    }

    async findAvailableHostPort(start: number, end: number): Promise<number | null> {
        for (let port = start; port <= end; port += 1) {
            if (await this.isHostPortAvailable(port)) {
                return port;
            }
        }

        return null;
    }

    async exec(containerId: string, command: string[], stdin?: string): Promise<string> {
        try {
            const container = this.docker.getContainer(containerId);
            const dockerExec = await container.exec({
                Cmd: command,
                AttachStdin: typeof stdin === 'string',
                AttachStdout: true,
                AttachStderr: true
            });
            const stream = await dockerExec.start({ hijack: true, stdin: typeof stdin === 'string' });

            return new Promise<string>((resolve, reject) => {
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

                try {
                    const stdoutSink = new Writable({
                        write(chunk, _encoding, callback) {
                            safeWrite(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                            callback();
                        }
                    });
                    const stderrSink = new Writable({
                        write(chunk, _encoding, callback) {
                            safeWrite(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                            callback();
                        }
                    });
                    this.docker.modem.demuxStream(stream, stdoutSink, stderrSink);
                } catch {
                    stream.on('data', safeWrite);
                }

                if (typeof stdin === 'string') {
                    try {
                        stream.write(stdin);
                        stream.end();
                    } catch (error) {
                        reject(error);
                        return;
                    }
                }

                stream.on('end', async () => {
                    try {
                        const inspection = await dockerExec.inspect();

                        if (typeof inspection.ExitCode === 'number' && inspection.ExitCode !== 0) {
                            reject(new Error(output.trim() || `Command failed with exit code ${inspection.ExitCode}`));
                            return;
                        }

                        resolve(output);
                    } catch (error) {
                        reject(error);
                    }
                });
                stream.on('error', (error) => reject(error));
            });
        } catch (error: unknown) {
            throw this.toOperationError(
                error,
                ErrorCodes.CONTAINER_EXEC_FAILED,
                `Failed to execute command in container ${containerId}`
            );
        }
    }

    async pullImage(imageName: string): Promise<void> {
        if (this.pullLocks.has(imageName)) {
            return this.pullLocks.get(imageName)!;
        }

        const pullPromise = new Promise<void>((resolve, reject) => {
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
        } catch (error: unknown) {
            const dockerError = this.getDockerError(error);

            if (dockerError.statusCode === 404) {
                if (imageName === LOCAL_SCRIPTING_IMAGE_NAME) {
                    throw ApplicationError.notFound(
                        ErrorCodes.RESOURCE_NOT_FOUND,
                        `Local image ${LOCAL_SCRIPTING_IMAGE_NAME} not found. Please build it first: ${LOCAL_SCRIPTING_IMAGE_BUILD_COMMAND}`
                    );
                }

                try {
                    await this.pullImage(imageName);
                } catch (pullError: unknown) {
                    throw this.toOperationError(
                        pullError,
                        ErrorCodes.CONTAINER_CREATION_FAILED,
                        `Failed to pull image ${imageName}`,
                        false
                    );
                }

                return;
            }

            throw this.toOperationError(
                error,
                ErrorCodes.CONTAINER_CREATION_FAILED,
                `Failed to inspect image ${imageName}`,
                false
            );
        }
    }

    async createNetwork(name: string): Promise<ContainerResourceReference> {
        const networkName = `Volt-${name.replace(/\s+/g, '-').toLowerCase()}-net`;

        try {
            const network = await this.docker.createNetwork({
                Name: networkName,
                Driver: 'bridge',
                CheckDuplicate: true
            });
            const info = await network.inspect();
            return {
                id: info.Id,
                name: info.Name
            };
        } catch (error: unknown) {
            const dockerError = this.getDockerError(error);

            if (dockerError.statusCode === 409) {
                const networks = await this.docker.listNetworks({
                    filters: JSON.stringify({
                        name: [networkName]
                    })
                });

                if (networks.length > 0) {
                    return {
                        id: networks[0].Id,
                        name: networks[0].Name
                    };
                }
            }

            const errorMessage = this.getErrorMessage(error);
            throw new ApplicationError(ErrorCodes.DOCKER_CONNECT_ERROR, `Failed to create network: ${errorMessage}`, 500);
        }
    }

    async removeNetwork(networkId: string): Promise<void> {
        try {
            const network = this.docker.getNetwork(networkId);
            await network.remove();
        } catch (error: unknown) {
            const dockerError = this.getDockerError(error);

            if (dockerError.statusCode === 404) {
                return;
            }

            logger.error(`Failed to remove network ${networkId}: ${dockerError.message || String(error)}`);
        }
    }

    async connectNetwork(networkId: string, containerId: string): Promise<void> {
        try {
            const network = this.docker.getNetwork(networkId);
            await network.connect({ Container: containerId });
        } catch (error: unknown) {
            const errorMessage = this.getErrorMessage(error);
            logger.error(`Failed to connect container ${containerId} to network ${networkId}: ${errorMessage}`);
            throw new ApplicationError(ErrorCodes.DOCKER_CONNECT_ERROR, errorMessage, 500);
        }
    }

    async createVolume(name: string): Promise<ContainerResourceReference> {
        const volumeName = `Volt-${name.replace(/\s+/g, '-').toLowerCase()}-data`;

        try {
            const volume = await this.docker.createVolume({
                Name: volumeName,
                Driver: 'local'
            });
            return {
                id: volume.Name || volumeName,
                name: volume.Name || volumeName
            };
        } catch (error: unknown) {
            const errorMessage = this.getErrorMessage(error);
            throw new ApplicationError(ErrorCodes.DOCKER_CONNECT_ERROR, `Failed to create volume: ${errorMessage}`, 500);
        }
    }

    async removeVolume(name: string): Promise<void> {
        try {
            const volume = this.docker.getVolume(name);
            await volume.remove();
        } catch (error: unknown) {
            const dockerError = this.getDockerError(error);

            if (dockerError.statusCode === 404) {
                return;
            }

            logger.error(`Failed to remove volume ${name}: ${dockerError.message || String(error)}`);
        }
    }

    async commitContainer(containerId: string, repo: string, tag: string): Promise<void> {
        try {
            const container = this.docker.getContainer(containerId);
            await container.commit({ repo, tag });
        } catch (error: unknown) {
            const errorMessage = this.getErrorMessage(error);
            logger.error(`Failed to commit container ${containerId}: ${errorMessage}`);
            throw this.toOperationError(
                error,
                ErrorCodes.DOCKER_CREATE_ERROR,
                `Failed to commit container ${containerId}`
            );
        }
    }

    async attachTerminal(containerId: string): Promise<ContainerTerminalAttachment> {
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

            return {
                stream,
                exec
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new ApplicationError(ErrorCodes.DOCKER_CONNECT_ERROR, `Failed to attach terminal: ${errorMessage}`, 500);
        }
    }

    private normalizeContainerPath(targetPath: string): string {
        const normalizedPath = path.posix.normalize(targetPath || '/');

        if (normalizedPath === '.' || normalizedPath.length === 0) {
            return '/';
        }

        if (normalizedPath.startsWith('/')) {
            return normalizedPath;
        }

        return path.posix.join('/', normalizedPath);
    }

    private parseFindListingOutput(output: string): ContainerFileEntry[] {
        const tokens = output.split('\0')
            .map((token) => token.replace(/^\n+|\n+$/g, ''))
            .filter((token) => token.length > 0);
        const files: ContainerFileEntry[] = [];

        for (let index = 0; index + 6 < tokens.length; index += 7) {
            const name = tokens[index];
            const fileType = tokens[index + 1];
            const size = tokens[index + 2];
            const permissions = tokens[index + 3];
            const owner = tokens[index + 4];
            const group = tokens[index + 5];
            const date = tokens[index + 6];

            if (!name) {
                continue;
            }

            files.push({
                name,
                isDirectory: fileType === 'd',
                size,
                permissions,
                owner,
                group,
                date
            });
        }

        return files;
    }

    private async getFilesWithPortableListing(containerId: string, directoryPath: string): Promise<ContainerFileEntry[]> {
        const shellScript = `target="$1"
if [ ! -d "$target" ]; then
  echo "Directory not found: $target" >&2
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
  date=$(date -r "$entry" +"%Y-%m-%dT%H:%M:%S" 2>/dev/null || stat -c "%y" "$entry" 2>/dev/null | cut -d"." -f1 || printf "")
  printf '%s\\0%s\\0%s\\0%s\\0%s\\0%s\\0%s\\0' "$name" "$type" "$size" "$perms" "$owner" "$group" "$date"
done`;

        const output = await this.exec(containerId, ['sh', '-c', shellScript, '--', directoryPath]);
        return this.parseFindListingOutput(output);
    }

    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }

        return String(error);
    }

    private getDockerError(error: unknown): DockerApiError {
        if (typeof error !== 'object' || error === null) {
            return {};
        }

        const statusCode = Reflect.get(error, 'statusCode');
        const message = Reflect.get(error, 'message');
        const dockerError: DockerApiError = {};

        if (typeof statusCode === 'number') {
            dockerError.statusCode = statusCode;
        }

        if (typeof message === 'string') {
            dockerError.message = message;
        }

        return dockerError;
    }

    private toOperationError(
        error: unknown,
        code: string,
        fallbackMessage: string,
        mapContainerNotFound: boolean = true
    ): ApplicationError {
        if (error instanceof ApplicationError) {
            return error;
        }

        const dockerError = this.getDockerError(error);

        if (mapContainerNotFound && dockerError.statusCode === 404) {
            return ApplicationError.notFound(ErrorCodes.CONTAINER_NOT_FOUND, 'Container not found');
        }

        const errorMessage = this.getErrorMessage(error);

        if (errorMessage.length > 0) {
            return new ApplicationError(code, errorMessage, 500);
        }

        return new ApplicationError(code, fallbackMessage, 500);
    }
};
