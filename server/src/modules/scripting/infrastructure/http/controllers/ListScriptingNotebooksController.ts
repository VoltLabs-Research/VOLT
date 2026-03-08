import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import { ListScriptingNotebooksUseCase } from '@modules/scripting/application/use-cases/ListScriptingNotebooksUseCase';
import { scriptingValidation } from '@modules/scripting/infrastructure/http/validation/scripting-schemas';

export default createPaginatedController(ListScriptingNotebooksUseCase, {
    validationSchema: scriptingValidation.listNotebooks
});
