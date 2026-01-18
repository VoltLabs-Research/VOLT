import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { GetPluginListingDocumentsInputDTO, GetPluginListingDocumentsOutputDTO } from '@modules/plugin/application/dtos/listing-row/GetPluginListingDocumentsDTO';

export interface IPluginListingService {
    getListingDocuments(pluginSlug: string, listingSlug: string, options: any): Promise<any>;
}

import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

@injectable()
export class GetPluginListingDocumentsUseCase implements IUseCase<GetPluginListingDocumentsInputDTO, GetPluginListingDocumentsOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginListingService) private listingService: IPluginListingService
    ) { }

    async execute(input: GetPluginListingDocumentsInputDTO): Promise<Result<GetPluginListingDocumentsOutputDTO>> {
        const result = await this.listingService.getListingDocuments(
            input.pluginSlug,
            input.listingSlug,
            { page: input.page || 1, limit: input.limit || 50 }
        );

        return Result.ok(result);
    }
}
