import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { UploadBinaryInputDTO, UploadBinaryOutputDTO } from '../../dtos/plugin/UploadBinaryDTO';
import { IPluginRepository } from '../../../domain/ports/IPluginRepository';
import { IPluginStorageService } from '../../../domain/ports/IPluginStorageService';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';

@injectable()
export class UploadBinaryUseCase implements IUseCase<UploadBinaryInputDTO, null, ApplicationError> {
    constructor(
        @inject('IPluginRepository') private pluginRepository: IPluginRepository,
        @inject('IPluginStorageService') private storageService: IPluginStorageService
    ) { }

    async execute(input: UploadBinaryInputDTO): Promise<Result<null, ApplicationError>> {
        await this.storageService.uploadBinary(
            input.pluginId,
            input.file
        );

        return Result.ok(null);
    }
}
