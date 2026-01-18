import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { DeletePluginByIdInputDTO } from '@modules/plugin/application/dtos/plugin/DeletePluginByIdDTO';
import { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import { IEventBus } from '@shared/application/events/IEventBus';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

@injectable()
export class DeletePluginByIdUseCase implements IUseCase<DeletePluginByIdInputDTO, null, ApplicationError> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository,
        @inject(SHARED_TOKENS.EventBus) private eventBus: IEventBus
    ){}

    async execute(input: DeletePluginByIdInputDTO): Promise<Result<null, ApplicationError>> {
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
