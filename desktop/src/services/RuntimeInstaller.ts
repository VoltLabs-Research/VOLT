import { spawn } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import { join } from 'node:path';
import bus from '@/services/EventBus';
import { probe } from '@/services/ProbeRunner';
import { run } from '@/services/ProcessRunner';
import { augmentedPath } from '@/services/DockerBinary';

/**
 * Provisioning the container runtime on the user's behalf.
 *
 * The app cannot drop Docker: `ClusterDaemon` creates containers at runtime for
 * notebooks, plugins and user workloads, so a container runtime *is* the compute
 * substrate. What it can do is stop asking the user to go and install it — start
 * it when it is present but stopped, and install it when it is missing.
 *
 * Every command here is a fixed argument vector with `shell: false`; nothing is
 * interpolated from user input.
 */

export type ProvisionAction = 'start' | 'install';

export interface ProvisionAttempt{
    action: ProvisionAction;
    /** False when this platform has no automatic path for the action. */
    attempted: boolean;
    ok: boolean;
    detail?: string;
}

const log = (line: string): void => {
    bus.emit('deploy:log', {
        stream: 'stdout',
        line: `[runtime] ${line}`
    });
};

const logError = (line: string): void => {
    bus.emit('deploy:log', {
        stream: 'stderr',
        line: `[runtime] ${line}`
    });
};

const exists = async (path: string): Promise<boolean> => {
    try{
        await access(path, constants.F_OK);
        return true;
    }catch{
        return false;
    }
};

const hasCommand = async (name: string): Promise<boolean> => {
    const [bin, arg] = process.platform === 'win32' ? ['where.exe', `${name}.exe`] : ['which', name];
    const result = await probe(bin, [arg], {
        env: { PATH: augmentedPath() },
        timeoutMs: 4_000
    });
    return result.code === 0;
};

/** Streams a provisioning command into the deploy log so the UI shows progress. */
const runLogged = async (bin: string, args: string[], timeoutMs?: number): Promise<ProvisionAttempt['ok']> => {
    log(`$ ${bin} ${args.join(' ')}`);
    try{
        await Promise.race([
            run(bin, args, {
                env: { PATH: augmentedPath() },
                onStdout: (line) => line.trim() && log(line),
                onStderr: (line) => line.trim() && logError(line)
            }),
            ...(timeoutMs
                ? [new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error(`${bin} timed out`)), timeoutMs).unref();
                })]
                : [])
        ]);
        return true;
    }catch(err){
        logError(err instanceof Error ? err.message : String(err));
        return false;
    }
};

/**
 * Launches a GUI application and returns immediately.
 *
 * Docker Desktop keeps running after its launcher returns, so the child is
 * detached and unreferenced; readiness is then established by polling, not by
 * waiting on this process.
 */
const launchDetached = (bin: string, args: string[]): boolean => {
    try{
        log(`$ ${bin} ${args.join(' ')}`);
        const child = spawn(bin, args, {
            detached: true,
            stdio: 'ignore',
            shell: false
        });
        child.unref();
        return true;
    }catch(err){
        logError(err instanceof Error ? err.message : String(err));
        return false;
    }
};

const DOCKER_DESKTOP_WINDOWS_CANDIDATES = [
    process.env['ProgramW6432'],
    process.env['ProgramFiles'],
    'C:\\Program Files'
]
    .filter((root): root is string => Boolean(root))
    .map((root) => join(root, 'Docker', 'Docker', 'Docker Desktop.exe'));

const startOnDarwin = async (): Promise<ProvisionAttempt> => {
    // `open -a` is a no-op when Docker is already running, so it is safe to retry.
    const ok = await runLogged('/usr/bin/open', ['-a', 'Docker'], 30_000);
    return {
        action: 'start',
        attempted: true,
        ok
    };
};

const startOnWindows = async (): Promise<ProvisionAttempt> => {
    for(const candidate of DOCKER_DESKTOP_WINDOWS_CANDIDATES){
        if(!await exists(candidate)) continue;
        return {
            action: 'start',
            attempted: true,
            ok: launchDetached(candidate, [])
        };
    }

    return {
        action: 'start',
        attempted: false,
        ok: false,
        detail: 'Docker Desktop executable not found'
    };
};

/**
 * Linux has two shapes: rootless Docker runs as a user service and needs no
 * elevation, while the system daemon does. The user service is tried first so the
 * common rootless setup never raises a password prompt.
 */
