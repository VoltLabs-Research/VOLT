import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { GetPluginByIdInputDTO, GetPluginByIdOutputDTO } from '../../dtos/plugin/GetPluginByIdDTO';
import { IPluginRepository } from '../../../domain/ports/IPluginRepository';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@/src/core/constants/error-codes';

import { PLUGIN_TOKENS } from '../../../infrastructure/di/PluginTokens';

@injectable()
export class GetPluginByIdUseCase implements IUseCase<GetPluginByIdInputDTO, GetPluginByIdOutputDTO, ApplicationError> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository
    ) { }

    async execute(input: GetPluginByIdInputDTO): Promise<Result<GetPluginByIdOutputDTO, ApplicationError>> {
        const plugin = await this.pluginRepository.findById(input.pluginId);
        if (!plugin) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            ));
        }

        return Result.ok({
            ...plugin.props,
            workflow: plugin.props.workflow.props
        });
    }
}
