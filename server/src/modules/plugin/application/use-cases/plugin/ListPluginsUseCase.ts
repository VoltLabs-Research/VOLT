import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { ListPluginsInputDTO, ListPluginsOutputDTO } from '@modules/plugin/application/dtos/plugin/ListPluginsDTO';
import { IPluginRepository } from '@modules/plugin/domain/port/IPluginRepository';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

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

        const data = result.data.map((plugin) => ({
            ...plugin.props,
            _id: plugin.id
        }));

        return Result.ok({
            ...result,
            data
        });
    }
}
