import { injectable, inject } from 'tsyringe';
import { BaseStreamController } from '@shared/infrastructure/http/BaseStreamController';
import { GetFilteredModelStreamUseCase } from '@modules/trajectory/application/use-cases/particle-filter/GetFilteredModelStreamUseCase';

@injectable()
export default class GetFilteredModelController extends BaseStreamController<GetFilteredModelStreamUseCase> {
    constructor(
        @inject(GetFilteredModelStreamUseCase) useCase: GetFilteredModelStreamUseCase
    ) {
        super(useCase);
    }
}
