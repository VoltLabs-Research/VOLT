import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { GetPluginListingDocumentsUseCase } from '@modules/plugin/application/use-cases/listing-row/GetPluginListingDocumentsUseCase';

@injectable()
export default class GetPluginListingDocumentsController extends BaseController<GetPluginListingDocumentsUseCase> {
    constructor(
        @inject(GetPluginListingDocumentsUseCase) useCase: GetPluginListingDocumentsUseCase
    ) {
        super(useCase);
    }
};
