import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { GetPluginListingDocumentsInputDTO, GetPluginListingDocumentsOutputDTO } from '@modules/plugin/application/dtos/listing-row/GetPluginListingDocumentsDTO';
import { PluginListingPaginatedResult } from '@modules/plugin/infrastructure/services/PluginListingService';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

export interface IPluginListingService {
    getListingDocuments(pluginSlug: string, listingSlug: string, options: any): Promise<PluginListingPaginatedResult>;
};

@injectable()
export class GetPluginListingDocumentsUseCase implements IUseCase<GetPluginListingDocumentsInputDTO, GetPluginListingDocumentsOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginListingService) private listingService: IPluginListingService
    ) {}

    async execute(input: GetPluginListingDocumentsInputDTO): Promise<Result<GetPluginListingDocumentsOutputDTO>> {
        const result = await this.listingService.getListingDocuments(
            input.pluginSlug,
            input.listingSlug,
            {
                teamId: input.teamId,
                trajectoryId: input.trajectoryId,
                analysisId: input.analysisId,
                page: input.page ?? 1,
                limit: input.limit ?? 50,
                sortAsc: input.sortAsc ?? false
            }
        );

        return Result.ok(result);
    }
};
