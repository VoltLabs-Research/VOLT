import { spawn } from 'node:child_process';

export interface ProbeResult{
    code: number | null;
    errno?: string;
    stdout: string;
    stderr: string;
}

export interface ProbeOptions{
    env?: Record<string, string>;
    timeoutMs?: number;
}

const DEFAULT_TIMEOUT = 8_000;
const KILL_GRACE = 2_000;

export default class ProbeRunner{
    probe(bin: string, args: string[], options: ProbeOptions = {}): Promise<ProbeResult>{
        return new Promise((resolve) => {
            const child = spawn(bin, args, {
                shell: false,
                env: options.env ? { ...process.env, ...options.env } : process.env
            });

            let stdout = '';
            let stderr = '';
            let settled = false;

            const finish = (result: ProbeResult) => {
                if(settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(result);
            };

            const timer = setTimeout(() => {
                child.kill('SIGTERM');
                setTimeout(() => child.kill('SIGKILL'), KILL_GRACE).unref();
                finish({ code: null, errno: 'ETIMEDOUT', stdout, stderr });
            }, options.timeoutMs ?? DEFAULT_TIMEOUT);

            child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); });
            child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8'); });

            child.on('error', (err: NodeJS.ErrnoException) => finish({ code: null, errno: err.code, stdout, stderr }));
            child.on('close', (code) => finish({ code, stdout, stderr }));
        });
    }
};
