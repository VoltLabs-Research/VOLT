import { createController } from '@shared/infrastructure/http/controllers/createController';
import { DeleteScriptingNotebookUseCase } from '@modules/scripting/application/use-cases/DeleteScriptingNotebookUseCase';
import { scriptingValidation } from '@modules/scripting/infrastructure/http/validation/scripting-schemas';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(DeleteScriptingNotebookUseCase, {
    validationSchema: scriptingValidation.deleteNotebook,
    statusCode: HttpStatus.NoContent
});
