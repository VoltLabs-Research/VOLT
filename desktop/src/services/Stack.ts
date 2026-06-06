import ProcessRunner from '@/services/ProcessRunner';
import bus from '@/services/EventBus';

export interface StackProps{
    composeFile: string;
    env?: Record<string, string>;
};

export interface ServiceStatus{
    service: string;
    state: string;
    health: string;
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

    async #capture(args: string[], profiles: string[] = []){
        let out = '';
        await this.runner.run('docker', this.#composeArgs(args, profiles), {
            env: this.props.env,
            onStdout: (line) => { out += `${line}\n`; },
            onStderr: () => { /* warnings (unset vars, etc.) are irrelevant here */ }
        });
        return out;
    }

    async up(profiles: string[] = []){
        await this.#runCompose(['up', '-d', '--build', '--remove-orphans'], profiles);
    }

    async down(profiles: string[] = []){
        await this.#runCompose(['down'], profiles);
    }

    async services(profiles: string[] = []): Promise<string[]>{
        const out = await this.#capture(['config', '--services'], profiles);
        return out.split('\n').map((line) => line.trim()).filter(Boolean);
    }

    async status(profiles: string[] = []): Promise<ServiceStatus[]>{
        const out = (await this.#capture(['ps', '--format', 'json'], profiles)).trim();
        if(!out) return [];

        const rows = out.startsWith('[')
            ? JSON.parse(out)
            : out.split('\n').filter(Boolean).map((line) => JSON.parse(line));

        return rows.map((row: any) => ({
            service: row.Service,
            state: row.State,
            health: row.Health ?? ''
        }));
    }
};
