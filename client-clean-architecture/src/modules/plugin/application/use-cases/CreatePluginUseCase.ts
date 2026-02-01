import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type IPluginRepository from '../../domain/ports/IPluginRepository';
import type { CreatePluginInputDTO, CreatePluginOutputDTO } from '../dtos';
import { PLUGIN_TOKENS } from '../../infrastructure/di/tokens';

@injectable()
export default class CreatePluginUseCase implements IUseCase<CreatePluginInputDTO, CreatePluginOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository
    ){}

    async execute(params: CreatePluginInputDTO): Promise<CreatePluginOutputDTO> {
        return this.pluginRepository.create(params);
    }
};
