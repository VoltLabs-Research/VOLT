export interface QueueNotifier {
    notify(queue: string): Promise<void>;
    waitForWork(queue: string, timeoutMs: number): Promise<void>;
    close(): Promise<void>;
}
