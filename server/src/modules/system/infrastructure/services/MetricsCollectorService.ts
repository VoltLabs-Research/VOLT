import type { SystemMetrics, SystemStatus } from '@modules/system/domain/value-objects/SystemMetrics';
import SystemMetricsRedisRepository from '@modules/system/infrastructure/persistence/redis/SystemMetricsRedisRepository';
import { resolveSystemMetricsIdentity } from '@modules/system/utilities/resolveSystemMetricsIdentity';
import os from 'node:os';
import { injectable } from 'tsyringe';
import ClusterMetricsAggregator from './ClusterMetricsAggregator';
import CpuMetricsCollector from './CpuMetricsCollector';
import DiskMetricsCollector from './DiskMetricsCollector';
import MemoryMetricsCollector from './MemoryMetricsCollector';
import MongoMetricsCollector from './MongoMetricsCollector';
import NetworkMetricsCollector from './NetworkMetricsCollector';
import ServiceHealthPinger from './ServiceHealthPinger';

@injectable()
export default class MetricsCollector {
    constructor(
        
        private readonly cpuCollector: CpuMetricsCollector,
        
        private readonly memoryCollector: MemoryMetricsCollector,
        
        private readonly diskCollector: DiskMetricsCollector,
        
        private readonly networkCollector: NetworkMetricsCollector,
        
        private readonly mongoCollector: MongoMetricsCollector,
        
        private readonly healthPinger: ServiceHealthPinger,
        
        private readonly metricsRepository: SystemMetricsRedisRepository,
        
        private readonly clusterAggregator: ClusterMetricsAggregator
    ) {}

    private determineStatus(cpuUsage: number, memoryUsage: number, diskUsage: number): SystemStatus {
        if (cpuUsage >= 90 || memoryUsage >= 90 || diskUsage >= 90) return 'Critical';
        if (cpuUsage >= 75 || memoryUsage >= 75 || diskUsage >= 85) return 'Warning';
        return 'Healthy';
    }

    async collect(): Promise<SystemMetrics> {
        const identity = resolveSystemMetricsIdentity();
        const [cpuMetrics, disk, network, mongodb, responseTimes, diskOperations] = await Promise.all([
            this.cpuCollector.collect(),
            this.diskCollector.getUsage(),
            this.networkCollector.collect(),
            this.mongoCollector.collect(),
            this.healthPinger.collectAll(),
            this.diskCollector.getOperations()
        ]);
        const cpu = {
            usage: cpuMetrics.usage,
            cores: os.cpus().length,
            loadAvg: os.loadavg(),
            coresUsage: cpuMetrics.coresUsage
        };

        const memory = this.memoryCollector.collect();

        const status = this.determineStatus(cpu.usage, memory.usagePercent, disk.usagePercent);

        const metrics: SystemMetrics = {
            timestamp: new Date(),
            serverId: identity.serverId,
            teamClusterId: identity.teamClusterId,
            cpu,
            memory,
            disk,
            network,
            responseTime: responseTimes.average,
            responseTimes,
            diskOperations,
            status,
            uptime: os.uptime(),
            mongodb
        };

        await this.metricsRepository.save(metrics);
        return metrics;
    }

    async getLatest(): Promise<SystemMetrics | null> {
        return this.metricsRepository.getLatest();
    }

    async getHistory(minutes: number = 5): Promise<SystemMetrics[]> {
        return this.metricsRepository.getHistory(minutes);
    }

    async getHistoryByClusterId(clusterId: string, minutes: number = 5): Promise<SystemMetrics[]> {
        return this.metricsRepository.getHistoryByClusterId(clusterId, minutes);
    }

    async cleanExpiredHistory(): Promise<number> {
        return this.metricsRepository.deleteExpired();
    }

    async getClusterAnalysisCounts(): Promise<Record<string, number>> {
        return this.clusterAggregator.getClusterAnalysisCounts();
    }

    async getAllClustersMetrics() {
        return this.clusterAggregator.getAllClustersMetrics();
    }
}
