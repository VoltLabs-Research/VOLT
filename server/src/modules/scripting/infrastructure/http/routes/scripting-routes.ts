import { Resource } from '@core/constants/resources';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';
import { ScriptingJupyterAccessTokenService } from '@modules/scripting/infrastructure/services/ScriptingJupyterAccessTokenService';
import { ErrorCodes } from '@core/constants/error-codes';
import scriptingControllers from '@modules/scripting/infrastructure/http/controllers';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { container } from 'tsyringe';
import type { NextFunction, Response } from 'express';

const scriptingNotebookRepository = container.resolve<IScriptingNotebookRepository>(SCRIPTING_TOKENS.ScriptingNotebookRepository);
const scriptingJupyterAccessTokenService = container.resolve(ScriptingJupyterAccessTokenService);
const teamClusterDaemonClient = container.resolve(TeamClusterDaemonClient);

interface ScriptingSessionStatusInput {
    teamId: string;
    trajectoryId?: string;
    notebookId?: string;
};

interface ScriptingSessionStatusRouteParams {
    teamId?: string | string[];
    trajectoryId?: string | string[];
    notebookId?: string | string[];
};

interface ScriptingSessionStatusResponse {
    notebookId: string;
    jupyter: {
        ready: boolean;
        url: string;
    };
};

const buildServerBaseUrl = (): string => {
    const configuredServerUrl = process.env.SERVER_ENDPOINT?.trim();
    if (configuredServerUrl) {
        return configuredServerUrl.replace(/\/+$/g, '');
    }

    const protocol = process.env.SERVER_SCHEMA?.trim() || 'http';
    const host = process.env.SERVER_HOSTNAME?.trim() || 'localhost';

    return `${protocol}://${host}`;
};

const buildScriptingProxyUrl = (
    teamId: string,
    runtimeNotebookId: string,
    userId: string
): string => {
    const accessToken = scriptingJupyterAccessTokenService.create({
        teamId,
        runtimeNotebookId,
        userId
    });
    const proxyUrl = new URL(
        `/api/jupyter/${encodeURIComponent(teamId)}/notebooks/${encodeURIComponent(runtimeNotebookId)}`,
        buildServerBaseUrl()
    );

    proxyUrl.searchParams.set('access_token', accessToken);

    return proxyUrl.toString();
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
    trajectoryId: normalizeRouteParam(params.trajectoryId, 'trajectoryId'),
    notebookId: normalizeRouteParam(params.notebookId, 'notebookId')
});

const readScriptingSessionStatus = async (
    input: ScriptingSessionStatusInput,
    userId: string
): Promise<ScriptingSessionStatusResponse> => {
    const notebook = input.notebookId
        ? await scriptingNotebookRepository.findByTeamAndNotebookId(input.teamId, input.notebookId)
        : await scriptingNotebookRepository.findByTeamAndTrajectory(
            input.teamId,
            requireRouteParam(input.trajectoryId, 'trajectoryId')
        );

    if (!notebook) {
        throw ApplicationError.notFound(
            ErrorCodes.SCRIPTING_NOTEBOOK_NOT_FOUND,
            'Notebook not found'
        );
    }

    if (!notebook.props.runtimeNotebookId) {
        return {
            notebookId: notebook.id,
            jupyter: {
                ready: false,
                url: ''
            }
        };
    }

    const jupyterUrl = buildScriptingProxyUrl(input.teamId, notebook.props.runtimeNotebookId, userId);

    if (!notebook.props.teamCluster) {
        return {
            notebookId: notebook.id,
            jupyter: {
                ready: false,
                url: jupyterUrl
            }
        };
    }

    const { runtime } = await teamClusterDaemonClient.getNotebookRuntime(
        notebook.props.teamCluster,
        notebook.props.runtimeNotebookId
    );

    return {
        notebookId: notebook.id,
        jupyter: {
            ready: Boolean(runtime),
            url: jupyterUrl
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

        const status = await readScriptingSessionStatus(
            getScriptingSessionStatusInput(req.params),
            req.userId
        );

        res.json(status);
    } catch (error) {
        next(error);
    }
};

export default createHttpModule({
    basePath: '/api/scripting/:teamId',
    resource: Resource.SCRIPTING,
    routes: (router) => {
        router.get('/notebooks', scriptingControllers.listNotebooks.handle);
        router.post('/notebooks', scriptingControllers.createNotebook.handle);
        router.patch('/notebooks/:notebookId', scriptingControllers.updateNotebook.handle);
        router.get('/:trajectoryId/notebooks', scriptingControllers.listNotebooks.handle);
        router.get('/sessions/:notebookId/status', RATE_LIMIT_POLICIES.scriptingSessionStatus, handleScriptingSessionStatus);
        router.get('/:trajectoryId/sessions/status', RATE_LIMIT_POLICIES.scriptingSessionStatus, handleScriptingSessionStatus);
        router.post('/sessions', RATE_LIMIT_POLICIES.scriptingSessionCreate, scriptingControllers.createNotebookJupyterSession.handle);
        router.post('/:trajectoryId/sessions', RATE_LIMIT_POLICIES.scriptingSessionCreate, scriptingControllers.createJupyterSession.handle);
        router.delete('/notebooks/:notebookId', scriptingControllers.deleteNotebook.handle);
    }
});
