import Docker from 'dockerode';
import { augmentedPath, dockerPath, resetDockerPath } from '@/services/DockerBinary';
import { probe } from '@/services/ProbeRunner';
import { installRuntime, startRuntime } from '@/services/RuntimeInstaller';
import type { AppEvents, PreflightReason } from '@/types/events';

export type PreflightResult = AppEvents['deploy:preflight'];

export class PreflightError extends Error{
    constructor(public readonly result: PreflightResult){
        super(result.message);
        this.name = 'PreflightError';
    }
};

const PING_TIMEOUT = 5_000;
const SOCKET_TIMEOUT = 8_000;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
    Promise.race([
        promise,
        new Promise<never>((_, reject) => {
            setTimeout(() => reject(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })), ms).unref();
        })
    ]);

interface Copy{
    message: string;
    remediation: string;
    cta: string;
    docsUrl?: string;
    command?: string;
}

const DESKTOP_URL = 'https://www.docker.com/products/docker-desktop/';
const ENGINE_URL = 'https://docs.docker.com/engine/install/';
const COMPOSE_URL = 'https://docs.docker.com/compose/install/';

const isLinux = (platform: NodeJS.Platform) => platform === 'linux';

const COPY: Record<PreflightReason, (platform: NodeJS.Platform) => Copy> = {
    'ok': () => ({
        message: 'Docker is ready',
        remediation: '',
        cta: ''
    }),
    'cli-missing': (platform) => ({
        message: 'Docker isn\'t installed',
        remediation: isLinux(platform)
            ? 'Volt runs its services with Docker. Install Docker Engine and the Compose v2 plugin, then re-check.'
            : platform === 'win32'
                ? 'Volt runs its services with Docker. Install Docker Desktop, then re-check. If you just installed it, sign out and back in so Windows picks up the new PATH.'
                : 'Volt runs its services with Docker. Install Docker Desktop, then re-check.',
        cta: 'Install Docker',
        docsUrl: isLinux(platform) ? ENGINE_URL : DESKTOP_URL
    }),
    'compose-missing': (platform) => ({
        message: 'Docker Compose is missing',
        remediation: isLinux(platform)
            ? 'Docker is running, but the Compose v2 plugin isn\'t installed. Install the docker-compose-plugin package, then re-check.'
            : 'Docker is running, but the Compose v2 plugin isn\'t installed. Update Docker Desktop, then re-check.',
        cta: 'Install Compose',
        docsUrl: COMPOSE_URL
    }),
    'daemon-down': (platform) => isLinux(platform)
        ? {
            message: 'Docker isn\'t running',
            remediation: 'Start the Docker service, then re-check.',
            cta: 'Re-check',
            command: 'sudo systemctl start docker'
        }
        : {
            message: 'Docker isn\'t running',
            remediation: 'Open Docker and wait for it to finish starting, then re-check.',
            cta: 'Re-check'
        },
    'daemon-starting': () => ({
        message: 'Docker is still starting',
        remediation: 'Docker is starting up. This can take a moment on first launch, and Volt will continue automatically.',
        cta: 'Re-check'
    }),
    'permission-denied': (platform) => isLinux(platform)
        ? {
            message: 'Docker permission denied',
            remediation: 'Your user can\'t access the Docker socket. Add yourself to the docker group, then log out and back in. Group changes only apply to a new session.',
            cta: 'Re-check',
            command: 'sudo usermod -aG docker $USER'
        }
        : {
            message: 'Docker permission denied',
            remediation: 'Volt isn\'t allowed to connect to Docker. Restart Docker, then re-check.',
            cta: 'Re-check'
        },
    'unknown': () => ({
        message: 'Couldn\'t verify Docker',
        remediation: 'Volt couldn\'t determine Docker\'s status. Make sure Docker is running, then re-check.',
        cta: 'Re-check'
    }),
    'auto-starting': () => ({
        message: 'Starting Docker',
        remediation: 'Volt is starting Docker for you. This can take a minute on first launch.',
        cta: ''
    }),
    'auto-installing': () => ({
        message: 'Installing Docker',
        remediation: 'Volt is installing Docker for you. Your system may ask for permission, and the download can take several minutes.',
        cta: ''
    }),
    'install-failed': (platform) => ({
        message: 'Couldn\'t install Docker automatically',
        remediation: isLinux(platform)
            ? 'Volt tried to install Docker with your package manager and it did not complete. Install Docker Engine and the Compose v2 plugin manually, then re-check.'
            : platform === 'win32'
                ? 'Volt tried to install Docker Desktop with winget and it did not complete. Install it manually, then re-check.'
                : 'Volt tried to install Docker Desktop with Homebrew and it did not complete. Install it manually, then re-check.',
        cta: 'Install Docker',
        docsUrl: isLinux(platform) ? ENGINE_URL : DESKTOP_URL
    }),
    'reboot-required': () => ({
        message: 'Restart to finish installing Docker',
        remediation: 'Docker Desktop is installed but Windows needs a restart to finish enabling WSL2. Restart, then reopen Volt.',
        cta: 'Re-check'
    }),
    'relogin-required': () => ({
        message: 'Sign out to finish setting up Docker',
        remediation: 'Docker is installed and running, and your user was added to the docker group. Group membership only applies to a new session, so sign out and back in, then reopen Volt.',
        cta: 'Re-check'
    })
};

