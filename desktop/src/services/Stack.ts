import ProcessRunner from '@/services/ProcessRunner';
import bus from '@/services/EventBus';

export interface StackProps{
    composeFile: string;
    env?: Record<string, string>;
};

export default class Stack{
    runner: ProcessRunner;

    constructor(private readonly props: StackProps){
        this.runner = new ProcessRunner();
    }

    #composeArgs(args: string[], profiles: string[]){
        const profileArgs = profiles.flatMap((p) => ['--profile', p]);
        return ['compose', '-f', this.props.composeFile, ...profileArgs, ...args];
    }

    #runCompose(args: string[], profiles: string[] = []){
        return this.runner.run('docker', this.#composeArgs(args, profiles), {
            env: this.props.env,
            onStdout: (line) => bus.emit('deploy:log', { stream: 'stdout', line }),
            onStderr: (line) => bus.emit('deploy:log', { stream: 'stderr', line })
        });
    }

    async up(profiles: string[] = []){
        await this.#runCompose(['up', '-d', '--build', '--remove-orphans'], profiles);
    }

    async down(profiles: string[] = []){
        await this.#runCompose(['down'], profiles);
    }
};
