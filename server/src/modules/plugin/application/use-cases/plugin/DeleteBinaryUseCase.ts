import { DeleteBinaryInputDTO } from '@modules/plugin/application/dtos/plugin/DeleteBinaryDTO';
import type { IPluginStorageService } from '@modules/plugin/domain/port/plugin/IPluginStorageService';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';

import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject } from 'tsyringe';

@Singleton()
export class DeleteBinaryUseCase implements IUseCase<DeleteBinaryInputDTO, null, ApplicationError> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginStorageService) private readonly storageService: IPluginStorageService
    ) {}

    async execute(input: DeleteBinaryInputDTO): Promise<Result<null, ApplicationError>> {
        await this.storageService.deleteBinary(input.pluginId);
        return Result.ok(null);
    }
}
