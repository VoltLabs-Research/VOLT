import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import ManagedProcess from '@/services/ManagedProcess';
import type { StackRuntimeLayout } from '@/services/StackRuntime';
import { isUp } from '@/shared/health';

interface LocalStackProps{
    runtime: StackRuntimeLayout;
    logsDir: string;
}

const HEALTH_POLL_MS = 500;
const SERVER_START_TIMEOUT_MS = 90_000;

const sleep = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); });

export default class LocalStack{
    #server: ManagedProcess | null = null;
    #daemon: ManagedProcess | null = null;
    #daemonClusterId: string | null = null;

    constructor(private readonly props: LocalStackProps){}

    get runtime(): StackRuntimeLayout{
        return this.props.runtime;
    }

    get serverRunning(): boolean{
        return this.#server?.running ?? false;
    }

    get daemonRunning(): boolean{
        return this.#daemon?.running ?? false;
    }

    get daemonClusterId(): string | null{
        return this.daemonRunning ? this.#daemonClusterId : null;
    }

    get serverLogFile(): string{
        return path.join(this.props.logsDir, 'server.log');
    }

    get daemonLogFile(): string{
        return path.join(this.props.logsDir, 'daemon.log');
    }

    async startServer(env: Record<string, string>, origin: string): Promise<void>{
        if(this.serverRunning) return;

        await mkdir(env.SERVER_DATA_DIR, { recursive: true });
        const server = new ManagedProcess({
            name: 'server',
            command: this.props.runtime.nodeBinary,
            args: [this.props.runtime.serverEntry],
            cwd: this.props.runtime.serverDir,
            env,
            logFile: this.serverLogFile
        });
        this.#server = server;
        server.start();

        const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
        while(Date.now() < deadline){
            if(!server.running) throw new Error(`The API server exited during startup. See ${this.serverLogFile}`);
            if(await isUp(`${origin}/healthz`)) return;
            await sleep(HEALTH_POLL_MS);
        }

        throw new Error(`The API server did not become healthy within ${SERVER_START_TIMEOUT_MS / 1000}s. See ${this.serverLogFile}`);
    }

    async startDaemon(env: Record<string, string>): Promise<void>{
        if(this.daemonRunning && this.#daemonClusterId === env.TEAM_CLUSTER_ID) return;
        await this.stopDaemon();

        await mkdir(env.DAEMON_DATA_DIR, { recursive: true });
        const daemon = new ManagedProcess({
            name: 'daemon',
            command: this.props.runtime.nodeBinary,
            args: [this.props.runtime.daemonEntry],
            cwd: this.props.runtime.daemonDir,
            env,
            logFile: this.daemonLogFile
        });
        this.#daemon = daemon;
        this.#daemonClusterId = env.TEAM_CLUSTER_ID;
        daemon.start();
    }

    daemonExitedEarly(): boolean{
        return this.#daemon !== null && !this.#daemon.running;
    }

    async stopDaemon(): Promise<void>{
        await this.#daemon?.stop();
        this.#daemon = null;
        this.#daemonClusterId = null;
    }

    async stopServer(): Promise<void>{
        await this.#server?.stop();
        this.#server = null;
    }

    async stop(): Promise<void>{
        await this.stopDaemon();
        await this.stopServer();
    }
};
