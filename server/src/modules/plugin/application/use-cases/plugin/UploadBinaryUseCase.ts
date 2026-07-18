import { UploadBinaryInputDTO } from '@modules/plugin/application/dtos/plugin/UploadBinaryDTO';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { IUseCase } from '@shared/application/IUseCase';

import type { BinaryUploadTarget, IPluginStorageService } from '@modules/plugin/domain/port/plugin/IPluginStorageService';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { inject } from 'tsyringe';

@Singleton()
export class UploadBinaryUseCase implements IUseCase<UploadBinaryInputDTO, BinaryUploadTarget> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginStorageService) private readonly storageService: IPluginStorageService
    ) {}

    async execute(input: UploadBinaryInputDTO): Promise<BinaryUploadTarget> {
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

        return result;
    }
}
