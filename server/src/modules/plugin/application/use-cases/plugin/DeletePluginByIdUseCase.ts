import { DeletePluginByIdInputDTO } from '@modules/plugin/application/dtos/plugin/DeletePluginByIdDTO';
import PluginDeletedEvent from '@modules/plugin/domain/events/PluginDeletedEvent';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { ErrorCodes } from '@core/constants/error-codes';
import PluginRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/plugin/PluginRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject } from 'tsyringe';

@Singleton()
export class DeletePluginByIdUseCase implements IUseCase<DeletePluginByIdInputDTO, null, ApplicationError> {
    constructor(
        private pluginRepository: PluginRepository,
        @inject(SHARED_TOKENS.EventBus) private eventBus: IEventBus
    ) {}

    async execute(input: DeletePluginByIdInputDTO): Promise<Result<null, ApplicationError>> {
        const plugin = await this.pluginRepository.findById(input.pluginId);
        if (!plugin) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            ));
        }

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
