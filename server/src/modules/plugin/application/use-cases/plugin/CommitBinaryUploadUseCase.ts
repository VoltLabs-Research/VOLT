import { CommitBinaryUploadInputDTO } from '@modules/plugin/application/dtos/plugin/UploadBinaryDTO';
import type { BinaryUploadResult, IPluginStorageService } from '@modules/plugin/domain/port/plugin/IPluginStorageService';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class CommitBinaryUploadUseCase implements IUseCase<CommitBinaryUploadInputDTO, BinaryUploadResult, ApplicationError> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginStorageService) private readonly storageService: IPluginStorageService
    ) {}

    async execute(input: CommitBinaryUploadInputDTO): Promise<Result<BinaryUploadResult, ApplicationError>> {
        const result = await this.storageService.commitBinaryUpload(
            input.pluginId,
            input.teamId,
            {
                objectPath: input.objectPath,
                fileName: input.fileName,
                size: input.size,
                sha256: input.sha256
            }
        );

        return Result.ok(result);
    }
}
