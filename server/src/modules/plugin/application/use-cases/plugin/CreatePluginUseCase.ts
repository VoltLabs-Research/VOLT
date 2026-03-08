import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { CreatePluginInputDTO, CreatePluginOutputDTO } from '@modules/plugin/application/dtos/plugin/CreatePluginDTO';
import { IPluginRepository } from '@modules/plugin/domain/port/IPluginRepository';
import { PluginStatus } from '@modules/plugin/domain/entities/Plugin';
import { PLUGIN_TOKENS } from '@modules/plugin/application/di/PluginTokens';
import { SHARED_TOKENS } from '@shared/application/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import PluginCreatedEvent from '@modules/plugin/domain/events/PluginCreatedEvent';
import Workflow from '@modules/plugin/domain/entities/workflow/Workflow';
import { mapPluginToPersistedDTO } from '@modules/plugin/application/use-cases/plugin/mapPluginToPersistedDTO';
import WorkflowProjectionService from '@modules/plugin/domain/services/WorkflowProjectionService';

@injectable()
export class CreatePluginUseCase implements IUseCase<CreatePluginInputDTO, CreatePluginOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository,
        @inject(SHARED_TOKENS.EventBus) private readonly eventBus: IEventBus
    ){}

    async execute(input: CreatePluginInputDTO): Promise<Result<CreatePluginOutputDTO>> {
        const workflow = new Workflow('', input.workflow);
        const projection = WorkflowProjectionService.project(workflow, '');

        const plugin = await this.pluginRepository.create({
            workflow,
            team: input.teamId,
            validated: false,
            status: PluginStatus.Draft,
            modifier: projection.modifier,
            exposures: projection.exposures,
            arguments: projection.arguments,
            listingExposures: projection.listingExposures
        });

        await this.eventBus.publish(new PluginCreatedEvent({
            pluginId: plugin._id,
            teamId: input.teamId
        }));

        return Result.ok({
            plugin: mapPluginToPersistedDTO(plugin)
        });
    }
}
