import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { ExportPluginListingDocumentsUseCase } from '@modules/plugin/application/use-cases/listing-row/ExportPluginListingDocumentsUseCase';

@injectable()
export default class ExportPluginListingDocumentsController extends BaseController<ExportPluginListingDocumentsUseCase> {
    constructor(
        @inject(ExportPluginListingDocumentsUseCase) useCase: ExportPluginListingDocumentsUseCase
    ) {
        super(useCase);
    }
};
