import { asClass, asFunction, createContainer } from 'awilix';
import { ObjectGatewayServer } from '@/core/storage/infrastructure/gateway/ObjectGatewayServer';
import { verifyTeamClusterDirectAccessToken } from '@/modules/container/application/access/team-cluster-direct-access-token-verifier';
import { DaemonExposureRegistry } from '@/modules/container/application/access/DaemonExposureRegistry';
import { ReverseChannelBridge } from '@/modules/container/infrastructure/reverse-channel/ReverseChannelBridge';
import { VoltCloudConnection } from '@/modules/container/infrastructure/connection/VoltCloudConnection';

type BootstrapContainer = ReturnType<typeof createContainer>;

export const registerContainerBootstrap = (container: BootstrapContainer): void => {
    container.register({
        voltCloudConnection: asClass(VoltCloudConnection).singleton(),
        reverseChannelBridge: asClass(ReverseChannelBridge).singleton(),
        daemonExposureRegistry: asClass(DaemonExposureRegistry).singleton(),
        objectGatewayServer: asFunction((config, minioService, objectGatewayTelemetry) => {
            return new ObjectGatewayServer(
                config,
                minioService,
                objectGatewayTelemetry,
                {
                    verifyDirectAccessToken: (token) => verifyTeamClusterDirectAccessToken(config.daemonPassword, token)
                }
            );
        }).singleton()
    });
};
