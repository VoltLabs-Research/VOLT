export interface ITempStorageLifecycleService {
    start(): Promise<void>;
    stop(): void;
    runCleanupCycle(): Promise<void>;
}
