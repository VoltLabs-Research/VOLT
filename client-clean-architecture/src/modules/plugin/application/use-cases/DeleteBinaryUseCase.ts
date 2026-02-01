import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type IPluginRepository from '../../domain/ports/IPluginRepository';
import type { DeleteBinaryInputDTO } from '../dtos';
import { PLUGIN_TOKENS } from '../../infrastructure/di/tokens';

@injectable()
export default class DeleteBinaryUseCase implements IUseCase<DeleteBinaryInputDTO, void> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository
    ){}

    async execute(params: DeleteBinaryInputDTO): Promise<void> {
        return this.pluginRepository.deleteBinary(params.pluginId);
    }
};
