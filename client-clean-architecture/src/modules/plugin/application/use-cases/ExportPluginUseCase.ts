import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type IPluginRepository from '../../domain/ports/IPluginRepository';
import type { ExportPluginInputDTO, ExportPluginOutputDTO } from '../dtos';
import { PLUGIN_TOKENS } from '../../infrastructure/di/tokens';

@injectable()
export default class ExportPluginUseCase implements IUseCase<ExportPluginInputDTO, ExportPluginOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository
    ){}

    async execute(params: ExportPluginInputDTO): Promise<ExportPluginOutputDTO> {
        return this.pluginRepository.exportPlugin(params.id);
    }
};
