import { PassThrough, Readable } from 'node:stream';
import { spawn } from 'node:child_process';
import { readPositiveIntegerEnv } from '@/support/policies/runtime-capacity';

interface ZstdStreamResult {
    stream: Readable;
    completion: Promise<void>;
}

const ZSTD_NOT_INSTALLED_MESSAGE = 'zstd binary is not installed in the runtime image';
const DEFAULT_ZSTD_THREADS = 2;

const rejectSpawnError = (reject: (error: Error) => void) => (error: NodeJS.ErrnoException): void => {
    if (error.code === 'ENOENT') {
        reject(new Error(ZSTD_NOT_INSTALLED_MESSAGE));
        return;
    }

    reject(error);
};

const resolveZstdExit = (
    resolve: () => void,
    reject: (error: Error) => void,
    stderr: string
) => (code: number | null): void => {
    if (code === 0) {
        resolve();
        return;
    }

    reject(new Error(stderr || `zstd exited with code ${code}`));
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

export const runZstdCommand = async (args: string[]): Promise<void> => {
    const child = spawn('zstd', args, {
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

export const compressFileWithZstd = (sourcePath: string, outputPath: string): Promise<void> =>
    runZstdCommand([
        `-T${readPositiveIntegerEnv('TRAJECTORY_ZSTD_THREADS') ?? DEFAULT_ZSTD_THREADS}`,
        '-5',
        '--no-progress',
        '-f',
        '-o',
        outputPath,
        sourcePath
    ]);

export const isZstdObjectKey = (objectKey: string): boolean => objectKey.endsWith('.zst');

export const toTrajectoryParquetObjectKey = (trajectoryId: string): string =>
    `trajectory-${trajectoryId}/trajectory.parquet`;

// Per-trajectory element table + units, persisted as a small JSON sidecar next to the
// frames parquet (schema v2). Read separately from the frames so the hot atom-page path
// never deserializes it; the server also mirrors it onto the Trajectory doc.
export const toTrajectoryElementTableObjectKey = (trajectoryId: string): string =>
    `trajectory-${trajectoryId}/elements.json`;

// Property tables are keyed per entity kind: atoms keep the historical name,
// line entities get a `.lines.parquet` suffix. The distinct names keep
// analysis-wide per-atom merges (which glob `timestep-N.parquet`) from mixing
// line-entity rows in by id collision.
export type PluginExposureEntityKind = 'atoms' | 'lines';

export const toPluginExposureParquetObjectKey = (
    trajectoryId: string,
    analysisId: string,
    exposureId: string,
    timestep: number,
    entityKind: PluginExposureEntityKind = 'atoms'
): string => {
    const suffix = entityKind === 'lines' ? 'lines.parquet' : 'parquet';
    return `plugins/trajectory-${trajectoryId}/analysis-${analysisId}/${exposureId}/timestep-${timestep}.${suffix}`;
};
