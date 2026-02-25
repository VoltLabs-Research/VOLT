import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { GetListingRowsByAnalysisIdUseCase } from '@modules/plugin/application/use-cases/listing-row/GetListingRowsByAnalysisIdUseCase';

@injectable()
export default class GetListingRowsByAnalysisIdController extends BaseController<GetListingRowsByAnalysisIdUseCase> {
    constructor(
        @inject(GetListingRowsByAnalysisIdUseCase) useCase: GetListingRowsByAnalysisIdUseCase
    ) {
        super(useCase);
    }
};
