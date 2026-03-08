import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { ListPluginsInputDTO, ListPluginsOutputDTO } from '@modules/plugin/application/dtos/plugin/ListPluginsDTO';
import { mapPluginToPersistedDTO } from '@modules/plugin/utilities/mappers/plugin/mapPluginToPersistedDTO';
import { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';

import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';

@injectable()
export class ListPluginsUseCase implements IUseCase<ListPluginsInputDTO, ListPluginsOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository
    ){}

    async execute(input: ListPluginsInputDTO): Promise<Result<ListPluginsOutputDTO>> {
        const result = await this.pluginRepository.findAll({
            filter: { team: input.teamId },
            page: input.page,
            limit: input.limit
        });

        const data = result.data.map((plugin) => mapPluginToPersistedDTO(plugin));

        return Result.ok({
            ...result,
            data
        });
    }
};
