import { injectable, inject } from 'tsyringe';
import { Response } from 'express';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import BaseResponse from '@shared/infrastructure/http/BaseResponse';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import sendExportFile from '@shared/infrastructure/http/ExportFileResponse';
import { ExportPluginListingDocumentsUseCase } from '@modules/plugin/application/use-cases/listing-row/ExportPluginListingDocumentsUseCase';

@injectable()
export default class ExportPluginListingDocumentsController extends BaseController<ExportPluginListingDocumentsUseCase> {
    constructor(
        @inject(ExportPluginListingDocumentsUseCase) useCase: ExportPluginListingDocumentsUseCase
    ) {
        super(useCase);
    }

    public handle = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const dto = this.getParams(req);
            const result = await this.useCase.execute(dto);

            if (!result.success) {
                return BaseResponse.error(
                    res,
                    result.error.message,
                    result.error.statusCode,
                    result.error.code
                );
            }

            const payload = result.value;
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

            return sendExportFile({
                res,
                filename: `${payload.meta.pluginSlug}_${payload.meta.exposureId}_listing`,
                format: payload.meta.format,
                rows: payload.data,
                columns
            });
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
