import { spawn } from 'node:child_process';

export interface RunOptions{
    cwd?: string;
    env?: Record<string, string>;
    onStdout?: (line: string) => void;
    onStderr?: (line: string) => void;
}

export default class ProcessRunner{
    #byLine(onLine: (line: string) => void){
        let buf = '';

        return (chunk: Buffer) => {
            buf += chunk.toString('utf8');
            const parts = buf.split('\n');
            buf = parts.pop() ?? '';

            for(const line of parts) onLine(line);
        };
    }

    async run(bin: string, args: string[], options: RunOptions = {}){
        await new Promise<void>((resolve, reject) => {
            const child = spawn(bin, args, {
                cwd: options.cwd,
                env: options.env ? { ...process.env, ...options.env } : process.env,
                shell: false
            });

            if(options.onStdout) child.stdout.on('data', this.#byLine(options.onStdout));
            if(options.onStderr) child.stderr.on('data', this.#byLine(options.onStderr));

            child.on('error', reject);
            child.on('close', (code) => {
                if(code === 0){
                    resolve();
                    return;
                }

                reject(new Error(`${bin} ${args.join(' ')} exited ${code}`));
            });
        });
    }
};
