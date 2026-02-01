import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type IPluginRepository from '../../domain/ports/IPluginRepository';
import type { GetPluginsInputDTO, GetPluginsOutputDTO } from '../dtos';
import { PLUGIN_TOKENS } from '../../infrastructure/di/tokens';

@injectable()
export default class GetPluginsUseCase implements IUseCase<GetPluginsInputDTO, GetPluginsOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository
    ){}

    async execute(params: GetPluginsInputDTO): Promise<GetPluginsOutputDTO> {
        return this.pluginRepository.getAll(params);
    }
};
