import { errorMessage } from '@shared/application/utilities/error-message';
import { singleton } from '@shared/application/utilities/singleton';
import { getConfig } from '@core/config/daemon';
import { isModuleEnabled } from '@core/bootstrap/module-state';
import mountCommands from '@core/bootstrap/mount-commands';
import { getRuntimeRoleCoordinator } from '@core/bootstrap/RuntimeRoleCoordinator';
import { getDomainEventBridge } from '@core/bootstrap/mount-event-mappers';
import { getAnalysisDataStore } from '@modules/analysis/services/AnalysisDataStore';
import { getMinioService } from '@shared/infrastructure/storage/MinioService';
import { getQueueMaintenance } from '@shared/infrastructure/queues/QueueMaintenance';
import { getQueueService } from '@shared/infrastructure/queues/QueueService';
import { getDebugSessionManager } from '@modules/analysis/services/workflow/debug/DebugSessionManager';
import { getDaemonExposureRegistry } from '@modules/container/services/access/DaemonExposureRegistry';
import { getObjectGatewayServer } from '@shared/infrastructure/http/ObjectGatewayServer';
import { getVoltCloudConnection } from '@modules/container/socket/connection/VoltCloudConnection';
import { getVoltEventChannelConnection } from '@modules/container/socket/connection/VoltEventChannelConnection';
import { getVoltObjectGatewayConnection } from '@modules/container/socket/connection/VoltObjectGatewayConnection';
import { getReverseChannelBridge } from '@modules/container/socket/ReverseChannelBridge';
import { getHeartbeatPlaneProcess } from '@modules/system/services/HeartbeatPlaneProcess';
import { getPluginProcessPool } from '@modules/plugin/services/runtime/PluginProcessPool';
import { connectDaemonDataSource, disconnectDaemonDataSource } from '@shared/infrastructure/persistence/DataSource';
import { logger } from '@shared/infrastructure/logger';

export class DaemonLifecycle {
    private async connectInfrastructure(): Promise<void> {
        /* The analysis data store now shares the daemon's data source, so it has
           no connection of its own to open. */
        await Promise.all([
            connectDaemonDataSource(),
            getMinioService().ensureBuckets()
        ]);
    }

    private async disconnectInfrastructure(): Promise<void> {
        await disconnectDaemonDataSource();
    }

    async start(): Promise<void> {
        const config = getConfig();
        logger.info(`Bootstrapping cluster daemon services for teamClusterId=${config.teamClusterId}`);

        getDomainEventBridge();

        const reverseChannelBridge = getReverseChannelBridge();
        const voltCloudConnection = getVoltCloudConnection();
        const objectGatewayServer = getObjectGatewayServer();

        mountCommands(reverseChannelBridge);

        reverseChannelBridge.bindToClient(voltCloudConnection);
        reverseChannelBridge.bindObjectGatewayConnection(getVoltObjectGatewayConnection());

        await this.connectInfrastructure();

        /* Before the workers start claiming: the first pass returns any job whose
           lease was stranded by the restart this is recovering from. */
        getQueueMaintenance().start();

        getHeartbeatPlaneProcess().start();
        void getVoltEventChannelConnection().start().catch((error) => {
            logger.warn(`Daemon event channel did not connect during startup: ${errorMessage(error)}`);
        });

        await Promise.all([
            voltCloudConnection.start(),
            getVoltObjectGatewayConnection().start(),
            objectGatewayServer.start()
        ]);

        getDaemonExposureRegistry().upsertDaemonExposure(objectGatewayServer.getExposure());

        const runtimeConfig = await voltCloudConnection.getRuntimeConfig();

        getDaemonExposureRegistry().start();
        await getRuntimeRoleCoordinator().initialize(runtimeConfig);
        getHeartbeatPlaneProcess().publishRuntimeSnapshot();

        logger.info(`cluster-daemon started for team cluster ${config.teamClusterId}`);
    }

    async stop(): Promise<void> {
        const objectGatewayServer = getObjectGatewayServer();

        if (isModuleEnabled('analysis')) {
            getDebugSessionManager().shutdown();
        }

        await getRuntimeRoleCoordinator().stopComputeWorkers();

        getDaemonExposureRegistry().removeDaemonExposure(objectGatewayServer.getExposure().id);
        getDaemonExposureRegistry().stop();

        await objectGatewayServer.stop();

        getVoltCloudConnection().stop();
        getVoltEventChannelConnection().stop();
        getVoltObjectGatewayConnection().stop();
        getHeartbeatPlaneProcess().stop();

        getQueueMaintenance().stop();
        await getQueueService().close();

        if (isModuleEnabled('plugin')) {
            await getPluginProcessPool().shutdown();
        }

        await this.disconnectInfrastructure();
    }
}

export const getDaemonLifecycle = singleton((): DaemonLifecycle => new DaemonLifecycle());
