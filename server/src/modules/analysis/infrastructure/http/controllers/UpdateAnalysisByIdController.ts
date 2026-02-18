import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { UpdateAnalysisByIdUseCase } from '@modules/analysis/application/use-cases/UpdateAnalysisByIdUseCase';

@injectable()
export class UpdateAnalysisByIdController extends BaseController<UpdateAnalysisByIdUseCase> {
    constructor(
        @inject(UpdateAnalysisByIdUseCase) useCase: UpdateAnalysisByIdUseCase
    ){
        super(useCase);
    }
}
