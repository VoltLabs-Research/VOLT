/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import util from 'util';
import { Worker } from 'worker_threads';
import { WorkerPoolItem } from '@/types/queues/base-processing-queue';
import { VirtualWorker } from '@/utilities/queues/virtual-worker';
import { QUEUE_DEFAULTS } from '@/config/queue-defaults';
import logger from '@/logger';

export interface WorkerPoolConfig {
    workerPath: string;
    maxConcurrentJobs: number;
    minWorkers: number;
    idleWorkerTTL: number;
    crashWindowMs: number;
    maxConsecutiveCrashes: number;
    crashBackoffMs: number;
    useWorkerThreads?: boolean;
    processor?: (job: any) => Promise<any>;
    logPrefix: string;
    maxOldGenerationSizeMb: number;
}

export interface WorkerMessageHandler {
    (workerId: number, message: any): Promise<void>;
}

export interface WorkerErrorHandler {
    (workerId: number, error: Error): Promise<void>;
}

export interface WorkerExitHandler {
    (workerId: number, code: number): Promise<void>;
}

/**
 * Manages the worker thread pool for job processing.
 * Handles spawning, scaling, crash detection, and lifecycle management.
 */
export class WorkerPool {
    private workerPool: WorkerPoolItem[] = [];
    private consecutiveCrashes = 0;
    private lastCrashTime = 0;
    private isInCrashLoop = false;

    constructor(
        private readonly config: WorkerPoolConfig,
        private readonly onMessage: WorkerMessageHandler,
        private readonly onError: WorkerErrorHandler,
        private readonly onExit: WorkerExitHandler,
        private readonly getBacklogCount: () => Promise<number>
    ) { }

    private logInfo(message: string): void {
        logger.info(`${this.config.logPrefix} ${message}`);
    }

    private logError(message: string): void {
        logger.error(`${this.config.logPrefix} ${message}`);
    }

    private logWarn(message: string): void {
        logger.warn(`${this.config.logPrefix} ${message}`);
    }

    /**
     * Get all workers in the pool
     */
    getWorkers(): WorkerPoolItem[] {
        return this.workerPool;
    }

    /**
     * Get count of available (idle) workers
     */
    getAvailableWorkerCount(): number {
        return this.workerPool.filter(item => item.isIdle).length;
    }

    /**
     * Get current pool size
     */
    getPoolSize(): number {
        return this.workerPool.length;
    }

    /**
     * Check if crash loop is active
     */
    isInCrashLoopState(): boolean {
        return this.isInCrashLoop;
    }

    /**
     * Get consecutive crash count
     */
    getConsecutiveCrashes(): number {
        return this.consecutiveCrashes;
    }

    /**
     * Find a worker by thread ID
     */
    findWorkerByThreadId(threadId: number): WorkerPoolItem | undefined {
        return this.workerPool.find(({ worker }) => worker.threadId === threadId);
    }

    /**
     * Find index of a worker by thread ID
     */
    findWorkerIndexByThreadId(threadId: number): number {
        return this.workerPool.findIndex(({ worker }) => worker.threadId === threadId);
    }

    /**
     * Clear all timers for a worker
     */
    clearWorkerTimers(item: WorkerPoolItem): void {
        item.timeouts.forEach(clearTimeout);
        item.timeouts.clear();
    }

    /**
     * Schedule scale down for an idle worker
     */
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

    /**
     * Spawn a new worker and add to pool
     */
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

    /**
     * Scale up the worker pool by N workers
     */
    async scaleUp(n: number): Promise<void> {
        const canSpawn = Math.max(0, this.config.maxConcurrentJobs - this.workerPool.length);
        const toSpawn = Math.min(n, canSpawn);

        for (let i = 0; i < toSpawn; i++) {
            this.spawnWorker();
        }
    }

