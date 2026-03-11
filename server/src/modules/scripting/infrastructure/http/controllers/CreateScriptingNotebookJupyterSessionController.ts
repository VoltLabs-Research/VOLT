import { createController } from '@shared/infrastructure/http/controllers/createController';
import { CreateScriptingJupyterSessionUseCase } from '@modules/scripting/application/use-cases/CreateScriptingJupyterSessionUseCase';
import { scriptingValidation } from '@modules/scripting/infrastructure/http/validation/scripting-schemas';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(CreateScriptingJupyterSessionUseCase, {
    validationSchema: scriptingValidation.createNotebookJupyterSession,
    statusCode: HttpStatus.Created
});
