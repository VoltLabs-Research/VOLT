import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { ListScriptingNotebooksUseCase } from '@modules/scripting/application/use-cases/scripting/ListScriptingNotebooksUseCase';

@injectable()
export default class ListScriptingNotebooksController extends BaseController<ListScriptingNotebooksUseCase> {
    constructor(
        @inject(ListScriptingNotebooksUseCase)
        useCase: ListScriptingNotebooksUseCase
    ) {
        super(useCase);
    }
}
