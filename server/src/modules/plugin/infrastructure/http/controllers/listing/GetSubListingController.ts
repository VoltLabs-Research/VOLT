import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { GetSubListingUseCase } from '@modules/plugin/application/use-cases/listing-row/GetSubListingUseCase';

@injectable()
export default class GetSubListingController extends BaseController<GetSubListingUseCase> {
    constructor(
        @inject(GetSubListingUseCase) useCase: GetSubListingUseCase
    ) {
        super(useCase);
    }
}
