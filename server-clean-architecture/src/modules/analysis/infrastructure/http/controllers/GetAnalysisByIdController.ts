import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import GetAnalysisByIdUseCase from '@modules/analysis/application/use-cases/GetAnalysisByIdUseCase';

@injectable()
export default class GetAnalysisByIdController extends BaseController<GetAnalysisByIdUseCase> {
    constructor(
        @inject(GetAnalysisByIdUseCase) useCase: GetAnalysisByIdUseCase
    ) {
        super(useCase);
    }
};