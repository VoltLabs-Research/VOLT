import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type IPluginRepository from '../../domain/ports/IPluginRepository';
import type { ClonePluginInputDTO, ClonePluginOutputDTO } from '../dtos';
import { PLUGIN_TOKENS } from '../../infrastructure/di/tokens';

@injectable()
export default class ClonePluginUseCase implements IUseCase<ClonePluginInputDTO, ClonePluginOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository
    ){}

    async execute({ pluginId, teamId }: ClonePluginInputDTO): Promise<ClonePluginOutputDTO> {
        return this.pluginRepository.clone(pluginId, teamId!);
    }
};
