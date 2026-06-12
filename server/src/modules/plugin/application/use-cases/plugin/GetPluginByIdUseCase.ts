import type { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import { inject } from 'tsyringe';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { GetPluginByIdInputDTO, GetPluginByIdOutputDTO } from '@modules/plugin/application/dtos/plugin/GetPluginByIdDTO';
import type { PersistedPluginDTO } from '@modules/plugin/application/dtos/plugin/PersistedPluginDTO';
import { mapPluginToPersistedDTO } from '@modules/plugin/utilities/mappers/plugin/mapPluginToPersistedDTO';
import { Singleton, AliasOf } from '@shared/infrastructure/di/decorators';
import { PLUGIN_USECASE_TOKENS } from '@shared/contracts/tokens/PluginUseCaseTokens';
import type { IGetPluginByIdUseCase } from '@shared/contracts/ports/IGetPluginByIdUseCase';

import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';

// `@AliasOf(PLUGIN_USECASE_TOKENS.GetPluginByIdUseCase)` additively exposes the
// neutral `Symbol.for('GetPluginByIdUseCase')` token (delegating to the same
// singleton) so the trajectory module can inject the `IGetPluginByIdUseCase`
// port without importing `@modules/plugin`. By-class resolution is unchanged.
@Singleton()
@AliasOf(PLUGIN_USECASE_TOKENS.GetPluginByIdUseCase)
export class GetPluginByIdUseCase implements
    IUseCase<GetPluginByIdInputDTO, GetPluginByIdOutputDTO, ApplicationError>,
    IGetPluginByIdUseCase {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private readonly pluginRepository: IPluginRepository
    ) {}

    // Returns the RICH owner-concrete `PersistedPluginDTO` (a structural subtype
    // of the neutral `GetPluginByIdOutputDTO`). By-class callers inside the plugin
    // module (e.g. ComparePluginsAITool) keep reading the full shape; the neutral
    // port/`IUseCase` are satisfied covariantly.
    async execute(input: GetPluginByIdInputDTO): Promise<Result<PersistedPluginDTO, ApplicationError>> {
        const plugin = await this.pluginRepository.findById(input.pluginId);
        if (!plugin) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            ));
        }

        return Result.ok(mapPluginToPersistedDTO(plugin));
    }
}
