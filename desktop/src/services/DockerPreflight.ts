import Docker from 'dockerode';
import DockerBinary from '@/services/DockerBinary';
import ProbeRunner from '@/services/ProbeRunner';
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
    'ok': () => ({ message: 'Docker is ready', remediation: '', cta: '' }),
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
    })
};

export default class DockerPreflight{
    #binary = new DockerBinary();

    dockerPath(): Promise<string | null>{
        return this.#binary.resolve();
    }

    augmentedPath(): string{
        return this.#binary.augmentedPath();
    }

    async preflight(): Promise<PreflightResult>{
        const platform = process.platform;

        const cliPath = await this.#binary.resolve();
        if(!cliPath) return this.#result('cli-missing', { platform });

        let serverVersion: string | undefined;
        try{
            const docker = new Docker({ timeout: SOCKET_TIMEOUT });
            await withTimeout(docker.ping(), PING_TIMEOUT);
            const version = await withTimeout(docker.version(), PING_TIMEOUT) as { Version?: string };
            serverVersion = version.Version;
        }catch(err){
            const code = (err as NodeJS.ErrnoException).code;
            if(code === 'EACCES') return this.#result('permission-denied', { platform, cliPath });
            if(code === 'ETIMEDOUT') return this.#result('daemon-starting', { platform, cliPath });
            if(code === 'ENOENT' || code === 'ECONNREFUSED') return this.#result('daemon-down', { platform, cliPath });
            return this.#classifyViaCli(cliPath, platform);
        }

        const compose = await new ProbeRunner().probe(cliPath, ['compose', 'version', '--short'], {
            env: { PATH: this.#binary.augmentedPath() }
        });
        if(compose.code !== 0) return this.#result('compose-missing', { platform, cliPath, serverVersion });

        return this.#result('ok', { platform, cliPath, serverVersion, composeVersion: compose.stdout.trim() });
    }

    async #classifyViaCli(cliPath: string, platform: NodeJS.Platform): Promise<PreflightResult>{
        const info = await new ProbeRunner().probe(cliPath, ['info'], { env: { PATH: this.#binary.augmentedPath() } });
        if(info.errno === 'ETIMEDOUT') return this.#result('daemon-starting', { platform, cliPath });
        if(info.code === 0) return this.#result('unknown', { platform, cliPath });

        const text = `${info.stderr}\n${info.stdout}`.toLowerCase();
        if(/permission denied/.test(text)) return this.#result('permission-denied', { platform, cliPath });
        if(/cannot connect to the docker daemon|is the docker daemon running|no such file or directory|connection refused|the system cannot find the file specified/.test(text)){
            return this.#result('daemon-down', { platform, cliPath });
        }
        return this.#result('unknown', { platform, cliPath, detail: info.stderr.trim() });
    }

    #result(reason: PreflightReason, extra: {
        platform: NodeJS.Platform;
        cliPath?: string;
        serverVersion?: string;
        composeVersion?: string;
        detail?: string;
    }): PreflightResult{
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
    }
};
