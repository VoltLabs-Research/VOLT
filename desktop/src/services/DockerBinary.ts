import { access, constants } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import os from 'node:os';
import ProbeRunner from '@/services/ProbeRunner';

const candidates = (): string[] => {
    const home = os.homedir();

    if(process.platform === 'darwin'){
        return [
            '/opt/homebrew/bin/docker',
            '/usr/local/bin/docker',
            join(home, '.docker', 'bin', 'docker'),
            '/usr/bin/docker'
        ];
    }

    if(process.platform === 'win32'){
        const roots = [process.env['ProgramW6432'], process.env['ProgramFiles'], 'C:\\Program Files'];
        return roots
            .filter((root): root is string => Boolean(root))
            .map((root) => join(root, 'Docker', 'Docker', 'resources', 'bin', 'docker.exe'));
    }

    return [
        '/usr/bin/docker',
        '/usr/local/bin/docker',
        join(home, '.docker', 'bin', 'docker')
    ];
};

export default class DockerBinary{
    #resolved?: string | null;

    async resolve(): Promise<string | null>{
        if(this.#resolved !== undefined) return this.#resolved;

        for(const candidate of candidates()){
            try{
                await access(candidate, constants.X_OK);
                this.#resolved = candidate;
                return candidate;
            }catch{}
        }

        const [bin, name] = process.platform === 'win32' ? ['where.exe', 'docker.exe'] : ['which', 'docker'];
        const result = await new ProbeRunner().probe(bin, [name], { env: { PATH: this.augmentedPath() }, timeoutMs: 4_000 });
        const hit = result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);

        this.#resolved = result.code === 0 && hit ? hit : null;
        return this.#resolved;
    }

    augmentedPath(): string{
        const dirs = candidates().map((candidate) => dirname(candidate));
        const separator = process.platform === 'win32' ? ';' : ':';
        return [...dirs, process.env['PATH'] ?? ''].join(separator);
    }
};
