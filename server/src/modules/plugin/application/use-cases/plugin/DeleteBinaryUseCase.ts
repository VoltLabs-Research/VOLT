import { DeleteBinaryInputDTO } from '@modules/plugin/application/dtos/plugin/DeleteBinaryDTO';
import type { IPluginStorageService } from '@modules/plugin/domain/port/plugin/IPluginStorageService';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { IUseCase } from '@shared/application/IUseCase';
import { inject } from 'tsyringe';

@Singleton()
export class DeleteBinaryUseCase implements IUseCase<DeleteBinaryInputDTO, null> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginStorageService) private readonly storageService: IPluginStorageService
    ) {}

    async execute(input: DeleteBinaryInputDTO): Promise<null> {
        await this.storageService.deleteBinary(input.pluginId);
        return null;
    }
}
