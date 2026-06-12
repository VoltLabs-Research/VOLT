import { createController } from '@shared/infrastructure/http/controllers/createController';
import { CreateScriptingJupyterSessionUseCase } from '@modules/scripting/application/use-cases/CreateScriptingJupyterSessionUseCase';
import { handleScriptingJupyterSessionSuccess } from '@modules/scripting/infrastructure/http/controllers/utilities/set-jupyter-proxy-auth-cookie';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(CreateScriptingJupyterSessionUseCase, {
    statusCode: HttpStatus.Created,
    handleSuccess: handleScriptingJupyterSessionSuccess
});
