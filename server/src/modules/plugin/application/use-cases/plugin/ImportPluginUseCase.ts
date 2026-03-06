import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { ImportPluginInputDTO, ImportPluginOutputDTO } from '@modules/plugin/application/dtos/plugin/ImportPluginDTO';
import { IPluginRepository } from '@modules/plugin/domain/port/IPluginRepository';
import { IPluginStorageService } from '@modules/plugin/domain/port/IPluginStorageService';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import PluginCreatedEvent from '@modules/plugin/domain/events/PluginCreatedEvent';

@injectable()
export class ImportPluginUseCase implements IUseCase<ImportPluginInputDTO, ImportPluginOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository,
        @inject(PLUGIN_TOKENS.PluginStorageService) private storageService: IPluginStorageService,
        @inject(SHARED_TOKENS.EventBus) private readonly eventBus: IEventBus
    ){}

    async execute(input: ImportPluginInputDTO): Promise<Result<ImportPluginOutputDTO>> {
        const data = await this.storageService.importPlugin(
            input.file.buffer,
            input.teamId
        );

        await this.eventBus.publish(new PluginCreatedEvent({
            pluginId: (data.plugin as any)._id ?? (data.plugin as any).id ?? '',
            teamId: input.teamId
        }));

        return Result.ok(data.plugin);
    }
}
