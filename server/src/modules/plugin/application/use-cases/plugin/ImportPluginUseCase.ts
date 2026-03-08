import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { ImportPluginInputDTO, ImportPluginOutputDTO } from '@modules/plugin/application/dtos/plugin/ImportPluginDTO';
import { IPluginStorageService } from '@modules/plugin/domain/port/IPluginStorageService';
import { PLUGIN_TOKENS } from '@modules/plugin/application/di/PluginTokens';
import { SHARED_TOKENS } from '@shared/application/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import PluginCreatedEvent from '@modules/plugin/domain/events/PluginCreatedEvent';
import { mapPluginToPersistedDTO } from '@modules/plugin/application/use-cases/plugin/mapPluginToPersistedDTO';

@injectable()
export class ImportPluginUseCase implements IUseCase<ImportPluginInputDTO, ImportPluginOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginStorageService) private storageService: IPluginStorageService,
        @inject(SHARED_TOKENS.EventBus) private readonly eventBus: IEventBus
    ){}

    async execute(input: ImportPluginInputDTO): Promise<Result<ImportPluginOutputDTO>> {
        const data = await this.storageService.importPlugin(
            input.file.buffer,
            input.teamId
        );

        await this.eventBus.publish(new PluginCreatedEvent({
            pluginId: data.plugin._id,
            teamId: input.teamId
        }));

        return Result.ok(mapPluginToPersistedDTO(data.plugin));
    }
}
