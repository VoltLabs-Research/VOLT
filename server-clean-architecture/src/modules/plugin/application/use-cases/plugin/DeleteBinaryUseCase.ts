import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import { DeleteBinaryInputDTO } from '@modules/plugin/application/dtos/plugin/DeleteBinaryDTO';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

@injectable()
export class DeleteBinaryUseCase implements IUseCase<DeleteBinaryInputDTO, null, ApplicationError> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository,
    ){}

    async execute(input: DeleteBinaryInputDTO): Promise<Result<null, ApplicationError>> {
        const plugin = await this.pluginRepository.deleteById(input.pluginId);
        if (!plugin) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            ));
        }

        return Result.ok(null);
    }
}
