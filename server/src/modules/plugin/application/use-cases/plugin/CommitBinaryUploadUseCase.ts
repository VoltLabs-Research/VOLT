import { CommitBinaryUploadInputDTO } from '@modules/plugin/application/dtos/plugin/UploadBinaryDTO';
import type { BinaryUploadResult, IPluginStorageService } from '@modules/plugin/domain/port/plugin/IPluginStorageService';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class CommitBinaryUploadUseCase implements IUseCase<CommitBinaryUploadInputDTO, BinaryUploadResult> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginStorageService) private readonly storageService: IPluginStorageService
    ) {}

    async execute(input: CommitBinaryUploadInputDTO): Promise<BinaryUploadResult> {
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

        return result;
    }
}
