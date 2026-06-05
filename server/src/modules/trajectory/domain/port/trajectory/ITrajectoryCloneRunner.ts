export interface ITrajectoryCloneRunner {
    start(): void;
    stop(): void;
    kick(jobLimit?: number): void;
}
