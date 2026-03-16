import { createController } from '@shared/infrastructure/http/controllers/createController';
import { CreateScriptingJupyterSessionUseCase } from '@modules/scripting/application/use-cases/CreateScriptingJupyterSessionUseCase';
import { scriptingValidation } from '@modules/scripting/infrastructure/http/validation/scripting-schemas';
import { handleScriptingJupyterSessionSuccess } from '@modules/scripting/infrastructure/http/controllers/utilities/set-jupyter-proxy-auth-cookie';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

export default createController(CreateScriptingJupyterSessionUseCase, {
    validationSchema: scriptingValidation.createNotebookJupyterSession,
    statusCode: HttpStatus.Created,
    handleSuccess: handleScriptingJupyterSessionSuccess,
    extendParams: (req: AuthenticatedRequest, params: Record<string, unknown>) => ({
        ...params,
        userId: req.userId
    })
});
