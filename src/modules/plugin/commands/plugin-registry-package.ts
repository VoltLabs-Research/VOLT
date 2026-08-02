import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';

/** Unpacks an npm-style plugin registry package into the single binary the daemon stores. */

interface RegistryEntrypoint {
    type?: string;
    binary?: string;
    binaryFileName?: string;
}

interface RegistryEntrypointNode {
    type?: string;
    data?: { entrypoint?: RegistryEntrypoint };
}

/** archiver ships no typings for its ZipArchive export, so its surface is declared here. */
interface ProjectArchive {
    pipe(destination: NodeJS.WritableStream): unknown;
    file(filepath: string, data: { name: string }): unknown;
    on(event: 'error', listener: (error: Error) => void): unknown;
    finalize(): Promise<void>;
}

type ZipArchiveConstructor = new (options?: { zlib?: { level?: number } }) => ProjectArchive;

export const downloadVerifiedTarball = async (url: string, expectedSha256: string): Promise<Buffer> => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new ApplicationError(ErrorCodes.PLUGIN_REGISTRY_DOWNLOAD_FAILED, `Registry download failed with status ${response.status}`, { statusCode: 502 });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const actualSha256 = createHash('sha256').update(buffer).digest('hex');
    if (actualSha256 !== expectedSha256) {
        throw new ApplicationError(ErrorCodes.PLUGIN_REGISTRY_CHECKSUM_MISMATCH, 'Downloaded plugin tarball failed checksum verification', { statusCode: 422 });
    }

    return buffer;
};

export const readRegistryWorkflow = async (extractDir: string): Promise<unknown> => {
    const [pluginJsonPath] = await fg('**/plugin.json', {
        cwd: extractDir,
        absolute: true,
        dot: true
    });
    if (!pluginJsonPath) {
        throw new ApplicationError(ErrorCodes.PLUGIN_REGISTRY_WORKFLOW_MISSING, 'plugin.json not found in registry package', { statusCode: 422 });
    }

    const parsed = JSON.parse(await fs.readFile(pluginJsonPath, 'utf-8')) as { workflow?: unknown };
    if (!parsed.workflow) {
        throw new ApplicationError(ErrorCodes.PLUGIN_REGISTRY_WORKFLOW_MISSING, 'plugin.json does not contain a workflow', { statusCode: 422 });
    }

    return parsed.workflow;
};

export const resolveRegistryEntrypoint = (workflow: unknown): RegistryEntrypoint => {
    const nodes = (workflow as { nodes?: RegistryEntrypointNode[] }).nodes ?? [];
    const entrypoint = nodes.find((node) => node.type === 'entrypoint')?.data?.entrypoint;
    if (!entrypoint || !(entrypoint.binaryFileName ?? entrypoint.binary)) {
        throw new ApplicationError(ErrorCodes.PLUGIN_REGISTRY_BINARY_MISSING, 'Workflow entrypoint does not declare a binary', { statusCode: 422 });
    }

    return entrypoint;
};

export const locateRegistryExecutable = async (extractDir: string, binaryName: string): Promise<string> => {
    const matches = await fg(`**/bin/${fg.escapePath(binaryName)}`, {
        cwd: extractDir,
        absolute: true,
        dot: true,
        onlyFiles: true
    });
    const found = matches[0] ?? (await fg(`**/${fg.escapePath(binaryName)}`, {
        cwd: extractDir,
        absolute: true,
        dot: true,
        onlyFiles: true
    }))[0];
    if (!found) {
        throw new ApplicationError(ErrorCodes.PLUGIN_REGISTRY_BINARY_MISSING, `Binary ${binaryName} not found in registry package`, { statusCode: 422 });
    }

    return found;
};

export const packageRegistryProjectZip = async (extractDir: string, destPath: string): Promise<void> => {
    await fs.rm(path.join(extractDir, 'plugin.json'), { force: true });
    const { ZipArchive } = require('archiver') as { ZipArchive: ZipArchiveConstructor };
    const output = createWriteStream(destPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const closed = new Promise<void>((resolve, reject) => {
        output.on('close', () => resolve());
        archive.on('error', reject);
    });

    archive.pipe(output);
    const files = await fg('**/*', {
        cwd: extractDir,
        onlyFiles: true,
        followSymbolicLinks: true,
        dot: true
    });
    for (const relativePath of files) {
        archive.file(await fs.realpath(path.join(extractDir, relativePath)), { name: relativePath });
    }
    await archive.finalize();
    await closed;
};
