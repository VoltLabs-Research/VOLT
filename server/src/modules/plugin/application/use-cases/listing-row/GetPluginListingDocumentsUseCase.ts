import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { GetPluginListingDocumentsInputDTO, GetPluginListingDocumentsOutputDTO } from '@modules/plugin/application/dtos/listing-row/GetPluginListingDocumentsDTO';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { IPluginListingService } from '@modules/plugin/domain/ports/IPluginListingService';

@injectable()
export class GetPluginListingDocumentsUseCase implements IUseCase<GetPluginListingDocumentsInputDTO, GetPluginListingDocumentsOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginListingService) private listingService: IPluginListingService
    ) {}

    async execute(input: GetPluginListingDocumentsInputDTO): Promise<Result<GetPluginListingDocumentsOutputDTO>> {
        const result = await this.listingService.getListingDocuments(
            input.pluginId,
            {
                teamId: input.teamId,
                trajectoryId: input.trajectoryId,
                analysisId: input.analysisId,
                exposureId: input.exposureId,
                exposureName: input.exposureName,
                page: input.page ?? 1,
                limit: input.limit ?? 50,
                sortAsc: input.sortAsc ?? false
            }
        );

        return Result.ok(result);
    }
};
