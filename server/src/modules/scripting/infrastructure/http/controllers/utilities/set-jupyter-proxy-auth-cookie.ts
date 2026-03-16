import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { persistJupyterProxyAccessCookieFromUrl } from '@modules/scripting/infrastructure/utilities/jupyter-proxy';
import type { Response } from 'express';
import type { CreateScriptingJupyterSessionOutputDTO } from '@modules/scripting/application/dtos/CreateScriptingJupyterSessionDTO';

/** Persists the Jupyter proxy auth cookie while preserving the JSON response body. */
export const handleScriptingJupyterSessionSuccess = (
    res: Response,
    value: CreateScriptingJupyterSessionOutputDTO
): void => {
    if (value.jupyter.url) {
        persistJupyterProxyAccessCookieFromUrl(res, value.jupyter.url);
    }

    BaseResponse.success(res, value, 201);
};
