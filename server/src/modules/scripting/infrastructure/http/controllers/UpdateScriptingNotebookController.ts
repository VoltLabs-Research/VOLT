import { UpdateScriptingNotebookUseCase } from '@modules/scripting/application/use-cases/UpdateScriptingNotebookUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(UpdateScriptingNotebookUseCase, {
    statusCode: HttpStatus.OK
});
