import { access, constants } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import os from 'node:os';
import { probe } from '@/services/ProbeRunner';

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

export const augmentedPath = (): string => {
    const dirs = candidates().map((candidate) => dirname(candidate));
    const separator = process.platform === 'win32' ? ';' : ':';
    return [...dirs, process.env['PATH'] ?? ''].join(separator);
};

let resolved: string | null | undefined;

/**
 * Clears the memoized lookup.
 *
 * The path is cached because resolving it spawns a subprocess, but after the app
 * installs the runtime itself the cached `null` would outlive the thing it
 * describes, so provisioning must invalidate it.
 */
export const resetDockerPath = (): void => {
    resolved = undefined;
};

export const dockerPath = async (): Promise<string | null> => {
    if(resolved !== undefined) return resolved;

    for(const candidate of candidates()){
        try{
            await access(candidate, constants.X_OK);
            resolved = candidate;
            return candidate;
        }catch{
            // Candidate paths are guesses; a miss is the normal case.
        }
    }

    const [bin, name] = process.platform === 'win32' ? ['where.exe', 'docker.exe'] : ['which', 'docker'];
    const result = await probe(bin, [name], {
        env: { PATH: augmentedPath() },
        timeoutMs: 4_000
    });
    const hit = result.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);

    resolved = result.code === 0 && hit ? hit : null;
    return resolved;
};
