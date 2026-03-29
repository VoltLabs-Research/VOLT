import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { setJupyterProxyAccessCookie } from '@modules/scripting/infrastructure/utilities/jupyter-proxy';
import { ScriptingJupyterAccessTokenService } from '@modules/scripting/infrastructure/services/ScriptingJupyterAccessTokenService';
import { container } from 'tsyringe';
import type { CreateScriptingJupyterSessionOutputDTO } from '@modules/scripting/application/dtos/CreateScriptingJupyterSessionDTO';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { Response } from 'express';

const scriptingJupyterAccessTokenService = container.resolve(ScriptingJupyterAccessTokenService);

export const handleScriptingJupyterSessionSuccess = (
    req: AuthenticatedRequest,
    res: Response,
    value: CreateScriptingJupyterSessionOutputDTO
): void => {
    if (value.jupyter.url) {
        const teamId = Array.isArray(req.params.teamId) ? req.params.teamId[0] : req.params.teamId;

        if (teamId && req.userId && value.notebookId) {
            const accessToken = scriptingJupyterAccessTokenService.create({
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
                scriptingJupyterAccessTokenService.getCookieMaxAgeMs()
            );
        }
    }

    BaseResponse.success(res, value, 201);
};
