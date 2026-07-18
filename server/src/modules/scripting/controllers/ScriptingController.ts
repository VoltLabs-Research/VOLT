import type ScriptingService from '@modules/scripting/services/ScriptingService';
import type { CreateScriptingJupyterSessionInputDTO } from '@modules/scripting/dtos/CreateScriptingJupyterSessionDTO';
import type { CreateScriptingNotebookInputDTO } from '@modules/scripting/dtos/CreateScriptingNotebookDTO';
import type { DeleteScriptingNotebookInputDTO } from '@modules/scripting/dtos/DeleteScriptingNotebookDTO';
import type {
    DeleteScriptingSessionInputDTO,
    GetScriptingSessionStatusInputDTO
} from '@modules/scripting/dtos/ScriptingSessionDTO';
import type { ListScriptingNotebooksInputDTO } from '@modules/scripting/dtos/ListScriptingNotebooksDTO';
import type { UpdateScriptingNotebookInputDTO } from '@modules/scripting/dtos/UpdateScriptingNotebookDTO';
import type { IScriptingJupyterAccessTokenService } from '@modules/scripting/ports/IScriptingJupyterAccessTokenService';
import { SCRIPTING_TOKENS } from '@modules/scripting/di/ScriptingTokens';
import { clearJupyterProxyAccessCookie, setJupyterProxyAccessCookie } from '@modules/scripting/utilities/jupyter-proxy';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { inject, injectable } from 'tsyringe';
import type { Response } from 'express';

/**
 * The single HTTP controller for the scripting module. One Express handler per
 * route, assembling the use-case input exactly as `buildControllerParams` did for
 * the generated controllers, delegating to {@link ScriptingService}, and
 * responding via {@link BaseResponse}. `listNotebooks` reproduces the former
 * `createPaginatedController` behaviour; `createJupyterSession`,
 * `getSessionStatus` and `deleteSession` reproduce their former custom
 * `handleSuccess` behaviour verbatim (setting / clearing the Jupyter-proxy
 * access cookie). Handlers are arrow-function properties so `this` stays bound
 * when passed by reference to the router. Thrown `ApplicationError`s propagate to
 * `httpErrorMiddleware` via Express 5 async forwarding.
 */
@injectable()
export default class ScriptingController {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingService) private readonly scriptingService: ScriptingService,
        @inject(SCRIPTING_TOKENS.ScriptingJupyterAccessTokenService) private readonly scriptingJupyterAccessTokenService: IScriptingJupyterAccessTokenService
    ) {}

    listNotebooks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as ListScriptingNotebooksInputDTO;
        const value = await this.scriptingService.listNotebooks(input);
        BaseResponse.paginated(res, value, value._meta);
    };

    createNotebook = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as CreateScriptingNotebookInputDTO;
        const value = await this.scriptingService.createNotebook(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    };

    updateNotebook = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as UpdateScriptingNotebookInputDTO;
        const value = await this.scriptingService.updateNotebook(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    deleteNotebook = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as DeleteScriptingNotebookInputDTO;
        await this.scriptingService.deleteNotebook(input);
        // Preserves the generated controller's NoContent behaviour: empty body.
        res.status(HttpStatus.NoContent).send();
    };

    getSessionStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetScriptingSessionStatusInputDTO;
        const value = await this.scriptingService.getSessionStatus(input);

        const { runtimeNotebookId, accessToken, ...response } = value;

        if (runtimeNotebookId && accessToken) {
            const teamId = Array.isArray(req.params.teamId) ? req.params.teamId[0] : req.params.teamId;
            if (teamId) {
                setJupyterProxyAccessCookie(
                    req,
                    res,
                    accessToken,
                    teamId,
                    runtimeNotebookId,
                    this.scriptingJupyterAccessTokenService.getCookieMaxAgeMs()
                );
            }
        }

        BaseResponse.success(res, response);
    };

    deleteSession = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as DeleteScriptingSessionInputDTO;
        const value = await this.scriptingService.deleteSession(input);

        const { runtimeNotebookId, ...response } = value;
        const teamId = Array.isArray(req.params.teamId) ? req.params.teamId[0] : req.params.teamId;

        if (runtimeNotebookId && teamId) {
            clearJupyterProxyAccessCookie(req, res, teamId, runtimeNotebookId);
        }

        BaseResponse.success(res, response);
    };

    createJupyterSession = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as CreateScriptingJupyterSessionInputDTO;
        const value = await this.scriptingService.createJupyterSession(input);

        if (value.jupyter.url) {
            const teamId = Array.isArray(req.params.teamId) ? req.params.teamId[0] : req.params.teamId;

            if (teamId && req.userId && value.notebookId) {
                const accessToken = this.scriptingJupyterAccessTokenService.create({
                    teamId,
                    runtimeNotebookId: value.notebookId,
                    userId: req.userId
                });

                setJupyterProxyAccessCookie(
                    req,
                    res,
                    accessToken,
                    teamId,
                    value.notebookId,
                    this.scriptingJupyterAccessTokenService.getCookieMaxAgeMs()
                );
            }
        }

        BaseResponse.success(res, value, 201);
    };
}
