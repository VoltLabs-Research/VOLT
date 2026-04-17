import { asClass, asValue, type AwilixContainer } from 'awilix';
import { loadConfig } from '@/core/config';
import { MetricsService } from '@/core/metrics/application/MetricsService';
import { RuntimeCapabilityGuard } from '@/core/runtime/application/RuntimeCapabilityGuard';
import { createBinaryExecutorService } from '@/core/runtime/infrastructure/BinaryExecutorService';
import { NativeModuleLoader } from '@/core/runtime/infrastructure/native/NativeModuleLoader';
import { QueueScopeLimitsRegistry } from '@/core/queues/application/QueueScopeLimitsRegistry';
import { ObjectGatewayTelemetryService } from '@/core/observability/infrastructure/ObjectGatewayTelemetryService';
import { createClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { TeamClusterDirectObjectStoreClient } from '@/core/storage/infrastructure/object-store/TeamClusterDirectObjectStoreClient';
import { createWorkflowNodeRegistry } from '@/modules/analysis/application/workflow/createWorkflowNodeRegistry';
import { registerInfrastructure } from '@/app/infrastructure';

type RuntimeRoleCoordinator = {
    getSnapshot(): import('@/core/config').DaemonRuntimeConfig;
};

type BootstrapContainer = AwilixContainer;

export const registerCoreBootstrap = (container: BootstrapContainer): void => {
    const bootStartedAt = Date.now();
    const config = loadConfig();
    const metricsService = new MetricsService();
    const queueScopeLimitsRegistry = new QueueScopeLimitsRegistry();
    const nativeModuleLoader = new NativeModuleLoader();
    const objectGatewayTelemetryService = new ObjectGatewayTelemetryService();
    const workflowNodeRegistry = createWorkflowNodeRegistry();
    const binaryExecutorService = createBinaryExecutorService();
    const remoteClient = new TeamClusterDirectObjectStoreClient(config);

    registerInfrastructure(container, config);

    const objectStore = createClusterObjectStore({
        config,
        minioService: container.resolve('minioService'),
        remoteClient,
        getRuntimeSnapshot: () => container.resolve<RuntimeRoleCoordinator>('runtimeRoleCoordinator').getSnapshot()
    });

    container.register({
        bootStartedAt: asValue(bootStartedAt),
        config: asValue(config),
        localOwnerClusterId: asValue(config.teamClusterId),
        getRuntimeSnapshot: asValue(() => container.resolve<RuntimeRoleCoordinator>('runtimeRoleCoordinator').getSnapshot()),
        getRuntimeConfigSnapshot: asValue(() => {
            try {
                return container.resolve<RuntimeRoleCoordinator>('runtimeRoleCoordinator').getSnapshot();
            } catch {
                return null;
            }
        }),
        runtimeSnapshotProvider: asValue({
            getSnapshot: () => container.resolve<RuntimeRoleCoordinator>('runtimeRoleCoordinator').getSnapshot()
        }),
        metricsService: asValue(metricsService),
        queueScopeLimitsRegistry: asValue(queueScopeLimitsRegistry),
        nativeModuleLoader: asValue(nativeModuleLoader),
        objectGatewayTelemetryService: asValue(objectGatewayTelemetryService),
        registry: asValue(workflowNodeRegistry),
        workflowNodeRegistry: asValue(workflowNodeRegistry),
        binaryExecutorService: asValue(binaryExecutorService),
        remoteClient: asValue(remoteClient),
        objectStore: asValue(objectStore),
        runtimeCapabilityGuard: asClass(RuntimeCapabilityGuard).singleton()
    });
};
