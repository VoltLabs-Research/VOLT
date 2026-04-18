import { asClass, asValue, type AwilixContainer } from 'awilix';
import { loadConfig } from '@/core/config';
import { MetricsService } from '@/core/metrics/application/MetricsService';
import { createBinaryExecutorService } from '@/core/runtime/infrastructure/binary-executor-service';
import { QueueScopeLimitsRegistry } from '@/core/queues/application/QueueScopeLimitsRegistry';
import { ObjectGatewayTelemetry } from '@/core/observability/infrastructure/ObjectGatewayTelemetry';
import { createClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { DirectObjectStoreClient } from '@/core/storage/infrastructure/object-store/DirectObjectStoreClient';
import { WorkflowNodeRegistry } from '@/modules/analysis/application/workflow/NodeRegistry';
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
    const objectGatewayTelemetry = new ObjectGatewayTelemetry();
    const workflowNodeRegistry = WorkflowNodeRegistry.createDefault();
    const binaryExecutorService = createBinaryExecutorService();
    const remoteClient = new DirectObjectStoreClient(config);

    registerInfrastructure(container, config);

    const objectStore = createClusterObjectStore({
        config,
        minioService: container.resolve('minioService'),
        remoteClient
    });

    container.register({
        bootStartedAt: asValue(bootStartedAt),
        config: asValue(config),
        localOwnerClusterId: asValue(config.teamClusterId),
        getRuntimeConfigSnapshot: asValue(() => {
            try {
                return container.resolve<RuntimeRoleCoordinator>('runtimeRoleCoordinator').getSnapshot();
            } catch {
                return null;
            }
        }),
        metricsService: asValue(metricsService),
        queueScopeLimitsRegistry: asValue(queueScopeLimitsRegistry),
        objectGatewayTelemetry: asValue(objectGatewayTelemetry),
        registry: asValue(workflowNodeRegistry),
        workflowNodeRegistry: asValue(workflowNodeRegistry),
        binaryExecutorService: asValue(binaryExecutorService),
        remoteClient: asValue(remoteClient),
        objectStore: asValue(objectStore)
    });
};
