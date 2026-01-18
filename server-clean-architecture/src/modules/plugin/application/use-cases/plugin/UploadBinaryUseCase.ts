import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { UploadBinaryInputDTO, UploadBinaryOutputDTO } from '../../dtos/plugin/UploadBinaryDTO';
import { IPluginRepository } from '../../../domain/ports/IPluginRepository';
import { IPluginStorageService } from '../../../domain/ports/IPluginStorageService';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';

import { PLUGIN_TOKENS } from '../../../infrastructure/di/PluginTokens';

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
