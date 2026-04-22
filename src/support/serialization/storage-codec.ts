import { PassThrough, Readable } from 'node:stream';
import { spawn } from 'node:child_process';

interface ZstdStreamResult {
    stream: Readable;
    completion: Promise<void>;
}

const DUMP_ZSTD_EXTENSION = '.dump.zst';
const ZSTD_NOT_INSTALLED_MESSAGE = 'zstd binary is not installed in the runtime image';

const rejectSpawnError = (reject: (error: Error) => void) => {
    return (error: NodeJS.ErrnoException): void => {
        if (error.code === 'ENOENT') {
            reject(new Error(ZSTD_NOT_INSTALLED_MESSAGE));
            return;
        }

        reject(error);
    };
};

const resolveZstdExit = (
    resolve: () => void,
    reject: (error: Error) => void,
    stderr: string
) => {
    return (code: number | null): void => {
        if (code === 0) {
            resolve();
            return;
        }

        reject(new Error(stderr || `zstd exited with code ${code}`));
    };
};

const createZstdStream = (args: string[], input: Readable | null = null): ZstdStreamResult => {
    const child = spawn('zstd', args, {
        stdio: ['pipe', 'pipe', 'pipe']
    });
    const output = new PassThrough();
    let stderr = '';

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
        stderr += chunk;
    });

    if (input) {
        input.pipe(child.stdin);
        input.on('error', (error) => child.stdin.destroy(error));
    } else {
        child.stdin.end();
    }

    child.stdout.pipe(output);

    const completion = new Promise<void>((resolve, reject) => {
        child.once('error', rejectSpawnError(reject));
        child.once('close', resolveZstdExit(resolve, reject, stderr));
    });

    completion.catch((error) => {
        output.destroy(error);
    });

    return {
        stream: output,
        completion
    };
};

export const createZstdDecompressionStream = (input: Readable): ZstdStreamResult => {
    return createZstdStream(['-d', '-q', '-c'], input);
};

export const compressFileWithZstd = async (sourcePath: string, outputPath: string): Promise<void> => {
    const child = spawn('zstd', [
        '-T0',
        '-5',
        '--no-progress',
        '-f',
        '-o',
        outputPath,
        sourcePath
    ], {
        stdio: ['ignore', 'ignore', 'pipe']
    });

    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
        stderr += chunk;
    });

    await new Promise<void>((resolve, reject) => {
        child.once('error', rejectSpawnError(reject));
        child.once('close', resolveZstdExit(resolve, reject, stderr));
    });
};

export const toCompressedDumpObjectKey = (trajectoryId: string, timestep: string | number): string => {
    return `trajectory-${trajectoryId}/timestep-${timestep}${DUMP_ZSTD_EXTENSION}`;
};

export const isZstdObjectKey = (objectKey: string): boolean => objectKey.endsWith('.zst');

export const toVtrObjectKey = (trajectoryId: string): string => {
    return `trajectory-${trajectoryId}/trajectory.vtr`;
};

export const toVtrDictObjectKey = (clusterId: string, version: number): string => {
    return `${clusterId}/v${version}.dict`;
};
