import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import ListSampleSimulationsUseCase from '@modules/trajectory/application/use-cases/trajectory/ListSampleSimulationsUseCase';

@injectable()
export default class ListSampleSimulationsController extends BaseController<ListSampleSimulationsUseCase> {
    constructor(
        @inject(ListSampleSimulationsUseCase)
        useCase: ListSampleSimulationsUseCase
    ) {
        super(useCase);
    }
}
