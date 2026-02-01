import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type IPluginRepository from '../../domain/ports/IPluginRepository';
import type { UploadBinaryInputDTO, UploadBinaryOutputDTO } from '../dtos';
import { PLUGIN_TOKENS } from '../../infrastructure/di/tokens';

@injectable()
export default class UploadBinaryUseCase implements IUseCase<UploadBinaryInputDTO, UploadBinaryOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository
    ){}

    async execute(params: UploadBinaryInputDTO): Promise<UploadBinaryOutputDTO> {
        return this.pluginRepository.uploadBinary(params);
    }
};
