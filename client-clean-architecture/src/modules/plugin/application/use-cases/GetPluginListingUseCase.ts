import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type IPluginListingRepository from '../../domain/ports/IPluginListingRepository';
import type { GetPluginListingInputDTO, GetPluginListingOutputDTO } from '../dtos';
import { PLUGIN_TOKENS } from '../../infrastructure/di/tokens';

@injectable()
export default class GetPluginListingUseCase implements IUseCase<GetPluginListingInputDTO, GetPluginListingOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginListingRepository)
        private readonly pluginListingRepository: IPluginListingRepository
    ){}

    async execute(params: GetPluginListingInputDTO): Promise<GetPluginListingOutputDTO> {
        return this.pluginListingRepository.getListing(params);
    }
};
