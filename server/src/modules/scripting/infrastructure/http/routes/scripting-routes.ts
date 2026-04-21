import { Resource } from '@core/constants/resources';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';
import { buildJupyterProxyUrl, clearJupyterProxyAccessCookie, setJupyterProxyAccessCookie } from '@modules/scripting/infrastructure/utilities/jupyter-proxy';
import { ScriptingJupyterAccessTokenService } from '@modules/scripting/infrastructure/services/ScriptingJupyterAccessTokenService';
import { ErrorCodes } from '@core/constants/error-codes';
import scriptingControllers from '@modules/scripting/infrastructure/http/controllers';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { container } from 'tsyringe';
import type { NextFunction, Response } from 'express';

const scriptingNotebookRepository = container.resolve<IScriptingNotebookRepository>(SCRIPTING_TOKENS.ScriptingNotebookRepository);
const scriptingJupyterAccessTokenService = container.resolve(ScriptingJupyterAccessTokenService);
const teamClusterDaemonClient = container.resolve(TeamClusterDaemonClient);

interface ScriptingSessionStatusInput {
    teamId: string;
    notebookId: string;
};

interface ScriptingSessionStatusRouteParams {
    teamId?: string | string[];
    notebookId?: string | string[];
};

interface ScriptingSessionStatusResponse {
    notebookId: string;
    jupyter: {
        ready: boolean;
        url: string;
        containerStage?: 'creating' | 'starting' | 'ready';
    };
};

interface ScriptingSessionStatusResult {
    runtimeNotebookId?: string;
    response: ScriptingSessionStatusResponse;
};

interface DeleteScriptingSessionResponse {
    notebookId: string;
    deleted: boolean;
};

const normalizeRouteParam = (
    value: string | string[] | undefined,
    fieldName: string,
    required = false
): string | undefined => {
    if (value === undefined) {
        if (required) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                `${fieldName} route parameter is required`
            );
        }

        return undefined;
    }

    const normalizedValue = Array.isArray(value)
        ? value.length === 1
            ? value[0]
            : undefined
        : value;

    if (!normalizedValue) {
        throw ApplicationError.badRequest(
            ErrorCodes.VALIDATION_INVALID_INPUT,
            `${fieldName} route parameter must be a single non-empty string`
        );
    }

    const trimmedValue = normalizedValue.trim();

    if (!trimmedValue) {
        throw ApplicationError.badRequest(
            ErrorCodes.VALIDATION_INVALID_INPUT,
            `${fieldName} route parameter must be a single non-empty string`
        );
    }

    return trimmedValue;
};

const requireRouteParam = (
    value: string | string[] | undefined,
    fieldName: string
): string => {
    const normalizedValue = normalizeRouteParam(value, fieldName, true);

    if (normalizedValue === undefined) {
        throw ApplicationError.badRequest(
            ErrorCodes.VALIDATION_INVALID_INPUT,
            `${fieldName} route parameter is required`
        );
    }

    return normalizedValue;
};

const getScriptingSessionStatusInput = (
    params: ScriptingSessionStatusRouteParams
): ScriptingSessionStatusInput => ({
    teamId: requireRouteParam(params.teamId, 'teamId'),
    notebookId: requireRouteParam(params.notebookId, 'notebookId')
});

