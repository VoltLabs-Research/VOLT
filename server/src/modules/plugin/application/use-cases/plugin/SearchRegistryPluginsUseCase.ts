import type RegistryGateway from '@modules/plugin/infrastructure/services/plugin/RegistryGateway';
import { inject } from 'tsyringe';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import {
    SearchRegistryPluginsInputDTO,
    SearchRegistryPluginsOutputDTO
} from '@modules/plugin/application/dtos/plugin/SearchRegistryPluginsDTO';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';

@Singleton()
export class SearchRegistryPluginsUseCase implements IUseCase<SearchRegistryPluginsInputDTO, SearchRegistryPluginsOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.RegistryGateway) private readonly registryGateway: RegistryGateway
    ) {}

    async execute(input: SearchRegistryPluginsInputDTO): Promise<Result<SearchRegistryPluginsOutputDTO>> {
        const result = await this.registryGateway.search(input.q ?? '', input.page ?? 1, input.limit ?? 20);
        return Result.ok(result);
    }
}
