import { UploadBinaryInputDTO } from '@modules/plugin/application/dtos/plugin/UploadBinaryDTO';
import { Singleton } from '@shared/infrastructure/di/decorators';

import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';

import type { BinaryUploadTarget, IPluginStorageService } from '@modules/plugin/domain/port/plugin/IPluginStorageService';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { inject } from 'tsyringe';

@Singleton()
export class UploadBinaryUseCase implements IUseCase<UploadBinaryInputDTO, BinaryUploadTarget, ApplicationError> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginStorageService) private readonly storageService: IPluginStorageService
    ) {}

    async execute(input: UploadBinaryInputDTO): Promise<Result<BinaryUploadTarget, ApplicationError>> {
        const result = await this.storageService.createBinaryUploadTarget(
            input.pluginId,
            input.teamId,
            {
                userId: input.userId,
                fileName: input.fileName,
                size: input.size,
                contentType: input.type,
                sha256: input.sha256
            }
        );

        return Result.ok(result);
    }
}
