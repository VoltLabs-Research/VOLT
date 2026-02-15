import { injectable, inject } from 'tsyringe';
import { BaseStreamController } from '@shared/infrastructure/http/BaseStreamController';
import { GetColoredModelStreamUseCase } from '@modules/trajectory/application/use-cases/color-coding/GetColoredModelStreamUseCase';

@injectable()
export default class GetColoredModelController extends BaseStreamController<GetColoredModelStreamUseCase> {
    constructor(
        @inject(GetColoredModelStreamUseCase) useCase: GetColoredModelStreamUseCase
    ) {
        super(useCase);
    }
}
