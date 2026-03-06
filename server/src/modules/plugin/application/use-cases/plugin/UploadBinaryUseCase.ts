import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { UploadBinaryInputDTO } from '@modules/plugin/application/dtos/plugin/UploadBinaryDTO';
import { IPluginRepository } from '@modules/plugin/domain/port/IPluginRepository';
import { IPluginStorageService, BinaryUploadResult } from '@modules/plugin/domain/port/IPluginStorageService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

@injectable()
export class UploadBinaryUseCase implements IUseCase<UploadBinaryInputDTO, BinaryUploadResult, ApplicationError> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository,
        @inject(PLUGIN_TOKENS.PluginStorageService) private storageService: IPluginStorageService
    ){}

    async execute(input: UploadBinaryInputDTO): Promise<Result<BinaryUploadResult, ApplicationError>> {
        const result = await this.storageService.uploadBinary(
            input.pluginId,
            input.file
        );

        return Result.ok(result);
    }
}