    /**
     * Create a new worker (thread or virtual)
     */
    private createWorker(): Worker | VirtualWorker {
        if (this.config.useWorkerThreads === false && this.config.processor) {
            const worker = new VirtualWorker(this.config.processor);
            const workerId = worker.threadId;

            worker.on('message', (message: any) => this.onMessage(workerId, message));
            return worker;
        }

        this.logInfo(`Spawning new worker (current pool size: ${this.workerPool.length}/${this.config.maxConcurrentJobs})`);

        const worker = new Worker(this.config.workerPath, {
            execArgv: [
                '-r',
                'ts-node/register',
                '-r',
                'tsconfig-paths/register'
            ],
            resourceLimits: {
                maxOldGenerationSizeMb: this.config.maxOldGenerationSizeMb
            }
        });

        const workerId = worker.threadId;

        worker.on('message', (message) => this.onMessage(workerId, message));
        worker.on('error', (err: any) => this.handleWorkerError(workerId, err));
        worker.on('exit', (code) => this.handleWorkerExit(workerId, code));

        this.logInfo(`Worker #${workerId} created successfully`);

        return worker;
    }

    /**
     * Handle worker error
     */
    private async handleWorkerError(workerId: number, err: Error): Promise<void> {
        let msg = 'Unknown error';
        try {
            if (err instanceof Error) {
                msg = err.message;
                if (err.stack) msg += `\nStack: ${err.stack}`;
            } else if (typeof err === 'string') {
                msg = err;
            } else {
                msg = util.inspect(err, { depth: null, colors: false, breakLength: Infinity });
            }
        } catch {
            msg = 'Non-inspectable error';
        }

        this.logError(`Worker #${workerId} error: ${msg}`);
        await this.onError(workerId, new Error(msg));
        this.replaceWorker(workerId, false);
    }

    /**
     * Handle worker exit
     */
    private async handleWorkerExit(workerId: number, code: number): Promise<void> {
        let hadJob = true;
        if (code !== 0) {
            this.logError(`Worker #${workerId} exited unexpectedly with code ${code}`);
            await this.onExit(workerId, code);
            hadJob = true; // Assume it had a job for replacement purposes
        }
        this.replaceWorker(workerId, hadJob);
    }

    /**
     * Check for crash loop condition
     */
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
                    this.logError(
                        `CRASH LOOP DETECTED: ${this.consecutiveCrashes} consecutive worker crashes in ${this.config.crashWindowMs}ms. ` +
                        `Applying backoff to prevent crash-loop. Check worker startup code for errors.`
                    );
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

    /**
     * Replace a crashed/exited worker
     */
    private replaceWorker(workerId: number, hadJob: boolean): void {
        const idx = this.workerPool.findIndex(({ worker }) => worker.threadId === workerId);
        if (idx !== -1) {
            const old = this.workerPool[idx];
            old.worker.terminate();
            old.timeouts.forEach(clearTimeout);
            this.workerPool.splice(idx, 1);
        }

        const inCrashLoop = this.checkCrashLoop(hadJob);

        this.getBacklogCount().then((backlog) => {
            if (this.workerPool.length < this.config.minWorkers || backlog > 0) {
                if (inCrashLoop) {
                    const delay = this.config.crashBackoffMs * Math.min(this.consecutiveCrashes, 5);
                    this.logWarn(`Applying ${delay}ms backoff before respawning worker due to crash-loop`);
                    setTimeout(() => {
                        this.spawnWorker();
                    }, delay);
                } else {
                    this.spawnWorker();
                }
            }
        }).catch(() => {
            if (this.workerPool.length < this.config.minWorkers) {
                if (inCrashLoop) {
                    const delay = this.config.crashBackoffMs * Math.min(this.consecutiveCrashes, 5);
                    setTimeout(() => {
                        this.spawnWorker();
                    }, delay);
                } else {
                    this.spawnWorker();
                }
            }
        });
    }

    /**
     * Terminate all workers in the pool
     */
    terminateAll(): void {
        for (const item of this.workerPool) {
            item.timeouts.forEach(clearTimeout);
            item.worker.terminate();
        }
        this.workerPool = [];
    }
}