const readScriptingSessionStatus = async (
    input: ScriptingSessionStatusInput
): Promise<ScriptingSessionStatusResult> => {
    const notebook = await scriptingNotebookRepository.findByTeamAndNotebookId(input.teamId, input.notebookId);

    if (!notebook) {
        throw ApplicationError.notFound(
            ErrorCodes.SCRIPTING_NOTEBOOK_NOT_FOUND,
            'Notebook not found'
        );
    }

    if (!notebook.props.runtimeNotebookId) {
        return {
            response: {
                notebookId: notebook._id,
                jupyter: {
                    ready: false,
                    url: '',
                    containerStage: 'creating'
                }
            }
        };
    }

    const jupyterUrl = buildJupyterProxyUrl({
        teamId: input.teamId,
        runtimeNotebookId: notebook.props.runtimeNotebookId,
        notebookPath: notebook.props.notebookPath
    });

    if (!notebook.props.teamCluster) {
        return {
            runtimeNotebookId: notebook.props.runtimeNotebookId,
            response: {
                notebookId: notebook._id,
                jupyter: {
                    ready: false,
                    url: jupyterUrl,
                    containerStage: 'creating'
                }
            }
        };
    }

    const { runtime } = await teamClusterDaemonClient.getNotebookRuntime(
        notebook.props.teamCluster,
        notebook.props.runtimeNotebookId
    );

    return {
        runtimeNotebookId: notebook.props.runtimeNotebookId,
        response: {
            notebookId: notebook._id,
            jupyter: {
                ready: Boolean(runtime),
                url: jupyterUrl,
                containerStage: runtime ? 'ready' : 'starting'
            }
        }
    };
};

const handleScriptingSessionStatus = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.userId) {
            throw ApplicationError.unauthorized(
                ErrorCodes.AUTHENTICATION_REQUIRED,
                ErrorCodes.AUTHENTICATION_REQUIRED
            );
        }

        const input = getScriptingSessionStatusInput(req.params);
        const status = await readScriptingSessionStatus(input);

        if (status.runtimeNotebookId && status.response.jupyter.url) {
            const accessToken = scriptingJupyterAccessTokenService.create({
                teamId: input.teamId,
                runtimeNotebookId: status.runtimeNotebookId,
                userId: req.userId
            });

            setJupyterProxyAccessCookie(
                req,
                res,
                accessToken,
                input.teamId,
                status.runtimeNotebookId,
                scriptingJupyterAccessTokenService.getCookieMaxAgeMs()
            );
        }

        res.json({ status: 'success', data: status.response });
    } catch (error) {
        next(error);
    }
};

const handleDeleteScriptingSession = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { teamId, notebookId } = getScriptingSessionStatusInput(req.params);
        const notebook = await scriptingNotebookRepository.findByTeamAndNotebookId(teamId, notebookId);

        if (!notebook) {
            throw ApplicationError.notFound(
                ErrorCodes.SCRIPTING_NOTEBOOK_NOT_FOUND,
                'Notebook not found'
            );
        }

        const runtimeNotebookId = notebook.props.runtimeNotebookId;
        const teamClusterId = notebook.props.teamCluster;

        if (runtimeNotebookId && teamClusterId) {
            try {
                await teamClusterDaemonClient.command(
                    teamClusterId,
                    ChannelCommands.NotebookDelete,
                    { notebookId: runtimeNotebookId }
                );
            } catch {
            }
        }

        await scriptingNotebookRepository.updateById(notebook._id, {
            runtimeNotebookId: undefined
        });

        if (runtimeNotebookId) {
            clearJupyterProxyAccessCookie(req, res, teamId, runtimeNotebookId);
        }

        const response: DeleteScriptingSessionResponse = {
            notebookId: notebook._id,
            deleted: Boolean(runtimeNotebookId)
        };

        res.json({ status: 'success', data: response });
    } catch (error) {
        next(error);
    }
};

export default createHttpModule({
    basePath: '/api/scripting/:teamId',
    resource: Resource.SCRIPTING,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/notebooks', scriptingControllers.listNotebooks.handle);
        router.post('/notebooks', scriptingControllers.createNotebook.handle);
        router.patch('/notebooks/:notebookId', scriptingControllers.updateNotebook.handle);
        router.get('/:trajectoryId/notebooks', scriptingControllers.listNotebooks.handle);
        router.get('/sessions/:notebookId/status', handleScriptingSessionStatus);
        router.delete('/sessions/:notebookId', handleDeleteScriptingSession);
        router.post('/sessions', scriptingControllers.createNotebookJupyterSession.handle);
        router.post('/:trajectoryId/sessions', scriptingControllers.createJupyterSession.handle);
        router.delete('/notebooks/:notebookId', scriptingControllers.deleteNotebook.handle);
    }
});