const result = (reason: PreflightReason, extra: {
    platform: NodeJS.Platform;
    cliPath?: string;
    serverVersion?: string;
    composeVersion?: string;
    detail?: string;
}): PreflightResult => {
    const copy = COPY[reason](extra.platform);
    return {
        ok: reason === 'ok',
        reason,
        platform: extra.platform,
        message: copy.message,
        remediation: copy.remediation,
        cta: copy.cta,
        docsUrl: copy.docsUrl,
        command: copy.command,
        cliPath: extra.cliPath,
        serverVersion: extra.serverVersion,
        composeVersion: extra.composeVersion,
        detail: extra.detail
    };
};

/**
 * The docker CLI is a spawned subprocess, not a typed client: its exit codes and
 * stderr text are the only signal available, so they stay parsed and classified.
 */
const classifyViaCli = async (cliPath: string, platform: NodeJS.Platform): Promise<PreflightResult> => {
    const info = await probe(cliPath, ['info'], { env: { PATH: augmentedPath() } });
    if(info.errno === 'ETIMEDOUT') return result('daemon-starting', {
        platform,
        cliPath
    });
    if(info.code === 0) return result('unknown', {
        platform,
        cliPath
    });

    const text = `${info.stderr}\n${info.stdout}`.toLowerCase();
    if(/permission denied/.test(text)) return result('permission-denied', {
        platform,
        cliPath
    });
    if(/cannot connect to the docker daemon|is the docker daemon running|no such file or directory|connection refused|the system cannot find the file specified/.test(text)){
        return result('daemon-down', {
            platform,
            cliPath
        });
    }
    return result('unknown', {
        platform,
        cliPath,
        detail: info.stderr.trim()
    });
};

export const dockerPreflight = async (): Promise<PreflightResult> => {
    const platform = process.platform;

    const cliPath = await dockerPath();
    if(!cliPath) return result('cli-missing', { platform });

    let serverVersion: string | undefined;
    try{
        const docker = new Docker({ timeout: SOCKET_TIMEOUT });
        await withTimeout(docker.ping(), PING_TIMEOUT);
        const version = await withTimeout(docker.version(), PING_TIMEOUT) as { Version?: string };
        serverVersion = version.Version;
    }catch(err){
        const code = (err as NodeJS.ErrnoException).code;
        if(code === 'EACCES') return result('permission-denied', {
            platform,
            cliPath
        });
        if(code === 'ETIMEDOUT') return result('daemon-starting', {
            platform,
            cliPath
        });
        if(code === 'ENOENT' || code === 'ECONNREFUSED') return result('daemon-down', {
            platform,
            cliPath
        });
        return classifyViaCli(cliPath, platform);
    }

    const compose = await probe(cliPath, ['compose', 'version', '--short'], {
        env: { PATH: augmentedPath() }
    });
    if(compose.code !== 0) return result('compose-missing', {
        platform,
        cliPath,
        serverVersion
    });

    return result('ok', {
        platform,
        cliPath,
        serverVersion,
        composeVersion: compose.stdout.trim()
    });
};

/** How long to keep polling after a start or install before giving up. */
const READY_TIMEOUT_MS = 180_000;
const READY_POLL_MS = 2_000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => {
    setTimeout(resolve, ms).unref();
});

/**
 * Polls until the runtime reports ready, or the budget runs out.
 *
 * A freshly started Docker Desktop reports `daemon-down` before it reports
 * `daemon-starting`, so anything that is not a terminal answer keeps polling.
 */
const waitUntilReady = async (
    onProgress: (status: PreflightResult) => void,
    timeoutMs = READY_TIMEOUT_MS
): Promise<PreflightResult> => {
    const deadline = Date.now() + timeoutMs;
    let last = await dockerPreflight();

    while(!last.ok && Date.now() < deadline){
        if(last.reason === 'permission-denied' || last.reason === 'compose-missing') return last;

        onProgress(last);
        await sleep(READY_POLL_MS);
        resetDockerPath();
        last = await dockerPreflight();
    }

    return last;
};

/**
 * Brings the container runtime up, doing the work the user would otherwise be
 * sent away to do: start it when it is installed but stopped, install it when it
 * is missing, and wait for it to become usable.
 *
 * Emits `deploy:preflight` at every transition so the UI can show progress rather
 * than a dead end with a link to a download page.
 */
export const ensureDockerReady = async (
    onProgress: (status: PreflightResult) => void
): Promise<PreflightResult> => {
    const platform = process.platform;

    let status = await dockerPreflight();
    if(status.ok) return status;

    onProgress(status);

    if(status.reason === 'daemon-down' || status.reason === 'daemon-starting'){
        onProgress(result('auto-starting', { platform }));
        await startRuntime();

        status = await waitUntilReady(onProgress);
        if(status.ok) return status;
    }

    if(status.reason === 'cli-missing'){
        onProgress(result('auto-installing', { platform }));
        const install = await installRuntime();
        resetDockerPath();

        if(!install.ok){
            return result('install-failed', {
                platform,
                detail: install.detail
            });
        }

        // A fresh install is not running yet on any platform.
        onProgress(result('auto-starting', { platform }));
        await startRuntime();

        status = await waitUntilReady(onProgress);
        if(status.ok) return status;

        if(status.reason === 'cli-missing' && platform === 'win32'){
            return result('reboot-required', { platform });
        }

        if(status.reason === 'permission-denied' && platform === 'linux'){
            return result('relogin-required', { platform });
        }
    }

    return status;
};
