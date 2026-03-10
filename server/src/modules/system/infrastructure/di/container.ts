import { SYSTEM_TOKENS } from '@modules/system/infrastructure/di/SystemTokens';
import MetricsCollectorService from '@modules/system/infrastructure/services/MetricsCollectorService';
import CpuMetricsCollector from '@modules/system/infrastructure/services/CpuMetricsCollector';
import MemoryMetricsCollector from '@modules/system/infrastructure/services/MemoryMetricsCollector';
import DiskMetricsCollector from '@modules/system/infrastructure/services/DiskMetricsCollector';
import NetworkMetricsCollector from '@modules/system/infrastructure/services/NetworkMetricsCollector';
import MongoMetricsCollector from '@modules/system/infrastructure/services/MongoMetricsCollector';
import ServiceHealthPinger from '@modules/system/infrastructure/services/ServiceHealthPinger';
import ClusterMetricsAggregator from '@modules/system/infrastructure/services/ClusterMetricsAggregator';
import SystemMetricsRedisRepository from '@modules/system/infrastructure/persistence/redis/SystemMetricsRedisRepository';
import SystemSocketModule from '@modules/system/socket/SystemSocketModule';
import SystemMetricsSocketOrchestrator from '@modules/system/socket/SystemMetricsSocketOrchestrator';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { registerModuleDependencies } from '@shared/infrastructure/di/registerModuleDependencies';

export const registerSystemDependencies = (): void => {
    registerModuleDependencies({
        singletons: [
            [SYSTEM_TOKENS.CpuMetricsCollector, CpuMetricsCollector],
            [SYSTEM_TOKENS.MemoryMetricsCollector, MemoryMetricsCollector],
            [SYSTEM_TOKENS.DiskMetricsCollector, DiskMetricsCollector],
            [SYSTEM_TOKENS.NetworkMetricsCollector, NetworkMetricsCollector],
            [SYSTEM_TOKENS.MongoMetricsCollector, MongoMetricsCollector],
            [SYSTEM_TOKENS.ServiceHealthPinger, ServiceHealthPinger],
            [SYSTEM_TOKENS.SystemMetricsRepository, SystemMetricsRedisRepository],
            [SYSTEM_TOKENS.ClusterMetricsAggregator, ClusterMetricsAggregator],
            [SYSTEM_TOKENS.MetricsService, MetricsCollectorService],
            [SYSTEM_TOKENS.MetricsSocketOrchestrator, SystemMetricsSocketOrchestrator],
            [SYSTEM_TOKENS.SystemSocketModule, SystemSocketModule]
        ],
        aliases: [[SOCKET_TOKENS.SocketModule, SYSTEM_TOKENS.SystemSocketModule]]
    });
};
