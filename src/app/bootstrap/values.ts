import { asValue, type AwilixContainer } from 'awilix';
import { loadConfig } from '@/core/config';
import type { TeamClusterDaemonRuntimeConfig } from '@/core/runtime/contracts/team-cluster-runtime';
import { MetricsService } from '@/core/metrics/application/MetricsService';
import { QueueScopeLimitsRegistry } from '@/core/queues/application/QueueScopeLimitsRegistry';
import { DirectObjectStoreClient } from '@/core/storage/infrastructure/object-store/DirectObjectStoreClient';
import { WorkflowNodeRegistry } from '@/modules/analysis/application/workflow/NodeRegistry';

type RuntimeRoleCoordinator = {
    getSnapshot(): TeamClusterDaemonRuntimeConfig;
};

export const registerBootstrapValues = (container: AwilixContainer): void => {
    const config = loadConfig();
    const workflowNodeRegistry = WorkflowNodeRegistry.createDefault();

    container.register({
        config: asValue(config),
        metricsService: asValue(new MetricsService()),
        queueScopeLimitsRegistry: asValue(new QueueScopeLimitsRegistry()),
        registry: asValue(workflowNodeRegistry),
        workflowNodeRegistry: asValue(workflowNodeRegistry),
        remoteClient: asValue(new DirectObjectStoreClient(config)),
        getRuntimeConfigSnapshot: asValue((): TeamClusterDaemonRuntimeConfig | null => {
            try {
                return container.resolve<RuntimeRoleCoordinator>('runtimeRoleCoordinator').getSnapshot();
            } catch {
                return null;
            }
        })
    });
};
