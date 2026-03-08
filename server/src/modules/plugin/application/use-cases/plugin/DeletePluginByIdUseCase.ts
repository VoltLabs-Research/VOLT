import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { DeletePluginByIdInputDTO } from '@modules/plugin/application/dtos/plugin/DeletePluginByIdDTO';
import { IPluginRepository } from '@modules/plugin/domain/port/IPluginRepository';
import { IPluginBinaryCacheService } from '@modules/plugin/domain/port/IPluginBinaryCacheService';
import { IEventBus } from '@shared/application/events/IEventBus';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { SHARED_TOKENS } from '@shared/application/di/SharedTokens';
import { PLUGIN_TOKENS } from '@modules/plugin/application/di/PluginTokens';
import PluginDeletedEvent from '@modules/plugin/domain/events/PluginDeletedEvent';

@injectable()
export class DeletePluginByIdUseCase implements IUseCase<DeletePluginByIdInputDTO, null, ApplicationError> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository,
        @inject(PLUGIN_TOKENS.PluginBinaryCacheService) private binaryCacheService: IPluginBinaryCacheService,
        @inject(SHARED_TOKENS.EventBus) private eventBus: IEventBus
    ){}

    async execute(input: DeletePluginByIdInputDTO): Promise<Result<null, ApplicationError>> {
        const plugin = await this.pluginRepository.findById(input.pluginId);
        if (!plugin) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            ));
        }

        await this.binaryCacheService.evictByPluginId(input.pluginId);

        const deleted = await this.pluginRepository.deleteById(input.pluginId);
        if (!deleted) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            ));
        }

        await this.eventBus.publish(new PluginDeletedEvent({
            pluginId: plugin.id,
            teamId: plugin.props.team,
            workflow: plugin.props.workflow
        }));

        return Result.ok(null);
    }
}
