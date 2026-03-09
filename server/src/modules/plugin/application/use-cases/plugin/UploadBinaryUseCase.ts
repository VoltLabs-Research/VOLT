import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { UploadBinaryInputDTO } from '@modules/plugin/application/dtos/plugin/UploadBinaryDTO';
import { IPluginStorageService } from '@modules/plugin/domain/port/plugin/IPluginStorageService';

import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import type { BinaryUploadResult } from '@modules/plugin/domain/port/plugin/IPluginStorageService';

@injectable()
export class UploadBinaryUseCase implements IUseCase<UploadBinaryInputDTO, BinaryUploadResult, ApplicationError> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginStorageService)
        private readonly storageService: IPluginStorageService
    ){}

    async execute(input: UploadBinaryInputDTO): Promise<Result<BinaryUploadResult, ApplicationError>> {
        const result = await this.storageService.uploadBinary(
            input.pluginId,
            input.teamId,
            input.file
        );

        return Result.ok(result);
    }
};
