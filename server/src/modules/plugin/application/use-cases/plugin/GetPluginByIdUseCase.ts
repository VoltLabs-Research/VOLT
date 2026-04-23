import { GetPluginByIdInputDTO, GetPluginByIdOutputDTO } from '@modules/plugin/application/dtos/plugin/GetPluginByIdDTO';
import { mapPluginToPersistedDTO } from '@modules/plugin/utilities/mappers/plugin/mapPluginToPersistedDTO';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { ErrorCodes } from '@core/constants/error-codes';
import PluginRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/plugin/PluginRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';

@Singleton()
export class GetPluginByIdUseCase implements IUseCase<GetPluginByIdInputDTO, GetPluginByIdOutputDTO, ApplicationError> {
    constructor(
        private pluginRepository: PluginRepository
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
