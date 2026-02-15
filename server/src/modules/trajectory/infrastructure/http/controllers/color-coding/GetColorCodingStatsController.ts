import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { GetColorCodingStatsUseCase } from '@modules/trajectory/application/use-cases/color-coding/GetColorCodingStatsUseCase';

@injectable()
export default class GetColorCodingStatsController extends BaseController<GetColorCodingStatsUseCase> {
    constructor(
        @inject(GetColorCodingStatsUseCase) useCase: GetColorCodingStatsUseCase
    ) {
        super(useCase);
    }
}
