import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { CreatePluginInputDTO, CreatePluginOutputDTO } from '@modules/plugin/application/dtos/plugin/CreatePluginDTO';
import { mapPluginToPersistedDTO } from '@modules/plugin/application/mappers/plugin/mapPluginToPersistedDTO';
import { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';
import { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import Workflow from '@modules/plugin/domain/entities/plugin/workflow/Workflow';
import PluginCreatedEvent from '@modules/plugin/domain/events/PluginCreatedEvent';
import WorkflowProjectionService from '@modules/plugin/domain/services/plugin/WorkflowProjectionService';

import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';

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
};
