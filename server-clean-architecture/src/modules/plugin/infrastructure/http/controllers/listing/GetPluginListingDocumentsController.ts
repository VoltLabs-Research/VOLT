import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { GetPluginListingDocumentsUseCase } from '../../../../application/use-cases/listing-row/GetPluginListingDocumentsUseCase';

@injectable()
export default class GetPluginListingDocumentsController extends BaseController<GetPluginListingDocumentsUseCase> {
    constructor(
        @inject(GetPluginListingDocumentsUseCase) useCase: GetPluginListingDocumentsUseCase
    ) {
        super(useCase);
    }
}
