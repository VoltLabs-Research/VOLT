import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type IPluginRepository from '../../domain/ports/IPluginRepository';
import type { ImportPluginInputDTO, ImportPluginOutputDTO } from '../dtos';
import { PLUGIN_TOKENS } from '../../infrastructure/di/tokens';

@injectable()
export default class ImportPluginUseCase implements IUseCase<ImportPluginInputDTO, ImportPluginOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository
    ){}

    async execute(params: ImportPluginInputDTO): Promise<ImportPluginOutputDTO> {
        return this.pluginRepository.importPlugin(params.file);
    }
};
