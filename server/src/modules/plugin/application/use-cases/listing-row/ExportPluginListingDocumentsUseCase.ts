import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import {
    ExportPluginListingDocumentsInputDTO,
    ExportPluginListingDocumentsOutputDTO
} from '@modules/plugin/application/dtos/listing-row/GetPluginListingDocumentsDTO';
import { createSerializedDownloadResponse } from '@shared/infrastructure/http/responses/download-response';
import { toPluginListingOptions } from '@modules/plugin/utilities/listing-row/toPluginListingOptions';
import { IPluginListingExportService } from '@modules/plugin/domain/port/listing-row/IPluginListingExportService';

import { IUseCase } from '@shared/application/IUseCase';
import { ExportType } from '@shared/domain/port/IBaseRepository';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

import type { DownloadStreamOutputDTO } from '@modules/plugin/domain/contracts/plugin/DownloadStream';

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
                format: input.format ?? ExportType.Json
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
};
