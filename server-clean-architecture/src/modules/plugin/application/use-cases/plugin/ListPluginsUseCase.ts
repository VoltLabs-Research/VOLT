import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { ListPluginsInputDTO, ListPluginsOutputDTO } from '../../dtos/plugin/ListPluginsDTO';
import { IPluginRepository } from '../../../domain/ports/IPluginRepository';

import { PLUGIN_TOKENS } from '../../../infrastructure/di/PluginTokens';

@injectable()
export class ListPluginsUseCase implements IUseCase<ListPluginsInputDTO, ListPluginsOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) private pluginRepository: IPluginRepository
    ) { }

    async execute(input: ListPluginsInputDTO): Promise<Result<ListPluginsOutputDTO>> {
        const result = await this.pluginRepository.findAll({
            filter: { team: input.teamId },
            page: 1,
            limit: 100
        });

        return Result.ok({
            ...result,
            data: result.data.map((data) => data.props)
        });
    }
}
