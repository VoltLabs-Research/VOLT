import { runContainerExec } from '@shared/runtime/docker-exec';
import path from 'node:path';
import type { DockerExecOptions } from '@shared/runtime/docker-exec';
import type Docker from 'dockerode';

const normalizeContainerPath = (targetPath: string): string => {
    if (targetPath === '') {
        return '/';
    }

    const normalizedPath = path.posix.normalize(targetPath);
    return normalizedPath.startsWith('/') ? normalizedPath : path.posix.join('/', normalizedPath);
};

export const readContainerFile = (
    docker: Docker,
    containerId: string,
    filePath: string,
    options?: DockerExecOptions
): Promise<string> => runContainerExec(
    docker,
    containerId,
    ['sh', '-c', 'cat -- "$1"', '--', normalizeContainerPath(filePath)],
    undefined,
    options
);

export const writeContainerFile = async (
    docker: Docker,
    containerId: string,
    filePath: string,
    content: string,
    options?: DockerExecOptions
): Promise<void> => {
    const normalizedPath = normalizeContainerPath(filePath);
    await runContainerExec(docker, containerId, ['mkdir', '-p', '--', path.posix.dirname(normalizedPath)], undefined, options);
    await runContainerExec(docker, containerId, ['tee', '--', normalizedPath], content, options);
};
