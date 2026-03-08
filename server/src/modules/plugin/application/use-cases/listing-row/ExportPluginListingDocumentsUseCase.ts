import { inject, injectable } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import {
    ExportPluginListingDocumentsInputDTO,
    ExportPluginListingDocumentsOutputDTO
} from '@modules/plugin/application/dtos/listing-row/GetPluginListingDocumentsDTO';
import { PLUGIN_TOKENS } from '@modules/plugin/application/di/PluginTokens';
import { IPluginListingExportService } from '@modules/plugin/domain/port/IPluginListingExportService';
import { toPluginListingOptions } from '@modules/plugin/application/use-cases/listing-row/toPluginListingOptions';
import type { DownloadStreamOutputDTO } from '@modules/plugin/application/dtos/shared/DownloadStreamOutputDTO';
import { createSerializedDownloadResponse } from '@modules/plugin/application/helpers/create-download-response';

@injectable()
export class ExportPluginListingDocumentsUseCase implements IUseCase<
    ExportPluginListingDocumentsInputDTO,
    DownloadStreamOutputDTO
> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginListingService)
        private readonly listingService: IPluginListingExportService
    ){}

    async execute(input: ExportPluginListingDocumentsInputDTO): Promise<Result<DownloadStreamOutputDTO>> {
        const payload: ExportPluginListingDocumentsOutputDTO = await this.listingService.exportListingDocuments(
            input.pluginId,
            {
                ...toPluginListingOptions(input),
                format: input.format ?? 'json'
            }
        );

        const orderedColumns = [
            '_id',
            'timestep',
            'analysisId',
            'trajectoryId',
            'exposureId',
            'trajectoryName',
            ...payload.meta.columns.map((column) => column.label)
        ];

        const columns = Array.from(new Set(orderedColumns));

        return Result.ok(createSerializedDownloadResponse({
            filename: `${payload.meta.pluginId}_${payload.meta.exposureId}_listing`,
            format: payload.meta.format,
            rows: payload.data,
            columns
        }));
    }
}
