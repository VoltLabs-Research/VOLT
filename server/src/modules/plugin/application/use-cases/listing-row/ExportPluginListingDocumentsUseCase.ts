import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import {
    ExportPluginListingDocumentsInputDTO,
    ExportPluginListingDocumentsOutputDTO
} from '@modules/plugin/application/dtos/listing-row/GetPluginListingDocumentsDTO';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { IPluginListingExportService } from '@modules/plugin/domain/port/IPluginListingExportService';

@injectable()
export class ExportPluginListingDocumentsUseCase implements IUseCase<ExportPluginListingDocumentsInputDTO, ExportPluginListingDocumentsOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginListingService) private listingService: IPluginListingExportService
    ) {}

    async execute(input: ExportPluginListingDocumentsInputDTO): Promise<Result<ExportPluginListingDocumentsOutputDTO>> {
        const result = await this.listingService.exportListingDocuments(
            input.pluginId,
            {
                teamId: input.teamId,
                trajectoryId: input.trajectoryId,
                analysisId: input.analysisId,
                exposureId: input.exposureId,
                exposureName: input.exposureName,
                sortAsc: input.sortAsc ?? false,
                format: input.format ?? 'json'
            }
        );

        return Result.ok(result);
    }
};
