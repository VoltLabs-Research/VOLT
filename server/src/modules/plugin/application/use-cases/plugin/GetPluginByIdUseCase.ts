import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { GetPluginByIdInputDTO, GetPluginByIdOutputDTO } from '@modules/plugin/application/dtos/plugin/GetPluginByIdDTO';
import { mapPluginToPersistedDTO } from '@modules/plugin/utilities/mappers/plugin/mapPluginToPersistedDTO';
import { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';

import { ErrorCodes } from '@core/constants/error-codes';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

@injectable()
export class GetPluginByIdUseCase implements IUseCase<GetPluginByIdInputDTO, GetPluginByIdOutputDTO, ApplicationError> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository
    ){}

    async execute(input: GetPluginByIdInputDTO): Promise<Result<GetPluginByIdOutputDTO, ApplicationError>> {
        const plugin = await this.pluginRepository.findById(input.pluginId);
        if (!plugin) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            ));
        }

        return Result.ok(mapPluginToPersistedDTO(plugin));
    }
};
