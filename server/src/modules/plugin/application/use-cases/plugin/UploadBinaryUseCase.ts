import { UploadBinaryInputDTO } from '@modules/plugin/application/dtos/plugin/UploadBinaryDTO';
import { Singleton } from '@shared/infrastructure/di/decorators';

import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';

import type { BinaryUploadResult } from '@modules/plugin/domain/port/plugin/IPluginStorageService';
import PluginStorageService from '@modules/plugin/infrastructure/services/plugin/PluginStorageService';

@Singleton()
export class UploadBinaryUseCase implements IUseCase<UploadBinaryInputDTO, BinaryUploadResult, ApplicationError> {
    constructor(
        
        private readonly storageService: PluginStorageService
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
