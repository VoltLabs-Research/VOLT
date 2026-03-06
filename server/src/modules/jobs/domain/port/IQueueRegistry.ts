export interface QueueInfo {
    queueName: string;
    statusKeyPrefix: string;
    queueKey: string;
    processingKey: string;
}

export interface IQueueRegistry {
    /**
     * Register a queue in the registry
     */
    registerQueue(info: QueueInfo): void;

    /**
     * Get all registered queue status key prefixes
     */
    getAllStatusKeyPrefixes(): string[];

    /**
     * Get information about a specific queue by name
     */
    getQueueInfo(queueName: string): QueueInfo | undefined;

    /**
     * Get all registered queues
     */
    getAllQueues(): QueueInfo[];
}
