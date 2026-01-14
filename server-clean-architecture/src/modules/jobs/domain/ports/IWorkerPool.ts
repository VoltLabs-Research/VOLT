import { WorkerPoolItem } from "../entities/WorkerStatus";
import { Worker } from 'worker_threads';

export interface WorkerPoolConfig{
    workerPath: string;
    maxConcurrentJobs: number;
    minWorkers: number;
    idleWorkerTTL: number;
    crashWindowMs: number;
    maxConsecutiveCrashes: number;
    crashBackoffMs: number;
    maxOldGenerationSizeMb: number;
};

export interface WorkerMessageHandler{
    (workerId: number, message: any): Promise<void>;
};

export interface WorkerErrorHandler{
    (workerId: number, error: Error): Promise<void>;
};

export interface WorkerExitHandler{
    (workerId: number, code: number): Promise<void>;
};

export interface IWorkerPoolService{
    /**
     * Initialize the worker pool.
     */
    initialize(
        config: WorkerPoolConfig,
        onMessage: WorkerMessageHandler,
        onError: WorkerErrorHandler,
        onExit: WorkerExitHandler,
        getBacklogCount: () => Promise<number>
    ): void;

    /**
     * Get all workers.
     */
    getWorkers(): WorkerPoolItem[];

    /**
     * Get available worker count.
     */
    getAvailableWorkerCount(): number;

     /**
     * Get pool size
     */
    getPoolSize(): number;

    /**
     * Check if in crash loop
     */
    isInCrashLoopState(): boolean;

    /**
     * Get consecutive crashes
     */
    getConsecutiveCrashes(): number;

    /**
     * Find worker by thread ID
     */
    findWorkerByThreadId(threadId: number): WorkerPoolItem | undefined;

    /**
     * Find worker index by thread ID
     */
    findWorkerIndexByThreadId(threadId: number): number;

    /**
     * Clear worker timers
     */
    clearWorkerTimers(item: WorkerPoolItem): void;

    /**
     * Schedule scale down
     */
    scheduleScaleDown(item: WorkerPoolItem): void;

    /**
     * Spawn a new worker
     */
    spawnWorker(): WorkerPoolItem;

    /**
     * Scale up by N workers
     */
    scaleUp(n: number): Promise<void>;

    /**
     * Terminate all workers
     */
    terminateAll(): void;
};