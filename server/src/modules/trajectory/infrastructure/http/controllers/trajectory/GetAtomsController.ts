import { injectable, inject } from 'tsyringe';
import { PaginatedBaseController } from '@shared/infrastructure/http/PaginatedBaseController';
import { GetAtomsUseCase } from '@modules/trajectory/application/use-cases/trajectory/GetAtomsUseCase';

@injectable()
export default class GetAtomsController extends PaginatedBaseController<GetAtomsUseCase> {
    constructor(
        @inject(GetAtomsUseCase)
        useCase: GetAtomsUseCase
    ) {
        super(useCase);
    }
}
