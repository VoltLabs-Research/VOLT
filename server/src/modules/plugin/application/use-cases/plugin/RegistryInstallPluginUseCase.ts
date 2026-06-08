import type RegistryGateway from '@modules/plugin/infrastructure/services/plugin/RegistryGateway';
import PluginCreatedEvent from '@modules/plugin/domain/events/PluginCreatedEvent';
import type { IPluginStorageService } from '@modules/plugin/domain/port/plugin/IPluginStorageService';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { mapPluginToPersistedDTO } from '@modules/plugin/utilities/mappers/plugin/mapPluginToPersistedDTO';
import {
    RegistryInstallPluginInputDTO,
    RegistryInstallPluginOutputDTO
} from '@modules/plugin/application/dtos/plugin/RegistryInstallPluginDTO';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import type { ITeamClusterSelectionService } from '@modules/container/domain/port/ITeamClusterSelectionService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import {
    ChannelCommands,
    type TeamClusterDaemonRegistryInstallResult
} from '@shared/infrastructure/contracts/team-cluster';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

const REGISTRY_INSTALL_PLATFORM = 'linux-x86_64';

@Singleton()
export class RegistryInstallPluginUseCase implements IUseCase<RegistryInstallPluginInputDTO, RegistryInstallPluginOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginStorageService) private readonly storageService: IPluginStorageService,
        @inject(PLUGIN_TOKENS.RegistryGateway) private readonly registryGateway: RegistryGateway,
        @inject(CONTAINER_TOKENS.TeamClusterSelectionService) private readonly clusterSelectionService: ITeamClusterSelectionService,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient) private readonly daemonClient: ITeamClusterDaemonClient,
        @inject(SHARED_TOKENS.EventBus) private readonly eventBus: IEventBus
    ) {}

    async execute(input: RegistryInstallPluginInputDTO): Promise<Result<RegistryInstallPluginOutputDTO>> {
        if (!input.name) {
            throw ApplicationError.badRequest('Registry::PackageNameRequired', 'A registry package name is required');
        }

        const computeClusterId = await this.clusterSelectionService.resolveComputeClusterId(input.teamId);
        const tarball = await this.registryGateway.resolveTarball(input.name, input.version, REGISTRY_INSTALL_PLATFORM);

        const installed = await this.daemonClient.command<TeamClusterDaemonRegistryInstallResult>(
            computeClusterId,
            ChannelCommands.PluginRegistryInstall,
            {
                downloadUrl: tarball.downloadUrl,
                sha256: tarball.sha256,
                fileName: tarball.fileName,
                name: input.name,
                version: tarball.version,
                platform: REGISTRY_INSTALL_PLATFORM
            },
            { timeoutClass: 'long-running-control-plane', retryClass: 'idempotent-command' }
        );

        const { plugin } = await this.storageService.createFromRegistry(
            installed.workflow,
            installed.binary,
            installed.ownerClusterId,
            input.teamId
        );

        await this.eventBus.publish(new PluginCreatedEvent({
            pluginId: plugin._id,
            teamId: input.teamId
        }));

        return Result.ok(mapPluginToPersistedDTO(plugin));
    }
}
