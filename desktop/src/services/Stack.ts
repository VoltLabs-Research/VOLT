import { run } from '@/services/ProcessRunner';
import bus from '@/services/EventBus';

export interface ComposeOptions{
    composeFile: string;
    env?: Record<string, string>;
    dockerPath?: string;
    augmentedPath?: string;
};

const compose = (options: ComposeOptions, args: string[], profiles: string[]) => {
    const profileArgs = profiles.flatMap((p) => ['--profile', p]);
    const env = options.augmentedPath ? {
        ...options.env,
        PATH: options.augmentedPath
    } : options.env;
    return run(options.dockerPath ?? 'docker', ['compose', '-f', options.composeFile, ...profileArgs, ...args], {
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

export const composeUp = (options: ComposeOptions, profiles: string[] = [], build = false) =>
    compose(options, ['up', '-d', '--remove-orphans', ...(build ? ['--build'] : [])], profiles);

export const composeDown = (options: ComposeOptions, profiles: string[] = [], volumes = false) =>
    compose(options, ['down', ...(volumes ? ['-v'] : [])], profiles);
