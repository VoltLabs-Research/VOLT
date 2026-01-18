import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { UploadBinaryInputDTO, UploadBinaryOutputDTO } from '@modules/plugin/application/dtos/plugin/UploadBinaryDTO';
import { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import { IPluginStorageService } from '@modules/plugin/domain/ports/IPluginStorageService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

@injectable()
export class UploadBinaryUseCase implements IUseCase<UploadBinaryInputDTO, null, ApplicationError> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository,
        @inject(PLUGIN_TOKENS.PluginStorageService) private storageService: IPluginStorageService
    ) { }

    async execute(input: UploadBinaryInputDTO): Promise<Result<null, ApplicationError>> {
        await this.storageService.uploadBinary(
            input.pluginId,
            input.file
        );

        return Result.ok(null);
    }
}
