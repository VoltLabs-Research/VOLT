import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { CreatePluginInputDTO, CreatePluginOutputDTO } from '@modules/plugin/application/dtos/plugin/CreatePluginDTO';
import { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import { PluginStatus } from '@modules/plugin/domain/entities/Plugin';
import WorkflowProjectionService from '@modules/plugin/domain/services/WorkflowProjectionService';
import Workflow from '@modules/plugin/domain/entities/workflow/Workflow';

import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

@injectable()
export class CreatePluginUseCase implements IUseCase<CreatePluginInputDTO, CreatePluginOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository
    ){}

    async execute(input: CreatePluginInputDTO): Promise<Result<CreatePluginOutputDTO>> {
        const workflow = new Workflow('', input.workflow as any);
        const projection = WorkflowProjectionService.project(workflow, input.slug ?? '');

        const plugin = await this.pluginRepository.create({
            workflow: input.workflow,
            team: input.teamId,
            slug: input.slug,
            validated: false,
            status: PluginStatus.Draft,
            ...projection
        });

        return Result.ok({ plugin });
    }
}
