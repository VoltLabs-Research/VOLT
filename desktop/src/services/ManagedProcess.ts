import { spawn, type ChildProcess } from 'node:child_process';
import { appendFileSync, closeSync, mkdirSync, openSync, readSync, statSync } from 'node:fs';
import path from 'node:path';
import bus from '@/services/EventBus';

interface ManagedProcessProps{
    name: string;
    command: string;
    args: string[];
    cwd: string;
    env: Record<string, string>;
    logFile: string;
}

const STOP_GRACE_MS = 10_000;
const TAIL_INTERVAL_MS = 300;
const TAIL_CHUNK_BYTES = 64 * 1024;
const ERROR_LINE = /"level":(50|60)|^\s*(Error|TypeError|RangeError)\b|\berror\b/i;

const classify = (line: string): 'stdout' | 'stderr' => (ERROR_LINE.test(line) ? 'stderr' : 'stdout');

export default class ManagedProcess{
    #child: ChildProcess | null = null;
    #exit: Promise<number | null> = Promise.resolve(null);
    #exitListeners: Array<(code: number | null) => void> = [];
    #tailTimer: NodeJS.Timeout | null = null;
    #tailOffset = 0;
    #tailRest = '';

    constructor(private readonly props: ManagedProcessProps){}

    get running(): boolean{
        return this.#child !== null && this.#child.exitCode === null && this.#child.signalCode === null;
    }

    get pid(): number | undefined{
        return this.#child?.pid;
    }

    onExit(listener: (code: number | null) => void): () => void{
        this.#exitListeners.push(listener);
        return () => { this.#exitListeners = this.#exitListeners.filter((item) => item !== listener); };
    }

    start(): void{
        if(this.running) return;

        mkdirSync(path.dirname(this.props.logFile), { recursive: true });
        appendFileSync(this.props.logFile, `\n=== ${this.props.name} started ${new Date().toISOString()} ===\n`);
        this.#tailOffset = statSync(this.props.logFile).size;
        this.#tailRest = '';

        const logFd = openSync(this.props.logFile, 'a');
        let child: ChildProcess;
        try{
            child = spawn(this.props.command, this.props.args, {
                cwd: this.props.cwd,
                env: this.props.env,
                stdio: ['pipe', logFd, logFd],
                windowsHide: true
            });
        }finally{
            closeSync(logFd);
        }
        this.#child = child;
        this.#startTail();

        this.#exit = new Promise((resolve) => {
            child.once('error', (err) => {
                this.#emit('stderr', `failed to start: ${err.message}`);
                this.#stopTail();
                resolve(null);
            });
            child.once('exit', (code, signal) => {
                this.#stopTail();
                appendFileSync(this.props.logFile, `=== ${this.props.name} exited code=${code} signal=${signal} ===\n`);
                for(const listener of this.#exitListeners) listener(code);
                resolve(code);
            });
        });
    }

    async stop(): Promise<void>{
        const child = this.#child;
        if(!child || !this.running){
            this.#child = null;
            this.#stopTail();
            return;
        }

        child.kill('SIGTERM');
        const killTimer = setTimeout(() => {
            if(this.running) child.kill('SIGKILL');
        }, STOP_GRACE_MS);
        killTimer.unref();

        await this.#exit;
        clearTimeout(killTimer);
        this.#child = null;
    }

    #emit(stream: 'stdout' | 'stderr', line: string): void{
        bus.emit('deploy:log', {
            stream,
            line: `[${this.props.name}] ${line}`
        });
    }

    #startTail(): void{
        this.#stopTail();
        this.#tailTimer = setInterval(() => this.#readTail(), TAIL_INTERVAL_MS);
    }

    #stopTail(): void{
        if(this.#tailTimer){
            clearInterval(this.#tailTimer);
            this.#tailTimer = null;
        }
        this.#readTail();
        if(this.#tailRest.trim()) this.#emit(classify(this.#tailRest), this.#tailRest);
        this.#tailRest = '';
    }

    #readTail(): void{
        let size: number;
        try{
            size = statSync(this.props.logFile).size;
        }catch{
            return;
        }
        if(size <= this.#tailOffset) return;

        const fd = openSync(this.props.logFile, 'r');
        try{
            while(this.#tailOffset < size){
                const buffer = Buffer.alloc(Math.min(TAIL_CHUNK_BYTES, size - this.#tailOffset));
                const read = readSync(fd, buffer, 0, buffer.length, this.#tailOffset);
                if(read <= 0) break;
                this.#tailOffset += read;
                const parts = (this.#tailRest + buffer.toString('utf8', 0, read)).split(/\r?\n/);
                this.#tailRest = parts.pop() ?? '';
                for(const line of parts){
                    if(line.trim() && !line.startsWith('=== ')) this.#emit(classify(line), line);
                }
            }
        }finally{
            closeSync(fd);
        }
    }
};
