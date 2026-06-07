import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import { ListScriptingNotebooksUseCase } from '@modules/scripting/application/use-cases/ListScriptingNotebooksUseCase';

export default createPaginatedController(ListScriptingNotebooksUseCase, {
});
