import { injectable, inject } from 'tsyringe';
import { Response } from 'express';
import archiver from 'archiver';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import BaseResponse from '@shared/infrastructure/http/BaseResponse';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import sendExportFile, { toCsvContent } from '@shared/infrastructure/http/ExportFileResponse';
import { ExportListingRowsByAnalysisIdUseCase } from '@modules/plugin/application/use-cases/listing-row/ExportListingRowsByAnalysisIdUseCase';

const sanitizeFilePart = (value: string): string => {
    const cleaned = String(value || '')
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return cleaned || 'listing';
};

@injectable()
export default class ExportListingRowsByAnalysisIdController extends BaseController<ExportListingRowsByAnalysisIdUseCase> {
    constructor(
        @inject(ExportListingRowsByAnalysisIdUseCase) useCase: ExportListingRowsByAnalysisIdUseCase
    ) {
        super(useCase);
    }

    public handle = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const dto = this.getParams(req);
            const result = await this.useCase.execute(dto);

            if (!result.success) {
                const error = result.error as any;
                return BaseResponse.error(
                    res,
                    error.message,
                    error.statusCode,
                    error.code
                );
            }

            const payload = result.value;

            if (payload.listings.length <= 1) {
                const listing = payload.listings[0] || {
                    listingName: 'listing',
                    rows: [],
                    columns: ['_id', 'pluginId', 'analysisId', 'trajectoryId', 'trajectoryName', 'timestep']
                };

                return sendExportFile({
                    res,
                    filename: `${payload.analysisId}_${sanitizeFilePart(listing.listingName)}_listing`,
                    format: 'csv',
                    rows: listing.rows,
                    columns: listing.columns
                });
            }

            const bundleName = `${payload.analysisId}_analysis_listings.zip`;
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${bundleName}"`);

            const archive = archiver('zip', { zlib: { level: 5 } });
            archive.pipe(res);

            for (const listing of payload.listings) {
                const csvName = `${payload.analysisId}_${sanitizeFilePart(listing.listingName)}_listing.csv`;
                const csvContent = toCsvContent(listing.rows, listing.columns);
                archive.append(csvContent, { name: csvName });
            }

            await archive.finalize();
        } catch (error) {
            console.error(error);
            return BaseResponse.error(
                res,
                'Internal Server Error',
                HttpStatus.InternalServerError,
                'Internal::Server::Error'
            );
        }
    };
};
