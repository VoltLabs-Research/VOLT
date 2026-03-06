import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { CreatePluginInputDTO, CreatePluginOutputDTO } from '@modules/plugin/application/dtos/plugin/CreatePluginDTO';
import { IPluginRepository } from '@modules/plugin/domain/port/IPluginRepository';
import { PluginStatus } from '@modules/plugin/domain/entities/Plugin';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import PluginCreatedEvent from '@modules/plugin/domain/events/PluginCreatedEvent';

@injectable()
export class CreatePluginUseCase implements IUseCase<CreatePluginInputDTO, CreatePluginOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository,
        @inject(SHARED_TOKENS.EventBus) private readonly eventBus: IEventBus
    ){}

    async execute(input: CreatePluginInputDTO): Promise<Result<CreatePluginOutputDTO>> {
        const plugin = await this.pluginRepository.create({
            workflow: input.workflow,
            team: input.teamId,
            validated: false,
            status: PluginStatus.Draft
        });

        await this.eventBus.publish(new PluginCreatedEvent({
            pluginId: plugin.id,
            teamId: input.teamId
        }));

        return Result.ok({ plugin });
    }
}

