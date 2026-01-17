import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { ImportPluginInputDTO, ImportPluginOutputDTO } from '../../dtos/plugin/ImportPluginDTO';
import { IPluginRepository } from '../../../domain/ports/IPluginRepository';
import { IPluginStorageService } from '../../../domain/ports/IPluginStorageService';
import { PluginStatus } from '../../../domain/entities/Plugin';

@injectable()
export class ImportPluginUseCase implements IUseCase<ImportPluginInputDTO, ImportPluginOutputDTO> {
    constructor(
        @inject('IPluginRepository') private pluginRepository: IPluginRepository,
        @inject('IPluginStorageService') private storageService: IPluginStorageService
    ) { }

    async execute(input: ImportPluginInputDTO): Promise<Result<ImportPluginOutputDTO>> {
        const data = await this.storageService.importPlugin(
            input.file.buffer,
            input.teamId
        );

        return Result.ok(data.plugin);
    }
}
