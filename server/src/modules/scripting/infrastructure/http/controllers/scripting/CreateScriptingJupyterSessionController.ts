import { inject, injectable } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { CreateScriptingJupyterSessionUseCase } from '@modules/scripting/application/use-cases/scripting/CreateScriptingJupyterSessionUseCase';

@injectable()
export default class CreateScriptingJupyterSessionController extends BaseController<CreateScriptingJupyterSessionUseCase> {
    constructor(
        @inject(CreateScriptingJupyterSessionUseCase)
        useCase: CreateScriptingJupyterSessionUseCase
    ) {
        super(useCase);
    }
}
