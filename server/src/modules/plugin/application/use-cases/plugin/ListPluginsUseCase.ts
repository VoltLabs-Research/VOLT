import type { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';
import { inject } from 'tsyringe';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { ListPluginsInputDTO, ListPluginsOutputDTO } from '@modules/plugin/application/dtos/plugin/ListPluginsDTO';
import { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';
import { mapPluginToPersistedDTO } from '@modules/plugin/utilities/mappers/plugin/mapPluginToPersistedDTO';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { IUseCase } from '@shared/application/IUseCase';

@Singleton()
export class ListPluginsUseCase implements IUseCase<ListPluginsInputDTO, ListPluginsOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private readonly pluginRepository: IPluginRepository
    ) {}

    async execute(input: ListPluginsInputDTO): Promise<ListPluginsOutputDTO> {
        const result = await this.pluginRepository.findAll({
            filter: {
                team: input.teamId,
                ...(input.status ? { status: input.status as PluginStatus } : {})
            },
            page: input.page,
            limit: input.limit
        });

        const data = result.data.map((plugin) => mapPluginToPersistedDTO(plugin));

        return {
            ...result,
            data
        };
    }
}
