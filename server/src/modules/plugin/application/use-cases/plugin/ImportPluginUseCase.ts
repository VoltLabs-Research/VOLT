import { ImportPluginInputDTO, ImportPluginOutputDTO } from '@modules/plugin/application/dtos/plugin/ImportPluginDTO';
import PluginCreatedEvent from '@modules/plugin/domain/events/PluginCreatedEvent';
import { mapPluginToPersistedDTO } from '@modules/plugin/utilities/mappers/plugin/mapPluginToPersistedDTO';
import { Singleton } from '@shared/infrastructure/di/decorators';

import PluginStorageService from '@modules/plugin/infrastructure/services/plugin/PluginStorageService';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject } from 'tsyringe';

@Singleton()
export class ImportPluginUseCase implements IUseCase<ImportPluginInputDTO, ImportPluginOutputDTO> {
    constructor(
        private storageService: PluginStorageService,
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
};
