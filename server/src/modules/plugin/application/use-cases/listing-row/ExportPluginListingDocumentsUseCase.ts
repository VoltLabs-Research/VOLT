import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import {
    ExportPluginListingDocumentsInputDTO,
    ExportPluginListingDocumentsOutputDTO
} from '@modules/plugin/application/dtos/listing-row/GetPluginListingDocumentsDTO';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { PluginListingExportResult } from '@modules/plugin/infrastructure/services/PluginListingService';

export interface IPluginListingExportService {
    exportListingDocuments(pluginSlug: string, options: any): Promise<PluginListingExportResult>;
};

@injectable()
export class ExportPluginListingDocumentsUseCase implements IUseCase<ExportPluginListingDocumentsInputDTO, ExportPluginListingDocumentsOutputDTO> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginListingService) private listingService: IPluginListingExportService
    ) {}

    async execute(input: ExportPluginListingDocumentsInputDTO): Promise<Result<ExportPluginListingDocumentsOutputDTO>> {
        const result = await this.listingService.exportListingDocuments(
            input.pluginSlug,
            {
                teamId: input.teamId,
                trajectoryId: input.trajectoryId,
                analysisId: input.analysisId,
                exposureId: input.exposureId,
                listingSlug: input.listingSlug,
                sortAsc: input.sortAsc ?? false
            }
        );

        return Result.ok(result);
    }
};
