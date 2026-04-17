import { asClass, asFunction, createContainer } from 'awilix';
import { ObjectGatewayServer } from '@/core/storage/infrastructure/gateway/ObjectGatewayServer';
import { verifyTeamClusterDirectAccessToken } from '@/modules/container/application/access/TeamClusterDirectAccessTokenVerifier';
import { DaemonExposureRegistryService } from '@/modules/container/application/access/DaemonExposureRegistryService';
import { ReverseChannelSocketBridge } from '@/modules/container/infrastructure/reverse-channel/ReverseChannelSocketBridge';
import { VoltCloudConnection } from '@/modules/container/infrastructure/connection/VoltCloudConnection';

type BootstrapContainer = ReturnType<typeof createContainer>;

export const registerContainerBootstrap = (container: BootstrapContainer): void => {
    container.register({
        voltCloudConnection: asClass(VoltCloudConnection).singleton(),
        reverseChannelSocketBridge: asClass(ReverseChannelSocketBridge).singleton(),
        daemonExposureRegistryService: asClass(DaemonExposureRegistryService).singleton(),
        objectGatewayServer: asFunction((config, minioService, objectGatewayTelemetryService, runtimeCapabilityGuard) => {
            return new ObjectGatewayServer(
                config,
                minioService,
                objectGatewayTelemetryService,
                {
                    capabilityGuard: runtimeCapabilityGuard,
                    verifyDirectAccessToken: (token) => verifyTeamClusterDirectAccessToken(config.daemonPassword, token)
                }
            );
        }).singleton()
    });
};
