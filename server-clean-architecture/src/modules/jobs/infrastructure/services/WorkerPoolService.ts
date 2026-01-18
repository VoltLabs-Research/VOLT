import util from 'node:util';
import { Worker } from 'node:worker_threads';
import { injectable } from 'tsyringe';
import { WorkerPoolItem } from '@modules/jobs/domain/entities/WorkerStatus';
import {
    IWorkerPoolService,
    WorkerPoolConfig,
    WorkerMessageHandler,
    WorkerErrorHandler,
    WorkerExitHandler
} from '@modules/jobs/domain/ports/IWorkerPool';

@injectable()
export default class WorkerPoolService implements IWorkerPoolService {
    private workerPool: WorkerPoolItem[] = [];
    private consecutiveCrashes = 0;
    private lastCrashTime = 0;
    private isInCrashLoop = false;
    private config!: WorkerPoolConfig;
    private onMessage!: WorkerMessageHandler;
    private onError!: WorkerErrorHandler;
    private onExit!: WorkerExitHandler;
    private getBacklogCount!: () => Promise<number>;

    initialize(
        config: WorkerPoolConfig,
        onMessage: WorkerMessageHandler,
        onError: WorkerErrorHandler,
        onExit: WorkerExitHandler,
        getBacklogCount: () => Promise<number>
    ): void {
        this.config = config;
        this.onMessage = onMessage;
        this.onError = onError;
        this.onExit = onExit;
        this.getBacklogCount = getBacklogCount;
    }

    scheduleScaleDown(item: WorkerPoolItem): void {
        const timeout = setTimeout(() => {
            if (!item.isIdle) return;
            if (this.workerPool.length <= this.config.minWorkers) return;

            const idx = this.workerPool.findIndex(({ worker }) => worker.threadId === item.worker.threadId);
            if (idx !== -1) {
                const [gone] = this.workerPool.splice(idx, 1);
                gone.timeouts.forEach(clearTimeout);
                gone.worker.terminate();
            }
        }, this.config.idleWorkerTTL);

        item.timeouts.add(timeout);
    }

    spawnWorker(): WorkerPoolItem {
        const item: WorkerPoolItem = {
            worker: this.createWorker(),
            isIdle: true,
            jobCount: 0,
            lastUsed: Date.now(),
            timeouts: new Set()
        };

        this.workerPool.push(item);
        return item;
    }

    async scaleUp(n: number): Promise<void> {
        const canSpawn = Math.max(0, this.config.maxConcurrentJobs - this.workerPool.length);
        const toSpawn = Math.min(n, canSpawn);

        for (let i = 0; i < toSpawn; i++) {
            this.spawnWorker();
        }
    }

    private createWorker(): Worker {
        console.log(`[WorkerPool] Creating worker from path: ${this.config.workerPath}`);
        const worker = new Worker(this.config.workerPath, {
            execArgv: [
                '-r',
                'tsx',
                'tsconfig-paths/register'
            ],
            resourceLimits: {
                maxOldGenerationSizeMb: this.config.maxOldGenerationSizeMb
            }
        });

        const workerId = worker.threadId;
        console.log(`[WorkerPool] Worker created with threadId: ${workerId} `);

        worker.on('message', (message) => this.onMessage(workerId, message));
        worker.on('error', (err: any) => this.handleWorkerError(workerId, err));
        worker.on('exit', (code) => this.handleWorkerExit(workerId, code));

        return worker;
    }

    private async handleWorkerError(workerId: number, error: Error): Promise<void> {
        let msg = 'Unknown error';
        try {
            if (error instanceof Error) {
                msg = error.message;
                if (error.stack) msg += `\nStack: ${error.stack} `;
            } else if (typeof error === 'string') {
                msg = error;
            } else {
                msg = util.inspect(error, { depth: null, colors: false, breakLength: Infinity });
            }
        } catch {
            msg = 'Non-inspectable error';
        }

        console.error(`[WorkerPool] Worker ${workerId} error: `, msg);
        await this.onError(workerId, new Error(msg));
        this.replaceWorker(workerId, false);
    }

    private async handleWorkerExit(workerId: number, code: number): Promise<void> {
        console.log(`[WorkerPool] Worker ${workerId} exited with code ${code} `);
        let hadJob = true;
        if (code !== 0) {
            await this.onExit(workerId, code);
            hadJob = true;
        }

        this.replaceWorker(workerId, hadJob);
    }

    private checkCrashLoop(hadJob: boolean): boolean {
        const now = Date.now();

        if (now - this.lastCrashTime > this.config.crashWindowMs) {
            this.consecutiveCrashes = 0;
            this.isInCrashLoop = false;
        }

        if (!hadJob) {
            this.consecutiveCrashes++;
            this.lastCrashTime = now;

            if (this.consecutiveCrashes >= this.config.maxConsecutiveCrashes) {
                if (!this.isInCrashLoop) {
                    this.isInCrashLoop = true;
                }
                return true;
            }
        } else {
            this.consecutiveCrashes = 0;
            this.isInCrashLoop = false;
        }
        return false;
    }

    private replaceWorker(workerId: number, hadJob: boolean): void {
        const idx = this.workerPool.findIndex(({ worker }) => worker.threadId === workerId);
        if (idx !== -1) {
            const old = this.workerPool[idx];
            old.worker.terminate();
            old.timeouts.forEach(clearTimeout);
            this.workerPool.splice(idx, 1);
        }

        const isInCrashLoop = this.checkCrashLoop(hadJob);

        this.getBacklogCount().then((backlog) => {
            if (this.workerPool.length < this.config.minWorkers || backlog > 0) {
                if (isInCrashLoop) {
                    const delay = this.config.crashBackoffMs * Math.min(this.consecutiveCrashes, 5);
                    setTimeout(this.spawnWorker, delay);
                } else {
                    this.spawnWorker();
                }
            }
        }).catch(() => {
            if (this.workerPool.length < this.config.minWorkers) {
                if (isInCrashLoop) {
                    const delay = this.config.crashBackoffMs * Math.min(this.consecutiveCrashes, 5);
                    setTimeout(this.spawnWorker, delay);
                } else {
                    this.spawnWorker();
                }
            }
        });
    }

    terminateAll(): void {
        for (const item of this.workerPool) {
            item.timeouts.forEach(clearTimeout);
            item.worker.terminate();
        }

        this.workerPool = [];
    }

    getWorkers(): WorkerPoolItem[] {
        return this.workerPool;
    }

    getAvailableWorkerCount(): number {
        return this.workerPool.filter(item => item.isIdle).length;
    }

    getPoolSize(): number {
        return this.workerPool.length;
    }

    isInCrashLoopState(): boolean {
        return this.isInCrashLoop;
    }

    getConsecutiveCrashes(): number {
        return this.consecutiveCrashes;
    }

    findWorkerByThreadId(threadId: number): WorkerPoolItem | undefined {
        return this.workerPool.find(({ worker }) => worker.threadId === threadId);
    }

    findWorkerIndexByThreadId(threadId: number): number {
        return this.workerPool.findIndex(({ worker }) => worker.threadId === threadId);
    }

    clearWorkerTimers(item: WorkerPoolItem): void {
        item.timeouts.forEach(clearTimeout);
        item.timeouts.clear();
    }
};