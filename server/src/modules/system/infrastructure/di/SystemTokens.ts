interface SystemTokens {
    readonly MetricsService: symbol;
    readonly CpuMetricsCollector: symbol;
    readonly MemoryMetricsCollector: symbol;
    readonly DiskMetricsCollector: symbol;
    readonly NetworkMetricsCollector: symbol;
    readonly MongoMetricsCollector: symbol;
    readonly ServiceHealthPinger: symbol;
    readonly SystemMetricsRepository: symbol;
    readonly ClusterMetricsAggregator: symbol;
    readonly MetricsSocketOrchestrator: symbol;
    readonly SystemSocketModule: symbol;
}

export const SYSTEM_TOKENS: SystemTokens = {
    MetricsService: Symbol.for('SystemMetricsService'),
    CpuMetricsCollector: Symbol.for('CpuMetricsCollector'),
    MemoryMetricsCollector: Symbol.for('MemoryMetricsCollector'),
    DiskMetricsCollector: Symbol.for('DiskMetricsCollector'),
    NetworkMetricsCollector: Symbol.for('NetworkMetricsCollector'),
    MongoMetricsCollector: Symbol.for('MongoMetricsCollector'),
    ServiceHealthPinger: Symbol.for('ServiceHealthPinger'),
    SystemMetricsRepository: Symbol.for('SystemMetricsRepository'),
    ClusterMetricsAggregator: Symbol.for('ClusterMetricsAggregator'),
    MetricsSocketOrchestrator: Symbol.for('MetricsSocketOrchestrator'),
    SystemSocketModule: Symbol.for('SystemSocketModule')
};
