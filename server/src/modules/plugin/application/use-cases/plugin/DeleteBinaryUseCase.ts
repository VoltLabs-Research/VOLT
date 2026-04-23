import { DeleteBinaryInputDTO } from '@modules/plugin/application/dtos/plugin/DeleteBinaryDTO';
import { Singleton } from '@shared/infrastructure/di/decorators';

import PluginStorageService from '@modules/plugin/infrastructure/services/plugin/PluginStorageService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';

@Singleton()
export class DeleteBinaryUseCase implements IUseCase<DeleteBinaryInputDTO, null, ApplicationError> {
    constructor(
        
        private readonly storageService: PluginStorageService
    ){}

    async execute(input: DeleteBinaryInputDTO): Promise<Result<null, ApplicationError>> {
        await this.storageService.deleteBinary(input.pluginId);
        return Result.ok(null);
    }
};
