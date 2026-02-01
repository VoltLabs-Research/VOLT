import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type IPluginRepository from '../../domain/ports/IPluginRepository';
import type { ExecutePluginInputDTO, ExecutePluginOutputDTO } from '../dtos';
import { PLUGIN_TOKENS } from '../../infrastructure/di/tokens';

@injectable()
export default class ExecutePluginUseCase implements IUseCase<ExecutePluginInputDTO, ExecutePluginOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository
    ){}

    async execute(params: ExecutePluginInputDTO): Promise<ExecutePluginOutputDTO> {
        return this.pluginRepository.execute(params);
    }
};
