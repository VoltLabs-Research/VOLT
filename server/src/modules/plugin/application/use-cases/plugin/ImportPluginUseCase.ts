import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { ImportPluginInputDTO, ImportPluginOutputDTO } from '@modules/plugin/application/dtos/plugin/ImportPluginDTO';
import { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import { IPluginStorageService } from '@modules/plugin/domain/ports/IPluginStorageService';
import { PluginStatus } from '@modules/plugin/domain/entities/Plugin';

import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

@injectable()
export class ImportPluginUseCase implements IUseCase<ImportPluginInputDTO, ImportPluginOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository,
        @inject(PLUGIN_TOKENS.PluginStorageService) private storageService: IPluginStorageService
    ){}

    async execute(input: ImportPluginInputDTO): Promise<Result<ImportPluginOutputDTO>> {
        const data = await this.storageService.importPlugin(
            input.file.buffer,
            input.teamId
        );

        return Result.ok(data.plugin);
    }
}
