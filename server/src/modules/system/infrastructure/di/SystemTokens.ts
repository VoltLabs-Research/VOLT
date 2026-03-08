export const SYSTEM_TOKENS = {
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
} as const;
