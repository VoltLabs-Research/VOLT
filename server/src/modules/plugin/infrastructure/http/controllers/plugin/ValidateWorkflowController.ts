import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { ValidateWorkflowUseCase } from '@modules/plugin/application/use-cases/plugin/ValidateWorkflowUseCase';

@injectable()
export default class ValidateWorkflowController extends BaseController<ValidateWorkflowUseCase> {
    constructor(
        @inject(ValidateWorkflowUseCase) useCase: ValidateWorkflowUseCase
    ) {
        super(useCase);
    }
}
