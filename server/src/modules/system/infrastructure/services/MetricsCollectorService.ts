import os from 'os';
import { inject, injectable } from 'tsyringe';
import type { IMetricsService } from '@modules/system/domain/port/IMetricsService';
import type { ISystemMetricsRepository } from '@modules/system/domain/port/ISystemMetricsRepository';
import type { SystemMetrics } from '@modules/system/domain/value-objects/SystemMetrics';
import { SYSTEM_TOKENS } from '@modules/system/infrastructure/di/SystemTokens';
import type { ServerStatus } from './metricsTypes';
import CpuMetricsCollector from './CpuMetricsCollector';
import MemoryMetricsCollector from './MemoryMetricsCollector';
import DiskMetricsCollector from './DiskMetricsCollector';
import NetworkMetricsCollector from './NetworkMetricsCollector';
import MongoMetricsCollector from './MongoMetricsCollector';
import ServiceHealthPinger from './ServiceHealthPinger';
import ClusterMetricsAggregator from './ClusterMetricsAggregator';

@injectable()
export default class MetricsCollector implements IMetricsService {
    constructor(
        @inject(SYSTEM_TOKENS.CpuMetricsCollector)
        private readonly cpuCollector: CpuMetricsCollector,
        @inject(SYSTEM_TOKENS.MemoryMetricsCollector)
        private readonly memoryCollector: MemoryMetricsCollector,
        @inject(SYSTEM_TOKENS.DiskMetricsCollector)
        private readonly diskCollector: DiskMetricsCollector,
        @inject(SYSTEM_TOKENS.NetworkMetricsCollector)
        private readonly networkCollector: NetworkMetricsCollector,
        @inject(SYSTEM_TOKENS.MongoMetricsCollector)
        private readonly mongoCollector: MongoMetricsCollector,
        @inject(SYSTEM_TOKENS.ServiceHealthPinger)
        private readonly healthPinger: ServiceHealthPinger,
        @inject(SYSTEM_TOKENS.SystemMetricsRepository)
        private readonly metricsRepository: ISystemMetricsRepository,
        @inject(SYSTEM_TOKENS.ClusterMetricsAggregator)
        private readonly clusterAggregator: ClusterMetricsAggregator
    ) {}

    private determineStatus(cpuUsage: number, memoryUsage: number, diskUsage: number): ServerStatus {
        if (cpuUsage >= 90 || memoryUsage >= 90 || diskUsage >= 90) return 'Critical';
        if (cpuUsage >= 75 || memoryUsage >= 75 || diskUsage >= 85) return 'Warning';
        return 'Healthy';
    }

    async collect(): Promise<SystemMetrics> {
        const cpu = {
            usage: this.cpuCollector.getUsage(),
            cores: os.cpus().length,
            loadAvg: os.loadavg(),
            coresUsage: this.cpuCollector.getCoresUsage()
        };

        const memory = this.memoryCollector.collect();
        const disk = await this.diskCollector.getUsage();
        const network = await this.networkCollector.collect();
        const mongodb = await this.mongoCollector.collect();
        const responseTimes = await this.healthPinger.collectAll();
        const diskOperations = await this.diskCollector.getOperations();

        const status = this.determineStatus(cpu.usage, memory.usagePercent, disk.usagePercent);

        const metrics: SystemMetrics = {
            timestamp: new Date(),
            serverId: process.env.CLUSTER_ID || os.hostname(),
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
