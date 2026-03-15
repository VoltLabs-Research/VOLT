import { CreateScriptingNotebookUseCase } from '@modules/scripting/application/use-cases/CreateScriptingNotebookUseCase';
import { scriptingValidation } from '@modules/scripting/infrastructure/http/validation/scripting-schemas';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(CreateScriptingNotebookUseCase, {
    validationSchema: scriptingValidation.createNotebook,
    statusCode: HttpStatus.Created,
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});
