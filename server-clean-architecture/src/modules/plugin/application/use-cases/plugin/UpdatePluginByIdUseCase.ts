import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { UpdatePluginByIdInputDTO, UpdatePluginByIdOutputDTO } from '@modules/plugin/application/dtos/plugin/UpdatePluginByIdDTO';
import { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import { PluginStatus } from '@modules/plugin/domain/entities/Plugin';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';

import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

@injectable()
export class UpdatePluginByIdUseCase implements IUseCase<UpdatePluginByIdInputDTO, UpdatePluginByIdOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository
    ) { }

    async execute(input: UpdatePluginByIdInputDTO): Promise<Result<UpdatePluginByIdOutputDTO>> {
        const plugin = await this.pluginRepository.updateById(input.pluginId, {
            workflow: input.workflow,
            status: input.status as PluginStatus
        });

        if (!plugin) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            ));
        }

        return Result.ok(plugin.props);
    }
}
