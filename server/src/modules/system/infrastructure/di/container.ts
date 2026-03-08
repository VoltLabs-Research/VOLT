import { container } from 'tsyringe';
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

export const registerSystemDependencies = (): void => {
    container.registerSingleton(SYSTEM_TOKENS.CpuMetricsCollector, CpuMetricsCollector);
    container.registerSingleton(SYSTEM_TOKENS.MemoryMetricsCollector, MemoryMetricsCollector);
    container.registerSingleton(SYSTEM_TOKENS.DiskMetricsCollector, DiskMetricsCollector);
    container.registerSingleton(SYSTEM_TOKENS.NetworkMetricsCollector, NetworkMetricsCollector);
    container.registerSingleton(SYSTEM_TOKENS.MongoMetricsCollector, MongoMetricsCollector);
    container.registerSingleton(SYSTEM_TOKENS.ServiceHealthPinger, ServiceHealthPinger);
    container.registerSingleton(SYSTEM_TOKENS.SystemMetricsRepository, SystemMetricsRedisRepository);
    container.registerSingleton(SYSTEM_TOKENS.ClusterMetricsAggregator, ClusterMetricsAggregator);
    container.registerSingleton(SYSTEM_TOKENS.MetricsService, MetricsCollectorService);
    container.registerSingleton(SYSTEM_TOKENS.MetricsSocketOrchestrator, SystemMetricsSocketOrchestrator);
    container.registerSingleton(SYSTEM_TOKENS.SystemSocketModule, SystemSocketModule);
    container.register(SOCKET_TOKENS.SocketModule, { useToken: SYSTEM_TOKENS.SystemSocketModule });
};
