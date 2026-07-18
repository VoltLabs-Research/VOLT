export interface ITeamClusterHeartbeatMonitor {
    start(): void;
    stop(): void;
    runSweep(): Promise<void>;
}
