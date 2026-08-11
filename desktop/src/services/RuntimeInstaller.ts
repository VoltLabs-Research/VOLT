import { spawn } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import { join } from 'node:path';
import bus from '@/services/EventBus';
import { probe } from '@/services/ProbeRunner';
import { run } from '@/services/ProcessRunner';
import { augmentedPath } from '@/services/DockerBinary';

type ProvisionAction = 'start' | 'install';

interface ProvisionAttempt{
    action: ProvisionAction;

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

const IDLE_TIMEOUT_MS = 180_000;

const runLogged = async (bin: string, args: string[], timeoutMs?: number): Promise<ProvisionAttempt['ok']> => {
    log(`$ ${bin} ${args.join(' ')}`);
    try{
        await run(bin, args, {
            env: { PATH: augmentedPath() },
            onStdout: (line) => line.trim() && log(line),
            onStderr: (line) => line.trim() && logError(line),
            timeoutMs,
            idleTimeoutMs: IDLE_TIMEOUT_MS
        });
        return true;
    }catch(err){
        logError(err instanceof Error ? err.message : String(err));
        return false;
    }
};

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

    const version = await probe('winget', ['--version'], {
        env: { PATH: augmentedPath() },
        timeoutMs: 15_000
    });
    if(version.code !== 0){
        return {
            action: 'install',
            attempted: false,
            ok: false,
            detail: version.errno === 'ETIMEDOUT'
                ? 'winget is present but did not respond, so it cannot be used to install Docker'
                : `winget is present but not usable (${version.stderr.trim() || `exit ${version.code}`})`
        };
    }
    log(`winget ${version.stdout.trim()}`);

    log('installing Docker Desktop with winget; Windows will ask for permission');
    const ok = await runLogged('winget', [
        'install',
        '--id', 'Docker.DockerDesktop',
        '--exact',
        '--source', 'winget',
        '--accept-package-agreements',
        '--accept-source-agreements',
        '--disable-interactivity',
        '--silent'
    ], 20 * 60_000);

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

export const installRuntime = (): Promise<ProvisionAttempt> => {
    if(process.platform === 'darwin') return installOnDarwin();
    if(process.platform === 'win32') return installOnWindows();
    return installOnLinux();
};
