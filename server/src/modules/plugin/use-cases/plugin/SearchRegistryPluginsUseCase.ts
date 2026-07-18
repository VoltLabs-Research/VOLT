import type { IRegistryGateway } from '@modules/plugin/ports/plugin/IRegistryGateway';
import { inject } from 'tsyringe';
import { PLUGIN_TOKENS } from '@modules/plugin/di/PluginTokens';
import {
    SearchRegistryPluginsInputDTO,
    SearchRegistryPluginsOutputDTO
} from '@modules/plugin/dtos/plugin/SearchRegistryPluginsDTO';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { IUseCase } from '@shared/application/IUseCase';

@Singleton()
export class SearchRegistryPluginsUseCase implements IUseCase<SearchRegistryPluginsInputDTO, SearchRegistryPluginsOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.RegistryGateway) private readonly registryGateway: IRegistryGateway
    ) {}

    async execute(input: SearchRegistryPluginsInputDTO): Promise<SearchRegistryPluginsOutputDTO> {
        const result = await this.registryGateway.search(input.q ?? '', input.page ?? 1, input.limit ?? 20);
        return result;
    }
}
