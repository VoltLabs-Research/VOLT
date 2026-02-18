import { injectable, inject } from 'tsyringe';
import { PaginatedBaseController } from '@shared/infrastructure/http/PaginatedBaseController';
import { ListApiTrackerUseCase } from '@modules/api-tracker/application/use-cases/ListApiTrackerUseCase';

@injectable()
export class ListApiTrackerController extends PaginatedBaseController<ListApiTrackerUseCase> {
    constructor(
        @inject(ListApiTrackerUseCase) useCase: ListApiTrackerUseCase
    ){
        super(useCase);
    }
}
