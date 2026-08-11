import { run } from '@/services/ProcessRunner';
import bus from '@/services/EventBus';

export interface ComposeOptions{
    composeFile: string;

    overlayFiles?: string[];
    env?: Record<string, string>;
    dockerPath?: string;
    augmentedPath?: string;
};

const fileArgs = (options: ComposeOptions): string[] => [
    '-f', options.composeFile,
    ...(options.overlayFiles ?? []).flatMap((file) => ['-f', file])
];

const compose = (options: ComposeOptions, args: string[], profiles: string[]) => {
    const profileArgs = profiles.flatMap((p) => ['--profile', p]);
    const env = options.augmentedPath ? {
        ...options.env,
        PATH: options.augmentedPath
    } : options.env;
    return run(options.dockerPath ?? 'docker', ['compose', ...fileArgs(options), ...profileArgs, ...args], {
        env,
        onStdout: (line) => bus.emit('deploy:log', {
            stream: 'stdout',
            line
        }),
        onStderr: (line) => bus.emit('deploy:log', {
            stream: 'stderr',
            line
        })
    });
};

const composeQuiet = async (options: ComposeOptions, args: string[], profiles: string[]): Promise<string> => {
    const lines: string[] = [];
    const profileArgs = profiles.flatMap((p) => ['--profile', p]);
    const env = options.augmentedPath ? {
        ...options.env,
        PATH: options.augmentedPath
    } : options.env;

    await run(options.dockerPath ?? 'docker', ['compose', ...fileArgs(options), ...profileArgs, ...args], {
        env,
        onStdout: (line) => lines.push(line)
    });

    return lines.join('\n');
};

export const runningServiceId = async (
    options: ComposeOptions,
    service: string,
    profiles: string[] = []
): Promise<string | null> => {
    try{
        const output = await composeQuiet(options, ['ps', '-q', '--status', 'running', service], profiles);
        return output.split('\n').map((line) => line.trim()).find(Boolean) ?? null;
    }catch{
        return null;
    }
};

export const containerEnvValue = async (
    options: ComposeOptions,
    containerId: string,
    key: string
): Promise<string | null> => {
    const lines: string[] = [];
    try{
        await run(options.dockerPath ?? 'docker', [
            'inspect', '-f', '{{range .Config.Env}}{{println .}}{{end}}', containerId
        ], {
            env: options.augmentedPath ? { PATH: options.augmentedPath } : undefined,
            onStdout: (line) => lines.push(line)
        });
    }catch{
        return null;
    }

    const prefix = `${key}=`;
    return lines.map((line) => line.trim()).find((line) => line.startsWith(prefix))?.slice(prefix.length) ?? null;
};

export const composeUp = (options: ComposeOptions, profiles: string[] = [], build = false) =>
    compose(options, ['up', '-d', '--remove-orphans', ...(build ? ['--build'] : [])], profiles);

export const composeDown = (options: ComposeOptions, profiles: string[] = [], volumes = false) =>
    compose(options, ['down', ...(volumes ? ['-v'] : [])], profiles);

export const composePull = async (
    options: ComposeOptions,
    services: string[],
    profiles: string[] = []
): Promise<boolean> => {
    try{
        await compose(options, ['pull', ...services], profiles);
        return true;
    }catch{
        return false;
    }
};
