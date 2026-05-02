import { PassThrough, Readable } from 'node:stream';
import { spawn } from 'node:child_process';

export const TRAJECTORY_DUMP_ZSTD_EXTENSION = '.dump.zst';
export const TRAJECTORY_GLB_ZSTD_EXTENSION = '.glb.zst';

export interface ZstdSpawnResult {
    stream: Readable;
    completion: Promise<void>;
}

const createZstdStream = (args: string[], input: Readable): ZstdSpawnResult => {
    const child = spawn('zstd', args, {
        stdio: ['pipe', 'pipe', 'pipe']
    });
    const output = new PassThrough();
    let stderr = '';

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
        stderr += chunk;
    });

    input.on('error', (error) => {
        child.stdin.destroy(error);
    });
    child.stdin.on('error', () => {});
    child.stdout.on('error', (error) => {
        output.destroy(error);
    });

    input.pipe(child.stdin);
    child.stdout.pipe(output);

    const completion = new Promise<void>((resolve, reject) => {
        child.once('error', reject);
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

export const createZstdDecompressionStream = (input: Readable): ZstdSpawnResult => (
    createZstdStream(['-d', '-q', '-c'], input)
);

export const buildTrajectoryDumpObjectName = (trajectoryId: string, timestep: string | number): string => (
    `trajectory-${trajectoryId}/timestep-${timestep}${TRAJECTORY_DUMP_ZSTD_EXTENSION}`
);

export const buildTrajectoryGlbObjectName = (trajectoryId: string, timestep: string | number): string => (
    `trajectory-${trajectoryId}/timestep-${timestep}${TRAJECTORY_GLB_ZSTD_EXTENSION}`
);

export const isZstdObjectName = (objectName: string): boolean => objectName.endsWith('.zst');

export const stripTrailingZstdExtension = (objectName: string): string => (
    isZstdObjectName(objectName)
        ? objectName.slice(0, -'.zst'.length)
        : objectName
);