const startOnLinux = async (): Promise<ProvisionAttempt> => {
    if(await hasCommand('systemctl')){
        if(await runLogged('systemctl', ['--user', 'start', 'docker'], 30_000)){
            return {
                action: 'start',
                attempted: true,
                ok: true
            };
        }

        if(await hasCommand('pkexec')){
            const ok = await runLogged('pkexec', ['systemctl', 'start', 'docker'], 120_000);
            return {
                action: 'start',
                attempted: true,
                ok
            };
        }

        return {
            action: 'start',
            attempted: true,
            ok: false,
            detail: 'Starting the system Docker service needs elevation and pkexec is unavailable'
        };
    }

    return {
        action: 'start',
        attempted: false,
        ok: false,
        detail: 'systemctl not available'
    };
};

/** Starts an installed-but-stopped runtime. */
export const startRuntime = (): Promise<ProvisionAttempt> => {
    if(process.platform === 'darwin') return startOnDarwin();
    if(process.platform === 'win32') return startOnWindows();
    return startOnLinux();
};

const installOnWindows = async (): Promise<ProvisionAttempt> => {
    if(!await hasCommand('winget')){
        return {
            action: 'install',
            attempted: false,
            ok: false,
            detail: 'winget is not available on this version of Windows'
        };
    }

    log('installing Docker Desktop with winget; Windows will ask for permission');
    const ok = await runLogged('winget', [
        'install',
        '--id', 'Docker.DockerDesktop',
        '--exact',
        '--accept-package-agreements',
        '--accept-source-agreements',
        '--disable-interactivity'
    ], 30 * 60_000);

    return {
        action: 'install',
        attempted: true,
        ok,
        detail: ok ? 'Docker Desktop may need a reboot to finish enabling WSL2' : undefined
    };
};

const installOnDarwin = async (): Promise<ProvisionAttempt> => {
    if(!await hasCommand('brew')){
        return {
            action: 'install',
            attempted: false,
            ok: false,
            detail: 'Homebrew is not installed'
        };
    }

    log('installing Docker Desktop with Homebrew; macOS will ask for your password');
    const ok = await runLogged('brew', ['install', '--cask', 'docker'], 30 * 60_000);
    return {
        action: 'install',
        attempted: true,
        ok
    };
};

interface LinuxPackageManager{
    bin: string;
    args: string[];
}

const LINUX_PACKAGE_MANAGERS: readonly LinuxPackageManager[] = [
    {
        bin: 'apt-get',
        args: ['install', '-y', 'docker.io', 'docker-compose-v2']
    },
    {
        bin: 'dnf',
        args: ['install', '-y', 'moby-engine', 'docker-compose']
    },
    {
        bin: 'pacman',
        args: ['-S', '--noconfirm', 'docker', 'docker-compose']
    },
    {
        bin: 'zypper',
        args: ['--non-interactive', 'install', 'docker', 'docker-compose']
    }
];

const installOnLinux = async (): Promise<ProvisionAttempt> => {
    if(!await hasCommand('pkexec')){
        return {
            action: 'install',
            attempted: false,
            ok: false,
            detail: 'pkexec is unavailable, so the installer cannot request elevation'
        };
    }

    for(const manager of LINUX_PACKAGE_MANAGERS){
        if(!await hasCommand(manager.bin)) continue;

        log(`installing Docker with ${manager.bin}; your desktop will ask for permission`);
        const installed = await runLogged('pkexec', [manager.bin, ...manager.args], 30 * 60_000);
        if(!installed){
            return {
                action: 'install',
                attempted: true,
                ok: false
            };
        }

        await runLogged('pkexec', ['systemctl', 'enable', '--now', 'docker'], 120_000);

        /*
         * Group membership is read when a session starts, so adding the user now
         * does not grant this process access to the socket. It is still done here
         * so the permission survives the next login, and the preflight reports the
         * remaining step if the socket is still refused.
         */
        const user = process.env['USER'] ?? process.env['LOGNAME'];
        if(user){
            await runLogged('pkexec', ['usermod', '-aG', 'docker', user], 60_000);
        }

        return {
            action: 'install',
            attempted: true,
            ok: true
        };
    }

    return {
        action: 'install',
        attempted: false,
        ok: false,
        detail: 'No supported package manager found (apt-get, dnf, pacman, zypper)'
    };
};

/** Installs the container runtime with the platform's own package manager. */
export const installRuntime = (): Promise<ProvisionAttempt> => {
    if(process.platform === 'darwin') return installOnDarwin();
    if(process.platform === 'win32') return installOnWindows();
    return installOnLinux();
};
