import { Singleton } from '@shared/infrastructure/di/decorators';

import { spawn } from 'node:child_process';

export interface CompressionTask {
    sourceFramePath: string;
    compressedFramePath: string;
    objectKey: string;
    trajectoryId: string;
    timestep: number;
}

const awaitProcessExit = async (child: ReturnType<typeof spawn>): Promise<void> => {
    let stderr = '';
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk) => {
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

@Singleton()
export default class CompressionProcessor {
    async process(task: CompressionTask): Promise<void> {
        const child = spawn('zstd', [
            '-T0',
            '-5',
            '--no-progress',
            '-f',
            '-o',
            task.compressedFramePath,
            task.sourceFramePath
        ], {
            stdio: ['ignore', 'ignore', 'pipe']
        });

        await awaitProcessExit(child);
    }
}
