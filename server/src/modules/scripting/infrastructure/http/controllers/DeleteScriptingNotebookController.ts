import { createController } from '@shared/infrastructure/http/controllers/createController';
import { DeleteScriptingNotebookUseCase } from '@modules/scripting/application/use-cases/DeleteScriptingNotebookUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(DeleteScriptingNotebookUseCase, {
    statusCode: HttpStatus.NoContent
});
