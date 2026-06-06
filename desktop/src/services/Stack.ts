import ProcessRunner from '@/services/ProcessRunner';
import bus from '@/services/EventBus';

export interface StackProps{
    composeFile: string;
    env?: Record<string, string>;
};

export default class Stack{
    props: StackProps;
    runner: ProcessRunner;

    constructor(props: StackProps){
        this.props = props;
        this.runner = new ProcessRunner();
    }

    #base(){
        return [
            'compose',
            '-f',
            this.props.composeFile
        ];
    }

    #runCompose(args: string[]){
        return this.runner.run('docker', ['compose', '-f', this.props.composeFile, ...args], {
            env: this.props.env,
            onStdout: (line) => bus.emit('deploy:log', { stream: 'stdout', line }),
            onStderr: (line) => bus.emit('deploy:log', { stream: 'stderr', line })
        });
    }

    async up(){
        await this.#runCompose([
            'up',
            '-d',
            '--build',
            '--remove-orphans'
        ]);
    }

    async down(){
        await this.#runCompose(['down']);
    }
};