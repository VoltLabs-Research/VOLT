import { inject, injectable } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { UploadBinaryInputDTO } from '@modules/plugin/application/dtos/plugin/UploadBinaryDTO';
import { IPluginStorageService, BinaryUploadResult } from '@modules/plugin/domain/port/IPluginStorageService';
import { PLUGIN_TOKENS } from '@modules/plugin/application/di/PluginTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

@injectable()
export class UploadBinaryUseCase implements IUseCase<UploadBinaryInputDTO, BinaryUploadResult, ApplicationError> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginStorageService)
        private readonly storageService: IPluginStorageService
    ){}

    async execute(input: UploadBinaryInputDTO): Promise<Result<BinaryUploadResult, ApplicationError>> {
        const result = await this.storageService.uploadBinary(
            input.pluginId,
            input.file
        );

        return Result.ok(result);
    }
}
