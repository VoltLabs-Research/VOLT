import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { DeletePluginByIdInputDTO } from '@modules/plugin/application/dtos/plugin/DeletePluginByIdDTO';
import { IPluginRepository } from '@modules/plugin/domain/port/IPluginRepository';
import { IPluginBinaryCacheService } from '@modules/plugin/domain/port/IPluginBinaryCacheService';
import { IEventBus } from '@shared/application/events/IEventBus';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

@injectable()
export class DeletePluginByIdUseCase implements IUseCase<DeletePluginByIdInputDTO, null, ApplicationError> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository,
        @inject(PLUGIN_TOKENS.PluginBinaryCacheService) private binaryCacheService: IPluginBinaryCacheService,
        @inject(SHARED_TOKENS.EventBus) private eventBus: IEventBus
    ){}

    async execute(input: DeletePluginByIdInputDTO): Promise<Result<null, ApplicationError>> {
        await this.binaryCacheService.evictByPluginId(input.pluginId);

        const plugin = await this.pluginRepository.deleteById(input.pluginId);
        if (!plugin) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            ));
        }

        return Result.ok(null);
    }
}
