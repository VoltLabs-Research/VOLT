import { asValue, type AwilixContainer } from 'awilix';
import { loadConfig, type DaemonRuntimeConfig } from '@/core/config';
import { MetricsService } from '@/core/metrics/application/MetricsService';
import { ObjectGatewayTelemetry } from '@/core/observability/infrastructure/ObjectGatewayTelemetry';
import { QueueScopeLimitsRegistry } from '@/core/queues/application/QueueScopeLimitsRegistry';
import { DirectObjectStoreClient } from '@/core/storage/infrastructure/object-store/DirectObjectStoreClient';
import { WorkflowNodeRegistry } from '@/modules/analysis/application/workflow/NodeRegistry';

type RuntimeRoleCoordinator = {
    getSnapshot(): DaemonRuntimeConfig;
};

export const registerBootstrapValues = (container: AwilixContainer): void => {
    const config = loadConfig();
    const workflowNodeRegistry = WorkflowNodeRegistry.createDefault();

    container.register({
        bootStartedAt: asValue(Date.now()),
        config: asValue(config),
        localOwnerClusterId: asValue(config.teamClusterId),
        metricsService: asValue(new MetricsService()),
        queueScopeLimitsRegistry: asValue(new QueueScopeLimitsRegistry()),
        objectGatewayTelemetry: asValue(new ObjectGatewayTelemetry()),
        registry: asValue(workflowNodeRegistry),
        workflowNodeRegistry: asValue(workflowNodeRegistry),
        remoteClient: asValue(new DirectObjectStoreClient(config)),
        getRuntimeConfigSnapshot: asValue((): DaemonRuntimeConfig | null => {
            try {
                return container.resolve<RuntimeRoleCoordinator>('runtimeRoleCoordinator').getSnapshot();
            } catch {
                return null;
            }
        })
    });
};
