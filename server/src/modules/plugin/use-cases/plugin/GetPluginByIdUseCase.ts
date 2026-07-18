import type { IPluginRepository } from '@modules/plugin/ports/plugin/IPluginRepository';
import { inject } from 'tsyringe';
import { PLUGIN_TOKENS } from '@modules/plugin/di/PluginTokens';
import { GetPluginByIdInputDTO, GetPluginByIdOutputDTO } from '@modules/plugin/dtos/plugin/GetPluginByIdDTO';
import type { PersistedPluginDTO } from '@modules/plugin/dtos/plugin/PersistedPluginDTO';
import { mapPluginToPersistedDTO } from '@modules/plugin/utilities/mappers/plugin/mapPluginToPersistedDTO';
import { Singleton, AliasOf } from '@shared/infrastructure/di/decorators';
import { PLUGIN_USECASE_TOKENS } from '@shared/contracts/tokens/PluginUseCaseTokens';
import type { IGetPluginByIdUseCase } from '@shared/contracts/ports/IGetPluginByIdUseCase';

import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';

@Singleton()
@AliasOf(PLUGIN_USECASE_TOKENS.GetPluginByIdUseCase)
export class GetPluginByIdUseCase implements
    IUseCase<GetPluginByIdInputDTO, GetPluginByIdOutputDTO>,
    IGetPluginByIdUseCase {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private readonly pluginRepository: IPluginRepository
    ) {}

    async execute(input: GetPluginByIdInputDTO): Promise<PersistedPluginDTO> {
        const plugin = await this.pluginRepository.findById(input.pluginId);
        if (!plugin) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            );
        }

        return mapPluginToPersistedDTO(plugin);
    }
}
