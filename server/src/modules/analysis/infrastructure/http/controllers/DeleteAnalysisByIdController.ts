import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import DeleteAnalysisByIdUseCase from '@modules/analysis/application/use-cases/DeleteAnalysisByIdUseCase';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';

@injectable()
export default class DeleteAnalysisByIdController extends BaseController<DeleteAnalysisByIdUseCase> {
    constructor(
        @inject(DeleteAnalysisByIdUseCase) useCase: DeleteAnalysisByIdUseCase
    ) {
        super(useCase, HttpStatus.Deleted);
    }
};