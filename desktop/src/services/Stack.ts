import ProcessRunner from '@/services/ProcessRunner';
import bus from '@/services/EventBus';

export interface StackProps{
    composeFile: string;
    env?: Record<string, string>;
};

export default class Stack{
    #runner = new ProcessRunner();

    constructor(private readonly props: StackProps){}

    #runCompose(args: string[], profiles: string[] = []){
        const profileArgs = profiles.flatMap((p) => ['--profile', p]);
        return this.#runner.run('docker', ['compose', '-f', this.props.composeFile, ...profileArgs, ...args], {
            env: this.props.env,
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
