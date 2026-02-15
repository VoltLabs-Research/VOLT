import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { GetColorCodingPropertiesUseCase } from '@modules/trajectory/application/use-cases/color-coding/GetColorCodingPropertiesUseCase';

@injectable()
export default class GetColorCodingPropertiesController extends BaseController<GetColorCodingPropertiesUseCase> {
    constructor(
        @inject(GetColorCodingPropertiesUseCase) useCase: GetColorCodingPropertiesUseCase
    ) {
        super(useCase);
    }
}
