import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type IPluginRepository from '../../domain/ports/IPluginRepository';
import type { GetPluginInputDTO, GetPluginOutputDTO } from '../dtos';
import { PLUGIN_TOKENS } from '../../infrastructure/di/tokens';

@injectable()
export default class GetPluginUseCase implements IUseCase<GetPluginInputDTO, GetPluginOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository
    ){}

    async execute(params: GetPluginInputDTO): Promise<GetPluginOutputDTO> {
        return this.pluginRepository.getById(params);
    }
};
