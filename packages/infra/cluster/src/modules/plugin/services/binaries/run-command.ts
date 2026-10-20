import { spawn } from 'node:child_process';


const MAX_STDERR_BYTES = 10 * 1024 * 1024;

export const runCommand = (commandPath: string, args: string[], cwd: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const child = spawn(commandPath, args, {
            cwd,
            stdio: ['ignore', 'pipe', 'pipe']
        });
        const stderrChunks: Buffer[] = [];
        let stderrBytes = 0;

        child.stderr.on('data', (chunk: Buffer) => {
            if (stderrBytes < MAX_STDERR_BYTES) {
                stderrChunks.push(chunk);
                stderrBytes += chunk.length;
            }
        });
        child.on('error', (error: NodeJS.ErrnoException) => {
            if (error.code === 'ENOENT') {
                reject(new Error(
                    commandPath === 'python' || commandPath === 'python3' || commandPath.endsWith('python.exe')
                        ? `Python 3.12+ is required but "${commandPath}" is not available. Install Python and add it to PATH, or set VOLT_PYTHON.`
                        : `Command not found: ${commandPath}`
                ));
                return;
            }
            reject(error);
        });
        child.on('close', (code) => {
            if (code === 0) {
                resolve();
                return;
            }

            const stderrOutput = Buffer.concat(stderrChunks).toString('utf-8');
            reject(new Error(stderrOutput.length > 0 ? stderrOutput : `${commandPath} exited with code ${code}`));
        });
    });
};
