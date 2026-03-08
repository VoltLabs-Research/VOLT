import { inject, injectable } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { DeleteBinaryInputDTO } from '@modules/plugin/application/dtos/plugin/DeleteBinaryDTO';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IPluginStorageService } from '@modules/plugin/domain/port/IPluginStorageService';
import { PLUGIN_TOKENS } from '@modules/plugin/application/di/PluginTokens';

@injectable()
export class DeleteBinaryUseCase implements IUseCase<DeleteBinaryInputDTO, null, ApplicationError> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginStorageService)
        private readonly storageService: IPluginStorageService
    ){}

    async execute(input: DeleteBinaryInputDTO): Promise<Result<null, ApplicationError>> {
        await this.storageService.deleteBinary(input.pluginId);
        return Result.ok(null);
    }
}
