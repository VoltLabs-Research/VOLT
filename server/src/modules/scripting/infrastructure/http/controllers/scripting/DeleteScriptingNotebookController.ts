import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { DeleteScriptingNotebookUseCase } from '@modules/scripting/application/use-cases/scripting/DeleteScriptingNotebookUseCase';

@injectable()
export default class DeleteScriptingNotebookController extends BaseController<DeleteScriptingNotebookUseCase> {
    constructor(
        @inject(DeleteScriptingNotebookUseCase)
        useCase: DeleteScriptingNotebookUseCase
    ) {
        super(useCase);
    }
}
