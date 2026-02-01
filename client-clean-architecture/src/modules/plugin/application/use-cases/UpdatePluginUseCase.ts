import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type IPluginRepository from '../../domain/ports/IPluginRepository';
import type { UpdatePluginInputDTO, UpdatePluginOutputDTO } from '../dtos';
import { PLUGIN_TOKENS } from '../../infrastructure/di/tokens';

@injectable()
export default class UpdatePluginUseCase implements IUseCase<UpdatePluginInputDTO, UpdatePluginOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository
    ){}

    async execute(params: UpdatePluginInputDTO): Promise<UpdatePluginOutputDTO> {
        return this.pluginRepository.update(params);
    }
};
