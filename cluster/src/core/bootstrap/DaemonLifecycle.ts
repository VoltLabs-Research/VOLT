import { errorMessage } from '@shared/utilities/error-message';
import { singleton } from '@shared/utilities/singleton';
import { getConfig } from '@core/config/daemon';
import mountCommands from '@core/bootstrap/mount-commands';
import { getRuntimeRoleCoordinator } from '@core/bootstrap/RuntimeRoleCoordinator';
import { getDomainEventBridge } from '@core/bootstrap/mount-event-mappers';
import { getFilesystemObjectStore } from '@shared/storage/FilesystemObjectStore';
import { getQueueMaintenance } from '@shared/queues/QueueMaintenance';
import { getQueueService } from '@shared/queues/QueueService';
import { getDebugSessionManager } from '@modules/analysis/services/workflow/debug/DebugSessionManager';
import { getDaemonExposureRegistry } from '@modules/system/services/access/DaemonExposureRegistry';
import { getObjectGatewayServer } from '@shared/http/ObjectGatewayServer';
import { getVoltCloudConnection } from '@modules/system/socket/connection/VoltCloudConnection';
import { getVoltEventChannelConnection } from '@modules/system/socket/connection/VoltEventChannelConnection';
import { getVoltObjectGatewayConnection } from '@modules/system/socket/connection/VoltObjectGatewayConnection';
import { getReverseChannelBridge } from '@modules/system/socket/ReverseChannelBridge';
import { getHeartbeatPlaneProcess } from '@modules/system/services/HeartbeatPlaneProcess';
import { getPluginProcessPool } from '@modules/plugin/services/runtime/PluginProcessPool';
import { connectDaemonDataSource, disconnectDaemonDataSource } from '@shared/persistence/DataSource';
import { getDaemonEntities } from '@core/bootstrap/entities';
import { logger } from '@shared/logger';

export class DaemonLifecycle {
    private async connectInfrastructure(): Promise<void> {
        await Promise.all([
            connectDaemonDataSource(getDaemonEntities()),
            getFilesystemObjectStore().ensureBuckets()
        ]);
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

        getDebugSessionManager().shutdown();

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

        await getPluginProcessPool().shutdown();

        await disconnectDaemonDataSource();
    }
}

export const getDaemonLifecycle = singleton((): DaemonLifecycle => new DaemonLifecycle());
