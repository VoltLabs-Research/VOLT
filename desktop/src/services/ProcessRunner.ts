import { spawn } from 'node:child_process';

export interface RunOptions{
    cwd?: string;
    env?: Record<string, string>;
    onStdout?: (line: string) => void;
    onStderr?: (line: string) => void;
}

export default class ProcessRunner{
    #lineReader(onLine: (line: string) => void){
        let buf = '';

        const onData = (chunk: Buffer) => {
            buf += chunk.toString('utf8');
            const parts = buf.split('\n');
            buf = parts.pop() ?? '';

            for(const line of parts) onLine(line);
        };

        const flush = () => {
            if(buf){
                onLine(buf);
                buf = '';
            }
        };

        return { onData, flush };
    }

    async run(bin: string, args: string[], options: RunOptions = {}){
        await new Promise<void>((resolve, reject) => {
            const child = spawn(bin, args, {
                cwd: options.cwd,
                env: options.env ? { ...process.env, ...options.env } : process.env,
                shell: false
            });

            const flushes: Array<() => void> = [];

            if(options.onStdout){
                const reader = this.#lineReader(options.onStdout);
                child.stdout.on('data', reader.onData);
                flushes.push(reader.flush);
            }

            if(options.onStderr){
                const reader = this.#lineReader(options.onStderr);
                child.stderr.on('data', reader.onData);
                flushes.push(reader.flush);
            }

            child.on('error', reject);
            child.on('close', (code) => {
                flushes.forEach((flush) => flush());

                if(code === 0){
                    resolve();
                    return;
                }

                reject(new Error(`${bin} ${args.join(' ')} exited ${code}`));
            });
        });
    }
};
