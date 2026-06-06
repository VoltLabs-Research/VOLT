import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(execFile);

export interface RunCommandProps{
    bin: string;
    args: string[];
    cwd?: string;
}

export default class ProcessRunner{
    async capture(bin: string, args: string[], cwd?: string): Promise<string>{
        const { stdout } = await execAsync(bin, args, { cwd: cwd });
        return stdout.trim();
    }

    async run(bin: string, args: string[], cwd?: string){
        await new Promise<void>((resolve, reject) => {
            const child = spawn(bin, args, {
                cwd: cwd,
                stdio: 'inherit',
                shell: false
            });

            child.on('error', reject);
            child.on('close', (code) => {
                if(code === 0){
                    resolve();
                    return;
                }

                reject(new Error(`${bin} ${args.join(' ')} failed with code ${code}`));
            })
        });
    }
};