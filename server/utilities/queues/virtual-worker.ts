import { EventEmitter } from 'events';

export class VirtualWorker extends EventEmitter {
    threadId: number;
    private processor: (job: any, postMessage?: (msg: any) => void) => Promise<any>;

    constructor(processor: (job: any, postMessage?: (msg: any) => void) => Promise<any>) {
        super();
        this.threadId = Math.floor(Math.random() * 1000000);
        this.processor = processor;
    }

    postMessage(message: { job: any }) {
        // Execute immediately (async)
        this.run(message.job);
    }

    private async run(job: any) {
        try {
            const postMessage = (msg: any) => this.emit('message', msg);
            const result = await this.processor(job, postMessage);
            if (result) {
                this.emit('message', result);
            }
        } catch (error: any) {
            this.emit('message', {
                status: 'failed',
                jobId: job?.jobId || 'unknown',
                error: error.message || error
            });
        }
    }

    terminate() {
        this.removeAllListeners();
    }
}
