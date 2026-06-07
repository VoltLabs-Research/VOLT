import ProcessRunner from '@/services/ProcessRunner';
import bus from '@/services/EventBus';

export interface StackProps{
    composeFile: string;
    env?: Record<string, string>;
    dockerPath?: string;
    augmentedPath?: string;
};

export default class Stack{
    #runner = new ProcessRunner();

    constructor(private readonly props: StackProps){}

    #runCompose(args: string[], profiles: string[] = []){
        const profileArgs = profiles.flatMap((p) => ['--profile', p]);
        const env = this.props.augmentedPath ? { ...this.props.env, PATH: this.props.augmentedPath } : this.props.env;
        return this.#runner.run(this.props.dockerPath ?? 'docker', ['compose', '-f', this.props.composeFile, ...profileArgs, ...args], {
            env,
            onStdout: (line) => bus.emit('deploy:log', { stream: 'stdout', line }),
            onStderr: (line) => bus.emit('deploy:log', { stream: 'stderr', line })
        });
    }

    async up(profiles: string[] = [], build = false){
        await this.#runCompose(['up', '-d', '--remove-orphans', ...(build ? ['--build'] : [])], profiles);
    }

    async down(profiles: string[] = [], volumes = false){
        await this.#runCompose(['down', ...(volumes ? ['-v'] : [])], profiles);
    }
};
