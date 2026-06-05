export interface IClusterTransferRunner {
    start(): void;
    stop(): void;
    kick(jobLimit?: number): void;
}
