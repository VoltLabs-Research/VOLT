export interface QueueInfo {
    queueName: string;
    statusKeyPrefix: string;
    queueKey: string;
    processingKey: string;
}

export interface IQueueRegistry {
    registerQueue(info: QueueInfo): void;
    getAllStatusKeyPrefixes(): string[];
    getQueueInfo(queueName: string): QueueInfo | undefined;
    getAllQueues(): QueueInfo[];
}
