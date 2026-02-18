import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import { CreateAnalysisUseCase } from '@modules/analysis/application/use-cases/CreateAnalysisUseCase';

@injectable()
export class CreateAnalysisController extends BaseController<CreateAnalysisUseCase> {
    constructor(
        @inject(CreateAnalysisUseCase) useCase: CreateAnalysisUseCase
    ){
        super(useCase, HttpStatus.Created);
    }
}
