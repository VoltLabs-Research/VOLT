import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { CreateColoredModelUseCase } from '@modules/trajectory/application/use-cases/color-coding/CreateColoredModelUseCase';

@injectable()
export default class CreateColoredModelController extends BaseController<CreateColoredModelUseCase> {
    constructor(
        @inject(CreateColoredModelUseCase) useCase: CreateColoredModelUseCase
    ) {
        super(useCase);
    }
}
