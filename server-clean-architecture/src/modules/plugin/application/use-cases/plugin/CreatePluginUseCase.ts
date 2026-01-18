import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { CreatePluginInputDTO, CreatePluginOutputDTO } from '../../dtos/plugin/CreatePluginDTO';
import { IPluginRepository } from '../../../domain/ports/IPluginRepository';
import { PluginStatus } from '../../../domain/entities/Plugin';

import { PLUGIN_TOKENS } from '../../../infrastructure/di/PluginTokens';

@injectable()
export class CreatePluginUseCase implements IUseCase<CreatePluginInputDTO, CreatePluginOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository
    ) { }

    async execute(input: CreatePluginInputDTO): Promise<Result<CreatePluginOutputDTO>> {
        const plugin = await this.pluginRepository.create({
            workflow: input.workflow,
            team: input.teamId,
            slug: input.slug,
            validated: false,
            status: PluginStatus.Draft
        });

        return Result.ok({ plugin });
    }
}
