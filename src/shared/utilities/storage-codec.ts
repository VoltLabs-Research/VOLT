import { PassThrough, Readable } from 'node:stream';
import { spawn } from 'node:child_process';

export const DUMP_ZSTD_EXTENSION = '.dump.zst';
export const GLB_ZSTD_EXTENSION = '.glb.zst';
export const MSGPACK_ZSTD_EXTENSION = '.msgpack.zst';

interface ZstdStreamResult {
    stream: Readable;
    completion: Promise<void>;
}

const createZstdStream = (args: string[], input?: Readable): ZstdStreamResult => {
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
        child.once('error', (error) => {
            if ('code' in error && error.code === 'ENOENT') {
                reject(new Error('zstd binary is not installed in the runtime image'));
                return;
            }

            reject(error);
        });
        child.once('close', (code) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(stderr.trim() || `zstd exited with code ${code ?? 'unknown'}`));
        });
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
        child.once('error', (error) => {
            if ('code' in error && error.code === 'ENOENT') {
                reject(new Error('zstd binary is not installed in the runtime image'));
                return;
            }

            reject(error);
        });
        child.once('close', (code) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(stderr.trim() || `zstd exited with code ${code ?? 'unknown'}`));
        });
    });
};

export const toCompressedGlbObjectKey = (objectKey: string): string => {
    return objectKey.endsWith(GLB_ZSTD_EXTENSION) ? objectKey : `${objectKey}.zst`;
};

export const toCompressedMsgpackObjectKey = (objectKey: string): string => {
    return objectKey.endsWith(MSGPACK_ZSTD_EXTENSION) ? objectKey : `${objectKey}.zst`;
};

export const toCompressedDumpObjectKey = (trajectoryId: string, timestep: string | number): string => {
    return `trajectory-${trajectoryId}/timestep-${timestep}${DUMP_ZSTD_EXTENSION}`;
};

export const isZstdObjectKey = (objectKey: string): boolean => objectKey.endsWith('.zst');

export const stripZstdExtension = (objectKey: string): string => {
    return isZstdObjectKey(objectKey) ? objectKey.slice(0, -4) : objectKey;
};
