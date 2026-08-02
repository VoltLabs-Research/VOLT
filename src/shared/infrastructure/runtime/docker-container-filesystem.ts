import { runContainerExec } from '@shared/infrastructure/runtime/docker-exec';
import path from 'node:path';
import type { DockerExecOptions } from '@shared/infrastructure/runtime/docker-exec';
import type Docker from 'dockerode';

export interface RuntimeContainerFileEntry {
    name: string;
    isDirectory: boolean;
    size: string;
    permissions: string;
    owner: string;
    group: string;
    date: string;
}

const FIND_PRINTF_FORMAT = '%P\0%y\0%s\0%M\0%u\0%g\0%TY-%Tm-%TdT%TH:%TM:%TS\0';

const POSIX_LISTING_SCRIPT = `target="$1"
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
 done`;

const normalizeContainerPath = (targetPath: string): string => {
    if (targetPath === '') {
        return '/';
    }

    const normalizedPath = path.posix.normalize(targetPath);
    return normalizedPath.startsWith('/') ? normalizedPath : path.posix.join('/', normalizedPath);
};

const parseListingOutput = (output: string): RuntimeContainerFileEntry[] => {
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
};

export const listContainerFiles = async (
    docker: Docker,
    containerId: string,
    directoryPath: string,
    options?: DockerExecOptions
): Promise<RuntimeContainerFileEntry[]> => {
    const normalizedDirectoryPath = normalizeContainerPath(directoryPath);

    try {
        const output = await runContainerExec(docker, containerId, [
            'find',
            normalizedDirectoryPath,
            '-mindepth', '1',
            '-maxdepth', '1',
            '-printf', FIND_PRINTF_FORMAT
        ], undefined, options);
        return parseListingOutput(output);
    } catch {
        const output = await runContainerExec(
            docker,
            containerId,
            ['sh', '-c', POSIX_LISTING_SCRIPT, '--', normalizedDirectoryPath],
            undefined,
            options
        );
        return parseListingOutput(output);
    }
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
