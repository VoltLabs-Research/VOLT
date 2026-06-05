import type PluginRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/plugin/PluginRepository';
import { inject } from 'tsyringe';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { ListPluginsInputDTO, ListPluginsOutputDTO } from '@modules/plugin/application/dtos/plugin/ListPluginsDTO';
import { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';
import { mapPluginToPersistedDTO } from '@modules/plugin/utilities/mappers/plugin/mapPluginToPersistedDTO';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';

@Singleton()
export class ListPluginsUseCase implements IUseCase<ListPluginsInputDTO, ListPluginsOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private readonly pluginRepository: PluginRepository
    ) {}

    async execute(input: ListPluginsInputDTO): Promise<Result<ListPluginsOutputDTO>> {
        const result = await this.pluginRepository.findAll({
            filter: {
                team: input.teamId,
                ...(input.status ? { status: input.status as PluginStatus } : {})
            },
            page: input.page,
            limit: input.limit
        });

        const data = result.data.map((plugin) => mapPluginToPersistedDTO(plugin));

        return Result.ok({
            ...result,
            data
        });
    }
}
