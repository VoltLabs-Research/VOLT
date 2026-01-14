import { Worker } from 'worker_threads';

export interface WorkerPoolItem{
    worker: Worker;
    isIdle: boolean;
    jobCount: number;
    lastUsed: number;
    timeouts: Set<NodeJS.Timeout>;
    currentJobId?: string;
};

export default class WorkerStatus{
    constructor(
        public props: WorkerPoolItem
    ){}

    static create(worker: Worker): WorkerStatus{
        return new WorkerStatus({
            worker,
            isIdle: true,
            jobCount: 0,
            lastUsed: Date.now(),
            timeouts: new Set()
        });
    }

    markAsBusy(jobId: string): void{
        this.props.isIdle = false;
        this.props.currentJobId = jobId;
        this.props.lastUsed = Date.now();
        this.props.jobCount++;
    }

    markAsIdle(): void{
        this.props.isIdle = true;
        this.props.currentJobId = undefined;
        this.props.lastUsed = Date.now();
    }

    clearTimeouts(): void{
        this.props.timeouts.forEach(clearTimeout);
        this.props.timeouts.clear();
    }

    addTimeout(timeout: NodeJS.Timeout): void{
        this.props.timeouts.add(timeout);
    }
};